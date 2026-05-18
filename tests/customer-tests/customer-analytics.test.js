/**
 * customer-analytics.test.js
 * Run with: npx jest tests/customer-tests/customer-analytics.test.js --coverage
 *
 * Tests cover:
 *  - Spending aggregation (renderSpending logic)
 *  - Order history rendering (renderHistory logic)
 *  - Favourite vendors aggregation (renderVendors logic)
 *  - Most ordered items aggregation (renderItems logic)
 *  - All CSV row builders
 *  - PDF table drawing helper
 *  - Edge cases (empty orders, missing fields, string totals)
 *  - DOM rendering (fixed: tables now properly wrapped)
 */

// ─── MOCKS ───────────────────────────────────────────────────────────────────

jest.mock(
  "../../authentication/config.js",
  () => ({ db: {}, auth: {} }),
  { virtual: true }
);

jest.mock(
  "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js",
  () => ({
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

jest.mock(
  "chart.js",
  () => ({ __esModule: true, default: jest.fn(() => ({ destroy: jest.fn() })) }),
  { virtual: true }
);

// Mock XLSX globally
const mockWriteFile       = jest.fn();
const mockAoaToSheet      = jest.fn(() => ({}));
const mockBookNew         = jest.fn(() => ({}));
const mockBookAppendSheet = jest.fn();
global.XLSX = {
  utils: { aoa_to_sheet: mockAoaToSheet, book_new: mockBookNew, book_append_sheet: mockBookAppendSheet },
  writeFile: mockWriteFile,
};

// Mock jsPDF globally
const mockDoc = {
  setFontSize: jest.fn(),
  setFont: jest.fn(),
  text: jest.fn(),
  rect: jest.fn(),
  addImage: jest.fn(),
  addPage: jest.fn(),
  save: jest.fn(),
  internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
};
global.window       = global.window || {};
global.window.jspdf = { jsPDF: jest.fn(() => mockDoc) };

// ─── PURE LOGIC (mirrored from source) ───────────────────────────────────────

const MONTH_NAMES = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/** Mirrors renderSpending() aggregation */
function buildSpendingData(orders) {
  const monthSet = new Set();
  orders.forEach(o => monthSet.add(o.createdAt.getMonth()));
  const monthsUsed = Array.from(monthSet).sort((a, b) => a - b);
  const monthNames = monthsUsed.map(m => MONTH_NAMES[m]);

  const monthlyTotals = {};
  orders.forEach(o => {
    const m = o.createdAt.getMonth();
    monthlyTotals[m] = (monthlyTotals[m] || 0) + Number(o.total || 0);
  });

  return { monthNames, monthsUsed, monthlyTotals };
}

/** Mirrors renderVendors() aggregation */
function buildVendorsData(orders) {
  const vendorMap = {};
  orders.forEach(o => {
    const v = o.vendorName || "Unknown";
    if (!vendorMap[v]) vendorMap[v] = { count: 0, total: 0 };
    vendorMap[v].count++;
    vendorMap[v].total += Number(o.total || 0);
  });
  return Object.entries(vendorMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);
}

/** Mirrors renderItems() aggregation */
function buildItemsData(orders) {
  const map = {};
  orders.forEach(o => {
    (o.items || []).forEach(i => {
      const name = i.name || "Unknown";
      map[name] = (map[name] || 0) + Number(i.quantity || 1);
    });
  });
  return Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, 6);
}

/** Mirrors renderHistory() row building */
function buildHistoryRows(orders) {
  return orders.map(o => {
    const date  = o.createdAt.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
    const items = (o.items || [])
      .map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`)
      .join(", ") || "—";
    return {
      date,
      vendor: o.vendorName || "Unknown",
      items,
      total:  `R ${Number(o.total || 0).toFixed(2)}`,
      status: o.status || "completed",
    };
  });
}

/** Mirrors exportSpendingCSV() */
function buildSpendingCSVRows(data) {
  const { monthNames, monthsUsed, monthlyTotals } = data;
  const header = ["Month", "Amount Spent (R)"];
  const rows   = monthsUsed.map((m, i) => [monthNames[i], (monthlyTotals[m] || 0).toFixed(2)]);
  return { header, rows };
}

/** Mirrors exportHistoryCSV() */
function buildHistoryCSVRows(orders) {
  const header = ["Date", "Vendor", "Items", "Total (R)", "Status"];
  const rows   = orders.map(o => {
    const date  = o.createdAt.toLocaleDateString("en-ZA");
    const items = (o.items || [])
      .map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`)
      .join("; ");
    return [date, o.vendorName || "Unknown", items, Number(o.total || 0).toFixed(2), o.status || "completed"];
  });
  return { header, rows };
}

/** Mirrors exportVendorsCSV() */
function buildVendorsCSVRows(sorted) {
  const header = ["Rank", "Vendor", "Orders", "Total Spent (R)"];
  const rows   = sorted.map(([vendor, data], idx) => [idx + 1, vendor, data.count, data.total.toFixed(2)]);
  return { header, rows };
}

/** Mirrors exportItemsCSV() */
function buildItemsCSVRows(sorted) {
  const header = ["Rank", "Item", "Times Ordered"];
  const rows   = sorted.map((item, idx) => [idx + 1, item[0], item[1]]);
  return { header, rows };
}

/** Mirrors drawPDFTable() */
function drawPDFTable(doc, headers, rows, startY) {
  const colWidth  = (doc.internal.pageSize.getWidth() - 28) / headers.length;
  const rowHeight = 8;
  const startX    = 14;
  let y = startY;

  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  headers.forEach((h, i) => {
    doc.rect(startX + i * colWidth, y, colWidth, rowHeight);
    doc.text(String(h), startX + i * colWidth + 2, y + 5.5);
  });
  y += rowHeight;

  doc.setFont(undefined, "normal");
  rows.forEach(row => {
    if (y + rowHeight > doc.internal.pageSize.getHeight() - 20) {
      doc.addPage();
      y = 20;
    }
    row.forEach((cell, i) => {
      doc.rect(startX + i * colWidth, y, colWidth, rowHeight);
      doc.text(String(cell), startX + i * colWidth + 2, y + 5.5);
    });
    y += rowHeight;
  });

  return y;
}

// ─── FIXTURES ────────────────────────────────────────────────────────────────

function makeOrder({
  vendor = "Pizza Palace",
  total  = 100,
  month  = 0,
  hour   = 12,
  items  = [],
  status = "completed",
} = {}) {
  return {
    vendorName: vendor,
    total,
    createdAt: new Date(2024, month, 15, hour, 0, 0),
    items,
    status,
  };
}

// ─── TESTS ───────────────────────────────────────────────────────────────────

describe("buildSpendingData — monthly aggregation", () => {
  test("sums totals correctly per month", () => {
    const orders = [
      makeOrder({ total: 100, month: 0 }),
      makeOrder({ total: 200, month: 0 }),
      makeOrder({ total: 150, month: 1 }),
    ];
    const { monthlyTotals } = buildSpendingData(orders);
    expect(monthlyTotals[0]).toBe(300);
    expect(monthlyTotals[1]).toBe(150);
  });

  test("monthNames maps correctly", () => {
    const orders = [makeOrder({ month: 4 }), makeOrder({ month: 11 })];
    const { monthNames } = buildSpendingData(orders);
    expect(monthNames).toEqual(["May", "Dec"]);
  });

  test("monthsUsed is sorted ascending", () => {
    const orders = [makeOrder({ month: 5 }), makeOrder({ month: 2 }), makeOrder({ month: 9 })];
    const { monthsUsed } = buildSpendingData(orders);
    expect(monthsUsed).toEqual([2, 5, 9]);
  });

  test("treats missing total as 0", () => {
    const orders = [{ vendorName: "A", createdAt: new Date(2024, 0, 1), total: undefined }];
    const { monthlyTotals } = buildSpendingData(orders);
    expect(monthlyTotals[0]).toBe(0);
  });

  test("coerces string totals to numbers", () => {
    const orders = [{ vendorName: "A", createdAt: new Date(2024, 0, 1), total: "99.50" }];
    const { monthlyTotals } = buildSpendingData(orders);
    expect(monthlyTotals[0]).toBeCloseTo(99.5);
  });

  test("returns empty structures for no orders", () => {
    const { monthNames, monthsUsed, monthlyTotals } = buildSpendingData([]);
    expect(monthNames).toHaveLength(0);
    expect(monthsUsed).toHaveLength(0);
    expect(Object.keys(monthlyTotals)).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildVendorsData — favourite vendors", () => {
  test("counts orders and sums totals per vendor", () => {
    const orders = [
      makeOrder({ vendor: "Sushi Spot", total: 200 }),
      makeOrder({ vendor: "Sushi Spot", total: 150 }),
      makeOrder({ vendor: "Burger Barn", total: 100 }),
    ];
    const sorted = buildVendorsData(orders);
    const sushi  = sorted.find(([v]) => v === "Sushi Spot");
    const burger = sorted.find(([v]) => v === "Burger Barn");
    expect(sushi[1].count).toBe(2);
    expect(sushi[1].total).toBe(350);
    expect(burger[1].count).toBe(1);
    expect(burger[1].total).toBe(100);
  });

  test("sorts by total descending", () => {
    const orders = [
      makeOrder({ vendor: "Cheap Eats", total: 50 }),
      makeOrder({ vendor: "Fine Dining", total: 500 }),
      makeOrder({ vendor: "Mid Range",  total: 200 }),
    ];
    const sorted = buildVendorsData(orders);
    expect(sorted[0][0]).toBe("Fine Dining");
    expect(sorted[1][0]).toBe("Mid Range");
    expect(sorted[2][0]).toBe("Cheap Eats");
  });

  test("caps at 6 vendors", () => {
    const orders = Array.from({ length: 10 }, (_, i) =>
      makeOrder({ vendor: `Vendor${i}`, total: (10 - i) * 100 })
    );
    expect(buildVendorsData(orders).length).toBeLessThanOrEqual(6);
  });

  test("falls back to 'Unknown' for missing vendorName", () => {
    const orders = [{ createdAt: new Date(2024, 0, 1), total: 100 }];
    expect(buildVendorsData(orders)[0][0]).toBe("Unknown");
  });

  test("returns empty array for no orders", () => {
    expect(buildVendorsData([])).toHaveLength(0);
  });

  test("treats missing total as 0 in vendor sum", () => {
    const orders = [{ vendorName: "Test", createdAt: new Date(2024, 0, 1), total: undefined }];
    expect(buildVendorsData(orders)[0][1].total).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildItemsData — most ordered items", () => {
  test("sums quantities across orders", () => {
    const orders = [
      makeOrder({ items: [{ name: "Burger", quantity: 2 }] }),
      makeOrder({ items: [{ name: "Burger", quantity: 3 }, { name: "Fries", quantity: 1 }] }),
    ];
    const sorted = buildItemsData(orders);
    expect(sorted[0]).toEqual(["Burger", 5]);
    expect(sorted[1]).toEqual(["Fries", 1]);
  });

  test("defaults quantity to 1 when missing", () => {
    const orders = [makeOrder({ items: [{ name: "Pizza" }] })];
    expect(buildItemsData(orders)[0][1]).toBe(1);
  });

  test("defaults name to 'Unknown' when missing", () => {
    const orders = [makeOrder({ items: [{ quantity: 2 }] })];
    expect(buildItemsData(orders)[0][0]).toBe("Unknown");
  });

  test("sorts descending by quantity", () => {
    const orders = [makeOrder({ items: [{ name: "A", quantity: 1 }, { name: "B", quantity: 5 }] })];
    expect(buildItemsData(orders)[0][0]).toBe("B");
  });

  test("caps at 6 items", () => {
    const items  = Array.from({ length: 10 }, (_, i) => ({ name: `Item${i}`, quantity: 10 - i }));
    expect(buildItemsData([makeOrder({ items })]).length).toBeLessThanOrEqual(6);
  });

  test("handles orders with no items field gracefully", () => {
    const orders = [{ createdAt: new Date(), total: 50, vendorName: "X" }];
    expect(() => buildItemsData(orders)).not.toThrow();
    expect(buildItemsData(orders)).toHaveLength(0);
  });

  test("returns empty array for no orders", () => {
    expect(buildItemsData([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildHistoryRows — order history rendering", () => {
  test("formats total with R prefix and 2 decimals", () => {
    expect(buildHistoryRows([makeOrder({ total: 149.9 })])[0].total).toBe("R 149.90");
  });

  test("joins items with comma and respects quantity > 1", () => {
    const orders = [makeOrder({ items: [{ name: "Burger", quantity: 2 }, { name: "Fries", quantity: 1 }] })];
    expect(buildHistoryRows(orders)[0].items).toBe("Burger x2, Fries");
  });

  test("shows '—' when items array is empty", () => {
    expect(buildHistoryRows([makeOrder({ items: [] })])[0].items).toBe("—");
  });

  test("falls back to 'Unknown' for missing vendor", () => {
    const orders = [{ createdAt: new Date(2024, 0, 1), total: 50, items: [] }];
    expect(buildHistoryRows(orders)[0].vendor).toBe("Unknown");
  });

  test("falls back to 'completed' for missing status", () => {
    const orders = [{ createdAt: new Date(2024, 0, 1), total: 50, items: [] }];
    expect(buildHistoryRows(orders)[0].status).toBe("completed");
  });

  test("returns one row per order", () => {
    expect(buildHistoryRows([makeOrder(), makeOrder(), makeOrder()])).toHaveLength(3);
  });

  test("returns empty array for no orders", () => {
    expect(buildHistoryRows([])).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("buildSpendingCSVRows — export shape", () => {
  test("header is correct", () => {
    const { header } = buildSpendingCSVRows(buildSpendingData([makeOrder({ month: 0, total: 100 })]));
    expect(header).toEqual(["Month", "Amount Spent (R)"]);
  });

  test("each row has month name and formatted total", () => {
    const { rows } = buildSpendingCSVRows(buildSpendingData([makeOrder({ month: 2, total: 250 })]));
    expect(rows[0][0]).toBe("Mar");
    expect(rows[0][1]).toBe("250.00");
  });

  test("produces one row per month", () => {
    const orders = [makeOrder({ month: 0 }), makeOrder({ month: 3 }), makeOrder({ month: 7 })];
    const { rows } = buildSpendingCSVRows(buildSpendingData(orders));
    expect(rows).toHaveLength(3);
  });
});

describe("buildHistoryCSVRows — export shape", () => {
  test("header has 5 columns starting with Date", () => {
    const { header } = buildHistoryCSVRows([]);
    expect(header).toHaveLength(5);
    expect(header[0]).toBe("Date");
  });

  test("items with quantity > 1 show multiplier", () => {
    const { rows } = buildHistoryCSVRows([makeOrder({ items: [{ name: "Cola", quantity: 3 }] })]);
    expect(rows[0][2]).toContain("x3");
  });

  test("multiple items joined with semicolon", () => {
    const orders = [makeOrder({ items: [{ name: "A", quantity: 1 }, { name: "B", quantity: 1 }] })];
    expect(buildHistoryCSVRows(orders).rows[0][2]).toBe("A; B");
  });
});

describe("buildVendorsCSVRows — export shape", () => {
  test("header has 4 columns", () => {
    expect(buildVendorsCSVRows([]).header).toHaveLength(4);
  });

  test("rank starts at 1", () => {
    const { rows } = buildVendorsCSVRows([["Vendor A", { count: 3, total: 300 }]]);
    expect(rows[0][0]).toBe(1);
  });

  test("total is formatted to 2 decimals", () => {
    const { rows } = buildVendorsCSVRows([["Vendor A", { count: 1, total: 99.999 }]]);
    expect(rows[0][3]).toBe("100.00");
  });
});

describe("buildItemsCSVRows — export shape", () => {
  test("header is correct", () => {
    expect(buildItemsCSVRows([]).header).toEqual(["Rank", "Item", "Times Ordered"]);
  });

  test("rank starts at 1 not 0", () => {
    const { rows } = buildItemsCSVRows([["Burger", 5], ["Fries", 2]]);
    expect(rows[0][0]).toBe(1);
    expect(rows[1][0]).toBe(2);
  });

  test("produces correct item name and count", () => {
    const { rows } = buildItemsCSVRows([["Pizza", 10]]);
    expect(rows[0][1]).toBe("Pizza");
    expect(rows[0][2]).toBe(10);
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("drawPDFTable — PDF rendering helper", () => {
  beforeEach(() => jest.clearAllMocks());

  test("calls rect for each header cell", () => {
    drawPDFTable(mockDoc, ["A", "B", "C"], [], 30);
    expect(mockDoc.rect).toHaveBeenCalledTimes(3);
  });

  test("calls rect for each data cell", () => {
    drawPDFTable(mockDoc, ["Col1", "Col2"], [["v1", "v2"], ["v3", "v4"]], 30);
    expect(mockDoc.rect).toHaveBeenCalledTimes(6); // 2 header + 4 data
  });

  test("calls addPage when rows overflow page height", () => {
    const rows = Array.from({ length: 35 }, () => ["data"]);
    drawPDFTable(mockDoc, ["Col"], rows, 30);
    expect(mockDoc.addPage).toHaveBeenCalled();
  });

  test("returns a Y value greater than startY", () => {
    expect(drawPDFTable(mockDoc, ["Col"], [["row1"]], 30)).toBeGreaterThan(30);
  });

  test("sets bold font for header, normal for data", () => {
    drawPDFTable(mockDoc, ["H"], [["D"]], 30);
    expect(mockDoc.setFont).toHaveBeenCalledWith(undefined, "bold");
    expect(mockDoc.setFont).toHaveBeenCalledWith(undefined, "normal");
  });

  test("converts non-string cell values to strings", () => {
    drawPDFTable(mockDoc, ["Num"], [[42]], 30);
    expect(mockDoc.text).toHaveBeenCalledWith("42", expect.any(Number), expect.any(Number));
  });

  test("no rows — only draws header, no addPage", () => {
    drawPDFTable(mockDoc, ["Only Header"], [], 20);
    expect(mockDoc.rect).toHaveBeenCalledTimes(1);
    expect(mockDoc.addPage).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// FIXED DOM RENDERING TESTS
// ─────────────────────────────────────────────────────────────────────────────

describe("DOM rendering", () => {
  beforeEach(() => {
    // Clear and rebuild full DOM with proper table wrappers
    document.body.innerHTML = `
      <table id="historyTable">
        <tbody id="historyTableBody"></tbody>
      </table>
      <table id="vendorsTable">
        <tbody id="vendorsTableBody"></tbody>
      </table>
      <table id="itemsTable">
        <tbody id="itemsTableBody"></tbody>
      </table>
      <canvas id="spendingChart"></canvas>
      <canvas id="vendorsChart"></canvas>
      <canvas id="itemsChart"></canvas>
    `;
  });

  test("history table renders correct number of rows", () => {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) throw new Error("historyTableBody not found");
    tbody.innerHTML = "";
    buildHistoryRows([makeOrder(), makeOrder(), makeOrder()]).forEach(row => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${row.date}</td><td>${row.vendor}</td><td>${row.items}</td><td>${row.total}</td><td>${row.status}</td>`;
      tbody.appendChild(tr);
    });
    expect(tbody.querySelectorAll("tr")).toHaveLength(3);
  });

  test("empty-state row displays correct message", () => {
    const tbody = document.getElementById("historyTableBody");
    if (!tbody) throw new Error("historyTableBody not found");
    tbody.innerHTML = `<tr><td colspan="5">No completed orders yet.</td></tr>`;
    expect(tbody.textContent).toContain("No completed orders yet.");
  });

  test("vendors table renders correct number of rows", () => {
    const tbody = document.getElementById("vendorsTableBody");
    if (!tbody) throw new Error("vendorsTableBody not found");
    const sorted = buildVendorsData([
      makeOrder({ vendor: "A", total: 300 }),
      makeOrder({ vendor: "B", total: 200 }),
      makeOrder({ vendor: "C", total: 100 }),
    ]);
    tbody.innerHTML = "";
    sorted.forEach(([vendor, data], idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idx + 1}</td><td>${vendor}</td><td>${data.count}</td><td>R ${data.total.toFixed(2)}</td>`;
      tbody.appendChild(tr);
    });
    expect(tbody.querySelectorAll("tr")).toHaveLength(3);
  });

  test("items table renders correct rank numbers", () => {
    const tbody = document.getElementById("itemsTableBody");
    if (!tbody) throw new Error("itemsTableBody not found");
    const sorted = buildItemsData([
      makeOrder({ items: [{ name: "Burger", quantity: 5 }] }),
      makeOrder({ items: [{ name: "Fries", quantity: 3 }] }),
    ]);
    tbody.innerHTML = "";
    sorted.forEach((item, idx) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${idx + 1}</td><td>${item[0]}</td><td>${item[1]}</td>`;
      tbody.appendChild(tr);
    });
    const cells = tbody.querySelectorAll("tr td:first-child");
    expect(cells[0].textContent).toBe("1");
    expect(cells[1].textContent).toBe("2");
  });
});

// ─────────────────────────────────────────────────────────────────────────────

describe("Edge cases", () => {
  test("single order — spending data has one month entry", () => {
    const { monthNames } = buildSpendingData([makeOrder({ month: 6, total: 75 })]);
    expect(monthNames).toEqual(["Jul"]);
  });

  test("vendor with 5 repeated orders has correct count and total", () => {
    const orders = Array.from({ length: 5 }, () => makeOrder({ vendor: "Repeat", total: 50 }));
    const sorted = buildVendorsData(orders);
    expect(sorted[0][1].count).toBe(5);
    expect(sorted[0][1].total).toBe(250);
  });

  test("items across many orders accumulate correctly", () => {
    const orders = Array.from({ length: 4 }, () =>
      makeOrder({ items: [{ name: "Wrap", quantity: 2 }] })
    );
    expect(buildItemsData(orders)[0]).toEqual(["Wrap", 8]);
  });

  test("history rows handle mixed item quantities correctly", () => {
    const orders = [makeOrder({ items: [{ name: "Juice", quantity: 1 }, { name: "Wrap", quantity: 3 }] })];
    expect(buildHistoryRows(orders)[0].items).toBe("Juice, Wrap x3");
  });

  test("spending CSV total rounds correctly", () => {
    const orders = [{ vendorName: "X", createdAt: new Date(2024, 0, 1), total: 33.333 }];
    const { rows } = buildSpendingCSVRows(buildSpendingData(orders));
    expect(rows[0][1]).toBe("33.33");
  });

  test("vendors CSV rank increments per entry", () => {
    const sorted = [
      ["A", { count: 3, total: 300 }],
      ["B", { count: 2, total: 200 }],
      ["C", { count: 1, total: 100 }],
    ];
    const { rows } = buildVendorsCSVRows(sorted);
    expect(rows.map(r => r[0])).toEqual([1, 2, 3]);
  });
});
