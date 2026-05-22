/**
 * @jest-environment jsdom
 */

const customerSupportTicketDetailPage = require("../../../public/customer/support/ticket-detail.js");

function createDOM() {
    document.body.innerHTML = `
        <p id="ticket-detail-status"></p>

        <section id="ticket-summary-section" hidden>
            <h3><output id="ticket-summary-subject">Loading...</output></h3>
            <output id="ticket-summary-id">—</output>
            <output id="ticket-summary-status">—</output>
            <output id="ticket-summary-category">—</output>
            <output id="ticket-summary-priority">—</output>
            <output id="ticket-summary-reporter">—</output>
            <output id="ticket-summary-order">—</output>
            <output id="ticket-summary-opened">—</output>
            <output id="ticket-summary-replies">—</output>
            <output id="ticket-summary-next-action">Loading</output>
            <p id="ticket-summary-next-action-detail">Checking ticket activity.</p>
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
        nextAction: document.getElementById("ticket-summary-next-action"),
        nextActionDetail: document.getElementById("ticket-summary-next-action-detail"),
        resolution: document.getElementById("ticket-summary-resolution"),
        description: document.getElementById("ticket-description-body"),
        progressSection: document.getElementById("ticket-progress-section"),
        timelineContainer: document.getElementById("ticket-progress-steps"),
        repliesSection: document.getElementById("ticket-replies-section"),
        repliesContainer: document.getElementById("ticket-replies-list"),
        repliesEmpty: document.getElementById("ticket-replies-empty"),
        replyFormSection: document.getElementById("ticket-reply-form-section"),
        replyForm: document.getElementById("ticket-reply-form"),
        replyBodyInput: document.getElementById("ticket-reply-body"),
        replySubmitButton: document.getElementById("ticket-reply-submit"),
        replyErrorElement: document.getElementById("ticket-reply-error"),
        actionsSection: document.getElementById("ticket-actions-section"),
        closeButton: document.getElementById("ticket-close-button"),
        reopenButton: document.getElementById("ticket-reopen-button")
    };
}

function makeTicket(overrides = {}) {
    return {
        ticketId: "ticket-abcdef",
        reporterUid: "customer-1",
        reporterRole: "customer",
        reporterName: "Naledi",
        subject: "Order never arrived",
        description: "Driver did not show up.",
        category: "order_issue",
        status: "open",
        priority: "normal",
        orderId: "order-7",
        replyCount: 0,
        lastReplyAt: null,
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:00:00.000Z",
        timeline: [
            {
                eventType: "created",
                status: "open",
                actorRole: "customer",
                actorUid: "customer-1",
                actorName: "Naledi",
                at: "2026-05-16T10:00:00.000Z"
            }
        ],
        resolvedAt: null,
        resolvedByName: "",
        resolutionNote: "",
        ...overrides
    };
}

function makeFormattersStub() {
    return {
        formatTicketHeadline: jest.fn((t) => t.subject || `Ticket ${t.ticketId}`),
        formatTicketId: jest.fn((id) => `Ticket #${(id || "").slice(-6)}`),
        getTicketStatusLabel: jest.fn((s) => ({
            open: "Open",
            in_progress: "In Progress",
            awaiting_user: "Awaiting User",
            resolved: "Resolved",
            closed: "Closed"
        }[s] || "Unknown")),
        getTicketStatusTone: jest.fn((s) => ({
            open: "info",
            in_progress: "loading",
            awaiting_user: "info",
            resolved: "success",
            closed: "muted"
        }[s] || "info")),
        getTicketCategoryLabel: jest.fn((c) => ({
            order_issue: "Order Issue",
            general: "General"
        }[c] || "General")),
        getTicketCategoryTone: jest.fn((c) => (c === "order_issue" ? "error" : "info")),
        getTicketPriorityLabel: jest.fn((p) => (p === "high" ? "High" : "Normal")),
        getTicketPriorityTone: jest.fn((p) => (p === "high" ? "warning" : "neutral")),
        formatReporter: jest.fn((t) =>
            t.reporterName ? `${t.reporterName} (Customer)` : "Customer"
        ),
        formatDateTime: jest.fn((value) => (value ? `formatted:${value}` : "")),
        formatReplyCount: jest.fn((count) =>
            count === 0 ? "No replies yet" : `${count} replies`
        ),
        formatResolutionStatement: jest.fn((t) =>
            t.status === "resolved"
                ? `Resolved by ${t.resolvedByName || "Admin"}`
                : ""
        ),
        formatTimeline: jest.fn((t) =>
            (Array.isArray(t.timeline) ? t.timeline : []).map((entry) => ({
                eventType: entry.eventType,
                eventLabel: entry.eventType === "created" ? "Filed" : "Update",
                status: entry.status,
                statusLabel: entry.status,
                statusTone: "info",
                actorRole: entry.actorRole,
                actorName: entry.actorName,
                actorLabel: entry.actorName || entry.actorRole,
                note: entry.note || "",
                at: entry.at,
                relativeText: "moments ago",
                timestampText: `formatted:${entry.at}`
            }))
        ),
        formatReplyEntries: jest.fn((replies, options = {}) => {
            const includeInternal = options.includeInternalNotes !== false;
            return (Array.isArray(replies) ? replies : [])
                .filter((r) => includeInternal || !(r && r.isInternalNote))
                .map((r) => ({
                    replyId: r.replyId,
                    body: r.body,
                    authorRole: r.authorRole,
                    authorName: r.authorName,
                    authorLabel: `${r.authorName || ""} (${r.authorRole})`,
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
            return function unsubscribe() {};
        })
    };
}

describe("customer/support/ticket-detail.js - module surface", () => {
    test("exposes the expected API", () => {
        expect(customerSupportTicketDetailPage.MODULE_NAME).toBe("customer/support/ticket-detail");
        expect(customerSupportTicketDetailPage.REPLY_MAX_LENGTH).toBeGreaterThan(0);

        [
            "init",
            "initializeCustomerSupportTicketDetailPage",
            "loadTicketAndReplies",
            "renderTicket",
            "renderTicketSummary",
            "renderTimeline",
            "renderReplies",
            "applyTicketStatusToActions",
            "submitReply",
            "changeTicketStatus",
            "attachReplyHandler",
            "attachActionHandlers",
            "collectElements",
            "getTicketIdFromQuery",
            "hasSupportReply",
            "getNextCustomerTicketAction"
        ].forEach((name) => {
            expect(typeof customerSupportTicketDetailPage[name]).toBe("function");
        });
    });
});

describe("customer/support/ticket-detail.js - small helpers", () => {
    test("normalizeText / normalizeLowerText behave defensively", () => {
        expect(customerSupportTicketDetailPage.normalizeText("  hi  ")).toBe("hi");
        expect(customerSupportTicketDetailPage.normalizeText(null)).toBe("");
        expect(customerSupportTicketDetailPage.normalizeLowerText(" HEY ")).toBe("hey");
    });

    test("isTicketClosed / canReporterReopen / canReporterClose check status", () => {
        expect(customerSupportTicketDetailPage.isTicketClosed({ status: "closed" })).toBe(true);
        expect(customerSupportTicketDetailPage.isTicketClosed({ status: "open" })).toBe(false);

        expect(customerSupportTicketDetailPage.canReporterReopen({ status: "closed" })).toBe(true);
        expect(customerSupportTicketDetailPage.canReporterReopen({ status: "open" })).toBe(false);

        expect(customerSupportTicketDetailPage.canReporterClose({ status: "open" })).toBe(true);
        expect(customerSupportTicketDetailPage.canReporterClose({ status: "in_progress" })).toBe(true);
        expect(customerSupportTicketDetailPage.canReporterClose({ status: "resolved" })).toBe(true);
        expect(customerSupportTicketDetailPage.canReporterClose({ status: "closed" })).toBe(false);
    });

    test("setOutputText writes value or fallback", () => {
        const dom = createDOM();
        customerSupportTicketDetailPage.setOutputText(dom.subject, "Hi");
        expect(dom.subject.textContent).toBe("Hi");
        customerSupportTicketDetailPage.setOutputText(dom.subject, "");
        expect(dom.subject.textContent).toBe("—");
        customerSupportTicketDetailPage.setOutputText(dom.subject, "", "n/a");
        expect(dom.subject.textContent).toBe("n/a");
        customerSupportTicketDetailPage.setOutputText(null, "no-op");
    });

    test("toggleHidden adds/removes the hidden attribute", () => {
        const dom = createDOM();
        customerSupportTicketDetailPage.toggleHidden(dom.summarySection, false);
        expect(dom.summarySection.hasAttribute("hidden")).toBe(false);
        customerSupportTicketDetailPage.toggleHidden(dom.summarySection, true);
        expect(dom.summarySection.hasAttribute("hidden")).toBe(true);
        customerSupportTicketDetailPage.toggleHidden(null, true);
    });

    test("setSubmitButtonState toggles disabled and data-busy", () => {
        const dom = createDOM();
        customerSupportTicketDetailPage.setSubmitButtonState(dom.replySubmitButton, true);
        expect(dom.replySubmitButton.disabled).toBe(true);
        expect(dom.replySubmitButton.getAttribute("data-busy")).toBe("true");

        customerSupportTicketDetailPage.setSubmitButtonState(dom.replySubmitButton, false);
        expect(dom.replySubmitButton.disabled).toBe(false);
        expect(dom.replySubmitButton.hasAttribute("data-busy")).toBe(false);
        customerSupportTicketDetailPage.setSubmitButtonState(null, true);
    });

    test("getTicketIdFromQuery reads ?ticketId or ?id", () => {
        window.history.pushState({}, "", "/customer/support/ticket-detail.html?ticketId=ticket-99");
        expect(customerSupportTicketDetailPage.getTicketIdFromQuery()).toBe("ticket-99");

        window.history.pushState({}, "", "/customer/support/ticket-detail.html?id=ticket-22");
        expect(customerSupportTicketDetailPage.getTicketIdFromQuery()).toBe("ticket-22");

        window.history.pushState({}, "", "/customer/support/ticket-detail.html");
        expect(customerSupportTicketDetailPage.getTicketIdFromQuery()).toBe("");
    });
});

describe("customer/support/ticket-detail.js - rendering", () => {
    test("renderTicketSummary fills every output and tags tones", () => {
        const dom = createDOM();
        const elements = customerSupportTicketDetailPage.collectElements();
        const ticketFormatters = makeFormattersStub();

        customerSupportTicketDetailPage.renderTicketSummary(elements, makeTicket({ replyCount: 2 }), {
            ticketFormatters
        });

        expect(dom.subject.textContent).toBe("Order never arrived");
        expect(dom.ticketIdText.textContent).toMatch(/Ticket #/);
        expect(dom.status.textContent).toBe("Open");
        expect(dom.status.getAttribute("data-tone")).toBe("info");
        expect(dom.status.getAttribute("data-status")).toBe("open");
        expect(dom.category.textContent).toBe("Order Issue");
        expect(dom.category.getAttribute("data-tone")).toBe("error");
        expect(dom.priority.textContent).toBe("Normal");
        expect(dom.reporter.textContent).toBe("Naledi (Customer)");
        expect(dom.order.textContent).toBe("order-7");
        expect(dom.opened.textContent).toMatch(/formatted:/);
        expect(dom.replies.textContent).toBe("2 replies");
        expect(dom.nextAction.textContent).toBe("Next: add details if needed");
        expect(dom.nextActionDetail.textContent).toMatch(/Review the conversation/i);
        expect(dom.description.textContent).toBe("Driver did not show up.");
        // Resolution only shows for resolved tickets.
        expect(dom.resolution.hasAttribute("hidden")).toBe(true);
    });

    test("renderTicketSummary shows resolution statement when resolved", () => {
        const dom = createDOM();
        const elements = customerSupportTicketDetailPage.collectElements();
        const ticketFormatters = makeFormattersStub();

        customerSupportTicketDetailPage.renderTicketSummary(elements, makeTicket({
            status: "resolved",
            resolvedByName: "Admin"
        }), { ticketFormatters });

        expect(dom.resolution.hasAttribute("hidden")).toBe(false);
        expect(dom.resolution.textContent).toMatch(/Resolved by Admin/);
        expect(dom.nextAction.textContent).toBe("Next: close when satisfied");
    });

    test("getNextCustomerTicketAction chooses the customer-facing step", () => {
        expect(customerSupportTicketDetailPage.getNextCustomerTicketAction(makeTicket())).toEqual({
            label: "Next: wait for first response",
            detail: "Your ticket is open. The support team will reply here when they pick it up."
        });

        expect(customerSupportTicketDetailPage.getNextCustomerTicketAction(
            makeTicket({ status: "awaiting_user", replyCount: 1 }),
            [{ authorRole: "admin", body: "Can you send a photo?" }]
        )).toEqual({
            label: "Next: reply to support",
            detail: "The support team is waiting for your response before they can continue."
        });

        expect(customerSupportTicketDetailPage.getNextCustomerTicketAction(
            makeTicket({ status: "closed" })
        )).toEqual({
            label: "Next: reopen if needed",
            detail: "This ticket is closed. Reopen it if the same problem comes back."
        });
    });

    test("renderTimeline renders one entry per timeline item, with note when present", () => {
        const dom = createDOM();
        const elements = customerSupportTicketDetailPage.collectElements();
        const ticketFormatters = makeFormattersStub();

        customerSupportTicketDetailPage.renderTimeline(
            elements.timelineContainer,
            makeTicket({
                timeline: [
                    { eventType: "created", status: "open", actorRole: "customer", actorName: "Naledi", at: "T1" },
                    {
                        eventType: "replied",
                        status: "in_progress",
                        actorRole: "admin",
                        actorName: "Admin",
                        at: "T2",
                        note: "Looking into this."
                    }
                ]
            }),
            { ticketFormatters }
        );

        const items = dom.timelineContainer.querySelectorAll(".ticket-timeline-entry");
        expect(items).toHaveLength(2);
        expect(items[0].querySelector(".ticket-timeline-label").textContent).toMatch(/Filed/);
        expect(items[1].querySelector(".ticket-timeline-note").textContent).toBe("Looking into this.");
    });

    test("renderTimeline shows an empty state when no entries", () => {
        const dom = createDOM();
        customerSupportTicketDetailPage.renderTimeline(
            dom.timelineContainer,
            { timeline: [] },
            { ticketFormatters: makeFormattersStub() }
        );
        expect(dom.timelineContainer.querySelector(".ticket-timeline-empty")).not.toBeNull();
    });

    test("renderReplies omits internal notes and shows empty state otherwise", () => {
        const dom = createDOM();
        const elements = customerSupportTicketDetailPage.collectElements();
        const ticketFormatters = makeFormattersStub();
        const replies = [
            { replyId: "r-1", body: "Hi", authorRole: "customer", authorName: "Naledi", createdAt: "T1" },
            { replyId: "r-2", body: "internal note", authorRole: "admin", authorName: "Admin", isInternalNote: true, createdAt: "T2" }
        ];

        customerSupportTicketDetailPage.renderReplies(
            elements.repliesContainer,
            elements.repliesEmpty,
            replies,
            { ticketFormatters }
        );

        const items = dom.repliesContainer.querySelectorAll(".ticket-reply-entry");
        expect(items).toHaveLength(1);
        expect(items[0].getAttribute("data-author-role")).toBe("customer");
        expect(dom.repliesEmpty.hasAttribute("hidden")).toBe(true);

        customerSupportTicketDetailPage.renderReplies(
            elements.repliesContainer,
            elements.repliesEmpty,
            [],
            { ticketFormatters }
        );
        expect(dom.repliesEmpty.hasAttribute("hidden")).toBe(false);
    });

    test("applyTicketStatusToActions shows the right buttons for each status", () => {
        const dom = createDOM();
        const elements = customerSupportTicketDetailPage.collectElements();

        customerSupportTicketDetailPage.applyTicketStatusToActions(elements, { status: "open" });
        expect(dom.closeButton.hasAttribute("hidden")).toBe(false);
        expect(dom.reopenButton.hasAttribute("hidden")).toBe(true);
        expect(dom.replyFormSection.getAttribute("data-state")).toBe("open");

        customerSupportTicketDetailPage.applyTicketStatusToActions(elements, { status: "resolved" });
        expect(dom.closeButton.hasAttribute("hidden")).toBe(false);
        expect(dom.reopenButton.hasAttribute("hidden")).toBe(true);

        customerSupportTicketDetailPage.applyTicketStatusToActions(elements, { status: "closed" });
        expect(dom.closeButton.hasAttribute("hidden")).toBe(true);
        expect(dom.reopenButton.hasAttribute("hidden")).toBe(false);
        expect(dom.replyFormSection.hasAttribute("hidden")).toBe(true);
    });
});

describe("customer/support/ticket-detail.js - loadTicketAndReplies", () => {
    test("returns error when no ticket service", async () => {
        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "t-1"
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-ticket-service");
    });

    test("returns error when no ticket id", async () => {
        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketService: { getTicketById: jest.fn() }
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-ticket-id");
    });

    test("returns not-found when the ticket is missing", async () => {
        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "missing",
            ticketService: { getTicketById: jest.fn(async () => null) }
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("not-found");
    });

    test("returns ticket + replies on success", async () => {
        const ticket = makeTicket();
        const replies = [{ replyId: "r-1", body: "hi", authorRole: "customer", createdAt: "T" }];
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => replies)
        };

        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-abc",
            ticketService
        });

        expect(result.success).toBe(true);
        expect(result.ticket).toBe(ticket);
        expect(result.replies).toBe(replies);
        // Replies are requested with internal notes filtered out for the customer view.
        expect(ticketService.getTicketReplies).toHaveBeenCalledWith(
            expect.objectContaining({ includeInternalNotes: false })
        );
    });

    test("treats getTicketReplies failure as empty array but keeps the ticket", async () => {
        const ticket = makeTicket();
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => { throw new Error("boom"); })
        };

        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-abc",
            ticketService
        });

        expect(result.success).toBe(true);
        expect(result.ticket).toBe(ticket);
        expect(result.replies).toEqual([]);
    });

    test("wraps thrown getTicketById errors", async () => {
        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-x",
            ticketService: { getTicketById: jest.fn(async () => { throw new Error("network"); }) }
        });

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("network");
    });

    test("returns not-found when the ticket was raised from the vendor side", async () => {
        // A user who is both a customer and a vendor could land on
        // /customer/support/ticket-detail.html?ticketId=<their-vendor-ticket>.
        // The page must refuse to surface it even though the UID matches.
        const vendorTicket = makeTicket({
            reporterUid: "customer-1",
            reporterRole: "vendor"
        });
        const ticketService = {
            getTicketById: jest.fn(async () => vendorTicket),
            getTicketReplies: jest.fn(async () => [])
        };

        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-abcdef",
            ticketService,
            expectedReporterRole: "customer",
            expectedReporterUid: "customer-1"
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("not-found");
        // Replies must not even be fetched once the role check fails.
        expect(ticketService.getTicketReplies).not.toHaveBeenCalled();
    });

    test("returns not-found when the ticket belongs to a different user", async () => {
        const otherUsersTicket = makeTicket({ reporterUid: "someone-else" });
        const ticketService = {
            getTicketById: jest.fn(async () => otherUsersTicket),
            getTicketReplies: jest.fn(async () => [])
        };

        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-abcdef",
            ticketService,
            expectedReporterRole: "customer",
            expectedReporterUid: "customer-1"
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("not-found");
        expect(ticketService.getTicketReplies).not.toHaveBeenCalled();
    });

    test("allows the ticket through when role and uid both match", async () => {
        const ticket = makeTicket();
        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => [])
        };

        const result = await customerSupportTicketDetailPage.loadTicketAndReplies({
            ticketId: "ticket-abcdef",
            ticketService,
            expectedReporterRole: "customer",
            expectedReporterUid: "customer-1"
        });

        expect(result.success).toBe(true);
        expect(result.ticket).toBe(ticket);
    });
});

describe("customer/support/ticket-detail.js - submitReply", () => {
    test("returns error when no service", async () => {
        const result = await customerSupportTicketDetailPage.submitReply({
            ticket: makeTicket(),
            currentUser: { uid: "c-1" },
            body: "hi"
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-ticket-service");
    });

    test("returns error when ticket is missing", async () => {
        const result = await customerSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            currentUser: { uid: "c-1" },
            body: "hi"
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-ticket");
    });

    test("returns error when user is not signed in", async () => {
        const result = await customerSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            ticket: makeTicket(),
            body: "hi"
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("not-signed-in");
    });

    test("returns error when body is empty", async () => {
        const result = await customerSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            ticket: makeTicket(),
            currentUser: { uid: "c-1" },
            body: ""
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("empty-reply");
    });

    test("returns error when body is too long", async () => {
        const result = await customerSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn() },
            ticket: makeTicket(),
            currentUser: { uid: "c-1" },
            body: "x".repeat(customerSupportTicketDetailPage.REPLY_MAX_LENGTH + 10)
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("reply-too-long");
    });

    test("calls addReply with customer authorRole and returns its result", async () => {
        const ticket = makeTicket();
        const addReply = jest.fn(async () => ({ success: true, ticket, reply: { replyId: "r-1" } }));
        const result = await customerSupportTicketDetailPage.submitReply({
            ticketService: { addReply },
            ticket,
            currentUser: { uid: "c-1", displayName: "Naledi" },
            body: "hello",
            now: "T"
        });

        expect(result.success).toBe(true);
        expect(addReply).toHaveBeenCalledWith(expect.objectContaining({
            ticket,
            reply: expect.objectContaining({
                body: "hello",
                authorRole: "customer",
                authorUid: "c-1",
                authorName: "Naledi"
            }),
            now: "T"
        }));
    });

    test("wraps thrown service errors", async () => {
        const result = await customerSupportTicketDetailPage.submitReply({
            ticketService: { addReply: jest.fn(async () => { throw new Error("boom"); }) },
            ticket: makeTicket(),
            currentUser: { uid: "c-1" },
            body: "hi"
        });
        expect(result.success).toBe(false);
        expect(result.error.message).toBe("boom");
    });
});

describe("customer/support/ticket-detail.js - changeTicketStatus", () => {
    test("close routes to ticketService.closeTicketByReporter with customer role", async () => {
        const ticket = makeTicket();
        const closeTicketByReporter = jest.fn(async () => ({ success: true, ticket: { ...ticket, status: "closed" } }));
        const result = await customerSupportTicketDetailPage.changeTicketStatus({
            ticketService: { closeTicketByReporter, getTicketById: jest.fn() },
            ticket,
            currentUser: { uid: "c-1", displayName: "Naledi" },
            action: "close",
            now: "T"
        });
        expect(result.success).toBe(true);
        expect(closeTicketByReporter).toHaveBeenCalledWith(expect.objectContaining({
            ticket,
            actorRole: "customer",
            actorUid: "c-1",
            now: "T"
        }));
    });

    test("reopen routes to ticketService.reopenTicket", async () => {
        const ticket = makeTicket({ status: "closed" });
        const reopenTicket = jest.fn(async () => ({ success: true, ticket: { ...ticket, status: "open" } }));
        const result = await customerSupportTicketDetailPage.changeTicketStatus({
            ticketService: { reopenTicket, getTicketById: jest.fn() },
            ticket,
            currentUser: { uid: "c-1" },
            action: "reopen"
        });
        expect(result.success).toBe(true);
        expect(reopenTicket).toHaveBeenCalled();
    });

    test("returns error for missing service / ticket / user / unknown action", async () => {
        expect((await customerSupportTicketDetailPage.changeTicketStatus({})).error.code).toBe("no-ticket-service");

        expect((await customerSupportTicketDetailPage.changeTicketStatus({
            ticketService: { getTicketById: jest.fn() }
        })).error.code).toBe("no-ticket");

        expect((await customerSupportTicketDetailPage.changeTicketStatus({
            ticketService: { getTicketById: jest.fn() },
            ticket: makeTicket()
        })).error.code).toBe("not-signed-in");

        const result = await customerSupportTicketDetailPage.changeTicketStatus({
            ticketService: { getTicketById: jest.fn(), closeTicketByReporter: jest.fn() },
            ticket: makeTicket(),
            currentUser: { uid: "c-1" },
            action: "frobnicate"
        });
        expect(result.error.code).toBe("unknown-action");
    });

    test("wraps thrown service errors", async () => {
        const result = await customerSupportTicketDetailPage.changeTicketStatus({
            ticketService: {
                getTicketById: jest.fn(),
                closeTicketByReporter: jest.fn(async () => { throw new Error("boom"); })
            },
            ticket: makeTicket(),
            currentUser: { uid: "c-1" },
            action: "close"
        });
        expect(result.success).toBe(false);
        expect(result.error.message).toBe("boom");
    });
});

describe("customer/support/ticket-detail.js - init and handlers", () => {
    test("init bails out when no ticketId is supplied or in the query", async () => {
        createDOM();
        window.history.pushState({}, "", "/customer/support/ticket-detail.html");

        const result = await customerSupportTicketDetailPage.init({
            ticketService: { getTicketById: jest.fn(), getTicketReplies: jest.fn() },
            auth: { currentUser: { uid: "c-1" } },
            authFns: makeAuthFns({ uid: "c-1" })
        });

        expect(result.success).toBe(false);
        expect(result.error).toMatch(/No ticket/);
    });

    test("init bails out when the layout is missing", async () => {
        document.body.innerHTML = "";
        const result = await customerSupportTicketDetailPage.init({
            ticketService: { getTicketById: jest.fn() }
        });
        expect(result.success).toBe(false);
    });

    test("init refuses to show a ticket raised from the vendor side", async () => {
        // Regression: a user with the same UID in both portals can navigate to
        // /customer/support/ticket-detail.html?ticketId=<their-vendor-ticket>.
        // The page must treat it as not-found and never reveal subject/description.
        const dom = createDOM();
        window.history.pushState({}, "", "/customer/support/ticket-detail.html?ticketId=ticket-abcdef");

        const vendorTicket = makeTicket({
            reporterUid: "customer-1",
            reporterRole: "vendor",
            subject: "Payouts question",
            description: "Where is my money?"
        });
        const ticketService = {
            getTicketById: jest.fn(async () => vendorTicket),
            getTicketReplies: jest.fn(async () => [])
        };

        const result = await customerSupportTicketDetailPage.init({
            ticketService,
            ticketFormatters: makeFormattersStub(),
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            db: { kind: "db" },
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("not-found");
        // Summary section stays hidden so subject/description never leak.
        expect(dom.summarySection.hasAttribute("hidden")).toBe(true);
        expect(dom.subject.textContent).not.toMatch(/Payouts question/);
        expect(dom.description.textContent).not.toMatch(/Where is my money/);
        expect(dom.statusElement.textContent).toMatch(/could not be found/i);
    });

    test("init renders ticket, replies, and timeline on success", async () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/customer/support/ticket-detail.html?ticketId=ticket-abcdef");

        const ticket = makeTicket({ replyCount: 1 });
        const replies = [
            { replyId: "r-1", body: "Hi", authorRole: "admin", authorName: "Admin", createdAt: "T" }
        ];

        const ticketService = {
            getTicketById: jest.fn(async () => ticket),
            getTicketReplies: jest.fn(async () => replies),
            addReply: jest.fn(),
            closeTicketByReporter: jest.fn(),
            reopenTicket: jest.fn()
        };

        const result = await customerSupportTicketDetailPage.init({
            ticketService,
            ticketFormatters: makeFormattersStub(),
            auth: { currentUser: { uid: "customer-1", displayName: "Naledi" } },
            authFns: makeAuthFns({ uid: "customer-1", displayName: "Naledi" }),
            db: { kind: "db" },
            firestoreFns: {}
        });

        expect(result.success).toBe(true);
        expect(dom.summarySection.hasAttribute("hidden")).toBe(false);
        expect(dom.timelineContainer.querySelectorAll(".ticket-timeline-entry")).toHaveLength(1);
        expect(dom.repliesContainer.querySelectorAll(".ticket-reply-entry")).toHaveLength(1);
        expect(dom.nextAction.textContent).toBe("Next: add details if needed");
        expect(dom.closeButton.hasAttribute("hidden")).toBe(false);
        expect(dom.replyFormSection.hasAttribute("hidden")).toBe(false);
    });

    test("init wires the reply form to call addReply and re-renders on success", async () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/customer/support/ticket-detail.html?ticketId=ticket-abcdef");

        const ticketBefore = makeTicket({ replyCount: 0 });
        const ticketAfter = makeTicket({ replyCount: 1 });

        let callCount = 0;
        const ticketService = {
            getTicketById: jest.fn(async () => {
                callCount += 1;
                return callCount === 1 ? ticketBefore : ticketAfter;
            }),
            getTicketReplies: jest.fn(async () => []),
            addReply: jest.fn(async () => ({ success: true, ticket: ticketAfter, reply: { replyId: "r-1" } }))
        };

        await customerSupportTicketDetailPage.init({
            ticketService,
            ticketFormatters: makeFormattersStub(),
            auth: { currentUser: { uid: "customer-1", displayName: "Naledi" } },
            authFns: makeAuthFns({ uid: "customer-1", displayName: "Naledi" }),
            db: { kind: "db" },
            firestoreFns: {}
        });

        dom.replyBodyInput.value = "Following up";
        dom.replyForm.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        // Let pending microtasks settle.
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(ticketService.addReply).toHaveBeenCalledWith(expect.objectContaining({
            ticket: ticketBefore,
            reply: expect.objectContaining({ body: "Following up", authorRole: "customer" })
        }));
        // Replies counter updates after reload.
        expect(dom.replies.textContent).toBe("1 replies");
        expect(dom.replyBodyInput.value).toBe("");
    });

    test("init wires close button to closeTicketByReporter and updates UI", async () => {
        const dom = createDOM();
        window.history.pushState({}, "", "/customer/support/ticket-detail.html?ticketId=ticket-abcdef");

        const ticketBefore = makeTicket();
        const ticketAfter = makeTicket({ status: "closed" });
        let callCount = 0;
        const ticketService = {
            getTicketById: jest.fn(async () => {
                callCount += 1;
                return callCount === 1 ? ticketBefore : ticketAfter;
            }),
            getTicketReplies: jest.fn(async () => []),
            closeTicketByReporter: jest.fn(async () => ({ success: true, ticket: ticketAfter }))
        };

        await customerSupportTicketDetailPage.init({
            ticketService,
            ticketFormatters: makeFormattersStub(),
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            db: { kind: "db" }
        });

        dom.closeButton.click();
        await new Promise((resolve) => setTimeout(resolve, 0));
        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(ticketService.closeTicketByReporter).toHaveBeenCalled();
        expect(dom.closeButton.hasAttribute("hidden")).toBe(true);
        expect(dom.reopenButton.hasAttribute("hidden")).toBe(false);
        expect(dom.replyFormSection.hasAttribute("hidden")).toBe(true);
    });

    test("attachReplyHandler shows an error when the body is empty without calling the service", async () => {
        const dom = createDOM();
        const ticketService = { addReply: jest.fn() };

        const controller = customerSupportTicketDetailPage.attachReplyHandler(
            {
                replyForm: dom.replyForm,
                replyBodyInput: dom.replyBodyInput,
                replySubmitButton: dom.replySubmitButton,
                replyErrorElement: dom.replyErrorElement,
                statusElement: dom.statusElement
            },
            {
                runtime: () => ({
                    ticketService,
                    ticket: makeTicket(),
                    currentUser: { uid: "c-1" }
                }),
                refresh: jest.fn()
            }
        );

        await controller.handleSubmit({ preventDefault() {} });
        expect(dom.replyErrorElement.textContent).toMatch(/empty/i);
        expect(ticketService.addReply).not.toHaveBeenCalled();
    });

    test("attachReplyHandler returns null on second binding of the same form", () => {
        const dom = createDOM();
        const elements = {
            replyForm: dom.replyForm,
            replyBodyInput: dom.replyBodyInput,
            replySubmitButton: dom.replySubmitButton,
            replyErrorElement: dom.replyErrorElement,
            statusElement: dom.statusElement
        };
        const options = {
            runtime: () => ({}),
            refresh: jest.fn()
        };

        const first = customerSupportTicketDetailPage.attachReplyHandler(elements, options);
        const second = customerSupportTicketDetailPage.attachReplyHandler(elements, options);

        expect(first).not.toBeNull();
        expect(second).toBeNull();
    });

    test("initializeCustomerSupportTicketDetailPage is an alias for init", async () => {
        document.body.innerHTML = "";
        const result = await customerSupportTicketDetailPage.initializeCustomerSupportTicketDetailPage();
        expect(result.success).toBe(false);
    });
});
