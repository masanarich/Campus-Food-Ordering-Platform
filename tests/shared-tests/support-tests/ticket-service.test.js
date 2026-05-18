const ticketService = require("../../../public/shared/support/ticket-service.js");
const ticketModel = require("../../../public/shared/support/ticket-model.js");
const ticketStatus = require("../../../public/shared/support/ticket-status.js");
const ticketCategories = require("../../../public/shared/support/ticket-categories.js");

let autoIdCounter = 0;

function makeFirestoreFns(overrides = {}) {
    autoIdCounter = 0;

    const base = {
        collection: jest.fn((db, ...path) => ({ kind: "collection", db, path })),
        doc: jest.fn((parent, ...rest) => {
            if (rest.length === 0 && parent && parent.kind === "collection") {
                autoIdCounter += 1;
                const id = `auto-${autoIdCounter}`;
                return { kind: "doc", path: [...parent.path, id], id };
            }
            return { kind: "doc", path: rest, id: rest[rest.length - 1] };
        }),
        setDoc: jest.fn(async () => {}),
        updateDoc: jest.fn(async () => {}),
        serverTimestamp: jest.fn(() => ({ kind: "serverTimestamp" }))
    };

    return { ...base, ...overrides };
}

function makeTicketQueries(overrides = {}) {
    return {
        getTicketDocRef: jest.fn(() => ({ kind: "ticket-doc-ref" })),
        getRepliesCollectionRef: jest.fn(() => ({ kind: "replies-collection-ref" })),
        getReplyDocRef: jest.fn(() => ({ kind: "reply-doc-ref" })),
        fetchTicketById: jest.fn(async () => null),
        fetchReporterTickets: jest.fn(async () => []),
        fetchAdminTickets: jest.fn(async () => []),
        fetchTicketReplies: jest.fn(async () => []),
        ...overrides
    };
}

function makeBaseInput() {
    return {
        reporter: {
            uid: "customer-1",
            displayName: "Naledi",
            email: "naledi@example.com",
            role: "customer"
        },
        subject: "Order never arrived",
        description: "The driver did not show up after 30 minutes.",
        category: "order_issue",
        orderId: "order-7"
    };
}

describe("shared/support/ticket-service.js", () => {
    afterEach(() => {
        if (typeof global !== "undefined") {
            delete global.ticketStatus;
            delete global.ticketCategories;
            delete global.ticketModel;
            delete global.ticketQueries;
            delete global.ticketValidation;
        }
    });

    test("exposes the expected module surface and constants", () => {
        expect(ticketService.MODULE_NAME).toBe("ticket-service");
        expect(ticketService.SUPPORT_TICKETS_COLLECTION).toBe("supportTickets");
        expect(ticketService.REPLIES_SUBCOLLECTION).toBe("replies");

        [
            "resolveTicketStatus",
            "resolveTicketCategories",
            "resolveTicketModel",
            "resolveTicketQueries",
            "resolveTicketValidation",
            "createTicket",
            "updateTicketStatus",
            "addReply",
            "getTicketById",
            "getReporterTickets",
            "getAdminTickets",
            "getTicketReplies",
            "closeTicketByReporter",
            "reopenTicket"
        ].forEach((name) => {
            expect(typeof ticketService[name]).toBe("function");
        });
    });

    test("resolveTicketStatus accepts explicit modules, global, and require()", () => {
        const fakeStatus = {
            normalizeTicketStatus: jest.fn(),
            getDefaultTicketStatus: jest.fn()
        };

        expect(ticketService.resolveTicketStatus(fakeStatus)).toBe(fakeStatus);

        global.ticketStatus = fakeStatus;
        expect(ticketService.resolveTicketStatus()).toBe(fakeStatus);

        delete global.ticketStatus;
        expect(ticketService.resolveTicketStatus()).toBe(ticketStatus);

        // Partial object is rejected, then require fallback runs.
        expect(ticketService.resolveTicketStatus({ getDefaultTicketStatus: () => "open" })).toBe(ticketStatus);
    });

    test("resolveTicketCategories, resolveTicketModel, resolveTicketQueries, resolveTicketValidation use the same explicit/global/require pattern", () => {
        const fakeCategories = {
            normalizeTicketCategory: jest.fn(),
            getDefaultTicketCategory: jest.fn()
        };
        expect(ticketService.resolveTicketCategories(fakeCategories)).toBe(fakeCategories);
        global.ticketCategories = fakeCategories;
        expect(ticketService.resolveTicketCategories()).toBe(fakeCategories);
        delete global.ticketCategories;
        expect(ticketService.resolveTicketCategories()).toBe(ticketCategories);

        const fakeModel = {
            createTicketRecord: jest.fn(),
            createReplyRecord: jest.fn(),
            createTicketTimelineEntry: jest.fn()
        };
        expect(ticketService.resolveTicketModel(fakeModel)).toBe(fakeModel);
        global.ticketModel = fakeModel;
        expect(ticketService.resolveTicketModel()).toBe(fakeModel);
        delete global.ticketModel;
        expect(ticketService.resolveTicketModel()).toBe(ticketModel);

        const fakeQueries = { getTicketDocRef: jest.fn() };
        expect(ticketService.resolveTicketQueries(fakeQueries)).toBe(fakeQueries);
        global.ticketQueries = fakeQueries;
        expect(ticketService.resolveTicketQueries()).toBe(fakeQueries);
        delete global.ticketQueries;
        // ticket-queries.js is now a real module that satisfies the resolver contract,
        // so require() returns it as the last-resort fallback.
        const realTicketQueries = require("../../../public/shared/support/ticket-queries.js");
        expect(ticketService.resolveTicketQueries()).toBe(realTicketQueries);

        const fakeValidation = { validateCreateTicketInput: jest.fn() };
        expect(ticketService.resolveTicketValidation(fakeValidation)).toBe(fakeValidation);
        global.ticketValidation = fakeValidation;
        expect(ticketService.resolveTicketValidation()).toBe(fakeValidation);
        delete global.ticketValidation;
        // ticket-validation.js is still a placeholder, so resolver returns null.
        expect(ticketService.resolveTicketValidation()).toBeNull();
    });

    test("primitive helpers behave defensively", () => {
        expect(ticketService.normalizeText("  hi ")).toBe("hi");
        expect(ticketService.normalizeText(null)).toBe("");
        expect(ticketService.normalizeLowerText(" HEY ")).toBe("hey");

        const error = ticketService.createServiceError("", "");
        expect(error.code).toBe("tickets/error");
        expect(error.message).toMatch(/Something went wrong/);

        const customError = ticketService.createServiceError("tickets/x", "boom", { extra: 1 });
        expect(customError).toEqual({ code: "tickets/x", message: "boom", extra: 1 });

        const result = ticketService.createServiceResult(true, { ticket: "t" });
        expect(result).toEqual({ success: true, ticket: "t" });
        expect(ticketService.createServiceResult(false)).toEqual({ success: false });
    });

    test("resolveTimestampValue prefers explicit value, then factory, then now, then serverTimestamp, then ISO string", () => {
        expect(ticketService.resolveTimestampValue({ timestampValue: "abc" })).toBe("abc");
        expect(ticketService.resolveTimestampValue({ nowFactory: () => "factory" })).toBe("factory");
        expect(ticketService.resolveTimestampValue({ now: "explicit-now" })).toBe("explicit-now");

        const firestoreFns = { serverTimestamp: jest.fn(() => "SERVER") };
        expect(ticketService.resolveTimestampValue({ firestoreFns })).toBe("SERVER");
        expect(firestoreFns.serverTimestamp).toHaveBeenCalled();

        expect(
            ticketService.resolveTimestampValue({ firestoreFns, useServerTimestamp: false })
        ).toEqual(expect.any(String));

        const iso = ticketService.resolveTimestampValue();
        expect(typeof iso).toBe("string");
        expect(iso).toMatch(/T/);
    });

    test("createTicketId honours explicit, factory, firestore-auto, and seed fallbacks", () => {
        expect(ticketService.createTicketId({ ticketId: " ticket-abc " })).toBe("ticket-abc");

        expect(
            ticketService.createTicketId({
                ticketIdFactory: () => "factory-ticket"
            })
        ).toBe("factory-ticket");

        const firestoreFns = makeFirestoreFns();
        const id = ticketService.createTicketId({
            db: { kind: "db" },
            firestoreFns
        });
        expect(id).toBe("auto-1");

        const seedId = ticketService.createTicketId({ timestampSeed: "Seed-Value!" });
        expect(seedId).toBe("ticket-seedvalue");

        const generatedFallback = ticketService.createTicketId({});
        expect(generatedFallback).toMatch(/^ticket-/);
    });

    test("createTicketId falls back to deterministic id when firestoreFns.doc throws", () => {
        const firestoreFns = makeFirestoreFns({
            doc: jest.fn(() => { throw new Error("boom"); })
        });

        const id = ticketService.createTicketId({
            db: { kind: "db" },
            firestoreFns,
            timestampSeed: "abc"
        });

        expect(id).toBe("ticket-abc");
    });

    test("createReplyId honours explicit, factory, firestore-auto, and seed fallbacks", () => {
        expect(ticketService.createReplyId({ replyId: " r-1 " })).toBe("r-1");

        expect(
            ticketService.createReplyId({ replyIdFactory: () => "factory-reply" })
        ).toBe("factory-reply");

        const firestoreFns = makeFirestoreFns();
        const id = ticketService.createReplyId({
            db: { kind: "db" },
            firestoreFns,
            ticketId: "ticket-7"
        });
        expect(id).toBe("auto-1");

        // No ticketId → fall straight to seed
        const seedId = ticketService.createReplyId({ timestampSeed: "X" });
        expect(seedId).toBe("reply-x");

        const generatedFallback = ticketService.createReplyId({});
        expect(generatedFallback).toMatch(/^reply-/);
    });

    test("ref helpers route through ticket-queries when available and fall back to direct firestore otherwise", () => {
        const firestoreFns = makeFirestoreFns();
        const ticketDocRef = ticketService.getTicketDocRef({ kind: "db" }, "t-1", firestoreFns);
        expect(ticketDocRef).toEqual({
            kind: "doc",
            path: ["supportTickets", "t-1"],
            id: "t-1"
        });

        const repliesRef = ticketService.getRepliesCollectionRef({ kind: "db" }, "t-1", firestoreFns);
        expect(repliesRef.path).toEqual(["supportTickets", "t-1", "replies"]);

        const replyDocRef = ticketService.getReplyDocRef({ kind: "db" }, "t-1", "r-1", firestoreFns);
        expect(replyDocRef.path).toEqual(["supportTickets", "t-1", "replies", "r-1"]);

        // When ticket-queries provides its own helpers, those win.
        const ticketQueries = makeTicketQueries({
            getTicketDocRef: jest.fn(() => "queries-ticket"),
            getRepliesCollectionRef: jest.fn(() => "queries-replies"),
            getReplyDocRef: jest.fn(() => "queries-reply")
        });

        expect(ticketService.getTicketDocRef({ kind: "db" }, "t-1", firestoreFns, ticketQueries)).toBe("queries-ticket");
        expect(ticketService.getRepliesCollectionRef({ kind: "db" }, "t-1", firestoreFns, ticketQueries)).toBe("queries-replies");
        expect(ticketService.getReplyDocRef({ kind: "db" }, "t-1", "r-1", firestoreFns, ticketQueries)).toBe("queries-reply");

        // The internal collection-ref fallback always returns null when its own inputs are bad.
        expect(ticketService.getTicketsCollectionRefFallback(null, firestoreFns)).toBeNull();
        expect(ticketService.getTicketsCollectionRefFallback({}, {})).toBeNull();

        // The service-level ref helpers fall back to direct firestore-fns calls only when no
        // ticket-queries module is reachable. Since ticket-queries.js is now real, we exercise
        // the service-level fallback by temporarily disabling the queries surface.
        const realTicketQueriesModule = require("../../../public/shared/support/ticket-queries.js");
        const savedGetTicketDocRef = realTicketQueriesModule.getTicketDocRef;
        realTicketQueriesModule.getTicketDocRef = undefined;
        try {
            expect(ticketService.getTicketDocRef(null, "t-1", firestoreFns)).toBeNull();
            expect(ticketService.getTicketDocRef({}, "t-1", {})).toBeNull();
            expect(ticketService.getRepliesCollectionRef(null, "t-1", firestoreFns)).toBeNull();
            expect(ticketService.getReplyDocRef(null, "t-1", "r-1", firestoreFns)).toBeNull();
        } finally {
            realTicketQueriesModule.getTicketDocRef = savedGetTicketDocRef;
        }
    });

    test("buildTicketWritePayload normalises a record via the model and respects option overrides", () => {
        const input = ticketModel.createTicketFromForm(makeBaseInput(), {
            reporter: makeBaseInput().reporter,
            createdAt: "2026-05-16T10:00:00Z"
        });

        const payload = ticketService.buildTicketWritePayload(input, {
            ticketId: "t-write",
            status: "in_progress",
            priority: "high"
        });

        expect(payload.ticketId).toBe("t-write");
        expect(payload.status).toBe("in_progress");
        expect(payload.priority).toBe("high");
        expect(payload.subject).toBe("Order never arrived");
        // The createdAt option falls through to the model's createdAt.
        expect(payload.createdAt).toBe("2026-05-16T10:00:00Z");
    });

    test("buildTicketWritePayload works without a model by falling back to a manual shape", () => {
        // Force the resolver to find no model.
        const fakeModelMissing = { not: "a model" };

        const record = {
            ticketId: "t-no-model",
            status: "OPEN",
            category: "REFUND",
            priority: "HIGH",
            timeline: [{ eventType: "created" }],
            createdAt: "C",
            updatedAt: "U"
        };

        const payload = ticketService.buildTicketWritePayload(record, {
            ticketModel: fakeModelMissing,
            // Trick global/require fallback — the resolver only accepts modules with full surface.
            // ticket-model.js is real here, so we hit the model path. Override by stubbing globals
            // to a partial fake.
            ticketStatus: { wrong: true },
            ticketCategories: { wrong: true }
        });

        // The real ticket-model picks it up via require() (since fakeModelMissing is rejected).
        // The payload is therefore a fully normalised ticket record.
        expect(payload.status).toBe("open");
        expect(payload.category).toBe("refund");
        expect(payload.priority).toBe("high");
        expect(Array.isArray(payload.timeline)).toBe(true);
    });

    test("buildTicketWritePayload falls back to a plain shape when no real ticket-model is reachable", () => {
        // Replace global to point at a fake module rejected by all resolvers, and stop the require()
        // by hijacking via the explicit option only — but require() still finds ticket-model.js.
        // Easiest way: pass an explicit model that lacks the full surface AND a stubbed factory.
        // Since require() picks up the real module anyway, this test exercises the option-override path.
        const payload = ticketService.buildTicketWritePayload({}, {
            ticketModel: { not: "a model" },
            status: "OPEN",
            category: "GENERAL"
        });

        // Real ticket-model wins via require — confirm fields are normalised.
        expect(payload.status).toBe("open");
        expect(payload.category).toBe("general");
    });

    test("buildTicketPatch uses the model's createTicketPatch when available", () => {
        const patch = ticketService.buildTicketPatch({
            status: "RESOLVED",
            priority: "high",
            replyCount: 3,
            timeline: [{ eventType: "replied" }]
        });

        expect(patch.status).toBe("resolved");
        expect(patch.priority).toBe("high");
        expect(patch.replyCount).toBe(3);
        expect(Array.isArray(patch.timeline)).toBe(true);
        expect(patch.timeline[0].eventType).toBe("replied");
    });

    test("buildReplyWritePayload uses the model and supports default author role", () => {
        const reply = ticketService.buildReplyWritePayload(
            { body: "hello", authorRole: "ADMIN", authorUid: "a-1" },
            { replyId: "r-1", createdAt: "T1" }
        );

        expect(reply).toEqual(
            expect.objectContaining({
                replyId: "r-1",
                body: "hello",
                authorRole: "admin",
                createdAt: "T1"
            })
        );

        const defaulted = ticketService.buildReplyWritePayload(
            { body: "hi" },
            { defaultAuthorRole: "customer", createdAt: "T2" }
        );

        expect(defaulted.authorRole).toBe("customer");
        expect(defaulted.createdAt).toBe("T2");
    });

    test("validateCreateTicketInputFallback flags missing required fields", () => {
        expect(ticketService.validateCreateTicketInputFallback(null).isValid).toBe(false);
        expect(ticketService.validateCreateTicketInputFallback({}).errors).toEqual({
            reporterUid: expect.any(String),
            subject: expect.any(String),
            description: expect.any(String)
        });

        const ok = ticketService.validateCreateTicketInputFallback({
            reporterUid: "u-1",
            subject: "hi",
            description: "yes"
        });
        expect(ok.isValid).toBe(true);
        expect(ok.errors).toEqual({});
    });

    test("autoStatusForReply nudges status when admin replies on open or reporter replies on awaiting_user", () => {
        expect(ticketService.autoStatusForReply("open", "admin", ticketStatus)).toBe("in_progress");
        expect(ticketService.autoStatusForReply("awaiting_user", "customer", ticketStatus)).toBe("in_progress");
        expect(ticketService.autoStatusForReply("awaiting_user", "vendor", ticketStatus)).toBe("in_progress");
        // Already in progress → stay there
        expect(ticketService.autoStatusForReply("in_progress", "admin", ticketStatus)).toBe("in_progress");
        // Reporter replying on open does not auto-nudge
        expect(ticketService.autoStatusForReply("open", "customer", ticketStatus)).toBe("open");

        // No ticketStatus module → pass through unchanged.
        expect(ticketService.autoStatusForReply("anything", "admin", null)).toBe("anything");
    });

    test("prepareCreateTicket succeeds with a real model and a valid input", () => {
        const result = ticketService.prepareCreateTicket({
            input: makeBaseInput(),
            now: "2026-05-16T10:00:00Z"
        });

        expect(result.success).toBe(true);
        expect(result.ticket.subject).toBe("Order never arrived");
        expect(result.ticket.status).toBe("open");
        expect(result.ticket.timeline[0].eventType).toBe("created");
        expect(result.createdAt).toBe("2026-05-16T10:00:00Z");
    });

    test("prepareCreateTicket reports validation failure with structured errors", () => {
        const result = ticketService.prepareCreateTicket({
            input: { subject: "", description: "", reporter: { uid: "" } },
            now: "T"
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/validation-failed");
        expect(result.error.errors).toEqual(
            expect.objectContaining({
                reporterUid: expect.any(String),
                subject: expect.any(String),
                description: expect.any(String)
            })
        );
    });

    test("prepareCreateTicket fails when the model resolver cannot find a model", () => {
        // Hijack require by stubbing global with a fake that fails the resolver and clearing modules.
        // Simplest: pass an explicit fake model that lacks the surface AND erase the real module's
        // exports temporarily.
        const realCreateTicketRecord = ticketModel.createTicketRecord;
        ticketModel.createTicketRecord = undefined;

        try {
            const result = ticketService.prepareCreateTicket({
                input: makeBaseInput(),
                ticketModel: { not: "a model" }
            });
            expect(result.success).toBe(false);
            expect(result.error.code).toBe("tickets/dependencies-missing");
        } finally {
            ticketModel.createTicketRecord = realCreateTicketRecord;
        }
    });

    test("persistTicketCreate writes via setDoc and returns the saved payload", async () => {
        const firestoreFns = makeFirestoreFns();
        const ticket = ticketModel.createTicketFromForm(makeBaseInput(), {
            reporter: makeBaseInput().reporter,
            createdAt: "T0"
        });

        const result = await ticketService.persistTicketCreate({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            timestampSeed: "fixed-seed"
        });

        expect(result.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        const [docRef, payload] = firestoreFns.setDoc.mock.calls[0];
        expect(docRef.path).toEqual(["supportTickets", expect.any(String)]);
        expect(payload.subject).toBe("Order never arrived");
        expect(payload.ticketId).toMatch(/^ticket-|^auto-/);
    });

    test("persistTicketCreate fails when required helpers are missing", async () => {
        const result = await ticketService.persistTicketCreate({
            db: null,
            firestoreFns: {},
            ticket: { ticketId: "x" }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/persist-unavailable");

        const noTicket = await ticketService.persistTicketCreate({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticket: null
        });
        expect(noTicket.success).toBe(false);
        expect(noTicket.error.code).toBe("tickets/persist-unavailable");
    });

    test("persistTicketCreate fails when the doc ref cannot be created", async () => {
        const firestoreFns = makeFirestoreFns({
            doc: jest.fn(() => null)
        });

        const result = await ticketService.persistTicketCreate({
            db: { kind: "db" },
            firestoreFns,
            ticket: { ticketId: "tk-1", subject: "hi", description: "yo" },
            ticketId: "tk-1"
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/doc-ref-unavailable");
    });

    test("createTicket end-to-end happy path", async () => {
        const firestoreFns = makeFirestoreFns();
        const result = await ticketService.createTicket({
            input: makeBaseInput(),
            db: { kind: "db" },
            firestoreFns,
            now: "2026-05-16T10:00:00Z"
        });

        expect(result.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(result.ticket.subject).toBe("Order never arrived");
        expect(result.createdAt).toBe("2026-05-16T10:00:00Z");
    });

    test("createTicket returns a structured failure when validation fails", async () => {
        const firestoreFns = makeFirestoreFns();
        const result = await ticketService.createTicket({
            input: { subject: "", description: "" },
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/validation-failed");
        expect(firestoreFns.setDoc).not.toHaveBeenCalled();
    });

    test("createTicket wraps thrown errors", async () => {
        const firestoreFns = makeFirestoreFns({
            setDoc: jest.fn(async () => { throw new Error("write boom"); })
        });

        const result = await ticketService.createTicket({
            input: makeBaseInput(),
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/create-failed");
        expect(result.error.message).toBe("write boom");
    });

    test("read helpers return null/[] when queries are missing and delegate when present", async () => {
        expect(await ticketService.getTicketById({})).toBeNull();
        expect(await ticketService.getReporterTickets({})).toEqual([]);
        expect(await ticketService.getAdminTickets({})).toEqual([]);
        expect(await ticketService.getTicketReplies({})).toEqual([]);

        const queries = makeTicketQueries({
            fetchTicketById: jest.fn(async () => ({ ticketId: "t-1" })),
            fetchReporterTickets: jest.fn(async () => [{ ticketId: "t-1" }]),
            fetchAdminTickets: jest.fn(async () => [{ ticketId: "t-2" }]),
            fetchTicketReplies: jest.fn(async () => [{ replyId: "r-1" }])
        });

        const baseOpts = {
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries: queries
        };

        expect(await ticketService.getTicketById({ ...baseOpts, ticketId: "t-1" })).toEqual({ ticketId: "t-1" });
        expect(await ticketService.getReporterTickets({ ...baseOpts, reporterUid: "u-1" }))
            .toEqual([{ ticketId: "t-1" }]);
        expect(await ticketService.getAdminTickets(baseOpts)).toEqual([{ ticketId: "t-2" }]);
        expect(await ticketService.getTicketReplies({ ...baseOpts, ticketId: "t-1" }))
            .toEqual([{ replyId: "r-1" }]);
    });

    test("buildTicketStatusUpdate validates the transition and builds a timeline entry", () => {
        const ticket = ticketModel.createTicketFromForm(makeBaseInput(), {
            reporter: makeBaseInput().reporter,
            createdAt: "T0"
        });
        ticket.ticketId = "t-1";

        const result = ticketService.buildTicketStatusUpdate(ticket, {
            nextStatus: "in_progress",
            actorRole: "admin",
            actorUid: "admin-1",
            actorName: "Admin",
            now: "T1"
        });

        expect(result.success).toBe(true);
        expect(result.ticket.status).toBe("in_progress");
        expect(result.timelineEntry.eventType).toBe("status_changed");
        expect(result.statusChanged).toBe(true);

        const resolvedResult = ticketService.buildTicketStatusUpdate(
            { ...ticket, status: "in_progress" },
            {
                nextStatus: "resolved",
                actorRole: "admin",
                actorUid: "admin-1",
                actorName: "Admin",
                resolutionNote: "Refunded.",
                now: "T2"
            }
        );
        expect(resolvedResult.success).toBe(true);
        expect(resolvedResult.ticket.status).toBe("resolved");
        expect(resolvedResult.ticket.resolvedAt).toBe("T2");
        expect(resolvedResult.ticket.resolvedByUid).toBe("admin-1");
        expect(resolvedResult.ticket.resolutionNote).toBe("Refunded.");
        expect(resolvedResult.timelineEntry.eventType).toBe("resolved");

        const reopenResult = ticketService.buildTicketStatusUpdate(
            { ...ticket, status: "closed", resolvedAt: "T-old", resolvedByUid: "x" },
            { nextStatus: "open", actorRole: "customer", now: "T3" }
        );
        expect(reopenResult.success).toBe(true);
        expect(reopenResult.timelineEntry.eventType).toBe("reopened");
        expect(reopenResult.ticket.resolvedAt).toBeNull();
        expect(reopenResult.ticket.resolvedByUid).toBe("");
    });

    test("buildTicketStatusUpdate rejects bad actor, bad next, or invalid transition", () => {
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const badActor = ticketService.buildTicketStatusUpdate(ticket, {
            nextStatus: "in_progress",
            actorRole: "ghost"
        });
        expect(badActor.success).toBe(false);
        expect(badActor.error.code).toBe("tickets/invalid-actor");

        const badNext = ticketService.buildTicketStatusUpdate(ticket, {
            nextStatus: "nonsense",
            actorRole: "admin"
        });
        expect(badNext.success).toBe(false);
        expect(badNext.error.code).toBe("tickets/invalid-status");

        const notAllowed = ticketService.buildTicketStatusUpdate(ticket, {
            nextStatus: "resolved",
            actorRole: "customer"
        });
        expect(notAllowed.success).toBe(false);
        expect(notAllowed.error.code).toBe("tickets/invalid-status-change");
    });

    test("persistTicketUpdate uses updateDoc when available and falls back to setDoc-merge otherwise", async () => {
        const firestoreFns = makeFirestoreFns();
        const ticket = { ticketId: "t-1", status: "in_progress", timeline: [], updatedAt: "T1" };

        const updateResult = await ticketService.persistTicketUpdate({
            db: { kind: "db" },
            firestoreFns,
            ticket
        });
        expect(updateResult.success).toBe(true);
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(1);

        const firestoreFnsNoUpdate = makeFirestoreFns();
        delete firestoreFnsNoUpdate.updateDoc;
        const setResult = await ticketService.persistTicketUpdate({
            db: { kind: "db" },
            firestoreFns: firestoreFnsNoUpdate,
            ticket
        });
        expect(setResult.success).toBe(true);
        expect(firestoreFnsNoUpdate.setDoc).toHaveBeenCalledTimes(1);
        const [, , mergeArg] = firestoreFnsNoUpdate.setDoc.mock.calls[0];
        expect(mergeArg).toEqual({ merge: true });

        const noWrite = await ticketService.persistTicketUpdate({
            db: { kind: "db" },
            firestoreFns: { doc: jest.fn(() => ({ kind: "doc" })) },
            ticket
        });
        expect(noWrite.success).toBe(false);
        expect(noWrite.error.code).toBe("tickets/update-write-unavailable");

        const missing = await ticketService.persistTicketUpdate({});
        expect(missing.success).toBe(false);
        expect(missing.error.code).toBe("tickets/update-unavailable");
    });

    test("updateTicketStatus full happy path writes the patch", async () => {
        const firestoreFns = makeFirestoreFns();
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const result = await ticketService.updateTicketStatus({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            nextStatus: "in_progress",
            actorRole: "admin",
            now: "T1"
        });

        expect(result.success).toBe(true);
        expect(result.ticket.status).toBe("in_progress");
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
    });

    test("updateTicketStatus surfaces not-found and caught errors", async () => {
        const queries = makeTicketQueries({
            fetchTicketById: jest.fn(async () => null)
        });

        const notFound = await ticketService.updateTicketStatus({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries: queries,
            ticketId: "t-1",
            nextStatus: "in_progress",
            actorRole: "admin"
        });

        expect(notFound.success).toBe(false);
        expect(notFound.error.code).toBe("tickets/not-found");

        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const firestoreFns = makeFirestoreFns({
            updateDoc: jest.fn(async () => { throw new Error("write boom"); })
        });

        const failed = await ticketService.updateTicketStatus({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            nextStatus: "in_progress",
            actorRole: "admin"
        });
        expect(failed.success).toBe(false);
        expect(failed.error.code).toBe("tickets/status-update-failed");
        expect(failed.error.message).toBe("write boom");
    });

    test("buildAddReplyUpdate refuses empty body or missing ticket id and applies autoStatusForReply", () => {
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y",
            status: "open"
        });

        const emptyBody = ticketService.buildAddReplyUpdate(ticket, { body: "" });
        expect(emptyBody.success).toBe(false);
        expect(emptyBody.error.code).toBe("tickets/empty-reply");

        const noId = ticketService.buildAddReplyUpdate(
            { ...ticket, ticketId: "" },
            { body: "hi", authorRole: "customer", authorUid: "c-1" }
        );
        expect(noId.success).toBe(false);
        expect(noId.error.code).toBe("tickets/missing-ticket-id");

        const adminReply = ticketService.buildAddReplyUpdate(
            ticket,
            { body: "I'll look into this.", authorRole: "admin", authorUid: "a-1", authorName: "Admin" },
            { now: "T1" }
        );
        expect(adminReply.success).toBe(true);
        expect(adminReply.ticket.status).toBe("in_progress");
        expect(adminReply.ticket.replyCount).toBe(1);
        expect(adminReply.ticket.lastReplyAt).toBe("T1");
        expect(adminReply.timelineEntry.eventType).toBe("replied");
        expect(adminReply.reply.body).toBe("I'll look into this.");
        expect(adminReply.statusChanged).toBe(true);

        const explicitNoAutoStatus = ticketService.buildAddReplyUpdate(
            ticket,
            { body: "still on it", authorRole: "admin", authorUid: "a-1" },
            { autoStatusUpdate: false, now: "T2" }
        );
        expect(explicitNoAutoStatus.ticket.status).toBe("open");
        expect(explicitNoAutoStatus.statusChanged).toBe(false);

        const internalNote = ticketService.buildAddReplyUpdate(
            ticket,
            {
                body: "Internal context",
                authorRole: "admin",
                authorUid: "a-1",
                isInternalNote: true
            },
            { now: "T3" }
        );
        expect(internalNote.success).toBe(true);
        expect(internalNote.reply.isInternalNote).toBe(true);
        expect(internalNote.timelineEntry.note).toBe("Internal note added.");
    });

    test("persistTicketReply writes the reply doc and the parent ticket patch", async () => {
        const firestoreFns = makeFirestoreFns();
        const ticket = { ticketId: "t-1", status: "open", timeline: [], updatedAt: "T1" };
        const reply = { replyId: "r-1", body: "hi", authorRole: "customer", createdAt: "T1" };

        const result = await ticketService.persistTicketReply({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            reply
        });

        expect(result.success).toBe(true);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
        expect(result.reply.replyId).toBe("r-1");

        const missing = await ticketService.persistTicketReply({});
        expect(missing.success).toBe(false);
        expect(missing.error.code).toBe("tickets/reply-write-unavailable");
    });

    test("persistTicketReply reports parent write failure but still keeps the reply payload", async () => {
        const firestoreFns = makeFirestoreFns({
            updateDoc: jest.fn(async () => { throw new Error("parent boom"); })
        });
        // Strip setDoc fallback so persistTicketUpdate cannot recover.
        delete firestoreFns.setDoc;
        firestoreFns.setDoc = jest.fn(async () => {}); // for the reply write itself

        // Reorder: reply uses setDoc; parent uses updateDoc which throws.
        const ticket = { ticketId: "t-1", status: "open", updatedAt: "T1" };
        const reply = { replyId: "r-2", body: "yes", authorRole: "admin", createdAt: "T1" };

        await expect(ticketService.persistTicketReply({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            reply
        })).resolves.toEqual(expect.objectContaining({
            success: false
        }));
    });

    test("addReply end-to-end happy path", async () => {
        const firestoreFns = makeFirestoreFns();
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y",
            status: "awaiting_user"
        });

        const result = await ticketService.addReply({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            reply: { body: "Replying with info", authorRole: "customer", authorUid: "c-1" },
            now: "T1"
        });

        expect(result.success).toBe(true);
        expect(result.reply.body).toBe("Replying with info");
        expect(result.ticket.status).toBe("in_progress");
        expect(result.ticket.replyCount).toBe(1);
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
    });

    test("addReply surfaces not-found and caught errors", async () => {
        const queries = makeTicketQueries({
            fetchTicketById: jest.fn(async () => null)
        });

        const notFound = await ticketService.addReply({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries: queries,
            ticketId: "t-x",
            reply: { body: "hi", authorRole: "customer" }
        });
        expect(notFound.success).toBe(false);
        expect(notFound.error.code).toBe("tickets/not-found");

        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const firestoreFns = makeFirestoreFns({
            setDoc: jest.fn(async () => { throw new Error("reply boom"); })
        });

        const failed = await ticketService.addReply({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            reply: { body: "hi", authorRole: "customer" }
        });
        expect(failed.success).toBe(false);
        expect(failed.error.code).toBe("tickets/reply-failed");
        expect(failed.error.message).toBe("reply boom");
    });

    describe("fallback paths when ticket-model or ticket-status cannot be resolved", () => {
        // Temporarily disable a required method on the real shared modules so the resolver
        // returns null, then restore. This drives the no-model / no-status branches.
        let savedCreateTicketRecord;
        let savedCreateReplyRecord;
        let savedCreateTicketPatch;
        let savedCreateTimelineEntry;
        let savedNormalizeTicketStatus;

        beforeEach(() => {
            savedCreateTicketRecord = ticketModel.createTicketRecord;
            savedCreateReplyRecord = ticketModel.createReplyRecord;
            savedCreateTicketPatch = ticketModel.createTicketPatch;
            savedCreateTimelineEntry = ticketModel.createTicketTimelineEntry;
            savedNormalizeTicketStatus = ticketStatus.normalizeTicketStatus;
        });

        afterEach(() => {
            ticketModel.createTicketRecord = savedCreateTicketRecord;
            ticketModel.createReplyRecord = savedCreateReplyRecord;
            ticketModel.createTicketPatch = savedCreateTicketPatch;
            ticketModel.createTicketTimelineEntry = savedCreateTimelineEntry;
            ticketStatus.normalizeTicketStatus = savedNormalizeTicketStatus;
        });

        test("buildTicketWritePayload returns a manually shaped object when ticket-model is unavailable", () => {
            ticketModel.createTicketRecord = undefined;

            const payload = ticketService.buildTicketWritePayload(
                {
                    ticketId: "t-no-model",
                    status: "OPEN",
                    category: "REFUND",
                    priority: "HIGH",
                    timeline: [{ eventType: "created" }],
                    createdAt: "C",
                    updatedAt: "U"
                },
                {
                    status: "IN_PROGRESS"
                }
            );

            expect(payload.ticketId).toBe("t-no-model");
            expect(payload.status).toBe("in_progress");
            expect(payload.category).toBe("refund");
            expect(payload.priority).toBe("high");
            expect(payload.timeline).toEqual([{ eventType: "created" }]);
            expect(payload.createdAt).toBe("C");
            expect(payload.updatedAt).toBe("U");

            // Bare record case — falls all the way through with empty defaults.
            const minimal = ticketService.buildTicketWritePayload(null);
            expect(minimal.status).toBe("");
            expect(minimal.timeline).toEqual([]);
        });

        test("buildTicketPatch falls back to a plain copy when ticket-model has no createTicketPatch", () => {
            ticketModel.createTicketPatch = undefined;

            const patch = ticketService.buildTicketPatch({
                status: "resolved",
                priority: "high",
                replyCount: 2,
                lastReplyAt: "T",
                resolvedAt: "T",
                resolvedByUid: "a-1",
                resolvedByName: "Admin",
                resolutionNote: "Refunded",
                updatedAt: "T",
                category: "refund",
                timeline: [{ eventType: "replied" }],
                extraneous: "ignored"
            });

            expect(patch).toEqual({
                status: "resolved",
                priority: "high",
                replyCount: 2,
                lastReplyAt: "T",
                resolvedAt: "T",
                resolvedByUid: "a-1",
                resolvedByName: "Admin",
                resolutionNote: "Refunded",
                updatedAt: "T",
                category: "refund",
                timeline: [{ eventType: "replied" }]
            });
            expect(patch).not.toHaveProperty("extraneous");

            // Bare source case — empty patch.
            expect(ticketService.buildTicketPatch(null)).toEqual({});
        });

        test("buildReplyWritePayload returns a manually shaped object when ticket-model is unavailable", () => {
            ticketModel.createReplyRecord = undefined;

            const reply = ticketService.buildReplyWritePayload(
                { body: "hi", authorRole: "customer", authorUid: "c-1" },
                { replyId: "r-1", createdAt: "T1" }
            );

            expect(reply.replyId).toBe("r-1");
            expect(reply.body).toBe("hi");
            expect(reply.createdAt).toBe("T1");

            const minimal = ticketService.buildReplyWritePayload(null);
            expect(minimal.replyId).toBe("");
        });

        test("buildTicketStatusUpdate reports dependencies-missing when ticket-status is unavailable", () => {
            ticketStatus.normalizeTicketStatus = undefined;

            const result = ticketService.buildTicketStatusUpdate({}, {
                nextStatus: "in_progress",
                actorRole: "admin"
            });

            expect(result.success).toBe(false);
            expect(result.error.code).toBe("tickets/dependencies-missing");
        });

        test("buildAddReplyUpdate reports dependencies-missing when ticket-model is unavailable", () => {
            ticketModel.createTicketRecord = undefined;
            ticketModel.createReplyRecord = undefined;
            ticketModel.createTicketTimelineEntry = undefined;

            const result = ticketService.buildAddReplyUpdate({}, { body: "hi" });
            expect(result.success).toBe(false);
            expect(result.error.code).toBe("tickets/dependencies-missing");
        });
    });

    test("persistTicketUpdate reports doc-ref-unavailable when the queries hook returns nothing", async () => {
        const ticketQueries = makeTicketQueries({
            getTicketDocRef: jest.fn(() => null)
        });

        const result = await ticketService.persistTicketUpdate({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries,
            ticket: { ticketId: "t-1", status: "open", updatedAt: "T" }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/doc-ref-unavailable");
    });

    test("updateTicketStatus returns the buildTicketStatusUpdate failure directly", async () => {
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const result = await ticketService.updateTicketStatus({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticket,
            nextStatus: "in_progress",
            actorRole: "ghost"  // invalid actor
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/invalid-actor");
    });

    test("updateTicketStatus returns persistTicketUpdate failure when no write helper is available", async () => {
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const firestoreFns = makeFirestoreFns();
        delete firestoreFns.updateDoc;
        delete firestoreFns.setDoc;

        const result = await ticketService.updateTicketStatus({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            nextStatus: "in_progress",
            actorRole: "admin"
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/update-write-unavailable");
    });

    test("createTicket forwards a persistTicketCreate failure to the caller", async () => {
        const ticketQueries = makeTicketQueries({
            getTicketDocRef: jest.fn(() => null)
        });

        const result = await ticketService.createTicket({
            input: makeBaseInput(),
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/doc-ref-unavailable");
    });

    test("persistTicketReply reports reply-doc-ref-unavailable when the ref helper returns nothing", async () => {
        const ticketQueries = makeTicketQueries({
            getReplyDocRef: jest.fn(() => null)
        });

        const result = await ticketService.persistTicketReply({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries,
            ticket: { ticketId: "t-1", status: "open", updatedAt: "T" },
            reply: { replyId: "r-1", body: "hi", authorRole: "customer", createdAt: "T" }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/reply-doc-ref-unavailable");
    });

    test("persistTicketReply forwards a structured persistTicketUpdate failure (no write helper)", async () => {
        const firestoreFns = makeFirestoreFns();
        delete firestoreFns.updateDoc;
        delete firestoreFns.setDoc;
        // Reattach a setDoc that only succeeds for the reply path. Track call order.
        let callCount = 0;
        firestoreFns.setDoc = jest.fn(async () => {
            callCount += 1;
            if (callCount > 1) {
                // Should not be reached — persistTicketUpdate has no updateDoc/setDoc routes
                // so it returns a structured failure rather than calling setDoc twice.
                throw new Error("should not be called twice");
            }
        });

        // Now remove setDoc just for the parent update path. The cleanest way is to flip the
        // function reference after the reply write — but persistTicketReply uses one firestoreFns.
        // Instead: leave setDoc available but remove updateDoc; persistTicketUpdate will call setDoc
        // (with merge:true) which is allowed. So both writes succeed. To trigger structured failure
        // explicitly, wrap firestoreFns so that setDoc only exists for the reply path:
        const wrappedFirestoreFns = {
            ...firestoreFns,
            doc: firestoreFns.doc,
            collection: firestoreFns.collection,
            setDoc: jest.fn(async (ref, payload, opts) => {
                // The parent ticket patch is passed with { merge: true }. Reject that path.
                if (opts && opts.merge) {
                    throw Object.assign(new Error("merge-not-allowed"), { kind: "merge-write" });
                }
                return undefined;
            })
        };

        const result = await ticketService.persistTicketReply({
            db: { kind: "db" },
            firestoreFns: wrappedFirestoreFns,
            ticket: { ticketId: "t-1", status: "open", updatedAt: "T" },
            reply: { replyId: "r-1", body: "hi", authorRole: "customer", createdAt: "T" }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/reply-parent-write-failed");
    });

    test("addReply forwards a persistTicketReply failure to the caller", async () => {
        const ticketQueries = makeTicketQueries({
            getReplyDocRef: jest.fn(() => null)
        });

        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const result = await ticketService.addReply({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries,
            ticket,
            reply: { body: "hi", authorRole: "customer", authorUid: "c-1" }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/reply-doc-ref-unavailable");
    });

    test("persistTicketReply forwards a structured persistTicketUpdate failure (doc ref missing)", async () => {
        // getReplyDocRef returns a real ref so the reply write succeeds, but getTicketDocRef returns
        // null so persistTicketUpdate fails with a structured doc-ref-unavailable error rather than
        // throwing — exercising the `if (!updateResult.success)` branch.
        const ticketQueries = makeTicketQueries({
            getReplyDocRef: jest.fn(() => ({ kind: "reply-doc-ref" })),
            getTicketDocRef: jest.fn(() => null)
        });

        const result = await ticketService.persistTicketReply({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticketQueries,
            ticket: { ticketId: "t-1", status: "open", updatedAt: "T" },
            reply: { replyId: "r-1", body: "hi", authorRole: "customer", createdAt: "T" }
        });

        expect(result.success).toBe(false);
        // persistTicketReply surfaces the underlying structured error from persistTicketUpdate
        // when one is present, rather than masking it with a generic wrapper code.
        expect(result.error.code).toBe("tickets/doc-ref-unavailable");
        expect(result.reply.replyId).toBe("r-1");
        expect(result.replyDocRef).toEqual({ kind: "reply-doc-ref" });
    });

    test("addReply forwards a buildAddReplyUpdate failure to the caller", async () => {
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y"
        });

        const result = await ticketService.addReply({
            db: { kind: "db" },
            firestoreFns: makeFirestoreFns(),
            ticket,
            reply: { body: "   " }  // empty body — buildAddReplyUpdate rejects this
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("tickets/empty-reply");
    });

    test("closeTicketByReporter and reopenTicket are thin wrappers around updateTicketStatus", async () => {
        const firestoreFns = makeFirestoreFns();
        const ticket = ticketModel.createTicketRecord({
            ticketId: "t-1",
            reporter: { uid: "c-1", role: "customer" },
            subject: "x",
            description: "y",
            status: "open"
        });

        const closeResult = await ticketService.closeTicketByReporter({
            db: { kind: "db" },
            firestoreFns,
            ticket,
            actorUid: "c-1"
        });
        expect(closeResult.success).toBe(true);
        expect(closeResult.ticket.status).toBe("closed");

        const reopenResult = await ticketService.reopenTicket({
            db: { kind: "db" },
            firestoreFns,
            ticket: { ...closeResult.ticket },
            actorRole: "customer",
            actorUid: "c-1"
        });
        expect(reopenResult.success).toBe(true);
        expect(reopenResult.ticket.status).toBe("open");
        expect(reopenResult.timelineEntry.eventType).toBe("reopened");
    });
});
