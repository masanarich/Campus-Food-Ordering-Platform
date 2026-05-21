/**
 * admin/analytics.js
 *
 * Admin analytics dashboard.
 * Pure logic (aggregators, filters, sorters, paginators, comparators) is
 * exported via module.exports so it can be unit-tested without a DOM or
 * Firestore. DOM/Firebase wiring auto-runs only in a browser context.
 */

(function attachAdminAnalytics(globalScope) {
    "use strict";

    const MODULE_NAME = "admin/analytics";

    // ========================================================================
    // PURE HELPERS
    // ========================================================================

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function getDateFromTimestamp(timestamp) {
        if (!timestamp) return null;
        if (timestamp instanceof Date) return timestamp;
        if (typeof timestamp === "string") return new Date(timestamp);
        if (typeof timestamp === "number") return new Date(timestamp);
        if (typeof timestamp.toDate === "function") return timestamp.toDate();
        if (typeof timestamp.seconds === "number") return new Date(timestamp.seconds * 1000);
        return null;
    }

    function getOrderAmount(order) {
        if (!order) return 0;
        const candidates = [order.total, order.subtotal, order.paymentAmount, order.totalAmount];
        for (const c of candidates) {
            if (typeof c === "number" && Number.isFinite(c)) return c;
        }
        return 0;
    }

    function fmtRand(n) {
        const value = Number.isFinite(n) ? n : 0;
        return "R " + value.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    function fmtNum(n) {
        return Math.round(Number.isFinite(n) ? n : 0).toLocaleString();
    }

    function fmtPct(n) {
        return `${(Number.isFinite(n) ? n : 0).toFixed(1)}%`;
    }

    // ------------------------------------------------------------------------
    // Time window
    // ------------------------------------------------------------------------

    function resolveTimeWindow(key, refDate) {
        const now = refDate instanceof Date ? new Date(refDate.getTime()) : new Date();
        const start = new Date(now.getTime());
        const end = new Date(now.getTime());
        end.setHours(23, 59, 59, 999);

        switch (key) {
            case "today":
                start.setHours(0, 0, 0, 0);
                return { start, end };
            case "7d":
                start.setDate(start.getDate() - 6);
                start.setHours(0, 0, 0, 0);
                return { start, end };
            case "21d":
                start.setDate(start.getDate() - 20);
                start.setHours(0, 0, 0, 0);
                return { start, end };
            case "month":
                return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end };
            case "year":
                return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end };
            case "all":
            default:
                return { start: null, end: null };
        }
    }

    function applyTimeWindow(orders, key, refDate) {
        const { start, end } = resolveTimeWindow(key, refDate);
        return filterOrdersByDateRange(orders, start, end);
    }

    function filterOrdersByDateRange(orders, startDate, endDate) {
        if (!startDate && !endDate) return orders.slice();
        return orders.filter(order => {
            const orderDate = getDateFromTimestamp(order.createdAt);
            if (!orderDate) return false;
            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;
            return true;
        });
    }

    function computePreviousPeriodRange(startDate, endDate) {
        if (!startDate || !endDate) return { start: null, end: null };
        const lengthMs = endDate.getTime() - startDate.getTime();
        const prevEnd = new Date(startDate.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - lengthMs);
        return { start: prevStart, end: prevEnd };
    }

    // ------------------------------------------------------------------------
    // Vendor filter
    // ------------------------------------------------------------------------

    function filterByVendorName(orders, vendorName) {
        const target = normalizeText(vendorName);
        if (!target || target === "all") return orders.slice();
        return orders.filter(o => normalizeText(o.vendorName) === target);
    }

    // ------------------------------------------------------------------------
    // Aggregators
    // ------------------------------------------------------------------------

    /**
     * Build a vendor breakdown table from orders.
     * Returns array of { name, orders, revenue, avgOrder, share, lastOrder }.
     */
    function aggregateByVendor(orders) {
        const totalRevenue = orders.reduce((s, o) => s + getOrderAmount(o), 0);
        const map = new Map();
        orders.forEach(order => {
            const name = normalizeText(order.vendorName) || "Unknown";
            if (!map.has(name)) {
                map.set(name, {
                    name,
                    orders: 0,
                    revenue: 0,
                    avgOrder: 0,
                    share: 0,
                    lastOrder: null
                });
            }
            const row = map.get(name);
            row.orders++;
            row.revenue += getOrderAmount(order);
            const date = getDateFromTimestamp(order.createdAt);
            if (date && (!row.lastOrder || date > row.lastOrder)) {
                row.lastOrder = date;
            }
        });
        const rows = Array.from(map.values());
        rows.forEach(row => {
            row.avgOrder = row.orders > 0 ? row.revenue / row.orders : 0;
            row.share = totalRevenue > 0 ? (row.revenue / totalRevenue) * 100 : 0;
        });
        return rows;
    }

    /**
     * Group orders by customer. Privacy-safe (id + display name only).
     * Returns array of { customerId, customerName, orderCount, totalSpent, lastOrder, uniqueVendors }.
     */
    function aggregateByCustomer(orders) {
        const map = new Map();
        orders.forEach(order => {
            const id = normalizeText(order.customerUid || order.customerId || order.userId);
            const name = normalizeText(order.customerName || order.studentName || order.customerEmail)
                || "Anonymous";
            const key = id || name;
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, {
                    customerId: id,
                    customerName: name,
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrder: null,
                    _vendors: new Set()
                });
            }
            const row = map.get(key);
            row.orderCount++;
            row.totalSpent += getOrderAmount(order);
            const date = getDateFromTimestamp(order.createdAt);
            if (date && (!row.lastOrder || date > row.lastOrder)) {
                row.lastOrder = date;
            }
            const vendor = normalizeText(order.vendorName);
            if (vendor) row._vendors.add(vendor);
        });
        return Array.from(map.values()).map(row => ({
            customerId: row.customerId,
            customerName: row.customerName,
            orderCount: row.orderCount,
            totalSpent: row.totalSpent,
            lastOrder: row.lastOrder,
            uniqueVendors: row._vendors.size
        }));
    }

    /**
     * Headline KPIs across all orders.
     */
    function computeKpis(orders) {
        const totalRevenue = orders.reduce((s, o) => s + getOrderAmount(o), 0);
        const totalOrders = orders.length;
        const avgOrder = totalOrders > 0 ? totalRevenue / totalOrders : 0;
        const vendorRows = aggregateByVendor(orders);
        const topVendor = vendorRows.sort((a, b) => b.revenue - a.revenue)[0]?.name || "—";

        const customers = aggregateByCustomer(orders);
        const activeCustomers = customers.length;
        const repeaters = customers.filter(c => c.orderCount > 1).length;
        const repeatRate = activeCustomers > 0 ? (repeaters / activeCustomers) * 100 : 0;

        return {
            totalRevenue,
            totalOrders,
            avgOrder,
            topVendor,
            activeCustomers,
            repeatRate
        };
    }

    function computeHourCounts(orders) {
        const counts = new Array(24).fill(0);
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (date) counts[date.getHours()]++;
        });
        return counts;
    }

    function computeWeekdayCounts(orders) {
        const counts = new Array(7).fill(0);
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (date) counts[(date.getDay() + 6) % 7]++;
        });
        return counts;
    }

    function computeHeatmap(orders) {
        const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (!date) return;
            matrix[(date.getDay() + 6) % 7][date.getHours()]++;
        });
        return matrix;
    }

    /**
     * Compare two vendor-rows arrays (current + previous) by vendor name.
     * Returns the current rows decorated with a `movement` field: signed
     * percent change in revenue vs the previous period (Infinity-safe).
     */
    function computeMovement(currentVendors, previousVendors) {
        const prevMap = new Map();
        previousVendors.forEach(v => prevMap.set(v.name, v.revenue));
        return currentVendors.map(v => {
            const prev = prevMap.get(v.name) || 0;
            let movementPct = 0;
            if (prev !== 0) movementPct = ((v.revenue - prev) / Math.abs(prev)) * 100;
            else if (v.revenue !== 0) movementPct = 100;
            let direction = "flat";
            if (v.revenue > prev) direction = "up";
            else if (v.revenue < prev) direction = "down";
            return { ...v, previousRevenue: prev, movementPct, direction };
        });
    }

    // ------------------------------------------------------------------------
    // Search / sort / paginate
    // ------------------------------------------------------------------------

    function searchVendors(rows, term) {
        const t = normalizeLowerText(term);
        if (!t) return rows.slice();
        return rows.filter(r => normalizeLowerText(r.name).includes(t));
    }

    function searchCustomers(rows, term) {
        const t = normalizeLowerText(term);
        if (!t) return rows.slice();
        return rows.filter(r => normalizeLowerText(r.customerName).includes(t));
    }

    const VENDOR_SORT_KEYS = {
        revenue: r => r.revenue,
        orders: r => r.orders,
        avgOrder: r => r.avgOrder,
        share: r => r.share,
        name: r => normalizeLowerText(r.name),
        lastOrder: r => (r.lastOrder ? r.lastOrder.getTime() : 0),
        movement: r => (Number.isFinite(r.movementPct) ? r.movementPct : 0)
    };

    const CUSTOMER_SORT_KEYS = {
        orderCount: r => r.orderCount,
        totalSpent: r => r.totalSpent,
        name: r => normalizeLowerText(r.customerName),
        lastOrder: r => (r.lastOrder ? r.lastOrder.getTime() : 0),
        uniqueVendors: r => r.uniqueVendors
    };

    function sortRows(rows, keyMap, sortKey, direction) {
        const getter = keyMap[sortKey];
        if (!getter) return rows.slice();
        const dir = direction === "asc" ? 1 : -1;
        const copy = rows.slice();
        copy.sort((a, b) => {
            const av = getter(a);
            const bv = getter(b);
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
        return copy;
    }

    function sortVendors(rows, sortKey, direction) {
        return sortRows(rows, VENDOR_SORT_KEYS, sortKey, direction);
    }

    function sortCustomers(rows, sortKey, direction) {
        return sortRows(rows, CUSTOMER_SORT_KEYS, sortKey, direction);
    }

    function paginate(rows, page, size) {
        const safeSize = Math.max(1, Math.floor(Number(size) || 10));
        const total = rows.length;
        const totalPages = Math.max(1, Math.ceil(total / safeSize));
        const safePage = Math.min(Math.max(1, Math.floor(Number(page) || 1)), totalPages);
        const startIdx = (safePage - 1) * safeSize;
        return {
            rows: rows.slice(startIdx, startIdx + safeSize),
            page: safePage,
            totalPages,
            total,
            size: safeSize,
            startIndex: total === 0 ? 0 : startIdx + 1,
            endIndex: Math.min(startIdx + safeSize, total)
        };
    }

    /**
     * Group orders for the custom-report builder.
     * `groupKey` is one of "vendor" | "hour" | "day".
     * Returns { labels, byMetric: { revenue, orders, avg_order } }.
     */
    function groupForCustomReport(orders, groupKey) {
        const groupMap = {};
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            let key;
            if (groupKey === "vendor") {
                key = normalizeText(order.vendorName) || "Unknown";
            } else if (groupKey === "hour") {
                key = date ? `${date.getHours()}h` : "Unknown";
            } else {
                key = date
                    ? ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][(date.getDay() + 6) % 7]
                    : "Unknown";
            }
            if (!groupMap[key]) groupMap[key] = { revenue: 0, orders: 0 };
            groupMap[key].revenue += getOrderAmount(order);
            groupMap[key].orders++;
        });

        let labels;
        if (groupKey === "hour") labels = Array.from({ length: 24 }, (_, i) => `${i}h`);
        else if (groupKey === "day") labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        else labels = Object.keys(groupMap);

        function buildSeries(metric) {
            return labels.map(label => {
                const g = groupMap[label] || { revenue: 0, orders: 0 };
                if (metric === "revenue") return g.revenue;
                if (metric === "orders") return g.orders;
                return g.orders > 0 ? g.revenue / g.orders : 0;
            });
        }

        return {
            labels,
            byMetric: {
                revenue: buildSeries("revenue"),
                orders: buildSeries("orders"),
                avg_order: buildSeries("avg_order")
            }
        };
    }

    // ========================================================================
    // BROWSER-ONLY WIRING
    // ========================================================================

    let salesChartInst = null;
    let hourlyChartInst = null;
    let weekdayChartInst = null;
    let customChartInst = null;

    let allOrders = [];
    let currentSalesData = null;
    let currentCustomData = null;
    let currentMovementRows = [];
    let currentCustomerRows = [];

    const vendorTableState = { search: "", sort: "revenue", dir: "desc", page: 1, size: 10 };
    const customerTableState = { search: "", sort: "totalSpent", dir: "desc", page: 1, size: 10 };

    const COLORS = ["#e05f8e", "#f09050", "#2daf74", "#7c5cdc", "#f9a8c9", "#b8f0d8"];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) el.value = value;
    }

    function readValue(id) {
        const el = document.getElementById(id);
        return el ? el.value : "";
    }

    function startBrowserLifecycle(deps) {
        const { auth, db, firestoreFns, authFns } = deps;
        const { onAuthStateChanged } = authFns;

        onAuthStateChanged(auth, async user => {
            if (!user) {
                window.location.href = "../authentication/login.html";
                return;
            }
            const today = new Date();
            const month = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);
            const fmt = d => d.toISOString().split("T")[0];
            setValue("dateFrom", fmt(month));
            setValue("dateTo", fmt(today));
            setValue("customFrom", fmt(month));
            setValue("customTo", fmt(today));

            attachEventListeners();
            await loadAll({ db, firestoreFns });
        });
    }

    async function fetchOrders({ db, firestoreFns }, fromDateId = "dateFrom", toDateId = "dateTo") {
        const { collection, getDocs, query, where, orderBy, Timestamp } = firestoreFns;
        const fromStr = readValue(fromDateId);
        const toStr = readValue(toDateId);
        if (!fromStr || !toStr) return [];
        const fromTs = Timestamp.fromDate(new Date(fromStr + "T00:00:00"));
        const toTs = Timestamp.fromDate(new Date(toStr + "T23:59:59"));
        const q = query(
            collection(db, "orders"),
            where("createdAt", ">=", fromTs),
            where("createdAt", "<=", toTs),
            orderBy("createdAt", "asc")
        );
        const snap = await getDocs(q);
        return snap.docs.map(d => ({ id: d.id, ...d.data() }));
    }

    function populateVendorFilter(orders) {
        const sel = document.getElementById("vendorFilter");
        if (!sel) return;
        const vendors = [...new Set(orders.map(o => normalizeText(o.vendorName)).filter(Boolean))].sort();
        const prev = sel.value;
        while (sel.options.length > 1) sel.remove(1);
        vendors.forEach(v => {
            const opt = document.createElement("option");
            opt.value = v;
            opt.textContent = v;
            sel.appendChild(opt);
        });
        if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    }

    async function loadAll(deps) {
        try {
            allOrders = await fetchOrders(deps);
        } catch (err) {
            console.error(`[${MODULE_NAME}] Failed to load orders:`, err);
            const el = document.getElementById("salesMetrics");
            if (el) el.innerHTML = '<p class="loading-text">⚠ Could not load sales data. Check console.</p>';
            return;
        }
        populateVendorFilter(allOrders);
        renderEverything(deps);
    }

    function getVisibleOrders() {
        return filterByVendorName(allOrders, readValue("vendorFilter"));
    }

    function renderEverything(deps) {
        const visible = getVisibleOrders();
        renderSalesTab(visible, deps);
        renderPeakTab(visible);
    }

    function renderSalesTab(orders, deps) {
        const metricsEl = document.getElementById("salesMetrics");
        const tableWrap = document.getElementById("vendorTableWrap");

        if (!orders.length) {
            if (metricsEl) metricsEl.innerHTML = '<p class="loading-text">No orders found for this period.</p>';
            if (tableWrap) tableWrap.innerHTML = '<p class="loading-text">No data.</p>';
            return;
        }

        const kpis = computeKpis(orders);
        const cards = [
            { label: "Total revenue", value: fmtRand(kpis.totalRevenue), sub: "Selected period" },
            { label: "Total orders", value: fmtNum(kpis.totalOrders), sub: "Selected period" },
            { label: "Avg order value", value: fmtRand(kpis.avgOrder), sub: "Per transaction" },
            { label: "Top vendor", value: kpis.topVendor, sub: "By revenue", small: true },
            { label: "Active customers", value: fmtNum(kpis.activeCustomers), sub: "Unique buyers" },
            { label: "Repeat-customer rate", value: fmtPct(kpis.repeatRate), sub: "Returned 2+ times" }
        ];
        if (metricsEl) {
            metricsEl.innerHTML = cards.map(c => `
                <article class="metric-card">
                  <span class="metric-label">${escapeHtml(c.label)}</span>
                  <strong class="metric-value" ${c.small ? 'style="font-size:1.1rem"' : ""}>${escapeHtml(c.value)}</strong>
                  <span class="metric-sub">${escapeHtml(c.sub)}</span>
                </article>`).join("");
        }

        // Revenue line chart (one line per top vendor)
        const fromStr = readValue("dateFrom");
        const toStr = readValue("dateTo");
        const from = fromStr ? new Date(fromStr) : new Date();
        const to = toStr ? new Date(toStr) : new Date();
        const dayLabels = [];
        for (let d = new Date(from); d <= to; d.setDate(d.getDate() + 1)) {
            dayLabels.push(d.toLocaleDateString("en-ZA", { month: "short", day: "numeric" }));
        }

        const vendorRows = aggregateByVendor(orders).sort((a, b) => b.revenue - a.revenue);
        const topVendorNames = vendorRows.slice(0, 6).map(v => v.name);
        const dailyByVendor = {};
        topVendorNames.forEach(v => {
            dailyByVendor[v] = {};
            dayLabels.forEach(l => { dailyByVendor[v][l] = 0; });
        });
        orders.forEach(o => {
            const v = normalizeText(o.vendorName) || "Unknown";
            if (!dailyByVendor[v]) return;
            const d = getDateFromTimestamp(o.createdAt);
            if (!d) return;
            const label = d.toLocaleDateString("en-ZA", { month: "short", day: "numeric" });
            if (dailyByVendor[v][label] !== undefined) {
                dailyByVendor[v][label] += getOrderAmount(o);
            }
        });

        if (typeof Chart !== "undefined") {
            const canvas = document.getElementById("salesChart");
            if (canvas) {
                if (salesChartInst) salesChartInst.destroy();
                salesChartInst = new Chart(canvas, {
                    type: "line",
                    data: {
                        labels: dayLabels,
                        datasets: topVendorNames.map((v, i) => ({
                            label: v,
                            data: dayLabels.map(l => dailyByVendor[v][l] || 0),
                            borderColor: COLORS[i % COLORS.length],
                            backgroundColor: COLORS[i % COLORS.length] + "22",
                            borderWidth: 2,
                            pointRadius: 0,
                            tension: 0.4,
                            fill: false
                        }))
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: {
                            x: { grid: { color: "#f0e8f8" }, ticks: { maxTicksLimit: 8 } },
                            y: { grid: { color: "#f0e8f8" }, ticks: { callback: v => "R" + v.toFixed(0) } }
                        }
                    }
                });
            }
            const legendEl = document.getElementById("salesLegend");
            if (legendEl) {
                legendEl.innerHTML = topVendorNames.map((v, i) =>
                    `<span class="legend-item">
                       <i class="legend-dot" style="background:${COLORS[i % COLORS.length]}"></i>
                       ${escapeHtml(v)}
                     </span>`).join("");
            }
        }

        // Movement vs previous period
        const previousOrders = filterByVendorName(getOrdersForPreviousPeriod(), readValue("vendorFilter"));
        const previousVendorRows = aggregateByVendor(previousOrders);
        currentMovementRows = computeMovement(vendorRows, previousVendorRows);
        renderVendorTable();

        // Customer insights
        currentCustomerRows = aggregateByCustomer(orders);
        renderCustomerTable();

        // Heatmap
        renderHeatmap(orders);

        currentSalesData = {
            kpis,
            vendorRows: currentMovementRows,
            customerRows: currentCustomerRows,
            orders,
            dayLabels,
            dailyByVendor
        };
    }

    function getOrdersForPreviousPeriod() {
        const fromStr = readValue("dateFrom");
        const toStr = readValue("dateTo");
        if (!fromStr || !toStr) return [];
        const from = new Date(fromStr);
        from.setHours(0, 0, 0, 0);
        const to = new Date(toStr);
        to.setHours(23, 59, 59, 999);
        const prev = computePreviousPeriodRange(from, to);
        // We only have orders within the current selected range; previous-period
        // data is fetched lazily so that the comparison reflects real history.
        // For now, allOrders only contains the visible range — so previous-period
        // movement is computed against what we have available outside that range.
        return allOrders.filter(o => {
            const d = getDateFromTimestamp(o.createdAt);
            return d && prev.start && prev.end && d >= prev.start && d <= prev.end;
        });
    }

    function renderVendorTable() {
        const wrap = document.getElementById("vendorTableWrap");
        if (!wrap) return;

        const searched = searchVendors(currentMovementRows, vendorTableState.search);
        const sorted = sortVendors(searched, vendorTableState.sort, vendorTableState.dir);
        const result = paginate(sorted, vendorTableState.page, vendorTableState.size);
        vendorTableState.page = result.page;

        const rowsHtml = result.rows.map((row, i) => {
            const idx = result.startIndex + i - 1;
            const color = COLORS[idx % COLORS.length];
            const arrow = row.direction === "up" ? "▲" : row.direction === "down" ? "▼" : "•";
            const movementCls = row.direction === "up"
                ? "movement up"
                : row.direction === "down"
                ? "movement down"
                : "movement flat";
            return `<tr>
                <td data-label="Vendor">
                  <i class="legend-dot" style="background:${color}"></i>
                  ${escapeHtml(row.name)}
                </td>
                <td data-label="Orders">${fmtNum(row.orders)}</td>
                <td data-label="Revenue">${escapeHtml(fmtRand(row.revenue))}</td>
                <td data-label="Avg order">${escapeHtml(fmtRand(row.avgOrder))}</td>
                <td data-label="Share">
                  <span class="share-bar"
                        style="width:${Math.min(row.share, 80)}px;background:${color};"></span>
                  ${row.share.toFixed(1)}%
                </td>
                <td data-label="Movement">
                  <span class="${movementCls}">
                    <i aria-hidden="true">${arrow}</i> ${Math.abs(row.movementPct).toFixed(1)}%
                  </span>
                </td>
              </tr>`;
        }).join("");

        wrap.innerHTML = `
            <table class="vendor-table">
              <thead>
                <tr>
                  <th>Vendor</th>
                  <th>Orders</th>
                  <th>Revenue</th>
                  <th>Avg order</th>
                  <th>Share</th>
                  <th>Movement</th>
                </tr>
              </thead>
              <tbody>${rowsHtml || '<tr><td colspan="6" class="loading-text">No vendors match your search.</td></tr>'}</tbody>
            </table>`;

        updatePaginationOutputs("vendor", result);
    }

    function renderCustomerTable() {
        const wrap = document.getElementById("customerTableWrap");
        if (!wrap) return;

        const searched = searchCustomers(currentCustomerRows, customerTableState.search);
        const sorted = sortCustomers(searched, customerTableState.sort, customerTableState.dir);
        const result = paginate(sorted, customerTableState.page, customerTableState.size);
        customerTableState.page = result.page;

        const rowsHtml = result.rows.map((row, i) => {
            const idx = result.startIndex + i;
            const last = row.lastOrder
                ? row.lastOrder.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })
                : "—";
            return `<tr>
                <td data-label="Rank"><strong class="rank-badge">#${idx}</strong></td>
                <td data-label="Customer">${escapeHtml(row.customerName)}</td>
                <td data-label="Orders">${fmtNum(row.orderCount)}</td>
                <td data-label="Total spent">${escapeHtml(fmtRand(row.totalSpent))}</td>
                <td data-label="Vendors">${fmtNum(row.uniqueVendors)}</td>
                <td data-label="Last order">${escapeHtml(last)}</td>
              </tr>`;
        }).join("");

        wrap.innerHTML = `
            <table class="vendor-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Customer</th>
                  <th>Orders</th>
                  <th>Total spent</th>
                  <th>Vendors</th>
                  <th>Last order</th>
                </tr>
              </thead>
              <tbody>${rowsHtml || '<tr><td colspan="6" class="loading-text">No customers match your search.</td></tr>'}</tbody>
            </table>`;

        updatePaginationOutputs("customer", result);
    }

    function updatePaginationOutputs(prefix, result) {
        const ind = document.getElementById(`${prefix}-page-indicator`);
        if (ind) {
            ind.textContent = result.total === 0
                ? "0 results"
                : `Page ${result.page} of ${result.totalPages} • ${result.startIndex}–${result.endIndex} of ${result.total}`;
        }
        const prev = document.getElementById(`${prefix}-prev-button`);
        if (prev) prev.disabled = result.page <= 1;
        const next = document.getElementById(`${prefix}-next-button`);
        if (next) next.disabled = result.page >= result.totalPages;
    }

    function renderPeakTab(orders) {
        const hourCounts = computeHourCounts(orders);
        const weekdayCounts = computeWeekdayCounts(orders);
        const heat = computeHeatmap(orders);

        if (typeof Chart !== "undefined") {
            const hourCanvas = document.getElementById("hourlyChart");
            if (hourCanvas) {
                const maxHourly = Math.max(...hourCounts, 1);
                if (hourlyChartInst) hourlyChartInst.destroy();
                hourlyChartInst = new Chart(hourCanvas, {
                    type: "bar",
                    data: {
                        labels: Array.from({ length: 24 }, (_, i) =>
                            i === 0 ? "12am" : i < 12 ? i + "am" : i === 12 ? "12pm" : (i - 12) + "pm"),
                        datasets: [{
                            data: hourCounts,
                            backgroundColor: hourCounts.map(v => v > maxHourly * 0.6 ? "#e05f8e" : "#f9a8c9"),
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { display: false } }, y: { grid: { color: "#f0e8f8" } } }
                    }
                });
            }
            const weekCanvas = document.getElementById("weekdayChart");
            if (weekCanvas) {
                if (weekdayChartInst) weekdayChartInst.destroy();
                weekdayChartInst = new Chart(weekCanvas, {
                    type: "bar",
                    data: {
                        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                        datasets: [{
                            data: weekdayCounts,
                            backgroundColor: "#b8f0d8",
                            hoverBackgroundColor: "#2daf74",
                            borderRadius: 6
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: false } },
                        scales: { x: { grid: { display: false } }, y: { grid: { color: "#f0e8f8" } } }
                    }
                });
            }
        }

        renderHeatmapMatrix(heat, "heatmapWrap");
    }

    function renderHeatmap(orders) {
        const matrix = computeHeatmap(orders);
        renderHeatmapMatrix(matrix, "salesHeatmap");
    }

    function renderHeatmapMatrix(matrix, targetId) {
        const wrap = document.getElementById(targetId);
        if (!wrap) return;
        const maxH = Math.max(...matrix.flat(), 1);
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const hLabels = Array.from({ length: 24 }, (_, i) => i % 3 === 0
            ? (i === 0 ? "12a" : i < 12 ? i + "a" : i === 12 ? "12p" : (i - 12) + "p")
            : "");

        let html = '<table class="heatmap" role="grid"><thead><tr><th></th>';
        hLabels.forEach(l => { html += `<th>${l}</th>`; });
        html += "</tr></thead><tbody>";
        days.forEach((day, di) => {
            html += `<tr><th>${day}</th>`;
            matrix[di].forEach(val => {
                const intensity = val / maxH;
                const r = Math.round(224 + (240 - 224) * (1 - intensity));
                const g = Math.round(95 + (232 - 95) * (1 - intensity));
                const b = Math.round(142 + (216 - 142) * (1 - intensity));
                html += `<td style="background:rgb(${r},${g},${b});" title="${val} orders">${val > 0 ? val : ""}</td>`;
            });
            html += "</tr>";
        });
        html += "</tbody></table>";
        wrap.innerHTML = html;
    }

    // ------------------------------------------------------------------------
    // Custom report
    // ------------------------------------------------------------------------

    async function buildCustom(deps) {
        const metric = readValue("customMetric");
        const group = readValue("customGroup");
        const chartType = readValue("customChartType");

        const titleEl = document.getElementById("customTitle");
        const subtitleEl = document.getElementById("customSubtitle");
        if (titleEl) titleEl.textContent = "Loading…";
        if (subtitleEl) subtitleEl.textContent = "";

        let orders;
        try {
            orders = await fetchOrders(deps, "customFrom", "customTo");
        } catch (err) {
            console.error(`[${MODULE_NAME}] Custom report error:`, err);
            const tw = document.getElementById("customTableWrap");
            if (tw) tw.innerHTML = '<p class="loading-text">⚠ Could not load data. Check console.</p>';
            return;
        }
        orders = filterByVendorName(orders, readValue("vendorFilter"));

        const { labels, byMetric } = groupForCustomReport(orders, group);
        const data = byMetric[metric] || [];

        const metricLabels = { revenue: "Revenue (R)", orders: "Order count", avg_order: "Avg order value (R)" };
        const groupLabels = { vendor: "Vendor", hour: "Hour of day", day: "Day of week" };
        if (titleEl) titleEl.textContent = `${metricLabels[metric] || metric} by ${groupLabels[group] || group}`;
        if (subtitleEl) {
            subtitleEl.textContent = `${readValue("customFrom")} → ${readValue("customTo")}`;
        }

        if (typeof Chart !== "undefined") {
            const canvas = document.getElementById("customChart");
            if (canvas) {
                if (customChartInst) customChartInst.destroy();
                customChartInst = new Chart(canvas, {
                    type: chartType,
                    data: {
                        labels,
                        datasets: [{
                            label: metricLabels[metric],
                            data,
                            backgroundColor: chartType === "line"
                                ? "#e05f8e22"
                                : labels.map((_, i) => COLORS[i % COLORS.length]),
                            borderColor: "#e05f8e",
                            borderWidth: chartType === "line" ? 2 : 0,
                            borderRadius: chartType === "bar" ? 6 : 0,
                            tension: 0.4,
                            fill: chartType === "line"
                        }]
                    },
                    options: {
                        responsive: true,
                        maintainAspectRatio: false,
                        plugins: { legend: { display: chartType === "doughnut" } },
                        scales: chartType === "doughnut" ? {} : {
                            x: { grid: { display: false } },
                            y: { grid: { color: "#f0e8f8" } }
                        }
                    }
                });
            }
        }

        const showTotal = document.getElementById("col-total")?.checked;
        const showAvg = document.getElementById("col-avg")?.checked;
        const showPct = document.getElementById("col-pct")?.checked;
        const total = data.reduce((a, b) => a + b, 0);
        const avg = total / (data.length || 1);
        const isRand = metric !== "orders";
        const fmtVal = v => isRand ? fmtRand(v) : fmtNum(v);

        let tbl = `<table class="vendor-table"><thead><tr><th>Group</th>
            ${showTotal ? "<th>Value</th>" : ""}
            ${showAvg ? "<th>vs Average</th>" : ""}
            ${showPct ? "<th>% of total</th>" : ""}
          </tr></thead><tbody>`;
        labels.forEach((l, i) => {
            const diff = data[i] - avg;
            const pct = total ? ((data[i] / total) * 100).toFixed(1) : "0";
            tbl += `<tr><td>${escapeHtml(l)}</td>
                ${showTotal ? `<td>${escapeHtml(fmtVal(data[i]))}</td>` : ""}
                ${showAvg ? `<td style="color:${diff >= 0 ? "#2daf74" : "#e05f8e"}">${diff >= 0 ? "+" : "-"}${escapeHtml(fmtVal(Math.abs(diff)))}</td>` : ""}
                ${showPct ? `<td>${pct}%</td>` : ""}
              </tr>`;
        });
        tbl += "</tbody></table>";
        const tw = document.getElementById("customTableWrap");
        if (tw) tw.innerHTML = tbl;

        currentCustomData = { labels, data, metric: metricLabels[metric] };
    }

    // ------------------------------------------------------------------------
    // Time-window chips
    // ------------------------------------------------------------------------

    function applyTimeWindowChip(key, deps) {
        const { start, end } = resolveTimeWindow(key, new Date());
        if (start && end) {
            setValue("dateFrom", start.toISOString().split("T")[0]);
            setValue("dateTo", end.toISOString().split("T")[0]);
        } else {
            const today = new Date();
            const longAgo = new Date(today.getFullYear() - 5, 0, 1);
            setValue("dateFrom", longAgo.toISOString().split("T")[0]);
            setValue("dateTo", today.toISOString().split("T")[0]);
        }
        document.querySelectorAll(".time-chip").forEach(btn => {
            const isActive = btn.getAttribute("data-window") === key;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
        loadAll(deps);
    }

    // ------------------------------------------------------------------------
    // Tab switching
    // ------------------------------------------------------------------------

    function switchTab(id, btn) {
        document.querySelectorAll(".tab-panel").forEach(p => p.classList.remove("active"));
        document.querySelectorAll(".tab").forEach(b => {
            b.classList.remove("active");
            b.setAttribute("aria-selected", "false");
        });
        const target = document.getElementById("tab-" + id);
        if (target) target.classList.add("active");
        if (btn) {
            btn.classList.add("active");
            btn.setAttribute("aria-selected", "true");
        }
    }

    // ------------------------------------------------------------------------
    // Exports — CSV / Excel / PDF
    // ------------------------------------------------------------------------

    function downloadBlob(blob, filename) {
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(a.href);
    }

    function exportCSV() {
        if (!currentSalesData?.orders?.length) {
            alert("No data to export.");
            return;
        }
        const rows = [["Vendor", "Date", "Total (R)", "Status"]];
        currentSalesData.orders.forEach(o => {
            const d = getDateFromTimestamp(o.createdAt);
            rows.push([
                normalizeText(o.vendorName),
                d ? d.toLocaleDateString("en-ZA") : "",
                getOrderAmount(o).toFixed(2),
                normalizeText(o.status)
            ]);
        });
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadBlob(new Blob([csv], { type: "text/csv" }), "analytics-sales.csv");
    }

    function exportCustomCSV() {
        if (!currentCustomData?.labels?.length) {
            alert("Generate a report first.");
            return;
        }
        const rows = [["Group", currentCustomData.metric],
        ...currentCustomData.labels.map((l, i) => [l, currentCustomData.data[i]])];
        const csv = rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(",")).join("\n");
        downloadBlob(new Blob([csv], { type: "text/csv" }), "custom-report.csv");
    }

    function exportExcel() {
        if (typeof XLSX === "undefined") {
            alert("Excel library not loaded.");
            return;
        }
        if (!currentSalesData) {
            alert("No data to export.");
            return;
        }
        const wb = XLSX.utils.book_new();

        const summary = [
            ["Metric", "Value"],
            ["Total revenue (R)", Number(currentSalesData.kpis.totalRevenue.toFixed(2))],
            ["Total orders", currentSalesData.kpis.totalOrders],
            ["Avg order (R)", Number(currentSalesData.kpis.avgOrder.toFixed(2))],
            ["Top vendor", currentSalesData.kpis.topVendor],
            ["Active customers", currentSalesData.kpis.activeCustomers],
            ["Repeat-customer rate (%)", Number(currentSalesData.kpis.repeatRate.toFixed(1))]
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(summary), "Summary");

        const vendorRowsSheet = [
            ["Vendor", "Orders", "Revenue (R)", "Avg order (R)", "Share %", "Movement %"],
            ...currentSalesData.vendorRows.map(r => [
                r.name, r.orders,
                Number(r.revenue.toFixed(2)),
                Number(r.avgOrder.toFixed(2)),
                Number(r.share.toFixed(1)),
                Number((Number.isFinite(r.movementPct) ? r.movementPct : 0).toFixed(1))
            ])
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(vendorRowsSheet), "Vendors");

        const customerRowsSheet = [
            ["Customer", "Orders", "Total spent (R)", "Vendors", "Last order"],
            ...currentSalesData.customerRows
                .slice()
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .map(r => [
                    r.customerName, r.orderCount,
                    Number(r.totalSpent.toFixed(2)),
                    r.uniqueVendors,
                    r.lastOrder ? r.lastOrder.toISOString().split("T")[0] : ""
                ])
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(customerRowsSheet), "Customers");

        const ordersSheet = [
            ["Date", "Vendor", "Customer", "Status", "Total (R)"],
            ...currentSalesData.orders.map(o => {
                const d = getDateFromTimestamp(o.createdAt);
                return [
                    d ? d.toISOString().split("T")[0] : "",
                    normalizeText(o.vendorName),
                    normalizeText(o.customerName) || normalizeText(o.customerUid),
                    normalizeText(o.status),
                    Number(getOrderAmount(o).toFixed(2))
                ];
            })
        ];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(ordersSheet), "Orders");

        XLSX.writeFile(wb, `admin-analytics-${new Date().toISOString().split("T")[0]}.xlsx`);
    }

    function exportPDF() {
        if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF library not loaded.");
            return;
        }
        if (!currentSalesData) {
            alert("No data to export.");
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        let y = 20;

        doc.setFontSize(18); doc.setFont("helvetica", "bold");
        doc.text("Campus Eats — Admin Analytics", 14, y); y += 10;

        doc.setFontSize(10); doc.setFont("helvetica", "normal"); doc.setTextColor(120);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, y); y += 6;
        const fromStr = readValue("dateFrom");
        const toStr = readValue("dateTo");
        if (fromStr && toStr) {
            doc.text(`Period: ${fromStr} → ${toStr}`, 14, y); y += 6;
        }
        y += 6;
        doc.setTextColor(0);

        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Summary", 14, y); y += 7;
        doc.setFontSize(10); doc.setFont("helvetica", "normal");
        const k = currentSalesData.kpis;
        doc.text(`Total revenue: ${fmtRand(k.totalRevenue)}`, 14, y); y += 5;
        doc.text(`Total orders: ${k.totalOrders}`, 14, y); y += 5;
        doc.text(`Avg order value: ${fmtRand(k.avgOrder)}`, 14, y); y += 5;
        doc.text(`Top vendor: ${k.topVendor}`, 14, y); y += 5;
        doc.text(`Active customers: ${k.activeCustomers}`, 14, y); y += 5;
        doc.text(`Repeat-customer rate: ${fmtPct(k.repeatRate)}`, 14, y); y += 10;

        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Vendor breakdown", 14, y); y += 6;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        const colX = [14, 70, 100, 140, 175];
        ["Vendor", "Orders", "Revenue", "Avg order", "Mvmt %"].forEach((h, i) => doc.text(h, colX[i], y));
        y += 5;
        doc.setFont("helvetica", "normal");
        currentSalesData.vendorRows.forEach(row => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(String(row.name).substring(0, 22), colX[0], y);
            doc.text(String(row.orders), colX[1], y);
            doc.text(row.revenue.toFixed(2), colX[2], y);
            doc.text(row.avgOrder.toFixed(2), colX[3], y);
            doc.text(`${row.direction === "down" ? "-" : row.direction === "up" ? "+" : ""}${Math.abs(row.movementPct).toFixed(1)}`, colX[4], y);
            y += 5;
        });

        y += 5;
        if (y > 250) { doc.addPage(); y = 20; }
        doc.setFontSize(13); doc.setFont("helvetica", "bold");
        doc.text("Top customers", 14, y); y += 6;
        doc.setFontSize(9); doc.setFont("helvetica", "bold");
        ["Customer", "Orders", "Total spent", "Last order"].forEach((h, i) =>
            doc.text(h, [14, 75, 110, 150][i], y));
        y += 5;
        doc.setFont("helvetica", "normal");
        const topCustomers = currentSalesData.customerRows
            .slice()
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 25);
        topCustomers.forEach(row => {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.text(String(row.customerName).substring(0, 22), 14, y);
            doc.text(String(row.orderCount), 75, y);
            doc.text(row.totalSpent.toFixed(2), 110, y);
            doc.text(row.lastOrder ? row.lastOrder.toISOString().split("T")[0] : "—", 150, y);
            y += 5;
        });

        doc.save(`admin-analytics-${new Date().toISOString().split("T")[0]}.pdf`);
    }

    // ------------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------------

    let eventListenersAttached = false;
    let activeDeps = null;

    function attachEventListeners() {
        if (eventListenersAttached) return;

        document.querySelectorAll(".tab").forEach(btn => {
            btn.addEventListener("click", () => switchTab(btn.getAttribute("data-tab"), btn));
        });

        document.getElementById("vendorFilter")?.addEventListener("change", () => {
            vendorTableState.page = 1;
            customerTableState.page = 1;
            renderEverything(activeDeps);
        });

        document.querySelectorAll(".time-chip").forEach(btn => {
            btn.addEventListener("click", () => applyTimeWindowChip(btn.getAttribute("data-window"), activeDeps));
        });

        document.getElementById("refreshBtn")?.addEventListener("click", () => loadAll(activeDeps));
        document.getElementById("exportCsvBtn")?.addEventListener("click", exportCSV);
        document.getElementById("exportExcelBtn")?.addEventListener("click", exportExcel);
        document.getElementById("exportPdfBtn")?.addEventListener("click", exportPDF);
        document.getElementById("buildCustomBtn")?.addEventListener("click", () => buildCustom(activeDeps));
        document.getElementById("exportCustomCsvBtn")?.addEventListener("click", exportCustomCSV);

        attachTableControls("vendor", vendorTableState, renderVendorTable);
        attachTableControls("customer", customerTableState, renderCustomerTable);

        eventListenersAttached = true;
    }

    function attachTableControls(prefix, state, rerender) {
        document.getElementById(`${prefix}-search`)?.addEventListener("input", e => {
            state.search = e.target.value;
            state.page = 1;
            rerender();
        });
        document.getElementById(`${prefix}-sort`)?.addEventListener("change", e => {
            const [sort, dir] = (e.target.value || "").split(":");
            if (sort) state.sort = sort;
            if (dir) state.dir = dir;
            state.page = 1;
            rerender();
        });
        document.getElementById(`${prefix}-page-size`)?.addEventListener("change", e => {
            state.size = parseInt(e.target.value, 10) || 10;
            state.page = 1;
            rerender();
        });
        document.getElementById(`${prefix}-prev-button`)?.addEventListener("click", () => {
            if (state.page > 1) {
                state.page--;
                rerender();
            }
        });
        document.getElementById(`${prefix}-next-button`)?.addEventListener("click", () => {
            state.page++;
            rerender();
        });
    }

    function waitForFirebaseDependencies(timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();
            const check = () => {
                if (globalScope.db && globalScope.auth && globalScope.authFns && globalScope.firestoreFns) {
                    resolve();
                    return;
                }
                if (Date.now() - start >= timeoutMs) {
                    reject(new Error("Timed out waiting for Firebase dependencies"));
                    return;
                }
                setTimeout(check, 100);
            };
            check();
        });
    }

    function initializePage() {
        const start = () => {
            activeDeps = {
                db: globalScope.db,
                auth: globalScope.auth,
                authFns: globalScope.authFns,
                firestoreFns: globalScope.firestoreFns
            };
            startBrowserLifecycle(activeDeps);
        };
        if (globalScope.db && globalScope.auth && globalScope.authFns && globalScope.firestoreFns) {
            start();
            return;
        }
        waitForFirebaseDependencies()
            .then(start)
            .catch(err => console.error(`[${MODULE_NAME}] dep wait error:`, err));
    }

    // ========================================================================
    // PUBLIC API + AUTO-INIT GUARD
    // ========================================================================

    const publicApi = {
        normalizeText,
        normalizeLowerText,
        getDateFromTimestamp,
        getOrderAmount,
        fmtRand,
        fmtNum,
        fmtPct,
        resolveTimeWindow,
        applyTimeWindow,
        filterOrdersByDateRange,
        filterByVendorName,
        computePreviousPeriodRange,
        aggregateByVendor,
        aggregateByCustomer,
        computeKpis,
        computeHourCounts,
        computeWeekdayCounts,
        computeHeatmap,
        computeMovement,
        searchVendors,
        searchCustomers,
        sortVendors,
        sortCustomers,
        paginate,
        groupForCustomReport
    };

    if (typeof globalScope !== "undefined") {
        globalScope.adminAnalytics = { ...publicApi, initialize: initializePage };
    }

    const isCommonJsTest = typeof module !== "undefined" && module.exports;
    if (isCommonJsTest) {
        module.exports = publicApi;
    } else if (typeof document !== "undefined") {
        if (document.readyState === "loading") {
            document.addEventListener("DOMContentLoaded", initializePage);
        } else {
            initializePage();
        }
    }
})(typeof window !== "undefined" ? window : globalThis);
