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
