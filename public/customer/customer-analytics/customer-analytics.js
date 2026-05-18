// CUSTOMER ANALYTICS — Real-time Firestore (filtered to current student)
import { db, auth } from "../../authentication/config.js";

import {
  collection,
  query,
  where,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

// ---------------- STATE ----------------
let spendingChart = null;
let vendorsChart  = null;
let itemsChart    = null;
let habitsChart   = null;

let cachedOrders       = [];
let cachedSpendingData = { monthNames: [], monthsUsed: [], monthlyTotals: {} };
let cachedVendorsData  = { sorted: [] };
let cachedItemsData    = { sorted: [] };
let cachedHabitsData   = { hours: [] };

const COLORS = ["#f97316","#3b82f6","#10b981","#8b5cf6","#ec4899","#f59e0b"];

// ---------------- AUTH + REAL-TIME STREAM ----------------

onAuthStateChanged(auth, (user) => {
  if (!user) {
    window.location.href = "../../authentication/login.html";
    return;
  }

  const q = query(
    collection(db, "orders"),
    where("customerUid", "==", user.uid),
    where("status", "==", "completed")
  );


  onSnapshot(q, (snapshot) => {

    const orders = snapshot.docs
      .map(doc => {
        const d = doc.data();
        console.log("[FIRESTORE] Order doc:", d);
        return {
          ...d,
          createdAt: d.createdAt?.toDate
            ? d.createdAt.toDate()
            : new Date(d.createdAt)
        };
      })
      .sort((a, b) => b.createdAt - a.createdAt);

    cachedOrders = orders;
    renderAll(orders);
  }, (error) => {
  });
});

// ---------------- MASTER RENDER ----------------

function renderAll(orders) {
  renderSpending(orders);
  renderHistory(orders);
  renderVendors(orders);
  renderItems(orders);
}

// ---------------- SPENDING OVER TIME ----------------

function renderSpending(orders) {
  const ctx = document.getElementById("spendingChart");
  if (!ctx) return;
  if (spendingChart) spendingChart.destroy();

  const monthSet = new Set();
  orders.forEach(o => monthSet.add(o.createdAt.getMonth()));
  const monthsUsed = Array.from(monthSet).sort((a, b) => a - b);
  const monthNames = monthsUsed.map(m => [
    "Jan","Feb","Mar","Apr","May","Jun",
    "Jul","Aug","Sep","Oct","Nov","Dec"
  ][m]);

  const monthlyTotals = {};
  orders.forEach(o => {
    const m = o.createdAt.getMonth();
    monthlyTotals[m] = (monthlyTotals[m] || 0) + Number(o.total || 0);
  });

  spendingChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: monthNames,
      datasets: [{
        label: "Amount Spent (R)",
        data: monthsUsed.map(m => monthlyTotals[m] || 0),
        backgroundColor: COLORS[0],
        borderRadius: 6
      }]
    },
    options: {
      plugins: { legend: { display: false } },
      scales: { y: { beginAtZero: true } }
    }
  });

  cachedSpendingData = { monthNames, monthsUsed, monthlyTotals };
}

// ---------------- ORDER HISTORY TABLE ----------------

function renderHistory(orders) {
  const tbody = document.getElementById("historyTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";

  if (orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;opacity:0.5;padding:2rem;">No completed orders yet.</td></tr>`;
    return;
  }

  orders.forEach(o => {
    const date  = o.createdAt.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" });
    const items = (o.items || []).map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join(", ") || "—";
    const row   = document.createElement("tr");
    row.innerHTML = `
      <td>${date}</td>
      <td>${o.vendorName || "Unknown"}</td>
      <td>${items}</td>
      <td>R ${Number(o.total || 0).toFixed(2)}</td>
      <td><span class="status-badge">${o.status || "completed"}</span></td>
    `;
    tbody.appendChild(row);
  });
}

// ---------------- FAVOURITE VENDORS ----------------

function renderVendors(orders) {
  const ctx = document.getElementById("vendorsChart");
  if (!ctx) return;
  if (vendorsChart) vendorsChart.destroy();

  const vendorMap = {};
  orders.forEach(o => {
    const v = o.vendorName || "Unknown";
    if (!vendorMap[v]) vendorMap[v] = { count: 0, total: 0 };
    vendorMap[v].count++;
    vendorMap[v].total += Number(o.total || 0);
  });

  const sorted = Object.entries(vendorMap)
    .sort((a, b) => b[1].total - a[1].total)
    .slice(0, 6);

  vendorsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{ data: sorted.map(x => x[1].total), backgroundColor: COLORS }]
    }
  });

  const tbody = document.getElementById("vendorsTableBody");
  if (!tbody) return;
  tbody.innerHTML = "";
  sorted.forEach(([vendor, data], idx) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${idx + 1}</td>
      <td>${vendor}</td>
      <td>${data.count}</td>
      <td>R ${data.total.toFixed(2)}</td>
    `;
    tbody.appendChild(row);
  });

  cachedVendorsData = { sorted };
}

// ---------------- MOST ORDERED ITEMS ----------------

function renderItems(orders) {
  const ctx = document.getElementById("itemsChart");
  if (!ctx) return;
  if (itemsChart) itemsChart.destroy();

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

  itemsChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: sorted.map(x => x[0]),
      datasets: [{ data: sorted.map(x => x[1]), backgroundColor: COLORS }]
    }
  });

  const tbody = document.getElementById("itemsTableBody");
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

  cachedItemsData = { sorted };
}

// ================================================================
// PDF HELPER
// ================================================================

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

// ================================================================
// EXPORTS — SPENDING
// ================================================================

function exportSpendingCSV() {
  const { monthNames, monthsUsed, monthlyTotals } = cachedSpendingData;
  const header = ["Month", "Amount Spent (R)"];
  const rows   = monthsUsed.map((m, i) => [monthNames[i], (monthlyTotals[m] || 0).toFixed(2)]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "My Spending");
  XLSX.writeFile(wb, "my_spending.xlsx");
}

function exportSpendingPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  const { monthNames, monthsUsed, monthlyTotals } = cachedSpendingData;
  doc.setFontSize(16);
  doc.text("My Spending Over Time", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  const headers = ["Month", "Amount Spent (R)"];
  const rows    = monthsUsed.map((m, i) => [monthNames[i], `R ${(monthlyTotals[m] || 0).toFixed(2)}`]);
  let finalY = drawPDFTable(doc, headers, rows, 30);
  const chartCanvas = document.getElementById("spendingChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); finalY = 20; }
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, doc.internal.pageSize.getWidth() - 28, 80);
  }
  doc.save("my_spending.pdf");
}

// ================================================================
// EXPORTS — HISTORY
// ================================================================

function exportHistoryCSV() {
  const header = ["Date", "Vendor", "Items", "Total (R)", "Status"];
  const rows   = cachedOrders.map(o => {
    const date  = o.createdAt.toLocaleDateString("en-ZA");
    const items = (o.items || []).map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join("; ");
    return [date, o.vendorName || "Unknown", items, Number(o.total || 0).toFixed(2), o.status || "completed"];
  });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Order History");
  XLSX.writeFile(wb, "my_order_history.xlsx");
}

function exportHistoryPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("My Order History", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  const headers = ["Date", "Vendor", "Total", "Status"];
  const rows    = cachedOrders.map(o => [
    o.createdAt.toLocaleDateString("en-ZA"),
    o.vendorName || "Unknown",
    `R ${Number(o.total || 0).toFixed(2)}`,
    o.status || "completed"
  ]);
  drawPDFTable(doc, headers, rows, 30);
  doc.save("my_order_history.pdf");
}

// ================================================================
// EXPORTS — VENDORS
// ================================================================

function exportVendorsCSV() {
  const header = ["Rank", "Vendor", "Orders", "Total Spent (R)"];
  const rows   = cachedVendorsData.sorted.map(([vendor, data], idx) => [
    idx + 1, vendor, data.count, data.total.toFixed(2)
  ]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Favourite Vendors");
  XLSX.writeFile(wb, "my_favourite_vendors.xlsx");
}

function exportVendorsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("My Favourite Vendors", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  const headers = ["Rank", "Vendor", "Orders", "Total Spent"];
  const rows    = cachedVendorsData.sorted.map(([vendor, data], idx) => [
    String(idx + 1), vendor, String(data.count), `R ${data.total.toFixed(2)}`
  ]);
  let finalY = drawPDFTable(doc, headers, rows, 30);
  const chartCanvas = document.getElementById("vendorsChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); finalY = 20; }
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, doc.internal.pageSize.getWidth() - 28, 80);
  }
  doc.save("my_favourite_vendors.pdf");
}

// ================================================================
// EXPORTS — ITEMS
// ================================================================

function exportItemsCSV() {
  const header = ["Rank", "Item", "Times Ordered"];
  const rows   = cachedItemsData.sorted.map((item, idx) => [idx + 1, item[0], item[1]]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Most Ordered Items");
  XLSX.writeFile(wb, "my_most_ordered_items.xlsx");
}

function exportItemsPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  doc.setFontSize(16);
  doc.text("My Most Ordered Items", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  const headers = ["Rank", "Item", "Times Ordered"];
  const rows    = cachedItemsData.sorted.map((item, idx) => [String(idx + 1), item[0], String(item[1])]);
  let finalY = drawPDFTable(doc, headers, rows, 30);
  const chartCanvas = document.getElementById("itemsChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); finalY = 20; }
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, doc.internal.pageSize.getWidth() - 28, 80);
  }
  doc.save("my_most_ordered_items.pdf");
}

// ================================================================
// EXPORTS — HABITS
// ================================================================

function exportHabitsCSV() {
  const header = ["Hour", "Orders"];
  const rows   = cachedHabitsData.hours.map((count, i) => [`${i}:00`, count]);
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Ordering Habits");
  XLSX.writeFile(wb, "my_ordering_habits.xlsx");
}

function exportHabitsPDF() {
  const { jsPDF } = window.jspdf;
  const doc   = new jsPDF();
  const { hours } = cachedHabitsData;
  const peak  = hours.indexOf(Math.max(...hours));
  doc.setFontSize(16);
  doc.text("My Ordering Habits", 14, 16);
  doc.setFontSize(9);
  doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 23);
  doc.text(hours[peak] > 0 ? `You order most at ${peak}:00.` : "No ordering data yet.", 14, 30);
  const headers = ["Hour", "Orders"];
  const rows    = hours.map((count, i) => [`${i}:00`, String(count)]);
  let finalY = drawPDFTable(doc, headers, rows, 37);
  const chartCanvas = document.getElementById("habitsChart");
  if (chartCanvas) {
    finalY += 8;
    if (finalY + 90 > doc.internal.pageSize.getHeight() - 10) { doc.addPage(); finalY = 20; }
    doc.addImage(chartCanvas.toDataURL("image/png"), "PNG", 14, finalY, doc.internal.pageSize.getWidth() - 28, 80);
  }
  doc.save("my_ordering_habits.pdf");
}

// ================================================================
// WIRE UP BUTTONS
// ================================================================

document.getElementById("exportSpendingCSV")?.addEventListener("click", exportSpendingCSV);
document.getElementById("exportSpendingPDF")?.addEventListener("click", exportSpendingPDF);
document.getElementById("exportHistoryCSV")?.addEventListener("click", exportHistoryCSV);
document.getElementById("exportHistoryPDF")?.addEventListener("click", exportHistoryPDF);
document.getElementById("exportVendorsCSV")?.addEventListener("click", exportVendorsCSV);
document.getElementById("exportVendorsPDF")?.addEventListener("click", exportVendorsPDF);
document.getElementById("exportItemsCSV")?.addEventListener("click", exportItemsCSV);
document.getElementById("exportItemsPDF")?.addEventListener("click", exportItemsPDF);
document.getElementById("exportHabitsCSV")?.addEventListener("click", exportHabitsCSV);
document.getElementById("exportHabitsPDF")?.addEventListener("click", exportHabitsPDF);

// ================================================================
// FOOTER
// ================================================================

const year = document.getElementById("currentYear");
if (year) year.textContent = new Date().getFullYear();