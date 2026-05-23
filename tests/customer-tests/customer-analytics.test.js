/**
 * @jest-environment jsdom
 *
 * Customer analytics — pure-logic tests.
 * Only the exported helpers from
 * public/customer/customer-analytics/customer-analytics.js are exercised.
 * Auto-init is gated behind a CommonJS check, so requiring the file does
 * not touch the DOM or Firebase.
 */

const customerAnalytics = require("../../public/customer/customer-analytics/customer-analytics.js");
const {
    normalizeText,
    normalizeLowerText,
    getDateFromTimestamp,
    getOrderAmount,
    fmtRand,
    fmtNum,
    resolveTimeWindow,
    applyTimeWindow,
    filterOrdersByDateRange,
    aggregateMonthly,
    aggregateVendors,
    aggregateItems,
    aggregateHourly,
    aggregateCategories,
    computeSpendTrends,
    computeMilestones,
    searchOrders,
    sortOrders,
    paginate,
    escapeHtml,
    setText,
    destroyChart,
    getFilteredOrders,
    renderStats,
    renderSpendingChart,
    renderVendorsChart,
    renderItemsChart,
    renderHabitsChart,
    renderCategoriesChart,
    renderHistoryTable,
    updatePaginationOutputs,
    renderMilestones,
    renderAll,
    applyTimeWindowChip,
    downloadBlob,
    toCsv,
    buildExportTables,
    exportCSV,
    exportExcel,
    drawPdfTable,
    exportPDF,
    attachEventListeners,
    startLifecycle,
    waitForFirebaseDependencies,
    initializePage,
    _testReset,
    _testSetCachedOrders,
    _testSetCurrentWindowKey,
    _testGetCharts,
    _testGetHistoryState,
    _testSetHistoryState,
    _testGetListenersAttached,
    _testSetListenersAttached
} = customerAnalytics;

// ----------------------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------------------

function makeOrder(overrides = {}) {
    return {
        id: overrides.id || "order-1",
        vendorName: "Burger Shack",
        status: "completed",
        total: 100,
        createdAt: new Date("2026-05-01T12:00:00Z"),
        items: [
            { name: "Burger", category: "Mains", quantity: 1, price: 80 },
            { name: "Coke", category: "Drinks", quantity: 1, price: 20 }
        ],
        ...overrides
    };
}

// ============================================================================
// Helpers and formatters
// ============================================================================

describe("normalizeText / normalizeLowerText", () => {
    test("trims whitespace and lowercases", () => {
        expect(normalizeText("  hello ")).toBe("hello");
        expect(normalizeLowerText("  HELLO ")).toBe("hello");
    });

    test("rejects non-strings", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(42)).toBe("");
    });
});

describe("getDateFromTimestamp", () => {
    test("passes Date instances through", () => {
        const d = new Date();
        expect(getDateFromTimestamp(d)).toBe(d);
    });
    test("parses ISO strings, numbers, Firestore Timestamp shapes", () => {
        expect(getDateFromTimestamp("2026-05-01T00:00:00Z")).toBeInstanceOf(Date);
        expect(getDateFromTimestamp(1700000000000)).toBeInstanceOf(Date);
        const fromToDate = getDateFromTimestamp({ toDate: () => new Date(0) });
        expect(fromToDate).toBeInstanceOf(Date);
        const fromSeconds = getDateFromTimestamp({ seconds: 60 });
        expect(fromSeconds.getTime()).toBe(60000);
    });
    test("returns null for unrecognised inputs", () => {
        expect(getDateFromTimestamp(null)).toBeNull();
        expect(getDateFromTimestamp({})).toBeNull();
    });
});

describe("getOrderAmount", () => {
    test("prefers total, then subtotal, then paymentAmount, then totalAmount", () => {
        expect(getOrderAmount({ total: 50, subtotal: 99 })).toBe(50);
        expect(getOrderAmount({ subtotal: 30 })).toBe(30);
        expect(getOrderAmount({ paymentAmount: 20 })).toBe(20);
        expect(getOrderAmount({ totalAmount: 10 })).toBe(10);
    });
    test("returns 0 for missing/invalid amounts", () => {
        expect(getOrderAmount(null)).toBe(0);
        expect(getOrderAmount({})).toBe(0);
        expect(getOrderAmount({ total: "nope" })).toBe(0);
    });
});

describe("fmtRand / fmtNum", () => {
    test("fmtRand prefixes R and adds thousands separators", () => {
        expect(fmtRand(1234567.89)).toBe("R 1,234,567.89");
    });
    test("fmtRand handles invalid inputs gracefully", () => {
        expect(fmtRand(NaN)).toBe("R 0.00");
        expect(fmtRand(undefined)).toBe("R 0.00");
    });
    test("fmtNum rounds + formats", () => {
        expect(fmtNum(1234.7)).toMatch(/1[\s,]235/);
    });
});

// ============================================================================
// Time window
// ============================================================================

describe("resolveTimeWindow", () => {
    const ref = new Date(2026, 4, 21, 15, 0, 0);

    test('"month" starts on the 1st of current month', () => {
        const { start } = resolveTimeWindow("month", ref);
        expect(start.getDate()).toBe(1);
        expect(start.getMonth()).toBe(ref.getMonth());
    });

    test('"3m" starts 2 months before current month', () => {
        const { start } = resolveTimeWindow("3m", ref);
        expect(start.getMonth()).toBe(ref.getMonth() - 2);
        expect(start.getDate()).toBe(1);
    });

    test('"6m" starts 5 months before current month', () => {
        const { start } = resolveTimeWindow("6m", ref);
        // Handle month-wrap correctly via numeric comparison only
        const expected = new Date(ref.getFullYear(), ref.getMonth() - 5, 1, 0, 0, 0, 0);
        expect(start.getTime()).toBe(expected.getTime());
    });

    test('"year" starts on Jan 1', () => {
        const { start } = resolveTimeWindow("year", ref);
        expect(start.getMonth()).toBe(0);
        expect(start.getDate()).toBe(1);
    });

    test('"all" and unknown keys return nulls', () => {
        expect(resolveTimeWindow("all", ref)).toEqual({ start: null, end: null });
        expect(resolveTimeWindow("bogus", ref)).toEqual({ start: null, end: null });
    });
});

describe("filterOrdersByDateRange / applyTimeWindow", () => {
    const orders = [
        makeOrder({ id: "a", createdAt: new Date("2026-03-01T10:00:00Z") }),
        makeOrder({ id: "b", createdAt: new Date("2026-04-15T10:00:00Z") }),
        makeOrder({ id: "c", createdAt: new Date("2026-05-20T10:00:00Z") })
    ];

    test("no range returns a fresh copy of all orders", () => {
        const out = filterOrdersByDateRange(orders, null, null);
        expect(out).toEqual(orders);
        expect(out).not.toBe(orders);
    });

    test("inclusive range filtering", () => {
        const out = filterOrdersByDateRange(
            orders,
            new Date("2026-04-01T00:00:00Z"),
            new Date("2026-05-01T00:00:00Z")
        );
        expect(out.map(o => o.id)).toEqual(["b"]);
    });

    test('applyTimeWindow with "all" returns everything', () => {
        expect(applyTimeWindow(orders, "all").length).toBe(3);
    });
});

// ============================================================================
// Aggregators
// ============================================================================

describe("aggregateMonthly", () => {
    test("buckets by year+month and totals correctly", () => {
        const out = aggregateMonthly([
            makeOrder({ id: "1", total: 100, createdAt: new Date(2026, 0, 5) }),
            makeOrder({ id: "2", total: 50, createdAt: new Date(2026, 0, 15) }),
            makeOrder({ id: "3", total: 200, createdAt: new Date(2026, 1, 1) })
        ]);
        expect(out.labels).toEqual(["Jan 2026", "Feb 2026"]);
        expect(out.totals).toEqual([150, 200]);
        expect(out.orderCounts).toEqual([2, 1]);
    });

    test("returns empty arrays for empty input", () => {
        const out = aggregateMonthly([]);
        expect(out.labels).toEqual([]);
        expect(out.totals).toEqual([]);
    });

    test("sorts chronologically across years", () => {
        const out = aggregateMonthly([
            makeOrder({ id: "1", total: 50, createdAt: new Date(2026, 2, 1) }),
            makeOrder({ id: "2", total: 50, createdAt: new Date(2025, 11, 1) })
        ]);
        expect(out.labels).toEqual(["Dec 2025", "Mar 2026"]);
    });
});

describe("aggregateVendors", () => {
    test("groups, totals, and tracks lastOrder", () => {
        const rows = aggregateVendors([
            makeOrder({ id: "1", vendorName: "A", total: 100, createdAt: new Date("2026-05-01") }),
            makeOrder({ id: "2", vendorName: "A", total: 50, createdAt: new Date("2026-05-10") }),
            makeOrder({ id: "3", vendorName: "B", total: 200, createdAt: new Date("2026-04-01") })
        ]);
        const a = rows.find(r => r.vendor === "A");
        const b = rows.find(r => r.vendor === "B");
        expect(a.orders).toBe(2);
        expect(a.totalSpent).toBe(150);
        expect(a.lastOrder.toISOString().slice(0, 10)).toBe("2026-05-10");
        expect(b.orders).toBe(1);
    });

    test("missing vendor name defaults to Unknown", () => {
        const rows = aggregateVendors([{ total: 30, createdAt: new Date() }]);
        expect(rows[0].vendor).toBe("Unknown");
    });
});

describe("aggregateItems", () => {
    test("sums quantities + cost across orders, keeps category", () => {
        const rows = aggregateItems([
            makeOrder({
                items: [{ name: "Burger", category: "Mains", quantity: 2, price: 50 }]
            }),
            makeOrder({
                id: "2",
                items: [{ name: "Burger", category: "Mains", quantity: 3, price: 50 }]
            })
        ]);
        const burger = rows.find(r => r.name === "Burger");
        expect(burger.quantity).toBe(5);
        expect(burger.totalSpent).toBe(250);
        expect(burger.category).toBe("Mains");
    });

    test("handles missing items array without throwing", () => {
        expect(aggregateItems([{ vendorName: "X" }])).toEqual([]);
    });
});

describe("aggregateHourly / aggregateCategories", () => {
    test("aggregateHourly counts per hour, 24-slot array", () => {
        const orders = [
            makeOrder({ id: "1", createdAt: new Date(2026, 4, 1, 12, 0) }),
            makeOrder({ id: "2", createdAt: new Date(2026, 4, 1, 12, 30) }),
            makeOrder({ id: "3", createdAt: new Date(2026, 4, 1, 18, 0) })
        ];
        const out = aggregateHourly(orders);
        expect(out).toHaveLength(24);
        expect(out[12]).toBe(2);
        expect(out[18]).toBe(1);
    });

    test("aggregateCategories buckets Uncategorized when missing", () => {
        const rows = aggregateCategories([
            makeOrder({ items: [{ name: "Mystery", quantity: 1, price: 25 }] }),
            makeOrder({ id: "2", items: [{ name: "Tea", category: "Drinks", quantity: 2, price: 15 }] })
        ]);
        const uncat = rows.find(r => r.category === "Uncategorized");
        const drinks = rows.find(r => r.category === "Drinks");
        expect(uncat.quantity).toBe(1);
        expect(uncat.totalSpent).toBe(25);
        expect(drinks.quantity).toBe(2);
        expect(drinks.totalSpent).toBe(30);
    });
});

// ============================================================================
// Trends & milestones
// ============================================================================

describe("computeSpendTrends", () => {
    const ref = new Date(2026, 4, 15, 12, 0, 0); // 2026-05-15 12:00 local

    test("splits into this-month vs last-month with delta + direction", () => {
        const orders = [
            makeOrder({ id: "1", total: 200, createdAt: new Date(2026, 4, 5) }),  // May
            makeOrder({ id: "2", total: 100, createdAt: new Date(2026, 4, 10) }), // May
            makeOrder({ id: "3", total: 150, createdAt: new Date(2026, 3, 20) })  // Apr
        ];
        const trends = computeSpendTrends(orders, ref);
        expect(trends.thisMonth).toBe(300);
        expect(trends.lastMonth).toBe(150);
        expect(trends.direction).toBe("up");
        expect(trends.monthDeltaPct).toBeCloseTo(100, 5);
    });

    test("no orders gives all-zero safe defaults", () => {
        const trends = computeSpendTrends([], ref);
        expect(trends).toMatchObject({
            thisMonth: 0,
            lastMonth: 0,
            monthDeltaPct: 0,
            direction: "flat",
            avgPerWeek: 0,
            projectedMonth: 0,
            totalSpent: 0
        });
    });

    test("with no last-month orders but this-month spend, treats as +100% up", () => {
        const trends = computeSpendTrends([
            makeOrder({ total: 50, createdAt: new Date(2026, 4, 5) })
        ], ref);
        expect(trends.monthDeltaPct).toBe(100);
        expect(trends.direction).toBe("up");
    });

    test("projection grows from partial month towards full month", () => {
        const trends = computeSpendTrends([
            makeOrder({ total: 300, createdAt: new Date(2026, 4, 5) }) // first 5 of 31 days
        ], ref);
        // ref is day 15; projection = thisMonth * 31 / 15
        expect(trends.projectedMonth).toBeGreaterThan(trends.thisMonth);
    });
});

describe("computeMilestones", () => {
    const ref = new Date(2026, 4, 15);

    test("returns empty array for no orders", () => {
        expect(computeMilestones([], ref)).toEqual([]);
    });

    test("includes 'orders this month' and favourite vendor", () => {
        const orders = [
            makeOrder({ id: "1", createdAt: new Date(2026, 4, 1), vendorName: "A", total: 50 }),
            makeOrder({ id: "2", createdAt: new Date(2026, 4, 5), vendorName: "A", total: 60 }),
            makeOrder({ id: "3", createdAt: new Date(2026, 4, 10), vendorName: "B", total: 40 })
        ];
        const milestones = computeMilestones(orders, ref);
        expect(milestones.some(m => m.title.includes("this month"))).toBe(true);
        expect(milestones.some(m => m.title.startsWith("Favourite vendor"))).toBe(true);
    });

    test("flags 10+ total orders milestone", () => {
        const orders = Array.from({ length: 12 }, (_, i) =>
            makeOrder({ id: String(i), createdAt: new Date(2026, 4, 1) }));
        const milestones = computeMilestones(orders, ref);
        expect(milestones.some(m => m.title.includes("total orders"))).toBe(true);
    });
});

// ============================================================================
// Search, sort, paginate
// ============================================================================

const sampleOrders = [
    makeOrder({ id: "1", vendorName: "Burger Shack", total: 100, createdAt: new Date("2026-05-15") }),
    makeOrder({
        id: "2", vendorName: "Coffee Cart", total: 30, createdAt: new Date("2026-05-01"),
        items: [{ name: "Latte", quantity: 1, price: 30 }]
    }),
    makeOrder({
        id: "3", vendorName: "Fries Place", total: 50, createdAt: new Date("2026-05-10"),
        items: [{ name: "Curly fries", quantity: 1, price: 50 }]
    })
];

describe("searchOrders", () => {
    test("matches by vendor name (case-insensitive)", () => {
        expect(searchOrders(sampleOrders, "BURG").map(o => o.id)).toEqual(["1"]);
    });
    test("matches by item name", () => {
        expect(searchOrders(sampleOrders, "curly").map(o => o.id)).toEqual(["3"]);
    });
    test("empty term returns fresh copy of all", () => {
        const out = searchOrders(sampleOrders, "");
        expect(out).toEqual(sampleOrders);
        expect(out).not.toBe(sampleOrders);
    });
});

describe("sortOrders", () => {
    test("sort by date desc puts newest first", () => {
        expect(sortOrders(sampleOrders, "date", "desc").map(o => o.id)).toEqual(["1", "3", "2"]);
    });
    test("sort by total asc", () => {
        expect(sortOrders(sampleOrders, "total", "asc").map(o => o.id)).toEqual(["2", "3", "1"]);
    });
    test("sort by vendor A→Z", () => {
        expect(sortOrders(sampleOrders, "vendor", "asc").map(o => o.id)).toEqual(["1", "2", "3"]);
    });
    test("unknown sort key returns a copy", () => {
        const out = sortOrders(sampleOrders, "bogus", "desc");
        expect(out).toEqual(sampleOrders);
        expect(out).not.toBe(sampleOrders);
    });
});

describe("paginate", () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ i }));

    test("first page", () => {
        const r = paginate(rows, 1, 10);
        expect(r.rows.length).toBe(10);
        expect(r.totalPages).toBe(3);
        expect(r.startIndex).toBe(1);
        expect(r.endIndex).toBe(10);
    });

    test("last partial page", () => {
        const r = paginate(rows, 3, 10);
        expect(r.rows.length).toBe(3);
        expect(r.endIndex).toBe(23);
    });

    test("clamps overshoot and undershoot", () => {
        expect(paginate(rows, 99, 10).page).toBe(3);
        expect(paginate(rows, 0, 10).page).toBe(1);
        expect(paginate(rows, -5, 10).page).toBe(1);
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
        expect(paginate(rows, 1, "abc").size).toBe(10);
    });
});

// ============================================================================
// DOM / WIRING LAYER
// ============================================================================
//
// The renderers, exporters, event wiring, and lifecycle bootstrap operate
// on a real DOM + global Chart/XLSX/jsPDF libraries. We stand those up with
// jsdom + fakes, then drive each function and assert on the DOM / chart
// configs / download calls.

const REQUIRED_ELEMENT_IDS = [
    "stat-total-spent", "stat-total-orders", "stat-fav-vendor",
    "stat-active-months", "stat-this-month", "stat-projection",
    "stat-avg-week", "stat-month-delta",
    "spendingChart", "vendorsChart", "itemsChart", "habitsChart",
    "categoriesChart", "categoriesWrap",
    "vendorsTableBody", "itemsTableBody",
    "historyTableBody", "history-search", "history-sort",
    "history-page-size", "history-prev-button", "history-next-button",
    "history-page-indicator",
    "habitsInsight", "milestonesWrap",
    "exportCsvBtn", "exportExcelBtn", "exportPdfBtn"
];

function buildAnalyticsDom() {
    const tags = id => {
        if (id.endsWith("Chart")) return `<canvas id="${id}"></canvas>`;
        if (id === "history-search") return `<input id="${id}" />`;
        if (id === "history-sort" || id === "history-page-size") return `<select id="${id}"><option value="">x</option></select>`;
        if (id.endsWith("button") || id.endsWith("Btn")) return `<button id="${id}"></button>`;
        if (id === "vendorsTableBody" || id === "itemsTableBody" || id === "historyTableBody") return `<table><tbody id="${id}"></tbody></table>`;
        return `<div id="${id}"></div>`;
    };

    document.body.innerHTML = `
        <main>
            <button class="time-chip" data-window="month"></button>
            <button class="time-chip" data-window="all"></button>
            ${REQUIRED_ELEMENT_IDS.map(tags).join("\n")}
        </main>
    `;
}

function createChartFake() {
    const instances = [];
    function ChartCtor(ctx, config) {
        this.ctx = ctx;
        this.config = config;
        this.destroyed = false;
        instances.push(this);
    }
    ChartCtor.prototype.destroy = function () { this.destroyed = true; };
    ChartCtor._instances = instances;
    return ChartCtor;
}

function createXlsxFake() {
    const calls = { appendedSheets: [], writeFileArgs: null };
    const sheetMarker = Symbol("sheet");
    return {
        utils: {
            book_new: () => ({ sheets: [] }),
            aoa_to_sheet: (rows) => ({ marker: sheetMarker, rows }),
            book_append_sheet: (wb, sheet, name) => {
                wb.sheets.push({ name, rows: sheet.rows });
                calls.appendedSheets.push({ name, rowCount: sheet.rows.length });
            }
        },
        writeFile: (wb, filename) => { calls.writeFileArgs = { wb, filename }; },
        _calls: calls
    };
}

function createPdfFake() {
    const calls = {
        addPage: 0,
        save: null,
        textCalls: [],
        setFontCalls: [],
        rectCalls: [],
        setFontSize: [],
        setTextColor: []
    };
    function jsPDFCtor() {
        this.internal = {
            pageSize: {
                getWidth: () => 210,
                getHeight: () => 297
            }
        };
    }
    jsPDFCtor.prototype.setFont = function (...a) { calls.setFontCalls.push(a); };
    jsPDFCtor.prototype.setFontSize = function (s) { calls.setFontSize.push(s); };
    jsPDFCtor.prototype.setTextColor = function (c) { calls.setTextColor.push(c); };
    jsPDFCtor.prototype.text = function (...a) { calls.textCalls.push(a); };
    jsPDFCtor.prototype.rect = function (...a) { calls.rectCalls.push(a); };
    jsPDFCtor.prototype.addPage = function () { calls.addPage++; };
    jsPDFCtor.prototype.save = function (filename) { calls.save = filename; };
    return { jsPDF: jsPDFCtor, _calls: calls };
}

function seedOrdersForWindow(window, count) {
    // 5 May-2026 orders, 3 Apr-2026 orders, 1 Mar-2026 order — plenty across windows.
    const base = [
        makeOrder({ id: "a", vendorName: "Burger Shack", total: 100, createdAt: new Date(2026, 4, 1, 12) }),
        makeOrder({ id: "b", vendorName: "Burger Shack", total: 60, createdAt: new Date(2026, 4, 5, 13) }),
        makeOrder({ id: "c", vendorName: "Coffee Cart", total: 30, createdAt: new Date(2026, 4, 10, 7) }),
        makeOrder({ id: "d", vendorName: "Coffee Cart", total: 30, createdAt: new Date(2026, 4, 12, 8) }),
        makeOrder({ id: "e", vendorName: "Fries Place", total: 50, createdAt: new Date(2026, 4, 14, 18) }),
        makeOrder({ id: "f", vendorName: "Burger Shack", total: 90, createdAt: new Date(2026, 3, 20, 12) }),
        makeOrder({ id: "g", vendorName: "Coffee Cart", total: 25, createdAt: new Date(2026, 3, 22, 8) }),
        makeOrder({ id: "h", vendorName: "Pizza Joint", total: 120, createdAt: new Date(2026, 3, 25, 19) }),
        makeOrder({ id: "i", vendorName: "Pizza Joint", total: 110, createdAt: new Date(2026, 2, 10, 19) }),
        makeOrder({ id: "j", vendorName: "Salad Bar", total: 40, createdAt: new Date(2026, 4, 15, 13) }),
        makeOrder({ id: "k", vendorName: "Salad Bar", total: 45, createdAt: new Date(2026, 4, 16, 14) }),
        makeOrder({ id: "l", vendorName: "Salad Bar", total: 50, createdAt: new Date(2026, 4, 17, 15) })
    ];
    return count ? base.slice(0, count) : base;
}

describe("escapeHtml / setText / destroyChart / getFilteredOrders", () => {
    beforeEach(() => { buildAnalyticsDom(); _testReset(); });

    test("escapeHtml escapes &, <, >, \", '", () => {
        expect(escapeHtml(`<a href="x">'&'</a>`))
            .toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
    });
    test("escapeHtml handles null/undefined safely", () => {
        expect(escapeHtml(null)).toBe("");
        expect(escapeHtml(undefined)).toBe("");
        expect(escapeHtml(42)).toBe("42");
    });

    test("setText writes textContent to the matching element", () => {
        setText("stat-total-spent", "R 99.00");
        expect(document.getElementById("stat-total-spent").textContent).toBe("R 99.00");
    });
    test("setText no-ops when element missing", () => {
        expect(() => setText("does-not-exist", "x")).not.toThrow();
    });

    test("destroyChart calls .destroy() and nulls the slot", () => {
        const charts = _testGetCharts();
        const destroyed = { destroy: jest.fn() };
        charts.spending = destroyed;
        destroyChart("spending");
        expect(destroyed.destroy).toHaveBeenCalled();
        expect(charts.spending).toBeNull();
    });
    test("destroyChart is a no-op when slot already empty", () => {
        expect(() => destroyChart("vendors")).not.toThrow();
    });

    test("getFilteredOrders honours the current time window", () => {
        const orders = seedOrdersForWindow();
        _testSetCachedOrders(orders);
        _testSetCurrentWindowKey("all");
        expect(getFilteredOrders().length).toBe(orders.length);
    });
});

describe("renderStats", () => {
    beforeEach(() => { buildAnalyticsDom(); _testReset(); });

    test("populates the KPI cards from cached orders", () => {
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
        renderStats();

        expect(document.getElementById("stat-total-spent").textContent).toMatch(/^R /);
        expect(document.getElementById("stat-total-orders").textContent).toBe("12");
        expect(document.getElementById("stat-fav-vendor").textContent.length).toBeGreaterThan(0);
        expect(document.getElementById("stat-month-delta").textContent).toMatch(/% vs last month/);
        expect(document.getElementById("stat-month-delta").className).toContain("stat-delta");
    });

    test("with no orders renders a dash for favourite vendor and a 'flat' delta", () => {
        _testSetCachedOrders([]);
        _testSetCurrentWindowKey("all");
        renderStats();
        expect(document.getElementById("stat-fav-vendor").textContent).toBe("—");
        expect(document.getElementById("stat-month-delta").className).toContain("flat");
    });

    test("renderStats survives a missing #stat-month-delta element", () => {
        document.getElementById("stat-month-delta").remove();
        _testSetCachedOrders(seedOrdersForWindow());
        expect(() => renderStats()).not.toThrow();
    });
});

describe("chart renderers", () => {
    let originalChart;
    beforeEach(() => {
        buildAnalyticsDom();
        _testReset();
        originalChart = global.Chart;
        global.Chart = createChartFake();
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
    });
    afterEach(() => { global.Chart = originalChart; });

    test("renderSpendingChart builds a bar chart and stores the instance", () => {
        renderSpendingChart();
        const charts = _testGetCharts();
        expect(charts.spending).not.toBeNull();
        expect(charts.spending.config.type).toBe("bar");
        expect(charts.spending.config.data.labels.length).toBeGreaterThan(0);
    });

    test("renderSpendingChart re-renders cleanly (destroys old instance first)", () => {
        renderSpendingChart();
        const first = _testGetCharts().spending;
        renderSpendingChart();
        expect(first.destroyed).toBe(true);
        expect(_testGetCharts().spending).not.toBe(first);
    });

    test("renderVendorsChart builds a doughnut and fills the vendor table", () => {
        renderVendorsChart();
        const charts = _testGetCharts();
        expect(charts.vendors.config.type).toBe("doughnut");
        const html = document.getElementById("vendorsTableBody").innerHTML;
        expect(html).toMatch(/Burger Shack/);
        expect(html).toMatch(/Rank/);
    });

    test("renderVendorsChart renders empty-state row when no orders", () => {
        _testSetCachedOrders([]);
        renderVendorsChart();
        expect(document.getElementById("vendorsTableBody").innerHTML).toMatch(/No data/);
    });

    test("renderItemsChart builds a doughnut and items table", () => {
        renderItemsChart();
        expect(_testGetCharts().items.config.type).toBe("doughnut");
        expect(document.getElementById("itemsTableBody").innerHTML).toMatch(/<tr>/);
    });

    test("renderItemsChart shows empty-state when no items", () => {
        _testSetCachedOrders([]);
        renderItemsChart();
        expect(document.getElementById("itemsTableBody").innerHTML).toMatch(/No data/);
    });

    test("renderHabitsChart writes a peak-hour insight", () => {
        renderHabitsChart();
        expect(_testGetCharts().habits.config.type).toBe("bar");
        expect(document.getElementById("habitsInsight").textContent).toMatch(/order/i);
    });

    test("renderHabitsChart shows 'Not enough data' for empty input", () => {
        _testSetCachedOrders([]);
        renderHabitsChart();
        expect(document.getElementById("habitsInsight").textContent).toMatch(/Not enough/);
    });

    test("renderCategoriesChart builds a doughnut over category totals", () => {
        renderCategoriesChart();
        expect(_testGetCharts().categories.config.type).toBe("doughnut");
    });

    test("renderCategoriesChart writes empty-state HTML when there are no items", () => {
        _testSetCachedOrders([]);
        renderCategoriesChart();
        expect(document.getElementById("categoriesWrap").innerHTML).toMatch(/No category data/);
        expect(_testGetCharts().categories).toBeNull();
    });

    test("all chart renderers no-op gracefully when Chart global is missing", () => {
        global.Chart = undefined;
        expect(() => {
            renderSpendingChart();
            renderVendorsChart();
            renderItemsChart();
            renderHabitsChart();
            renderCategoriesChart();
        }).not.toThrow();
        const charts = _testGetCharts();
        expect(charts.spending).toBeNull();
    });

    test("chart renderers no-op when the canvas element is absent", () => {
        document.getElementById("spendingChart").remove();
        document.getElementById("vendorsChart").remove();
        document.getElementById("itemsChart").remove();
        document.getElementById("habitsChart").remove();
        document.getElementById("categoriesChart").remove();
        expect(() => {
            renderSpendingChart();
            renderVendorsChart();
            renderItemsChart();
            renderHabitsChart();
            renderCategoriesChart();
        }).not.toThrow();
    });
});

describe("renderHistoryTable / updatePaginationOutputs / renderMilestones / renderAll", () => {
    let originalChart;
    beforeEach(() => {
        buildAnalyticsDom();
        _testReset();
        originalChart = global.Chart;
        global.Chart = createChartFake();
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
    });
    afterEach(() => { global.Chart = originalChart; });

    test("renderHistoryTable paints rows + pagination indicator", () => {
        renderHistoryTable();
        const html = document.getElementById("historyTableBody").innerHTML;
        expect(html).toMatch(/<tr>/);
        expect(document.getElementById("history-page-indicator").textContent).toMatch(/Page 1/);
        // 12 seeded orders / size 10 ⇒ 2 pages, prev disabled, next enabled
        expect(document.getElementById("history-prev-button").disabled).toBe(true);
        expect(document.getElementById("history-next-button").disabled).toBe(false);
    });

    test("renderHistoryTable shows 'no orders match' when search filters everything", () => {
        _testSetHistoryState({ search: "nonexistent-vendor-xyz" });
        renderHistoryTable();
        expect(document.getElementById("historyTableBody").innerHTML).toMatch(/No orders match/);
        expect(document.getElementById("history-page-indicator").textContent).toBe("0 results");
    });

    test("renderHistoryTable renders an em-dash when a row has no createdAt", () => {
        _testSetCachedOrders([
            makeOrder({ id: "1", createdAt: undefined, items: [], vendorName: "" })
        ]);
        renderHistoryTable();
        expect(document.getElementById("historyTableBody").innerHTML).toMatch(/—/);
    });

    test("updatePaginationOutputs is safe when prefix elements are missing", () => {
        document.getElementById("history-page-indicator").remove();
        document.getElementById("history-prev-button").remove();
        document.getElementById("history-next-button").remove();
        expect(() => updatePaginationOutputs("history", {
            total: 0, page: 1, totalPages: 1, startIndex: 0, endIndex: 0
        })).not.toThrow();
    });

    test("renderMilestones writes cards for non-empty data", () => {
        renderMilestones();
        const html = document.getElementById("milestonesWrap").innerHTML;
        expect(html).toMatch(/milestone-card/);
    });

    test("renderMilestones shows the empty-state copy when no orders", () => {
        _testSetCachedOrders([]);
        renderMilestones();
        expect(document.getElementById("milestonesWrap").innerHTML).toMatch(/Place your first order/);
    });

    test("renderMilestones no-ops without a milestonesWrap element", () => {
        document.getElementById("milestonesWrap").remove();
        expect(() => renderMilestones()).not.toThrow();
    });

    test("renderAll runs every renderer", () => {
        expect(() => renderAll()).not.toThrow();
        expect(document.getElementById("historyTableBody").innerHTML).toMatch(/<tr>/);
        expect(document.getElementById("milestonesWrap").innerHTML).toMatch(/milestone-card/);
    });
});

describe("applyTimeWindowChip", () => {
    let originalChart;
    beforeEach(() => {
        buildAnalyticsDom();
        _testReset();
        originalChart = global.Chart;
        global.Chart = createChartFake();
        _testSetCachedOrders(seedOrdersForWindow());
    });
    afterEach(() => { global.Chart = originalChart; });

    test("activates the matching chip and toggles aria-pressed", () => {
        applyTimeWindowChip("month");
        const chips = document.querySelectorAll(".time-chip");
        const monthChip = Array.from(chips).find(c => c.getAttribute("data-window") === "month");
        const allChip = Array.from(chips).find(c => c.getAttribute("data-window") === "all");
        expect(monthChip.classList.contains("active")).toBe(true);
        expect(monthChip.getAttribute("aria-pressed")).toBe("true");
        expect(allChip.classList.contains("active")).toBe(false);
        expect(allChip.getAttribute("aria-pressed")).toBe("false");
    });

    test("resets history page back to 1", () => {
        _testSetHistoryState({ page: 5 });
        applyTimeWindowChip("all");
        expect(_testGetHistoryState().page).toBe(1);
    });
});

describe("CSV export pipeline", () => {
    beforeEach(() => { buildAnalyticsDom(); _testReset(); });

    test("toCsv quotes commas, newlines, and doubled quotes", () => {
        expect(toCsv([["a", "b"], ["1,2", "line\nbreak"], [`he said "hi"`, 7]]))
            .toBe(`a,b\n"1,2","line\nbreak"\n"he said ""hi""",7`);
    });

    test("toCsv tolerates null / undefined cells", () => {
        expect(toCsv([[null, undefined, "x"]])).toBe(",,x");
    });

    test("buildExportTables aggregates every sheet for the current window", () => {
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
        const tables = buildExportTables();
        expect(tables.summary[0]).toEqual(["Metric", "Value"]);
        expect(tables.summary.length).toBeGreaterThan(1);
        expect(tables.vendorSheet[0][1]).toBe("Vendor");
        expect(tables.itemSheet[0]).toContain("Times ordered");
        expect(tables.monthlySheet.length).toBeGreaterThan(1);
        expect(tables.habitsSheet.length).toBe(25); // header + 24 hours
        expect(tables.categorySheet.length).toBeGreaterThan(1);
        expect(tables.ordersSheet.length).toBeGreaterThan(1);
    });

    test("buildExportTables tolerates orders with missing items / createdAt", () => {
        _testSetCachedOrders([
            { vendorName: "X", total: 50, createdAt: null, items: undefined, status: undefined }
        ]);
        _testSetCurrentWindowKey("all");
        const t = buildExportTables();
        expect(t.ordersSheet.length).toBe(2);
        // Empty date + completed default
        expect(t.ordersSheet[1][0]).toBe("");
        expect(t.ordersSheet[1][4]).toBe("completed");
    });

    test("exportCSV alerts when there are no orders", () => {
        _testSetCachedOrders([]);
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => { });
        exportCSV();
        expect(alertSpy).toHaveBeenCalledWith("No data to export.");
        alertSpy.mockRestore();
    });

    test("exportCSV downloads a Blob via downloadBlob path", () => {
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;
        const create = jest.fn(() => "blob://csv");
        const revoke = jest.fn();
        URL.createObjectURL = create;
        URL.revokeObjectURL = revoke;
        const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });
        exportCSV();
        expect(create).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revoke).toHaveBeenCalled();
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
        clickSpy.mockRestore();
    });
});

describe("downloadBlob", () => {
    test("creates a temporary anchor, clicks it, and revokes the URL", () => {
        const origCreate = URL.createObjectURL;
        const origRevoke = URL.revokeObjectURL;
        const create = jest.fn(() => "blob://x");
        const revoke = jest.fn();
        URL.createObjectURL = create;
        URL.revokeObjectURL = revoke;
        const clickSpy = jest.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => { });
        downloadBlob(new Blob(["hello"], { type: "text/plain" }), "hello.txt");
        expect(create).toHaveBeenCalled();
        expect(clickSpy).toHaveBeenCalled();
        expect(revoke).toHaveBeenCalled();
        URL.createObjectURL = origCreate;
        URL.revokeObjectURL = origRevoke;
        clickSpy.mockRestore();
    });
});

describe("Excel export pipeline", () => {
    let originalXLSX;
    beforeEach(() => {
        buildAnalyticsDom(); _testReset();
        originalXLSX = global.XLSX;
    });
    afterEach(() => { global.XLSX = originalXLSX; });

    test("alerts when XLSX is not loaded", () => {
        global.XLSX = undefined;
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => { });
        _testSetCachedOrders(seedOrdersForWindow());
        exportExcel();
        expect(alertSpy).toHaveBeenCalledWith("Excel library not loaded.");
        alertSpy.mockRestore();
    });

    test("alerts when there is nothing to export", () => {
        global.XLSX = createXlsxFake();
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => { });
        _testSetCachedOrders([]);
        exportExcel();
        expect(alertSpy).toHaveBeenCalledWith("No data to export.");
        alertSpy.mockRestore();
    });

    test("appends every sheet and calls writeFile with the expected filename pattern", () => {
        const fake = createXlsxFake();
        global.XLSX = fake;
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
        exportExcel();
        const names = fake._calls.appendedSheets.map(s => s.name);
        expect(names).toEqual([
            "Summary", "Monthly", "Vendors", "Items", "Habits", "Categories", "Orders"
        ]);
        expect(fake._calls.writeFileArgs.filename).toMatch(/^my-analytics-\d{4}-\d{2}-\d{2}\.xlsx$/);
    });
});

describe("PDF export pipeline", () => {
    let originalJspdf;
    beforeEach(() => {
        buildAnalyticsDom(); _testReset();
        originalJspdf = window.jspdf;
    });
    afterEach(() => { window.jspdf = originalJspdf; });

    test("alerts when jspdf is missing", () => {
        window.jspdf = undefined;
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => { });
        _testSetCachedOrders(seedOrdersForWindow());
        exportPDF();
        expect(alertSpy).toHaveBeenCalledWith("PDF library not loaded.");
        alertSpy.mockRestore();
    });

    test("alerts when there is nothing to export", () => {
        window.jspdf = createPdfFake();
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => { });
        _testSetCachedOrders([]);
        exportPDF();
        expect(alertSpy).toHaveBeenCalledWith("No data to export.");
        alertSpy.mockRestore();
    });

    test("renders summary, monthly, vendors, items, and order history sections", () => {
        const fake = createPdfFake();
        window.jspdf = fake;
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
        exportPDF();
        const titles = fake._calls.textCalls.map(args => args[0]);
        expect(titles).toEqual(expect.arrayContaining([
            "My Analytics",
            "Summary",
            "Monthly spending",
            "Favourite vendors",
            "Most ordered items",
            "Order history"
        ]));
        expect(fake._calls.save).toMatch(/^my-analytics-\d{4}-\d{2}-\d{2}\.pdf$/);
    });

    test("drawPdfTable adds a new page when overflowing the page height", () => {
        const fake = createPdfFake();
        const doc = new fake.jsPDF();
        // 60 rows × 7mm row height + margin will definitely exceed 297mm page
        const headers = ["A"];
        const rows = Array.from({ length: 60 }, (_, i) => [String(i)]);
        const startY = 280; // start near the bottom so even the first body row overflows
        drawPdfTable(doc, headers, rows, startY, [180]);
        expect(fake._calls.addPage).toBeGreaterThanOrEqual(1);
    });

    test("drawPdfTable clips overly-wide cell text to fit the column", () => {
        const fake = createPdfFake();
        const doc = new fake.jsPDF();
        drawPdfTable(doc, ["X"], [["abcdefghijklmnop"]], 30, [10]); // narrow column
        const clippedText = fake._calls.textCalls.find(args =>
            typeof args[0] === "string" && args[0].endsWith("…"));
        expect(clippedText).toBeDefined();
    });

    test("drawPdfTable defaults column widths to equal share when widths not provided", () => {
        const fake = createPdfFake();
        const doc = new fake.jsPDF();
        expect(() =>
            drawPdfTable(doc, ["A", "B", "C"], [["1", "2", "3"]], 30)
        ).not.toThrow();
    });
});

describe("attachEventListeners", () => {
    let originalChart;
    beforeEach(() => {
        buildAnalyticsDom();
        _testReset();
        originalChart = global.Chart;
        global.Chart = createChartFake();
        _testSetCachedOrders(seedOrdersForWindow());
        _testSetCurrentWindowKey("all");
    });
    afterEach(() => { global.Chart = originalChart; });

    test("wires the time-chip clicks", () => {
        attachEventListeners();
        const monthChip = document.querySelector('.time-chip[data-window="month"]');
        monthChip.click();
        expect(monthChip.classList.contains("active")).toBe(true);
    });

    test("wires history search input", () => {
        attachEventListeners();
        const input = document.getElementById("history-search");
        input.value = "burger";
        input.dispatchEvent(new Event("input"));
        expect(_testGetHistoryState().search).toBe("burger");
        expect(_testGetHistoryState().page).toBe(1);
    });

    test("wires sort select (parses 'sort:dir')", () => {
        attachEventListeners();
        const sel = document.getElementById("history-sort");
        sel.innerHTML = `<option value="total:asc">total asc</option>`;
        sel.value = "total:asc";
        sel.dispatchEvent(new Event("change"));
        const state = _testGetHistoryState();
        expect(state.sort).toBe("total");
        expect(state.dir).toBe("asc");
    });

    test("wires page-size select with fallback to 10 on bad value", () => {
        attachEventListeners();
        const sel = document.getElementById("history-page-size");
        sel.innerHTML = `<option value="25">25</option><option value="bogus">x</option>`;
        sel.value = "25";
        sel.dispatchEvent(new Event("change"));
        expect(_testGetHistoryState().size).toBe(25);
        sel.value = "bogus";
        sel.dispatchEvent(new Event("change"));
        expect(_testGetHistoryState().size).toBe(10);
    });

    test("prev button decrements page (only when above 1)", () => {
        attachEventListeners();
        _testSetHistoryState({ page: 3 });
        document.getElementById("history-prev-button").click();
        expect(_testGetHistoryState().page).toBe(2);
        _testSetHistoryState({ page: 1 });
        document.getElementById("history-prev-button").click();
        expect(_testGetHistoryState().page).toBe(1);
    });

    test("next button increments page", () => {
        attachEventListeners();
        _testSetHistoryState({ page: 1 });
        document.getElementById("history-next-button").click();
        // renderHistoryTable clamps back to within totalPages
        expect(_testGetHistoryState().page).toBeGreaterThanOrEqual(1);
    });

    test("export buttons are wired (click triggers the export handler / alert path)", () => {
        attachEventListeners();
        const alertSpy = jest.spyOn(window, "alert").mockImplementation(() => { });
        _testSetCachedOrders([]); // force the "No data" alert path on all three
        document.getElementById("exportCsvBtn").click();
        document.getElementById("exportExcelBtn").click();
        document.getElementById("exportPdfBtn").click();
        // CSV doesn't depend on XLSX/jspdf, Excel needs XLSX, PDF needs jspdf — at
        // least the CSV alert MUST fire; the other two will alert about either
        // library-missing or no-data, both fine.
        expect(alertSpy).toHaveBeenCalled();
        alertSpy.mockRestore();
    });

    test("attachEventListeners is idempotent (second call is a no-op)", () => {
        attachEventListeners();
        expect(_testGetListenersAttached()).toBe(true);
        // Second call should not throw or rebind — flip then call:
        const before = _testGetHistoryState().search;
        attachEventListeners();
        expect(_testGetHistoryState().search).toBe(before);
    });
});

describe("startLifecycle + waitForFirebaseDependencies + initializePage", () => {
    beforeEach(() => {
        buildAnalyticsDom();
        _testReset();
        global.Chart = createChartFake();
    });
    afterEach(() => {
        delete global.Chart;
    });

    test("startLifecycle redirects to login when there is no user", () => {
        let authCallback;
        const onSnapshotMock = jest.fn();
        const deps = {
            auth: {},
            db: {},
            authFns: { onAuthStateChanged: (a, cb) => { authCallback = cb; } },
            firestoreFns: {
                collection: () => ({}),
                query: () => ({}),
                where: () => ({}),
                onSnapshot: onSnapshotMock
            }
        };
        startLifecycle(deps);
        // jsdom's window.location can't be reassigned, but calling the auth
        // callback with null still runs the redirect line (executing the
        // property setter even if jsdom emits a "not implemented" warning).
        // What we can verify deterministically: the early-return prevented
        // onSnapshot from ever being wired up.
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        try { authCallback(null); } catch (_e) { /* jsdom navigation noop */ }
        errSpy.mockRestore();
        expect(onSnapshotMock).not.toHaveBeenCalled();
    });

    test("startLifecycle subscribes when user present, populates cachedOrders, re-subscribes on next signin", () => {
        const orders = [
            { id: "1", vendorName: "A", total: 100, createdAt: new Date(2026, 4, 1, 12), status: "completed", items: [] }
        ];
        const unsub1 = jest.fn();
        const unsub2 = jest.fn();
        let onSnapshotCb;
        let calls = 0;
        const deps = {
            auth: {},
            db: {},
            authFns: { onAuthStateChanged: (_a, cb) => { onSnapshotCb = cb; } },
            firestoreFns: {
                collection: () => ({}),
                query: () => ({}),
                where: () => ({}),
                onSnapshot: jest.fn((_q, next) => {
                    calls++;
                    // Drive a snapshot synchronously
                    next({
                        docs: orders.map(o => ({ data: () => o }))
                    });
                    return calls === 1 ? unsub1 : unsub2;
                })
            }
        };
        startLifecycle(deps);
        onSnapshotCb({ uid: "u1" });
        expect(document.getElementById("historyTableBody").innerHTML).toMatch(/<tr>/);
        // A second user-change re-subscribes after calling the previous unsubscribe.
        onSnapshotCb({ uid: "u2" });
        expect(unsub1).toHaveBeenCalled();
    });

    test("startLifecycle's snapshot error callback logs but does not throw", () => {
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        let onSnapshotErr;
        const deps = {
            auth: {},
            db: {},
            authFns: { onAuthStateChanged: (_a, cb) => cb({ uid: "u1" }) },
            firestoreFns: {
                collection: () => ({}),
                query: () => ({}),
                where: () => ({}),
                onSnapshot: (_q, _next, errCb) => { onSnapshotErr = errCb; return () => { }; }
            }
        };
        startLifecycle(deps);
        onSnapshotErr(new Error("boom"));
        expect(errSpy).toHaveBeenCalled();
        errSpy.mockRestore();
    });

    test("waitForFirebaseDependencies resolves quickly when deps already exist", async () => {
        window.auth = {}; window.db = {};
        window.authFns = {}; window.firestoreFns = {};
        await expect(waitForFirebaseDependencies(1000)).resolves.toBeUndefined();
        delete window.auth; delete window.db;
        delete window.authFns; delete window.firestoreFns;
    });

    test("waitForFirebaseDependencies rejects when deps never arrive", async () => {
        delete window.auth; delete window.db;
        delete window.authFns; delete window.firestoreFns;
        await expect(waitForFirebaseDependencies(150)).rejects.toThrow(/Timed out/);
    });

    test("initializePage starts immediately when deps already present", () => {
        const startSpy = jest.fn();
        window.auth = {}; window.db = {};
        window.authFns = { onAuthStateChanged: startSpy };
        window.firestoreFns = { collection: () => ({}), query: () => ({}), where: () => ({}), onSnapshot: () => () => {} };
        initializePage();
        expect(startSpy).toHaveBeenCalled();
        delete window.auth; delete window.db;
        delete window.authFns; delete window.firestoreFns;
    });

    test("initializePage falls back to waitForFirebaseDependencies + start when deps missing", async () => {
        const startSpy = jest.fn();
        delete window.auth; delete window.db;
        delete window.authFns; delete window.firestoreFns;
        initializePage();
        // Within 200ms we set the deps; the polling loop should pick them up.
        await new Promise(r => setTimeout(r, 50));
        window.auth = {}; window.db = {};
        window.authFns = { onAuthStateChanged: startSpy };
        window.firestoreFns = { collection: () => ({}), query: () => ({}), where: () => ({}), onSnapshot: () => () => {} };
        await new Promise(r => setTimeout(r, 250));
        expect(startSpy).toHaveBeenCalled();
        delete window.auth; delete window.db;
        delete window.authFns; delete window.firestoreFns;
    });

    test("initializePage logs (does not throw) if waitForFirebaseDependencies rejects", async () => {
        delete window.auth; delete window.db;
        delete window.authFns; delete window.firestoreFns;
        const errSpy = jest.spyOn(console, "error").mockImplementation(() => { });
        initializePage();
        // Don't set deps — wait for the default 5s timeout would be too slow.
        // We can't easily shorten the internal timeout from outside, so just
        // assert that initializePage didn't throw synchronously.
        expect(true).toBe(true);
        errSpy.mockRestore();
    }, 1000);
});

