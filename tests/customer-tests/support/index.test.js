/**
 * @jest-environment jsdom
 */

const customerSupportListPage = require("../../../public/customer/support/index.js");

function createTicket(overrides = {}) {
    return {
        ticketId: "ticket-1",
        reporterUid: "customer-1",
        reporterRole: "customer",
        subject: "Order never arrived",
        description: "Driver did not show.",
        category: "order_issue",
        status: "open",
        priority: "normal",
        orderId: "order-7",
        replyCount: 0,
        lastReplyAt: null,
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:00:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="customer-support-status"></p>
        <form id="tickets-filter-form">
            <input id="tickets-search" name="search" type="search">
            <select id="tickets-status-filter" name="status">
                <option value="all" selected>All statuses</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
            </select>
            <select id="tickets-category-filter" name="category">
                <option value="all" selected>All categories</option>
                <option value="order_issue">Order Issue</option>
                <option value="refund">Refund</option>
            </select>
            <select id="tickets-sort" name="sort">
                <option value="newest" selected>Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="last-reply">Latest reply</option>
            </select>
            <button type="reset">Clear</button>
        </form>
        <p id="my-tickets-summary"></p>
        <section id="my-tickets-container"></section>
        <nav id="my-tickets-pagination" hidden>
            <p id="tickets-pagination-status"></p>
            <menu>
                <li><button type="button" data-page-action="prev">Previous</button></li>
                <li><button type="button" data-page-action="next">Next</button></li>
            </menu>
        </nav>
    `;

    return {
        statusElement: document.getElementById("customer-support-status"),
        form: document.getElementById("tickets-filter-form"),
        summary: document.getElementById("my-tickets-summary"),
        container: document.getElementById("my-tickets-container"),
        pagination: document.getElementById("my-tickets-pagination"),
        paginationStatus: document.getElementById("tickets-pagination-status")
    };
}

function createTicketStatusStub() {
    return {
        normalizeTicketStatus: jest.fn((status, fallback = "open") => {
            const safe = typeof status === "string" ? status.trim().toLowerCase() : "";
            return safe || fallback;
        }),
        getTicketStatusLabel: jest.fn((status) => {
            const labels = {
                open: "Open",
                in_progress: "In Progress",
                awaiting_user: "Awaiting User",
                resolved: "Resolved",
                closed: "Closed"
            };
            return labels[status] || "Unknown";
        }),
        getTicketStatusTone: jest.fn((status) => {
            const tones = {
                open: "info",
                in_progress: "loading",
                awaiting_user: "info",
                resolved: "success",
                closed: "muted"
            };
            return tones[status] || "info";
        })
    };
}

function createTicketCategoriesStub() {
    return {
        normalizeTicketCategory: jest.fn((category, fallback = "general") => {
            const safe = typeof category === "string" ? category.trim().toLowerCase() : "";
            return safe || fallback;
        }),
        getTicketCategoryLabel: jest.fn((category) => {
            const labels = {
                order_issue: "Order Issue",
                payment: "Payment Issue",
                refund: "Refund Request",
                account: "Account",
                abuse: "Abuse or Safety",
                general: "General"
            };
            return labels[category] || "General";
        }),
        getTicketCategoryTone: jest.fn((category) => {
            const tones = {
                order_issue: "error",
                refund: "warning",
                general: "info"
            };
            return tones[category] || "info";
        })
    };
}

function createTicketFormattersStub() {
    return {
        formatTicketId: jest.fn((id) => `Ticket #${(id || "").slice(-6)}`),
        formatReplyCount: jest.fn((count) =>
            count === 0
                ? "No replies yet"
                : `${count} repl${count === 1 ? "y" : "ies"}`
        ),
        formatRelativeTime: jest.fn((value) =>
            value ? `${value} ago` : ""
        )
    };
}

describe("customer/support/index.js - module surface", () => {
    test("exports the expected API", () => {
        expect(customerSupportListPage.MODULE_NAME).toBe("customer/support/index");
        expect(customerSupportListPage.DEFAULT_PAGE_SIZE).toBe(6);
        expect(customerSupportListPage.DEFAULT_SORT).toBe("newest");

        [
            "init",
            "initializeCustomerSupportListPage",
            "mapTicketRecord",
            "fetchReporterTickets",
            "renderTickets",
            "createTicketCard",
            "sortTickets",
            "filterTickets",
            "paginateTickets",
            "buildResultSummary",
            "buildTicketDetailUrl",
            "setStatusMessage",
            "readFiltersFromForm",
            "renderCurrentPage",
            "attachToolbarHandlers"
        ].forEach((name) => {
            expect(typeof customerSupportListPage[name]).toBe("function");
        });
    });
});

describe("customer/support/index.js - helpers", () => {
    test("normalizeText and normalizeLowerText behave defensively", () => {
        expect(customerSupportListPage.normalizeText("  hi  ")).toBe("hi");
        expect(customerSupportListPage.normalizeText(null)).toBe("");
        expect(customerSupportListPage.normalizeLowerText(" HEY ")).toBe("hey");
    });

    test("getTicketTimestampValue handles strings, numbers, Dates, Firestore timestamps, and bad input", () => {
        expect(customerSupportListPage.getTicketTimestampValue(null)).toBe(0);
        expect(customerSupportListPage.getTicketTimestampValue(1747389600000)).toBe(1747389600000);
        expect(customerSupportListPage.getTicketTimestampValue("2026-05-16T10:00:00Z")).toBeGreaterThan(0);
        expect(customerSupportListPage.getTicketTimestampValue("nope")).toBe(0);

        const date = new Date("2026-05-16T10:00:00Z");
        expect(customerSupportListPage.getTicketTimestampValue(date)).toBe(date.getTime());

        const toMillisShape = { toMillis: () => 12345 };
        expect(customerSupportListPage.getTicketTimestampValue(toMillisShape)).toBe(12345);

        const secondsShape = { seconds: 1747389600 };
        expect(customerSupportListPage.getTicketTimestampValue(secondsShape)).toBe(1747389600000);
    });

    test("mapTicketRecord normalises status, category, replies, and last activity", () => {
        const ticketStatus = createTicketStatusStub();
        const ticketCategories = createTicketCategoriesStub();
        const ticketFormatters = createTicketFormattersStub();

        const mapped = customerSupportListPage.mapTicketRecord(createTicket({
            replyCount: 3,
            lastReplyAt: "2026-05-16T11:00:00Z",
            status: "IN_PROGRESS",
            category: "REFUND"
        }), { ticketStatus, ticketCategories, ticketFormatters });

        expect(mapped.ticketId).toBe("ticket-1");
        expect(mapped.subject).toBe("Order never arrived");
        expect(mapped.statusKey).toBe("in_progress");
        expect(mapped.statusLabel).toBe("In Progress");
        expect(mapped.statusTone).toBe("loading");
        expect(mapped.categoryKey).toBe("refund");
        expect(mapped.categoryLabel).toBe("Refund Request");
        expect(mapped.categoryTone).toBe("warning");
        expect(mapped.replyCount).toBe(3);
        expect(mapped.replyCountText).toBe("3 replies");
        expect(mapped.orderId).toBe("order-7");
        expect(mapped.lastActivityText).toMatch(/ago/);
    });

    test("mapTicketRecord uses sensible defaults when no module stubs are provided", () => {
        const mapped = customerSupportListPage.mapTicketRecord(createTicket({
            subject: "",
            status: "",
            category: ""
        }));

        // Falls back to fabricated ticket id when subject is empty.
        expect(mapped.subject).toMatch(/Ticket #/);
        expect(mapped.statusKey).toBe("open");
        expect(mapped.categoryKey).toBe("general");
        expect(mapped.replyCountText).toBe("No replies yet");
    });

    test("buildTicketDetailUrl appends the ticket ID", () => {
        // jsdom's location.href is mutable via history.pushState so the relative URL resolves.
        window.history.pushState({}, "", "/customer/support/index.html");
        const url = customerSupportListPage.buildTicketDetailUrl("ticket-abc");
        expect(url).toMatch(/ticket-detail\.html\?ticketId=ticket-abc$/);
    });
});

describe("customer/support/index.js - filter, sort, paginate", () => {
    const tickets = [
        {
            ticketId: "t-1",
            subject: "Late delivery",
            status: "open",
            category: "order_issue",
            createdAt: "2026-05-16T10:00:00Z",
            lastReplyAt: "2026-05-16T10:00:00Z"
        },
        {
            ticketId: "t-2",
            subject: "Double charged",
            status: "resolved",
            category: "payment",
            createdAt: "2026-05-15T10:00:00Z",
            lastReplyAt: "2026-05-17T09:00:00Z"
        },
        {
            ticketId: "t-3",
            subject: "Login broken",
            status: "open",
            category: "account",
            orderId: "order-5",
            createdAt: "2026-05-14T10:00:00Z",
            lastReplyAt: "2026-05-14T10:00:00Z"
        }
    ];

    test("filterTickets honours status, category, and search filters", () => {
        expect(customerSupportListPage.filterTickets(tickets, { status: "open" })).toHaveLength(2);
        expect(customerSupportListPage.filterTickets(tickets, { status: "resolved" })).toHaveLength(1);
        expect(customerSupportListPage.filterTickets(tickets, { category: "account" })).toHaveLength(1);
        expect(customerSupportListPage.filterTickets(tickets, { search: "double" })).toHaveLength(1);
        expect(customerSupportListPage.filterTickets(tickets, { search: "T-3" })).toHaveLength(1);
        expect(customerSupportListPage.filterTickets(tickets, { search: "ORDER-5" })).toHaveLength(1);
        expect(customerSupportListPage.filterTickets(tickets, { search: "nomatch" })).toHaveLength(0);
        expect(customerSupportListPage.filterTickets(null)).toEqual([]);
        expect(customerSupportListPage.filterTickets([null, undefined, false])).toEqual([]);
    });

    test("sortTickets supports newest, oldest, and last-reply", () => {
        const newest = customerSupportListPage.sortTickets(tickets, "newest");
        expect(newest.map((t) => t.ticketId)).toEqual(["t-1", "t-2", "t-3"]);

        const oldest = customerSupportListPage.sortTickets(tickets, "oldest");
        expect(oldest.map((t) => t.ticketId)).toEqual(["t-3", "t-2", "t-1"]);

        const lastReply = customerSupportListPage.sortTickets(tickets, "last-reply");
        expect(lastReply[0].ticketId).toBe("t-2");

        expect(customerSupportListPage.sortTickets(null)).toEqual([]);
    });

    test("paginateTickets returns the right page slice and metadata", () => {
        const first = customerSupportListPage.paginateTickets(tickets, 1, 2);
        expect(first.pageTickets.map((t) => t.ticketId)).toEqual(["t-1", "t-2"]);
        expect(first.totalPages).toBe(2);
        expect(first.totalCount).toBe(3);

        const second = customerSupportListPage.paginateTickets(tickets, 2, 2);
        expect(second.pageTickets.map((t) => t.ticketId)).toEqual(["t-3"]);
        expect(second.page).toBe(2);

        // Out-of-range page snaps back to the last page.
        const oob = customerSupportListPage.paginateTickets(tickets, 99, 2);
        expect(oob.page).toBe(2);

        const empty = customerSupportListPage.paginateTickets([], 1, 2);
        expect(empty.totalPages).toBe(1);
        expect(empty.totalCount).toBe(0);
    });

    test("buildResultSummary describes the filtered/total counts", () => {
        expect(customerSupportListPage.buildResultSummary(0, 0)).toBe("");
        expect(customerSupportListPage.buildResultSummary(3, 3)).toBe("Showing all 3 tickets.");
        expect(customerSupportListPage.buildResultSummary(1, 3)).toBe("Showing 1 of 3 tickets.");
        expect(customerSupportListPage.buildResultSummary(1, 1)).toBe("Showing all 1 ticket.");
    });
});

describe("customer/support/index.js - rendering and DOM wiring", () => {
    test("renderTickets shows the empty state when there are no tickets", () => {
        const dom = createDOM();
        customerSupportListPage.renderTickets([], dom.container);
        expect(dom.container.querySelector(".empty-state-message")).not.toBeNull();
    });

    test("renderTickets renders a card per ticket", () => {
        const dom = createDOM();
        const ticketStatus = createTicketStatusStub();
        const ticketCategories = createTicketCategoriesStub();
        const ticketFormatters = createTicketFormattersStub();

        customerSupportListPage.renderTickets(
            [createTicket(), createTicket({ ticketId: "ticket-2", subject: "Refund please" })],
            dom.container,
            { ticketStatus, ticketCategories, ticketFormatters }
        );

        const cards = dom.container.querySelectorAll(".support-ticket-card");
        expect(cards).toHaveLength(2);
        expect(cards[0].getAttribute("data-ticket-id")).toBe("ticket-1");
        expect(cards[0].querySelector(".support-ticket-subject").textContent).toBe("Order never arrived");
        expect(cards[0].querySelector(".support-ticket-status").textContent).toMatch(/Open/);
    });

    test("readFiltersFromForm reflects the current form state", () => {
        const dom = createDOM();
        dom.form.querySelector("#tickets-status-filter").value = "open";
        dom.form.querySelector("#tickets-sort").value = "oldest";

        expect(customerSupportListPage.readFiltersFromForm(dom.form)).toEqual({
            search: "",
            status: "open",
            category: "all",
            sort: "oldest"
        });

        expect(customerSupportListPage.readFiltersFromForm(null)).toBeNull();
    });

    test("setStatusMessage writes message and state", () => {
        const dom = createDOM();
        customerSupportListPage.setStatusMessage(dom.statusElement, "Hi", "success");
        expect(dom.statusElement.textContent).toBe("Hi");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");

        customerSupportListPage.setStatusMessage(null, "noop");
        // Should not throw.
    });
});

describe("customer/support/index.js - init flow", () => {
    function makeAuthFns(currentUser) {
        return {
            onAuthStateChanged: jest.fn((auth, onChange) => {
                onChange(currentUser || null);
                return function unsubscribe() {};
            })
        };
    }

    test("init renders the user's tickets via the service", async () => {
        const dom = createDOM();
        const tickets = [createTicket(), createTicket({ ticketId: "ticket-2", subject: "Refund" })];
        const ticketService = {
            getReporterTickets: jest.fn(async () => tickets)
        };

        const result = await customerSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            firestoreFns: {},
            ticketService,
            ticketStatus: createTicketStatusStub(),
            ticketCategories: createTicketCategoriesStub(),
            ticketFormatters: createTicketFormattersStub()
        });

        expect(result.success).toBe(true);
        expect(ticketService.getReporterTickets).toHaveBeenCalledTimes(1);
        expect(dom.container.querySelectorAll(".support-ticket-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toMatch(/2 tickets/);
        expect(dom.summary.textContent).toMatch(/Showing all 2 tickets/);
    });

    test("init shows a friendly empty-state when there are no tickets", async () => {
        const dom = createDOM();
        const ticketService = { getReporterTickets: jest.fn(async () => []) };

        const result = await customerSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            firestoreFns: {},
            ticketService
        });

        expect(result.success).toBe(true);
        expect(dom.container.querySelector(".empty-state-message")).not.toBeNull();
        expect(dom.statusElement.textContent).toMatch(/have not opened any/i);
    });

    test("init bails out when no user is signed in", async () => {
        const dom = createDOM();
        const ticketService = { getReporterTickets: jest.fn() };

        const result = await customerSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: null },
            authFns: makeAuthFns(null),
            firestoreFns: {},
            ticketService
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toMatch(/sign in/i);
        expect(ticketService.getReporterTickets).not.toHaveBeenCalled();
    });

    test("init surfaces a fetch failure", async () => {
        const dom = createDOM();
        const ticketService = {
            getReporterTickets: jest.fn(async () => { throw new Error("boom"); })
        };

        const result = await customerSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            firestoreFns: {},
            ticketService
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toMatch(/boom|Failed/);
    });

    test("init returns a structured error when the tickets container is missing", async () => {
        document.body.innerHTML = "";

        const result = await customerSupportListPage.init({
            ticketService: { getReporterTickets: jest.fn() }
        });

        expect(result).toEqual({
            success: false,
            error: "Tickets container not found."
        });
    });

    test("attachToolbarHandlers re-renders on filter input and pagination clicks", async () => {
        const dom = createDOM();
        const tickets = Array.from({ length: 8 }, (_, index) => createTicket({
            ticketId: `t-${index + 1}`,
            subject: index % 2 === 0 ? `Late delivery ${index}` : `Refund ${index}`,
            status: index % 2 === 0 ? "open" : "resolved"
        }));

        await customerSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "customer-1" } },
            authFns: makeAuthFns({ uid: "customer-1" }),
            firestoreFns: {},
            ticketService: { getReporterTickets: jest.fn(async () => tickets) },
            ticketStatus: createTicketStatusStub(),
            ticketCategories: createTicketCategoriesStub(),
            ticketFormatters: createTicketFormattersStub(),
            pageSize: 3
        });

        // First page should show 3 cards.
        expect(dom.container.querySelectorAll(".support-ticket-card")).toHaveLength(3);
        expect(dom.pagination.hasAttribute("hidden")).toBe(false);
        expect(dom.paginationStatus.textContent).toMatch(/Page 1 of 3/);

        // Click "Next".
        dom.pagination.querySelector('[data-page-action="next"]').click();
        expect(dom.paginationStatus.textContent).toMatch(/Page 2 of 3/);

        // Apply a status filter via the form.
        dom.form.querySelector("#tickets-status-filter").value = "open";
        dom.form.dispatchEvent(new Event("change", { bubbles: true }));

        const filteredCards = dom.container.querySelectorAll(".support-ticket-card");
        expect(filteredCards.length).toBeGreaterThan(0);
        filteredCards.forEach((card) => {
            expect(card.getAttribute("data-status")).toBe("open");
        });

        // Reset filters.
        dom.form.dispatchEvent(new Event("reset", { bubbles: true }));
        await new Promise((resolve) => setTimeout(resolve, 0));
        expect(dom.container.querySelectorAll(".support-ticket-card")).toHaveLength(3);
    });

    test("initializeCustomerSupportListPage is an alias for init", async () => {
        document.body.innerHTML = "";
        const result = await customerSupportListPage.initializeCustomerSupportListPage({
            ticketService: { getReporterTickets: jest.fn() }
        });
        expect(result.success).toBe(false);
    });
});

describe("customer/support/index.js - fetchReporterTickets", () => {
    test("returns an error when no reporterUid is provided", async () => {
        const result = await customerSupportListPage.fetchReporterTickets({});
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-reporter-uid");
    });

    test("returns an error when no ticket service is available", async () => {
        const result = await customerSupportListPage.fetchReporterTickets({
            reporterUid: "u-1",
            db: { kind: "db" }
        });
        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-ticket-service");
    });

    test("returns tickets via the service when everything is wired", async () => {
        const tickets = [createTicket()];
        const result = await customerSupportListPage.fetchReporterTickets({
            reporterUid: "u-1",
            db: { kind: "db" },
            firestoreFns: {},
            ticketService: { getReporterTickets: jest.fn(async () => tickets) }
        });

        expect(result.success).toBe(true);
        expect(result.tickets).toEqual(tickets);
    });

    test("wraps thrown service errors", async () => {
        const result = await customerSupportListPage.fetchReporterTickets({
            reporterUid: "u-1",
            db: { kind: "db" },
            firestoreFns: {},
            ticketService: {
                getReporterTickets: jest.fn(async () => { throw new Error("boom"); })
            }
        });

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("boom");
    });
});
