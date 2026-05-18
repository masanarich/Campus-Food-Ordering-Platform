const fs = require("fs");
const path = require("path");
const vm = require("vm");

const checkoutQueries = require("../../../public/shared/checkout/checkout-queries.js");
const checkoutModel = require("../../../public/shared/checkout/checkout-model.js");
const checkoutStatus = require("../../../public/shared/checkout/checkout-status.js");

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

function createCheckoutData(overrides = {}) {
    return {
        customerUid: "customer-1",
        customerName: "Tshepo",
        customerEmail: "tshepo@example.com",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        status: "payment_pending",
        items: [
            {
                id: "burger",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                name: "Burger",
                price: 50,
                quantity: 2
            }
        ],
        createdAt: "t-1",
        updatedAt: "t-2",
        paymentReference: "ref-1",
        paymentAccessCode: "access-1",
        paymentAuthorizationUrl: "https://pay.example",
        ...overrides
    };
}

describe("shared/checkout/checkout-queries.js", () => {
    test("exports constants, normalizers, and dependency resolvers", () => {
        expect(checkoutQueries.MODULE_NAME).toBe("checkout-queries");
        expect(checkoutQueries.CHECKOUTS_COLLECTION).toBe("checkoutSessions");
        expect(checkoutQueries.normalizeText(" ref ")).toBe("ref");
        expect(checkoutQueries.normalizeLowerText(" PAYMENT_PENDING ")).toBe("payment_pending");
        expect(checkoutQueries.normalizePositiveInteger("3")).toBe(3);
        expect(checkoutQueries.normalizePositiveInteger("bad", "2")).toBe(2);
        expect(checkoutQueries.normalizePositiveInteger("bad")).toBe(0);
        expect(checkoutQueries.resolveCheckoutModel(checkoutModel)).toBe(checkoutModel);
        expect(checkoutQueries.resolveCheckoutStatus(checkoutStatus)).toBe(checkoutStatus);
        expect(checkoutQueries.resolveCheckoutModel({})).toBeNull();
        expect(checkoutQueries.resolveCheckoutStatus({})).toBeNull();
        expect(checkoutQueries.resolveCheckoutModel()).toEqual(checkoutModel);
        expect(checkoutQueries.resolveCheckoutStatus()).toEqual(checkoutStatus);
    });

    test("resolves dependencies from globals and returns null when require cannot load", () => {
        const originalModel = global.checkoutModel;
        const originalStatus = global.checkoutStatus;

        global.checkoutModel = checkoutModel;
        global.checkoutStatus = checkoutStatus;
        expect(checkoutQueries.resolveCheckoutModel()).toBe(checkoutModel);
        expect(checkoutQueries.resolveCheckoutStatus()).toBe(checkoutStatus);

        const sourcePath = path.resolve(__dirname, "../../../public/shared/checkout/checkout-queries.js");
        const context = {
            window: {},
            require: () => {
                throw new Error("missing");
            }
        };
        vm.createContext(context);
        vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context);
        expect(context.window.checkoutQueries.resolveCheckoutModel()).toBeNull();
        expect(context.window.checkoutQueries.resolveCheckoutStatus()).toBeNull();

        global.checkoutModel = originalModel;
        global.checkoutStatus = originalStatus;
    });

    test("creates Firestore constraints and queries with fallbacks or factory functions", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns();
        const fallbackConstraint = checkoutQueries.createFirestoreConstraint("where", ["status", "==", "draft"]);
        const fallbackQuery = checkoutQueries.createFirestoreQuery({ collection: true }, [null, fallbackConstraint]);

        expect(fallbackConstraint).toEqual({
            type: "where",
            args: ["status", "==", "draft"]
        });
        expect(fallbackQuery).toEqual({
            collectionRef: { collection: true },
            constraints: [fallbackConstraint]
        });
        expect(checkoutQueries.createFirestoreConstraint("where", "not-array")).toEqual({
            type: "where",
            args: []
        });

        expect(checkoutQueries.getCheckoutsCollectionRef(db, firestoreFns)).toEqual({
            kind: "collection",
            db,
            segments: ["checkoutSessions"]
        });
        expect(checkoutQueries.getCheckoutDocRef(db, " checkout-1 ", firestoreFns)).toEqual({
            kind: "doc",
            db,
            segments: ["checkoutSessions", "checkout-1"],
            id: "checkout-1"
        });
        expect(checkoutQueries.getCheckoutsCollectionRef(null, firestoreFns)).toBeNull();
        expect(checkoutQueries.getCheckoutDocRef(null, "checkout-1", firestoreFns)).toBeNull();
        expect(checkoutQueries.getCheckoutDocRef(db, "", firestoreFns)).toBeNull();

        const constraint = checkoutQueries.createFirestoreConstraint(
            "where",
            ["customerUid", "==", "customer-1"],
            firestoreFns
        );
        expect(constraint).toEqual({
            type: "where",
            field: "customerUid",
            operator: "==",
            value: "customer-1"
        });
        expect(checkoutQueries.createFirestoreQuery(
            checkoutQueries.getCheckoutsCollectionRef(db, firestoreFns),
            [constraint],
            firestoreFns
        )).toEqual(expect.objectContaining({
            kind: "query",
            constraints: [constraint]
        }));
    });

    test("normalizes filters and builds equality or in constraints", () => {
        expect(checkoutQueries.normalizeFilterList([" A ", "a", "", "B"]))
            .toEqual(["a", "b"]);
        expect(checkoutQueries.normalizeFilterList("Open", value => checkoutQueries.normalizeText(value)))
            .toEqual(["Open"]);
        expect(checkoutQueries.normalizeStatusFilters([
            "Payment Pending",
            "payment_pending",
            "failed"
        ], checkoutStatus)).toEqual(["payment_pending", "payment_failed"]);
        expect(checkoutQueries.normalizeStatusFilters([" Payment Pending "], {}))
            .toEqual(["payment pending"]);
        expect(checkoutQueries.getDefaultResumableStatuses(checkoutStatus))
            .toEqual(["draft", "payment_pending", "payment_failed"]);
        expect(checkoutQueries.getDefaultActiveStatuses(checkoutStatus))
            .toEqual(["draft", "payment_pending", "payment_failed", "paid"]);
        expect(checkoutQueries.getDefaultResumableStatuses({}))
            .toEqual(["draft", "payment_pending", "payment_failed"]);
        expect(checkoutQueries.getDefaultActiveStatuses({}))
            .toEqual(["draft", "payment_pending", "payment_failed", "paid"]);

        expect(checkoutQueries.buildEqualityOrInConstraint("status", [], null)).toBeNull();
        expect(checkoutQueries.buildEqualityOrInConstraint("status", ["draft"], null)).toEqual({
            type: "where",
            args: ["status", "==", "draft"]
        });
        expect(checkoutQueries.buildEqualityOrInConstraint("status", ["draft", "paid"], null)).toEqual({
            type: "where",
            args: ["status", "in", ["draft", "paid"]]
        });
        expect(checkoutQueries.buildStatusConstraints(["draft"], null, checkoutStatus)).toEqual([
            {
                type: "where",
                args: ["status", "==", "draft"]
            }
        ]);
    });

    test("builds customer, vendor, active, resumable, and payment-reference queries", () => {
        const db = { name: "db" };
        const firestoreFns = createFirestoreFns({ includeQuery: false });

        const customerQuery = checkoutQueries.buildCustomerCheckoutsQuery({
            db,
            firestoreFns,
            checkoutStatus,
            customerUid: " customer-1 ",
            statuses: ["draft", "payment_failed"],
            limitCount: 5
        });
        expect(customerQuery.collectionRef.segments).toEqual(["checkoutSessions"]);
        expect(customerQuery.constraints).toEqual([
            { type: "where", field: "customerUid", operator: "==", value: "customer-1" },
            { type: "where", field: "status", operator: "in", value: ["draft", "payment_failed"] },
            { type: "orderBy", field: "updatedAt", direction: "desc" },
            { type: "orderBy", field: "createdAt", direction: "desc" },
            { type: "limit", count: 5 }
        ]);

        const vendorQuery = checkoutQueries.buildVendorCheckoutsQuery({
            db,
            firestoreFns,
            vendorUid: "vendor-1",
            statuses: "paid",
            orderByField: "createdAt",
            orderDirection: "asc",
            includeCreatedAtOrder: false
        });
        expect(vendorQuery.constraints).toEqual([
            { type: "where", field: "vendorUid", operator: "==", value: "vendor-1" },
            { type: "where", field: "status", operator: "==", value: "paid" },
            { type: "orderBy", field: "createdAt", direction: "asc" }
        ]);

        expect(checkoutQueries.buildActiveCustomerCheckoutQuery({
            db,
            firestoreFns,
            checkoutStatus,
            customerUid: "customer-1"
        }).constraints).toContainEqual({ type: "limit", count: 1 });
        expect(checkoutQueries.buildResumableCustomerCheckoutQuery({
            db,
            firestoreFns,
            checkoutStatus,
            customerUid: "customer-1"
        }).constraints).toContainEqual({
            type: "where",
            field: "status",
            operator: "in",
            value: ["draft", "payment_pending", "payment_failed"]
        });
        expect(checkoutQueries.buildPaymentReferenceQuery({
            db,
            firestoreFns,
            reference: " ref-1 "
        }).constraints).toEqual([
            { type: "where", field: "paymentReference", operator: "==", value: "ref-1" },
            { type: "orderBy", field: "updatedAt", direction: "desc" },
            { type: "orderBy", field: "createdAt", direction: "desc" },
            { type: "limit", count: 1 }
        ]);
    });

    test("maps snapshots into normalized checkout records", () => {
        const snapshot = createDocSnapshot("checkout-1", createCheckoutData());
        const missingSnapshot = createDocSnapshot("missing", {}, false);

        expect(checkoutQueries.getSnapshotData(null)).toEqual({});
        expect(checkoutQueries.getSnapshotData({ data: () => null })).toEqual({});
        expect(checkoutQueries.snapshotExists(null)).toBe(false);
        expect(checkoutQueries.snapshotExists({ exists: false })).toBe(true);
        expect(checkoutQueries.snapshotExists(missingSnapshot)).toBe(false);

        const mapped = checkoutQueries.mapCheckoutDocument(snapshot, {
            checkoutModel,
            checkoutStatus
        });
        expect(mapped).toEqual(expect.objectContaining({
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "payment_pending",
            paymentAmount: 100,
            paymentAmountInMinorUnits: 10000
        }));
        expect(checkoutQueries.mapCheckoutDocument(missingSnapshot)).toBeNull();
        expect(checkoutQueries.mapCheckoutDocument(snapshot, {
            checkoutModel: {}
        })).toEqual({
            checkoutId: "checkout-1",
            ...createCheckoutData()
        });

        const documents = checkoutQueries.mapCheckoutDocuments(createQuerySnapshot([
            snapshot,
            missingSnapshot,
            createDocSnapshot("checkout-2", createCheckoutData({ status: "paid" }))
        ]), {
            checkoutModel,
            checkoutStatus
        });
        expect(documents).toHaveLength(2);
        expect(checkoutQueries.mapCheckoutDocuments(null)).toEqual([]);
        expect(checkoutQueries.getFirstCheckoutFromSnapshot(createQuerySnapshot([snapshot]), {
            checkoutModel,
            checkoutStatus
        }).checkoutId).toBe("checkout-1");
        expect(checkoutQueries.getFirstCheckoutFromSnapshot(createQuerySnapshot([]))).toBeNull();
    });

    test("fetches checkout documents and query lists", async () => {
        const db = { name: "db" };
        const docs = [
            createDocSnapshot("checkout-1", createCheckoutData()),
            createDocSnapshot("checkout-2", createCheckoutData({ status: "payment_failed" }))
        ];
        const firestoreFns = createFirestoreFns({
            getDocResult: createDocSnapshot("checkout-1", createCheckoutData()),
            getDocsResult: createQuerySnapshot(docs)
        });
        const options = {
            db,
            firestoreFns,
            checkoutModel,
            checkoutStatus,
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            paymentReference: "ref-1"
        };

        await expect(checkoutQueries.fetchCheckoutById(options))
            .resolves.toEqual(expect.objectContaining({ checkoutId: "checkout-1" }));
        await expect(checkoutQueries.fetchCustomerCheckouts(options))
            .resolves.toHaveLength(2);
        await expect(checkoutQueries.fetchVendorCheckouts(options))
            .resolves.toHaveLength(2);
        await expect(checkoutQueries.fetchActiveCustomerCheckout(options))
            .resolves.toEqual(expect.objectContaining({ checkoutId: "checkout-1" }));
        await expect(checkoutQueries.fetchResumableCustomerCheckout(options))
            .resolves.toEqual(expect.objectContaining({ checkoutId: "checkout-1" }));
        await expect(checkoutQueries.fetchCheckoutByPaymentReference(options))
            .resolves.toEqual(expect.objectContaining({ checkoutId: "checkout-1" }));
        expect(firestoreFns.getDoc).toHaveBeenCalledTimes(1);
        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(5);

        await expect(checkoutQueries.fetchCheckoutById({
            db,
            firestoreFns: {},
            checkoutId: "checkout-1"
        })).resolves.toBeNull();
        await expect(checkoutQueries.fetchCustomerCheckouts({ firestoreFns: {} }))
            .resolves.toEqual([]);
        await expect(checkoutQueries.fetchVendorCheckouts({ firestoreFns: {} }))
            .resolves.toEqual([]);
        await expect(checkoutQueries.fetchActiveCustomerCheckout({ firestoreFns: {} }))
            .resolves.toBeNull();
        await expect(checkoutQueries.fetchResumableCustomerCheckout({ firestoreFns: {} }))
            .resolves.toBeNull();
        await expect(checkoutQueries.fetchCheckoutByPaymentReference({ firestoreFns: {} }))
            .resolves.toBeNull();
    });

    test("attaches checkout queries to a browser-like global scope", () => {
        const sourcePath = path.resolve(__dirname, "../../../public/shared/checkout/checkout-queries.js");
        const context = {
            window: {
                checkoutModel,
                checkoutStatus
            }
        };

        vm.createContext(context);
        vm.runInContext(fs.readFileSync(sourcePath, "utf8"), context);

        expect(context.window.checkoutQueries.MODULE_NAME).toBe("checkout-queries");
        expect(context.window.checkoutQueries.normalizeStatusFilters("pending"))
            .toEqual(["payment_pending"]);
    });
});
