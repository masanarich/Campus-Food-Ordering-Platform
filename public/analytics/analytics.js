// =========================================================
// analytics.js — REAL-TIME + DYNAMIC FIRESTORE ANALYTICS
// =========================================================

import {
  initializeApp,
  getApps,
  getApp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";

import {
  getFirestore,
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  getAuth,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ---------------- FIREBASE ----------------
const firebaseConfig = {
  apiKey: "AIzaSyCoKYtzrL8ib4VDfd0Wr0cMjVPfgUkPtVA",
  authDomain: "campus-food-ordering-platform.firebaseapp.com",
  projectId: "campus-food-ordering-platform",
  storageBucket: "campus-food-ordering-platform.firebasestorage.app",
  messagingSenderId: "808109232496",
  appId: "1:808109232496:web:0c1bcd968c1493e3bbffb5"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
const db  = getFirestore(app);
const auth = getAuth(app);

// ---------------- STATE ----------------
let salesChart   = null;
let peakChart    = null;
let popularChart = null;

// Cached data for exports
let cachedSalesData   = { vendorList: [], monthsUsed: [], monthNames: [], vendorMap: {}, grandTotal: 0, monthlyTotals: {} };
let cachedPeakData    = { hours: [] };
let cachedPopularData = { sorted: [] };

const COLORS = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ec4899","#f59e0b"];

// =========================================================
// AUTH + REAL-TIME STREAM
// =========================================================

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../authentication/login.html";
    return;
  }

  const q = query(
    collection(db, "orders"),
    where("status", "==", "completed")
  );

  onSnapshot(q, (snapshot) => {
    const orders = snapshot.docs
      .map(doc => {
        const d = doc.data();
        return {
          ...d,
          createdAt: d.createdAt?.toDate
            ? d.createdAt.toDate()
            : new Date(d.createdAt)
        };
      })
      .sort((a, b) => a.createdAt - b.createdAt);

    renderAll(orders);
  });
});

// =========================================================
// MASTER RENDER
// =========================================================

function renderAll(orders) {
  renderSales(orders);
  renderPeak(orders);
  renderPopular(orders);
}

// =========================================================
// SALES REPORT
// =========================================================

function renderSales(orders) {
  const ctx = document.getElementById("salesChart");
  if (!ctx) return;

  if (salesChart) salesChart.destroy();

  const monthSet = new Set();
  orders.forEach(o => monthSet.add(o.createdAt.getMonth()));
  const monthsUsed = Array.from(monthSet).sort((a, b) => a - b);
  const monthNames = monthsUsed.map(m => [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ][m]);

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

  salesChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthNames,
      datasets: vendorList.map((v, i) => ({
        label: v,
        data: monthsUsed.map(m => vendorMap[v]?.[m] || 0),
        backgroundColor: COLORS[i % COLORS.length]
      }))
    }
  });

  const tbody     = document.getElementById("salesTableBody");
  const headerRow = document.getElementById("salesHeaderRow");
  if (!tbody || !headerRow) return;

  tbody.innerHTML = "";
  headerRow.innerHTML = `
    <th>Vendor</th>
    ${monthNames.map(m => `<th>${m}</th>`).join("")}
    <th>Total</th>
  `;

  let grandTotal = 0;
  const monthlyTotals = {};

  vendorList.forEach(vendor => {
    let rowTotal = 0;
    const rowCells = monthsUsed.map(m => {
      const val = vendorMap[vendor]?.[m] || 0;
      rowTotal += val;
      monthlyTotals[m] = (monthlyTotals[m] || 0) + val;
      return `<td>R ${val.toFixed(2)}</td>`;
    }).join("");

    grandTotal += rowTotal;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><strong>${vendor}</strong></td>
      ${rowCells}
      <td><strong>R ${rowTotal.toFixed(2)}</strong></td>
    `;
    tbody.appendChild(row);
  });

  const totalRow = document.createElement("tr");
  totalRow.innerHTML = `
    <td><strong>Total</strong></td>
    ${monthsUsed.map(m => `<td><strong>R ${(monthlyTotals[m] || 0).toFixed(2)}</strong></td>`).join("")}
    <td><strong>R ${grandTotal.toFixed(2)}</strong></td>
  `;
  tbody.appendChild(totalRow);

  cachedSalesData = { vendorList, monthsUsed, monthNames, vendorMap, grandTotal, monthlyTotals };
}

// =========================================================
// PEAK HOURS
// =========================================================

function renderPeak(orders) {
  const ctx = document.getElementById("peakChart");
  if (!ctx) return;

  if (peakChart) peakChart.destroy();

  const hours = Array(24).fill(0);
  orders.forEach(o => hours[o.createdAt.getHours()]++);

  peakChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: hours.map((_, i) => `${i}:00`),
      datasets: [{ label: "Orders", data: hours }]
    }
  });

  const peak    = hours.indexOf(Math.max(...hours));
  const insight = document.getElementById("peakInsight");
  if (insight) insight.textContent = `Peak hour: ${peak}:00 with ${hours[peak]} orders.`;

  cachedPeakData = { hours };
}

// =========================================================
// POPULAR ITEMS
// =========================================================

function renderPopular(orders) {
  const ctx = document.getElementById("popularChart");
  if (!ctx) return;

  if (popularChart) popularChart.destroy();

  const map = {};
  orders.forEach(o => {
    (o.items || []).forEach(i => {
      const name = i.name || "Unknown";
      map[name] = (map[name] || 0) + Number(i.quantity || 1);
    });
  });

  const sorted = Object.entries(map)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6);

  popularChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{ data: sorted.map(x => x[1]), backgroundColor: COLORS }]
    }
  });

  const tbody = document.getElementById("popularTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  sorted.forEach((item, idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${idx + 1}</td>
      <td>${item[0]}</td>
      <td>${item[1]}</td>
    `;
    tbody.appendChild(row);
  });

  cachedPopularData = { sorted };
}

// =========================================================
// PDF HELPER — draw a simple table without autoTable
// =========================================================

function drawPDFTable(doc, headers, rows, startY) {
  const colWidth  = (doc.internal.pageSize.getWidth() - 28) / headers.length;
  const rowHeight = 8;
  const startX    = 14;
  let y = startY;

  // Header row
  doc.setFontSize(8);
  doc.setFont(undefined, "bold");
  headers.forEach((h, i) => {
    doc.rect(startX + i * colWidth, y, colWidth, rowHeight);
    doc.text(String(h), startX + i * colWidth + 2, y + 5.5);
  });
  y += rowHeight;

  // Data rows
  doc.setFont(undefined, "normal");
  rows.forEach(row => {
    // Add a new page if we're running out of space
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

  return y; // return final Y position
}

// =========================================================
// EXPORT — CSV (Excel)
// =========================================================

function exportSalesCSV() {
  const { vendorList, monthsUsed, monthNames, vendorMap, grandTotal, monthlyTotals } = cachedSalesData;

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

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sales Report");
  XLSX.writeFile(wb, "sales_report.xlsx");
}

function exportPeakCSV() {
  const { hours } = cachedPeakData;

  const header = ["Hour", "Orders"];
  const rows   = hours.map((count, i) => [`${i}:00`, count]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Peak Hours");
  XLSX.writeFile(wb, "peak_hours.xlsx");
}

function exportPopularCSV() {
  const { sorted } = cachedPopularData;

  const header = ["Rank", "Item", "Orders"];
  const rows   = sorted.map((item, idx) => [idx + 1, item[0], item[1]]);

  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Popular Items");
  XLSX.writeFile(wb, "popular_items.xlsx");
}

// =========================================================
// EXPORT — PDF (no autoTable, pure jsPDF)
// =========================================================

function exportSalesPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { vendorList, monthsUsed, monthNames, vendorMap, grandTotal, monthlyTotals } = cachedSalesData;

  doc.setFontSize(16);
  doc.text("Sales Per Vendor Report", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);

  const headers = ["Vendor", ...monthNames, "Total"];
  const rows = vendorList.map(vendor => {
    let rowTotal = 0;
    const cells = monthsUsed.map(m => {
      const val = vendorMap[vendor]?.[m] || 0;
      rowTotal += val;
      return `R ${val.toFixed(2)}`;
    });
    return [vendor, ...cells, `R ${rowTotal.toFixed(2)}`];
  });
  rows.push(["Total", ...monthsUsed.map(m => `R ${(monthlyTotals[m] || 0).toFixed(2)}`), `R ${grandTotal.toFixed(2)}`]);

  let finalY = drawPDFTable(doc, headers, rows, 30);

  // Embed chart image
  const chartCanvas = document.getElementById("salesChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) doc.addPage(), finalY = 20;
    const pageW = doc.internal.pageSize.getWidth();
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, pageW - 28, 80);
  }

  doc.save("sales_report.pdf");
}

function exportPeakPDF() {
  const { jsPDF } = window.jspdf;
  const doc  = new jsPDF();
  const { hours } = cachedPeakData;
  const peak = hours.indexOf(Math.max(...hours));

  doc.setFontSize(16);
  doc.text("Peak Ordering Hours Report", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.text(`Peak hour: ${peak}:00 with ${hours[peak]} orders.`, 14, 30);

  const headers = ["Hour", "Orders"];
  const rows    = hours.map((count, i) => [`${i}:00`, String(count)]);

  let finalY = drawPDFTable(doc, headers, rows, 37);

  const chartCanvas = document.getElementById("peakChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) doc.addPage(), finalY = 20;
    const pageW = doc.internal.pageSize.getWidth();
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, pageW - 28, 80);
  }

  doc.save("peak_hours.pdf");
}

function exportPopularPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { sorted } = cachedPopularData;

  doc.setFontSize(16);
  doc.text("Popular Items Report", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);

  const headers = ["Rank", "Item", "Orders"];
  const rows    = sorted.map((item, idx) => [String(idx + 1), item[0], String(item[1])]);

  let finalY = drawPDFTable(doc, headers, rows, 30);

  const chartCanvas = document.getElementById("popularChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) doc.addPage(), finalY = 20;
    const pageW = doc.internal.pageSize.getWidth();
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, pageW - 28, 80);
  }

  doc.save("popular_items.pdf");
}

// =========================================================
// WIRE UP BUTTONS
// =========================================================

document.getElementById("exportSalesCSV")?.addEventListener("click", exportSalesCSV);
document.getElementById("exportPeakCSV")?.addEventListener("click", exportPeakCSV);
document.getElementById("exportPopularCSV")?.addEventListener("click", exportPopularCSV);

document.getElementById("exportSalesPDF")?.addEventListener("click", exportSalesPDF);
document.getElementById("exportPeakPDF")?.addEventListener("click", exportPeakPDF);
document.getElementById("exportPopularPDF")?.addEventListener("click", exportPopularPDF);

// =========================================================
// FOOTER
// =========================================================

const year = document.getElementById("currentYear");
if (year) year.textContent = new Date().getFullYear();