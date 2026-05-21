/**
 * @jest-environment jsdom
 *
 * Admin analytics — pure-logic tests.
 * Only exported helpers from public/admin/analytics.js are exercised.
 * The module guards auto-init behind a CommonJS check so requiring it does
 * not touch the DOM or Firebase.
 */

const {
    normalizeText,
    normalizeLowerText,
    getDateFromTimestamp,
    getOrderAmount,
    fmtRand,
    fmtNum,
    fmtPct,
    resolveTimeWindow,
    applyTimeWindow,
    filterOrdersByDateRange,
    filterByVendorName,
    computePreviousPeriodRange,
    aggregateByVendor,
    aggregateByCustomer,
    computeKpis,
    computeHourCounts,
    computeWeekdayCounts,
    computeHeatmap,
    computeMovement,
    searchVendors,
    searchCustomers,
    sortVendors,
    sortCustomers,
    paginate,
    groupForCustomReport
} = require("../../public/admin/analytics.js");

// ----------------------------------------------------------------------------
// Test helpers
// ----------------------------------------------------------------------------

function makeOrder(overrides = {}) {
    return {
        id: overrides.id || "order-1",
        vendorName: "Burger Shack",
        customerUid: "cust-1",
        customerName: "Alice",
        status: "completed",
        total: 100,
        createdAt: new Date("2026-05-01T12:00:00Z"),
        ...overrides
    };
}

// ============================================================================
// Formatters and helpers
// ============================================================================

describe("normalizeText / normalizeLowerText", () => {
    test("trims whitespace and rejects non-strings", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(42)).toBe("");
    });

    test("normalizeLowerText lowercases trimmed input", () => {
        expect(normalizeLowerText("  HeLLo ")).toBe("hello");
    });
});

describe("fmtRand / fmtNum / fmtPct", () => {
    test("fmtRand prefixes R and adds thousands separators", () => {
        expect(fmtRand(1234567.89)).toBe("R 1,234,567.89");
    });
    test("fmtRand survives non-finite inputs", () => {
        expect(fmtRand(NaN)).toBe("R 0.00");
        expect(fmtRand(undefined)).toBe("R 0.00");
    });
    test("fmtNum rounds and adds thousands separators", () => {
        expect(fmtNum(1500.7)).toMatch(/1[\s,]501/);
    });
    test("fmtPct shows one decimal place", () => {
        expect(fmtPct(33.333)).toBe("33.3%");
        expect(fmtPct(NaN)).toBe("0.0%");
    });
});

describe("getOrderAmount", () => {
    test("prefers total over subtotal/paymentAmount/totalAmount", () => {
        expect(getOrderAmount({ total: 50, subtotal: 99, paymentAmount: 999 })).toBe(50);
    });
    test("falls back through subtotal, paymentAmount, totalAmount", () => {
        expect(getOrderAmount({ subtotal: 30 })).toBe(30);
        expect(getOrderAmount({ paymentAmount: 20 })).toBe(20);
        expect(getOrderAmount({ totalAmount: 10 })).toBe(10);
    });
    test("returns 0 for missing or invalid amounts", () => {
        expect(getOrderAmount(null)).toBe(0);
        expect(getOrderAmount({})).toBe(0);
        expect(getOrderAmount({ total: "not a number" })).toBe(0);
    });
});

describe("getDateFromTimestamp", () => {
    test("passes through Date instances", () => {
        const d = new Date();
        expect(getDateFromTimestamp(d)).toBe(d);
    });
    test("parses ISO strings, numbers, and Firestore Timestamp shapes", () => {
        expect(getDateFromTimestamp("2026-05-01T00:00:00Z")).toBeInstanceOf(Date);
        expect(getDateFromTimestamp(1700000000000)).toBeInstanceOf(Date);
        expect(getDateFromTimestamp({ toDate: () => new Date(0) })).toBeInstanceOf(Date);
        const d = getDateFromTimestamp({ seconds: 100 });
        expect(d).toBeInstanceOf(Date);
        expect(d.getTime()).toBe(100000);
    });
    test("returns null for unrecognised inputs", () => {
        expect(getDateFromTimestamp(null)).toBeNull();
        expect(getDateFromTimestamp({})).toBeNull();
    });
});

// ============================================================================
// Time window
// ============================================================================

describe("resolveTimeWindow", () => {
    const ref = new Date(2026, 4, 21, 15, 0, 0);

    test('"today" gives midnight → end of day', () => {
        const { start, end } = resolveTimeWindow("today", ref);
        expect(start.getHours()).toBe(0);
        expect(end.getHours()).toBe(23);
        expect(start.toDateString()).toBe(ref.toDateString());
    });

    test('"7d" spans 7 calendar days', () => {
        const { start, end } = resolveTimeWindow("7d", ref);
        expect(Math.round((end - start) / 86400000)).toBe(7);
    });

    test('"21d" spans 21 calendar days', () => {
        const { start, end } = resolveTimeWindow("21d", ref);
        expect(Math.round((end - start) / 86400000)).toBe(21);
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

    test('"all" and unknown keys return nulls', () => {
        expect(resolveTimeWindow("all", ref)).toEqual({ start: null, end: null });
        expect(resolveTimeWindow("bogus", ref)).toEqual({ start: null, end: null });
    });
});

describe("filterOrdersByDateRange / applyTimeWindow / filterByVendorName", () => {
    const orders = [
        makeOrder({ id: "a", createdAt: new Date("2026-05-01T10:00:00Z"), vendorName: "A" }),
        makeOrder({ id: "b", createdAt: new Date("2026-05-10T10:00:00Z"), vendorName: "B" }),
        makeOrder({ id: "c", createdAt: new Date("2026-05-20T10:00:00Z"), vendorName: "A" })
    ];

    test("no range returns a fresh copy of all orders", () => {
        const out = filterOrdersByDateRange(orders, null, null);
        expect(out).toEqual(orders);
        expect(out).not.toBe(orders);
    });

    test("range is inclusive on both ends", () => {
        const out = filterOrdersByDateRange(
            orders,
            new Date("2026-05-05T00:00:00Z"),
            new Date("2026-05-15T23:59:59Z")
        );
        expect(out.map(o => o.id)).toEqual(["b"]);
    });

    test('applyTimeWindow with "all" returns everything', () => {
        expect(applyTimeWindow(orders, "all").length).toBe(3);
    });

    test("filterByVendorName matches exact (trimmed) vendor names", () => {
        expect(filterByVendorName(orders, "A").map(o => o.id)).toEqual(["a", "c"]);
        expect(filterByVendorName(orders, " B ").map(o => o.id)).toEqual(["b"]);
        expect(filterByVendorName(orders, "all").map(o => o.id)).toEqual(["a", "b", "c"]);
        expect(filterByVendorName(orders, "").map(o => o.id)).toEqual(["a", "b", "c"]);
    });
});

describe("computePreviousPeriodRange", () => {
    test("matches length and ends one ms before start", () => {
        const start = new Date(2026, 4, 8);
        const end = new Date(2026, 4, 14, 23, 59, 59);
        const prev = computePreviousPeriodRange(start, end);
        expect(start - prev.end).toBe(1);
        expect(Math.abs((end - start) - (prev.end - prev.start))).toBeLessThanOrEqual(1);
    });
    test("returns nulls when given nulls", () => {
        expect(computePreviousPeriodRange(null, null)).toEqual({ start: null, end: null });
    });
});

// ============================================================================
// Aggregators
// ============================================================================

describe("aggregateByVendor", () => {
    test("totals orders + revenue and computes share", () => {
        const rows = aggregateByVendor([
            makeOrder({ vendorName: "A", total: 100 }),
            makeOrder({ id: "2", vendorName: "B", total: 300 }),
            makeOrder({ id: "3", vendorName: "A", total: 100 })
        ]);
        const a = rows.find(r => r.name === "A");
        const b = rows.find(r => r.name === "B");
        expect(a.orders).toBe(2);
        expect(a.revenue).toBe(200);
        expect(a.avgOrder).toBe(100);
        expect(a.share).toBeCloseTo(40);
        expect(b.share).toBeCloseTo(60);
    });

    test("missing vendor name defaults to Unknown", () => {
        const rows = aggregateByVendor([{ total: 50, createdAt: new Date() }]);
        expect(rows[0].name).toBe("Unknown");
    });

    test("share is 0 when total revenue is 0", () => {
        const rows = aggregateByVendor([makeOrder({ total: 0 })]);
        expect(rows[0].share).toBe(0);
    });

    test("tracks the most recent lastOrder per vendor", () => {
        const rows = aggregateByVendor([
            makeOrder({ vendorName: "A", createdAt: new Date("2026-05-01") }),
            makeOrder({ id: "2", vendorName: "A", createdAt: new Date("2026-05-10") })
        ]);
        expect(rows[0].lastOrder.toISOString().slice(0, 10)).toBe("2026-05-10");
    });
});

describe("aggregateByCustomer", () => {
    test("groups by customerUid, accumulates spend, tracks unique vendors", () => {
        const rows = aggregateByCustomer([
            makeOrder({ id: "1", customerUid: "u1", customerName: "Alice", total: 100, vendorName: "A" }),
            makeOrder({ id: "2", customerUid: "u1", customerName: "Alice", total: 50, vendorName: "B" }),
            makeOrder({ id: "3", customerUid: "u2", customerName: "Bob", total: 200, vendorName: "A" })
        ]);
        const alice = rows.find(r => r.customerId === "u1");
        expect(alice.orderCount).toBe(2);
        expect(alice.totalSpent).toBe(150);
        expect(alice.uniqueVendors).toBe(2);
    });

    test("missing names default to Anonymous (still counted)", () => {
        const rows = aggregateByCustomer([{ total: 10, createdAt: new Date() }]);
        expect(rows).toHaveLength(1);
        expect(rows[0].customerName).toBe("Anonymous");
        expect(rows[0].orderCount).toBe(1);
    });

    test("falls back to display name as group key when no id", () => {
        const rows = aggregateByCustomer([
            { customerName: "Walk-in", total: 10, createdAt: new Date(), vendorName: "X" },
            { customerName: "Walk-in", total: 20, createdAt: new Date(), vendorName: "X" }
        ]);
        expect(rows).toHaveLength(1);
        expect(rows[0].orderCount).toBe(2);
        expect(rows[0].totalSpent).toBe(30);
    });
});

describe("computeKpis", () => {
    test("computes totals + repeat rate", () => {
        const k = computeKpis([
            makeOrder({ customerUid: "u1", total: 100, vendorName: "A" }),
            makeOrder({ id: "2", customerUid: "u1", total: 50, vendorName: "A" }),
            makeOrder({ id: "3", customerUid: "u2", total: 200, vendorName: "B" })
        ]);
        expect(k.totalRevenue).toBe(350);
        expect(k.totalOrders).toBe(3);
        expect(k.avgOrder).toBeCloseTo(350 / 3);
        expect(k.activeCustomers).toBe(2);
        expect(k.repeatRate).toBeCloseTo(50, 5); // u1 repeated → 1/2 = 50%
    });

    test("empty input yields safe zeros and em-dash top vendor", () => {
        const k = computeKpis([]);
        expect(k).toMatchObject({
            totalRevenue: 0,
            totalOrders: 0,
            avgOrder: 0,
            topVendor: "—",
            activeCustomers: 0,
            repeatRate: 0
        });
    });
});

describe("computeHourCounts / computeWeekdayCounts / computeHeatmap", () => {
    test("places orders at the right hour and weekday", () => {
        // 2026-05-04 was a Monday in local time
        const mon10 = new Date(2026, 4, 4, 10, 0, 0);
        const sun15 = new Date(2026, 4, 10, 15, 0, 0);
        const orders = [
            makeOrder({ id: "1", createdAt: mon10 }),
            makeOrder({ id: "2", createdAt: mon10 }),
            makeOrder({ id: "3", createdAt: sun15 })
        ];
        const hours = computeHourCounts(orders);
        const weekdays = computeWeekdayCounts(orders);
        const heat = computeHeatmap(orders);

        expect(hours[10]).toBe(2);
        expect(hours[15]).toBe(1);
        expect(weekdays[0]).toBe(2); // Mon
        expect(weekdays[6]).toBe(1); // Sun
        expect(heat[0][10]).toBe(2);
        expect(heat[6][15]).toBe(1);
        expect(heat.length).toBe(7);
        expect(heat[0].length).toBe(24);
    });

    test("skips orders with invalid createdAt", () => {
        const out = computeHourCounts([{ createdAt: null }]);
        expect(out.reduce((a, b) => a + b)).toBe(0);
    });
});

describe("computeMovement", () => {
    test("joins by vendor name and computes signed % change", () => {
        const curr = [
            { name: "A", revenue: 200 },
            { name: "B", revenue: 50 }
        ];
        const prev = [
            { name: "A", revenue: 100 },
            { name: "B", revenue: 100 }
        ];
        const rows = computeMovement(curr, prev);
        const a = rows.find(r => r.name === "A");
        const b = rows.find(r => r.name === "B");
        expect(a.movementPct).toBeCloseTo(100);
        expect(a.direction).toBe("up");
        expect(b.movementPct).toBeCloseTo(-50);
        expect(b.direction).toBe("down");
    });

    test("handles new vendors (no previous revenue) as +100%", () => {
        const rows = computeMovement(
            [{ name: "Z", revenue: 50 }],
            []
        );
        expect(rows[0].previousRevenue).toBe(0);
        expect(rows[0].movementPct).toBe(100);
        expect(rows[0].direction).toBe("up");
    });

    test("equal revenue marks direction as flat", () => {
        const rows = computeMovement(
            [{ name: "A", revenue: 100 }],
            [{ name: "A", revenue: 100 }]
        );
        expect(rows[0].direction).toBe("flat");
    });
});

// ============================================================================
// Search / sort / paginate
// ============================================================================

const sampleVendors = [
    { name: "Burger Shack", orders: 30, revenue: 1500, avgOrder: 50, share: 50, lastOrder: new Date("2026-05-20") },
    { name: "Coffee Cart", orders: 10, revenue: 200, avgOrder: 20, share: 10, lastOrder: new Date("2026-05-05") },
    { name: "Fries Place", orders: 20, revenue: 1000, avgOrder: 50, share: 40, lastOrder: new Date("2026-05-15") }
];

describe("searchVendors / sortVendors", () => {
    test("search is case-insensitive partial match", () => {
        expect(searchVendors(sampleVendors, "bUr").map(v => v.name)).toEqual(["Burger Shack"]);
    });
    test("empty term returns a fresh copy of all", () => {
        const out = searchVendors(sampleVendors, "");
        expect(out).toEqual(sampleVendors);
        expect(out).not.toBe(sampleVendors);
    });
    test("sort by revenue desc puts top earner first", () => {
        expect(sortVendors(sampleVendors, "revenue", "desc").map(v => v.name))
            .toEqual(["Burger Shack", "Fries Place", "Coffee Cart"]);
    });
    test("sort by revenue asc surfaces least-selling vendors first", () => {
        expect(sortVendors(sampleVendors, "revenue", "asc").map(v => v.name))
            .toEqual(["Coffee Cart", "Fries Place", "Burger Shack"]);
    });
    test("sort by name A→Z", () => {
        expect(sortVendors(sampleVendors, "name", "asc").map(v => v.name))
            .toEqual(["Burger Shack", "Coffee Cart", "Fries Place"]);
    });
    test("sort by lastOrder desc puts most recent first", () => {
        expect(sortVendors(sampleVendors, "lastOrder", "desc").map(v => v.name))
            .toEqual(["Burger Shack", "Fries Place", "Coffee Cart"]);
    });
    test("unknown sort key returns a copy", () => {
        const out = sortVendors(sampleVendors, "bogus", "desc");
        expect(out).toEqual(sampleVendors);
        expect(out).not.toBe(sampleVendors);
    });
});

const sampleCustomers = [
    { customerId: "1", customerName: "Alice", orderCount: 5, totalSpent: 500, uniqueVendors: 2, lastOrder: new Date("2026-05-10") },
    { customerId: "2", customerName: "Bob", orderCount: 12, totalSpent: 100, uniqueVendors: 1, lastOrder: new Date("2026-05-20") },
    { customerId: "3", customerName: "Charlie", orderCount: 3, totalSpent: 1000, uniqueVendors: 3, lastOrder: new Date("2026-04-01") }
];

describe("searchCustomers / sortCustomers", () => {
    test("search is case-insensitive partial match on name", () => {
        expect(searchCustomers(sampleCustomers, "alice").map(c => c.customerName)).toEqual(["Alice"]);
    });
    test("sort by totalSpent desc", () => {
        expect(sortCustomers(sampleCustomers, "totalSpent", "desc").map(c => c.customerName))
            .toEqual(["Charlie", "Alice", "Bob"]);
    });
    test("sort by orderCount desc", () => {
        expect(sortCustomers(sampleCustomers, "orderCount", "desc").map(c => c.customerName))
            .toEqual(["Bob", "Alice", "Charlie"]);
    });
    test("sort by uniqueVendors desc", () => {
        expect(sortCustomers(sampleCustomers, "uniqueVendors", "desc").map(c => c.customerName))
            .toEqual(["Charlie", "Alice", "Bob"]);
    });
});

describe("paginate", () => {
    const rows = Array.from({ length: 23 }, (_, i) => ({ i }));

    test("first full page", () => {
        const r = paginate(rows, 1, 10);
        expect(r.rows.length).toBe(10);
        expect(r.page).toBe(1);
        expect(r.totalPages).toBe(3);
        expect(r.total).toBe(23);
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
// Custom report grouping
// ============================================================================

describe("groupForCustomReport", () => {
    const orders = [
        makeOrder({ id: "1", vendorName: "A", total: 100, createdAt: new Date(2026, 4, 4, 10) }), // Mon 10am
        makeOrder({ id: "2", vendorName: "A", total: 50, createdAt: new Date(2026, 4, 4, 11) }),  // Mon 11am
        makeOrder({ id: "3", vendorName: "B", total: 200, createdAt: new Date(2026, 4, 5, 10) })  // Tue 10am
    ];

    test("group by vendor returns one label per vendor and matching metrics", () => {
        const { labels, byMetric } = groupForCustomReport(orders, "vendor");
        expect(new Set(labels)).toEqual(new Set(["A", "B"]));
        const aIdx = labels.indexOf("A");
        const bIdx = labels.indexOf("B");
        expect(byMetric.revenue[aIdx]).toBe(150);
        expect(byMetric.orders[aIdx]).toBe(2);
        expect(byMetric.revenue[bIdx]).toBe(200);
        expect(byMetric.orders[bIdx]).toBe(1);
    });

    test("group by hour returns 24 labels", () => {
        const { labels, byMetric } = groupForCustomReport(orders, "hour");
        expect(labels.length).toBe(24);
        expect(byMetric.orders[10]).toBe(2);
        expect(byMetric.orders[11]).toBe(1);
    });

    test("group by day returns 7 labels Mon..Sun", () => {
        const { labels, byMetric } = groupForCustomReport(orders, "day");
        expect(labels).toEqual(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]);
        expect(byMetric.orders[0]).toBe(2); // Mon
        expect(byMetric.orders[1]).toBe(1); // Tue
    });

    test("avg_order metric divides revenue by order count safely", () => {
        const { labels, byMetric } = groupForCustomReport(orders, "vendor");
        const aIdx = labels.indexOf("A");
        expect(byMetric.avg_order[aIdx]).toBe(75);
    });
});
