const ticketQueries = require("../../../public/shared/support/ticket-queries.js");
const ticketModel = require("../../../public/shared/support/ticket-model.js");
const ticketStatus = require("../../../public/shared/support/ticket-status.js");
const ticketCategories = require("../../../public/shared/support/ticket-categories.js");

function makeFirestoreFns(overrides = {}) {
    return {
        collection: jest.fn((db, ...path) => ({ kind: "collection", db, path })),
        doc: jest.fn((db, ...rest) => ({ kind: "doc", db, path: rest, id: rest[rest.length - 1] })),
        where: jest.fn((field, op, value) => ({ kind: "where", field, op, value })),
        orderBy: jest.fn((field, direction) => ({ kind: "orderBy", field, direction })),
        limit: jest.fn((count) => ({ kind: "limit", count })),
        query: jest.fn((collectionRef, ...constraints) => ({
            kind: "query",
            collectionRef,
            constraints
        })),
        getDoc: jest.fn(),
        getDocs: jest.fn(),
        ...overrides
    };
}

function makeDocSnapshot(id, data, options = {}) {
    return {
        id,
        exists: typeof options.exists === "function"
            ? options.exists
            : () => options.exists !== false,
        data: () => data
    };
}

describe("shared/support/ticket-queries.js", () => {
    afterEach(() => {
        if (typeof global !== "undefined") {
            delete global.ticketModel;
            delete global.ticketStatus;
            delete global.ticketCategories;
        }
    });

    test("exposes the expected module surface and constants", () => {
        expect(ticketQueries.MODULE_NAME).toBe("ticket-queries");
        expect(ticketQueries.SUPPORT_TICKETS_COLLECTION).toBe("supportTickets");
        expect(ticketQueries.REPLIES_SUBCOLLECTION).toBe("replies");

        [
            "resolveTicketModel",
            "resolveTicketStatus",
            "resolveTicketCategories",
            "getTicketsCollectionRef",
            "getTicketDocRef",
            "getRepliesCollectionRef",
            "getReplyDocRef",
            "buildReporterTicketsQuery",
            "buildAdminTicketsQuery",
            "buildRepliesQuery",
            "mapTicketDocument",
            "mapReplyDocument",
            "fetchTicketById",
            "fetchReporterTickets",
            "fetchAdminTickets",
            "fetchTicketReplies"
        ].forEach((name) => {
            expect(typeof ticketQueries[name]).toBe("function");
        });
    });

    test("resolvers accept explicit, global, and require fallbacks", () => {
        const fakeModel = { normalizeTicketRecord: jest.fn() };
        expect(ticketQueries.resolveTicketModel(fakeModel)).toBe(fakeModel);
        global.ticketModel = fakeModel;
        expect(ticketQueries.resolveTicketModel()).toBe(fakeModel);
        delete global.ticketModel;
        expect(ticketQueries.resolveTicketModel()).toBe(ticketModel);
        expect(ticketQueries.resolveTicketModel({ not: "a model" })).toBe(ticketModel);

        const fakeStatus = { normalizeTicketStatus: jest.fn() };
        expect(ticketQueries.resolveTicketStatus(fakeStatus)).toBe(fakeStatus);
        global.ticketStatus = fakeStatus;
        expect(ticketQueries.resolveTicketStatus()).toBe(fakeStatus);
        delete global.ticketStatus;
        expect(ticketQueries.resolveTicketStatus()).toBe(ticketStatus);

        const fakeCategories = { normalizeTicketCategory: jest.fn() };
        expect(ticketQueries.resolveTicketCategories(fakeCategories)).toBe(fakeCategories);
        global.ticketCategories = fakeCategories;
        expect(ticketQueries.resolveTicketCategories()).toBe(fakeCategories);
        delete global.ticketCategories;
        expect(ticketQueries.resolveTicketCategories()).toBe(ticketCategories);
    });

    test("primitive helpers behave defensively", () => {
        expect(ticketQueries.normalizeText("  hi ")).toBe("hi");
        expect(ticketQueries.normalizeText(null)).toBe("");
        expect(ticketQueries.normalizeText(42)).toBe("");

        expect(ticketQueries.normalizeLowerText(" HEY ")).toBe("hey");

        expect(ticketQueries.normalizePositiveInteger("5")).toBe(5);
        expect(ticketQueries.normalizePositiveInteger(-1, 3)).toBe(3);
        expect(ticketQueries.normalizePositiveInteger("bad")).toBe(0);
    });

    test("createFirestoreConstraint delegates to firestoreFns and falls back to a descriptor", () => {
        const firestoreFns = makeFirestoreFns();
        const constraint = ticketQueries.createFirestoreConstraint(
            "where",
            ["status", "==", "open"],
            firestoreFns
        );
        expect(constraint).toEqual({ kind: "where", field: "status", op: "==", value: "open" });

        const fallback = ticketQueries.createFirestoreConstraint("orderBy", ["createdAt", "asc"]);
        expect(fallback).toEqual({ type: "orderBy", args: ["createdAt", "asc"] });

        const fallbackNoArgs = ticketQueries.createFirestoreConstraint("limit", null);
        expect(fallbackNoArgs).toEqual({ type: "limit", args: [] });
    });

    test("createFirestoreQuery delegates to firestoreFns.query and falls back to a wrapper", () => {
        const firestoreFns = makeFirestoreFns();
        const query = ticketQueries.createFirestoreQuery(
            { kind: "collection" },
            [{ kind: "where" }, null, { kind: "orderBy" }],
            firestoreFns
        );
        expect(query.constraints).toHaveLength(2);

        const fallback = ticketQueries.createFirestoreQuery(
            { kind: "collection" },
            [{ a: 1 }, null]
        );
        expect(fallback).toEqual({
            collectionRef: { kind: "collection" },
            constraints: [{ a: 1 }]
        });

        const empty = ticketQueries.createFirestoreQuery({ kind: "collection" }, null);
        expect(empty.constraints).toEqual([]);
    });

    test("ref helpers build the canonical Firestore paths", () => {
        const firestoreFns = makeFirestoreFns();
        const db = { kind: "db" };

        const collectionRef = ticketQueries.getTicketsCollectionRef(db, firestoreFns);
        expect(collectionRef.path).toEqual(["supportTickets"]);

        const ticketDocRef = ticketQueries.getTicketDocRef(db, " t-1 ", firestoreFns);
        expect(ticketDocRef.path).toEqual(["supportTickets", "t-1"]);
        expect(ticketDocRef.id).toBe("t-1");

        const repliesRef = ticketQueries.getRepliesCollectionRef(db, "t-1", firestoreFns);
        expect(repliesRef.path).toEqual(["supportTickets", "t-1", "replies"]);

        const replyDocRef = ticketQueries.getReplyDocRef(db, "t-1", "r-1", firestoreFns);
        expect(replyDocRef.path).toEqual(["supportTickets", "t-1", "replies", "r-1"]);
    });

    test("normalizeFilterList handles arrays, single values, null, and removes blanks and duplicates", () => {
        expect(ticketQueries.normalizeFilterList(["open", "open", "  OPEN "])).toEqual(["open"]);
        expect(ticketQueries.normalizeFilterList("open")).toEqual(["open"]);
        expect(ticketQueries.normalizeFilterList(null)).toEqual([]);
        expect(ticketQueries.normalizeFilterList(undefined)).toEqual([]);
        expect(ticketQueries.normalizeFilterList(["a", "", null])).toEqual(["a"]);

        const result = ticketQueries.normalizeFilterList(
            ["alpha", "beta"],
            (value) => value.toUpperCase()
        );
        expect(result).toEqual(["ALPHA", "BETA"]);
    });

    test("normalizeStatusFilters routes through ticket-status when available and falls back to lowercased values", () => {
        expect(ticketQueries.normalizeStatusFilters(["OPEN", "triage", "open"])).toEqual([
            "open",
            "in_progress"
        ]);

        const result = ticketQueries.normalizeStatusFilters(
            ["unknown-status"],
            { not: "valid" }  // partial module → rejected, falls back to real module via require
        );
        expect(result).toEqual([]);

        // Without ticket-status entirely (simulated by stubbing its method).
        const realNormalize = ticketStatus.normalizeTicketStatus;
        ticketStatus.normalizeTicketStatus = undefined;
        try {
            const lower = ticketQueries.normalizeStatusFilters(["OPEN", "In_Progress"]);
            expect(lower).toEqual(["open", "in_progress"]);
        } finally {
            ticketStatus.normalizeTicketStatus = realNormalize;
        }
    });

    test("normalizeCategoryFilters routes through ticket-categories and dedupes", () => {
        expect(ticketQueries.normalizeCategoryFilters(["REFUND", "refund-request", "PAYMENT"])).toEqual([
            "refund",
            "payment"
        ]);

        const realNormalize = ticketCategories.normalizeTicketCategory;
        ticketCategories.normalizeTicketCategory = undefined;
        try {
            const lower = ticketQueries.normalizeCategoryFilters(["GENERAL", "Refund"]);
            expect(lower).toEqual(["general", "refund"]);
        } finally {
            ticketCategories.normalizeTicketCategory = realNormalize;
        }
    });

    test("normalizeReporterRoleFilters keeps only customer and vendor", () => {
        expect(ticketQueries.normalizeReporterRoleFilters(["customer", "vendor", "admin", "ghost"])).toEqual([
            "customer",
            "vendor"
        ]);
        expect(ticketQueries.normalizeReporterRoleFilters(["VENDOR", "vendor"])).toEqual(["vendor"]);
        expect(ticketQueries.normalizeReporterRoleFilters(null)).toEqual([]);
    });

    test("buildEqualityOrInConstraint picks == for one value, in for many, and null for empty", () => {
        const firestoreFns = makeFirestoreFns();

        expect(ticketQueries.buildEqualityOrInConstraint("status", ["open"], firestoreFns)).toEqual({
            kind: "where",
            field: "status",
            op: "==",
            value: "open"
        });

        expect(ticketQueries.buildEqualityOrInConstraint("status", ["open", "closed"], firestoreFns)).toEqual({
            kind: "where",
            field: "status",
            op: "in",
            value: ["open", "closed"]
        });

        expect(ticketQueries.buildEqualityOrInConstraint("status", [], firestoreFns)).toBeNull();
        expect(ticketQueries.buildEqualityOrInConstraint("status", null, firestoreFns)).toBeNull();
    });

    test("buildStatusConstraints / buildCategoryConstraints / buildReporterRoleConstraints wrap arrays of constraints", () => {
        const firestoreFns = makeFirestoreFns();

        expect(ticketQueries.buildStatusConstraints(["open"], firestoreFns)).toHaveLength(1);
        expect(ticketQueries.buildStatusConstraints([], firestoreFns)).toEqual([]);

        expect(ticketQueries.buildCategoryConstraints(["payment", "refund"], firestoreFns)).toHaveLength(1);
        expect(ticketQueries.buildCategoryConstraints([], firestoreFns)).toEqual([]);

        expect(ticketQueries.buildReporterRoleConstraints(["customer"], firestoreFns)).toHaveLength(1);
        expect(ticketQueries.buildReporterRoleConstraints(["ghost"], firestoreFns)).toEqual([]);
    });

    test("buildReporterTicketsQuery composes the right constraints with no status filter", () => {
        const firestoreFns = makeFirestoreFns();
        const query = ticketQueries.buildReporterTicketsQuery({
            db: { kind: "db" },
            firestoreFns,
            reporterUid: "user-1"
        });

        expect(query.collectionRef.path).toEqual(["supportTickets"]);
        const kinds = query.constraints.map((c) => c.kind);
        expect(kinds).toEqual(["where", "orderBy", "orderBy"]);
        expect(query.constraints[0]).toEqual({
            kind: "where",
            field: "reporterUid",
            op: "==",
            value: "user-1"
        });
    });

    test("buildReporterTicketsQuery adds status filter and limit when provided", () => {
        const firestoreFns = makeFirestoreFns();
        const query = ticketQueries.buildReporterTicketsQuery({
            db: { kind: "db" },
            firestoreFns,
            reporterUid: "user-1",
            statuses: ["open", "in_progress"],
            limitCount: 25
        });

        const kinds = query.constraints.map((c) => c.kind);
        expect(kinds).toEqual(["where", "where", "orderBy", "orderBy", "limit"]);

        const statusWhere = query.constraints[1];
        expect(statusWhere).toEqual({
            kind: "where",
            field: "status",
            op: "in",
            value: ["open", "in_progress"]
        });

        const limitConstraint = query.constraints[4];
        expect(limitConstraint).toEqual({ kind: "limit", count: 25 });
    });

    test("buildAdminTicketsQuery layers status, category, role, vendor, customer, and order filters", () => {
        const firestoreFns = makeFirestoreFns();
        const query = ticketQueries.buildAdminTicketsQuery({
            db: { kind: "db" },
            firestoreFns,
            statuses: ["open"],
            categories: ["refund", "payment"],
            reporterRoles: ["customer"],
            vendorUid: "vendor-1",
            customerUid: "customer-1",
            orderId: "order-9",
            limitCount: 50
        });

        const constraintsByField = query.constraints
            .filter((c) => c.kind === "where")
            .map((c) => c.field);

        expect(constraintsByField).toEqual([
            "status",
            "category",
            "reporterRole",
            "vendorUid",
            "customerUid",
            "orderId"
        ]);

        const limitConstraint = query.constraints.find((c) => c.kind === "limit");
        expect(limitConstraint).toEqual({ kind: "limit", count: 50 });
    });

    test("buildAdminTicketsQuery omits filters that are empty or invalid", () => {
        const firestoreFns = makeFirestoreFns();
        const query = ticketQueries.buildAdminTicketsQuery({
            db: { kind: "db" },
            firestoreFns,
            statuses: [],
            categories: [],
            reporterRoles: ["ghost"],
            vendorUid: "",
            customerUid: "  ",
            orderId: null
        });

        const wheres = query.constraints.filter((c) => c.kind === "where");
        expect(wheres).toHaveLength(0);

        const orderBys = query.constraints.filter((c) => c.kind === "orderBy");
        expect(orderBys).toHaveLength(2);
    });

    test("buildRepliesQuery defaults to chronological order and optionally excludes internal notes", () => {
        const firestoreFns = makeFirestoreFns();

        const defaultQuery = ticketQueries.buildRepliesQuery({
            db: { kind: "db" },
            firestoreFns,
            ticketId: "t-1"
        });
        expect(defaultQuery.collectionRef.path).toEqual(["supportTickets", "t-1", "replies"]);
        expect(defaultQuery.constraints.map((c) => c.kind)).toEqual(["orderBy"]);
        expect(defaultQuery.constraints[0]).toEqual({ kind: "orderBy", field: "createdAt", direction: "asc" });

        const filteredQuery = ticketQueries.buildRepliesQuery({
            db: { kind: "db" },
            firestoreFns,
            ticketId: "t-1",
            includeInternalNotes: false,
            limitCount: 20
        });
        expect(filteredQuery.constraints.map((c) => c.kind)).toEqual(["where", "orderBy", "limit"]);
        expect(filteredQuery.constraints[0]).toEqual({
            kind: "where",
            field: "isInternalNote",
            op: "==",
            value: false
        });
    });

    test("getSnapshotData and snapshotExists handle missing or invalid snapshots", () => {
        expect(ticketQueries.getSnapshotData(null)).toEqual({});
        expect(ticketQueries.getSnapshotData({})).toEqual({});
        expect(ticketQueries.getSnapshotData({ data: () => null })).toEqual({});
        expect(ticketQueries.getSnapshotData({ data: () => ({ x: 1 }) })).toEqual({ x: 1 });

        expect(ticketQueries.snapshotExists(null)).toBe(false);
        expect(ticketQueries.snapshotExists({})).toBe(true);
        expect(ticketQueries.snapshotExists({ exists: () => false })).toBe(false);
        expect(ticketQueries.snapshotExists({ exists: () => true })).toBe(true);
    });

    test("mapTicketDocument returns null for missing snapshots and normalises through the model otherwise", () => {
        expect(ticketQueries.mapTicketDocument(null)).toBeNull();
        expect(ticketQueries.mapTicketDocument(makeDocSnapshot("t-1", {}, { exists: false }))).toBeNull();

        const snapshot = makeDocSnapshot("t-1", {
            reporterUid: "c-1",
            reporterRole: "customer",
            subject: "Order issue",
            description: "missing items",
            category: "ORDER_ISSUE",
            status: "OPEN"
        });

        const ticket = ticketQueries.mapTicketDocument(snapshot);
        expect(ticket.ticketId).toBe("t-1");
        expect(ticket.status).toBe("open");
        expect(ticket.category).toBe("order_issue");
        expect(ticket.statusLabel).toBe("Open");
    });

    test("mapTicketDocument falls back to raw shape when no model is available", () => {
        const savedNormalize = ticketModel.normalizeTicketRecord;
        ticketModel.normalizeTicketRecord = undefined;

        try {
            const snapshot = makeDocSnapshot("t-raw", {
                reporterUid: "c-1",
                subject: "hi",
                status: "open"
            });

            const ticket = ticketQueries.mapTicketDocument(snapshot);
            expect(ticket).toEqual({
                ticketId: "t-raw",
                reporterUid: "c-1",
                subject: "hi",
                status: "open"
            });
        } finally {
            ticketModel.normalizeTicketRecord = savedNormalize;
        }
    });

    test("mapTicketDocuments drops missing snapshots and maps the rest", () => {
        const snapshots = {
            docs: [
                makeDocSnapshot("t-1", { subject: "a", status: "open", reporterUid: "u" }),
                makeDocSnapshot("t-2", {}, { exists: false }),
                makeDocSnapshot("t-3", { subject: "b", status: "closed", reporterUid: "u" })
            ]
        };

        const tickets = ticketQueries.mapTicketDocuments(snapshots);
        expect(tickets.map((t) => t.ticketId)).toEqual(["t-1", "t-3"]);

        expect(ticketQueries.mapTicketDocuments(null)).toEqual([]);
        expect(ticketQueries.mapTicketDocuments({})).toEqual([]);
    });

    test("mapReplyDocument uses the model when present and falls back otherwise", () => {
        expect(ticketQueries.mapReplyDocument(null)).toBeNull();

        const snapshot = makeDocSnapshot("r-1", {
            body: "hello",
            authorRole: "ADMIN",
            authorUid: "a-1"
        });

        const reply = ticketQueries.mapReplyDocument(snapshot, { ticketId: "t-1" });
        expect(reply.replyId).toBe("r-1");
        expect(reply.ticketId).toBe("t-1");
        expect(reply.authorRole).toBe("admin");
        expect(reply.body).toBe("hello");

        const savedCreateReply = ticketModel.createReplyRecord;
        ticketModel.createReplyRecord = undefined;
        try {
            const raw = ticketQueries.mapReplyDocument(snapshot, { ticketId: "t-1" });
            expect(raw).toEqual({
                replyId: "r-1",
                ticketId: "t-1",
                body: "hello",
                authorRole: "ADMIN",
                authorUid: "a-1"
            });
        } finally {
            ticketModel.createReplyRecord = savedCreateReply;
        }
    });

    test("mapReplyDocuments drops missing snapshots and maps the rest", () => {
        const snapshots = {
            docs: [
                makeDocSnapshot("r-1", { body: "hi", authorRole: "admin" }),
                makeDocSnapshot("r-2", {}, { exists: false }),
                makeDocSnapshot("r-3", { body: "yo", authorRole: "customer" })
            ]
        };

        const replies = ticketQueries.mapReplyDocuments(snapshots, { ticketId: "t-1" });
        expect(replies.map((r) => r.replyId)).toEqual(["r-1", "r-3"]);

        expect(ticketQueries.mapReplyDocuments(null)).toEqual([]);
    });

    test("fetchTicketById reads the doc and maps it via the model", async () => {
        const snapshot = makeDocSnapshot("t-1", {
            reporterUid: "c-1",
            reporterRole: "customer",
            subject: "Subj",
            description: "Desc",
            category: "general",
            status: "open"
        });

        const firestoreFns = makeFirestoreFns({
            getDoc: jest.fn(async () => snapshot)
        });

        const ticket = await ticketQueries.fetchTicketById({
            db: { kind: "db" },
            firestoreFns,
            ticketId: "t-1"
        });

        expect(firestoreFns.getDoc).toHaveBeenCalledTimes(1);
        expect(ticket.ticketId).toBe("t-1");
        expect(ticket.subject).toBe("Subj");
    });

    test("fetchTicketById returns null when the snapshot does not exist", async () => {
        const snapshot = makeDocSnapshot("missing", {}, { exists: false });
        const firestoreFns = makeFirestoreFns({
            getDoc: jest.fn(async () => snapshot)
        });

        const ticket = await ticketQueries.fetchTicketById({
            db: { kind: "db" },
            firestoreFns,
            ticketId: "missing"
        });

        expect(ticket).toBeNull();
    });

    test("fetchReporterTickets and fetchAdminTickets run getDocs against the right query", async () => {
        const reporterSnapshots = {
            docs: [
                makeDocSnapshot("t-1", { reporterUid: "u-1", status: "open", subject: "a", description: "d" }),
                makeDocSnapshot("t-2", { reporterUid: "u-1", status: "closed", subject: "b", description: "d" })
            ]
        };
        const adminSnapshots = {
            docs: [makeDocSnapshot("t-3", { status: "open", subject: "c", description: "d", reporterUid: "u-2" })]
        };

        const firestoreFns = makeFirestoreFns({
            getDocs: jest.fn(async (query) => (
                query.constraints[0].field === "reporterUid" ? reporterSnapshots : adminSnapshots
            ))
        });

        const reporter = await ticketQueries.fetchReporterTickets({
            db: { kind: "db" },
            firestoreFns,
            reporterUid: "u-1"
        });
        expect(reporter.map((t) => t.ticketId)).toEqual(["t-1", "t-2"]);

        const admin = await ticketQueries.fetchAdminTickets({
            db: { kind: "db" },
            firestoreFns,
            statuses: ["open"]
        });
        expect(admin.map((t) => t.ticketId)).toEqual(["t-3"]);
    });

    test("fetchTicketReplies runs getDocs against the right subcollection query", async () => {
        const snapshots = {
            docs: [
                makeDocSnapshot("r-1", { body: "hi", authorRole: "customer" }),
                makeDocSnapshot("r-2", { body: "hello", authorRole: "admin", isInternalNote: true })
            ]
        };

        const firestoreFns = makeFirestoreFns({
            getDocs: jest.fn(async () => snapshots)
        });

        const replies = await ticketQueries.fetchTicketReplies({
            db: { kind: "db" },
            firestoreFns,
            ticketId: "t-1"
        });

        expect(firestoreFns.getDocs).toHaveBeenCalledTimes(1);
        expect(replies.map((r) => r.replyId)).toEqual(["r-1", "r-2"]);
        expect(replies[1].isInternalNote).toBe(true);
    });

    test("ticket-service picks up ticket-queries via its resolver and routes through it", () => {
        const ticketService = require("../../../public/shared/support/ticket-service.js");
        expect(ticketService.resolveTicketQueries(ticketQueries)).toBe(ticketQueries);

        // The service's fallback ref helpers should also return the same path shape as the
        // queries module, so the two are wire-compatible.
        const firestoreFns = makeFirestoreFns();
        const queriesRef = ticketQueries.getTicketDocRef({ kind: "db" }, "t-1", firestoreFns);
        const serviceRef = ticketService.getTicketDocRef(
            { kind: "db" },
            "t-1",
            firestoreFns,
            ticketQueries
        );
        expect(serviceRef).toEqual(queriesRef);
    });
});
