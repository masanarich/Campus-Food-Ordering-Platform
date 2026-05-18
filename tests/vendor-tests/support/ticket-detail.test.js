/**
 * @jest-environment jsdom
 */

const vendorSupportTicketDetailPage = require("../../../public/vendor/support/ticket-detail.js");

function createDOM() {
    document.body.innerHTML = `
        <p id="ticket-detail-status"></p>
        <section id="ticket-summary-section" hidden>
            <output id="ticket-summary-subject">Loading...</output>
            <output id="ticket-summary-id">—</output>
            <output id="ticket-summary-status">—</output>
            <output id="ticket-summary-category">—</output>
            <output id="ticket-summary-priority">—</output>
            <output id="ticket-summary-reporter">—</output>
            <output id="ticket-summary-order">—</output>
            <output id="ticket-summary-opened">—</output>
            <output id="ticket-summary-replies">—</output>
            <p id="ticket-summary-resolution" hidden></p>
            <p id="ticket-description-body">—</p>
        </section>
        <section id="ticket-progress-section" hidden>
            <ol id="ticket-progress-steps"></ol>
        </section>
        <section id="ticket-replies-section" hidden>
            <p id="ticket-replies-empty" hidden>No replies yet.</p>
            <ol id="ticket-replies-list"></ol>
        </section>
        <section id="ticket-reply-form-section" hidden>
            <form id="ticket-reply-form" novalidate>
                <textarea id="ticket-reply-body" name="body"></textarea>
                <p id="ticket-reply-error"></p>
                <button id="ticket-reply-submit" type="submit">Send</button>
            </form>
        </section>
        <section id="ticket-actions-section" hidden>
            <button id="ticket-close-button" type="button" hidden>Close</button>
            <button id="ticket-reopen-button" type="button" hidden>Reopen</button>
        </section>
    `;
    return {
        statusElement: document.getElementById("ticket-detail-status"),
        summarySection: document.getElementById("ticket-summary-section"),
        subject: document.getElementById("ticket-summary-subject"),
        ticketIdText: document.getElementById("ticket-summary-id"),
        status: document.getElementById("ticket-summary-status"),
        category: document.getElementById("ticket-summary-category"),
        priority: document.getElementById("ticket-summary-priority"),
        reporter: document.getElementById("ticket-summary-reporter"),
        order: document.getElementById("ticket-summary-order"),
        opened: document.getElementById("ticket-summary-opened"),
        replies: document.getElementById("ticket-summary-replies"),
        resolution: document.getElementById("ticket-summary-resolution"),
        description: document.getElementById("ticket-description-body"),
        timelineContainer: document.getElementById("ticket-progress-steps"),
        repliesContainer: document.getElementById("ticket-replies-list"),
        repliesEmpty: document.getElementById("ticket-replies-empty"),
        replyFormSection: document.getElementById("ticket-reply-form-section"),
        replyForm: document.getElementById("ticket-reply-form"),
        replyBodyInput: document.getElementById("ticket-reply-body"),
        replySubmitButton: document.getElementById("ticket-reply-submit"),
        replyErrorElement: document.getElementById("ticket-reply-error"),
        closeButton: document.getElementById("ticket-close-button"),
        reopenButton: document.getElementById("ticket-reopen-button")
    };
}

function makeTicket(overrides = {}) {
    return {
        ticketId: "ticket-v-abc",
        reporterUid: "vendor-1",
        reporterRole: "vendor",
        reporterName: "Shop X",
        subject: "Payouts question",
        description: "Where is my money?",
        category: "payment",
        status: "open",
        priority: "normal",
        orderId: "",
        replyCount: 0,
        lastReplyAt: null,
        createdAt: "2026-05-16T10:00:00Z",
        updatedAt: "2026-05-16T10:00:00Z",
        timeline: [
            { eventType: "created", status: "open", actorRole: "vendor", actorUid: "vendor-1", actorName: "Shop X", at: "2026-05-16T10:00:00Z" }
        ],
        resolvedAt: null,
        resolvedByName: "",
        resolutionNote: "",
        ...overrides
    };
}

function makeFormatters() {
    return {
        formatTicketHeadline: jest.fn((t) => t.subject || `Ticket ${t.ticketId}`),
        formatTicketId: jest.fn((id) => `Ticket #${(id || "").slice(-6)}`),
        getTicketStatusLabel: jest.fn((s) => ({ open: "Open", in_progress: "In Progress", closed: "Closed", resolved: "Resolved" }[s] || s)),
        getTicketStatusTone: jest.fn(() => "info"),
        getTicketCategoryLabel: jest.fn((c) => ({ payment: "Payment Issue", general: "General" }[c] || c)),
        getTicketCategoryTone: jest.fn(() => "info"),
        getTicketPriorityLabel: jest.fn(() => "Normal"),
        getTicketPriorityTone: jest.fn(() => "neutral"),
        formatReporter: jest.fn((t) => t.reporterName ? `${t.reporterName} (Vendor)` : "Vendor"),
        formatDateTime: jest.fn((v) => v ? `formatted:${v}` : ""),
        formatReplyCount: jest.fn((c) => c === 0 ? "No replies yet" : `${c} replies`),
        formatResolutionStatement: jest.fn((t) => t.status === "resolved" ? "Resolved" : ""),
        formatTimeline: jest.fn((t) => (Array.isArray(t.timeline) ? t.timeline : []).map((e) => ({
            eventType: e.eventType, eventLabel: e.eventType,
            status: e.status, statusLabel: e.status, statusTone: "info",
            actorRole: e.actorRole, actorName: e.actorName,
            actorLabel: e.actorName || e.actorRole,
            note: e.note || "", at: e.at, relativeText: "moments ago",
            timestampText: `formatted:${e.at}`
        }))),
        formatReplyEntries: jest.fn((replies, opts = {}) => {
            const includeInternal = opts.includeInternalNotes !== false;
            return (Array.isArray(replies) ? replies : [])
                .filter((r) => includeInternal || !(r && r.isInternalNote))
                .map((r) => ({
                    replyId: r.replyId, body: r.body, authorRole: r.authorRole,
                    authorName: r.authorName, authorLabel: `${r.authorName || ""} (${r.authorRole})`,
                    isInternalNote: r.isInternalNote === true,
                    relativeText: "moments ago",
                    timestampText: `formatted:${r.createdAt}`
                }));
        })
    };
}

function makeAuthFns(currentUser) {
    return {
        onAuthStateChanged: jest.fn((auth, onChange) => {
            onChange(currentUser || null);
            return () => {};
        })
    };
}

describe("vendor/support/ticket-detail.js - module surface", () => {
    test("exports the expected API", () => {
        expect(vendorSupportTicketDetailPage.MODULE_NAME).toBe("vendor/support/ticket-detail");
        ["init", "initializeVendorSupportTicketDetailPage", "loadTicketAndReplies", "renderTicket",
            "renderTicketSummary", "renderTimeline", "renderReplies", "applyTicketStatusToActions",
            "submitReply", "changeTicketStatus", "attachReplyHandler", "attachActionHandlers",
            "collectElements", "getTicketIdFromQuery", "isTicketServiceShape"
        ].forEach((name) => expect(typeof vendorSupportTicketDetailPage[name]).toBe("function"));
    });
});

describe("vendor/support/ticket-detail.js - helpers and rendering", () => {
    test("status predicates use the reporter-role rules", () => {
        expect(vendorSupportTicketDetailPage.isTicketClosed({ status: "closed" })).toBe(true);
        expect(vendorSupportTicketDetailPage.canReporterClose({ status: "open" })).toBe(true);
        expect(vendorSupportTicketDetailPage.canReporterReopen({ status: "closed" })).toBe(true);
        expect(vendorSupportTicketDetailPage.canReporterClose({ status: "closed" })).toBe(false);
    });

    test("renderTicketSummary fills outputs with vendor framing", () => {
        const dom = createDOM();
        const elements = vendorSupportTicketDetailPage.collectElements();
        vendorSupportTicketDetailPage.renderTicketSummary(elements, makeTicket(), {
            ticketFormatters: makeFormatters()
        });
        expect(dom.subject.textContent).toBe("Payouts question");
        expect(dom.reporter.textContent).toBe("Shop X (Vendor)");
        expect(dom.status.textContent).toBe("Open");
    });

    test("applyTicketStatusToActions toggles buttons per status", () => {
        const dom = createDOM();
        const elements = vendorSupportTicketDetailPage.collectElements();
        vendorSupportTicketDetailPage.applyTicketStatusToActions(elements, { status: "open" });
        expect(dom.closeButton.hasAttribute("hidden")).toBe(false);
        expect(dom.reopenButton.hasAttribute("hidden")).toBe(true);
        vendorSupportTicketDetailPage.applyTicketStatusToActions(elements, { status: "closed" });
        expect(dom.closeButton.hasAttribute("hidden")).toBe(true);
        expect(dom.reopenButton.hasAttribute("hidden")).toBe(false);
    });

    test("renderReplies filters internal notes", () => {
        const dom = createDOM();
        const elements = vendorSupportTicketDetailPage.collectElements();
        const replies = [
            { replyId: "r-1", body: "Hi", authorRole: "vendor", authorName: "Shop X", createdAt: "T" },
            { replyId: "r-2", body: "internal", authorRole: "admin", isInternalNote: true, createdAt: "T" }
        ];
        vendorSupportTicketDetailPage.renderReplies(
            elements.repliesContainer, elements.repliesEmpty, replies,
            { ticketFormatters: makeFormatters() }
        );
        expect(dom.repliesContainer.querySelectorAll(".ticket-reply-entry")).toHaveLength(1);
    });
});

describe("vendor/support/ticket-detail.js - data flow", () => {
    test("loadTicketAndReplies happy path returns ticket + replies", async () => {
        const ticket = makeTicket();
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => [{ replyId: "r-1" }])
        };
        const r = await vendorSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-v-abc", ticketService
        });
        expect(r.success).toBe(true);
        expect(ticketService.getTicketReplies).toHaveBeenCalledWith(
            expect.objectContaining({ includeInternalNotes: false })
        );
    });

    test("loadTicketAndReplies reports not-found", async () => {
        const r = await vendorSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "missing",
            ticketService: { getTicketById: jest.fn(async () => null) }
        });
        expect(r.error.code).toBe("not-found");
    });

    test("submitReply uses vendor authorRole", async () => {
        const ticket = makeTicket();
        const addReply = jest.fn(async () => ({ success: true, ticket }));
        const r = await vendorSupportTicketDetailPage.submitReply({
            ticketService: { addReply },
            ticket,
            currentUser: { uid: "v-1", displayName: "Shop X" },
            body: "hello", now: "T"
        });
        expect(r.success).toBe(true);
        expect(addReply).toHaveBeenCalledWith(expect.objectContaining({
            reply: expect.objectContaining({
                body: "hello", authorRole: "vendor", authorUid: "v-1"
            }),
            now: "T"
        }));
    });

    test("submitReply guards: no service, no ticket, no user, empty body, too long", async () => {
        expect((await vendorSupportTicketDetailPage.submitReply({ ticket: makeTicket(), currentUser: { uid: "v" }, body: "x" })).error.code).toBe("no-ticket-service");

        expect((await vendorSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            currentUser: { uid: "v" }, body: "x"
        })).error.code).toBe("no-ticket");

        expect((await vendorSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            ticket: makeTicket(), body: "x"
        })).error.code).toBe("not-signed-in");

        expect((await vendorSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            ticket: makeTicket(),
            currentUser: { uid: "v" }, body: ""
        })).error.code).toBe("empty-reply");

        expect((await vendorSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            ticket: makeTicket(),
            currentUser: { uid: "v" },
            body: "x".repeat(vendorSupportTicketDetailPage.REPLY_MAX_LENGTH + 5)
        })).error.code).toBe("reply-too-long");
    });

    test("changeTicketStatus routes close/reopen with vendor actor role", async () => {
        const ticket = makeTicket();
        const close = jest.fn(async () => ({ success: true }));
        const reopen = jest.fn(async () => ({ success: true }));

        await vendorSupportTicketDetailPage.changeTicketStatus({
            ticketService: { closeTicketByReporter: close, getTicketById: jest.fn() },
            ticket, currentUser: { uid: "v-1" }, action: "close"
        });
        expect(close).toHaveBeenCalledWith(expect.objectContaining({ actorRole: "vendor" }));

        await vendorSupportTicketDetailPage.changeTicketStatus({
            ticketService: { reopenTicket: reopen, getTicketById: jest.fn() },
            ticket, currentUser: { uid: "v-1" }, action: "reopen"
        });
        expect(reopen).toHaveBeenCalledWith(expect.objectContaining({ actorRole: "vendor" }));
    });
});

describe("vendor/support/ticket-detail.js - init wiring", () => {
    test("init flags missing ticketId in URL", async () => {
        createDOM();
        window.history.pushState({}, "", "/vendor/support/ticket-detail.html");
        const r = await vendorSupportTicketDetailPage.init({
            ticketService: { getTicketById: jest.fn() },
            auth: { currentUser: { uid: "v-1" } },
            authFns: makeAuthFns({ uid: "v-1" })
        });
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/No ticket/);
    });

    test("init renders the ticket and replies on success", async () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/vendor/support/ticket-detail.html?ticketId=ticket-v-abc");

        const ticket = makeTicket();
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => [
                { replyId: "r-1", body: "Hi", authorRole: "admin", authorName: "Admin", createdAt: "T" }
            ]),
            addReply: jest.fn(), closeTicketByReporter: jest.fn(), reopenTicket: jest.fn()
        };

        const r = await vendorSupportTicketDetailPage.init({
            ticketService,
            ticketFormatters: makeFormatters(),
            auth: { currentUser: { uid: "vendor-1", displayName: "Shop X" } },
            authFns: makeAuthFns({ uid: "vendor-1", displayName: "Shop X" })
        });

        expect(r.success).toBe(true);
        expect(dom.summarySection.hasAttribute("hidden")).toBe(false);
        expect(dom.repliesContainer.querySelectorAll(".ticket-reply-entry")).toHaveLength(1);
        expect(dom.closeButton.hasAttribute("hidden")).toBe(false);
    });
});
