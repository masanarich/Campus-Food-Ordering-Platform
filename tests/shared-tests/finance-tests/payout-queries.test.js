const fs = require("fs");
const path = require("path");
const vm = require("vm");

const payoutQueries = require("../../../public/shared/finance/payout-queries.js");
const payoutModel = require("../../../public/shared/finance/payout-model.js");

function createDocSnapshot(id, data, exists = true) {
    return {
        id,
        data: jest.fn(() => data),
        exists: jest.fn(() => exists)
    };
}

function createQuerySnapshot(docs) {
    return {
        docs
    };
}

function createFirestoreFns(options = {}) {
    return {
        collection: jest.fn((db, ...segments) => ({
            kind: "collection",
            db,
            segments
        })),
        doc: jest.fn((db, ...segments) => ({
            kind: "doc",
            db,
            segments,
            id: segments[segments.length - 1]
        })),
        where: jest.fn((field, operator, value) => ({
            type: "where",
            field,
            operator,
            value
        })),
        orderBy: jest.fn((field, direction) => ({
            type: "orderBy",
            field,
            direction
        })),
        limit: jest.fn(count => ({
            type: "limit",
            count
        })),
        query: options.includeQuery === false
            ? undefined
            : jest.fn((collectionRef, ...constraints) => ({
                kind: "query",
                collectionRef,
                constraints
            })),
        getDoc: jest.fn(async () => options.getDocResult),
        getDocs: jest.fn(async () => options.getDocsResult || createQuerySnapshot([]))
    };
}

function createPayoutData(overrides = {}) {
    return {
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        vendorEmail: "vendor@example.com",
        amount: 100,
        status: "pending",
        fakeBankName: "Demo Bank",
        fakeAccountHolder: "Campus Bites",
        fakeAccountNumberLast4: "1234",
        fakeAccountNumberMasked: "****1234",
        fakeBranchCode: "250655",
        requestedAt: "2026-05-21T10:00:00Z",
        createdAt: "2026-05-21T10:00:00Z",
        updatedAt: "2026-05-21T10:00:00Z",
        ...overrides
    };
}

describe("shared/finance/payout-queries.js", () => {
    test("exports constants, normalizers, and dependency resolver", () => {
        expect(payoutQueries.MODULE_NAME).toBe("payout-queries");
        expect(payoutQueries.PAYOUTS_COLLECTION).toBe("payoutRequests");
        expect(payoutQueries.normalizeText(" payout-1 ")).toBe("payout-1");
        expect(payoutQueries.normalizeLowerText(" PENDING ")).toBe("pending");
        expect(payoutQueries.normalizePositiveInteger("3")).toBe(3);
        expect(payoutQueries.normalizePositiveInteger("bad", "2")).toBe(2);
        expect(payoutQueries.normalizePositiveInteger("bad")).toBe(0);
        expect(payoutQueries.resolvePayoutModel(payoutModel)).toBe(payoutModel);
        expect(payoutQueries.resolvePayoutModel({})).toBeNull();
        expect(payoutQueries.resolvePayoutModel()).toEqual(payoutModel);
    });

    test("resolves payout model from globals and returns null when require cannot load", () => {
        const originalPayoutModel = global.payoutModel;

        global.payoutModel = payoutModel;
        expect(payoutQueries.resolvePayoutModel()).toBe(payoutModel);

        const sourcePath = path.resolve(__dirname, "../../../public/shared/finance/payout-queries.js");
        const context = {
            window: {},
            require: () => {
                throw new Error("missing");
            }
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context);
        expect(context.window.payoutQueries.resolvePayoutModel()).toBeNull();

        if (originalPayoutModel === undefined) {
            delete global.payoutModel;
        } else {
            global.payoutModel = originalPayoutModel;
        }
    });

    test("creates Firestore refs, constraints, and fallback query objects", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();
        const fallbackConstraint = payoutQueries.createFirestoreConstraint("where", ["status", "==", "pending"]);
        const fallbackQuery = payoutQueries.createFirestoreQuery({ collection: true }, [null, fallbackConstraint]);

        expect(fallbackConstraint).toEqual({
            type: "where",
            args: ["status", "==", "pending"]
        });
        expect(fallbackQuery).toEqual({
            collectionRef: { collection: true },
            constraints: [fallbackConstraint]
        });
        expect(payoutQueries.createFirestoreConstraint("where", "not-array")).toEqual({
            type: "where",
            args: []
        });

        expect(payoutQueries.getPayoutsCollectionRef(db, firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["payoutRequests"]
        });
        expect(payoutQueries.getPayoutDocRef(db, " payout-1 ", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["payoutRequests", "payout-1"],
            id: "payout-1"
        });
        expect(payoutQueries.getPayoutsCollectionRef(null, firestoreFns)).toBeNull();
        expect(payoutQueries.getPayoutDocRef(null, "payout-1", firestoreFns)).toBeNull();
        expect(payoutQueries.getPayoutDocRef(db, "", firestoreFns)).toBeNull();

        const constraint = payoutQueries.createFirestoreConstraint(
            "where",
            ["vendorUid", "==", "vendor-1"],
            firestoreFns
        );
        expect(constraint).toEqual({
            type: "where",
            field: "vendorUid",
            operator: "==",
            value: "vendor-1"
        });
        expect(payoutQueries.createFirestoreQuery(
            payoutQueries.getPayoutsCollectionRef(db, firestoreFns),
            [constraint],
            firestoreFns
        )).toEqual(expect.objectContaining({
            kind: "query",
            constraints: [constraint]
        }));
    });

    test("normalizes filters and builds status constraints", () => {
        expect(payoutQueries.normalizeFilterList([" A ", "a", "", "B"]))
            .toEqual(["a", "b"]);
        expect(payoutQueries.normalizeFilterList("Open", value => payoutQueries.normalizeText(value)))
            .toEqual(["Open"]);
        expect(payoutQueries.normalizeStatusFilters([" APPROVED ", "paid", "bad"], payoutModel))
            .toEqual(["approved", "paid", "pending"]);
        expect(payoutQueries.normalizeStatusFilters([" APPROVED "], {}))
            .toEqual(["approved"]);
        expect(payoutQueries.getDefaultActiveStatuses(payoutModel))
            .toEqual(["pending", "approved"]);
        expect(payoutQueries.getBalanceReservingStatuses(payoutModel))
            .toEqual(["pending", "approved", "paid"]);
        expect(payoutQueries.getDefaultActiveStatuses({})).toEqual(["pending", "approved"]);
        expect(payoutQueries.getBalanceReservingStatuses({})).toEqual(["pending", "approved", "paid"]);

        expect(payoutQueries.buildEqualityOrInConstraint("status", [], null)).toBeNull();
        expect(payoutQueries.buildEqualityOrInConstraint("status", ["pending"], null)).toEqual({
            type: "where",
            args: ["status", "==", "pending"]
        });
        expect(payoutQueries.buildEqualityOrInConstraint("status", ["pending", "paid"], null)).toEqual({
            type: "where",
            args: ["status", "in", ["pending", "paid"]]
        });
        expect(payoutQueries.buildStatusConstraints(["approved"], null, payoutModel)).toEqual([
            {
                type: "where",
                args: ["status", "==", "approved"]
            }
        ]);
    });

    test("applies common query options and builds vendor/admin query shapes", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();

        const vendorQuery = payoutQueries.buildVendorPayoutsQuery({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            statuses: ["pending", "approved"],
            limitCount: 5
        });

        expect(vendorQuery.collectionRef).toEqual({
            kind: "collection",
            db,
            segments: ["payoutRequests"]
        });
        expect(vendorQuery.constraints).toEqual([
            { type: "where", field: "vendorUid", operator: "==", value: "vendor-1" },
            { type: "where", field: "status", operator: "in", value: ["pending", "approved"] },
            { type: "orderBy", field: "updatedAt", direction: "desc" },
            { type: "orderBy", field: "requestedAt", direction: "desc" },
            { type: "limit", count: 5 }
        ]);

        const adminQuery = payoutQueries.buildAdminPayoutsQuery({
            db,
            firestoreFns,
            statuses: "paid",
            orderByField: "processedAt",
            orderDirection: "asc",
            includeRequestedAtOrder: false
        });

        expect(adminQuery.constraints).toEqual([
            { type: "where", field: "status", operator: "==", value: "paid" },
            { type: "orderBy", field: "processedAt", direction: "asc" }
        ]);
    });

    test("builds active, balance-reserving, and status query helpers", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();

        const activeQuery = payoutQueries.buildActiveVendorPayoutsQuery({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            payoutModel
        });
        expect(activeQuery.constraints[1]).toEqual({
            type: "where",
            field: "status",
            operator: "in",
            value: ["pending", "approved"]
        });

        const balanceQuery = payoutQueries.buildBalanceReservingVendorPayoutsQuery({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            payoutModel
        });
        expect(balanceQuery.constraints[1]).toEqual({
            type: "where",
            field: "status",
            operator: "in",
            value: ["pending", "approved", "paid"]
        });

        const statusQuery = payoutQueries.buildPayoutStatusQuery({
            db,
            firestoreFns,
            status: "rejected"
        });
        expect(statusQuery.constraints[0]).toEqual({
            type: "where",
            field: "status",
            operator: "==",
            value: "rejected"
        });
    });

    test("maps payout documents and handles missing snapshots", () => {
        const doc = createDocSnapshot("payout-1", createPayoutData({
            amount: "80.555",
            status: "approved"
        }));
        const missingDoc = createDocSnapshot("missing", {}, false);

        expect(payoutQueries.getSnapshotData(doc)).toEqual(createPayoutData({
            amount: "80.555",
            status: "approved"
        }));
        expect(payoutQueries.getSnapshotData(null)).toEqual({});
        expect(payoutQueries.snapshotExists(doc)).toBe(true);
        expect(payoutQueries.snapshotExists(missingDoc)).toBe(false);
        expect(payoutQueries.snapshotExists({ exists: false })).toBe(false);

        const mapped = payoutQueries.mapPayoutDocument(doc, { payoutModel });
        expect(mapped).toMatchObject({
            payoutId: "payout-1",
            vendorUid: "vendor-1",
            amount: 80.56,
            status: "approved",
            statusLabel: "Approved"
        });
        expect(payoutQueries.mapPayoutDocument(missingDoc, { payoutModel })).toBeNull();

        const rawMapped = payoutQueries.mapPayoutDocument(doc, { payoutModel: {} });
        expect(rawMapped).toMatchObject({
            payoutId: "payout-1",
            amount: "80.555"
        });
    });

    test("maps query snapshots and picks first payout", () => {
        const snapshot = createQuerySnapshot([
            createDocSnapshot("payout-1", createPayoutData({ amount: 10 })),
            createDocSnapshot("payout-2", createPayoutData({ amount: 20 })),
            createDocSnapshot("missing", {}, false)
        ]);

        const payouts = payoutQueries.mapPayoutDocuments(snapshot, { payoutModel });

        expect(payouts).toHaveLength(2);
        expect(payouts.map(payout => payout.payoutId)).toEqual(["payout-1", "payout-2"]);
        expect(payoutQueries.mapPayoutDocuments(null)).toEqual([]);
        expect(payoutQueries.getFirstPayoutFromSnapshot(snapshot, { payoutModel }).payoutId)
            .toBe("payout-1");
        expect(payoutQueries.getFirstPayoutFromSnapshot(createQuerySnapshot([]))).toBeNull();
    });

    test("fetches payout by id and returns null when helpers are missing", async () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("payout-1", createPayoutData({ status: "paid" }))
        });

        const payout = await payoutQueries.fetchPayoutById({
            db,
            firestoreFns,
            payoutId: "payout-1",
            payoutModel
        });

        expect(firestoreFns.getDoc).toHaveBeenCalledWith({
            kind: "doc",
            db,
            segments: ["payoutRequests", "payout-1"],
            id: "payout-1"
        });
        expect(payout).toMatchObject({
            payoutId: "payout-1",
            status: "paid"
        });
        expect(await payoutQueries.fetchPayoutById({ db, firestoreFns: {}, payoutId: "payout-1" }))
            .toBeNull();
        expect(await payoutQueries.fetchPayoutById({ db, firestoreFns, payoutId: "" }))
            .toBeNull();
    });

    test("fetches vendor, admin, active, balance-reserving, and first status payouts", async () => {
        const db = { name: "db" };
        const snapshot = createQuerySnapshot([
            createDocSnapshot("payout-1", createPayoutData({ status: "pending" })),
            createDocSnapshot("payout-2", createPayoutData({ status: "approved" }))
        ]);
        const firestoreFns = createFirestoreFns({
            getDocsResult: snapshot
        });

        await expect(payoutQueries.fetchVendorPayouts({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            payoutModel
        })).resolves.toHaveLength(2);
        await expect(payoutQueries.fetchAdminPayouts({
            db,
            firestoreFns,
            payoutModel
        })).resolves.toHaveLength(2);
        await expect(payoutQueries.fetchActiveVendorPayouts({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            payoutModel
        })).resolves.toHaveLength(2);
        await expect(payoutQueries.fetchBalanceReservingVendorPayouts({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            payoutModel
        })).resolves.toHaveLength(2);
        await expect(payoutQueries.fetchFirstPayoutByStatus({
            db,
            firestoreFns,
            status: "pending",
            payoutModel
        })).resolves.toMatchObject({
            payoutId: "payout-1"
        });

        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(5);
        await expect(payoutQueries.fetchVendorPayouts({ firestoreFns: {} })).resolves.toEqual([]);
        await expect(payoutQueries.fetchAdminPayouts({ firestoreFns: {} })).resolves.toEqual([]);
        await expect(payoutQueries.fetchActiveVendorPayouts({ firestoreFns: {} })).resolves.toEqual([]);
        await expect(payoutQueries.fetchBalanceReservingVendorPayouts({ firestoreFns: {} })).resolves.toEqual([]);
        await expect(payoutQueries.fetchFirstPayoutByStatus({ firestoreFns: {} })).resolves.toBeNull();
    });
});
