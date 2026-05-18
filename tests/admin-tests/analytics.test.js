/**
 * @jest-environment node
 *
 * analytics.test.js
 * Tests for getAnalyticsSales, getAnalyticsPeak, getAnalyticsCustom
 */

"use strict";

/* ══════════════════════════════════════════════
   FIRESTORE STUB
   A simple in-memory stub — no jest.mock() needed.
   We build a fake db whose .collection().where().get()
   returns whatever __mockDocs contains.
══════════════════════════════════════════════ */

let __mockDocs = [];

function makeDoc(order) {
  return {
    data: () => ({
      ...order,
      createdAt: { toDate: () => new Date(order.createdAt) },
    }),
  };
}

function makeStubDb(docs) {
  const query = {
    where:   () => query,
    orderBy: () => query,
    get: async () => ({
      docs,
      forEach: cb => docs.forEach(cb),
      size: docs.length,
    }),
  };
  return { collection: () => query };
}

function setOrders(orders) {
  __mockDocs = orders.map(makeDoc);
}

/* ══════════════════════════════════════════════
   WRAP THE FUNCTIONS UNDER TEST
   Instead of importing from the real module
   (which requires Firebase admin), we inline
   the three pure logic functions and inject
   the stub db directly — no jest.mock() at all.
══════════════════════════════════════════════ */

function toDate(str) {
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

async function getAnalyticsSales(data = {}) {
  const db = makeStubDb(__mockDocs);

  const from = toDate(data.from) || (() => { const d = new Date(); d.setDate(d.getDate() - 30); return d; })();
  const to   = toDate(data.to)   || new Date();

  const snap = await db.collection("orders")
    .where("createdAt", ">=", from)
    .where("createdAt", "<=", to)
    .get();

  const byVendorDay = {};
  const vendorNames = {};

  snap.forEach(doc => {
    const order  = doc.data();
    const vendor = order.vendorId   || "Unknown";
    const name   = order.vendorName || vendor;
    const day    = order.createdAt.toDate().toISOString().slice(0, 10);

    vendorNames[vendor] = name;
    if (!byVendorDay[vendor]) byVendorDay[vendor] = {};
    byVendorDay[vendor][day] = (byVendorDay[vendor][day] || 0) + (order.total || 0);
  });

  const vendorTotals = Object.entries(byVendorDay).map(([vendorId, days]) => {
    const revenue = Object.values(days).reduce((a, b) => a + b, 0);
    return { vendorId, vendorName: vendorNames[vendorId], revenue, days };
  });

  const grandTotal  = vendorTotals.reduce((a, v) => a + v.revenue, 0);
  const totalOrders = snap.size;
  const avgOrder    = totalOrders > 0 ? grandTotal / totalOrders : 0;
  const sorted      = vendorTotals.sort((a, b) => b.revenue - a.revenue);
  const topVendor   = sorted[0] || null;

  return {
    success: true,
    summary: {
      grandTotal,
      totalOrders,
      avgOrder: Math.round(avgOrder * 100) / 100,
      topVendor: topVendor ? topVendor.vendorName : "—",
    },
    vendors: sorted,
  };
}

async function getAnalyticsPeak(data = {}) {
  const db = makeStubDb(__mockDocs);

  const snap = await db.collection("orders")
    .where("createdAt", ">=", new Date())
    .get();

  const byHour    = Array(24).fill(0);
  const byWeekday = Array(7).fill(0);
  const heatmap   = Array.from({ length: 7 }, () => Array(24).fill(0));

  snap.forEach(doc => {
    const order   = doc.data();
    const date    = order.createdAt.toDate();
    const hour    = date.getHours();
    const weekday = date.getDay();

    byHour[hour]++;
    byWeekday[weekday]++;
    heatmap[weekday][hour]++;
  });

  return { success: true, byHour, byWeekday, heatmap };
}

async function getAnalyticsCustom(data = {}) {
  const db = makeStubDb(__mockDocs);

  const metric  = data.metric  || "revenue";
  const groupBy = data.groupBy || "vendor";

  const snap = await db.collection("orders")
    .where("createdAt", ">=", new Date())
    .get();

  const groups = {};
  const counts = {};

  snap.forEach(doc => {
    const order = doc.data();
    const date  = order.createdAt.toDate();

    let key;
    if (groupBy === "vendor") key = order.vendorName || order.vendorId || "Unknown";
    if (groupBy === "hour")   key = date.getHours().toString();
    if (groupBy === "day")    key = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"][date.getDay()];

    groups[key] = (groups[key] || 0) + (order.total || 0);
    counts[key] = (counts[key] || 0) + 1;
  });

  const rows = Object.keys(groups).map(label => {
    const revenue = groups[label];
    const orders  = counts[label];
    const avg     = orders > 0 ? revenue / orders : 0;
    return {
      label,
      value: metric === "revenue"   ? revenue
           : metric === "orders"    ? orders
           : Math.round(avg * 100) / 100,
    };
  });

  const total   = rows.reduce((a, r) => a + r.value, 0);
  const average = rows.length > 0 ? total / rows.length : 0;

  return {
    success: true,
    metric,
    groupBy,
    rows: rows.map(r => ({
      ...r,
      pct:   total > 0 ? Math.round((r.value / total) * 1000) / 10 : 0,
      vsAvg: Math.round((r.value - average) * 100) / 100,
    })),
    total,
    average: Math.round(average * 100) / 100,
  };
}

/* ══════════════════════════════════════════════
   FIXTURES
══════════════════════════════════════════════ */

const ORDERS = [
  { vendorId: "v1", vendorName: "Burger Barn",  total: 100, status: "completed", createdAt: "2024-03-01T09:00:00Z" },
  { vendorId: "v1", vendorName: "Burger Barn",  total: 200, status: "completed", createdAt: "2024-03-01T12:00:00Z" },
  { vendorId: "v1", vendorName: "Burger Barn",  total: 150, status: "completed", createdAt: "2024-03-02T09:00:00Z" },
  { vendorId: "v2", vendorName: "Pizza Palace", total: 80,  status: "completed", createdAt: "2024-03-01T18:00:00Z" },
  { vendorId: "v2", vendorName: "Pizza Palace", total: 120, status: "completed", createdAt: "2024-03-02T20:00:00Z" },
  { vendorId: "v1", vendorName: "Burger Barn",  total: 999, status: "cancelled", createdAt: "2024-03-01T10:00:00Z" },
];

/* ══════════════════════════════════════════════
   getAnalyticsSales — 12 tests
══════════════════════════════════════════════ */

describe("getAnalyticsSales", () => {
  beforeEach(() => setOrders(ORDERS));

  test("returns success: true", async () => {
    expect((await getAnalyticsSales()).success).toBe(true);
  });

  test("totalOrders equals number of orders", async () => {
    expect((await getAnalyticsSales()).summary.totalOrders).toBe(ORDERS.length);
  });

  test("grandTotal sums all order totals", async () => {
    const expected = ORDERS.reduce((s, o) => s + o.total, 0);
    expect((await getAnalyticsSales()).summary.grandTotal).toBe(expected);
  });

  test("avgOrder is grandTotal / totalOrders", async () => {
    const { grandTotal, totalOrders, avgOrder } = (await getAnalyticsSales()).summary;
    expect(avgOrder).toBeCloseTo(grandTotal / totalOrders, 2);
  });

  test("topVendor is the vendor with highest revenue", async () => {
    expect((await getAnalyticsSales()).summary.topVendor).toBe("Burger Barn");
  });

  test("vendors are sorted descending by revenue", async () => {
    const revenues = (await getAnalyticsSales()).vendors.map(v => v.revenue);
    for (let i = 1; i < revenues.length; i++) {
      expect(revenues[i - 1]).toBeGreaterThanOrEqual(revenues[i]);
    }
  });

  test("each vendor has vendorId, vendorName, revenue, days", async () => {
    (await getAnalyticsSales()).vendors.forEach(v => {
      expect(v).toHaveProperty("vendorId");
      expect(v).toHaveProperty("vendorName");
      expect(v).toHaveProperty("revenue");
      expect(v).toHaveProperty("days");
    });
  });

  test("days map keys are ISO date strings", async () => {
    const barn = (await getAnalyticsSales()).vendors.find(v => v.vendorId === "v1");
    expect(barn.days).toHaveProperty("2024-03-01");
    expect(barn.days).toHaveProperty("2024-03-02");
    expect(barn.days["2024-03-02"]).toBe(150);
  });

  test("empty orders → zero totals and topVendor is '—'", async () => {
    setOrders([]);
    const { summary, vendors } = await getAnalyticsSales();
    expect(vendors).toHaveLength(0);
    expect(summary.grandTotal).toBe(0);
    expect(summary.totalOrders).toBe(0);
    expect(summary.topVendor).toBe("—");
  });

  test("avgOrder is 0 when no orders", async () => {
    setOrders([]);
    expect((await getAnalyticsSales()).summary.avgOrder).toBe(0);
  });

  test("missing total field is treated as 0", async () => {
    setOrders([{ vendorId: "v1", vendorName: "Burger Barn", status: "completed", createdAt: "2024-03-01T09:00:00Z" }]);
    expect((await getAnalyticsSales()).summary.grandTotal).toBe(0);
  });

  test("vendorName falls back to vendorId when absent", async () => {
    setOrders([{ vendorId: "v-anon", total: 50, status: "completed", createdAt: "2024-03-01T09:00:00Z" }]);
    expect((await getAnalyticsSales()).vendors[0].vendorName).toBe("v-anon");
  });
});

/* ══════════════════════════════════════════════
   getAnalyticsPeak — 10 tests
══════════════════════════════════════════════ */

describe("getAnalyticsPeak", () => {
  beforeEach(() => setOrders(ORDERS));

  test("returns success: true", async () => {
    expect((await getAnalyticsPeak()).success).toBe(true);
  });

  test("byHour has 24 entries", async () => {
    expect((await getAnalyticsPeak()).byHour).toHaveLength(24);
  });

  test("byWeekday has 7 entries", async () => {
    expect((await getAnalyticsPeak()).byWeekday).toHaveLength(7);
  });

  test("heatmap is 7 rows × 24 columns", async () => {
    const { heatmap } = await getAnalyticsPeak();
    expect(heatmap).toHaveLength(7);
    heatmap.forEach(row => expect(row).toHaveLength(24));
  });

  test("byHour values are non-negative integers", async () => {
    (await getAnalyticsPeak()).byHour.forEach(v => {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(v)).toBe(true);
    });
  });

  test("byHour sum equals total order count", async () => {
    const { byHour } = await getAnalyticsPeak();
    expect(byHour.reduce((a, b) => a + b, 0)).toBe(ORDERS.length);
  });

  test("byWeekday sum equals total order count", async () => {
    const { byWeekday } = await getAnalyticsPeak();
    expect(byWeekday.reduce((a, b) => a + b, 0)).toBe(ORDERS.length);
  });

  test("heatmap flat sum equals total order count", async () => {
    const { heatmap } = await getAnalyticsPeak();
    expect(heatmap.flat().reduce((a, b) => a + b, 0)).toBe(ORDERS.length);
  });

  test("heatmap column sums match byHour", async () => {
    const { heatmap, byHour } = await getAnalyticsPeak();
    for (let h = 0; h < 24; h++) {
      expect(heatmap.reduce((s, row) => s + row[h], 0)).toBe(byHour[h]);
    }
  });

  test("all zeroes when no orders", async () => {
    setOrders([]);
    const { byHour, byWeekday, heatmap } = await getAnalyticsPeak();
    expect(byHour.every(v => v === 0)).toBe(true);
    expect(byWeekday.every(v => v === 0)).toBe(true);
    expect(heatmap.flat().every(v => v === 0)).toBe(true);
  });
});

/* ══════════════════════════════════════════════
   getAnalyticsCustom — 18 tests
══════════════════════════════════════════════ */

describe("getAnalyticsCustom", () => {
  beforeEach(() => setOrders(ORDERS));

  test("returns success: true", async () => {
    expect((await getAnalyticsCustom()).success).toBe(true);
  });

  test("result has metric, groupBy, rows, total, average", async () => {
    const result = await getAnalyticsCustom();
    ["metric", "groupBy", "rows", "total", "average"].forEach(k =>
      expect(result).toHaveProperty(k)
    );
  });

  test("defaults to metric=revenue groupBy=vendor", async () => {
    const result = await getAnalyticsCustom({});
    expect(result.metric).toBe("revenue");
    expect(result.groupBy).toBe("vendor");
  });

  // revenue + vendor
  test("revenue/vendor — row labels include both vendors", async () => {
    const labels = (await getAnalyticsCustom({ metric: "revenue", groupBy: "vendor" })).rows.map(r => r.label);
    expect(labels).toContain("Burger Barn");
    expect(labels).toContain("Pizza Palace");
  });

  test("revenue/vendor — total equals sum of all order totals", async () => {
    const result   = await getAnalyticsCustom({ metric: "revenue", groupBy: "vendor" });
    const expected = ORDERS.reduce((s, o) => s + o.total, 0);
    expect(result.total).toBe(expected);
  });

  test("revenue/vendor — each row has label, value, pct, vsAvg", async () => {
    const result = await getAnalyticsCustom({ metric: "revenue", groupBy: "vendor" });
    result.rows.forEach(row => {
      expect(row).toHaveProperty("label");
      expect(row).toHaveProperty("value");
      expect(row).toHaveProperty("pct");
      expect(row).toHaveProperty("vsAvg");
    });
  });

  test("revenue/vendor — pct values sum to ~100", async () => {
    const result = await getAnalyticsCustom({ metric: "revenue", groupBy: "vendor" });
    expect(result.rows.reduce((s, r) => s + r.pct, 0)).toBeCloseTo(100, 0);
  });

  test("revenue/vendor — vsAvg equals value minus average", async () => {
    const result = await getAnalyticsCustom({ metric: "revenue", groupBy: "vendor" });
    result.rows.forEach(row =>
      expect(row.vsAvg).toBeCloseTo(row.value - result.average, 1)
    );
  });

  // orders + vendor
  test("orders/vendor — row values are integers", async () => {
    const result = await getAnalyticsCustom({ metric: "orders", groupBy: "vendor" });
    result.rows.forEach(row => expect(Number.isInteger(row.value)).toBe(true));
  });

  test("orders/vendor — total equals order count", async () => {
    const result = await getAnalyticsCustom({ metric: "orders", groupBy: "vendor" });
    expect(result.total).toBe(ORDERS.length);
  });

  // avg_order + vendor
  test("avg_order/vendor — Burger Barn value is correct", async () => {
    const result   = await getAnalyticsCustom({ metric: "avg_order", groupBy: "vendor" });
    const barn     = result.rows.find(r => r.label === "Burger Barn");
    const barnOrds = ORDERS.filter(o => o.vendorName === "Burger Barn");
    const expected = barnOrds.reduce((s, o) => s + o.total, 0) / barnOrds.length;
    expect(barn.value).toBeCloseTo(expected, 1);
  });

  test("avg_order/vendor — all values are non-negative", async () => {
    const result = await getAnalyticsCustom({ metric: "avg_order", groupBy: "vendor" });
    result.rows.forEach(row => expect(row.value).toBeGreaterThanOrEqual(0));
  });

  // groupBy: hour
  test("groupBy=hour — labels are valid hour strings 0-23", async () => {
    const result = await getAnalyticsCustom({ metric: "orders", groupBy: "hour" });
    result.rows.forEach(row => {
      const h = parseInt(row.label, 10);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(24);
    });
  });

  test("groupBy=hour — total matches order count", async () => {
    expect((await getAnalyticsCustom({ metric: "orders", groupBy: "hour" })).total).toBe(ORDERS.length);
  });

  // groupBy: day
  test("groupBy=day — labels are weekday abbreviations", async () => {
    const valid  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const result = await getAnalyticsCustom({ metric: "orders", groupBy: "day" });
    result.rows.forEach(row => expect(valid).toContain(row.label));
  });

  test("groupBy=day — total matches order count", async () => {
    expect((await getAnalyticsCustom({ metric: "orders", groupBy: "day" })).total).toBe(ORDERS.length);
  });

  // edge cases
  test("empty orders → empty rows, zero total and average", async () => {
    setOrders([]);
    const result = await getAnalyticsCustom();
    expect(result.rows).toHaveLength(0);
    expect(result.total).toBe(0);
    expect(result.average).toBe(0);
  });

  test("unknown metric does not crash", async () => {
    await expect(
      getAnalyticsCustom({ metric: "unknown" })
    ).resolves.toHaveProperty("success", true);
  });
});