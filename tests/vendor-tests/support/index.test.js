/**
 * @jest-environment jsdom
 */

const vendorSupportListPage = require("../../../public/vendor/support/index.js");

function createTicket(overrides = {}) {
    return {
        ticketId: "ticket-v1",
        reporterUid: "vendor-1",
        reporterRole: "vendor",
        subject: "Payouts question",
        description: "Where is my payout?",
        category: "payment",
        status: "open",
        priority: "normal",
        replyCount: 0,
        lastReplyAt: null,
        createdAt: "2026-05-16T10:00:00.000Z",
        updatedAt: "2026-05-16T10:00:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="vendor-support-status"></p>
        <form id="vendor-tickets-filter-form">
            <input id="vendor-tickets-search" name="search" type="search">
            <select id="vendor-tickets-status-filter" name="status">
                <option value="all" selected>All</option>
                <option value="open">Open</option>
                <option value="resolved">Resolved</option>
            </select>
            <select id="vendor-tickets-category-filter" name="category">
                <option value="all" selected>All</option>
                <option value="payment">Payment</option>
            </select>
            <select id="vendor-tickets-sort" name="sort">
                <option value="newest" selected>Newest</option>
                <option value="oldest">Oldest</option>
            </select>
            <button type="reset">Clear</button>
        </form>
        <p id="vendor-tickets-summary"></p>
        <section id="vendor-tickets-container"></section>
        <nav id="vendor-tickets-pagination" hidden>
            <p id="vendor-tickets-pagination-status"></p>
            <menu>
                <li><button type="button" data-page-action="prev">Previous</button></li>
                <li><button type="button" data-page-action="next">Next</button></li>
            </menu>
        </nav>
    `;

    return {
        statusElement: document.getElementById("vendor-support-status"),
        form: document.getElementById("vendor-tickets-filter-form"),
        summary: document.getElementById("vendor-tickets-summary"),
        container: document.getElementById("vendor-tickets-container"),
        pagination: document.getElementById("vendor-tickets-pagination"),
        paginationStatus: document.getElementById("vendor-tickets-pagination-status")
    };
}

function makeStubs() {
    return {
        ticketStatus: {
            normalizeTicketStatus: jest.fn((s, fb = "open") =>
                (typeof s === "string" ? s.trim().toLowerCase() : "") || fb),
            getTicketStatusLabel: jest.fn((s) => ({
                open: "Open", in_progress: "In Progress", resolved: "Resolved", closed: "Closed"
            }[s] || s)),
            getTicketStatusTone: jest.fn(() => "info")
        },
        ticketCategories: {
            normalizeTicketCategory: jest.fn((c, fb = "general") =>
                (typeof c === "string" ? c.trim().toLowerCase() : "") || fb),
            getTicketCategoryLabel: jest.fn((c) => ({ payment: "Payment", general: "General" }[c] || c)),
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

describe("vendor/support/index.js - module surface", () => {
    test("exports the expected API", () => {
        expect(vendorSupportListPage.MODULE_NAME).toBe("vendor/support/index");
        ["init", "initializeVendorSupportListPage", "mapTicketRecord", "fetchReporterTickets",
            "renderTickets", "createTicketCard", "sortTickets", "filterTickets", "paginateTickets",
            "buildTicketDetailUrl", "buildResultSummary", "readFiltersFromForm"
        ].forEach((name) => {
            expect(typeof vendorSupportListPage[name]).toBe("function");
        });
    });
});

describe("vendor/support/index.js - helpers", () => {
    test("normalizeText defensive", () => {
        expect(vendorSupportListPage.normalizeText("  hi  ")).toBe("hi");
        expect(vendorSupportListPage.normalizeText(null)).toBe("");
    });

    test("getTicketTimestampValue handles every shape", () => {
        expect(vendorSupportListPage.getTicketTimestampValue(null)).toBe(0);
        expect(vendorSupportListPage.getTicketTimestampValue("2026-05-16T10:00:00Z")).toBeGreaterThan(0);
        expect(vendorSupportListPage.getTicketTimestampValue("nope")).toBe(0);
        const date = new Date("2026-05-16");
        expect(vendorSupportListPage.getTicketTimestampValue(date)).toBe(date.getTime());
        expect(vendorSupportListPage.getTicketTimestampValue({ toMillis: () => 123 })).toBe(123);
        expect(vendorSupportListPage.getTicketTimestampValue({ seconds: 1 })).toBe(1000);
    });

    test("mapTicketRecord uses stubs and falls back sanely", () => {
        const stubs = makeStubs();
        const mapped = vendorSupportListPage.mapTicketRecord(createTicket({ replyCount: 2 }), stubs);
        expect(mapped.ticketId).toBe("ticket-v1");
        expect(mapped.statusLabel).toBe("Open");
        expect(mapped.categoryLabel).toBe("Payment");
        expect(mapped.replyCountText).toBe("2 replies");

        const bare = vendorSupportListPage.mapTicketRecord(createTicket({ subject: "" }));
        expect(bare.subject).toMatch(/Ticket #/);
    });

    test("buildTicketDetailUrl appends ticketId", () => {
        window.history.pushState({}, "", "/vendor/support/index.html");
        const url = vendorSupportListPage.buildTicketDetailUrl("t-abc");
        expect(url).toMatch(/ticket-detail\.html\?ticketId=t-abc$/);
    });
});

describe("vendor/support/index.js - filter/sort/paginate", () => {
    const tickets = [
        { ticketId: "t-1", subject: "Late payout", status: "open", category: "payment", createdAt: "2026-05-16T10:00:00Z", lastReplyAt: "2026-05-16T10:00:00Z" },
        { ticketId: "t-2", subject: "Refund issue", status: "resolved", category: "refund", createdAt: "2026-05-15T10:00:00Z", lastReplyAt: "2026-05-17T09:00:00Z" }
    ];

    test("filterTickets honours status/category/search", () => {
        expect(vendorSupportListPage.filterTickets(tickets, { status: "open" })).toHaveLength(1);
        expect(vendorSupportListPage.filterTickets(tickets, { category: "refund" })).toHaveLength(1);
        expect(vendorSupportListPage.filterTickets(tickets, { search: "payout" })).toHaveLength(1);
        expect(vendorSupportListPage.filterTickets(null)).toEqual([]);
    });

    test("sortTickets supports newest/oldest/last-reply", () => {
        const newest = vendorSupportListPage.sortTickets(tickets, "newest");
        expect(newest[0].ticketId).toBe("t-1");
        const oldest = vendorSupportListPage.sortTickets(tickets, "oldest");
        expect(oldest[0].ticketId).toBe("t-2");
        const lastReply = vendorSupportListPage.sortTickets(tickets, "last-reply");
        expect(lastReply[0].ticketId).toBe("t-2");
    });

    test("paginateTickets slices and clamps", () => {
        const first = vendorSupportListPage.paginateTickets(tickets, 1, 1);
        expect(first.pageTickets).toHaveLength(1);
        const oob = vendorSupportListPage.paginateTickets(tickets, 99, 1);
        expect(oob.page).toBe(2);
        const empty = vendorSupportListPage.paginateTickets([], 1, 5);
        expect(empty.totalPages).toBe(1);
    });

    test("buildResultSummary phrases counts", () => {
        expect(vendorSupportListPage.buildResultSummary(0, 0)).toBe("");
        expect(vendorSupportListPage.buildResultSummary(2, 2)).toBe("Showing all 2 tickets.");
        expect(vendorSupportListPage.buildResultSummary(1, 2)).toBe("Showing 1 of 2 tickets.");
    });
});

describe("vendor/support/index.js - rendering and init", () => {
    test("renderTickets shows empty state", () => {
        const dom = createDOM();
        vendorSupportListPage.renderTickets([], dom.container);
        expect(dom.container.querySelector(".empty-state-message")).not.toBeNull();
    });

    test("renderTickets creates one card per ticket", () => {
        const dom = createDOM();
        vendorSupportListPage.renderTickets(
            [createTicket(), createTicket({ ticketId: "ticket-v2" })],
            dom.container,
            makeStubs()
        );
        expect(dom.container.querySelectorAll(".vendor-support-ticket-card")).toHaveLength(2);
    });

    test("init renders tickets when service returns data", async () => {
        const dom = createDOM();
        const tickets = [createTicket(), createTicket({ ticketId: "ticket-v2", subject: "Refund" })];
        const ticketService = { getReporterTickets: jest.fn(async () => tickets) };
        const stubs = makeStubs();

        const result = await vendorSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "vendor-1" } },
            authFns: makeAuthFns({ uid: "vendor-1" }),
            ticketService,
            ...stubs
        });

        expect(result.success).toBe(true);
        expect(dom.container.querySelectorAll(".vendor-support-ticket-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toMatch(/2 tickets/);
    });

    test("init flags missing user", async () => {
        createDOM();
        const result = await vendorSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: null },
            authFns: makeAuthFns(null),
            ticketService: { getReporterTickets: jest.fn() }
        });
        expect(result.success).toBe(false);
    });

    test("init returns no-container error when DOM is missing", async () => {
        document.body.innerHTML = "";
        const result = await vendorSupportListPage.init({
            ticketService: { getReporterTickets: jest.fn() }
        });
        expect(result).toEqual({ success: false, error: "Tickets container not found." });
    });

    test("init surfaces a fetch failure", async () => {
        const dom = createDOM();
        const ticketService = { getReporterTickets: jest.fn(async () => { throw new Error("boom"); }) };
        const result = await vendorSupportListPage.init({
            db: { kind: "db" },
            auth: { currentUser: { uid: "vendor-1" } },
            authFns: makeAuthFns({ uid: "vendor-1" }),
            ticketService
        });
        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toMatch(/boom|Failed/);
    });
});

describe("vendor/support/index.js - fetchReporterTickets", () => {
    test("flags missing reporterUid", async () => {
        const r = await vendorSupportListPage.fetchReporterTickets({});
        expect(r.success).toBe(false);
        expect(r.error.code).toBe("no-reporter-uid");
    });

    test("flags missing ticket service", async () => {
        const r = await vendorSupportListPage.fetchReporterTickets({
            reporterUid: "v-1", db: { kind: "db" }
        });
        expect(r.success).toBe(false);
        expect(r.error.code).toBe("no-ticket-service");
    });

    test("returns tickets via the service", async () => {
        const tickets = [createTicket()];
        const r = await vendorSupportListPage.fetchReporterTickets({
            reporterUid: "v-1",
            db: { kind: "db" },
            firestoreFns: {},
            ticketService: { getReporterTickets: jest.fn(async () => tickets) }
        });
        expect(r.success).toBe(true);
        expect(r.tickets).toEqual(tickets);
    });
});
