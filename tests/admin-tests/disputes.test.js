/**
 * @jest-environment jsdom
 */

const adminDisputesPage = require("../../public/admin/disputes.js");

function makeTicket(overrides = {}) {
    return {
        ticketId: "ticket-1",
        reporterUid: "user-1",
        reporterRole: "customer",
        reporterName: "Naledi",
        subject: "Order never arrived",
        description: "Driver did not show.",
        category: "order_issue",
        status: "open",
        priority: "normal",
        orderId: "order-7",
        replyCount: 0,
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:00:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="admin-inbox-status"></p>
        <form id="admin-inbox-filter-form">
            <input id="admin-inbox-search" name="search" type="search">
            <select id="admin-inbox-status-filter" name="status">
                <option value="all" selected>All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
            </select>
            <select id="admin-inbox-category-filter" name="category">
                <option value="all" selected>All</option>
                <option value="order_issue">Order Issue</option>
                <option value="payment">Payment</option>
            </select>
            <select id="admin-inbox-reporter-filter" name="reporterRole">
                <option value="all" selected>All</option>
                <option value="customer">Customers</option>
                <option value="vendor">Vendors</option>
            </select>
            <select id="admin-inbox-sort" name="sort">
                <option value="newest" selected>Newest</option>
                <option value="oldest">Oldest</option>
                <option value="last-reply">Latest reply</option>
                <option value="priority">Priority</option>
            </select>
            <button type="reset">Clear</button>
        </form>
        <p id="admin-inbox-summary"></p>
        <section id="admin-inbox-container"></section>
        <nav id="admin-inbox-pagination" hidden>
            <p id="admin-inbox-pagination-status"></p>
            <menu>
                <li><button type="button" data-page-action="prev">Previous</button></li>
                <li><button type="button" data-page-action="next">Next</button></li>
            </menu>
        </nav>
    `;
    return {
        statusElement: document.getElementById("admin-inbox-status"),
        form: document.getElementById("admin-inbox-filter-form"),
        summary: document.getElementById("admin-inbox-summary"),
        container: document.getElementById("admin-inbox-container"),
        pagination: document.getElementById("admin-inbox-pagination"),
        paginationStatus: document.getElementById("admin-inbox-pagination-status")
    };
}

function makeStubs() {
    return {
        ticketStatus: {
            normalizeTicketStatus: jest.fn((s, fb = "open") =>
                (typeof s === "string" ? s.trim().toLowerCase() : "") || fb),
            getTicketStatusLabel: jest.fn((s) => ({
                open: "Open", in_progress: "In Progress",
                awaiting_user: "Awaiting User", resolved: "Resolved", closed: "Closed"
            }[s] || s)),
            getTicketStatusTone: jest.fn((s) => ({
                open: "info", in_progress: "loading", resolved: "success", closed: "muted"
            }[s] || "info"))
        },
        ticketCategories: {
            normalizeTicketCategory: jest.fn((c, fb = "general") =>
                (typeof c === "string" ? c.trim().toLowerCase() : "") || fb),
            getTicketCategoryLabel: jest.fn((c) => ({
                order_issue: "Order Issue", payment: "Payment",
                refund: "Refund Request", general: "General"
            }[c] || c)),
            getTicketCategoryTone: jest.fn(() => "info")
        },
        ticketFormatters: {
            formatTicketId: jest.fn((id) => `Ticket #${(id || "").slice(-6)}`),
            formatReplyCount: jest.fn((c) => c === 0 ? "No replies yet" : `${c} replies`),
            formatRelativeTime: jest.fn((v) => v ? "moments ago" : "")
        }
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

describe("admin/disputes.js - module surface", () => {
    test("exports the expected API", () => {
        expect(adminDisputesPage.MODULE_NAME).toBe("admin/disputes");
        ["init", "initializeAdminDisputesPage", "mapTicketRecord", "fetchAdminTickets",
            "renderTickets", "createTicketCard", "sortTickets", "filterTickets", "paginateTickets",
            "buildTicketDetailUrl", "buildResultSummary", "readFiltersFromForm"
        ].forEach((name) => expect(typeof adminDisputesPage[name]).toBe("function"));
    });
});

describe("admin/disputes.js - helpers", () => {
    test("normalizeText is defensive", () => {
        expect(adminDisputesPage.normalizeText("  hi  ")).toBe("hi");
        expect(adminDisputesPage.normalizeText(null)).toBe("");
    });

    test("mapTicketRecord pulls reporter info and uses stubs", () => {
        const mapped = adminDisputesPage.mapTicketRecord(
            makeTicket({ reporterRole: "vendor", reporterName: "Shop X", replyCount: 3 }),
            makeStubs()
        );
        expect(mapped.reporterRole).toBe("vendor");
        expect(mapped.reporterName).toBe("Shop X");
        expect(mapped.statusLabel).toBe("Open");
        expect(mapped.categoryLabel).toBe("Order Issue");
        expect(mapped.replyCountText).toBe("3 replies");
    });

    test("buildTicketDetailUrl appends ticketId", () => {
        window.history.pushState({}, "", "/admin/disputes.html");
        const url = adminDisputesPage.buildTicketDetailUrl("ticket-abc");
        expect(url).toMatch(/ticket-detail\.html\?ticketId=ticket-abc$/);
    });
});

describe("admin/disputes.js - filter, sort, paginate", () => {
    const tickets = [
        makeTicket({ ticketId: "t-1", status: "open", category: "order_issue", reporterRole: "customer", createdAt: "2026-05-16T10:00:00Z", lastReplyAt: "2026-05-16T10:00:00Z", priority: "normal" }),
        makeTicket({ ticketId: "t-2", subject: "Refund needed", status: "resolved", category: "refund", reporterRole: "vendor", reporterName: "Shop X", createdAt: "2026-05-15T10:00:00Z", lastReplyAt: "2026-05-17T09:00:00Z", priority: "high" }),
        makeTicket({ ticketId: "t-3", subject: "Login broken", status: "open", category: "account", reporterRole: "customer", reporterName: "Lebo", orderId: "", createdAt: "2026-05-14T10:00:00Z", priority: "normal" })
    ];

    test("filterTickets honours status, category, reporter, and search", () => {
        expect(adminDisputesPage.filterTickets(tickets, { status: "open" })).toHaveLength(2);
        expect(adminDisputesPage.filterTickets(tickets, { category: "refund" })).toHaveLength(1);
        expect(adminDisputesPage.filterTickets(tickets, { reporterRole: "vendor" })).toHaveLength(1);
        expect(adminDisputesPage.filterTickets(tickets, { search: "refund" })).toHaveLength(1);
        expect(adminDisputesPage.filterTickets(tickets, { search: "lebo" })).toHaveLength(1);
        expect(adminDisputesPage.filterTickets(null)).toEqual([]);
    });

    test("sortTickets supports newest/oldest/last-reply/priority", () => {
        const newest = adminDisputesPage.sortTickets(tickets, "newest");
        expect(newest[0].ticketId).toBe("t-1");
        const oldest = adminDisputesPage.sortTickets(tickets, "oldest");
        expect(oldest[0].ticketId).toBe("t-3");
        const lastReply = adminDisputesPage.sortTickets(tickets, "last-reply");
        expect(lastReply[0].ticketId).toBe("t-2");
        const priority = adminDisputesPage.sortTickets(tickets, "priority");
        expect(priority[0].priority).toBe("high");
    });

    test("paginateTickets slices and clamps", () => {
        const first = adminDisputesPage.paginateTickets(tickets, 1, 2);
        expect(first.pageTickets).toHaveLength(2);
        const oob = adminDisputesPage.paginateTickets(tickets, 99, 2);
        expect(oob.page).toBe(2);
    });

    test("buildResultSummary phrases counts", () => {
        expect(adminDisputesPage.buildResultSummary(0, 0)).toBe("");
        expect(adminDisputesPage.buildResultSummary(3, 3)).toBe("Showing all 3 tickets.");
        expect(adminDisputesPage.buildResultSummary(1, 3)).toBe("Showing 1 of 3 tickets.");
    });
});

describe("admin/disputes.js - rendering and init", () => {
    test("renderTickets shows an empty state", () => {
        const dom = createDOM();
        adminDisputesPage.renderTickets([], dom.container);
        expect(dom.container.querySelector(".empty-state-message")).not.toBeNull();
    });

    test("renderTickets creates one card per ticket with reporter role attribute", () => {
        const dom = createDOM();
        adminDisputesPage.renderTickets(
            [makeTicket(), makeTicket({ ticketId: "ticket-2", reporterRole: "vendor", reporterName: "Shop X" })],
            dom.container,
            makeStubs()
        );
        const cards = dom.container.querySelectorAll(".admin-inbox-ticket-card");
        expect(cards).toHaveLength(2);
        expect(cards[0].getAttribute("data-reporter-role")).toBe("customer");
        expect(cards[1].getAttribute("data-reporter-role")).toBe("vendor");
    });

    test("init renders tickets via the service", async () => {
        const dom = createDOM();
        const tickets = [makeTicket(), makeTicket({ ticketId: "ticket-2", reporterRole: "vendor" })];
        const ticketService = { getAdminTickets: jest.fn(async () => tickets) };

        const r = await adminDisputesPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "admin-1" } },
            authFns: makeAuthFns({ uid: "admin-1" }),
            ticketService,
            ...makeStubs()
        });

        expect(r.success).toBe(true);
        expect(dom.container.querySelectorAll(".admin-inbox-ticket-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toMatch(/2 tickets/);
    });

    test("init flags missing user", async () => {
        createDOM();
        const r = await adminDisputesPage.init({
            ticketService: { getAdminTickets: jest.fn() },
            auth: { currentUser: null },
            authFns: makeAuthFns(null)
        });
        expect(r.success).toBe(false);
    });

    test("init returns no-container error when DOM is missing", async () => {
        document.body.innerHTML = "";
        const r = await adminDisputesPage.init({
            ticketService: { getAdminTickets: jest.fn() }
        });
        expect(r).toEqual({ success: false, error: "Inbox container not found." });
    });

    test("init surfaces a fetch failure", async () => {
        const dom = createDOM();
        const ticketService = { getAdminTickets: jest.fn(async () => { throw new Error("boom"); }) };
        const r = await adminDisputesPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "admin-1" } },
            authFns: makeAuthFns({ uid: "admin-1" }),
            ticketService
        });
        expect(r.success).toBe(false);
        expect(dom.statusElement.textContent).toMatch(/boom|Failed/);
    });

    test("attachToolbarHandlers re-renders on filter change", async () => {
        const dom = createDOM();
        const tickets = Array.from({ length: 5 }, (_, i) => makeTicket({
            ticketId: `t-${i}`,
            status: i % 2 === 0 ? "open" : "resolved",
            reporterRole: i % 2 === 0 ? "customer" : "vendor"
        }));
        const ticketService = { getAdminTickets: jest.fn(async () => tickets) };

        await adminDisputesPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "admin-1" } },
            authFns: makeAuthFns({ uid: "admin-1" }),
            ticketService,
            ...makeStubs()
        });

        expect(dom.container.querySelectorAll(".admin-inbox-ticket-card").length).toBeGreaterThan(0);

        dom.form.querySelector("#admin-inbox-reporter-filter").value = "vendor";
        dom.form.dispatchEvent(new Event("change", { bubbles: true }));

        const filteredCards = dom.container.querySelectorAll(".admin-inbox-ticket-card");
        filteredCards.forEach((card) => {
            expect(card.getAttribute("data-reporter-role")).toBe("vendor");
        });
    });
});

describe("admin/disputes.js - fetchAdminTickets", () => {
    test("flags missing service", async () => {
        const r = await adminDisputesPage.fetchAdminTickets({});
        expect(r.success).toBe(false);
        expect(r.error.code).toBe("no-ticket-service");
    });

    test("returns tickets via the service", async () => {
        const tickets = [makeTicket()];
        const r = await adminDisputesPage.fetchAdminTickets({
            db: { kind: "db" },
            ticketService: { getAdminTickets: jest.fn(async () => tickets) }
        });
        expect(r.success).toBe(true);
        expect(r.tickets).toEqual(tickets);
    });

    test("wraps thrown service errors", async () => {
        const r = await adminDisputesPage.fetchAdminTickets({
            db: { kind: "db" },
            ticketService: { getAdminTickets: jest.fn(async () => { throw new Error("boom"); }) }
        });
        expect(r.success).toBe(false);
        expect(r.error.message).toBe("boom");
    });
});
