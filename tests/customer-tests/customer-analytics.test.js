/**
 * @jest-environment jsdom
 *
 * Customer analytics — pure-logic tests.
 * Only the exported helpers from
 * public/customer/customer-analytics/customer-analytics.js are exercised.
 * Auto-init is gated behind a CommonJS check, so requiring the file does
 * not touch the DOM or Firebase.
 */

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
    paginate
} = require("../../public/customer/customer-analytics/customer-analytics.js");

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
