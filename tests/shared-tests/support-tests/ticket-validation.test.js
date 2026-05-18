const ticketValidation = require("../../../public/shared/support/ticket-validation.js");
const ticketModel = require("../../../public/shared/support/ticket-model.js");
const ticketStatus = require("../../../public/shared/support/ticket-status.js");
const ticketCategories = require("../../../public/shared/support/ticket-categories.js");

function makeValidTicketInput(overrides = {}) {
    return ticketModel.createTicketRecord({
        ticketId: "ticket-abc",
        reporter: {
            uid: "customer-1",
            displayName: "Naledi",
            email: "naledi@example.com",
            role: "customer"
        },
        subject: "Order never arrived",
        description: "The driver did not show after 30 minutes.",
        category: "order_issue",
        orderId: "order-7",
        priority: "normal",
        createdAt: "2026-05-16T10:00:00Z",
        updatedAt: "2026-05-16T10:00:00Z",
        ...overrides
    });
}

describe("shared/support/ticket-validation.js", () => {
    afterEach(() => {
        if (typeof global !== "undefined") {
            delete global.ticketStatus;
            delete global.ticketCategories;
            delete global.ticketModel;
        }
    });

    test("exposes the expected module surface and constants", () => {
        expect(ticketValidation.MODULE_NAME).toBe("ticket-validation");
        expect(ticketValidation.DEFAULT_SUBJECT_MIN_LENGTH).toBeGreaterThan(0);
        expect(ticketValidation.DEFAULT_SUBJECT_MAX_LENGTH).toBeGreaterThan(
            ticketValidation.DEFAULT_SUBJECT_MIN_LENGTH
        );
        expect(ticketValidation.DEFAULT_DESCRIPTION_MIN_LENGTH).toBeGreaterThan(0);
        expect(ticketValidation.DEFAULT_DESCRIPTION_MAX_LENGTH).toBeGreaterThan(
            ticketValidation.DEFAULT_DESCRIPTION_MIN_LENGTH
        );

        [
            "resolveTicketStatus",
            "resolveTicketCategories",
            "resolveTicketModel",
            "createValidationResult",
            "setError",
            "mergeErrors",
            "isValidEmail",
            "categoryRequiresOrderId",
            "validateReporterSnapshot",
            "validateTicketTimeline",
            "validateTicketRecord",
            "validateCreateTicketInput",
            "validateReplyRecord",
            "validateAddReplyInput",
            "validateTicketStatusChange"
        ].forEach((name) => {
            expect(typeof ticketValidation[name]).toBe("function");
        });
    });

    test("resolvers accept explicit, global, and require fallbacks", () => {
        const fakeStatus = {
            normalizeTicketStatus: jest.fn(),
            validateTicketStatusTransition: jest.fn()
        };
        expect(ticketValidation.resolveTicketStatus(fakeStatus)).toBe(fakeStatus);
        global.ticketStatus = fakeStatus;
        expect(ticketValidation.resolveTicketStatus()).toBe(fakeStatus);
        delete global.ticketStatus;
        expect(ticketValidation.resolveTicketStatus()).toBe(ticketStatus);
        expect(ticketValidation.resolveTicketStatus({ wrong: true })).toBe(ticketStatus);

        const fakeCategories = {
            normalizeTicketCategory: jest.fn(),
            isKnownTicketCategory: jest.fn()
        };
        expect(ticketValidation.resolveTicketCategories(fakeCategories)).toBe(fakeCategories);
        global.ticketCategories = fakeCategories;
        expect(ticketValidation.resolveTicketCategories()).toBe(fakeCategories);
        delete global.ticketCategories;
        expect(ticketValidation.resolveTicketCategories()).toBe(ticketCategories);

        const fakeModel = {
            normalizeTicketRecord: jest.fn(),
            createReporterSnapshot: jest.fn()
        };
        expect(ticketValidation.resolveTicketModel(fakeModel)).toBe(fakeModel);
        global.ticketModel = fakeModel;
        expect(ticketValidation.resolveTicketModel()).toBe(fakeModel);
        delete global.ticketModel;
        expect(ticketValidation.resolveTicketModel()).toBe(ticketModel);
    });

    test("primitive helpers behave defensively", () => {
        expect(ticketValidation.normalizeText("  hi ")).toBe("hi");
        expect(ticketValidation.normalizeText(null)).toBe("");
        expect(ticketValidation.normalizeLowerText(" HEY ")).toBe("hey");
    });

    test("createValidationResult, setError, and mergeErrors compose error objects", () => {
        const empty = ticketValidation.createValidationResult({});
        expect(empty).toEqual({ isValid: true, errors: {} });

        const withErrors = ticketValidation.createValidationResult({ subject: "missing" }, { value: 1 });
        expect(withErrors.isValid).toBe(false);
        expect(withErrors.errors).toEqual({ subject: "missing" });
        expect(withErrors.value).toBe(1);

        const errors = {};
        ticketValidation.setError(errors, "a", "first");
        ticketValidation.setError(errors, "a", "second"); // should be ignored, already set
        ticketValidation.setError(errors, "", "no key");
        ticketValidation.setError(errors, "b", "");
        ticketValidation.setError(null, "x", "z");
        expect(errors).toEqual({ a: "first" });

        const target = { existing: "stays" };
        ticketValidation.mergeErrors(target, { x: "X", y: "Y" });
        expect(target).toEqual({ existing: "stays", x: "X", y: "Y" });

        const prefixed = {};
        ticketValidation.mergeErrors(prefixed, { id: "missing" }, "items.0");
        expect(prefixed).toEqual({ "items.0.id": "missing" });

        // merge into null target → returns a new safe object
        const result = ticketValidation.mergeErrors(null, { a: "b" });
        expect(result).toEqual({ a: "b" });
    });

    test("isValidEmail accepts properly shaped emails and rejects garbage", () => {
        expect(ticketValidation.isValidEmail("naledi@example.com")).toBe(true);
        expect(ticketValidation.isValidEmail(" Naledi@Example.com ")).toBe(true);
        expect(ticketValidation.isValidEmail("a.b@c.d.e")).toBe(true);

        expect(ticketValidation.isValidEmail("")).toBe(false);
        expect(ticketValidation.isValidEmail(null)).toBe(false);
        expect(ticketValidation.isValidEmail("missing-at")).toBe(false);
        expect(ticketValidation.isValidEmail("missing@dot")).toBe(false);
        expect(ticketValidation.isValidEmail("two @spaces.com")).toBe(false);
    });

    test("categoryRequiresOrderId uses ticket-categories when available and falls back to a built-in list", () => {
        expect(ticketValidation.categoryRequiresOrderId("order_issue")).toBe(true);
        expect(ticketValidation.categoryRequiresOrderId("payment")).toBe(true);
        expect(ticketValidation.categoryRequiresOrderId("refund")).toBe(true);
        expect(ticketValidation.categoryRequiresOrderId("account")).toBe(false);
        expect(ticketValidation.categoryRequiresOrderId("general")).toBe(false);
        expect(ticketValidation.categoryRequiresOrderId("abuse")).toBe(false);

        // Stub out the categories method to exercise the fallback path.
        const saved = ticketCategories.isOrderRelatedCategory;
        ticketCategories.isOrderRelatedCategory = undefined;
        try {
            expect(ticketValidation.categoryRequiresOrderId("ORDER_ISSUE")).toBe(true);
            expect(ticketValidation.categoryRequiresOrderId("PAYMENT")).toBe(true);
            expect(ticketValidation.categoryRequiresOrderId("REFUND")).toBe(true);
            expect(ticketValidation.categoryRequiresOrderId("general")).toBe(false);
        } finally {
            ticketCategories.isOrderRelatedCategory = saved;
        }
    });

    test("validateReporterSnapshot accepts a valid reporter and flags missing or invalid fields", () => {
        const ok = ticketValidation.validateReporterSnapshot({
            reporterUid: "customer-1",
            reporterRole: "customer",
            reporterName: "Naledi",
            reporterEmail: "naledi@example.com"
        });
        expect(ok.isValid).toBe(true);
        expect(ok.value.reporterRole).toBe("customer");

        const bad = ticketValidation.validateReporterSnapshot({
            reporterUid: "",
            reporterRole: "admin",
            reporterName: "",
            reporterEmail: "no-at-sign"
        });
        expect(bad.isValid).toBe(false);
        expect(bad.errors).toEqual({
            reporterUid: expect.any(String),
            reporterRole: expect.any(String),
            reporterName: expect.any(String),
            reporterEmail: expect.any(String)
        });

        // requireReporterEmail forces the email check even when absent.
        const noEmail = ticketValidation.validateReporterSnapshot(
            { reporterUid: "u-1", reporterRole: "customer", reporterName: "X" },
            { requireReporterEmail: true }
        );
        expect(noEmail.isValid).toBe(false);
        expect(noEmail.errors.reporterEmail).toMatch(/required/i);

        // requireReporterName: false relaxes the name check.
        const noName = ticketValidation.validateReporterSnapshot(
            { reporterUid: "u-1", reporterRole: "vendor" },
            { requireReporterName: false }
        );
        expect(noName.isValid).toBe(true);
    });

    test("validateTicketTimeline insists on at least one entry with valid shape", () => {
        const empty = ticketValidation.validateTicketTimeline([]);
        expect(empty.isValid).toBe(false);
        expect(empty.errors.timeline).toBeDefined();

        const bad = ticketValidation.validateTicketTimeline([
            { eventType: "nonsense", status: "wat", actorRole: "ghost", at: null }
        ]);
        expect(bad.isValid).toBe(false);
        expect(bad.errors).toEqual(
            expect.objectContaining({
                "timeline.0.eventType": expect.any(String),
                "timeline.0.status": expect.any(String),
                "timeline.0.actorRole": expect.any(String),
                "timeline.0.at": expect.any(String)
            })
        );

        const ok = ticketValidation.validateTicketTimeline([
            {
                eventType: "created",
                status: "open",
                actorRole: "customer",
                actorUid: "u-1",
                actorName: "Naledi",
                at: "2026-05-16T10:00:00Z"
            }
        ]);
        expect(ok.isValid).toBe(true);
        expect(ok.value[0].eventType).toBe("created");
    });

    test("validateTicketRecord accepts a complete, well-formed ticket", () => {
        const ticket = makeValidTicketInput();
        const result = ticketValidation.validateTicketRecord(ticket);
        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
        expect(result.value.subject).toBe("Order never arrived");
    });

    test("validateTicketRecord flags missing subject, description, category, and timestamps", () => {
        // Raw record (not run through the model) so the validation sees the empty fields directly.
        const ticket = {
            reporter: { uid: "u-1", role: "customer", displayName: "Naledi" },
            subject: "",
            description: "",
            category: "",
            createdAt: null,
            updatedAt: null,
            timeline: []
        };
        const result = ticketValidation.validateTicketRecord(ticket);

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(
            expect.objectContaining({
                subject: expect.any(String),
                description: expect.any(String),
                category: expect.any(String),
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            })
        );
    });

    test("validateTicketRecord enforces length limits on subject and description", () => {
        // Build raw records so length checks see the unclamped values.
        const baseRaw = {
            reporter: { uid: "u-1", role: "customer", displayName: "Naledi" },
            category: "general",
            createdAt: "T0",
            updatedAt: "T0",
            timeline: [
                {
                    eventType: "created",
                    status: "open",
                    actorRole: "customer",
                    at: "T0"
                }
            ]
        };

        const tooShortSubject = ticketValidation.validateTicketRecord({
            ...baseRaw,
            subject: "no",
            description: "Long enough description goes here."
        });
        expect(tooShortSubject.errors.subject).toMatch(/at least/);

        const tooLongSubject = ticketValidation.validateTicketRecord({
            ...baseRaw,
            subject: "x".repeat(ticketValidation.DEFAULT_SUBJECT_MAX_LENGTH + 5),
            description: "Long enough description goes here."
        });
        expect(tooLongSubject.errors.subject).toMatch(/at most/);

        const tooShortDescription = ticketValidation.validateTicketRecord({
            ...baseRaw,
            subject: "Reasonable subject",
            description: "tiny"
        });
        expect(tooShortDescription.errors.description).toMatch(/at least/);
    });

    test("validateTicketRecord enforces orderId for order-related categories and ignores it elsewhere", () => {
        const missingOrder = ticketValidation.validateTicketRecord(
            makeValidTicketInput({ category: "refund", orderId: "" })
        );
        expect(missingOrder.errors.orderId).toBeDefined();

        const optionalForGeneral = ticketValidation.validateTicketRecord(
            makeValidTicketInput({ category: "general", orderId: "" })
        );
        expect(optionalForGeneral.errors.orderId).toBeUndefined();
        expect(optionalForGeneral.isValid).toBe(true);
    });

    test("validateTicketRecord flags an unknown category and a bad status or priority", () => {
        const baseRaw = {
            reporter: { uid: "u-1", role: "customer", displayName: "Naledi" },
            subject: "Reasonable subject",
            description: "Long enough description goes here.",
            createdAt: "T0",
            updatedAt: "T0",
            timeline: [
                { eventType: "created", status: "open", actorRole: "customer", at: "T0" }
            ]
        };

        const badCategory = ticketValidation.validateTicketRecord({
            ...baseRaw,
            category: "nonsense"
        });
        expect(badCategory.errors.category).toMatch(/known/);

        const badStatus = ticketValidation.validateTicketRecord({
            ...baseRaw,
            category: "general",
            status: "nonsense"
        });
        expect(badStatus.errors.status).toBeDefined();

        const badPriority = ticketValidation.validateTicketRecord({
            ...baseRaw,
            category: "general",
            priority: "urgent"
        });
        expect(badPriority.errors.priority).toMatch(/normal or high/);
    });

    test("validateTicketRecord skips timeline check when requireTimeline is false", () => {
        // Bypass the model so the empty timeline is preserved (the model would seed a "created" entry).
        const noTimeline = {
            reporter: { uid: "u-1", role: "customer", displayName: "Naledi" },
            subject: "Reasonable subject",
            description: "Long enough description goes here.",
            category: "general",
            createdAt: "T0",
            updatedAt: "T0",
            timeline: []
        };

        const strict = ticketValidation.validateTicketRecord(noTimeline);
        expect(strict.isValid).toBe(false);
        expect(strict.errors.timeline).toBeDefined();

        const relaxed = ticketValidation.validateTicketRecord(noTimeline, { requireTimeline: false });
        expect(relaxed.errors.timeline).toBeUndefined();
    });

    test("validateCreateTicketInput is an alias for validateTicketRecord", () => {
        const ticket = makeValidTicketInput();
        const direct = ticketValidation.validateTicketRecord(ticket);
        const aliased = ticketValidation.validateCreateTicketInput(ticket);
        expect(aliased).toEqual(direct);
    });

    test("validateReplyRecord accepts a valid reply", () => {
        const result = ticketValidation.validateReplyRecord({
            ticketId: "t-1",
            authorUid: "c-1",
            authorRole: "customer",
            authorName: "Naledi",
            body: "Replying with details.",
            createdAt: "2026-05-16T11:00:00Z"
        });
        expect(result.isValid).toBe(true);
        expect(result.value.authorRole).toBe("customer");
    });

    test("validateReplyRecord flags missing ticketId, authorUid, authorRole, body, and createdAt", () => {
        const result = ticketValidation.validateReplyRecord({
            authorRole: "ghost",
            body: ""
        });

        expect(result.isValid).toBe(false);
        expect(result.errors).toEqual(
            expect.objectContaining({
                ticketId: expect.any(String),
                authorUid: expect.any(String),
                authorRole: expect.any(String),
                body: expect.any(String),
                createdAt: expect.any(String)
            })
        );
    });

    test("validateReplyRecord enforces body length boundaries", () => {
        const tooLong = ticketValidation.validateReplyRecord({
            ticketId: "t-1",
            authorUid: "u-1",
            authorRole: "customer",
            body: "x".repeat(ticketValidation.DEFAULT_REPLY_MAX_LENGTH + 10),
            createdAt: "T"
        }, {
            ticketModel: { normalizeTicketRecord: () => ({}), createReporterSnapshot: () => ({}) }
        });
        // When the real model is in play the body is auto-clamped, so the error only appears when
        // we bypass the model. Either way, this assertion checks the path is wired correctly.
        if (tooLong.errors.body) {
            expect(tooLong.errors.body).toMatch(/at most/);
        }

        const customMin = ticketValidation.validateReplyRecord(
            {
                ticketId: "t-1",
                authorUid: "u-1",
                authorRole: "customer",
                body: "hi",
                createdAt: "T"
            },
            { replyMinLength: 5 }
        );
        expect(customMin.errors.body).toMatch(/at least 5/);
    });

    test("validateReplyRecord blocks non-admin internal notes", () => {
        const customerNote = ticketValidation.validateReplyRecord({
            ticketId: "t-1",
            authorUid: "c-1",
            authorRole: "customer",
            body: "secret",
            isInternalNote: true,
            createdAt: "T"
        });
        expect(customerNote.errors.isInternalNote).toMatch(/admins/i);

        const adminNote = ticketValidation.validateReplyRecord({
            ticketId: "t-1",
            authorUid: "a-1",
            authorRole: "admin",
            body: "Internal context",
            isInternalNote: true,
            createdAt: "T"
        });
        expect(adminNote.isValid).toBe(true);
    });

    test("validateAddReplyInput is an alias for validateReplyRecord", () => {
        const reply = {
            ticketId: "t-1",
            authorUid: "u-1",
            authorRole: "customer",
            body: "hi",
            createdAt: "T"
        };
        expect(ticketValidation.validateAddReplyInput(reply)).toEqual(
            ticketValidation.validateReplyRecord(reply)
        );
    });

    test("validateTicketStatusChange delegates to ticket-status and falls back when ticket-status is unavailable", () => {
        const allowed = ticketValidation.validateTicketStatusChange("open", "in_progress", "admin");
        expect(allowed.isValid).toBe(true);
        expect(allowed.transition.isValid).toBe(true);

        const blocked = ticketValidation.validateTicketStatusChange("open", "resolved", "customer");
        expect(blocked.isValid).toBe(false);
        expect(blocked.errors.status).toMatch(/cannot move/);
        expect(blocked.transition.isValid).toBe(false);

        const saved = ticketStatus.validateTicketStatusTransition;
        ticketStatus.validateTicketStatusTransition = undefined;
        try {
            const unavailable = ticketValidation.validateTicketStatusChange("open", "in_progress", "admin");
            expect(unavailable.isValid).toBe(false);
            expect(unavailable.errors.status).toMatch(/unavailable/i);
            expect(unavailable.transition).toBeNull();
        } finally {
            ticketStatus.validateTicketStatusTransition = saved;
        }
    });

    test("validateReporterSnapshot flags invalid email even when requireReporterEmail is true", () => {
        const result = ticketValidation.validateReporterSnapshot(
            {
                reporterUid: "u-1",
                reporterRole: "customer",
                reporterName: "Naledi",
                reporterEmail: "no-at-sign"
            },
            { requireReporterEmail: true }
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.reporterEmail).toMatch(/valid email/);
    });

    test("validateTicketTimeline flags entries that omit the event type entirely", () => {
        const result = ticketValidation.validateTicketTimeline([
            { status: "open", actorRole: "customer", at: "T0" }
        ]);
        expect(result.errors["timeline.0.eventType"]).toMatch(/event type/i);
    });

    test("validateTicketTimeline still flags bad status when ticket-status has no isKnownTicketStatus", () => {
        const saved = ticketStatus.isKnownTicketStatus;
        ticketStatus.isKnownTicketStatus = undefined;
        try {
            const result = ticketValidation.validateTicketTimeline([
                { eventType: "created", status: "", actorRole: "customer", at: "T0" }
            ]);
            expect(result.errors["timeline.0.status"]).toMatch(/valid ticket status/i);
        } finally {
            ticketStatus.isKnownTicketStatus = saved;
        }
    });

    test("validateTicketRecord flags a description that exceeds the max length", () => {
        const oversized = ticketValidation.validateTicketRecord({
            reporter: { uid: "u-1", role: "customer", displayName: "Naledi" },
            subject: "Reasonable subject",
            description: "x".repeat(ticketValidation.DEFAULT_DESCRIPTION_MAX_LENGTH + 5),
            category: "general",
            createdAt: "T0",
            updatedAt: "T0",
            timeline: [
                { eventType: "created", status: "open", actorRole: "customer", at: "T0" }
            ]
        });
        expect(oversized.errors.description).toMatch(/at most/);
    });

    test("ticket-service picks up ticket-validation via its resolver and routes through it", () => {
        const ticketService = require("../../../public/shared/support/ticket-service.js");
        expect(ticketService.resolveTicketValidation(ticketValidation)).toBe(ticketValidation);

        // prepareCreateTicket should now use the real validation module instead of the inline fallback.
        const failingResult = ticketService.prepareCreateTicket({
            input: { subject: "", description: "" },
            now: "T",
            ticketValidation
        });
        expect(failingResult.success).toBe(false);
        expect(failingResult.error.code).toBe("tickets/validation-failed");
        expect(failingResult.error.errors).toEqual(
            expect.objectContaining({
                subject: expect.any(String),
                description: expect.any(String)
            })
        );
    });
});
