import { auth, db } from '../authentication/config.js';

import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { collection, getDocs, query, where, orderBy, Timestamp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
/* ── Chart instances ── */
let salesChartInst = null;
let hourlyChartInst = null;
let weekdayChartInst = null;
let customChartInst = null;

/* ── Stored data for exports ── */
let currentSalesData = null;
let currentCustomData = null;

/* ── Colors ── */
const COLORS = [
    '#e05f8e',
    '#f09050',
    '#2daf74',
    '#7c5cdc',
    '#f9a8c9',
    '#b8f0d8',
];

/* ── Formatters ── */
function fmtRand(n) {
    return 'R ' + Number(n).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function fmtNum(n) {
    return Math.round(n).toLocaleString();
}

/* ══════════════════════════════════════════════
   INIT
══════════════════════════════════════════════ */
onAuthStateChanged(auth, async (user) => {
    if (!user) {
        window.location.href = '../../authentication/login.html';
        return;
    }

    const today = new Date();
    const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
    const fmt = d => d.toISOString().split('T')[0];

    document.getElementById('dateFrom').value = fmt(month);
    document.getElementById('dateTo').value = fmt(today);
    document.getElementById('customFrom').value = fmt(month);
    document.getElementById('customTo').value = fmt(today);

    loadAll();
});

/* ══════════════════════════════════════════════
   TAB SWITCHING
══════════════════════════════════════════════ */
window.switchTab = function (id, btn) {
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-' + id).classList.add('active');
    btn.classList.add('active');
};

/* ══════════════════════════════════════════════
   FETCH ORDERS FROM FIRESTORE
══════════════════════════════════════════════ */
async function fetchOrders(fromDateId = 'dateFrom', toDateId = 'dateTo') {
    const from = document.getElementById(fromDateId).value;
    const to = document.getElementById(toDateId).value;

    const fromTs = Timestamp.fromDate(new Date(from + 'T00:00:00'));
    const toTs = Timestamp.fromDate(new Date(to + 'T23:59:59'));

    const q = query(
        collection(db, 'orders'),
        where('createdAt', '>=', fromTs),
        where('createdAt', '<=', toTs),
        orderBy('createdAt', 'asc')
    );

    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() }));
}

/* ── Filter by selected vendor ── */
function filterByVendor(orders) {
    const val = document.getElementById('vendorFilter').value;
    return val === 'all' ? orders : orders.filter(o => o.vendorName === val);
}

/* ── Populate vendor dropdown ── */
function populateVendorFilter(orders) {
    const vendors = [...new Set(orders.map(o => o.vendorName).filter(Boolean))].sort();
    const sel = document.getElementById('vendorFilter');
    const prev = sel.value;

    while (sel.options.length > 1) sel.remove(1);
    vendors.forEach(v => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
    });

    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
}

/* ══════════════════════════════════════════════
   LOAD ALL
══════════════════════════════════════════════ */
window.loadAll = async function () {
    await Promise.all([loadSalesTab(), loadPeakTab()]);
};

/* ══════════════════════════════════════════════
   TAB 1 — SALES
══════════════════════════════════════════════ */
async function loadSalesTab() {
    // Show skeletons
    document.getElementById('salesMetrics').innerHTML = `
    <article class="metric-card skeleton"></article>
    <article class="metric-card skeleton"></article>
    <article class="metric-card skeleton"></article>
    <article class="metric-card skeleton"></article>`;
    document.getElementById('vendorTableWrap').innerHTML = '<p class="loading-text">Loading…</p>';

    let orders;
    try {
        orders = await fetchOrders();
    } catch (err) {
        console.error('Sales error:', err);
        document.getElementById('salesMetrics').innerHTML =
            '<p class="loading-text">⚠ Could not load sales data. Check console.</p>';
        return;
    }

    populateVendorFilter(orders);
    orders = filterByVendor(orders);

    if (!orders.length) {
        document.getElementById('salesMetrics').innerHTML =
            '<p class="loading-text">No orders found for this period.</p>';
        document.getElementById('vendorTableWrap').innerHTML =
            '<p class="loading-text">No data.</p>';
        return;
    }

    /* ── Compute totals ── */
    const grandTotal = orders.reduce((s, o) => s + (o.total || o.subtotal || 0), 0);
    const totalOrders = orders.length;
    const avgOrder = totalOrders ? grandTotal / totalOrders : 0;

    const vendorRevMap = {};
    const vendorOrderMap = {};
    orders.forEach(o => {
        const v = o.vendorName || 'Unknown';
        vendorRevMap[v] = (vendorRevMap[v] || 0) + (o.total || o.subtotal || 0);
        vendorOrderMap[v] = (vendorOrderMap[v] || 0) + 1;
    });

    const sortedVendors = Object.entries(vendorRevMap).sort((a, b) => b[1] - a[1]);
    const topVendor = sortedVendors[0]?.[0] || '—';

    /* ── Metric cards ── */
    const cards = [
        { label: 'Total revenue', value: fmtRand(grandTotal), sub: 'Selected period' },
        { label: 'Total orders', value: fmtNum(totalOrders), sub: 'Selected period' },
        { label: 'Avg order value', value: fmtRand(avgOrder), sub: 'Per transaction' },
        { label: 'Top vendor', value: topVendor, sub: 'By revenue', small: true },
    ];

    document.getElementById('salesMetrics').innerHTML = cards.map(c => `
    <article class="metric-card">
      <span class="metric-label">${c.label}</span>
      <strong class="metric-value" ${c.small ? 'style="font-size:1.1rem"' : ''}>${c.value}</strong>
      <span class="metric-sub">${c.sub}</span>
    </article>`).join('');

    /* ── Line chart: daily revenue ── */
    const from = new Date(document.getElementById('dateFrom').value);
    const to = new Date(document.getElementById('dateTo').value);
    const dayLabels = [];

    for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
        dayLabels.push(d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' }));
    }

    const vendors = sortedVendors.map(([v]) => v);
    const dailyByVendor = {};
    vendors.forEach(v => {
        dailyByVendor[v] = {};
        dayLabels.forEach(l => { dailyByVendor[v][l] = 0; });
    });

    orders.forEach(o => {
        const v = o.vendorName || 'Unknown';
        if (!dailyByVendor[v]) return;
        const d = o.createdAt?.toDate?.() || new Date(o.createdAt);
        const label = d.toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' });
        if (dailyByVendor[v][label] !== undefined) {
            dailyByVendor[v][label] += (o.total || o.subtotal || 0);
        }
    });

    if (salesChartInst) salesChartInst.destroy();
    salesChartInst = new Chart(document.getElementById('salesChart'), {
        type: 'line',
        data: {
            labels: dayLabels,
            datasets: vendors.map((v, i) => ({
                label: v,
                data: dayLabels.map(l => dailyByVendor[v][l] || 0),
                borderColor: COLORS[i % COLORS.length],
                backgroundColor: COLORS[i % COLORS.length] + '22',
                borderWidth: 2,
                pointRadius: 0,
                tension: 0.4,
                fill: false,
            })),
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                x: { grid: { color: '#f0e8f8' }, ticks: { maxTicksLimit: 8 } },
                y: { grid: { color: '#f0e8f8' }, ticks: { callback: v => 'R' + v.toFixed(0) } },
            },
        },
    });

    document.getElementById('salesLegend').innerHTML = vendors.map((v, i) =>
        `<span class="legend-item">
       <span class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></span>
       ${v}
     </span>`).join('');

    /* ── Vendor breakdown table ── */
    document.getElementById('vendorTableWrap').innerHTML = `
    <table class="vendor-table">
      <thead>
        <tr>
          <th>Vendor</th>
          <th>Orders</th>
          <th>Revenue</th>
          <th>Avg order</th>
          <th>Share</th>
        </tr>
      </thead>
      <tbody>
        ${sortedVendors.map(([v, rev], i) => {
        const ord = vendorOrderMap[v] || 1;
        const avg = rev / ord;
        const pct = grandTotal ? ((rev / grandTotal) * 100).toFixed(1) : '0.0';
        return `<tr>
            <td>
              <span style="display:inline-block;width:10px;height:10px;border-radius:50%;
                           background:${COLORS[i % COLORS.length]};margin-right:8px;"></span>
              ${v}
            </td>
            <td>${fmtNum(ord)}</td>
            <td>${fmtRand(rev)}</td>
            <td>${fmtRand(avg)}</td>
            <td>
              <span style="display:inline-flex;align-items:center;gap:6px;">
                <span style="display:inline-block;width:${Math.min(parseFloat(pct), 80)}px;
                             height:6px;border-radius:3px;background:${COLORS[i % COLORS.length]};"></span>
                ${pct}%
              </span>
            </td>
          </tr>`;
    }).join('')}
      </tbody>
    </table>`;

    /* Store for exports */
    currentSalesData = { grandTotal, totalOrders, avgOrder, sortedVendors, vendorOrderMap, orders };
}

/* ══════════════════════════════════════════════
   TAB 2 — PEAK HOURS
══════════════════════════════════════════════ */
async function loadPeakTab() {
    let orders;
    try {
        orders = await fetchOrders();
    } catch (err) {
        console.error('Peak tab error:', err);
        return;
    }
    orders = filterByVendor(orders);

    const hourCounts = new Array(24).fill(0);
    const dayCounts = new Array(7).fill(0);
    const heatData = Array.from({ length: 7 }, () => new Array(24).fill(0));

    orders.forEach(o => {
        const d = o.createdAt?.toDate?.() || new Date(o.createdAt);
        const h = d.getHours();
        const w = (d.getDay() + 6) % 7; // Mon = 0
        hourCounts[h]++;
        dayCounts[w]++;
        heatData[w][h]++;
    });

    /* Hourly bar chart */
    const maxHourly = Math.max(...hourCounts, 1);
    if (hourlyChartInst) hourlyChartInst.destroy();
    hourlyChartInst = new Chart(document.getElementById('hourlyChart'), {
        type: 'bar',
        data: {
            labels: Array.from({ length: 24 }, (_, i) =>
                i === 0 ? '12am' : i < 12 ? i + 'am' : i === 12 ? '12pm' : (i - 12) + 'pm'),
            datasets: [{
                data: hourCounts,
                backgroundColor: hourCounts.map(v => v > maxHourly * 0.6 ? '#e05f8e' : '#f9a8c9'),
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0e8f8' } } },
        },
    });

    /* Weekday bar chart */
    if (weekdayChartInst) weekdayChartInst.destroy();
    weekdayChartInst = new Chart(document.getElementById('weekdayChart'), {
        type: 'bar',
        data: {
            labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
            datasets: [{
                data: dayCounts,
                backgroundColor: '#b8f0d8',
                hoverBackgroundColor: '#2daf74',
                borderRadius: 6,
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { x: { grid: { display: false } }, y: { grid: { color: '#f0e8f8' } } },
        },
    });

    /* Heatmap */
    const maxH = Math.max(...heatData.flat(), 1);
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const hLabels = Array.from({ length: 24 }, (_, i) =>
        i % 3 === 0 ? (i === 0 ? '12a' : i < 12 ? i + 'a' : i === 12 ? '12p' : (i - 12) + 'p') : '');

    let html = '<table class="heatmap" role="grid"><thead><tr><th></th>';
    hLabels.forEach(l => { html += `<th>${l}</th>`; });
    html += '</tr></thead><tbody>';

    days.forEach((day, di) => {
        html += `<tr><th style="text-align:right;padding-right:8px;">${day}</th>`;
        heatData[di].forEach(val => {
            const intensity = val / maxH;
            const r = Math.round(224 + (240 - 224) * (1 - intensity));
            const g = Math.round(95 + (232 - 95) * (1 - intensity));
            const b = Math.round(142 + (216 - 142) * (1 - intensity));
            html += `<td style="background:rgb(${r},${g},${b});" title="${val} orders">${val > 0 ? val : ''}</td>`;
        });
        html += '</tr>';
    });
    html += '</tbody></table>';
    document.getElementById('heatmapWrap').innerHTML = html;
}

/* ══════════════════════════════════════════════
   TAB 3 — CUSTOM VIEW
══════════════════════════════════════════════ */
window.buildCustom = async function () {
    const metric = document.getElementById('customMetric').value;
    const group = document.getElementById('customGroup').value;
    const chartType = document.getElementById('customChartType').value;

    document.getElementById('customTitle').textContent = 'Loading…';
    document.getElementById('customSubtitle').textContent = '';

    let orders;
    try {
        orders = await fetchOrders('customFrom', 'customTo');
    } catch (err) {
        console.error('Custom report error:', err);
        document.getElementById('customTableWrap').innerHTML =
            '<p class="loading-text">⚠ Could not load data. Check console.</p>';
        return;
    }
    orders = filterByVendor(orders);

    /* Group data */
    const groupMap = {};
    orders.forEach(o => {
        const d = o.createdAt?.toDate?.() || new Date(o.createdAt);
        let key;
        if (group === 'vendor') key = o.vendorName || 'Unknown';
        else if (group === 'hour') key = d.getHours() + 'h';
        else key = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][(d.getDay() + 6) % 7];

        if (!groupMap[key]) groupMap[key] = { revenue: 0, orders: 0 };
        groupMap[key].revenue += (o.total || o.subtotal || 0);
        groupMap[key].orders++;
    });

    let labels, data;
    if (group === 'hour') {
        labels = Array.from({ length: 24 }, (_, i) => i + 'h');
    } else if (group === 'day') {
        labels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    } else {
        labels = Object.keys(groupMap);
    }

    data = labels.map(l => {
        const g = groupMap[l] || { revenue: 0, orders: 0 };
        if (metric === 'revenue') return g.revenue;
        if (metric === 'orders') return g.orders;
        return g.orders ? g.revenue / g.orders : 0;
    });

    const metricLabels = { revenue: 'Revenue (R)', orders: 'Order count', avg_order: 'Avg order value (R)' };
    const groupLabels = { vendor: 'Vendor', hour: 'Hour of day', day: 'Day of week' };

    document.getElementById('customTitle').textContent = `${metricLabels[metric]} by ${groupLabels[group]}`;
    document.getElementById('customSubtitle').textContent = `${document.getElementById('customFrom').value} → ${document.getElementById('customTo').value}`;

    if (customChartInst) customChartInst.destroy();
    customChartInst = new Chart(document.getElementById('customChart'), {
        type: chartType,
        data: {
            labels,
            datasets: [{
                label: metricLabels[metric],
                data,
                backgroundColor: chartType === 'line' ? '#e05f8e22' : labels.map((_, i) => COLORS[i % COLORS.length]),
                borderColor: '#e05f8e',
                borderWidth: chartType === 'line' ? 2 : 0,
                borderRadius: chartType === 'bar' ? 6 : 0,
                tension: 0.4,
                fill: chartType === 'line',
            }],
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: chartType === 'doughnut' } },
            scales: chartType === 'doughnut' ? {} : {
                x: { grid: { display: false } },
                y: { grid: { color: '#f0e8f8' } },
            },
        },
    });

    /* Summary table */
    const showTotal = document.getElementById('col-total').checked;
    const showAvg = document.getElementById('col-avg').checked;
    const showPct = document.getElementById('col-pct').checked;
    const total = data.reduce((a, b) => a + b, 0);
    const avg = total / (data.length || 1);
    const isRand = metric !== 'orders';
    const fmtVal = v => isRand ? fmtRand(v) : fmtNum(v);

    let tbl = `<table class="vendor-table"><thead><tr><th>Group</th>
    ${showTotal ? '<th>Value</th>' : ''}
    ${showAvg ? '<th>vs Average</th>' : ''}
    ${showPct ? '<th>% of total</th>' : ''}
  </tr></thead><tbody>`;

    labels.forEach((l, i) => {
        const diff = data[i] - avg;
        const pct = total ? ((data[i] / total) * 100).toFixed(1) : '0';
        tbl += `<tr><td>${l}</td>
      ${showTotal ? `<td>${fmtVal(data[i])}</td>` : ''}
      ${showAvg ? `<td style="color:${diff >= 0 ? '#2daf74' : '#e05f8e'}">${diff >= 0 ? '+' : '-'}${fmtVal(Math.abs(diff))}</td>` : ''}
      ${showPct ? `<td>${pct}%</td>` : ''}
    </tr>`;
    });
    tbl += '</tbody></table>';
    document.getElementById('customTableWrap').innerHTML = tbl;

    currentCustomData = { labels, data, metric: metricLabels[metric] };
};

/* ══════════════════════════════════════════════
   EXPORTS
══════════════════════════════════════════════ */
window.exportCSV = function () {
    if (!currentSalesData?.orders?.length) { alert('No data to export.'); return; }
    const rows = [['Vendor', 'Date', 'Total (R)', 'Status']];
    currentSalesData.orders.forEach(o => {
        const d = o.createdAt?.toDate?.() || new Date(o.createdAt);
        rows.push([o.vendorName || '', d.toLocaleDateString('en-ZA'), (o.total || 0).toFixed(2), o.status || '']);
    });
    downloadCSV(rows, 'analytics-sales.csv');
};

window.exportCustomCSV = function () {
    if (!currentCustomData?.labels?.length) { alert('Generate a report first.'); return; }
    const rows = [['Group', currentCustomData.metric],
    ...currentCustomData.labels.map((l, i) => [l, currentCustomData.data[i]])];
    downloadCSV(rows, 'custom-report.csv');
};

function downloadCSV(rows, filename) {
    const csv = rows.map(r => r.map(c => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);
}

window.exportPDF = function () {
    if (!currentSalesData) { alert('No data to export.'); return; }
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    let y = 20;

    doc.setFontSize(18); doc.setFont('helvetica', 'bold');
    doc.text('Campus Eats — Analytics Report', 14, y); y += 10;

    doc.setFontSize(11); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
    doc.text(`Generated: ${new Date().toLocaleDateString('en-ZA')}`, 14, y); y += 14;

    doc.setTextColor(0); doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('Summary', 14, y); y += 8;

    doc.setFontSize(11); doc.setFont('helvetica', 'normal');
    doc.text(`Total Revenue:   R${currentSalesData.grandTotal.toFixed(2)}`, 14, y); y += 7;
    doc.text(`Total Orders:    ${currentSalesData.totalOrders}`, 14, y); y += 7;
    doc.text(`Avg Order Value: R${currentSalesData.avgOrder.toFixed(2)}`, 14, y); y += 14;

    doc.setFontSize(13); doc.setFont('helvetica', 'bold');
    doc.text('Vendor Breakdown', 14, y); y += 8;

    doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    const colX = [14, 70, 110, 155];
    ['Vendor', 'Orders', 'Revenue (R)', 'Avg Order'].forEach((h, i) => doc.text(h, colX[i], y));
    y += 6;

    doc.setFont('helvetica', 'normal');
    currentSalesData.sortedVendors.forEach(([v, rev]) => {
        if (y > 270) { doc.addPage(); y = 20; }
        const ord = currentSalesData.vendorOrderMap[v] || 1;
        doc.text(v.substring(0, 20), colX[0], y);
        doc.text(String(ord), colX[1], y);
        doc.text(rev.toFixed(2), colX[2], y);
        doc.text((rev / ord).toFixed(2), colX[3], y);
        y += 7;
    });

    doc.save('campus-eats-analytics.pdf');
};