/* =========================================================
   analytics.js
   Drives the analytics dashboard with mock data.
   
   TODO (Firebase integration):
     - Replace MOCK_DATA below with real Firestore queries.
     - Each function that reads MOCK_DATA has a comment
       showing what the equivalent Firebase call would look like.
   ========================================================= */

"use strict";

// ----------------------------------------------------------
// MOCK DATA
// Replace this section with Firebase queries when the
// team's Firestore collections are ready.
// ----------------------------------------------------------

const MOCK_DATA = {

    vendors: [
        { id: "v1", name: "Wits Bites" },
        { id: "v2", name: "The Matrix Café" },
        { id: "v3", name: "Campus Grill" },
        { id: "v4", name: "Noodle Bar" },
    ],

    // Monthly revenue per vendor (Jan–Jun 2026), in ZAR
    // Firebase equivalent:
    //   db.collection("orders")
    //     .where("status", "==", "completed")
    //     .get()
    //   then group by vendorId and month
    salesByVendorMonth: {
        v1: [8200,  7400,  9100,  8750,  9600,  10200],
        v2: [5100,  6200,  5800,  7100,  6500,  7400],
        v3: [4300,  3900,  5200,  4800,  5500,  6100],
        v4: [3100,  3400,  2900,  3600,  4200,  3800],
    },

    months: ["Jan", "Feb", "Mar", "Apr", "May", "Jun"],

    // Average orders per hour of day (0–23), across all vendors
    // Firebase equivalent:
    //   group completed orders by hour(order.createdAt)
    //   and average across days
    ordersPerHour: [
        2,  1,  0,  0,  0,  1,   // 00:00 – 05:00
        3,  8, 14, 22, 28, 35,   // 06:00 – 11:00
       42, 38, 20, 15, 18, 24,   // 12:00 – 17:00
       30, 22, 14,  8,  5,  3,   // 18:00 – 23:00
    ],

    // Top menu items across all vendors
    // Firebase equivalent:
    //   db.collection("orderItems")
    //     .get()
    //   then group by itemId, sum quantities and revenue
    popularItems: [
        { rank: 1,  name: "Cheese Burger",       vendor: "Campus Grill",    orders: 412, priceEach: 65  },
        { rank: 2,  name: "Chicken Wrap",         vendor: "Wits Bites",      orders: 389, priceEach: 55  },
        { rank: 3,  name: "Beef Noodles",         vendor: "Noodle Bar",      orders: 301, priceEach: 70  },
        { rank: 4,  name: "Iced Americano",       vendor: "The Matrix Café", orders: 287, priceEach: 35  },
        { rank: 5,  name: "Veggie Burger",        vendor: "Campus Grill",    orders: 254, priceEach: 60  },
        { rank: 6,  name: "Toasted Sandwich",     vendor: "Wits Bites",      orders: 231, priceEach: 45  },
        { rank: 7,  name: "Spicy Ramen",          vendor: "Noodle Bar",      orders: 198, priceEach: 75  },
        { rank: 8,  name: "Cappuccino",           vendor: "The Matrix Café", orders: 176, priceEach: 40  },
        { rank: 9,  name: "Loaded Fries",         vendor: "Campus Grill",    orders: 165, priceEach: 50  },
        { rank: 10, name: "Breakfast Wrap",       vendor: "Wits Bites",      orders: 143, priceEach: 60  },
    ],
};

// ----------------------------------------------------------
// CHART.JS COLOR PALETTE
// ----------------------------------------------------------

const COLORS = [
    "#2563eb", // blue
    "#16a34a", // green
    "#dc2626", // red
    "#d97706", // amber
    "#7c3aed", // violet
    "#0891b2", // cyan
];

const COLORS_ALPHA = COLORS.map(c => c + "33"); // 20% opacity fills

// ----------------------------------------------------------
// UTILITY FUNCTIONS
// ----------------------------------------------------------

/**
 * Format a number as South African Rand.
 * @param {number} amount
 * @returns {string}  e.g. "R 8 200"
 */
function formatZAR(amount) {
    return "R " + amount.toLocaleString("en-ZA");
}

/**
 * Convert a 24-hour integer to a readable label.
 * @param {number} hour  0–23
 * @returns {string}  e.g. "13:00"
 */
function hourLabel(hour) {
    return hour.toString().padStart(2, "0") + ":00";
}

/**
 * Build and trigger a CSV download in the browser.
 * @param {string}   filename   File name without extension.
 * @param {string[]} headers    Column headers.
 * @param {Array[]}  rows       2D array of row values.
 */
function downloadCSV(filename, headers, rows) {
    const escape = val => {
        const s = String(val);
        return s.includes(",") || s.includes('"') || s.includes("\n")
            ? '"' + s.replace(/"/g, '""') + '"'
            : s;
    };

    const lines = [headers, ...rows].map(r => r.map(escape).join(","));
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href     = url;
    a.download = filename + ".csv";
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Print a specific section of the page as a simple PDF using
 * the browser's built-in print dialog.
 * Wraps only the target section so other reports are hidden.
 * @param {string} sectionId  The id of the <section> to print.
 * @param {string} title      Human-readable title for the print header.
 */
function printSectionAsPDF(sectionId, title) {
    const section = document.getElementById(sectionId);
    if (!section) return;

    // Clone the section to avoid mutating the live DOM
    const clone = section.cloneNode(true);

    // Remove the export buttons from the printed clone so they
    // don't appear in the PDF output.
    clone.querySelectorAll(".report-actions").forEach(el => el.remove());

    const printWindow = window.open("", "_blank", "width=900,height=700");
    printWindow.document.write(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8" />
            <title>${title} — Campus Food Ordering Platform</title>
            <style>
                body  { font-family: sans-serif; padding: 2rem; color: #111; }
                h1    { font-size: 1.4rem; margin-bottom: 1rem; }
                table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
                th    { background: #f3f4f6; padding: 0.5rem 0.75rem; text-align: left;
                        border-bottom: 2px solid #e5e7eb; }
                td    { padding: 0.5rem 0.75rem; border-bottom: 1px solid #e5e7eb; }
                canvas { max-width: 100%; height: auto !important; }
                .section-label { font-size: 0.75rem; text-transform: uppercase;
                                 letter-spacing: 0.06em; opacity: 0.55; }
                .report-description { font-size: 0.85rem; opacity: 0.6; }
                .peak-insight { background: #f0fdf4; border: 1px solid #bbf7d0;
                                padding: 0.75rem 1rem; border-radius: 6px;
                                font-size: 0.85rem; color: #166534; }
            </style>
        </head>
        <body>
            <h1>Campus Food Ordering Platform — ${title}</h1>
            ${clone.outerHTML}
            <script>window.onload = () => { window.print(); window.close(); }<\/script>
        </body>
        </html>
    `);
    printWindow.document.close();
}

// ----------------------------------------------------------
// REPORT 1 — SALES PER VENDOR OVER TIME
// ----------------------------------------------------------

function buildSalesChart() {
    const ctx = document.getElementById("salesChart").getContext("2d");

    const datasets = MOCK_DATA.vendors.map((vendor, i) => ({
        label:           vendor.name,
        data:            MOCK_DATA.salesByVendorMonth[vendor.id],
        backgroundColor: COLORS[i] + "bb",
        borderColor:     COLORS[i],
        borderWidth:     1.5,
        borderRadius:    4,
    }));

    new Chart(ctx, {
        type: "bar",
        data: { labels: MOCK_DATA.months, datasets },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "top" },
                tooltip: {
                    callbacks: {
                        label: ctx => " " + formatZAR(ctx.parsed.y),
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        callback: val => "R " + (val / 1000).toFixed(0) + "k",
                    },
                },
            },
        },
    });
}

function buildSalesTable() {
    const tbody = document.getElementById("salesTableBody");

    MOCK_DATA.vendors.forEach(vendor => {
        const monthly = MOCK_DATA.salesByVendorMonth[vendor.id];
        const total   = monthly.reduce((sum, v) => sum + v, 0);

        const tr  = document.createElement("tr");
        const cells = [
            vendor.name,
            ...monthly.map(formatZAR),
            formatZAR(total),
        ];

        cells.forEach((val, i) => {
            const td = document.createElement("td");
            td.textContent = val;
            if (i === cells.length - 1) td.style.fontWeight = "700";
            tr.appendChild(td);
        });

        tbody.appendChild(tr);
    });
}

function bindSalesExports() {
    document.getElementById("exportSalesCSV").addEventListener("click", () => {
        const headers = ["Vendor", ...MOCK_DATA.months, "Total"];
        const rows = MOCK_DATA.vendors.map(vendor => {
            const monthly = MOCK_DATA.salesByVendorMonth[vendor.id];
            const total   = monthly.reduce((s, v) => s + v, 0);
            return [vendor.name, ...monthly, total];
        });
        downloadCSV("sales-per-vendor", headers, rows);
    });

    document.getElementById("exportSalesPDF").addEventListener("click", () => {
        printSectionAsPDF("report-sales", "Sales Per Vendor Over Time");
    });
}

// ----------------------------------------------------------
// REPORT 2 — PEAK ORDERING HOURS
// ----------------------------------------------------------

function buildPeakChart() {
    const ctx    = document.getElementById("peakChart").getContext("2d");
    const labels = MOCK_DATA.ordersPerHour.map((_, i) => hourLabel(i));
    const data   = MOCK_DATA.ordersPerHour;

    // Colour bars differently for peak hours (>=30 orders)
    const bgColors = data.map(v => v >= 30 ? COLORS[0] + "cc" : COLORS[1] + "66");
    const bdColors = data.map(v => v >= 30 ? COLORS[0]         : COLORS[1]);

    new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label:           "Avg Orders",
                data,
                backgroundColor: bgColors,
                borderColor:     bdColors,
                borderWidth:     1.5,
                borderRadius:    3,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed.y} orders on average`,
                    },
                },
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: { display: true, text: "Avg Orders" },
                },
                x: {
                    title: { display: true, text: "Hour of Day" },
                },
            },
        },
    });
}

function buildPeakInsight() {
    const data     = MOCK_DATA.ordersPerHour;
    const maxOrders = Math.max(...data);
    const peakHour  = data.indexOf(maxOrders);

    document.getElementById("peakInsight").innerHTML =
        `<strong>Key insight:</strong> The busiest hour on campus is 
         <strong>${hourLabel(peakHour)}</strong> with an average of 
         <strong>${maxOrders} orders</strong>. 
         Consider advising vendors to increase staffing between 
         ${hourLabel(peakHour - 1)} and ${hourLabel(peakHour + 1)}.`;

    document.getElementById("kpiPeakHour").textContent = hourLabel(peakHour);
}

function bindPeakExports() {
    document.getElementById("exportPeakCSV").addEventListener("click", () => {
        const headers = ["Hour", "Average Orders"];
        const rows    = MOCK_DATA.ordersPerHour.map((v, i) => [hourLabel(i), v]);
        downloadCSV("peak-ordering-hours", headers, rows);
    });

    document.getElementById("exportPeakPDF").addEventListener("click", () => {
        printSectionAsPDF("report-peak", "Peak Ordering Hours");
    });
}

// ----------------------------------------------------------
// REPORT 3 — MOST POPULAR MENU ITEMS
// ----------------------------------------------------------

function buildPopularChart() {
    const ctx   = document.getElementById("popularChart").getContext("2d");
    const top5  = MOCK_DATA.popularItems.slice(0, 5);

    new Chart(ctx, {
        type: "doughnut",
        data: {
            labels:   top5.map(i => i.name),
            datasets: [{
                data:            top5.map(i => i.orders),
                backgroundColor: COLORS.slice(0, 5).map(c => c + "cc"),
                borderColor:     COLORS.slice(0, 5),
                borderWidth:     2,
            }],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { position: "bottom", labels: { font: { size: 11 } } },
                tooltip: {
                    callbacks: {
                        label: ctx => ` ${ctx.parsed} orders`,
                    },
                },
            },
        },
    });
}

function buildPopularTable() {
    const tbody = document.getElementById("popularTableBody");

    MOCK_DATA.popularItems.forEach(item => {
        const revenue = item.orders * item.priceEach;
        const tr = document.createElement("tr");
        [
            item.rank,
            item.name,
            item.vendor,
            item.orders.toLocaleString("en-ZA"),
            formatZAR(revenue),
        ].forEach(val => {
            const td = document.createElement("td");
            td.textContent = val;
            tr.appendChild(td);
        });
        tbody.appendChild(tr);
    });
}

function bindPopularExports() {
    document.getElementById("exportPopularCSV").addEventListener("click", () => {
        const headers = ["Rank", "Item", "Vendor", "Orders", "Revenue (ZAR)"];
        const rows    = MOCK_DATA.popularItems.map(item => [
            item.rank,
            item.name,
            item.vendor,
            item.orders,
            item.orders * item.priceEach,
        ]);
        downloadCSV("popular-menu-items", headers, rows);
    });

    document.getElementById("exportPopularPDF").addEventListener("click", () => {
        printSectionAsPDF("report-popular", "Most Popular Menu Items");
    });
}

// ----------------------------------------------------------
// KPI SUMMARY CARDS
// ----------------------------------------------------------

function buildKPIs() {
    // Total orders: sum all popular item orders as a proxy
    const totalOrders = MOCK_DATA.popularItems.reduce((s, i) => s + i.orders, 0);

    // Total revenue: sum all vendor sales for the most recent month
    const latestMonth = MOCK_DATA.months.length - 1;
    const totalRevenue = MOCK_DATA.vendors.reduce((s, v) => {
        return s + MOCK_DATA.salesByVendorMonth[v.id][latestMonth];
    }, 0);

    document.getElementById("kpiTotalOrders").textContent  = totalOrders.toLocaleString("en-ZA");
    document.getElementById("kpiTotalRevenue").textContent = formatZAR(totalRevenue);
    document.getElementById("kpiVendors").textContent      = MOCK_DATA.vendors.length;
    // kpiPeakHour is set by buildPeakInsight()
}

// ----------------------------------------------------------
// FOOTER YEAR
// ----------------------------------------------------------

function setFooterYear() {
    const el = document.getElementById("currentYear");
    if (el) el.textContent = new Date().getFullYear();
}

// ----------------------------------------------------------
// MOBILE NAV TOGGLE (mirrors index.js behaviour)
// ----------------------------------------------------------

function initMobileNav() {
    const toggle = document.getElementById("menuToggle");
    const list   = document.getElementById("menuList");
    if (!toggle || !list) return;

    toggle.addEventListener("click", () => {
        const isOpen = list.classList.toggle("open");
        toggle.setAttribute("aria-expanded", isOpen);
    });
}

// ----------------------------------------------------------
// INIT — runs when the DOM is ready
// ----------------------------------------------------------

document.addEventListener("DOMContentLoaded", () => {
    buildKPIs();

    buildSalesChart();
    buildSalesTable();
    bindSalesExports();

    buildPeakChart();
    buildPeakInsight();
    bindPeakExports();

    buildPopularChart();
    buildPopularTable();
    bindPopularExports();

    setFooterYear();
    initMobileNav();
});

/*
 * =========================================================
 * FIREBASE INTEGRATION NOTES
 * =========================================================
 * When the team's Firestore schema is finalised, replace
 * the MOCK_DATA object above with real queries.
 *
 * Suggested Firestore collections:
 *
 *   orders/
 *     {orderId}: {
 *       vendorId,
 *       studentId,
 *       status,           // "completed" | "cancelled" | ...
 *       createdAt,        // Firestore Timestamp
 *       totalAmount,      // number (ZAR)
 *       items: [{ itemId, name, quantity, unitPrice }]
 *     }
 *
 * Example query for sales per vendor in a given month:
 *
 *   import { collection, query, where, getDocs } from "firebase/firestore";
 *
 *   const start = new Date("2026-06-01");
 *   const end   = new Date("2026-06-30");
 *
 *   const q = query(
 *     collection(db, "orders"),
 *     where("status",    "==",  "completed"),
 *     where("createdAt", ">=",  start),
 *     where("createdAt", "<=",  end)
 *   );
 *
 *   const snapshot = await getDocs(q);
 *   snapshot.forEach(doc => {
 *     const order = doc.data();
 *     // group by order.vendorId, sum order.totalAmount
 *   });
 * =========================================================
 */
