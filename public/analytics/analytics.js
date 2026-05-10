// =========================================================
// analytics.js
// Analytics dashboard — fetches live order data from
// Firestore and renders Chart.js charts + exportable tables.
// Requires: Firebase config at ../authentication/config.js
//           Chart.js via CDN (analytics.html)
//           jsPDF via CDN  (analytics.html — add before this script)
// =========================================================

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import { getFirestore, collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getAuth, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyCoKYtzrL8ib4VDfd0Wr0cMjVPfgUkPtVA",
  authDomain: "campus-food-ordering-platform.firebaseapp.com",
  projectId: "campus-food-ordering-platform",
  storageBucket: "campus-food-ordering-platform.firebasestorage.app",
  messagingSenderId: "808109232496",
  appId: "1:808109232496:web:0c1bcd968c1493e3bbffb5"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// ---------------------------------------------------------
// Constants
// ---------------------------------------------------------

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const CHART_COLOURS = [
  "#f97316", "#3b82f6", "#10b981", "#8b5cf6",
  "#ec4899", "#f59e0b", "#06b6d4", "#84cc16"
];

// ---------------------------------------------------------
// Entry point — wait for auth before fetching data
// ---------------------------------------------------------

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    // Redirect to login if not signed in
    window.location.href = "../authentication/login.html";
    return;
  }

  try {
    const orders = await fetchAllOrders();
    renderSalesReport(orders);
    renderPeakReport(orders);
    renderPopularReport(orders);
  } catch (err) {
    console.error("Analytics load error:", err);
  }
});

// ---------------------------------------------------------
// Fetch all orders from Firestore
// ---------------------------------------------------------

async function fetchAllOrders() {
  const snap = await getDocs(
    query(collection(db, "orders"), orderBy("createdAt", "asc"))
  );

  return snap.docs.map(doc => {
    const d = doc.data();
    return {
      id: doc.id,
      vendorUid: d.vendorUid ?? "",
      vendorName: d.vendorName ?? "Unknown Vendor",
      customerUid: d.customerUid ?? "",
      total: d.total ?? d.totalAmount ?? d.subtotal ?? 0,
      items: Array.isArray(d.items) ? d.items : [],
      status: d.status ?? "",
      // createdAt can be a Firestore Timestamp or ISO string
      createdAt: d.createdAt?.toDate
        ? d.createdAt.toDate()
        : new Date(d.createdAt)
    };
  });
}

// ---------------------------------------------------------
// REPORT 1 — Sales per vendor over time
// ---------------------------------------------------------

function renderSalesReport(orders) {
  const currentYear = new Date().getFullYear();

  // Only use orders from current year
  const yearOrders = orders.filter(o => o.createdAt.getFullYear() === currentYear);

  // Build: { vendorName -> { monthIndex -> totalRevenue } }
  const vendorMap = {};

  for (const order of yearOrders) {
    const name = order.vendorName || "Unknown";
    const month = order.createdAt.getMonth(); // 0-based
    const revenue = Number(order.total) || 0;

    if (!vendorMap[name]) vendorMap[name] = {};
    vendorMap[name][month] = (vendorMap[name][month] ?? 0) + revenue;
  }

  const vendors = Object.keys(vendorMap);

  // Only show months up to current month
  const currentMonth = new Date().getMonth();
  const activeMonths = MONTHS.slice(0, currentMonth + 1);

  // Chart datasets
  const datasets = vendors.map((vendor, i) => ({
    label: vendor,
    data: activeMonths.map((_, mIdx) => vendorMap[vendor][mIdx] ?? 0),
    backgroundColor: CHART_COLOURS[i % CHART_COLOURS.length],
    borderRadius: 4,
    borderSkipped: false
  }));

  const ctx = document.getElementById("salesChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "bar",
    data: { labels: activeMonths, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: (item) => ` R ${item.raw.toFixed(2)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (val) => `R ${val}`
          }
        }
      }
    }
  });

  // Table
  const tbody = document.getElementById("salesTableBody");
  if (!tbody) return;

  let html = "";
  const vendorTotals = {};

  for (const vendor of vendors) {
    const monthCells = activeMonths.map((_, mIdx) => {
      const val = vendorMap[vendor][mIdx] ?? 0;
      return `<td>R ${val.toFixed(2)}</td>`;
    }).join("");

    const rowTotal = activeMonths.reduce(
      (sum, _, mIdx) => sum + (vendorMap[vendor][mIdx] ?? 0), 0
    );
    vendorTotals[vendor] = rowTotal;

    html += `<tr>
      <td>${vendor}</td>
      ${monthCells}
      <td><strong>R ${rowTotal.toFixed(2)}</strong></td>
    </tr>`;
  }

  // Grand total row
  const grandTotal = Object.values(vendorTotals).reduce((a, b) => a + b, 0);
  const grandMonthCells = activeMonths.map((_, mIdx) => {
    const colTotal = vendors.reduce(
      (sum, v) => sum + (vendorMap[v][mIdx] ?? 0), 0
    );
    return `<td><strong>R ${colTotal.toFixed(2)}</strong></td>`;
  }).join("");

  html += `<tr class="total-row">
    <td>Total</td>
    ${grandMonthCells}
    <td><strong>R ${grandTotal.toFixed(2)}</strong></td>
  </tr>`;

  tbody.innerHTML = html;

  // Export buttons
  document.getElementById("exportSalesCSV")?.addEventListener("click", () => {
    exportTableCSV("salesTable", "sales-per-vendor.csv");
  });
  document.getElementById("exportSalesPDF")?.addEventListener("click", () => {
    exportSectionPDF("report-sales", "sales-per-vendor.pdf");
  });
}

// ---------------------------------------------------------
// REPORT 2 — Peak ordering hours
// ---------------------------------------------------------

function renderPeakReport(orders) {
  // Count orders by hour of day (0–23)
  const hourlyCounts = new Array(24).fill(0);

  for (const order of orders) {
    const hour = order.createdAt.getHours();
    hourlyCounts[hour]++;
  }

  const labels = Array.from({ length: 24 }, (_, i) => {
    const suffix = i < 12 ? "AM" : "PM";
    const display = i === 0 ? 12 : i > 12 ? i - 12 : i;
    return `${display}${suffix}`;
  });

  const ctx = document.getElementById("peakChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Orders",
        data: hourlyCounts,
        backgroundColor: hourlyCounts.map(count => {
          // Highlight the peak hour
          const max = Math.max(...hourlyCounts);
          return count === max ? "#f97316" : "#3b82f6";
        }),
        borderRadius: 4,
        borderSkipped: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.raw} order${item.raw !== 1 ? "s" : ""}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1 }
        }
      }
    }
  });

  // Peak insight banner
  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  const peakLabel = labels[peakHour];
  const peakCount = hourlyCounts[peakHour];
  const insight = document.getElementById("peakInsight");
  if (insight && peakCount > 0) {
    insight.textContent =
      `📈 Peak ordering time is ${peakLabel} with ${peakCount} order${peakCount !== 1 ? "s" : ""}. ` +
      `Consider increasing vendor staffing and preparation capacity during this window.`;
  }

  document.getElementById("exportPeakCSV")?.addEventListener("click", () => {
    const rows = [["Hour", "Orders"]];
    labels.forEach((label, i) => rows.push([label, hourlyCounts[i]]));
    downloadCSV(rows, "peak-ordering-hours.csv");
  });
  document.getElementById("exportPeakPDF")?.addEventListener("click", () => {
    exportSectionPDF("report-peak", "peak-ordering-hours.pdf");
  });
}

// ---------------------------------------------------------
// REPORT 3 — Most popular menu items
// ---------------------------------------------------------

function renderPopularReport(orders) {
  // Aggregate by menuItemId across all order items
  const itemMap = {};

  for (const order of orders) {
    for (const item of order.items) {
      const id = item.menuItemId ?? item.name;
      if (!itemMap[id]) {
        itemMap[id] = {
          name: item.name ?? "Unknown Item",
          vendor: item.vendorName ?? order.vendorName ?? "Unknown",
          orders: 0,
          revenue: 0
        };
      }
      const qty = Number(item.quantity) || 1;
      const price = Number(item.price) || 0;
      itemMap[id].orders += qty;
      itemMap[id].revenue += price * qty;
    }
  }

  // Sort by order count descending, take top 8
  const sorted = Object.values(itemMap)
    .sort((a, b) => b.orders - a.orders)
    .slice(0, 8);

  // Doughnut chart
  const ctx = document.getElementById("popularChart");
  if (!ctx) return;

  new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(i => i.name),
      datasets: [{
        data: sorted.map(i => i.orders),
        backgroundColor: CHART_COLOURS.slice(0, sorted.length),
        borderWidth: 2,
        hoverOffset: 8
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (item) => ` ${item.raw} order${item.raw !== 1 ? "s" : ""}`
          }
        }
      }
    }
  });

  // Table
  const tbody = document.getElementById("popularTableBody");
  if (!tbody) return;

  tbody.innerHTML = sorted.map((item, idx) => `
    <tr>
      <td>${idx + 1}</td>
      <td>${item.name}</td>
      <td>${item.vendor}</td>
      <td>${item.orders}</td>
      <td>R ${item.revenue.toFixed(2)}</td>
    </tr>
  `).join("");

  document.getElementById("exportPopularCSV")?.addEventListener("click", () => {
    const rows = [["Rank", "Item", "Vendor", "Orders", "Revenue"]];
    sorted.forEach((item, idx) =>
      rows.push([idx + 1, item.name, item.vendor, item.orders, `R ${item.revenue.toFixed(2)}`])
    );
    downloadCSV(rows, "popular-menu-items.csv");
  });
  document.getElementById("exportPopularPDF")?.addEventListener("click", () => {
    exportSectionPDF("report-popular", "popular-menu-items.pdf");
  });
}

// ---------------------------------------------------------
// Export helpers
// ---------------------------------------------------------

/** Export a <table> element to CSV by its ID */
function exportTableCSV(tableId, filename) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const rows = [...table.querySelectorAll("tr")].map(row =>
    [...row.querySelectorAll("th, td")].map(cell =>
      `"${cell.innerText.replace(/"/g, '""')}"`
    ).join(",")
  );

  downloadCSV(rows.map(r => [r]), filename, true);
}

/** Download a 2D array as a CSV file */
function downloadCSV(rows, filename, rawRows = false) {
  const csv = rawRows
    ? rows.map(r => r[0]).join("\n")
    : rows.map(r => r.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");

  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

/** Export a report section to PDF using jsPDF */
function exportSectionPDF(sectionId, filename) {
  const { jsPDF } = window.jspdf;
  if (!jsPDF) {
    console.error("jsPDF not loaded. Add the CDN script to analytics.html.");
    return;
  }

  const section = document.getElementById(sectionId);
  if (!section) return;

  const doc = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });

  // Grab the heading text for the PDF title
  const heading = section.querySelector("h2")?.innerText ?? filename;
  const desc = section.querySelector(".report-description")?.innerText ?? "";

  doc.setFontSize(18);
  doc.text(heading, 40, 50);
  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(desc, 40, 68);
  doc.setTextColor(0);

  // Extract table data if present
  const table = section.querySelector("table");
  if (table) {
    const headers = [...table.querySelectorAll("thead th")].map(th => th.innerText);
    const bodyRows = [...table.querySelectorAll("tbody tr")].map(row =>
      [...row.querySelectorAll("td")].map(td => td.innerText)
    );

    // Simple manual table rendering
    const startY = 90;
    const colWidth = (doc.internal.pageSize.getWidth() - 80) / (headers.length || 1);
    const rowHeight = 20;

    // Header row
    doc.setFillColor(249, 250, 251);
    doc.setFontSize(8);
    doc.setFont(undefined, "bold");
    headers.forEach((h, i) => {
      doc.rect(40 + i * colWidth, startY, colWidth, rowHeight, "F");
      doc.text(h, 44 + i * colWidth, startY + 13);
    });

    // Body rows
    doc.setFont(undefined, "normal");
    bodyRows.forEach((row, rIdx) => {
      const y = startY + (rIdx + 1) * rowHeight;
      if (rIdx % 2 === 0) {
        doc.setFillColor(255, 255, 255);
      } else {
        doc.setFillColor(249, 250, 251);
      }
      row.forEach((cell, i) => {
        doc.rect(40 + i * colWidth, y, colWidth, rowHeight, "F");
        doc.text(String(cell), 44 + i * colWidth, y + 13);
      });
    });
  } else {
    doc.setFontSize(10);
    doc.text("No table data available for this report.", 40, 100);
  }

  // Footer
  const pageW = doc.internal.pageSize.getWidth();
  doc.setFontSize(8);
  doc.setTextColor(150);
  doc.text(
    `Campus Food Ordering Platform · Exported ${new Date().toLocaleDateString("en-ZA")}`,
    pageW / 2, doc.internal.pageSize.getHeight() - 20,
    { align: "center" }
  );

  doc.save(filename);
}

// ---------------------------------------------------------
// Footer year
// ---------------------------------------------------------

const yearEl = document.getElementById("currentYear");
if (yearEl) yearEl.textContent = new Date().getFullYear();