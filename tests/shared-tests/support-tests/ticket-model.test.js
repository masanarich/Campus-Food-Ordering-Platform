const ticketModel = require("../../../public/shared/support/ticket-model.js");
const refundCaseModel = require("../../../public/shared/support/refund-case-model.js");

function createFakeTicketStatus() {
    return {
        getDefaultTicketStatus: jest.fn(() => "open"),
        normalizeTicketStatus: jest.fn((value, fallback) => {
            const text = typeof value === "string" ? value.trim().toLowerCase() : "";
            if (text === "wip") {
                return "in_progress";
            }
            if (["open", "in_progress", "awaiting_user", "resolved", "closed"].indexOf(text) !== -1) {
                return text;
            }
            return fallback || "open";
        }),
        getTicketStatusLabel: jest.fn((status) => `[STATUS:${status}]`)
    };
}

function createFakeTicketCategories() {
    return {
        getDefaultTicketCategory: jest.fn(() => "general"),
        normalizeTicketCategory: jest.fn((value, fallback) => {
            const text = typeof value === "string" ? value.trim().toLowerCase() : "";
            if (text === "order") {
                return "order_issue";
            }
            if (
                ["order_issue", "payment", "refund", "account", "abuse", "general"].indexOf(text) !== -1
            ) {
                return text;
            }
            return fallback || "general";
        }),
        getTicketCategoryLabel: jest.fn((category) => `[CATEGORY:${category}]`)
    };
}

describe("shared/support/ticket-model.js", () => {
    afterEach(() => {
        if (typeof global !== "undefined") {
            delete global.ticketStatus;
            delete global.ticketCategories;
            delete global.refundCaseModel;
        }
    });

    test("exports the expected module surface and constants", () => {
        expect(ticketModel.MODULE_NAME).toBe("ticket-model");
        expect(ticketModel.DEFAULT_STATUS).toBe("open");
        expect(ticketModel.DEFAULT_CATEGORY).toBe("general");
        expect(ticketModel.DEFAULT_PRIORITY).toBe("normal");
        expect(ticketModel.DEFAULT_REPORTER_ROLE).toBe("customer");
        expect(ticketModel.DEFAULT_AUTHOR_ROLE).toBe("system");
        expect(ticketModel.KNOWN_STATUSES).toEqual([
            "open",
            "in_progress",
            "awaiting_user",
            "resolved",
            "closed"
        ]);
        expect(ticketModel.KNOWN_CATEGORIES).toEqual([
            "order_issue",
            "payment",
            "refund",
            "account",
            "abuse",
            "general"
        ]);
        expect(ticketModel.KNOWN_PRIORITIES).toEqual(["normal", "high"]);
        expect(ticketModel.KNOWN_REPORTER_ROLES).toEqual(["customer", "vendor"]);
        expect(ticketModel.KNOWN_AUTHOR_ROLES).toEqual([
            "customer",
            "vendor",
            "admin",
            "system"
        ]);
        expect(ticketModel.KNOWN_TIMELINE_EVENTS).toEqual([
            "created",
            "status_changed",
            "replied",
            "resolved",
            "reopened",
            "closed",
            "escalated",
            "refund_proposed",
            "refund_decision_approved",
            "refund_decision_declined",
            "refund_processing",
            "refund_completed",
            "refund_failed",
            "refund_cancelled"
        ]);
        expect(ticketModel.SUBJECT_MAX_LENGTH).toBeGreaterThan(0);
        expect(ticketModel.BODY_MAX_LENGTH).toBeGreaterThan(0);
    });

    test("resolveTicketStatus accepts explicit modules, falls back to global, and falls through to require()", () => {
        const fakeStatus = createFakeTicketStatus();
        const realTicketStatus = require("../../../public/shared/support/ticket-status.js");

        expect(ticketModel.resolveTicketStatus(fakeStatus)).toBe(fakeStatus);

        global.ticketStatus = fakeStatus;
        expect(ticketModel.resolveTicketStatus()).toBe(fakeStatus);

        delete global.ticketStatus;

        // ticket-status.js is now a real module that satisfies the resolver contract,
        // so require() returns it as the last-resort fallback.
        expect(ticketModel.resolveTicketStatus()).toBe(realTicketStatus);

        // A partial object that does not expose the full contract is rejected.
        expect(ticketModel.resolveTicketStatus({ getDefaultTicketStatus: () => "open" })).toBe(realTicketStatus);
    });

    test("resolveTicketCategories follows the explicit/global/require pattern", () => {
        const fakeCategories = createFakeTicketCategories();
        const realTicketCategories = require("../../../public/shared/support/ticket-categories.js");

        expect(ticketModel.resolveTicketCategories(fakeCategories)).toBe(fakeCategories);

        global.ticketCategories = fakeCategories;
        expect(ticketModel.resolveTicketCategories()).toBe(fakeCategories);

        delete global.ticketCategories;

        // ticket-categories.js is now a real module that satisfies the resolver contract,
        // so require() returns it as the last-resort fallback.
        expect(ticketModel.resolveTicketCategories()).toBe(realTicketCategories);

        // A partial object that does not expose the full contract is rejected, then require() runs.
        expect(ticketModel.resolveTicketCategories({
            normalizeTicketCategory: () => "general"
        })).toBe(realTicketCategories);
    });

    test("resolveRefundCaseModel accepts explicit modules, global modules, and require fallbacks", () => {
        const fakeRefundCaseModel = {
            createRefundCaseRecord: jest.fn(),
            createRefundCasePatch: jest.fn()
        };

        expect(ticketModel.resolveRefundCaseModel(fakeRefundCaseModel)).toBe(fakeRefundCaseModel);

        global.refundCaseModel = fakeRefundCaseModel;
        expect(ticketModel.resolveRefundCaseModel()).toBe(fakeRefundCaseModel);

        delete global.refundCaseModel;
        expect(ticketModel.resolveRefundCaseModel()).toBe(refundCaseModel);
        expect(ticketModel.resolveRefundCaseModel({ createRefundCaseRecord: jest.fn() })).toBe(refundCaseModel);
    });

    test("normalizes primitive values safely", () => {
        expect(ticketModel.normalizeText("  hi  ")).toBe("hi");
        expect(ticketModel.normalizeText(null)).toBe("");
        expect(ticketModel.normalizeText(42)).toBe("");

        expect(ticketModel.normalizeLowerText("  HeLLO  ")).toBe("hello");

        expect(ticketModel.clampText("hello world", 5)).toBe("hello");
        expect(ticketModel.clampText("  spaced  ", 100)).toBe("spaced");
        expect(ticketModel.clampText("anything", 0)).toBe("anything");
        expect(ticketModel.clampText(null, 5)).toBe("");

        expect(ticketModel.normalizeBoolean(true)).toBe(true);
        expect(ticketModel.normalizeBoolean(false)).toBe(false);
        expect(ticketModel.normalizeBoolean(1)).toBe(true);
        expect(ticketModel.normalizeBoolean("0")).toBe(false);
        expect(ticketModel.normalizeBoolean("YES")).toBe(true);
        expect(ticketModel.normalizeBoolean("no")).toBe(false);
        expect(ticketModel.normalizeBoolean("maybe")).toBe(false);

        expect(ticketModel.normalizeTimestampValue("now", "later")).toBe("now");
        expect(ticketModel.normalizeTimestampValue(null, "later")).toBe("later");
        expect(ticketModel.normalizeTimestampValue(undefined, undefined)).toBeNull();

        expect(ticketModel.normalizeNonNegativeInteger("4")).toBe(4);
        expect(ticketModel.normalizeNonNegativeInteger(-1, 2)).toBe(2);
        expect(ticketModel.normalizeNonNegativeInteger("bad")).toBe(0);
    });

    test("normalizeFromWhitelist picks values, falls back, then drops to the first whitelist entry", () => {
        const list = ["a", "b", "c"];

        expect(ticketModel.normalizeFromWhitelist(" B ", list)).toBe("b");
        expect(ticketModel.normalizeFromWhitelist("z", list, "c")).toBe("c");
        expect(ticketModel.normalizeFromWhitelist("z", list, "zz")).toBe("a");
        expect(ticketModel.normalizeFromWhitelist(null, list)).toBe("a");
    });

    test("normalizeReporterRole and normalizeAuthorRole enforce their whitelists", () => {
        expect(ticketModel.normalizeReporterRole("VENDOR")).toBe("vendor");
        expect(ticketModel.normalizeReporterRole("admin")).toBe("customer");
        expect(ticketModel.normalizeReporterRole(undefined, "vendor")).toBe("vendor");

        expect(ticketModel.normalizeAuthorRole("admin")).toBe("admin");
        expect(ticketModel.normalizeAuthorRole("ghost")).toBe("system");
        expect(ticketModel.normalizeAuthorRole(null, "customer")).toBe("customer");
    });

    test("normalizeTicketStatus uses the internal whitelist when no module is present", () => {
        expect(ticketModel.normalizeTicketStatus("In_Progress")).toBe("in_progress");
        expect(ticketModel.normalizeTicketStatus("unknown", "resolved")).toBe("resolved");
        expect(ticketModel.normalizeTicketStatus(null)).toBe("open");
    });

    test("normalizeTicketStatus delegates to an external ticket-status module when present", () => {
        const fakeStatus = createFakeTicketStatus();

        expect(ticketModel.normalizeTicketStatus("wip", undefined, fakeStatus)).toBe("in_progress");
        expect(fakeStatus.normalizeTicketStatus).toHaveBeenCalled();
    });

    test("normalizeTicketCategory uses internal whitelist by default and delegates when a module is present", () => {
        expect(ticketModel.normalizeTicketCategory("REFUND")).toBe("refund");
        expect(ticketModel.normalizeTicketCategory("nonsense")).toBe("general");
        expect(ticketModel.normalizeTicketCategory("nonsense", "abuse")).toBe("abuse");

        const fakeCategories = createFakeTicketCategories();
        expect(ticketModel.normalizeTicketCategory("order", undefined, fakeCategories)).toBe("order_issue");
        expect(fakeCategories.normalizeTicketCategory).toHaveBeenCalled();
    });

    test("normalizeTicketPriority and normalizeTimelineEventType honour their whitelists", () => {
        expect(ticketModel.normalizeTicketPriority("HIGH")).toBe("high");
        expect(ticketModel.normalizeTicketPriority("urgent")).toBe("normal");
        expect(ticketModel.normalizeTicketPriority(undefined, "high")).toBe("high");

        expect(ticketModel.normalizeTimelineEventType("CREATED")).toBe("created");
        expect(ticketModel.normalizeTimelineEventType("REFUND_COMPLETED")).toBe("refund_completed");
        expect(ticketModel.normalizeTimelineEventType("garbage")).toBe("status_changed");
        expect(ticketModel.normalizeTimelineEventType("garbage", "replied")).toBe("replied");
    });

    test("getTicketStatusLabel and getTicketCategoryLabel delegate to real modules when present", () => {
        // Both ticket-status.js and ticket-categories.js are real modules now and are picked up
        // via require(), so unknown inputs go through their richer "Unknown Status" / "Unknown Category"
        // fallbacks instead of the model's tiny internal label map.
        expect(ticketModel.getTicketStatusLabel("in_progress")).toBe("In Progress");
        expect(ticketModel.getTicketStatusLabel("nonsense")).toBe("Unknown Status");
        expect(ticketModel.getTicketCategoryLabel("order_issue")).toBe("Order Issue");
        expect(ticketModel.getTicketCategoryLabel("nonsense")).toBe("Unknown Category");

        const fakeStatus = createFakeTicketStatus();
        expect(ticketModel.getTicketStatusLabel("resolved", fakeStatus)).toBe("[STATUS:resolved]");

        const fakeCategories = createFakeTicketCategories();
        expect(ticketModel.getTicketCategoryLabel("payment", fakeCategories)).toBe("[CATEGORY:payment]");
    });

    test("createReporterSnapshot handles different field names and missing input", () => {
        expect(
            ticketModel.createReporterSnapshot({
                uid: "user-1",
                displayName: "Tshepo",
                email: " T@example.com ",
                role: "VENDOR"
            })
        ).toEqual({
            reporterUid: "user-1",
            reporterRole: "vendor",
            reporterName: "Tshepo",
            reporterEmail: "t@example.com"
        });

        expect(ticketModel.createReporterSnapshot(null)).toEqual({
            reporterUid: "",
            reporterRole: "customer",
            reporterName: "",
            reporterEmail: ""
        });
    });

    test("createCustomerSnapshot and createVendorSnapshot fall back across aliases", () => {
        expect(
            ticketModel.createCustomerSnapshot({ userUid: "c-1", fullName: "Naledi" })
        ).toEqual({
            customerUid: "c-1",
            customerName: "Naledi"
        });

        expect(
            ticketModel.createVendorSnapshot({ uid: "v-1", businessName: "Campus Bites" })
        ).toEqual({
            vendorUid: "v-1",
            vendorName: "Campus Bites"
        });

        expect(ticketModel.createVendorSnapshot(null)).toEqual({
            vendorUid: "",
            vendorName: ""
        });
    });

    test("createTicketTimelineEntry normalises event type, status, actor role, and timestamp", () => {
        const entry = ticketModel.createTicketTimelineEntry("CREATED", {
            status: "open",
            actorRole: "CUSTOMER",
            actorUid: "user-1",
            actorName: " Naledi ",
            note: " First report ",
            timestamp: "2026-05-16T10:00:00Z"
        });

        expect(entry).toEqual({
            eventType: "created",
            status: "open",
            label: "Open",
            actorRole: "customer",
            actorUid: "user-1",
            actorName: "Naledi",
            note: "First report",
            at: "2026-05-16T10:00:00Z"
        });

        const fallbackEntry = ticketModel.createTicketTimelineEntry();
        expect(fallbackEntry.eventType).toBe("status_changed");
        expect(fallbackEntry.status).toBe("open");
        expect(fallbackEntry.actorRole).toBe("system");
        expect(fallbackEntry.at).toBeNull();
    });

    test("createReplyRecord clamps body, normalises author role, and reads aliases", () => {
        const longBody = "a".repeat(ticketModel.BODY_MAX_LENGTH + 100);

        const reply = ticketModel.createReplyRecord({
            id: "reply-1",
            ticketId: "ticket-1",
            uid: "user-2",
            role: "ADMIN",
            displayName: "Admin User",
            message: longBody,
            internalNote: "yes",
            createdAt: "2026-05-16T11:00:00Z"
        });

        expect(reply.replyId).toBe("reply-1");
        expect(reply.ticketId).toBe("ticket-1");
        expect(reply.authorUid).toBe("user-2");
        expect(reply.authorRole).toBe("admin");
        expect(reply.authorName).toBe("Admin User");
        expect(reply.body.length).toBe(ticketModel.BODY_MAX_LENGTH);
        expect(reply.isInternalNote).toBe(true);
        expect(reply.createdAt).toBe("2026-05-16T11:00:00Z");

        const empty = ticketModel.createReplyRecord({}, { defaultAuthorRole: "customer" });
        expect(empty.authorRole).toBe("customer");
        expect(empty.isInternalNote).toBe(false);
        expect(empty.body).toBe("");
    });

    test("createRefundCaseSnapshot delegates to the refund-case model and falls back safely", () => {
        const refundCase = ticketModel.createRefundCaseSnapshot({
            type: "full",
            reason: "Food was unsafe",
            customerDecision: "approved",
            vendorDecision: "approved"
        }, {
            ticketId: "ticket-1",
            order: {
                orderId: "order-1",
                checkoutId: "checkout-1",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                paymentAmount: 110,
                paymentAmountInMinorUnits: 11000,
                paymentReference: "paystack-ref-1"
            }
        });

        expect(refundCase).toEqual(expect.objectContaining({
            ticketId: "ticket-1",
            orderId: "order-1",
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "approved",
            type: "full",
            amount: 110,
            amountInMinorUnits: 11000,
            reason: "Food was unsafe",
            customerDecision: "approved",
            vendorDecision: "approved"
        }));

        const requiredFallback = ticketModel.createRefundCaseSnapshot({
            id: "refund-1",
            status: "PROPOSED",
            refundType: "PARTIAL",
            amount: 12,
            refundReason: " Missing chips ",
            customerDecision: "APPROVED"
        }, {
            ticketId: "ticket-2",
            orderId: "order-2",
            customerUid: "customer-2",
            vendorUid: "vendor-2"
        });

        expect(requiredFallback).toEqual(expect.objectContaining({
            refundCaseId: "refund-1",
            ticketId: "ticket-2",
            orderId: "order-2",
            customerUid: "customer-2",
            vendorUid: "vendor-2",
            status: "customer_approved",
            type: "partial",
            amount: 12,
            amountInMinorUnits: 1200,
            reason: "Missing chips",
            customerDecision: "approved",
            vendorDecision: "pending"
        }));
    });

    test("createTicketRecord builds the full ticket shape with a seeded created timeline entry", () => {
        const ticket = ticketModel.createTicketRecord({
            ticketId: "ticket-1",
            reporter: {
                uid: "customer-1",
                displayName: "Naledi",
                email: "naledi@example.com",
                role: "customer"
            },
            vendor: { uid: "vendor-1", shopName: "Campus Bites" },
            orderId: "order-9",
            category: "REFUND",
            subject: " Where is my refund? ",
            description: " I paid twice. ",
            priority: "high",
            refundCase: {
                type: "partial",
                amount: 25,
                reason: "Duplicate charge",
                customerDecision: "approved"
            },
            createdAt: "2026-05-16T10:00:00Z"
        }, {
            order: {
                orderId: "order-9",
                checkoutId: "checkout-9",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                paymentAmount: 100,
                paymentAmountInMinorUnits: 10000,
                paymentReference: "paystack-ref-9"
            }
        });

        expect(ticket.ticketId).toBe("ticket-1");
        expect(ticket.reporterUid).toBe("customer-1");
        expect(ticket.reporterRole).toBe("customer");
        expect(ticket.reporterEmail).toBe("naledi@example.com");
        expect(ticket.customerUid).toBe("customer-1");
        expect(ticket.customerName).toBe("Naledi");
        expect(ticket.vendorUid).toBe("vendor-1");
        expect(ticket.vendorName).toBe("Campus Bites");
        expect(ticket.orderId).toBe("order-9");
        expect(ticket.category).toBe("refund");
        expect(ticket.categoryLabel).toBe("Refund Request");
        expect(ticket.subject).toBe("Where is my refund?");
        expect(ticket.description).toBe("I paid twice.");
        expect(ticket.status).toBe("open");
        expect(ticket.statusLabel).toBe("Open");
        expect(ticket.priority).toBe("high");
        expect(ticket.replyCount).toBe(0);
        expect(ticket.lastReplyAt).toBeNull();
        expect(ticket.resolvedAt).toBeNull();
        expect(ticket.resolvedByUid).toBe("");
        expect(ticket.resolutionNote).toBe("");
        expect(ticket.refundCase).toEqual(expect.objectContaining({
            ticketId: "ticket-1",
            orderId: "order-9",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "customer_approved",
            type: "partial",
            amount: 25,
            amountInMinorUnits: 2500,
            reason: "Duplicate charge",
            customerDecision: "approved",
            vendorDecision: "pending"
        }));
        expect(ticket.createdAt).toBe("2026-05-16T10:00:00Z");
        expect(ticket.updatedAt).toBe("2026-05-16T10:00:00Z");
        expect(ticket.timeline).toHaveLength(1);
        expect(ticket.timeline[0]).toEqual(
            expect.objectContaining({
                eventType: "created",
                status: "open",
                actorRole: "customer",
                actorUid: "customer-1",
                actorName: "Naledi",
                at: "2026-05-16T10:00:00Z"
            })
        );
    });

    test("createTicketRecord preserves a caller-supplied timeline and routes vendor reporters to the vendor snapshot", () => {
        const ticket = ticketModel.createTicketRecord({
            reporter: { uid: "vendor-2", displayName: "Vendor Two", role: "vendor" },
            subject: "Payouts question",
            description: "When do I get paid?",
            status: "in_progress",
            timeline: [
                {
                    eventType: "created",
                    status: "open",
                    actorRole: "vendor",
                    actorUid: "vendor-2",
                    actorName: "Vendor Two",
                    at: "2026-05-16T09:00:00Z"
                },
                {
                    eventType: "refund_proposed",
                    status: "in_progress",
                    actorRole: "admin",
                    actorUid: "admin-1",
                    actorName: "Admin",
                    note: "Picked up",
                    at: "2026-05-16T09:30:00Z"
                }
            ]
        });

        expect(ticket.reporterRole).toBe("vendor");
        expect(ticket.vendorUid).toBe("vendor-2");
        expect(ticket.customerUid).toBe("");
        expect(ticket.timeline).toHaveLength(2);
        expect(ticket.timeline[1].eventType).toBe("refund_proposed");
        expect(ticket.timeline[1].status).toBe("in_progress");
        expect(ticket.timeline[1].label).toBe("In Progress");
        expect(ticket.refundCase).toBeNull();
    });

    test("normalizeTicketRecord is an alias for createTicketRecord", () => {
        const values = {
            reporter: { uid: "c-1", role: "customer" },
            subject: "Same shape"
        };

        const direct = ticketModel.createTicketRecord(values);
        const aliased = ticketModel.normalizeTicketRecord(values);

        expect(aliased).toEqual(direct);
    });

    test("createTicketFromForm seeds a fresh open ticket for the form-submitting reporter", () => {
        const ticket = ticketModel.createTicketFromForm(
            {
                subject: "Order never arrived",
                description: "Driver did not show",
                category: "order_issue",
                orderId: "order-5",
                refundCase: {
                    type: "partial",
                    amount: 20,
                    reason: "Missing drink"
                }
            },
            {
                reporter: { uid: "customer-9", displayName: "Sipho", role: "customer" },
                vendor: { uid: "vendor-5", shopName: "Campus Bites" },
                createdAt: "2026-05-16T12:00:00Z"
            }
        );

        expect(ticket.status).toBe("open");
        expect(ticket.reporterUid).toBe("customer-9");
        expect(ticket.subject).toBe("Order never arrived");
        expect(ticket.category).toBe("order_issue");
        expect(ticket.orderId).toBe("order-5");
        expect(ticket.refundCase).toEqual(expect.objectContaining({
            orderId: "order-5",
            customerUid: "customer-9",
            vendorUid: "vendor-5",
            amount: 20,
            reason: "Missing drink"
        }));
        expect(ticket.createdAt).toBe("2026-05-16T12:00:00Z");
        expect(ticket.timeline[0].eventType).toBe("created");
        expect(ticket.timeline[0].at).toBe("2026-05-16T12:00:00Z");
    });

    test("createTicketPatch only sets the keys the caller provided", () => {
        expect(ticketModel.createTicketPatch({})).toEqual({});

        const patch = ticketModel.createTicketPatch({
            status: "RESOLVED",
            priority: "high",
            replyCount: 4,
            lastReplyAt: "2026-05-16T13:00:00Z",
            resolvedAt: "2026-05-16T14:00:00Z",
            resolvedByUid: "admin-1",
            resolvedByName: "Admin",
            resolutionNote: " Refunded via Paystack ",
            refundCase: {
                type: "partial",
                amount: 30,
                reason: "Missing item",
                customerDecision: "approved",
                vendorDecision: "approved"
            },
            updatedAt: "2026-05-16T14:00:00Z"
        }, {
            ticketId: "ticket-1",
            orderId: "order-7",
            customerUid: "customer-1",
            vendorUid: "vendor-1"
        });

        expect(patch).toEqual(expect.objectContaining({
            status: "resolved",
            statusLabel: "Resolved",
            priority: "high",
            replyCount: 4,
            lastReplyAt: "2026-05-16T13:00:00Z",
            resolvedAt: "2026-05-16T14:00:00Z",
            resolvedByUid: "admin-1",
            resolvedByName: "Admin",
            resolutionNote: "Refunded via Paystack",
            refundCase: expect.objectContaining({
                ticketId: "ticket-1",
                orderId: "order-7",
                customerUid: "customer-1",
                vendorUid: "vendor-1",
                status: "approved",
                amount: 30,
                amountInMinorUnits: 3000,
                reason: "Missing item"
            }),
            updatedAt: "2026-05-16T14:00:00Z"
        }));

        const categoryPatch = ticketModel.createTicketPatch({
            category: "ORDER",
            replyCount: -2
        }, { ticketCategories: createFakeTicketCategories() });
        expect(categoryPatch.category).toBe("order_issue");
        expect(categoryPatch.categoryLabel).toBe("[CATEGORY:order_issue]");
        expect(categoryPatch.replyCount).toBe(0);
    });
});
