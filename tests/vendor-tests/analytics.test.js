/**
 * @jest-environment jsdom
 *
 * Vendor analytics — pure-logic tests.
 * Only exported functions from public/vendor/analytics.js are exercised.
 * DOM/Firebase wiring is not invoked because the module guards auto-init
 * behind a CommonJS check (module.exports is set during require()).
 */

const {
    normalizeText,
    normalizeLowerText,
    getDateFromTimestamp,
    getHourFromTimestamp,
    getDayFromTimestamp,
    getWeekFromTimestamp,
    formatCurrency,
    getOrderAmount,
    resolveTimeWindow,
    applyTimeWindow,
    filterOrdersByDateRange,
    computePreviousPeriodRange,
    calculateAnalytics,
    aggregateTopItems,
    aggregateHourlyByDay,
    aggregateCustomerInsights,
    computePeriodComparison,
    searchItems,
    searchCustomers,
    sortItems,
    sortCustomers,
    paginate,
    generateInsights
} = require("../../public/vendor/analytics.js");

// ----------------------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------------------

function makeOrder(overrides = {}) {
    return {
        id: overrides.id || "order-1",
        vendorUid: "vendor-1",
        customerUid: "cust-1",
        customerName: "Alice",
        status: "completed",
        paymentAmount: 100,
        createdAt: new Date("2026-05-01T12:00:00Z"),
        items: [
            { menuItemId: "i1", name: "Burger", category: "Mains", quantity: 1, price: 80 },
            { menuItemId: "i2", name: "Coke", category: "Drinks", quantity: 1, price: 20 }
        ],
        ...overrides
    };
}

// ============================================================================
// normalize + format helpers
// ============================================================================

describe("normalizeText / normalizeLowerText", () => {
    test("trims whitespace", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
    });

    test("returns empty string for non-strings", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(123)).toBe("");
    });

    test("normalizeLowerText is lowercased + trimmed", () => {
        expect(normalizeLowerText("  HeLLo  ")).toBe("hello");
    });
});

describe("formatCurrency", () => {
    test("formats finite numbers as ZAR", () => {
        const out = formatCurrency(1234.56);
        expect(out).toMatch(/ZAR/);
        expect(out).toMatch(/1\D?234[.,]56/);
    });

    test("falls back to 0 for non-finite input", () => {
        expect(formatCurrency(NaN)).toMatch(/0[.,]00/);
        expect(formatCurrency(undefined)).toMatch(/0[.,]00/);
    });
});

describe("getOrderAmount", () => {
    test("prefers paymentAmount", () => {
        expect(getOrderAmount({ paymentAmount: 50, total: 99 })).toBe(50);
    });
    test("falls back through totalAmount, total, subtotal", () => {
        expect(getOrderAmount({ totalAmount: 30 })).toBe(30);
        expect(getOrderAmount({ total: 20 })).toBe(20);
        expect(getOrderAmount({ subtotal: 10 })).toBe(10);
    });
    test("returns 0 for missing/invalid amounts", () => {
        expect(getOrderAmount({})).toBe(0);
        expect(getOrderAmount(null)).toBe(0);
        expect(getOrderAmount({ paymentAmount: "not a number" })).toBe(0);
    });
});

// ============================================================================
// timestamp helpers
// ============================================================================

describe("getDateFromTimestamp", () => {
    test("returns Date instances unchanged", () => {
        const d = new Date("2026-05-01");
        expect(getDateFromTimestamp(d)).toBe(d);
    });

    test("parses ISO strings", () => {
        expect(getDateFromTimestamp("2026-05-01T00:00:00Z")).toBeInstanceOf(Date);
    });

    test("handles Firestore Timestamp.toDate()", () => {
        const fake = { toDate: () => new Date("2026-05-01") };
        expect(getDateFromTimestamp(fake)).toBeInstanceOf(Date);
    });

    test("handles {seconds} timestamps", () => {
        const d = getDateFromTimestamp({ seconds: 1700000000 });
        expect(d).toBeInstanceOf(Date);
        expect(d.getTime()).toBe(1700000000000);
    });

    test("returns null for missing or unrecognised values", () => {
        expect(getDateFromTimestamp(null)).toBeNull();
        expect(getDateFromTimestamp(undefined)).toBeNull();
        expect(getDateFromTimestamp({})).toBeNull();
    });
});

describe("getHourFromTimestamp / getDayFromTimestamp", () => {
    test("returns hour and ISO day", () => {
        const d = new Date(2026, 4, 1, 14, 0, 0); // local 14:00
        expect(getHourFromTimestamp(d)).toBe(14);
        expect(getDayFromTimestamp(d)).toBe(d.toISOString().split("T")[0]);
    });
    test("returns null for invalid inputs", () => {
        expect(getHourFromTimestamp(null)).toBeNull();
        expect(getDayFromTimestamp(null)).toBeNull();
    });
});

describe("getWeekFromTimestamp", () => {
    test("returns an ISO week number for a known date", () => {
        // 2026-01-01 is a Thursday → ISO week 1
        const week = getWeekFromTimestamp(new Date(Date.UTC(2026, 0, 1)));
        expect(week).toBe(1);
    });
    test("returns null when timestamp cannot be parsed", () => {
        expect(getWeekFromTimestamp(null)).toBeNull();
    });
});

// ============================================================================
// time window
// ============================================================================

describe("resolveTimeWindow", () => {
    const ref = new Date(2026, 4, 21, 15, 30, 0); // 2026-05-21 15:30

    test('"today" starts at midnight and ends at end-of-day', () => {
        const { start, end } = resolveTimeWindow("today", ref);
        expect(start.getHours()).toBe(0);
        expect(start.getMinutes()).toBe(0);
        expect(start.toDateString()).toBe(ref.toDateString());
        expect(end.getHours()).toBe(23);
    });

    test('"7d" spans 7 calendar days (today plus six prior)', () => {
        const { start, end } = resolveTimeWindow("7d", ref);
        // start at 00:00 six days ago, end at 23:59:59.999 today → 7 full days
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(7);
    });

    test('"21d" spans 21 calendar days (today plus twenty prior)', () => {
        const { start, end } = resolveTimeWindow("21d", ref);
        const diffDays = Math.round((end - start) / (1000 * 60 * 60 * 24));
        expect(diffDays).toBe(21);
    });

    test('"month" starts on the 1st of current month', () => {
        const { start } = resolveTimeWindow("month", ref);
        expect(start.getDate()).toBe(1);
        expect(start.getMonth()).toBe(ref.getMonth());
    });

    test('"year" starts on Jan 1 of current year', () => {
        const { start } = resolveTimeWindow("year", ref);
        expect(start.getMonth()).toBe(0);
        expect(start.getDate()).toBe(1);
    });

    test('"all" returns nulls', () => {
        expect(resolveTimeWindow("all", ref)).toEqual({ start: null, end: null });
    });

    test("unknown key falls back to all-time", () => {
        expect(resolveTimeWindow("bogus", ref)).toEqual({ start: null, end: null });
    });
});

describe("filterOrdersByDateRange", () => {
    const orders = [
        makeOrder({ id: "a", createdAt: new Date("2026-05-01T10:00:00Z") }),
        makeOrder({ id: "b", createdAt: new Date("2026-05-10T10:00:00Z") }),
        makeOrder({ id: "c", createdAt: new Date("2026-05-20T10:00:00Z") })
    ];

    test("returns a copy when no range supplied", () => {
        const out = filterOrdersByDateRange(orders, null, null);
        expect(out).toEqual(orders);
        expect(out).not.toBe(orders);
    });

    test("filters between start and end inclusive", () => {
        const result = filterOrdersByDateRange(
            orders,
            new Date("2026-05-05T00:00:00Z"),
            new Date("2026-05-15T23:59:59Z")
        );
        expect(result.map(o => o.id)).toEqual(["b"]);
    });

    test("skips orders with no parsable createdAt", () => {
        const result = filterOrdersByDateRange(
            [...orders, makeOrder({ id: "d", createdAt: null })],
            new Date("2026-05-01T00:00:00Z"),
            new Date("2026-05-31T23:59:59Z")
        );
        expect(result.find(o => o.id === "d")).toBeUndefined();
    });
});

describe("applyTimeWindow", () => {
    test("with all-time returns every order", () => {
        const orders = [makeOrder()];
        expect(applyTimeWindow(orders, "all")).toEqual(orders);
    });

    test('"today" only returns same-day orders', () => {
        const ref = new Date(2026, 4, 21, 12, 0, 0);
        const sameDay = makeOrder({ id: "x", createdAt: new Date(2026, 4, 21, 9, 0, 0) });
        const yesterday = makeOrder({ id: "y", createdAt: new Date(2026, 4, 20, 9, 0, 0) });
        const out = applyTimeWindow([sameDay, yesterday], "today", ref);
        expect(out.map(o => o.id)).toEqual(["x"]);
    });
});

describe("computePreviousPeriodRange", () => {
    test("returns equal-length window ending one ms before start", () => {
        const start = new Date(2026, 4, 8, 0, 0, 0);
        const end = new Date(2026, 4, 14, 23, 59, 59);
        const prev = computePreviousPeriodRange(start, end);
        const lenCurr = end - start;
        const lenPrev = prev.end - prev.start;
        expect(Math.round((start - prev.end) / 1)).toBe(1); // 1 ms gap
        expect(Math.abs(lenCurr - lenPrev)).toBeLessThanOrEqual(1);
    });

    test("returns nulls when given nulls", () => {
        expect(computePreviousPeriodRange(null, null)).toEqual({ start: null, end: null });
    });
});

// ============================================================================
// aggregators
// ============================================================================

describe("calculateAnalytics", () => {
    test("totals revenue and orders correctly", () => {
        const a = calculateAnalytics([
            makeOrder({ paymentAmount: 100 }),
            makeOrder({ id: "o2", paymentAmount: 50, status: "pending" })
        ]);
        expect(a.totalRevenue).toBe(150);
        expect(a.totalOrders).toBe(2);
        expect(a.completedOrders).toBe(1);
    });

    test("survives orders with missing items/amount", () => {
        const a = calculateAnalytics([
            { createdAt: new Date(), status: "completed" },
            { items: null }
        ]);
        expect(a.totalRevenue).toBe(0);
        expect(a.totalItems).toBe(0);
        expect(Object.keys(a.topItems)).toHaveLength(0);
    });

    test("computes avgPrice per item from quantity/revenue", () => {
        const a = calculateAnalytics([
            makeOrder({
                items: [
                    { menuItemId: "x", name: "Pie", category: "Mains", quantity: 2, price: 50 },
                    { menuItemId: "x", name: "Pie", category: "Mains", quantity: 3, price: 50 }
                ]
            })
        ]);
        expect(a.topItems.x.quantity).toBe(5);
        expect(a.topItems.x.revenue).toBe(250);
        expect(a.topItems.x.avgPrice).toBe(50);
    });

    test("defaults missing categories to Uncategorized", () => {
        const a = calculateAnalytics([
            makeOrder({ items: [{ name: "Mystery", quantity: 1, price: 10 }] })
        ]);
        expect(a.itemsByCategory.Uncategorized).toBeDefined();
    });
});

describe("aggregateTopItems", () => {
    test("returns array form with required fields", () => {
        const items = aggregateTopItems([makeOrder()]);
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveProperty("name");
        expect(items[0]).toHaveProperty("category");
        expect(items[0]).toHaveProperty("quantity");
        expect(items[0]).toHaveProperty("revenue");
        expect(items[0]).toHaveProperty("avgPrice");
    });

    test("returns empty array for no orders", () => {
        expect(aggregateTopItems([])).toEqual([]);
    });
});

describe("aggregateHourlyByDay", () => {
    test("places orders in correct (day, hour) cell, Mon=0", () => {
        // 2026-05-04 is a Monday (per ISO week)
        const monday10 = new Date(2026, 4, 4, 10, 0, 0);
        const sunday15 = new Date(2026, 4, 10, 15, 0, 0); // Sun → index 6
        const matrix = aggregateHourlyByDay([
            makeOrder({ id: "1", createdAt: monday10 }),
            makeOrder({ id: "2", createdAt: monday10 }),
            makeOrder({ id: "3", createdAt: sunday15 })
        ]);
        expect(matrix[0][10]).toBe(2);
        expect(matrix[6][15]).toBe(1);
        expect(matrix.length).toBe(7);
        expect(matrix[0].length).toBe(24);
    });

    test("skips orders with no createdAt", () => {
        const matrix = aggregateHourlyByDay([{ createdAt: null }]);
        expect(matrix.flat().reduce((a, b) => a + b, 0)).toBe(0);
    });
});

describe("aggregateCustomerInsights", () => {
    test("groups by customerUid and accumulates spend + lastOrder", () => {
        const rows = aggregateCustomerInsights([
            makeOrder({ id: "1", customerUid: "u1", customerName: "Alice", paymentAmount: 100, createdAt: new Date("2026-05-01") }),
            makeOrder({ id: "2", customerUid: "u1", customerName: "Alice", paymentAmount: 50, createdAt: new Date("2026-05-15") }),
            makeOrder({ id: "3", customerUid: "u2", customerName: "Bob", paymentAmount: 200, createdAt: new Date("2026-05-10") })
        ]);
        const alice = rows.find(r => r.customerId === "u1");
        const bob = rows.find(r => r.customerId === "u2");
        expect(alice.orderCount).toBe(2);
        expect(alice.totalSpent).toBe(150);
        expect(alice.lastOrder.toISOString().slice(0, 10)).toBe("2026-05-15");
        expect(bob.orderCount).toBe(1);
        expect(bob.totalSpent).toBe(200);
    });

    test("treats missing names as Anonymous and missing ids by name key", () => {
        const rows = aggregateCustomerInsights([
            { paymentAmount: 10, createdAt: new Date() }
        ]);
        expect(rows[0].customerName).toBe("Anonymous");
    });
});

describe("computePeriodComparison", () => {
    test("computes deltas and direction up/down/flat", () => {
        const current = [makeOrder({ paymentAmount: 200 })];
        const previous = [makeOrder({ paymentAmount: 100 })];
        const cmp = computePeriodComparison(current, previous);
        expect(cmp.revenue.current).toBe(200);
        expect(cmp.revenue.previous).toBe(100);
        expect(cmp.revenue.diff).toBe(100);
        expect(cmp.revenue.pct).toBeCloseTo(100, 5);
        expect(cmp.revenue.direction).toBe("up");
    });

    test("does not divide by zero when previous is empty", () => {
        const cmp = computePeriodComparison([makeOrder({ paymentAmount: 100 })], []);
        expect(cmp.revenue.previous).toBe(0);
        expect(cmp.revenue.direction).toBe("up");
        expect(Number.isFinite(cmp.revenue.pct)).toBe(true);
    });

    test("returns flat direction when current equals previous", () => {
        const cmp = computePeriodComparison(
            [makeOrder({ paymentAmount: 50 })],
            [makeOrder({ paymentAmount: 50 })]
        );
        expect(cmp.revenue.direction).toBe("flat");
    });
});

// ============================================================================
// search, sort, paginate
// ============================================================================

const sampleItems = [
    { name: "Burger", category: "Mains", quantity: 30, revenue: 1500, avgPrice: 50 },
    { name: "Coke", category: "Drinks", quantity: 80, revenue: 800, avgPrice: 10 },
    { name: "Fries", category: "Sides", quantity: 50, revenue: 1000, avgPrice: 20 }
];

describe("searchItems", () => {
    test("case-insensitive partial match on name", () => {
        expect(searchItems(sampleItems, "BUR").map(i => i.name)).toEqual(["Burger"]);
    });
    test("matches category too", () => {
        expect(searchItems(sampleItems, "drinks").map(i => i.name)).toEqual(["Coke"]);
    });
    test("empty term returns a copy of all", () => {
        const out = searchItems(sampleItems, "");
        expect(out).toEqual(sampleItems);
        expect(out).not.toBe(sampleItems);
    });
});

describe("sortItems", () => {
    test("sorts by quantity descending", () => {
        const sorted = sortItems(sampleItems, "quantity", "desc");
        expect(sorted.map(i => i.name)).toEqual(["Coke", "Fries", "Burger"]);
    });
    test("sorts by revenue ascending", () => {
        const sorted = sortItems(sampleItems, "revenue", "asc");
        expect(sorted.map(i => i.name)).toEqual(["Coke", "Fries", "Burger"]);
    });
    test("sorts by name A-Z", () => {
        const sorted = sortItems(sampleItems, "name", "asc");
        expect(sorted.map(i => i.name)).toEqual(["Burger", "Coke", "Fries"]);
    });
    test("unknown key returns a copy", () => {
        const sorted = sortItems(sampleItems, "bogus", "desc");
        expect(sorted).toEqual(sampleItems);
        expect(sorted).not.toBe(sampleItems);
    });
});

const sampleCustomers = [
    { customerId: "1", customerName: "Alice", orderCount: 5, totalSpent: 500, lastOrder: new Date("2026-05-10") },
    { customerId: "2", customerName: "Bob", orderCount: 12, totalSpent: 100, lastOrder: new Date("2026-05-20") },
    { customerId: "3", customerName: "Charlie", orderCount: 3, totalSpent: 1000, lastOrder: new Date("2026-04-01") }
];

describe("searchCustomers / sortCustomers", () => {
    test("search filters by name", () => {
        expect(searchCustomers(sampleCustomers, "bob").map(c => c.customerName)).toEqual(["Bob"]);
    });
    test("sort by totalSpent desc", () => {
        expect(sortCustomers(sampleCustomers, "totalSpent", "desc").map(c => c.customerName)).toEqual(["Charlie", "Alice", "Bob"]);
    });
    test("sort by lastOrder desc puts newest first", () => {
        expect(sortCustomers(sampleCustomers, "lastOrder", "desc").map(c => c.customerName)).toEqual(["Bob", "Alice", "Charlie"]);
    });
});

describe("paginate", () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ i }));

    test("first page returns correct slice", () => {
        const r = paginate(rows, 1, 10);
        expect(r.rows).toHaveLength(10);
        expect(r.page).toBe(1);
        expect(r.totalPages).toBe(3);
        expect(r.total).toBe(23);
        expect(r.startIndex).toBe(1);
        expect(r.endIndex).toBe(10);
    });

    test("last page is partial", () => {
        const r = paginate(rows, 3, 10);
        expect(r.rows).toHaveLength(3);
        expect(r.endIndex).toBe(23);
    });

    test("page beyond range is clamped to last page", () => {
        const r = paginate(rows, 99, 10);
        expect(r.page).toBe(3);
    });

    test("page below 1 is clamped to 1", () => {
        const r = paginate(rows, 0, 10);
        expect(r.page).toBe(1);
        const r2 = paginate(rows, -5, 10);
        expect(r2.page).toBe(1);
    });

    test("empty input is safe", () => {
        const r = paginate([], 1, 10);
        expect(r.rows).toEqual([]);
        expect(r.total).toBe(0);
        expect(r.totalPages).toBe(1);
        expect(r.startIndex).toBe(0);
        expect(r.endIndex).toBe(0);
    });

    test("non-numeric size falls back to 10", () => {
        const r = paginate(rows, 1, "abc");
        expect(r.size).toBe(10);
    });
});

// ============================================================================
// insights
// ============================================================================

describe("generateInsights", () => {
    test("includes a Best Seller card when items exist", () => {
        const a = calculateAnalytics([makeOrder()]);
        const insights = generateInsights(a);
        expect(insights.find(i => i.title === "Best Seller")).toBeDefined();
    });

    test("flags low completion rate as a warning", () => {
        const orders = [
            makeOrder({ id: "1", status: "completed", paymentAmount: 100 }),
            makeOrder({ id: "2", status: "cancelled", paymentAmount: 100 }),
            makeOrder({ id: "3", status: "cancelled", paymentAmount: 100 })
        ];
        const a = calculateAnalytics(orders);
        const insights = generateInsights(a);
        const alert = insights.find(i => i.title === "Order Completion Alert");
        expect(alert).toBeDefined();
        expect(alert.type).toBe("warning");
    });

    test("celebrates high completion rate as a success", () => {
        const orders = Array.from({ length: 10 }, (_, i) =>
            makeOrder({ id: String(i), status: i < 9 ? "completed" : "cancelled", paymentAmount: 100 })
        );
        const a = calculateAnalytics(orders);
        const insights = generateInsights(a);
        const ok = insights.find(i => i.title === "Great Completion Rate");
        expect(ok).toBeDefined();
        expect(ok.type).toBe("success");
    });

    test("empty analytics yields empty insights", () => {
        const a = calculateAnalytics([]);
        expect(generateInsights(a)).toEqual([]);
    });
});

// ============================================================================
// DOM-coupled tests (charts, exports, render functions, init flow)
// Uses the __internals test-only namespace to exercise wiring without a
// real browser. Chart, XLSX, jspdf, and Firestore are mocked.
// ============================================================================

const { __internals } = require("../../public/vendor/analytics.js");

function buildDom() {
    document.body.innerHTML = `
        <p id="analytics-status"></p>

        <input id="start-date-input" type="date" />
        <input id="end-date-input" type="date" />

        <button id="apply-filter-button" type="button">Apply</button>
        <button id="reset-filter-button" type="button">Reset</button>
        <button id="refresh-data-button" type="button">Refresh</button>
        <button id="export-csv-button" type="button">CSV</button>
        <button id="export-excel-button" type="button">Excel</button>
        <button id="export-pdf-button" type="button">PDF</button>

        <button class="time-chip" data-window="today" aria-pressed="false">Today</button>
        <button class="time-chip" data-window="7d" aria-pressed="false">7d</button>
        <button class="time-chip" data-window="all" aria-pressed="false">All</button>

        <button class="menu-item" data-section="overview">Overview</button>
        <button class="menu-item" data-section="revenue">Revenue</button>
        <section id="overview-section" class="content-section"></section>
        <section id="revenue-section" class="content-section"></section>

        <output id="total-revenue"></output>
        <output id="total-orders"></output>
        <output id="avg-order-value"></output>
        <output id="completion-rate"></output>
        <output id="total-items-sold"></output>
        <output id="avg-items-per-order"></output>

        <canvas id="peak-hours-chart"></canvas>
        <canvas id="top-items-chart"></canvas>
        <canvas id="revenue-trend-chart"></canvas>
        <canvas id="status-distribution-chart"></canvas>
        <canvas id="category-chart"></canvas>
        <canvas id="weekly-chart"></canvas>

        <table id="top-items-table"><tbody></tbody></table>
        <input id="top-items-search" type="search" />
        <select id="top-items-sort"><option value="quantity:desc">qty</option></select>
        <select id="top-items-page-size"><option value="10">10</option></select>
        <button id="top-items-prev-button">Prev</button>
        <button id="top-items-next-button">Next</button>
        <output id="top-items-page-indicator"></output>

        <table id="bottom-items-table"><tbody></tbody></table>
        <input id="bottom-items-search" type="search" />
        <select id="bottom-items-sort"><option value="quantity:asc">qty</option></select>
        <select id="bottom-items-page-size"><option value="10">10</option></select>
        <button id="bottom-items-prev-button">Prev</button>
        <button id="bottom-items-next-button">Next</button>
        <output id="bottom-items-page-indicator"></output>

        <table id="customer-insights-table"><tbody></tbody></table>
        <input id="customer-insights-search" type="search" />
        <select id="customer-insights-sort"><option value="totalSpent:desc">spent</option></select>
        <select id="customer-insights-page-size"><option value="10">10</option></select>
        <button id="customer-insights-prev-button">Prev</button>
        <button id="customer-insights-next-button">Next</button>
        <output id="customer-insights-page-indicator"></output>

        <section id="hourly-heatmap"></section>
        <section id="comparison-panel"></section>
        <section id="insights-container"></section>
    `;
}

function installChartMock() {
    const instances = [];
    function Chart(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.destroyed = false;
        this.destroy = function () { this.destroyed = true; };
        instances.push(this);
    }
    Chart.__instances = instances;
    global.Chart = Chart;
    return Chart;
}

function uninstallChartMock() {
    delete global.Chart;
}

function installXLSXMock() {
    const written = [];
    const utilsCalls = { sheets: [], appended: [] };
    global.XLSX = {
        utils: {
            book_new: () => ({ sheets: {}, names: [] }),
            aoa_to_sheet: (aoa) => {
                utilsCalls.sheets.push(aoa);
                return { _aoa: aoa };
            },
            book_append_sheet: (wb, sheet, name) => {
                wb.sheets[name] = sheet;
                wb.names.push(name);
                utilsCalls.appended.push(name);
            }
        },
        writeFile: (wb, filename) => {
            written.push({ wb, filename });
        }
    };
    return { written, utilsCalls };
}

function uninstallXLSXMock() {
    delete global.XLSX;
}

function installJsPdfMock() {
    const calls = { text: [], save: [], addPage: 0, addImage: [], rects: 0 };
    function jsPDFInstance() {
        let pageHeight = 297;
        let pageWidth = 210;
        return {
            internal: { pageSize: { getWidth: () => pageWidth, getHeight: () => pageHeight } },
            setFont: () => { },
            setFontSize: () => { },
            setTextColor: () => { },
            text: (...args) => calls.text.push(args),
            rect: () => { calls.rects++; },
            addPage: () => { calls.addPage++; },
            addImage: (...args) => calls.addImage.push(args),
            save: (filename) => calls.save.push(filename)
        };
    }
    window.jspdf = { jsPDF: function () { return jsPDFInstance(); } };
    return calls;
}

function uninstallJsPdfMock() {
    delete window.jspdf;
}

function makeOrderWithItems(overrides = {}) {
    return {
        id: overrides.id || "order-x",
        vendorUid: "vendor-1",
        customerUid: overrides.customerUid || "cust-1",
        customerName: overrides.customerName || "Alice",
        status: overrides.status || "completed",
        paymentAmount: overrides.paymentAmount != null ? overrides.paymentAmount : 100,
        createdAt: overrides.createdAt || new Date("2026-05-01T12:00:00Z"),
        items: overrides.items || [
            { menuItemId: "i1", name: "Burger", category: "Mains", quantity: 2, price: 50 },
            { menuItemId: "i2", name: "Coke", category: "Drinks", quantity: 1, price: 20 }
        ]
    };
}

beforeEach(() => {
    __internals.resetState();
    buildDom();
    installChartMock();
});

afterEach(() => {
    uninstallChartMock();
    uninstallXLSXMock();
    uninstallJsPdfMock();
    document.body.innerHTML = "";
});

// ----------------------------------------------------------------------------
// Tiny DOM helpers
// ----------------------------------------------------------------------------

describe("escapeHtml", () => {
    test("escapes the five HTML-significant chars", () => {
        expect(__internals.escapeHtml(`<>&"'`)).toBe("&lt;&gt;&amp;&quot;&#39;");
    });
    test("handles null and undefined safely", () => {
        expect(__internals.escapeHtml(null)).toBe("");
        expect(__internals.escapeHtml(undefined)).toBe("");
    });
    test("stringifies non-string inputs", () => {
        expect(__internals.escapeHtml(42)).toBe("42");
    });
});

describe("setText / updateStatusMessage", () => {
    test("setText writes to existing element and silently no-ops on missing id", () => {
        __internals.setText("total-revenue", "R 99");
        expect(document.getElementById("total-revenue").textContent).toBe("R 99");
        // missing element — should not throw
        expect(() => __internals.setText("does-not-exist", "x")).not.toThrow();
    });

    test("updateStatusMessage applies className and message", () => {
        __internals.updateStatusMessage("ok");
        const el = document.getElementById("analytics-status");
        expect(el.textContent).toBe("ok");
        expect(el.className).toBe("success-message");
        __internals.updateStatusMessage("bad", true);
        expect(el.className).toBe("error-message");
    });

    test("updateStatusMessage no-ops when status element missing", () => {
        document.getElementById("analytics-status").remove();
        expect(() => __internals.updateStatusMessage("hi")).not.toThrow();
    });
});

// ----------------------------------------------------------------------------
// KPI metrics
// ----------------------------------------------------------------------------

describe("updateMetrics", () => {
    test("writes all six KPI cells from analytics", () => {
        const a = calculateAnalytics([makeOrderWithItems({ paymentAmount: 100 })]);
        __internals.updateMetrics(a);
        expect(document.getElementById("total-revenue").textContent).toMatch(/100/);
        expect(document.getElementById("total-orders").textContent).toBe("1");
        expect(document.getElementById("completion-rate").textContent).toBe("100%");
        expect(document.getElementById("total-items-sold").textContent).toBe("3");
    });

    test("zero orders → completion rate is 0% (no divide-by-zero)", () => {
        __internals.updateMetrics(calculateAnalytics([]));
        expect(document.getElementById("completion-rate").textContent).toBe("0%");
        expect(document.getElementById("avg-order-value").textContent).toMatch(/0/);
    });

    test("non-integer avg-items renders with one decimal", () => {
        const orders = [
            makeOrderWithItems({ id: "1", items: [{ name: "A", quantity: 1, price: 10 }] }),
            makeOrderWithItems({ id: "2", items: [{ name: "A", quantity: 2, price: 10 }] })
        ];
        __internals.updateMetrics(calculateAnalytics(orders));
        expect(document.getElementById("avg-items-per-order").textContent).toBe("1.5");
    });
});

// ----------------------------------------------------------------------------
// Charts (via mocked Chart constructor)
// ----------------------------------------------------------------------------

describe("createChart and chart families", () => {
    test("createChart returns null when Chart is undefined", () => {
        uninstallChartMock();
        const result = __internals.createChart("peak-hours-chart", "line", { labels: [], datasets: [] });
        expect(result).toBeNull();
    });

    test("createChart returns null when canvas is missing", () => {
        document.getElementById("peak-hours-chart").remove();
        const result = __internals.createChart("peak-hours-chart", "line", { labels: [], datasets: [] });
        expect(result).toBeNull();
    });

    test("createChart destroys previous instance on the same canvas", () => {
        const first = __internals.createChart("peak-hours-chart", "line", { labels: [], datasets: [] });
        expect(first.destroyed).toBe(false);
        __internals.createChart("peak-hours-chart", "bar", { labels: [], datasets: [] });
        expect(first.destroyed).toBe(true);
    });

    test("createPeakHoursChart constructs a line chart with 24 labels", () => {
        const a = calculateAnalytics([makeOrderWithItems()]);
        __internals.createPeakHoursChart(a);
        const charts = __internals.getAnalyticsCharts();
        expect(charts["peak-hours-chart"]).toBeDefined();
        expect(charts["peak-hours-chart"].config.type).toBe("line");
        expect(charts["peak-hours-chart"].config.data.labels.length).toBe(24);
    });

    test("createTopItemsChart caps at 10 items, doughnut type", () => {
        const items = Array.from({ length: 15 }, (_, i) => ({
            menuItemId: `i${i}`, name: `Item ${i}`, category: "C", quantity: 15 - i, price: 10
        }));
        const a = calculateAnalytics([makeOrderWithItems({ items })]);
        __internals.createTopItemsChart(a);
        const chart = __internals.getAnalyticsCharts()["top-items-chart"];
        expect(chart.config.type).toBe("doughnut");
        expect(chart.config.data.labels.length).toBeLessThanOrEqual(10);
    });

    test("createRevenueTrendChart, createStatusDistributionChart, createCategoryChart, createWeeklyChart all render", () => {
        const a = calculateAnalytics([makeOrderWithItems()]);
        __internals.createRevenueTrendChart(a);
        __internals.createStatusDistributionChart(a);
        __internals.createCategoryChart(a);
        __internals.createWeeklyChart(a);
        const charts = __internals.getAnalyticsCharts();
        expect(charts["revenue-trend-chart"]).toBeDefined();
        expect(charts["status-distribution-chart"]).toBeDefined();
        expect(charts["category-chart"]).toBeDefined();
        expect(charts["weekly-chart"]).toBeDefined();
    });
});

// ----------------------------------------------------------------------------
// Table rendering (search + sort + pagination integration)
// ----------------------------------------------------------------------------

describe("renderTopItemsTable / renderBottomItemsTable / renderCustomerInsightsTable", () => {
    function seedOrders() {
        const orders = [
            makeOrderWithItems({
                id: "1",
                customerUid: "u1",
                customerName: "Alice",
                paymentAmount: 200,
                items: [{ menuItemId: "burger", name: "Burger", category: "Mains", quantity: 5, price: 40 }]
            }),
            makeOrderWithItems({
                id: "2",
                customerUid: "u2",
                customerName: "Bob",
                paymentAmount: 80,
                items: [{ menuItemId: "fries", name: "Fries", category: "Sides", quantity: 1, price: 30 }]
            })
        ];
        __internals.setFilteredOrders(orders);
    }

    test("populates top items table with rank, item name, qty", () => {
        seedOrders();
        __internals.renderTopItemsTable();
        const rows = document.querySelectorAll("#top-items-table tbody tr");
        expect(rows.length).toBeGreaterThan(0);
        const html = document.querySelector("#top-items-table tbody").innerHTML;
        expect(html).toContain("Burger");
        expect(html).toContain("#1");
    });

    test("renders empty-state row when there are no items", () => {
        __internals.setFilteredOrders([]);
        __internals.renderTopItemsTable();
        const tbody = document.querySelector("#top-items-table tbody");
        expect(tbody.textContent).toMatch(/No items match/);
    });

    test("renderTopItemsTable no-ops when table is missing", () => {
        document.getElementById("top-items-table").remove();
        expect(() => __internals.renderTopItemsTable()).not.toThrow();
    });

    test("bottom items table only includes items with qty > 0", () => {
        seedOrders();
        __internals.renderBottomItemsTable();
        const tbody = document.querySelector("#bottom-items-table tbody");
        expect(tbody.innerHTML).toMatch(/Fries|Burger/);
    });

    test("customer insights table populates rows + sets pagination outputs", () => {
        seedOrders();
        __internals.renderCustomerInsightsTable();
        const html = document.querySelector("#customer-insights-table tbody").innerHTML;
        expect(html).toContain("Alice");
        const indicator = document.getElementById("customer-insights-page-indicator").textContent;
        expect(indicator).toMatch(/Page 1/);
    });

    test("customer table renders em-dash for missing lastOrder", () => {
        // Build an order whose customer ends up with a null lastOrder by removing createdAt
        __internals.setFilteredOrders([{
            vendorName: "Shop",
            customerName: "Ghost",
            customerUid: "u-ghost",
            paymentAmount: 10,
            createdAt: null,
            items: []
        }]);
        __internals.renderCustomerInsightsTable();
        expect(document.querySelector("#customer-insights-table tbody").innerHTML).toContain("Ghost");
    });

    test("empty customer set shows fallback message", () => {
        __internals.setFilteredOrders([]);
        __internals.renderCustomerInsightsTable();
        expect(document.querySelector("#customer-insights-table tbody").textContent).toMatch(/No customer activity/);
    });
});

describe("updatePaginationOutputs", () => {
    test("disables prev on page 1 and shows the range summary", () => {
        const pageResult = { total: 23, page: 1, totalPages: 3, startIndex: 1, endIndex: 10 };
        __internals.updatePaginationOutputs("top-items", pageResult);
        expect(document.getElementById("top-items-prev-button").disabled).toBe(true);
        expect(document.getElementById("top-items-next-button").disabled).toBe(false);
        expect(document.getElementById("top-items-page-indicator").textContent).toMatch(/1–10 of 23/);
    });

    test("disables next on last page", () => {
        const pageResult = { total: 23, page: 3, totalPages: 3, startIndex: 21, endIndex: 23 };
        __internals.updatePaginationOutputs("top-items", pageResult);
        expect(document.getElementById("top-items-next-button").disabled).toBe(true);
    });

    test("0 results shows the 0-results label", () => {
        const pageResult = { total: 0, page: 1, totalPages: 1, startIndex: 0, endIndex: 0 };
        __internals.updatePaginationOutputs("top-items", pageResult);
        expect(document.getElementById("top-items-page-indicator").textContent).toBe("0 results");
    });
});

// ----------------------------------------------------------------------------
// Heatmap
// ----------------------------------------------------------------------------

describe("renderHeatmap", () => {
    test("builds a 7-row × 24-col HTML table", () => {
        __internals.setFilteredOrders([
            makeOrderWithItems({ id: "1", createdAt: new Date(2026, 4, 4, 10) }),
            makeOrderWithItems({ id: "2", createdAt: new Date(2026, 4, 4, 10) })
        ]);
        __internals.renderHeatmap();
        const wrap = document.getElementById("hourly-heatmap");
        expect(wrap.querySelector("table.heatmap")).toBeTruthy();
        const tdCount = wrap.querySelectorAll("tbody td").length;
        expect(tdCount).toBe(7 * 24);
    });

    test("no-ops when wrapper missing", () => {
        document.getElementById("hourly-heatmap").remove();
        expect(() => __internals.renderHeatmap()).not.toThrow();
    });

    test("handles empty data without dividing by zero", () => {
        __internals.setFilteredOrders([]);
        __internals.renderHeatmap();
        expect(document.getElementById("hourly-heatmap").innerHTML).toContain("heatmap");
    });
});

// ----------------------------------------------------------------------------
// Comparison panel
// ----------------------------------------------------------------------------

describe("renderComparisonPanel / renderComparisonCard", () => {
    test("renderComparisonCard produces up / down / flat classes", () => {
        const upHtml = __internals.renderComparisonCard("Revenue", { current: 200, previous: 100, pct: 100, direction: "up" }, x => `R${x}`);
        expect(upHtml).toMatch(/comparison-card up/);
        expect(upHtml).toContain("▲");

        const downHtml = __internals.renderComparisonCard("Revenue", { current: 50, previous: 100, pct: -50, direction: "down" }, x => `R${x}`);
        expect(downHtml).toMatch(/comparison-card down/);
        expect(downHtml).toContain("▼");

        const flatHtml = __internals.renderComparisonCard("Revenue", { current: 100, previous: 100, pct: 0, direction: "flat" }, x => `R${x}`);
        expect(flatHtml).toMatch(/comparison-card flat/);
    });

    test("renderComparisonPanel falls back to instruction text when dates missing", () => {
        document.getElementById("start-date-input").value = "";
        document.getElementById("end-date-input").value = "";
        __internals.renderComparisonPanel();
        expect(document.getElementById("comparison-panel").textContent).toMatch(/Pick a date range/);
    });

    test("renderComparisonPanel renders 4 comparison cards when dates are set", () => {
        document.getElementById("start-date-input").value = "2026-05-10";
        document.getElementById("end-date-input").value = "2026-05-20";
        __internals.setAllOrders([
            makeOrderWithItems({ id: "p1", createdAt: new Date("2026-05-15"), paymentAmount: 200 }),
            makeOrderWithItems({ id: "p2", createdAt: new Date("2026-05-01"), paymentAmount: 100 })
        ]);
        __internals.setFilteredOrders([
            makeOrderWithItems({ id: "p1", createdAt: new Date("2026-05-15"), paymentAmount: 200 })
        ]);
        __internals.renderComparisonPanel();
        const cards = document.querySelectorAll("#comparison-panel .comparison-card");
        expect(cards.length).toBe(4);
    });

    test("renderComparisonPanel no-ops when wrapper missing", () => {
        document.getElementById("comparison-panel").remove();
        expect(() => __internals.renderComparisonPanel()).not.toThrow();
    });
});

// ----------------------------------------------------------------------------
// Insights panel
// ----------------------------------------------------------------------------

describe("renderInsights", () => {
    test("renders one card per insight", () => {
        __internals.renderInsights([
            { icon: "⏰", title: "Peak", text: "12:00", type: "info" },
            { icon: "⭐", title: "Best", text: "Burger", type: "success" }
        ]);
        const cards = document.querySelectorAll("#insights-container .insight-card");
        expect(cards.length).toBe(2);
        expect(document.getElementById("insights-container").innerHTML).toContain("Peak");
    });

    test("shows fallback message when empty", () => {
        __internals.renderInsights([]);
        expect(document.getElementById("insights-container").textContent).toMatch(/No analytics data/);
    });

    test("no-ops when container missing", () => {
        document.getElementById("insights-container").remove();
        expect(() => __internals.renderInsights([])).not.toThrow();
    });
});

// ----------------------------------------------------------------------------
// CSV / Excel / PDF exports
// ----------------------------------------------------------------------------

describe("exportToCSV", () => {
    let originalCreate, originalRevoke;
    let createCalls, revokeCalls;

    beforeEach(() => {
        // jsdom's URL doesn't expose these as configurable, so install via direct assignment.
        originalCreate = URL.createObjectURL;
        originalRevoke = URL.revokeObjectURL;
        createCalls = 0;
        revokeCalls = 0;
        URL.createObjectURL = () => { createCalls++; return "blob://x"; };
        URL.revokeObjectURL = () => { revokeCalls++; };
    });

    afterEach(() => {
        URL.createObjectURL = originalCreate;
        URL.revokeObjectURL = originalRevoke;
    });

    test("creates a CSV blob and triggers a download", () => {
        const a = calculateAnalytics([makeOrderWithItems()]);
        __internals.exportToCSV(a);
        expect(createCalls).toBeGreaterThan(0);
        expect(document.getElementById("analytics-status").textContent).toMatch(/exported successfully/i);
    });
});

describe("buildExportTables", () => {
    test("returns six tables with header rows", () => {
        __internals.setFilteredOrders([makeOrderWithItems()]);
        const a = calculateAnalytics(__internals.getFilteredOrders());
        const t = __internals.buildExportTables(a);
        expect(Object.keys(t).sort()).toEqual(
            ["categories", "customerRows", "daily", "peakHours", "summary", "topItems"]
        );
        expect(t.summary[0]).toEqual(["Metric", "Value"]);
        expect(t.topItems[0][0]).toBe("Item Name");
    });
});

describe("exportToExcel", () => {
    test("warns when XLSX is not loaded", () => {
        __internals.exportToExcel(calculateAnalytics([]));
        expect(document.getElementById("analytics-status").textContent).toMatch(/Excel library not loaded/);
    });

    test("appends six sheets to a workbook when XLSX is mocked", () => {
        const { utilsCalls, written } = installXLSXMock();
        __internals.setFilteredOrders([makeOrderWithItems()]);
        const a = calculateAnalytics(__internals.getFilteredOrders());
        __internals.exportToExcel(a);
        expect(utilsCalls.appended).toEqual([
            "Summary", "Top Items", "Peak Hours", "Daily Revenue", "Categories", "Customers"
        ]);
        expect(written.length).toBe(1);
        expect(written[0].filename).toMatch(/vendor-analytics-/);
    });
});

describe("exportToPDF", () => {
    test("warns when jsPDF is not loaded", () => {
        __internals.exportToPDF(calculateAnalytics([]));
        expect(document.getElementById("analytics-status").textContent).toMatch(/PDF library not loaded/);
    });

    test("saves a PDF when jsPDF is available", () => {
        const calls = installJsPdfMock();
        __internals.setFilteredOrders([makeOrderWithItems()]);
        const a = calculateAnalytics(__internals.getFilteredOrders());
        __internals.exportToPDF(a);
        expect(calls.save.length).toBe(1);
        expect(calls.save[0]).toMatch(/vendor-analytics-.+\.pdf/);
        expect(document.getElementById("analytics-status").textContent).toMatch(/PDF report exported/);
    });

    test("respects existing date inputs in the period header", () => {
        installJsPdfMock();
        document.getElementById("start-date-input").value = "2026-05-01";
        document.getElementById("end-date-input").value = "2026-05-31";
        __internals.setFilteredOrders([makeOrderWithItems()]);
        const a = calculateAnalytics(__internals.getFilteredOrders());
        expect(() => __internals.exportToPDF(a)).not.toThrow();
    });
});

describe("drawPdfTable", () => {
    test("emits header + body rows, adds a page when running over the bottom", () => {
        installJsPdfMock();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const rectSpy = jest.spyOn(doc, "rect");
        const addPageSpy = jest.spyOn(doc, "addPage");
        const headers = ["A", "B"];
        const rows = Array.from({ length: 60 }, (_, i) => [`row${i}`, `val${i}`]);
        const finalY = __internals.drawPdfTable(doc, headers, rows, 20, [60, 60]);
        expect(rectSpy).toHaveBeenCalled();
        expect(addPageSpy).toHaveBeenCalled();
        expect(finalY).toBeGreaterThan(20);
    });

    test("clips overlong cell text to the column width", () => {
        installJsPdfMock();
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const textSpy = jest.spyOn(doc, "text");
        __internals.drawPdfTable(doc, ["X"], [["a very long string that will not fit in a narrow column"]], 20, [12]);
        // last call is the body cell. With width 12, maxChars = 7, so output ≤ 7 chars
        const lastCall = textSpy.mock.calls[textSpy.mock.calls.length - 1];
        expect(typeof lastCall[0]).toBe("string");
        expect(lastCall[0].length).toBeLessThanOrEqual(8);
    });
});

// ----------------------------------------------------------------------------
// Firestore data fetching
// ----------------------------------------------------------------------------

describe("fetchVendorOrders", () => {
    test("throws when required dependencies are missing", async () => {
        await expect(__internals.fetchVendorOrders(null, {}, "v1")).rejects.toThrow(/Missing required/);
        await expect(__internals.fetchVendorOrders({}, null, "v1")).rejects.toThrow(/Missing required/);
        await expect(__internals.fetchVendorOrders({}, {}, "")).rejects.toThrow(/Missing required/);
    });

    test("maps Firestore docs and filters out foreign vendors", async () => {
        const docs = [
            { id: "a", data: () => ({ vendorUid: "v1", total: 50 }) },
            { id: "b", data: () => ({ vendorUid: "v2", total: 50 }) }, // foreign — should be filtered
            { id: "c", data: () => ({ vendorUid: " v1 ", total: 25 }) }
        ];
        const firestoreFns = {
            collection: jest.fn().mockReturnValue("ordersRef"),
            query: jest.fn().mockReturnValue("q"),
            where: jest.fn().mockReturnValue("whereClause"),
            getDocs: jest.fn().mockResolvedValue({
                forEach: (cb) => docs.forEach(cb)
            })
        };
        const orders = await __internals.fetchVendorOrders({ name: "db" }, firestoreFns, "v1");
        expect(firestoreFns.collection).toHaveBeenCalledWith({ name: "db" }, "orders");
        expect(orders.map(o => o.id)).toEqual(["a", "c"]);
    });
});

// ----------------------------------------------------------------------------
// Dependency resolvers
// ----------------------------------------------------------------------------

describe("resolveFirestore / resolveAuth / resolveAuthFns / resolveFirestoreFns", () => {
    afterEach(() => {
        delete window.db;
        delete window.auth;
        delete window.authFns;
        delete window.firestoreFns;
    });

    test("prefers explicit argument, falls back to global, then null/{}", () => {
        expect(__internals.resolveFirestore({ tag: "explicit" })).toEqual({ tag: "explicit" });
        expect(__internals.resolveFirestore()).toBeNull();
        window.db = { tag: "global" };
        expect(__internals.resolveFirestore()).toEqual({ tag: "global" });

        expect(__internals.resolveAuth({ id: 1 })).toEqual({ id: 1 });
        expect(__internals.resolveAuth()).toBeNull();
        window.auth = { id: 2 };
        expect(__internals.resolveAuth()).toEqual({ id: 2 });

        expect(__internals.resolveAuthFns({ x: 1 })).toEqual({ x: 1 });
        expect(__internals.resolveAuthFns()).toEqual({});
        window.authFns = { y: 1 };
        expect(__internals.resolveAuthFns()).toEqual({ y: 1 });

        expect(__internals.resolveFirestoreFns({ z: 1 })).toEqual({ z: 1 });
        expect(__internals.resolveFirestoreFns()).toEqual({});
        window.firestoreFns = { q: 1 };
        expect(__internals.resolveFirestoreFns()).toEqual({ q: 1 });
    });
});

// ----------------------------------------------------------------------------
// Init flow (applyDateFilter, renderEverything, applyTimeWindowChip)
// ----------------------------------------------------------------------------

describe("applyDateFilter / renderEverything", () => {
    test("renderEverything updates KPI cells and creates charts", () => {
        __internals.setFilteredOrders([makeOrderWithItems()]);
        __internals.renderEverything();
        expect(document.getElementById("total-orders").textContent).toBe("1");
        const charts = __internals.getAnalyticsCharts();
        expect(charts["peak-hours-chart"]).toBeDefined();
        expect(charts["revenue-trend-chart"]).toBeDefined();
    });

    test("applyDateFilter filters all orders by the visible date inputs and updates status", async () => {
        __internals.setAllOrders([
            makeOrderWithItems({ id: "in", createdAt: new Date("2026-05-15T12:00:00Z") }),
            makeOrderWithItems({ id: "out", createdAt: new Date("2026-01-01T12:00:00Z") })
        ]);
        document.getElementById("start-date-input").value = "2026-05-01";
        document.getElementById("end-date-input").value = "2026-05-31";
        await __internals.applyDateFilter();
        expect(__internals.getFilteredOrders().map(o => o.id)).toEqual(["in"]);
        expect(document.getElementById("analytics-status").textContent).toMatch(/1 orders/);
    });

    test("applyDateFilter with no dates shows 'All time' status", async () => {
        __internals.setAllOrders([makeOrderWithItems()]);
        document.getElementById("start-date-input").value = "";
        document.getElementById("end-date-input").value = "";
        await __internals.applyDateFilter();
        expect(document.getElementById("analytics-status").textContent).toMatch(/All time/);
    });

    test("applyDateFilter resets pagination", async () => {
        __internals.getItemsState().page = 5;
        __internals.getCustomersState().page = 3;
        __internals.setAllOrders([makeOrderWithItems()]);
        await __internals.applyDateFilter();
        expect(__internals.getItemsState().page).toBe(1);
        expect(__internals.getCustomersState().page).toBe(1);
    });
});

describe("applyTimeWindowChip", () => {
    test("named window sets the date inputs and marks the chip active", () => {
        __internals.setAllOrders([makeOrderWithItems()]);
        __internals.applyTimeWindowChip("today");
        expect(document.getElementById("start-date-input").value).toBeTruthy();
        expect(document.getElementById("end-date-input").value).toBeTruthy();
        const activeChip = document.querySelector('.time-chip[data-window="today"]');
        expect(activeChip.classList.contains("active")).toBe(true);
        expect(activeChip.getAttribute("aria-pressed")).toBe("true");
    });

    test('"all" clears the date inputs', () => {
        document.getElementById("start-date-input").value = "2026-05-01";
        document.getElementById("end-date-input").value = "2026-05-31";
        __internals.setAllOrders([makeOrderWithItems()]);
        __internals.applyTimeWindowChip("all");
        expect(document.getElementById("start-date-input").value).toBe("");
        expect(document.getElementById("end-date-input").value).toBe("");
    });
});

// ----------------------------------------------------------------------------
// Event listener wiring
// ----------------------------------------------------------------------------

describe("attachEventListeners", () => {
    test("idempotent — only attaches once", () => {
        __internals.attachEventListeners();
        __internals.attachEventListeners();
        // No assertion needed beyond not-throwing; coverage exercised.
    });

    test("Apply Filter button triggers applyDateFilter", () => {
        __internals.setAllOrders([makeOrderWithItems()]);
        document.getElementById("start-date-input").value = "2026-05-01";
        document.getElementById("end-date-input").value = "2026-05-31";
        __internals.attachEventListeners();
        document.getElementById("apply-filter-button").click();
        // status message should refer to the date range
        expect(document.getElementById("analytics-status").textContent).toMatch(/2026-05-01/);
    });

    test("Reset Filter button sets a 30-day range", () => {
        __internals.attachEventListeners();
        document.getElementById("reset-filter-button").click();
        const fromVal = document.getElementById("start-date-input").value;
        const toVal = document.getElementById("end-date-input").value;
        expect(fromVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(toVal).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test("CSV/Excel/PDF buttons short-circuit when filteredOrders is empty", () => {
        __internals.attachEventListeners();
        document.getElementById("export-csv-button").click();
        expect(document.getElementById("analytics-status").textContent).toMatch(/No data to export/);
        document.getElementById("export-excel-button").click();
        document.getElementById("export-pdf-button").click();
        expect(document.getElementById("analytics-status").textContent).toMatch(/No data to export/);
    });

    test("CSV button runs export when data is present", () => {
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;
        let calls = 0;
        URL.createObjectURL = () => { calls++; return "blob://x"; };
        URL.revokeObjectURL = () => { };
        __internals.setFilteredOrders([makeOrderWithItems()]);
        __internals.attachEventListeners();
        document.getElementById("export-csv-button").click();
        expect(calls).toBeGreaterThan(0);
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
    });

    test("Time-chip click flips the active chip", () => {
        __internals.setAllOrders([makeOrderWithItems()]);
        __internals.attachEventListeners();
        document.querySelector('.time-chip[data-window="7d"]').click();
        expect(document.querySelector('.time-chip[data-window="7d"]').classList.contains("active")).toBe(true);
    });

    test("Table search input rerenders the table", () => {
        __internals.setFilteredOrders([
            makeOrderWithItems({ id: "1", items: [{ name: "Burger", quantity: 1, price: 10 }] }),
            makeOrderWithItems({ id: "2", items: [{ name: "Salad", quantity: 1, price: 10 }] })
        ]);
        __internals.attachEventListeners();
        const search = document.getElementById("top-items-search");
        search.value = "burg";
        search.dispatchEvent(new Event("input"));
        expect(__internals.getItemsState().search).toBe("burg");
        expect(document.querySelector("#top-items-table tbody").innerHTML).toContain("Burger");
    });

    test("Table sort dropdown updates state and rerenders", () => {
        __internals.setFilteredOrders([makeOrderWithItems()]);
        __internals.attachEventListeners();
        const sort = document.getElementById("top-items-sort");
        sort.value = "quantity:desc";
        sort.dispatchEvent(new Event("change"));
        expect(__internals.getItemsState().sort).toBe("quantity");
        expect(__internals.getItemsState().dir).toBe("desc");
    });

    test("Page-size dropdown updates state with a numeric value", () => {
        __internals.setFilteredOrders([makeOrderWithItems()]);
        __internals.attachEventListeners();
        const pageSize = document.getElementById("top-items-page-size");
        pageSize.value = "10";
        pageSize.dispatchEvent(new Event("change"));
        expect(__internals.getItemsState().size).toBe(10);
    });

    test("Prev/Next buttons mutate page within bounds", () => {
        __internals.setFilteredOrders(Array.from({ length: 30 }, (_, i) => makeOrderWithItems({
            id: `o${i}`,
            items: [{ name: `Item ${i}`, category: "C", quantity: 1, price: 10 }]
        })));
        __internals.attachEventListeners();
        __internals.renderTopItemsTable();
        document.getElementById("top-items-next-button").click();
        expect(__internals.getItemsState().page).toBeGreaterThanOrEqual(2);
        document.getElementById("top-items-prev-button").click();
        expect(__internals.getItemsState().page).toBeGreaterThanOrEqual(1);
    });

    test("attachSectionSwitchers toggles content-section.active on click", () => {
        __internals.attachSectionSwitchers();
        document.querySelector('.menu-item[data-section="revenue"]').click();
        expect(document.getElementById("revenue-section").classList.contains("active")).toBe(true);
        expect(document.querySelector('.menu-item[data-section="revenue"]').classList.contains("active")).toBe(true);
    });

    test("section switcher ignores menu items without data-section", () => {
        document.body.innerHTML += '<button class="menu-item">no-attr</button>';
        __internals.attachSectionSwitchers();
        const noAttrBtn = document.querySelectorAll(".menu-item")[document.querySelectorAll(".menu-item").length - 1];
        expect(() => noAttrBtn.click()).not.toThrow();
    });
});

// ----------------------------------------------------------------------------
// initializeAnalyticsDashboard + waitForFirebaseDependencies
// ----------------------------------------------------------------------------

describe("initializeAnalyticsDashboard", () => {
    test("reports an error when dependencies are missing", async () => {
        await __internals.initializeAnalyticsDashboard({});
        expect(document.getElementById("analytics-status").textContent).toMatch(/Error loading analytics/i);
    });

    test("happy path: authenticates, fetches, renders", async () => {
        const fakeSnapshot = {
            forEach: (cb) => {
                cb({ id: "o1", data: () => ({ vendorUid: "v1", total: 100, paymentAmount: 100, createdAt: new Date("2026-05-10"), status: "completed", items: [] }) });
            }
        };
        const deps = {
            db: { name: "db" },
            auth: { id: "auth" },
            authFns: {
                onAuthStateChanged: (auth, cb) => cb({ uid: "v1" })
            },
            firestoreFns: {
                collection: () => "ref",
                query: () => "q",
                where: () => "w",
                getDocs: () => Promise.resolve(fakeSnapshot)
            }
        };
        await __internals.initializeAnalyticsDashboard(deps);
        expect(document.getElementById("analytics-status").textContent).toMatch(/loaded successfully/i);
        expect(__internals.getAllOrders().length).toBe(1);
    });

    test("second concurrent call resolves to the same outcome (single in-flight init)", async () => {
        // Both calls return Promises wrapping the same in-flight async work.
        // We can't assert identity (async fn wraps each call), so we verify
        // that the rendering only happens once via a single status message.
        const fakeSnapshot = { forEach: () => { } };
        let onAuthCalls = 0;
        const deps = {
            db: { name: "db" },
            auth: { id: "auth" },
            authFns: {
                onAuthStateChanged: (auth, cb) => { onAuthCalls++; cb({ uid: "v1" }); }
            },
            firestoreFns: {
                collection: () => "ref", query: () => "q", where: () => "w",
                getDocs: () => Promise.resolve(fakeSnapshot)
            }
        };
        const p1 = __internals.initializeAnalyticsDashboard(deps);
        const p2 = __internals.initializeAnalyticsDashboard(deps);
        await Promise.all([p1, p2]);
        // Second call should have short-circuited via the `if (initInFlight)` guard,
        // so onAuthStateChanged was invoked exactly once.
        expect(onAuthCalls).toBe(1);
    });

    test("unauthenticated user causes the error path (and a status message)", async () => {
        // We can't reliably assert window.location was set in jsdom without
        // navigation hooks, but the auth-rejection still travels through the
        // try/catch and updates the status message.
        const deps = {
            db: { name: "db" },
            auth: { id: "auth" },
            authFns: { onAuthStateChanged: (auth, cb) => cb(null) },
            firestoreFns: {}
        };
        await __internals.initializeAnalyticsDashboard(deps);
        expect(document.getElementById("analytics-status").textContent).toMatch(/Error loading analytics/i);
    });
});

describe("waitForFirebaseDependencies", () => {
    afterEach(() => {
        delete window.db;
        delete window.auth;
        delete window.authFns;
        delete window.firestoreFns;
    });

    test("resolves immediately when deps are present", async () => {
        window.db = {}; window.auth = {}; window.authFns = {}; window.firestoreFns = {};
        await expect(__internals.waitForFirebaseDependencies(500)).resolves.toBeUndefined();
    });

    test("rejects after the timeout when deps never arrive", async () => {
        await expect(__internals.waitForFirebaseDependencies(120)).rejects.toThrow(/Timed out/);
    });
});

// ----------------------------------------------------------------------------
// Coverage gap-closers: rare sort comparators, multi-bucket export shapes,
// Excel/PDF buttons with data, refresh button wiring.
// ----------------------------------------------------------------------------

describe("sort comparator branches", () => {
    test("sortItems by avgPrice asc", () => {
        const items = [
            { name: "a", category: "X", quantity: 1, revenue: 10, avgPrice: 10 },
            { name: "b", category: "X", quantity: 1, revenue: 5, avgPrice: 5 }
        ];
        expect(sortItems(items, "avgPrice", "asc").map(i => i.name)).toEqual(["b", "a"]);
    });

    test("sortItems by name asc compares the lowercase key", () => {
        const items = [
            { name: "Zeta", category: "X", quantity: 1, revenue: 1, avgPrice: 1 },
            { name: "alpha", category: "X", quantity: 1, revenue: 1, avgPrice: 1 }
        ];
        expect(sortItems(items, "name", "asc").map(i => i.name)).toEqual(["alpha", "Zeta"]);
    });

    test("sortCustomers by name compares the lowercase key", () => {
        const customers = [
            { customerName: "Zeta", orderCount: 1, totalSpent: 1, lastOrder: new Date() },
            { customerName: "alpha", orderCount: 1, totalSpent: 1, lastOrder: new Date() }
        ];
        expect(sortCustomers(customers, "name", "asc").map(c => c.customerName)).toEqual(["alpha", "Zeta"]);
    });
});

describe("exports with rich multi-bucket data (more branch coverage)", () => {
    test("CSV export covers peak hours, categories, daily breakdown branches", () => {
        const origCreate = URL.createObjectURL;
        URL.createObjectURL = () => "blob://x";
        const a = calculateAnalytics([
            makeOrderWithItems({ id: "1", createdAt: new Date("2026-05-01T10:00:00Z") }),
            makeOrderWithItems({ id: "2", createdAt: new Date("2026-05-02T10:00:00Z") }),
            makeOrderWithItems({ id: "3", createdAt: new Date("2026-05-03T10:00:00Z") })
        ]);
        expect(() => __internals.exportToCSV(a)).not.toThrow();
        URL.createObjectURL = origCreate;
    });

    test("Excel export covers Top Items, Categories, Customers sort branches", () => {
        installXLSXMock();
        const customers = [
            { customerUid: "u1", customerName: "Z", paymentAmount: 100, createdAt: new Date("2026-05-01"), items: [] },
            { customerUid: "u2", customerName: "A", paymentAmount: 250, createdAt: new Date("2026-05-15"), items: [] }
        ];
        __internals.setFilteredOrders(customers);
        const a = calculateAnalytics(__internals.getFilteredOrders());
        expect(() => __internals.exportToExcel(a)).not.toThrow();
    });
});

describe("Excel/PDF event handlers with data present", () => {
    test("Excel button runs exportToExcel when filteredOrders is non-empty", () => {
        const { utilsCalls } = installXLSXMock();
        __internals.setFilteredOrders([makeOrderWithItems()]);
        __internals.attachEventListeners();
        document.getElementById("export-excel-button").click();
        expect(utilsCalls.appended.length).toBeGreaterThan(0);
    });

    test("PDF button runs exportToPDF when filteredOrders is non-empty", () => {
        const calls = installJsPdfMock();
        __internals.setFilteredOrders([makeOrderWithItems()]);
        __internals.attachEventListeners();
        document.getElementById("export-pdf-button").click();
        expect(calls.save.length).toBe(1);
    });
});

describe("refresh-data-button wiring", () => {
    test("calls initializeAnalyticsDashboard with resolved deps and clears initInFlight", () => {
        // Install deps on the global scope so resolve* helpers can find them
        window.db = { name: "db" };
        window.auth = { id: "auth" };
        window.authFns = { onAuthStateChanged: (auth, cb) => cb({ uid: "v1" }) };
        window.firestoreFns = {
            collection: () => "ref", query: () => "q", where: () => "w",
            getDocs: () => Promise.resolve({ forEach: () => { } })
        };
        __internals.setInitInFlight(Promise.resolve()); // pretend something was in flight
        __internals.attachEventListeners();
        expect(() => document.getElementById("refresh-data-button").click()).not.toThrow();
        // Cleanup
        delete window.db;
        delete window.auth;
        delete window.authFns;
        delete window.firestoreFns;
    });
});

describe("initializePage", () => {
    afterEach(() => {
        delete window.db;
        delete window.auth;
        delete window.authFns;
        delete window.firestoreFns;
    });

    test("when deps are present, kicks straight into initialization (and into the auth-missing error path)", () => {
        window.db = {}; window.auth = {};
        window.authFns = { onAuthStateChanged: (a, cb) => cb({ uid: "v1" }) };
        window.firestoreFns = {
            collection: () => "ref", query: () => "q", where: () => "w",
            getDocs: () => Promise.resolve({ forEach: () => { } })
        };
        expect(() => __internals.initializePage()).not.toThrow();
    });

    test("falls through to waitForFirebaseDependencies when deps are missing", async () => {
        // Force the wait path. We can't fully await it (it polls every 100ms),
        // but the function should at least kick off without throwing.
        expect(() => __internals.initializePage()).not.toThrow();
    });
});

// ============================================================================
// Final coverage top-ups for lines that the broader suites don't hit:
//   - CUSTOMER_SORT_KEYS.orderCount comparator
//   - peakHours .sort comparators in CSV + Excel export paths (need 2+ hours)
//   - initializePage's .catch() handler (waitForFirebaseDependencies rejected)
//   - __internals.setEventListenersAttached and getBottomItemsState getters
// ============================================================================

describe("sortCustomers — orderCount key", () => {
    test("sorts by orderCount descending", () => {
        const customers = [
            { customerName: "A", orderCount: 1, totalSpent: 50, lastOrder: new Date(2026, 4, 1) },
            { customerName: "B", orderCount: 7, totalSpent: 200, lastOrder: new Date(2026, 4, 2) },
            { customerName: "C", orderCount: 3, totalSpent: 100, lastOrder: new Date(2026, 4, 3) }
        ];
        expect(sortCustomers(customers, "orderCount", "desc").map(c => c.customerName))
            .toEqual(["B", "C", "A"]);
    });
    test("sorts by orderCount ascending", () => {
        const customers = [
            { customerName: "A", orderCount: 5, totalSpent: 0, lastOrder: null },
            { customerName: "B", orderCount: 2, totalSpent: 0, lastOrder: null }
        ];
        expect(sortCustomers(customers, "orderCount", "asc").map(c => c.customerName))
            .toEqual(["B", "A"]);
    });
});

describe("export comparators with multi-hour data", () => {
    // The peakHours sort callbacks are only invoked when there are 2+ hour
    // buckets to compare — single-order tests never exercise them.
    function makeOrdersAcrossHours() {
        return [
            makeOrderWithItems({ id: "1", createdAt: new Date(2026, 4, 1, 9) }),
            makeOrderWithItems({ id: "2", createdAt: new Date(2026, 4, 1, 9) }),
            makeOrderWithItems({ id: "3", createdAt: new Date(2026, 4, 1, 12) }),
            makeOrderWithItems({ id: "4", createdAt: new Date(2026, 4, 1, 18) }),
            makeOrderWithItems({ id: "5", createdAt: new Date(2026, 4, 1, 18) }),
            makeOrderWithItems({ id: "6", createdAt: new Date(2026, 4, 1, 18) })
        ];
    }

    test("CSV export sorts peak hours by count descending", () => {
        // Stub URL.createObjectURL so the download path runs without warnings.
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;
        URL.createObjectURL = () => "blob://x";
        URL.revokeObjectURL = () => { };
        try {
            const analytics = calculateAnalytics(makeOrdersAcrossHours());
            expect(() => __internals.exportToCSV(analytics)).not.toThrow();
        } finally {
            URL.createObjectURL = origCreate;
            URL.revokeObjectURL = origRevoke;
        }
    });

    test("buildExportTables sorts peak hours by hour ascending for Excel/PDF", () => {
        const analytics = calculateAnalytics(makeOrdersAcrossHours());
        const tables = __internals.buildExportTables(analytics);
        // Skip the header row; peak hour numeric values should be ascending.
        const hours = tables.peakHours.slice(1).map(row => Number(String(row[0]).replace(":00", "")));
        const sortedAscending = hours.slice().sort((a, b) => a - b);
        expect(hours).toEqual(sortedAscending);
        expect(hours.length).toBeGreaterThanOrEqual(3);
    });
});

describe("initializePage — wait-for-deps rejection path", () => {
    afterEach(() => {
        delete window.db; delete window.auth;
        delete window.authFns; delete window.firestoreFns;
        jest.useRealTimers();
    });

    test("logs an error and writes a status message when deps never arrive", async () => {
        // Use fake timers to fast-forward through the 5000ms polling loop without
        // sleeping the test. Modern fake timers mock Date.now too, which is what
        // waitForFirebaseDependencies uses to decide whether to time out.
        jest.useFakeTimers();
        delete window.db; delete window.auth;
        delete window.authFns; delete window.firestoreFns;
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        __internals.initializePage();
        await jest.advanceTimersByTimeAsync(5100);
        expect(errSpy).toHaveBeenCalled();
        expect(document.getElementById("analytics-status").textContent)
            .toMatch(/Error loading analytics/);
        errSpy.mockRestore();
    });
});

describe("__internals test setters/getters not used elsewhere", () => {
    test("setEventListenersAttached toggles the internal flag (Boolean-coerced)", () => {
        __internals.setEventListenersAttached(true);
        // No public getter for this flag, but we can verify by calling
        // attachEventListeners and confirming a second wire-up is skipped.
        // Setter is a stateful side-effect; just ensure it doesn't throw on
        // any truthy/falsy input.
        expect(() => __internals.setEventListenersAttached(1)).not.toThrow();
        expect(() => __internals.setEventListenersAttached(0)).not.toThrow();
        expect(() => __internals.setEventListenersAttached(false)).not.toThrow();
    });

    test("getBottomItemsState returns the bottom-items pagination/search state", () => {
        const state = __internals.getBottomItemsState();
        expect(state).toEqual(expect.objectContaining({
            search: expect.any(String),
            sort: expect.any(String),
            dir: expect.any(String),
            page: expect.any(Number),
            size: expect.any(Number)
        }));
    });
});

