/**
 * @jest-environment jsdom
 */

const adminTicketDetailPage = require("../../public/admin/ticket-detail.js");

function createDOM() {
    document.body.innerHTML = `
        <p id="admin-ticket-status"></p>
        <section id="admin-ticket-summary-section" hidden>
            <output id="admin-ticket-subject">Loading...</output>
            <output id="admin-ticket-id">—</output>
            <output id="admin-ticket-current-status">—</output>
            <output id="admin-ticket-category">—</output>
            <output id="admin-ticket-priority">—</output>
            <output id="admin-ticket-reporter">—</output>
            <output id="admin-ticket-order">—</output>
            <output id="admin-ticket-opened">—</output>
            <output id="admin-ticket-replies-count">—</output>
            <p id="admin-ticket-resolution" hidden></p>
            <p id="admin-ticket-description-body">—</p>
        </section>
        <section id="admin-ticket-progress-section" hidden>
            <ol id="admin-ticket-timeline"></ol>
        </section>
        <section id="admin-ticket-replies-section" hidden>
            <p id="admin-ticket-replies-empty" hidden>No replies yet.</p>
            <ol id="admin-ticket-replies-list"></ol>
        </section>
        <section id="admin-ticket-reply-form-section" hidden>
            <form id="admin-ticket-reply-form" novalidate>
                <textarea id="admin-ticket-reply-body" name="body"></textarea>
                <input id="admin-ticket-reply-internal" name="isInternalNote" type="checkbox">
                <p id="admin-ticket-reply-error"></p>
                <button id="admin-ticket-reply-submit" type="submit">Send</button>
            </form>
        </section>
        <section id="admin-ticket-status-form-section" hidden>
            <form id="admin-ticket-status-form" novalidate>
                <select id="admin-ticket-next-status" name="nextStatus">
                    <option value="open">Open</option>
                    <option value="in_progress">In Progress</option>
                    <option value="awaiting_user">Awaiting User</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                </select>
                <textarea id="admin-ticket-resolution-note" name="resolutionNote"></textarea>
                <p id="admin-ticket-status-error"></p>
                <button id="admin-ticket-status-submit" type="submit">Apply</button>
            </form>
        </section>
    `;
    return {
        statusElement: document.getElementById("admin-ticket-status"),
        summarySection: document.getElementById("admin-ticket-summary-section"),
        subject: document.getElementById("admin-ticket-subject"),
        ticketIdText: document.getElementById("admin-ticket-id"),
        status: document.getElementById("admin-ticket-current-status"),
        category: document.getElementById("admin-ticket-category"),
        priority: document.getElementById("admin-ticket-priority"),
        reporter: document.getElementById("admin-ticket-reporter"),
        order: document.getElementById("admin-ticket-order"),
        opened: document.getElementById("admin-ticket-opened"),
        replies: document.getElementById("admin-ticket-replies-count"),
        resolution: document.getElementById("admin-ticket-resolution"),
        description: document.getElementById("admin-ticket-description-body"),
        progressSection: document.getElementById("admin-ticket-progress-section"),
        timelineContainer: document.getElementById("admin-ticket-timeline"),
        repliesSection: document.getElementById("admin-ticket-replies-section"),
        repliesContainer: document.getElementById("admin-ticket-replies-list"),
        repliesEmpty: document.getElementById("admin-ticket-replies-empty"),
        replyFormSection: document.getElementById("admin-ticket-reply-form-section"),
        replyForm: document.getElementById("admin-ticket-reply-form"),
        replyBodyInput: document.getElementById("admin-ticket-reply-body"),
        replyInternalCheckbox: document.getElementById("admin-ticket-reply-internal"),
        replySubmitButton: document.getElementById("admin-ticket-reply-submit"),
        replyErrorElement: document.getElementById("admin-ticket-reply-error"),
        statusFormSection: document.getElementById("admin-ticket-status-form-section"),
        statusForm: document.getElementById("admin-ticket-status-form"),
        statusSelect: document.getElementById("admin-ticket-next-status"),
        resolutionNoteInput: document.getElementById("admin-ticket-resolution-note"),
        statusSubmitButton: document.getElementById("admin-ticket-status-submit"),
        statusFormError: document.getElementById("admin-ticket-status-error")
    };
}

function makeTicket(overrides = {}) {
    return {
        ticketId: "ticket-a-abc",
        reporterUid: "customer-1",
        reporterRole: "customer",
        reporterName: "Naledi",
        subject: "Order never arrived",
        description: "Driver did not show.",
        category: "order_issue",
        status: "open",
        priority: "normal",
        orderId: "order-7",
        replyCount: 0,
        createdAt: "2026-05-16T10:00:00Z",
        timeline: [{ eventType: "created", status: "open", actorRole: "customer", actorName: "Naledi", at: "2026-05-16T10:00:00Z" }],
        ...overrides
    };
}

function makeFormatters() {
    return {
        formatTicketHeadline: jest.fn((t) => t.subject || `Ticket ${t.ticketId}`),
        formatTicketId: jest.fn((id) => `Ticket #${(id || "").slice(-6)}`),
        getTicketStatusLabel: jest.fn((s) => ({
            open: "Open", in_progress: "In Progress", awaiting_user: "Awaiting User",
            resolved: "Resolved", closed: "Closed"
        }[s] || s)),
        getTicketStatusTone: jest.fn(() => "info"),
        getTicketCategoryLabel: jest.fn((c) => ({ order_issue: "Order Issue", general: "General" }[c] || c)),
        getTicketCategoryTone: jest.fn(() => "info"),
        getTicketPriorityLabel: jest.fn(() => "Normal"),
        formatReporter: jest.fn((t) => t.reporterName ? `${t.reporterName} (Customer)` : "Customer"),
        formatDateTime: jest.fn((v) => v ? `formatted:${v}` : ""),
        formatReplyCount: jest.fn((c) => c === 0 ? "No replies yet" : `${c} replies`),
        formatResolutionStatement: jest.fn((t) => t.status === "resolved" ? `Resolved by ${t.resolvedByName || "Admin"}` : ""),
        formatTimeline: jest.fn((t) => (Array.isArray(t.timeline) ? t.timeline : []).map((e) => ({
            eventType: e.eventType, eventLabel: "Filed",
            status: e.status, statusLabel: e.status, statusTone: "info",
            actorRole: e.actorRole, actorName: e.actorName,
            actorLabel: e.actorName || e.actorRole,
            note: e.note || "", at: e.at, relativeText: "moments ago",
            timestampText: `formatted:${e.at}`
        }))),
        formatReplyEntries: jest.fn((replies) => (Array.isArray(replies) ? replies : []).map((r) => ({
            replyId: r.replyId, body: r.body, authorRole: r.authorRole, authorName: r.authorName,
            authorLabel: `${r.authorName || ""} (${r.authorRole})`,
            isInternalNote: r.isInternalNote === true, relativeText: "moments ago",
            timestampText: `formatted:${r.createdAt}`
        })))
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

describe("admin/ticket-detail.js - module surface", () => {
    test("exports the expected API", () => {
        expect(adminTicketDetailPage.MODULE_NAME).toBe("admin/ticket-detail");
        ["init", "initializeAdminTicketDetailPage", "loadTicketAndReplies", "renderTicket",
            "renderTicketSummary", "renderTimeline", "renderReplies", "refreshStatusOptions",
            "submitReply", "changeTicketStatus", "attachReplyHandler", "attachStatusHandler",
            "collectElements", "getTicketIdFromQuery", "isTicketServiceShape"
        ].forEach((name) => expect(typeof adminTicketDetailPage[name]).toBe("function"));
    });
});

describe("admin/ticket-detail.js - rendering", () => {
    test("renderTicketSummary fills outputs and toggles resolution banner", () => {
        const dom = createDOM();
        const elements = adminTicketDetailPage.collectElements();
        adminTicketDetailPage.renderTicketSummary(elements, makeTicket(), {
            ticketFormatters: makeFormatters()
        });
        expect(dom.subject.textContent).toBe("Order never arrived");
        expect(dom.reporter.textContent).toBe("Naledi (Customer)");
        expect(dom.resolution.hasAttribute("hidden")).toBe(true);

        adminTicketDetailPage.renderTicketSummary(elements, makeTicket({
            status: "resolved", resolvedByName: "Admin"
        }), { ticketFormatters: makeFormatters() });
        expect(dom.resolution.hasAttribute("hidden")).toBe(false);
        expect(dom.resolution.textContent).toMatch(/Resolved by Admin/);
    });

    test("renderReplies includes internal notes (admin view)", () => {
        const dom = createDOM();
        const elements = adminTicketDetailPage.collectElements();
        adminTicketDetailPage.renderReplies(
            elements.repliesContainer, elements.repliesEmpty,
            [
                { replyId: "r-1", body: "Hi", authorRole: "customer", authorName: "Naledi", createdAt: "T" },
                { replyId: "r-2", body: "internal", authorRole: "admin", authorName: "Admin", isInternalNote: true, createdAt: "T" }
            ],
            { ticketFormatters: makeFormatters() }
        );
        const items = dom.repliesContainer.querySelectorAll(".ticket-reply-entry");
        expect(items).toHaveLength(2);
        expect(items[1].getAttribute("data-internal")).toBe("true");
        expect(items[1].querySelector(".ticket-reply-badge").textContent).toBe("Internal note");
    });

    test("refreshStatusOptions disables the current status", () => {
        const dom = createDOM();
        adminTicketDetailPage.refreshStatusOptions(dom.statusSelect, { status: "in_progress" });
        const inProgressOption = Array.from(dom.statusSelect.options).find((o) => o.value === "in_progress");
        const openOption = Array.from(dom.statusSelect.options).find((o) => o.value === "open");
        expect(inProgressOption.disabled).toBe(true);
        expect(openOption.disabled).toBe(false);
        // Default selection should auto-snap to the first enabled option.
        expect(dom.statusSelect.value).toBe("open");
    });
});

describe("admin/ticket-detail.js - data flow", () => {
    test("loadTicketAndReplies happy path requests replies with internal notes included", async () => {
        const ticket = makeTicket();
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => [{ replyId: "r-1" }])
        };
        const r = await adminTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-a-abc", ticketService
        });
        expect(r.success).toBe(true);
        expect(ticketService.getTicketReplies).toHaveBeenCalledWith(
            expect.objectContaining({ includeInternalNotes: true })
        );
    });

    test("loadTicketAndReplies reports not-found and missing service / id", async () => {
        expect((await adminTicketDetailPage.loadTicketAndReplies({})).error.code).toBe("no-ticket-service");
        expect((await adminTicketDetailPage.loadTicketAndReplies({
            ticketService: { getTicketById: jest.fn() }
        })).error.code).toBe("no-ticket-id");
        expect((await adminTicketDetailPage.loadTicketAndReplies({
            ticketId: "missing",
            ticketService: { getTicketById: jest.fn(async () => null) }
        })).error.code).toBe("not-found");
    });

    test("submitReply uses admin authorRole and forwards isInternalNote", async () => {
        const ticket = makeTicket();
        const addReply = jest.fn(async () => ({ success: true, ticket, reply: { replyId: "r-x" } }));
        const r = await adminTicketDetailPage.submitReply({
            ticketService: { addReply },
            ticket,
            currentUser: { uid: "admin-1", displayName: "Admin" },
            body: "Looking into this.",
            isInternalNote: true,
            now: "T"
        });
        expect(r.success).toBe(true);
        expect(addReply).toHaveBeenCalledWith(expect.objectContaining({
            reply: expect.objectContaining({
                authorRole: "admin", authorUid: "admin-1",
                authorName: "Admin", isInternalNote: true
            })
        }));
    });

    test("submitReply guards on missing service/ticket/user/body/length", async () => {
        expect((await adminTicketDetailPage.submitReply({ ticket: makeTicket(), currentUser: { uid: "a-1" }, body: "x" })).error.code).toBe("no-ticket-service");
        expect((await adminTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() }, currentUser: { uid: "a-1" }, body: "x"
        })).error.code).toBe("no-ticket");
        expect((await adminTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() }, ticket: makeTicket(), body: "x"
        })).error.code).toBe("not-signed-in");
        expect((await adminTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() }, ticket: makeTicket(),
            currentUser: { uid: "a-1" }, body: ""
        })).error.code).toBe("empty-reply");
        expect((await adminTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() }, ticket: makeTicket(),
            currentUser: { uid: "a-1" },
            body: "x".repeat(adminTicketDetailPage.REPLY_MAX_LENGTH + 5)
        })).error.code).toBe("reply-too-long");
    });

    test("changeTicketStatus routes valid transitions through updateTicketStatus", async () => {
        const ticket = makeTicket();
        const updateTicketStatus = jest.fn(async () => ({ success: true, ticket: { ...ticket, status: "resolved" } }));
        const r = await adminTicketDetailPage.changeTicketStatus({
            ticketService: { updateTicketStatus },
            ticket, currentUser: { uid: "admin-1", displayName: "Admin" },
            nextStatus: "resolved", resolutionNote: "Refunded via Paystack", now: "T"
        });
        expect(r.success).toBe(true);
        expect(updateTicketStatus).toHaveBeenCalledWith(expect.objectContaining({
            actorRole: "admin", nextStatus: "resolved",
            resolutionNote: "Refunded via Paystack", now: "T"
        }));
    });

    test("changeTicketStatus flags invalid status and missing prerequisites", async () => {
        expect((await adminTicketDetailPage.changeTicketStatus({})).error.code).toBe("no-ticket-service");
        expect((await adminTicketDetailPage.changeTicketStatus({
            ticketService: { updateTicketStatus: jest.fn() }
        })).error.code).toBe("no-ticket");
        expect((await adminTicketDetailPage.changeTicketStatus({
            ticketService: { updateTicketStatus: jest.fn() },
            ticket: makeTicket()
        })).error.code).toBe("not-signed-in");
        expect((await adminTicketDetailPage.changeTicketStatus({
            ticketService: { updateTicketStatus: jest.fn() },
            ticket: makeTicket(),
            currentUser: { uid: "a-1" },
            nextStatus: "frobnicate"
        })).error.code).toBe("invalid-status");
    });
});

describe("admin/ticket-detail.js - init and handlers", () => {
    test("init flags missing ticketId", async () => {
        createDOM();
        window.history.pushState({}, "", "/admin/ticket-detail.html");
        const r = await adminTicketDetailPage.init({
            ticketService: { getTicketById: jest.fn() },
            auth: { currentUser: { uid: "a-1" } },
            authFns: makeAuthFns({ uid: "a-1" })
        });
        expect(r.success).toBe(false);
        expect(r.error).toMatch(/No ticket/);
    });

    test("init renders ticket on success and exposes both reply and status forms", async () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/admin/ticket-detail.html?ticketId=ticket-a-abc");

        const ticket = makeTicket({ replyCount: 1 });
        const replies = [
            { replyId: "r-1", body: "Hi", authorRole: "customer", authorName: "Naledi", createdAt: "T" }
        ];
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => replies),
            addReply: jest.fn(), updateTicketStatus: jest.fn()
        };

        const r = await adminTicketDetailPage.init({
            ticketService,
            ticketFormatters: makeFormatters(),
            auth: { currentUser: { uid: "admin-1", displayName: "Admin" } },
            authFns: makeAuthFns({ uid: "admin-1", displayName: "Admin" })
        });

        expect(r.success).toBe(true);
        expect(dom.summarySection.hasAttribute("hidden")).toBe(false);
        expect(dom.replyFormSection.hasAttribute("hidden")).toBe(false);
        expect(dom.statusFormSection.hasAttribute("hidden")).toBe(false);
        expect(dom.repliesContainer.querySelectorAll(".ticket-reply-entry")).toHaveLength(1);
    });

    test("attachReplyHandler refuses empty body and double-binding", async () => {
        const dom = createDOM();
        const ticketService = { addReply: jest.fn() };
        const opts = {
            runtime: () => ({ ticketService, ticket: makeTicket(), currentUser: { uid: "a-1" } }),
            refresh: jest.fn()
        };
        const controller = adminTicketDetailPage.attachReplyHandler({
            replyForm: dom.replyForm,
            replyBodyInput: dom.replyBodyInput,
            replyInternalCheckbox: dom.replyInternalCheckbox,
            replySubmitButton: dom.replySubmitButton,
            replyErrorElement: dom.replyErrorElement,
            statusElement: dom.statusElement
        }, opts);

        await controller.handleSubmit({ preventDefault() {} });
        expect(dom.replyErrorElement.textContent).toMatch(/empty/i);
        expect(ticketService.addReply).not.toHaveBeenCalled();

        const second = adminTicketDetailPage.attachReplyHandler({
            replyForm: dom.replyForm
        }, opts);
        expect(second).toBeNull();
    });

    test("attachStatusHandler submits selected status via the service", async () => {
        const dom = createDOM();
        const updateTicketStatus = jest.fn(async () => ({ success: true, ticket: makeTicket({ status: "in_progress" }) }));
        const refresh = jest.fn();
        const controller = adminTicketDetailPage.attachStatusHandler({
            statusForm: dom.statusForm,
            statusSelect: dom.statusSelect,
            resolutionNoteInput: dom.resolutionNoteInput,
            statusSubmitButton: dom.statusSubmitButton,
            statusFormError: dom.statusFormError,
            statusElement: dom.statusElement
        }, {
            runtime: () => ({
                ticketService: { updateTicketStatus },
                ticket: makeTicket(),
                currentUser: { uid: "admin-1", displayName: "Admin" }
            }),
            refresh
        });

        dom.statusSelect.value = "in_progress";
        await controller.handleSubmit({ preventDefault() {} });
        expect(updateTicketStatus).toHaveBeenCalledWith(expect.objectContaining({ nextStatus: "in_progress" }));
        expect(refresh).toHaveBeenCalled();
    });

    test("initializeAdminTicketDetailPage is an alias for init", async () => {
        document.body.innerHTML = "";
        const r = await adminTicketDetailPage.initializeAdminTicketDetailPage();
        expect(r.success).toBe(false);
    });
});
