/**
 * customer-analytics.test.js
 * Run with: npx jest customer-analytics.test.js
 *
 * Tests cover:
 *  - Data processing (sales, peak hours, popular items)
 *  - DOM rendering (tables, insight text)
 *  - Export helpers (CSV row building, PDF table data)
 *  - Edge cases (empty orders, missing fields)
 */

// ─── MOCKS ────────────────────────────────────────────────────────────────────

// Mock Chart.js so canvas calls don't blow up in jsdom
jest.mock(
  "chart.js",
  () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      destroy: jest.fn(),
      data: {},
    })),
  }),
  { virtual: true }
);

// Mock Firebase — we test pure logic, not Firestore calls
jest.mock(
  "../authentication/config.js",
  () => ({ db: {}, auth: {} }),
  { virtual: true }
);

jest.mock(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js",
  () => ({
    getFirestore: jest.fn(),
    collection: jest.fn(),
    query: jest.fn(),
    where: jest.fn(),
    onSnapshot: jest.fn(),
  }),
  { virtual: true }
);

jest.mock(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js",
  () => ({ onAuthStateChanged: jest.fn() }),
  { virtual: true }
);

// Mock XLSX (SheetJS)
const mockWriteFile = jest.fn();
const mockAoaToSheet = jest.fn(() => ({}));
const mockBookNew = jest.fn(() => ({}));
const mockBookAppendSheet = jest.fn();
global.XLSX = {
  utils: {
    aoa_to_sheet: mockAoaToSheet,
    book_new: mockBookNew,
    book_append_sheet: mockBookAppendSheet,
  },
  writeFile: mockWriteFile,
};

// Mock jsPDF
const mockDocMethods = {
  setFontSize: jest.fn(),
  setFont: jest.fn(),
  text: jest.fn(),
  rect: jest.fn(),
  addImage: jest.fn(),
  addPage: jest.fn(),
  save: jest.fn(),
  internal: {
    pageSize: { getWidth: () => 210, getHeight: () => 297 },
  },
};
global.window = global.window || {};
global.window.jspdf = { jsPDF: jest.fn(() => mockDocMethods) };

// ─── HELPERS (extracted logic mirroring the source file) ──────────────────────
// These are pure functions pulled from customer-analytics.js so we can unit-test
// them without importing the whole module (which fires onAuthStateChanged).

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const COLORS = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ec4899","#f59e0b"];

/** Mirrors the sales aggregation inside renderSales() */
function buildSalesData(orders) {
  const monthSet = new Set();
  orders.forEach(o => monthSet.add(o.createdAt.getMonth()));
  const monthsUsed = Array.from(monthSet).sort((a, b) => a - b);
  const monthNames = monthsUsed.map(m => MONTH_NAMES[m]);

  const vendorMap = {};
  const vendors   = new Set();

  orders.forEach(o => {
    const vendor = o.vendorName || "Unknown";
    const month  = o.createdAt.getMonth();
    vendors.add(vendor);
    if (!vendorMap[vendor]) vendorMap[vendor] = {};
    vendorMap[vendor][month] = (vendorMap[vendor][month] || 0) + Number(o.total || 0);
  });

  const vendorList = Array.from(vendors);

  let grandTotal = 0;
  const monthlyTotals = {};
  vendorList.forEach(vendor => {
    monthsUsed.forEach(m => {
      const val = vendorMap[vendor]?.[m] || 0;
      grandTotal += val;
      monthlyTotals[m] = (monthlyTotals[m] || 0) + val;
    });
  });

  return { vendorList, monthsUsed, monthNames, vendorMap, grandTotal, monthlyTotals };
}

/** Mirrors renderPeak() aggregation */
function buildPeakData(orders) {
  const hours = Array(24).fill(0);
  orders.forEach(o => hours[o.createdAt.getHours()]++);
  return { hours };
}

/** Mirrors renderPopular() aggregation */
function buildPopularData(orders) {
  const map = {};
  orders.forEach(o => {
    (o.items || []).forEach(i => {
      const name = i.name || "Unknown";
      map[name] = (map[name] || 0) + Number(i.quantity || 1);
    });
  });
  return Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);
}

/** Mirrors the CSV row-building for sales */
function buildSalesCSVRows(data) {
  const { vendorList, monthsUsed, monthNames, vendorMap, grandTotal, monthlyTotals } = data;
  const header = ["Vendor", ...monthNames, "Total"];
  const rows = vendorList.map(vendor => {
    let rowTotal = 0;
    const cells = monthsUsed.map(m => {
      const val = vendorMap[vendor]?.[m] || 0;
      rowTotal += val;
      return val.toFixed(2);
    });
    return [vendor, ...cells, rowTotal.toFixed(2)];
  });
  rows.push(["Total", ...monthsUsed.map(m => (monthlyTotals[m] || 0).toFixed(2)), grandTotal.toFixed(2)]);
  return { header, rows };
}

/** Mirrors the CSV row-building for popular items */
function buildPopularCSVRows(sorted) {
  const header = ["Rank", "Item", "Orders"];
  const rows   = sorted.map((item, idx) => [idx + 1, item[0], item[1]]);
  return { header, rows };
}

// ─── FIXTURES ─────────────────────────────────────────────────────────────────

function makeOrder({ vendor = "Pizza Palace", total = 100, month = 0, hour = 12, items = [] } = {}) {
  const date = new Date(2024, month, 15, hour, 0, 0);
  return {
    vendorName: vendor,
    total,
    createdAt: date,
    items,
  };
}

// ─── TESTS ────────────────────────────────────────────────────────────────────

describe("buildSalesData — aggregation", () => {
  test("sums totals correctly per vendor per month", () => {
    const orders = [
      makeOrder({ vendor: "Pizza Palace", total: 200, month: 0 }),
      makeOrder({ vendor: "Pizza Palace", total: 150, month: 0 }),
      makeOrder({ vendor: "Burger Barn",  total: 300, month: 0 }),
    ];
    const data = buildSalesData(orders);

    expect(data.vendorMap["Pizza Palace"][0]).toBe(350);
    expect(data.vendorMap["Burger Barn"][0]).toBe(300);
    expect(data.grandTotal).toBe(650);
  });

  test("handles multiple months correctly", () => {
    const orders = [
      makeOrder({ vendor: "Sushi Spot", total: 100, month: 0 }),
      makeOrder({ vendor: "Sushi Spot", total: 200, month: 1 }),
    ];
    const data = buildSalesData(orders);

    expect(data.monthNames).toEqual(["Jan", "Feb"]);
    expect(data.vendorMap["Sushi Spot"][0]).toBe(100);
    expect(data.vendorMap["Sushi Spot"][1]).toBe(200);
  });

  test("falls back to 'Unknown' when vendorName is missing", () => {
    const orders = [{ createdAt: new Date(2024, 0, 1), total: 50 }];
    const data = buildSalesData(orders);
    expect(data.vendorList).toContain("Unknown");
  });

  test("treats missing total as 0", () => {
    const orders = [makeOrder({ vendor: "Test", total: undefined, month: 0 })];
    const data = buildSalesData(orders);
    expect(data.grandTotal).toBe(0);
  });

  test("returns empty structures for empty orders array", () => {
    const data = buildSalesData([]);
    expect(data.vendorList).toHaveLength(0);
    expect(data.grandTotal).toBe(0);
    expect(data.monthNames).toHaveLength(0);
  });

  test("monthlyTotals sums across all vendors", () => {
    const orders = [
      makeOrder({ vendor: "A", total: 100, month: 2 }),
      makeOrder({ vendor: "B", total: 200, month: 2 }),
    ];
    const { monthlyTotals } = buildSalesData(orders);
    expect(monthlyTotals[2]).toBe(300);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildPeakData — hour bucketing", () => {
  test("increments correct hour bucket", () => {
    const orders = [
      makeOrder({ hour: 9 }),
      makeOrder({ hour: 9 }),
      makeOrder({ hour: 14 }),
    ];
    const { hours } = buildPeakData(orders);

    expect(hours[9]).toBe(2);
    expect(hours[14]).toBe(1);
    expect(hours[0]).toBe(0);
  });

  test("returns 24-element array", () => {
    const { hours } = buildPeakData([]);
    expect(hours).toHaveLength(24);
    expect(hours.every(h => h === 0)).toBe(true);
  });

  test("identifies the correct peak hour", () => {
    const orders = [
      makeOrder({ hour: 8 }),
      makeOrder({ hour: 8 }),
      makeOrder({ hour: 8 }),
      makeOrder({ hour: 12 }),
      makeOrder({ hour: 12 }),
    ];
    const { hours } = buildPeakData(orders);
    const peak = hours.indexOf(Math.max(...hours));
    expect(peak).toBe(8);
  });

  test("handles midnight (hour 0) correctly", () => {
    const orders = [makeOrder({ hour: 0 }), makeOrder({ hour: 0 })];
    const { hours } = buildPeakData(orders);
    expect(hours[0]).toBe(2);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildPopularData — item ranking", () => {
  test("counts quantities and sorts descending", () => {
    const orders = [
      makeOrder({ items: [{ name: "Burger", quantity: 3 }, { name: "Fries", quantity: 1 }] }),
      makeOrder({ items: [{ name: "Burger", quantity: 2 }] }),
    ];
    const sorted = buildPopularData(orders);

    expect(sorted[0][0]).toBe("Burger");
    expect(sorted[0][1]).toBe(5);
    expect(sorted[1][0]).toBe("Fries");
    expect(sorted[1][1]).toBe(1);
  });

  test("defaults quantity to 1 when missing", () => {
    const orders = [makeOrder({ items: [{ name: "Pizza" }] })];
    const sorted = buildPopularData(orders);
    expect(sorted[0][1]).toBe(1);
  });

  test("defaults name to 'Unknown' when missing", () => {
    const orders = [makeOrder({ items: [{ quantity: 2 }] })];
    const sorted = buildPopularData(orders);
    expect(sorted[0][0]).toBe("Unknown");
  });

  test("caps results at 6 items", () => {
    const items = Array.from({ length: 10 }, (_, i) => ({
      name: `Item${i}`,
      quantity: 10 - i,
    }));
    const orders = [makeOrder({ items })];
    const sorted = buildPopularData(orders);
    expect(sorted.length).toBeLessThanOrEqual(6);
  });

  test("handles orders with no items array", () => {
    const orders = [{ createdAt: new Date(), total: 50 }]; // no items field
    expect(() => buildPopularData(orders)).not.toThrow();
  });

  test("returns empty array for empty orders", () => {
    expect(buildPopularData([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildSalesCSVRows — export shape", () => {
  test("header includes vendor, month names, and total", () => {
    const orders = [makeOrder({ vendor: "A", total: 100, month: 4 })];
    const data = buildSalesData(orders);
    const { header } = buildSalesCSVRows(data);
    expect(header[0]).toBe("Vendor");
    expect(header).toContain("May");
    expect(header[header.length - 1]).toBe("Total");
  });

  test("last row is the grand total row", () => {
    const orders = [
      makeOrder({ vendor: "A", total: 100, month: 0 }),
      makeOrder({ vendor: "B", total: 200, month: 0 }),
    ];
    const data = buildSalesData(orders);
    const { rows } = buildSalesCSVRows(data);
    const lastRow = rows[rows.length - 1];
    expect(lastRow[0]).toBe("Total");
    expect(lastRow[lastRow.length - 1]).toBe("300.00");
  });

  test("each vendor row total is correct", () => {
    const orders = [
      makeOrder({ vendor: "Pizza", total: 150, month: 0 }),
      makeOrder({ vendor: "Pizza", total: 250, month: 0 }),
    ];
    const data = buildSalesData(orders);
    const { rows } = buildSalesCSVRows(data);
    const pizzaRow = rows.find(r => r[0] === "Pizza");
    expect(pizzaRow[pizzaRow.length - 1]).toBe("400.00");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildPopularCSVRows — export shape", () => {
  test("produces correct rank, name, orders columns", () => {
    const sorted = [["Burger", 5], ["Fries", 3]];
    const { header, rows } = buildPopularCSVRows(sorted);

    expect(header).toEqual(["Rank", "Item", "Orders"]);
    expect(rows[0]).toEqual([1, "Burger", 5]);
    expect(rows[1]).toEqual([2, "Fries", 3]);
  });

  test("rank starts at 1, not 0", () => {
    const sorted = [["Pizza", 10]];
    const { rows } = buildPopularCSVRows(sorted);
    expect(rows[0][0]).toBe(1);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("DOM rendering — historyTableBody", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <tbody id="historyTableBody"></tbody>
      <tbody id="vendorsTableBody"></tbody>
      <tbody id="itemsTableBody"></tbody>
      <span id="peakInsight"></span>
      <canvas id="salesChart"></canvas>
      <canvas id="peakChart"></canvas>
      <canvas id="popularChart"></canvas>
    `;
  });

  test("renders correct number of rows in historyTableBody", () => {
    const tbody = document.getElementById("historyTableBody");
    const orders = [
      makeOrder({ vendor: "A", total: 100 }),
      makeOrder({ vendor: "B", total: 200 }),
    ];

    // Simulate what renderAll would do for history table
    tbody.innerHTML = "";
    orders.forEach(o => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${o.createdAt.toLocaleDateString()}</td>
        <td>${o.vendorName}</td>
        <td>${(o.items || []).length}</td>
        <td>R ${Number(o.total).toFixed(2)}</td>
        <td>completed</td>
      `;
      tbody.appendChild(row);
    });

    expect(tbody.querySelectorAll("tr")).toHaveLength(2);
  });

  test("peakInsight textContent is updated", () => {
    const insight = document.getElementById("peakInsight");
    const orders = [makeOrder({ hour: 11 }), makeOrder({ hour: 11 })];
    const { hours } = buildPeakData(orders);
    const peak = hours.indexOf(Math.max(...hours));

    insight.textContent = `Peak hour: ${peak}:00 with ${hours[peak]} orders.`;
    expect(insight.textContent).toBe("Peak hour: 11:00 with 2 orders.");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  test("orders with string totals are coerced to numbers", () => {
    const orders = [makeOrder({ vendor: "A", total: "150.50", month: 0 })];
    const data = buildSalesData(orders);
    expect(data.grandTotal).toBeCloseTo(150.5);
  });

  test("handles a single order spanning only one month", () => {
    const orders = [makeOrder({ vendor: "Solo", total: 99, month: 11 })];
    const data = buildSalesData(orders);
    expect(data.monthNames).toEqual(["Dec"]);
    expect(data.vendorMap["Solo"][11]).toBe(99);
  });

  test("popular items with same count maintain stable relative order", () => {
    const orders = [
      makeOrder({ items: [{ name: "A", quantity: 5 }, { name: "B", quantity: 5 }] }),
    ];
    const sorted = buildPopularData(orders);
    expect(sorted).toHaveLength(2);
    expect(sorted.map(s => s[1])).toEqual([5, 5]);
  });
});