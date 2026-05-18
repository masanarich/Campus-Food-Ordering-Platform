const ticketFormatters = require("../../../public/shared/support/ticket-formatters.js");
const ticketModel = require("../../../public/shared/support/ticket-model.js");
const ticketStatus = require("../../../public/shared/support/ticket-status.js");
const ticketCategories = require("../../../public/shared/support/ticket-categories.js");

function makeTicket(overrides = {}) {
    return ticketModel.createTicketRecord({
        ticketId: "ticket-abcdef",
        reporter: {
            uid: "customer-1",
            displayName: "Naledi",
            role: "customer",
            email: "naledi@example.com"
        },
        subject: "Order never arrived",
        description: "Driver did not show",
        category: "order_issue",
        priority: "normal",
        createdAt: "2026-05-16T10:00:00Z",
        ...overrides
    });
}

describe("shared/support/ticket-formatters.js", () => {
    afterEach(() => {
        if (typeof global !== "undefined") {
            delete global.ticketModel;
            delete global.ticketStatus;
            delete global.ticketCategories;
        }
    });

    test("exposes the expected module surface and constants", () => {
        expect(ticketFormatters.MODULE_NAME).toBe("ticket-formatters");
        expect(Object.isFrozen(ticketFormatters.EVENT_TYPE_LABELS)).toBe(true);
        expect(ticketFormatters.EVENT_TYPE_LABELS.created).toBe("Filed");
        expect(ticketFormatters.EVENT_TYPE_LABELS.replied).toBe("Replied");

        expect(Object.isFrozen(ticketFormatters.PRIORITY_METADATA)).toBe(true);
        expect(ticketFormatters.PRIORITY_METADATA.normal.label).toBe("Normal");
        expect(ticketFormatters.PRIORITY_METADATA.high.tone).toBe("warning");

        [
            "resolveTicketStatus",
            "resolveTicketCategories",
            "resolveTicketModel",
            "formatTicketId",
            "formatActorRole",
            "formatDateTime",
            "formatRelativeTime",
            "getTicketStatusLabel",
            "getTicketCategoryLabel",
            "getTicketPriorityLabel",
            "formatTicketHeadline",
            "formatReplyCount",
            "formatLastReplyAt",
            "formatReporter",
            "formatResolutionStatement",
            "formatTimelineEntry",
            "formatTimeline",
            "formatReplyEntry",
            "formatReplyEntries",
            "formatTicketSummary",
            "buildStatusTimelineSteps"
        ].forEach((name) => {
            expect(typeof ticketFormatters[name]).toBe("function");
        });
    });

    test("resolvers accept explicit, global, and require fallbacks", () => {
        const fakeStatus = {
            normalizeTicketStatus: jest.fn(),
            getTicketStatusLabel: jest.fn()
        };
        expect(ticketFormatters.resolveTicketStatus(fakeStatus)).toBe(fakeStatus);
        global.ticketStatus = fakeStatus;
        expect(ticketFormatters.resolveTicketStatus()).toBe(fakeStatus);
        delete global.ticketStatus;
        expect(ticketFormatters.resolveTicketStatus()).toBe(ticketStatus);
        expect(ticketFormatters.resolveTicketStatus({ wrong: true })).toBe(ticketStatus);

        const fakeCategories = {
            normalizeTicketCategory: jest.fn(),
            getTicketCategoryLabel: jest.fn()
        };
        expect(ticketFormatters.resolveTicketCategories(fakeCategories)).toBe(fakeCategories);
        global.ticketCategories = fakeCategories;
        expect(ticketFormatters.resolveTicketCategories()).toBe(fakeCategories);
        delete global.ticketCategories;
        expect(ticketFormatters.resolveTicketCategories()).toBe(ticketCategories);

        const fakeModel = { normalizeTicketRecord: jest.fn() };
        expect(ticketFormatters.resolveTicketModel(fakeModel)).toBe(fakeModel);
        global.ticketModel = fakeModel;
        expect(ticketFormatters.resolveTicketModel()).toBe(fakeModel);
        delete global.ticketModel;
        expect(ticketFormatters.resolveTicketModel()).toBe(ticketModel);
    });

    test("primitive helpers behave defensively", () => {
        expect(ticketFormatters.normalizeText("  hi  ")).toBe("hi");
        expect(ticketFormatters.normalizeText(null)).toBe("");
        expect(ticketFormatters.normalizeText(42)).toBe("");

        expect(ticketFormatters.normalizeLowerText(" HEY ")).toBe("hey");

        expect(ticketFormatters.normalizeNumber("3.5")).toBe(3.5);
        expect(ticketFormatters.normalizeNumber("bad")).toBeNull();

        expect(ticketFormatters.normalizePositiveInteger("4")).toBe(4);
        expect(ticketFormatters.normalizePositiveInteger(-1, 2)).toBe(2);
        expect(ticketFormatters.normalizePositiveInteger("bad")).toBe(0);

        expect(ticketFormatters.normalizeNonNegativeInteger("0")).toBe(0);
        expect(ticketFormatters.normalizeNonNegativeInteger("-5")).toBe(0);
        expect(ticketFormatters.normalizeNonNegativeInteger("7")).toBe(7);
        expect(ticketFormatters.normalizeNonNegativeInteger("bad")).toBe(0);
    });

    test("normalizeTicketRecord routes through the ticket-model and falls back to the raw record", () => {
        const ticket = makeTicket();
        expect(ticketFormatters.normalizeTicketRecord(ticket)).toEqual(
            expect.objectContaining({ status: "open", category: "order_issue" })
        );

        const savedNormalize = ticketModel.normalizeTicketRecord;
        ticketModel.normalizeTicketRecord = undefined;
        try {
            expect(ticketFormatters.normalizeTicketRecord({ status: "OPEN" })).toEqual({ status: "OPEN" });
            expect(ticketFormatters.normalizeTicketRecord(null)).toEqual({});
        } finally {
            ticketModel.normalizeTicketRecord = savedNormalize;
        }
    });

    test("toDateInstance handles Date, Firestore Timestamp shapes, numbers, strings, and bad input", () => {
        const now = new Date("2026-05-16T10:00:00Z");
        expect(ticketFormatters.toDateInstance(now).getTime()).toBe(now.getTime());

        const fakeTimestamp = { toDate: () => now };
        expect(ticketFormatters.toDateInstance(fakeTimestamp).getTime()).toBe(now.getTime());

        const secondsShape = { seconds: 1747389600, nanoseconds: 0 };
        const result = ticketFormatters.toDateInstance(secondsShape);
        expect(result).toBeInstanceOf(Date);
        expect(Number.isFinite(result.getTime())).toBe(true);

        const underscoreSecondsShape = { _seconds: 1747389600, _nanoseconds: 500000000 };
        expect(ticketFormatters.toDateInstance(underscoreSecondsShape)).toBeInstanceOf(Date);

        expect(ticketFormatters.toDateInstance("2026-05-16T10:00:00Z").getTime()).toBe(now.getTime());
        expect(ticketFormatters.toDateInstance(now.getTime()).getTime()).toBe(now.getTime());

        expect(ticketFormatters.toDateInstance("not a date")).toBeNull();
        expect(ticketFormatters.toDateInstance(null)).toBeNull();
        expect(ticketFormatters.toDateInstance(undefined)).toBeNull();
        expect(ticketFormatters.toDateInstance({})).toBeNull();
        expect(ticketFormatters.toDateInstance(new Date("invalid"))).toBeNull();
    });

    test("formatDateTime returns a localised string and a fallback when invalid", () => {
        const formatted = ticketFormatters.formatDateTime("2026-05-16T10:00:00Z", {
            locale: "en-ZA",
            timeZone: "UTC"
        });
        expect(formatted).toMatch(/2026/);

        const dateOnly = ticketFormatters.formatDateTime("2026-05-16T10:00:00Z", {
            includeTime: false,
            timeZone: "UTC"
        });
        expect(dateOnly).toMatch(/2026/);
        expect(dateOnly).not.toMatch(/:/);

        expect(ticketFormatters.formatDateTime(null)).toBe("Unknown time");
        expect(ticketFormatters.formatDateTime(null, { emptyValue: "—" })).toBe("—");
    });

    test("formatRelativeTime covers the full duration window", () => {
        const reference = new Date("2026-05-16T12:00:00Z");
        const at = (offsetMs) => new Date(reference.getTime() + offsetMs).toISOString();

        expect(ticketFormatters.formatRelativeTime(at(0), { now: reference })).toBe("In moments");
        expect(ticketFormatters.formatRelativeTime(at(-60 * 1000), { now: reference })).toBe("1 min ago");
        expect(ticketFormatters.formatRelativeTime(at(60 * 1000), { now: reference })).toBe("In 1 min");
        expect(ticketFormatters.formatRelativeTime(at(-10 * 60 * 1000), { now: reference })).toBe("10 min ago");
        expect(ticketFormatters.formatRelativeTime(at(10 * 60 * 1000), { now: reference })).toBe("In 10 min");
        expect(ticketFormatters.formatRelativeTime(at(-60 * 60 * 1000), { now: reference })).toBe("1 hr ago");
        expect(ticketFormatters.formatRelativeTime(at(60 * 60 * 1000), { now: reference })).toBe("In 1 hr");
        expect(ticketFormatters.formatRelativeTime(at(-5 * 60 * 60 * 1000), { now: reference })).toBe("5 hr ago");
        expect(ticketFormatters.formatRelativeTime(at(5 * 60 * 60 * 1000), { now: reference })).toBe("In 5 hr");
        expect(ticketFormatters.formatRelativeTime(at(-25 * 60 * 60 * 1000), { now: reference })).toBe("Yesterday");
        expect(ticketFormatters.formatRelativeTime(at(25 * 60 * 60 * 1000), { now: reference })).toBe("Tomorrow");
        expect(ticketFormatters.formatRelativeTime(at(-3 * 24 * 60 * 60 * 1000), { now: reference })).toBe("3 days ago");
        expect(ticketFormatters.formatRelativeTime(at(3 * 24 * 60 * 60 * 1000), { now: reference })).toBe("In 3 days");

        // Past the 7-day window → falls through to a date string.
        const farPast = ticketFormatters.formatRelativeTime(at(-30 * 24 * 60 * 60 * 1000), {
            now: reference,
            timeZone: "UTC"
        });
        expect(farPast).toMatch(/2026/);

        expect(ticketFormatters.formatRelativeTime(null)).toBe("Unknown time");
        expect(ticketFormatters.formatRelativeTime(null, { emptyValue: "—" })).toBe("—");
    });

    test("formatTicketId trims, prefixes, and shortens long IDs", () => {
        expect(ticketFormatters.formatTicketId("")).toBe("Ticket");
        expect(ticketFormatters.formatTicketId("", { emptyValue: "No ticket" })).toBe("No ticket");

        expect(ticketFormatters.formatTicketId(" abc ")).toBe("Ticket #abc");
        expect(ticketFormatters.formatTicketId("abcdefghij")).toBe("Ticket #efghij");

        expect(ticketFormatters.formatTicketId("abcdefghij", { prefix: "", visibleChars: 4 }))
            .toBe("#ghij");

        expect(ticketFormatters.formatTicketId("abc", { prefix: "Case" })).toBe("Case #abc");
    });

    test("formatActorRole maps aliases to canonical labels and supports a custom fallback", () => {
        expect(ticketFormatters.formatActorRole("customer")).toBe("Customer");
        expect(ticketFormatters.formatActorRole("STUDENT")).toBe("Customer");
        expect(ticketFormatters.formatActorRole("buyer")).toBe("Customer");
        expect(ticketFormatters.formatActorRole("reporter")).toBe("Customer");

        expect(ticketFormatters.formatActorRole("vendor")).toBe("Vendor");
        expect(ticketFormatters.formatActorRole("shop")).toBe("Vendor");
        expect(ticketFormatters.formatActorRole("merchant")).toBe("Vendor");
        expect(ticketFormatters.formatActorRole("seller")).toBe("Vendor");

        expect(ticketFormatters.formatActorRole("admin")).toBe("Admin");
        expect(ticketFormatters.formatActorRole("support")).toBe("Admin");
        expect(ticketFormatters.formatActorRole("staff")).toBe("Admin");

        expect(ticketFormatters.formatActorRole("system")).toBe("System");
        expect(ticketFormatters.formatActorRole("bot")).toBe("System");
        expect(ticketFormatters.formatActorRole("automation")).toBe("System");
        expect(ticketFormatters.formatActorRole("app")).toBe("System");

        expect(ticketFormatters.formatActorRole("ghost")).toBe("Someone");
        expect(ticketFormatters.formatActorRole(null)).toBe("Someone");
        expect(ticketFormatters.formatActorRole("ghost", { fallback: "Unknown" })).toBe("Unknown");
    });

    test("status label/short/description/tone/action helpers delegate to ticket-status and fall back when absent", () => {
        expect(ticketFormatters.getTicketStatusLabel("in_progress")).toBe("In Progress");
        expect(ticketFormatters.getTicketStatusShortLabel("in_progress")).toBe("Active");
        expect(ticketFormatters.getTicketStatusDescription("open")).toEqual(expect.any(String));
        expect(ticketFormatters.getTicketStatusTone("resolved")).toBe("success");
        expect(ticketFormatters.getTicketStatusActionLabel("open")).toEqual(expect.any(String));

        // Without ticket-status entirely (simulated by stubbing methods).
        const saved = {
            normalizeTicketStatus: ticketStatus.normalizeTicketStatus,
            getTicketStatusLabel: ticketStatus.getTicketStatusLabel,
            getTicketStatusShortLabel: ticketStatus.getTicketStatusShortLabel,
            getTicketStatusDescription: ticketStatus.getTicketStatusDescription,
            getTicketStatusTone: ticketStatus.getTicketStatusTone,
            getTicketStatusActionLabel: ticketStatus.getTicketStatusActionLabel
        };
        ticketStatus.normalizeTicketStatus = undefined;
        ticketStatus.getTicketStatusLabel = undefined;
        try {
            expect(ticketFormatters.getTicketStatusLabel("Open")).toBe("Open");
            expect(ticketFormatters.getTicketStatusLabel("")).toBe("Unknown Status");
            expect(ticketFormatters.getTicketStatusShortLabel("In Progress")).toBe("In Progress");
            expect(ticketFormatters.getTicketStatusDescription("open")).toEqual(expect.any(String));
            expect(ticketFormatters.getTicketStatusTone("open")).toBe("info");
            expect(ticketFormatters.getTicketStatusActionLabel("open")).toEqual(expect.any(String));
        } finally {
            Object.assign(ticketStatus, saved);
        }
    });

    test("category label/short/description/tone helpers delegate and fall back", () => {
        expect(ticketFormatters.getTicketCategoryLabel("order_issue")).toBe("Order Issue");
        expect(ticketFormatters.getTicketCategoryShortLabel("payment")).toBe("Payment");
        expect(ticketFormatters.getTicketCategoryDescription("refund")).toEqual(expect.any(String));
        expect(ticketFormatters.getTicketCategoryTone("abuse")).toBe("error");

        const saved = {
            normalizeTicketCategory: ticketCategories.normalizeTicketCategory,
            getTicketCategoryLabel: ticketCategories.getTicketCategoryLabel,
            getTicketCategoryShortLabel: ticketCategories.getTicketCategoryShortLabel,
            getTicketCategoryDescription: ticketCategories.getTicketCategoryDescription,
            getTicketCategoryTone: ticketCategories.getTicketCategoryTone
        };
        ticketCategories.normalizeTicketCategory = undefined;
        ticketCategories.getTicketCategoryLabel = undefined;
        try {
            expect(ticketFormatters.getTicketCategoryLabel("Order")).toBe("Order");
            expect(ticketFormatters.getTicketCategoryLabel("")).toBe("General");
            expect(ticketFormatters.getTicketCategoryShortLabel("Order")).toBe("Order");
            expect(ticketFormatters.getTicketCategoryDescription("Order")).toBe("");
            expect(ticketFormatters.getTicketCategoryTone("Order")).toBe("info");
        } finally {
            Object.assign(ticketCategories, saved);
        }
    });

    test("priority helpers use the internal metadata map", () => {
        expect(ticketFormatters.getTicketPriorityKey("HIGH")).toBe("high");
        expect(ticketFormatters.getTicketPriorityKey("urgent")).toBe("normal");

        expect(ticketFormatters.getTicketPriorityLabel("high")).toBe("High");
        expect(ticketFormatters.getTicketPriorityLabel("normal")).toBe("Normal");
        expect(ticketFormatters.getTicketPriorityLabel("nonsense")).toBe("Normal");

        expect(ticketFormatters.getTicketPriorityTone("HIGH")).toBe("warning");
        expect(ticketFormatters.getTicketPriorityTone("normal")).toBe("neutral");
    });

    test("getTimelineEventLabel maps event types to friendly labels and falls back to Update", () => {
        expect(ticketFormatters.getTimelineEventLabel("created")).toBe("Filed");
        expect(ticketFormatters.getTimelineEventLabel("REPLIED")).toBe("Replied");
        expect(ticketFormatters.getTimelineEventLabel("resolved")).toBe("Resolved");
        expect(ticketFormatters.getTimelineEventLabel("nonsense")).toBe("Update");
        expect(ticketFormatters.getTimelineEventLabel("")).toBe("Update");
    });

    test("formatTicketHeadline prefers the subject and falls back to the formatted ticket ID", () => {
        const withSubject = makeTicket();
        expect(ticketFormatters.formatTicketHeadline(withSubject)).toBe("Order never arrived");

        const noSubject = makeTicket({ subject: "" });
        expect(ticketFormatters.formatTicketHeadline(noSubject)).toBe("Ticket #abcdef");
    });

    test("formatReplyCount handles zero, one, and many with custom labels", () => {
        expect(ticketFormatters.formatReplyCount(0)).toBe("No replies yet");
        expect(ticketFormatters.formatReplyCount(1)).toBe("1 reply");
        expect(ticketFormatters.formatReplyCount(5)).toBe("5 replies");
        expect(ticketFormatters.formatReplyCount("bad")).toBe("No replies yet");

        expect(ticketFormatters.formatReplyCount(0, { emptyLabel: "Nothing yet" })).toBe("Nothing yet");
        expect(ticketFormatters.formatReplyCount(1, {
            singularLabel: "comment",
            pluralLabel: "comments"
        })).toBe("1 comment");
        expect(ticketFormatters.formatReplyCount(3, {
            singularLabel: "comment",
            pluralLabel: "comments"
        })).toBe("3 comments");
    });

    test("formatLastReplyAt prefixes a relative time or returns the empty fallback", () => {
        const reference = new Date("2026-05-16T12:00:00Z");
        const at = (offsetMs) => new Date(reference.getTime() + offsetMs).toISOString();

        expect(ticketFormatters.formatLastReplyAt(at(-60 * 60 * 1000), { now: reference }))
            .toBe("Last reply 1 hr ago");

        expect(ticketFormatters.formatLastReplyAt(null)).toBe("No replies yet");
        expect(ticketFormatters.formatLastReplyAt(undefined, { emptyLabel: "Never" })).toBe("Never");
        expect(ticketFormatters.formatLastReplyAt("not a date")).toBe("No replies yet");

        expect(ticketFormatters.formatLastReplyAt(at(-60 * 60 * 1000), {
            now: reference,
            prefix: ""
        })).toBe("1 hr ago");
    });

    test("formatReporter combines name and role label and falls back gracefully", () => {
        expect(ticketFormatters.formatReporter(makeTicket())).toBe("Naledi (Customer)");

        const vendorTicket = ticketModel.createTicketRecord({
            ticketId: "t-2",
            reporter: { uid: "vendor-2", displayName: "Shop X", role: "vendor" },
            subject: "Payouts question",
            description: "Where is my money?"
        });
        expect(ticketFormatters.formatReporter(vendorTicket)).toBe("Shop X (Vendor)");

        const anon = ticketModel.createTicketRecord({
            reporter: { role: "customer" },
            subject: "x",
            description: "y"
        });
        expect(ticketFormatters.formatReporter(anon)).toBe("Customer");
    });

    test("formatResolutionStatement returns empty for non-resolved tickets and a sentence otherwise", () => {
        const open = makeTicket();
        expect(ticketFormatters.formatResolutionStatement(open)).toBe("");

        const reference = new Date("2026-05-16T12:00:00Z");
        const resolved = makeTicket({
            status: "resolved",
            resolvedAt: new Date(reference.getTime() - 3 * 60 * 60 * 1000).toISOString(),
            resolvedByName: "Admin User",
            resolvedByUid: "a-1"
        });

        const statement = ticketFormatters.formatResolutionStatement(resolved, { now: reference });
        expect(statement).toMatch(/^Resolved/);
        expect(statement).toContain("Admin User");
        expect(statement).toContain("3 hr ago");

        const noResolver = makeTicket({
            status: "resolved",
            resolvedAt: new Date(reference.getTime() - 60 * 60 * 1000).toISOString()
        });
        const minimal = ticketFormatters.formatResolutionStatement(noResolver, { now: reference });
        expect(minimal).toMatch(/^Resolved/);
        expect(minimal).not.toContain("by");

        const noTimestamp = makeTicket({ status: "resolved", resolvedByName: "Admin" });
        const partial = ticketFormatters.formatResolutionStatement(noTimestamp);
        expect(partial).toBe("Resolved by Admin");
    });

    test("formatTimelineEntry produces a uniform shape", () => {
        const entry = ticketFormatters.formatTimelineEntry({
            eventType: "RESOLVED",
            status: "resolved",
            actorRole: "ADMIN",
            actorName: "Admin User",
            note: "Refunded via Paystack",
            at: "2026-05-16T11:00:00Z"
        }, { timeZone: "UTC", now: new Date("2026-05-16T12:00:00Z") });

        expect(entry).toEqual(
            expect.objectContaining({
                eventType: "resolved",
                eventLabel: "Resolved",
                status: "resolved",
                statusLabel: "Resolved",
                statusTone: "success",
                actorRole: "admin",
                actorName: "Admin User",
                actorLabel: "Admin User",
                note: "Refunded via Paystack",
                at: "2026-05-16T11:00:00Z",
                timestampText: expect.any(String),
                relativeText: "1 hr ago"
            })
        );

        const minimal = ticketFormatters.formatTimelineEntry();
        expect(minimal.eventType).toBe("status_changed");
        expect(minimal.eventLabel).toBe("Status Changed");
        expect(minimal.actorRole).toBe("system");
        expect(minimal.actorLabel).toBe("System");
    });

    test("formatTimeline returns [] for missing records and an ordered/reversed list otherwise", () => {
        expect(ticketFormatters.formatTimeline(null)).toEqual([]);

        const ticket = makeTicket({
            timeline: [
                { eventType: "created", status: "open", actorRole: "customer", at: "T1" },
                { eventType: "replied", status: "in_progress", actorRole: "admin", at: "T2" }
            ]
        });

        const ordered = ticketFormatters.formatTimeline(ticket);
        expect(ordered.map((e) => e.eventType)).toEqual(["created", "replied"]);

        const reversed = ticketFormatters.formatTimeline(ticket, { reverse: true });
        expect(reversed.map((e) => e.eventType)).toEqual(["replied", "created"]);
    });

    test("formatReplyAuthor combines name and role with sensible fallbacks", () => {
        expect(ticketFormatters.formatReplyAuthor({ authorName: "Sipho", authorRole: "customer" }))
            .toBe("Sipho (Customer)");
        expect(ticketFormatters.formatReplyAuthor({ authorRole: "admin" })).toBe("Admin");
        expect(ticketFormatters.formatReplyAuthor({ authorName: "Sipho" })).toBe("Sipho (Someone)");
        expect(ticketFormatters.formatReplyAuthor({})).toBe("Someone");
        expect(ticketFormatters.formatReplyAuthor(null)).toBe("Someone");
    });

    test("formatReplyEntry normalises the reply shape with timestamps and an internal-note badge", () => {
        const reference = new Date("2026-05-16T12:00:00Z");

        const reply = ticketFormatters.formatReplyEntry({
            replyId: "r-1",
            ticketId: "t-1",
            authorRole: "ADMIN",
            authorName: "Admin",
            body: " Looking into this. ",
            isInternalNote: false,
            createdAt: new Date(reference.getTime() - 30 * 60 * 1000).toISOString()
        }, { now: reference, timeZone: "UTC" });

        expect(reply).toEqual(
            expect.objectContaining({
                replyId: "r-1",
                ticketId: "t-1",
                authorRole: "admin",
                authorRoleLabel: "Admin",
                authorName: "Admin",
                authorLabel: "Admin (Admin)",
                body: "Looking into this.",
                isInternalNote: false,
                badgeLabel: "",
                relativeText: "30 min ago"
            })
        );

        const internal = ticketFormatters.formatReplyEntry({
            body: "Internal context",
            isInternalNote: true,
            authorRole: "admin"
        });
        expect(internal.isInternalNote).toBe(true);
        expect(internal.badgeLabel).toBe("Internal note");

        const empty = ticketFormatters.formatReplyEntry();
        expect(empty.authorRole).toBe("system");
        expect(empty.body).toBe("");
        expect(empty.createdAt).toBeNull();
    });

    test("formatReplyEntries maps an array and optionally filters out internal notes", () => {
        const replies = [
            { replyId: "r-1", body: "Hi", authorRole: "customer", isInternalNote: false },
            { replyId: "r-2", body: "Note", authorRole: "admin", isInternalNote: true },
            { replyId: "r-3", body: "Reply", authorRole: "admin", isInternalNote: false }
        ];

        const all = ticketFormatters.formatReplyEntries(replies);
        expect(all.map((r) => r.replyId)).toEqual(["r-1", "r-2", "r-3"]);

        const customerFacing = ticketFormatters.formatReplyEntries(replies, {
            includeInternalNotes: false
        });
        expect(customerFacing.map((r) => r.replyId)).toEqual(["r-1", "r-3"]);

        expect(ticketFormatters.formatReplyEntries(null)).toEqual([]);
    });

    test("formatTicketSummary glues headline, category, status, and reply count", () => {
        const ticket = makeTicket({ replyCount: 3 });

        expect(ticketFormatters.formatTicketSummary(ticket)).toBe(
            "Order never arrived • Order Issue • Open"
        );

        const noStatus = ticketFormatters.formatTicketSummary(ticket, { includeStatus: false });
        expect(noStatus).toBe("Order never arrived • Order Issue");

        const withCount = ticketFormatters.formatTicketSummary(ticket, { includeReplyCount: true });
        expect(withCount).toBe("Order never arrived • Order Issue • Open • 3 replies");
    });

    test("buildStatusTimelineSteps marks current, complete, and upcoming states from a record", () => {
        const ticket = makeTicket({
            status: "in_progress",
            timeline: [
                { eventType: "created", status: "open" },
                { eventType: "status_changed", status: "in_progress" }
            ]
        });

        const steps = ticketFormatters.buildStatusTimelineSteps(ticket);
        expect(steps.map((s) => s.status)).toEqual([
            "open",
            "in_progress",
            "awaiting_user",
            "resolved",
            "closed"
        ]);

        const states = steps.reduce((acc, step) => {
            acc[step.status] = step.state;
            return acc;
        }, {});

        expect(states.open).toBe("complete");
        expect(states.in_progress).toBe("current");
        expect(states.awaiting_user).toBe("upcoming");
        expect(states.resolved).toBe("upcoming");
        expect(states.closed).toBe("upcoming");
    });

    test("buildStatusTimelineSteps also accepts a bare status string and uses a lifecycle fallback when ticket-status is unavailable", () => {
        const stepsFromString = ticketFormatters.buildStatusTimelineSteps("resolved");
        const resolvedStep = stepsFromString.find((s) => s.status === "resolved");
        expect(resolvedStep.state).toBe("current");

        const saved = {
            normalizeTicketStatus: ticketStatus.normalizeTicketStatus,
            getTicketLifecycleList: ticketStatus.getTicketLifecycleList,
            getStatusProgressIndex: ticketStatus.getStatusProgressIndex,
            getTicketStatusLabel: ticketStatus.getTicketStatusLabel,
            getTicketStatusDescription: ticketStatus.getTicketStatusDescription,
            getTicketStatusTone: ticketStatus.getTicketStatusTone
        };
        ticketStatus.normalizeTicketStatus = undefined;
        ticketStatus.getTicketStatusLabel = undefined;
        try {
            const steps = ticketFormatters.buildStatusTimelineSteps("in_progress");
            expect(steps.map((s) => s.status)).toEqual([
                "open",
                "in_progress",
                "awaiting_user",
                "resolved",
                "closed"
            ]);
            const inProgress = steps.find((s) => s.status === "in_progress");
            expect(inProgress.state).toBe("current");
        } finally {
            Object.assign(ticketStatus, saved);
        }
    });
});
