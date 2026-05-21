/**
 * vendor/analytics.js
 *
 * Vendor analytics dashboard.
 * Pure logic functions (aggregators, filters, sorters, paginators, comparators)
 * are exported so they can be unit-tested without a DOM or Firestore.
 * DOM wiring auto-runs only in a browser; it is skipped under CommonJS test runs.
 */

(function attachVendorAnalyticsDashboard(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/analytics";

    // ========================================================================
    // PURE HELPERS (no DOM, no Firebase)
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

    function getHourFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        return date ? date.getHours() : null;
    }

    function getDayFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        return date ? date.toISOString().split("T")[0] : null;
    }

    function getWeekFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        if (!date) return null;
        // ISO 8601 week number: shift to the Thursday of this week, then count
        // weeks from Jan 1 of that Thursday's year.
        const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function formatCurrency(amount) {
        const value = Number.isFinite(amount) ? amount : 0;
        return new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR",
            currencyDisplay: "code"
        }).format(value);
    }

    function getOrderAmount(order) {
        if (!order) return 0;
        const candidates = [order.paymentAmount, order.totalAmount, order.total, order.subtotal];
        for (const c of candidates) {
            if (typeof c === "number" && Number.isFinite(c)) return c;
        }
        return 0;
    }

    // ------------------------------------------------------------------------
    // Time-window resolution
    // ------------------------------------------------------------------------

    /**
     * Resolve a named time window into a {start, end} date pair.
     * `refDate` allows tests to pass a deterministic "now".
     * Returns nulls for "all" or for unknown keys.
     */
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
            case "month": {
                const s = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
                return { start: s, end };
            }
            case "year": {
                const s = new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0);
                return { start: s, end };
            }
            case "all":
            default:
                return { start: null, end: null };
        }
    }

    /**
     * Apply a named time window to an array of orders.
     */
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

    /**
     * Given a {start, end} period, compute the equivalent immediately-previous
     * period of identical length. Used for period-over-period comparisons.
     */
    function computePreviousPeriodRange(startDate, endDate) {
        if (!startDate || !endDate) return { start: null, end: null };
        const lengthMs = endDate.getTime() - startDate.getTime();
        const prevEnd = new Date(startDate.getTime() - 1);
        const prevStart = new Date(prevEnd.getTime() - lengthMs);
        return { start: prevStart, end: prevEnd };
    }

    // ------------------------------------------------------------------------
    // Aggregators
    // ------------------------------------------------------------------------

    function calculateAnalytics(orders) {
        const analytics = {
            totalRevenue: 0,
            totalOrders: 0,
            completedOrders: 0,
            totalItems: 0,
            peakHours: {},
            topItems: {},
            itemsByCategory: {},
            ordersByStatus: {},
            ordersByDay: {},
            ordersByWeek: {},
            itemDetails: {}
        };

        orders.forEach(order => {
            const amount = getOrderAmount(order);
            analytics.totalRevenue += amount;
            analytics.totalOrders++;

            if (order.status === "completed") {
                analytics.completedOrders++;
            }

            const status = order.status || "unknown";
            analytics.ordersByStatus[status] = (analytics.ordersByStatus[status] || 0) + 1;

            const hour = getHourFromTimestamp(order.createdAt);
            if (hour !== null) {
                analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1;
            }

            const day = getDayFromTimestamp(order.createdAt);
            if (day) {
                analytics.ordersByDay[day] = (analytics.ordersByDay[day] || 0) + amount;
            }

            const week = getWeekFromTimestamp(order.createdAt);
            if (week) {
                analytics.ordersByWeek[week] = (analytics.ordersByWeek[week] || 0) + amount;
            }

            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemKey = normalizeText(item.menuItemId || item.name) || "unknown";
                    const quantity = Number(item.quantity) || 0;
                    const price = Number(item.price) || 0;
                    const revenue = quantity * price;

                    analytics.totalItems += quantity;

                    if (!analytics.topItems[itemKey]) {
                        analytics.topItems[itemKey] = {
                            name: normalizeText(item.name),
                            category: normalizeText(item.category),
                            quantity: 0,
                            revenue: 0,
                            count: 0,
                            avgPrice: 0
                        };
                        analytics.itemDetails[itemKey] = {
                            name: normalizeText(item.name),
                            category: normalizeText(item.category),
                            prices: []
                        };
                    }

                    analytics.topItems[itemKey].quantity += quantity;
                    analytics.topItems[itemKey].revenue += revenue;
                    analytics.topItems[itemKey].count++;
                    analytics.itemDetails[itemKey].prices.push(price);

                    const category = normalizeText(item.category) || "Uncategorized";
                    if (!analytics.itemsByCategory[category]) {
                        analytics.itemsByCategory[category] = { revenue: 0, quantity: 0 };
                    }
                    analytics.itemsByCategory[category].revenue += revenue;
                    analytics.itemsByCategory[category].quantity += quantity;
                });
            }
        });

        Object.keys(analytics.topItems).forEach(itemKey => {
            const item = analytics.topItems[itemKey];
            item.avgPrice = item.quantity > 0 ? item.revenue / item.quantity : 0;
        });

        return analytics;
    }

    /**
     * Flatten the topItems map into a plain array of rows for tables/sorting.
     */
    function aggregateTopItems(orders) {
        const analytics = calculateAnalytics(orders);
        return Object.values(analytics.topItems).map(item => ({
            name: item.name || "Unnamed item",
            category: item.category || "Uncategorized",
            quantity: item.quantity,
            revenue: item.revenue,
            avgPrice: item.avgPrice
        }));
    }

    /**
     * Build a 7×24 matrix of order counts (rows = Mon..Sun, cols = 0..23).
     */
    function aggregateHourlyByDay(orders) {
        const matrix = Array.from({ length: 7 }, () => new Array(24).fill(0));
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (!date) return;
            const hour = date.getHours();
            const dayMonStart = (date.getDay() + 6) % 7; // Mon = 0 .. Sun = 6
            matrix[dayMonStart][hour]++;
        });
        return matrix;
    }

    /**
     * Aggregate orders by customer. Returns an array of insight rows.
     * Privacy-safe: name and id only, no contact info.
     */
    function aggregateCustomerInsights(orders) {
        const map = new Map();
        orders.forEach(order => {
            const id = normalizeText(order.customerUid || order.customerId || order.userId);
            const name = normalizeText(order.customerName || order.studentName || order.customerEmail) || "Anonymous";
            const key = id || name;
            if (!key) return;
            if (!map.has(key)) {
                map.set(key, {
                    customerId: id,
                    customerName: name,
                    orderCount: 0,
                    totalSpent: 0,
                    lastOrder: null
                });
            }
            const row = map.get(key);
            row.orderCount++;
            row.totalSpent += getOrderAmount(order);
            const date = getDateFromTimestamp(order.createdAt);
            if (date && (!row.lastOrder || date > row.lastOrder)) {
                row.lastOrder = date;
            }
        });
        return Array.from(map.values());
    }

    /**
     * Compare KPIs between two equal-length periods.
     * Returns deltas as absolute and percent, plus a direction tag.
     */
    function computePeriodComparison(currentOrders, previousOrders) {
        const current = calculateAnalytics(currentOrders);
        const previous = calculateAnalytics(previousOrders);

        const currentAov = current.totalOrders > 0 ? current.totalRevenue / current.totalOrders : 0;
        const previousAov = previous.totalOrders > 0 ? previous.totalRevenue / previous.totalOrders : 0;

        function delta(curr, prev) {
            const diff = curr - prev;
            let pct = 0;
            if (prev !== 0) {
                pct = (diff / Math.abs(prev)) * 100;
            } else if (curr !== 0) {
                pct = 100;
            }
            let direction = "flat";
            if (diff > 0) direction = "up";
            else if (diff < 0) direction = "down";
            return { current: curr, previous: prev, diff, pct, direction };
        }

        return {
            revenue: delta(current.totalRevenue, previous.totalRevenue),
            orders: delta(current.totalOrders, previous.totalOrders),
            aov: delta(currentAov, previousAov),
            items: delta(current.totalItems, previous.totalItems)
        };
    }

    // ------------------------------------------------------------------------
    // Search, sort, paginate
    // ------------------------------------------------------------------------

    function searchItems(items, term) {
        const t = normalizeLowerText(term);
        if (!t) return items.slice();
        return items.filter(item => {
            const name = normalizeLowerText(item.name);
            const category = normalizeLowerText(item.category);
            return name.includes(t) || category.includes(t);
        });
    }

    function searchCustomers(customers, term) {
        const t = normalizeLowerText(term);
        if (!t) return customers.slice();
        return customers.filter(c => normalizeLowerText(c.customerName).includes(t));
    }

    const ITEM_SORT_KEYS = {
        quantity: r => r.quantity,
        revenue: r => r.revenue,
        avgPrice: r => r.avgPrice,
        name: r => normalizeLowerText(r.name)
    };

    const CUSTOMER_SORT_KEYS = {
        orderCount: r => r.orderCount,
        totalSpent: r => r.totalSpent,
        name: r => normalizeLowerText(r.customerName),
        lastOrder: r => (r.lastOrder ? r.lastOrder.getTime() : 0)
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

    function sortItems(items, sortKey, direction) {
        return sortRows(items, ITEM_SORT_KEYS, sortKey, direction);
    }

    function sortCustomers(customers, sortKey, direction) {
        return sortRows(customers, CUSTOMER_SORT_KEYS, sortKey, direction);
    }

    /**
     * Slice an array into a single page.
     * Guards: page is clamped to [1, totalPages]; size is clamped to >= 1.
     */
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

    // ========================================================================
    // (Everything below this line is browser-only DOM/Firebase wiring.
    //  Tests should only call the pure functions above.)
    // ========================================================================

    let initInFlight = null;
    let currentVendorUid = null;
    let allOrders = [];
    let filteredOrders = [];
    let previousPeriodOrders = [];
    let analyticsCharts = {};
    let eventListenersAttached = false;

    const itemsState = { search: "", sort: "quantity", dir: "desc", page: 1, size: 10 };
    const bottomItemsState = { search: "", sort: "quantity", dir: "asc", page: 1, size: 10 };
    const customersState = { search: "", sort: "totalSpent", dir: "desc", page: 1, size: 10 };

    function resolveFirestore(explicitDb) {
        if (explicitDb) return explicitDb;
        if (globalScope.db) return globalScope.db;
        return null;
    }

    function resolveAuth(explicitAuth) {
        if (explicitAuth) return explicitAuth;
        if (globalScope.auth) return globalScope.auth;
        return null;
    }

    function resolveAuthFns(explicitAuthFns) {
        if (explicitAuthFns && typeof explicitAuthFns === "object") return explicitAuthFns;
        if (globalScope.authFns && typeof globalScope.authFns === "object") return globalScope.authFns;
        return {};
    }

    function resolveFirestoreFns(explicitFirestoreFns) {
        if (explicitFirestoreFns && typeof explicitFirestoreFns === "object") return explicitFirestoreFns;
        if (globalScope.firestoreFns && typeof globalScope.firestoreFns === "object") return globalScope.firestoreFns;
        return {};
    }

    function updateStatusMessage(message, isError = false) {
        const statusEl = document.getElementById("analytics-status");
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.className = isError ? "error-message" : "success-message";
        }
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    // ------------------------------------------------------------------------
    // KPI metrics
    // ------------------------------------------------------------------------

    function updateMetrics(analytics) {
        const totalOrders = analytics.totalOrders;
        const completedOrders = analytics.completedOrders;
        const avgOrderValue = totalOrders > 0 ? analytics.totalRevenue / totalOrders : 0;
        const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
        const avgItemsPerOrder = totalOrders > 0 ? analytics.totalItems / totalOrders : 0;

        setText("total-revenue", formatCurrency(analytics.totalRevenue));
        setText("total-orders", String(totalOrders));
        setText("avg-order-value", formatCurrency(avgOrderValue));
        setText("completion-rate", `${completionRate}%`);
        setText("total-items-sold", String(analytics.totalItems));
        setText("avg-items-per-order", Number.isInteger(avgItemsPerOrder)
            ? String(avgItemsPerOrder)
            : avgItemsPerOrder.toFixed(1));
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    // ------------------------------------------------------------------------
    // Charts
    // ------------------------------------------------------------------------

    function createChart(canvasId, type, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx || typeof Chart === "undefined") return null;
        if (analyticsCharts[canvasId]) {
            analyticsCharts[canvasId].destroy();
        }
        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "top" } }
        };
        const chart = new Chart(ctx, { type, data, options: { ...defaultOptions, ...options } });
        analyticsCharts[canvasId] = chart;
        return chart;
    }

    function createPeakHoursChart(analytics) {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const data = hours.map(h => analytics.peakHours[h] || 0);
        createChart("peak-hours-chart", "line", {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
                label: "Orders",
                data,
                borderColor: "#c56a1a",
                backgroundColor: "rgba(197, 106, 26, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        }, { plugins: { legend: { display: true } } });
    }

    function createTopItemsChart(analytics) {
        const sorted = Object.values(analytics.topItems)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);
        createChart("top-items-chart", "doughnut", {
            labels: sorted.map(item => (item.name || "").substring(0, 20)),
            datasets: [{
                label: "Quantity Sold",
                data: sorted.map(item => item.quantity),
                backgroundColor: ["#c56a1a", "#9f4d0d", "#6a8468", "#e3a857", "#d4874c",
                    "#a85c38", "#815a2b", "#b8956e", "#9a7e72", "#d7a5a5"],
                borderColor: "#fff",
                borderWidth: 2
            }]
        });
    }

    function createRevenueTrendChart(analytics) {
        const days = Object.keys(analytics.ordersByDay).sort();
        const revenues = days.map(day => analytics.ordersByDay[day] || 0);
        createChart("revenue-trend-chart", "line", {
            labels: days.map(day => new Date(day).toLocaleDateString("en-ZA", { month: "short", day: "numeric" })),
            datasets: [{
                label: "Daily Revenue (ZAR)",
                data: revenues,
                borderColor: "#c56a1a",
                backgroundColor: "rgba(197, 106, 26, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: "#c56a1a"
            }]
        });
    }

    function createStatusDistributionChart(analytics) {
        createChart("status-distribution-chart", "pie", {
            labels: Object.keys(analytics.ordersByStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
            datasets: [{
                data: Object.values(analytics.ordersByStatus),
                backgroundColor: ["#6a8468", "#c56a1a", "#d7a5a5", "#b8956e", "#9a7e72"],
                borderColor: "#fff",
                borderWidth: 2
            }]
        });
    }

    function createCategoryChart(analytics) {
        const sorted = Object.entries(analytics.itemsByCategory)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 8);
        createChart("category-chart", "bar", {
            labels: sorted.map(item => item.category || "Uncategorized"),
            datasets: [{
                label: "Revenue (ZAR)",
                data: sorted.map(item => item.revenue),
                backgroundColor: "rgba(106, 132, 104, 0.7)",
                borderColor: "#6a8468",
                borderWidth: 2
            }]
        });
    }

    function createWeeklyChart(analytics) {
        const weeks = Object.keys(analytics.ordersByWeek).sort((a, b) => Number(a) - Number(b));
        const revenues = weeks.map(week => analytics.ordersByWeek[week] || 0);
        createChart("weekly-chart", "line", {
            labels: weeks.map(week => `Week ${week}`),
            datasets: [{
                label: "Weekly Revenue (ZAR)",
                data: revenues,
                borderColor: "#6a8468",
                backgroundColor: "rgba(106, 132, 104, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        });
    }

    // ------------------------------------------------------------------------
    // Tables (with search + sort + pagination)
    // ------------------------------------------------------------------------

    function renderItemRow(item, rank) {
        return `
            <tr>
                <td data-label="Rank"><strong class="rank-badge">#${rank}</strong></td>
                <td data-label="Item">${escapeHtml(item.name)}</td>
                <td data-label="Category">${escapeHtml(item.category)}</td>
                <td data-label="Qty sold">${item.quantity}</td>
                <td data-label="Revenue">${escapeHtml(formatCurrency(item.revenue))}</td>
                <td data-label="Avg price">${escapeHtml(formatCurrency(item.avgPrice))}</td>
            </tr>`;
    }

    function renderTopItemsTable() {
        const tableEl = document.getElementById("top-items-table");
        if (!tableEl) return;

        const allItems = aggregateTopItems(filteredOrders);
        const filtered = searchItems(allItems, itemsState.search);
        const sorted = sortItems(filtered, itemsState.sort, itemsState.dir);
        const pageResult = paginate(sorted, itemsState.page, itemsState.size);
        itemsState.page = pageResult.page;

        const tbody = tableEl.querySelector("tbody");
        if (!tbody) return;

        if (pageResult.total === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading-message">No items match your search.</td></tr>`;
        } else {
            tbody.innerHTML = pageResult.rows
                .map((item, i) => renderItemRow(item, pageResult.startIndex + i))
                .join("");
        }

        updatePaginationOutputs("top-items", pageResult);
    }

    function renderBottomItemsTable() {
        const tableEl = document.getElementById("bottom-items-table");
        if (!tableEl) return;

        const allItems = aggregateTopItems(filteredOrders).filter(i => i.quantity > 0);
        const filtered = searchItems(allItems, bottomItemsState.search);
        const sorted = sortItems(filtered, bottomItemsState.sort, bottomItemsState.dir);
        const pageResult = paginate(sorted, bottomItemsState.page, bottomItemsState.size);
        bottomItemsState.page = pageResult.page;

        const tbody = tableEl.querySelector("tbody");
        if (!tbody) return;

        if (pageResult.total === 0) {
            tbody.innerHTML = `<tr><td colspan="6" class="loading-message">No underperforming items found.</td></tr>`;
        } else {
            tbody.innerHTML = pageResult.rows
                .map((item, i) => renderItemRow(item, pageResult.startIndex + i))
                .join("");
        }

        updatePaginationOutputs("bottom-items", pageResult);
    }

    function renderCustomerInsightsTable() {
        const tableEl = document.getElementById("customer-insights-table");
        if (!tableEl) return;

        const allCustomers = aggregateCustomerInsights(filteredOrders);
        const filtered = searchCustomers(allCustomers, customersState.search);
        const sorted = sortCustomers(filtered, customersState.sort, customersState.dir);
        const pageResult = paginate(sorted, customersState.page, customersState.size);
        customersState.page = pageResult.page;

        const tbody = tableEl.querySelector("tbody");
        if (!tbody) return;

        if (pageResult.total === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="loading-message">No customer activity in this period.</td></tr>`;
        } else {
            tbody.innerHTML = pageResult.rows.map((row, i) => {
                const last = row.lastOrder
                    ? row.lastOrder.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })
                    : "—";
                return `
                    <tr>
                        <td data-label="Rank"><strong class="rank-badge">#${pageResult.startIndex + i}</strong></td>
                        <td data-label="Customer">${escapeHtml(row.customerName)}</td>
                        <td data-label="Orders">${row.orderCount}</td>
                        <td data-label="Total spent">${escapeHtml(formatCurrency(row.totalSpent))}</td>
                        <td data-label="Last order">${escapeHtml(last)}</td>
                    </tr>`;
            }).join("");
        }

        updatePaginationOutputs("customer-insights", pageResult);
    }

    function updatePaginationOutputs(prefix, pageResult) {
        const indicator = document.getElementById(`${prefix}-page-indicator`);
        if (indicator) {
            indicator.textContent = pageResult.total === 0
                ? "0 results"
                : `Page ${pageResult.page} of ${pageResult.totalPages} • ${pageResult.startIndex}–${pageResult.endIndex} of ${pageResult.total}`;
        }
        const prevBtn = document.getElementById(`${prefix}-prev-button`);
        if (prevBtn) prevBtn.disabled = pageResult.page <= 1;
        const nextBtn = document.getElementById(`${prefix}-next-button`);
        if (nextBtn) nextBtn.disabled = pageResult.page >= pageResult.totalPages;
    }

    // ------------------------------------------------------------------------
    // Heatmap (hour × day)
    // ------------------------------------------------------------------------

    function renderHeatmap() {
        const wrap = document.getElementById("hourly-heatmap");
        if (!wrap) return;

        const matrix = aggregateHourlyByDay(filteredOrders);
        const max = Math.max(1, ...matrix.flat());
        const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
        const hLabels = Array.from({ length: 24 }, (_, i) => i % 3 === 0
            ? (i === 0 ? "12a" : i < 12 ? `${i}a` : i === 12 ? "12p" : `${i - 12}p`)
            : "");

        let html = '<table class="heatmap" role="grid"><thead><tr><th></th>';
        hLabels.forEach(l => { html += `<th>${l}</th>`; });
        html += "</tr></thead><tbody>";

        days.forEach((day, di) => {
            html += `<tr><th>${day}</th>`;
            matrix[di].forEach(val => {
                const intensity = val / max;
                const r = Math.round(255 - (255 - 197) * intensity);
                const g = Math.round(255 - (255 - 106) * intensity);
                const b = Math.round(255 - (255 - 26) * intensity);
                html += `<td title="${val} orders" style="background:rgb(${r},${g},${b});color:${intensity > 0.55 ? "#fff" : "#333"};">${val > 0 ? val : ""}</td>`;
            });
            html += "</tr>";
        });
        html += "</tbody></table>";
        wrap.innerHTML = html;
    }

    // ------------------------------------------------------------------------
    // Period-vs-period comparison panel
    // ------------------------------------------------------------------------

    function renderComparisonPanel() {
        const wrap = document.getElementById("comparison-panel");
        if (!wrap) return;

        const startStr = document.getElementById("start-date-input")?.value;
        const endStr = document.getElementById("end-date-input")?.value;
        if (!startStr || !endStr) {
            wrap.innerHTML = `<p class="loading-message">Pick a date range to see period-over-period change.</p>`;
            return;
        }

        const start = new Date(startStr);
        const end = new Date(endStr);
        end.setHours(23, 59, 59, 999);
        const prev = computePreviousPeriodRange(start, end);
        previousPeriodOrders = filterOrdersByDateRange(allOrders, prev.start, prev.end);

        const cmp = computePeriodComparison(filteredOrders, previousPeriodOrders);
        wrap.innerHTML = [
            renderComparisonCard("Revenue", cmp.revenue, formatCurrency),
            renderComparisonCard("Orders", cmp.orders, String),
            renderComparisonCard("Avg order value", cmp.aov, formatCurrency),
            renderComparisonCard("Items sold", cmp.items, String)
        ].join("");
    }

    function renderComparisonCard(label, delta, fmt) {
        const arrow = delta.direction === "up" ? "▲" : delta.direction === "down" ? "▼" : "•";
        const cls = `comparison-card ${delta.direction}`;
        const pct = Math.abs(delta.pct).toFixed(1);
        return `
            <article class="${cls}">
                <h5>${escapeHtml(label)}</h5>
                <p class="comparison-value">${escapeHtml(fmt(delta.current))}</p>
                <p class="comparison-delta">
                    <i class="comparison-arrow" aria-hidden="true">${arrow}</i>
                    ${pct}% vs previous period
                </p>
                <small class="comparison-previous">prev: ${escapeHtml(fmt(delta.previous))}</small>
            </article>`;
    }

    // ------------------------------------------------------------------------
    // Insights
    // ------------------------------------------------------------------------

    function generateInsights(analytics) {
        const insights = [];
        const totalOrders = analytics.totalOrders;
        const completionRate = totalOrders > 0 ? (analytics.completedOrders / totalOrders) * 100 : 0;
        const avgOrderValue = totalOrders > 0 ? analytics.totalRevenue / totalOrders : 0;

        if (Object.keys(analytics.peakHours).length > 0) {
            const peakHour = Object.entries(analytics.peakHours)
                .reduce((max, [hour, count]) => count > max[1] ? [hour, count] : max, ["0", 0]);
            insights.push({
                icon: "⏰",
                title: "Peak Hours Identified",
                text: `Your peak hour is around ${peakHour[0]}:00 with ${peakHour[1]} orders. Consider staffing up during this time.`,
                type: "info"
            });
        }

        if (Object.keys(analytics.topItems).length > 0) {
            const topItem = Object.values(analytics.topItems)
                .reduce((max, item) => item.quantity > max.quantity ? item : max);
            insights.push({
                icon: "⭐",
                title: "Best Seller",
                text: `"${topItem.name}" is your top performer with ${topItem.quantity} units sold (${formatCurrency(topItem.revenue)} revenue).`,
                type: "success"
            });
        }

        if (totalOrders > 0) {
            if (completionRate < 80) {
                insights.push({
                    icon: "⚠️",
                    title: "Order Completion Alert",
                    text: `Your order completion rate is ${Math.round(completionRate)}%. Aim for 90%+ to improve customer satisfaction.`,
                    type: "warning"
                });
            } else {
                insights.push({
                    icon: "✅",
                    title: "Great Completion Rate",
                    text: `Your order completion rate is ${Math.round(completionRate)}%! This is excellent for customer satisfaction.`,
                    type: "success"
                });
            }
        }

        if (analytics.totalRevenue > 0) {
            const dayCount = Object.values(analytics.ordersByDay).length;
            const avgDaily = dayCount > 0 ? analytics.totalRevenue / dayCount : 0;
            insights.push({
                icon: "💰",
                title: "Revenue Overview",
                text: `Total revenue: ${formatCurrency(analytics.totalRevenue)} | AOV: ${formatCurrency(avgOrderValue)} | Avg daily: ${formatCurrency(avgDaily)}`,
                type: "info"
            });
        }

        if (Object.keys(analytics.itemsByCategory).length > 0) {
            const topCategory = Object.entries(analytics.itemsByCategory)
                .reduce((max, [cat, data]) => data.revenue > max.revenue ? { category: cat, ...data } : max);
            insights.push({
                icon: "📊",
                title: "Top Category",
                text: `"${topCategory.category}" is your best-performing category with ${formatCurrency(topCategory.revenue)} in revenue.`,
                type: "info"
            });
        }

        const underperformers = Object.values(analytics.topItems).filter(i => i.quantity < 3 && i.quantity > 0);
        if (underperformers.length > 0) {
            insights.push({
                icon: "🎯",
                title: "Menu Optimization Opportunity",
                text: `You have ${underperformers.length} items with low sales. Consider removing or promoting them.`,
                type: "warning"
            });
        }

        return insights;
    }

    function renderInsights(insights) {
        const container = document.getElementById("insights-container");
        if (!container) return;
        if (insights.length === 0) {
            container.innerHTML = `<p class="loading-message">No analytics data available for the selected period.</p>`;
            return;
        }
        container.innerHTML = insights.map(insight => `
            <article class="insight-card ${insight.type}">
                <i class="insight-icon" aria-hidden="true">${insight.icon}</i>
                <section class="insight-content">
                    <h4 class="insight-title">${escapeHtml(insight.title)}</h4>
                    <p class="insight-text">${escapeHtml(insight.text)}</p>
                </section>
            </article>`).join("");
    }

    // ------------------------------------------------------------------------
    // CSV Export
    // ------------------------------------------------------------------------

    function exportToCSV(analytics) {
        const rows = [];
        rows.push(["Campus Food Ordering Platform - Vendor Analytics Export"]);
        rows.push(["Export Date", new Date().toLocaleString()]);
        rows.push([]);

        rows.push(["SUMMARY METRICS"]);
        rows.push(["Metric", "Value"]);
        rows.push(["Total Revenue", formatCurrency(analytics.totalRevenue)]);
        rows.push(["Total Orders", analytics.totalOrders]);
        rows.push(["Completed Orders", analytics.completedOrders]);
        rows.push(["Completion Rate", `${analytics.totalOrders > 0 ? Math.round((analytics.completedOrders / analytics.totalOrders) * 100) : 0}%`]);
        rows.push(["Total Items Sold", analytics.totalItems]);
        rows.push([]);

        rows.push(["PEAK HOURS ANALYSIS"]);
        rows.push(["Hour", "Orders"]);
        Object.entries(analytics.peakHours)
            .sort((a, b) => b[1] - a[1])
            .forEach(([hour, count]) => rows.push([`${hour}:00`, count]));
        rows.push([]);

        rows.push(["TOP SELLING ITEMS"]);
        rows.push(["Item Name", "Category", "Quantity Sold", "Revenue", "Average Price"]);
        Object.values(analytics.topItems)
            .sort((a, b) => b.quantity - a.quantity)
            .forEach(item => rows.push([item.name, item.category, item.quantity, formatCurrency(item.revenue), formatCurrency(item.avgPrice)]));
        rows.push([]);

        rows.push(["DAILY BREAKDOWN"]);
        rows.push(["Date", "Revenue"]);
        Object.entries(analytics.ordersByDay).sort().forEach(([day, revenue]) => rows.push([day, formatCurrency(revenue)]));
        rows.push([]);

        rows.push(["CATEGORY PERFORMANCE"]);
        rows.push(["Category", "Revenue", "Items Sold"]);
        Object.entries(analytics.itemsByCategory)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([category, data]) => rows.push([category, formatCurrency(data.revenue), data.quantity]));

        const csv = rows.map(row => row.map(cell => {
            const value = String(cell).replace(/"/g, '""');
            return /[",\n]/.test(value) ? `"${value}"` : value;
        }).join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `vendor-analytics-${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        updateStatusMessage("Analytics exported successfully!", false);
    }

    // ------------------------------------------------------------------------
    // Excel export (uses SheetJS / XLSX loaded via CDN)
    // ------------------------------------------------------------------------

    function buildExportTables(analytics) {
        const customers = aggregateCustomerInsights(filteredOrders);

        const summary = [
            ["Metric", "Value"],
            ["Total Revenue", analytics.totalRevenue],
            ["Total Orders", analytics.totalOrders],
            ["Completed Orders", analytics.completedOrders],
            ["Completion Rate (%)", analytics.totalOrders > 0
                ? Math.round((analytics.completedOrders / analytics.totalOrders) * 100)
                : 0],
            ["Total Items Sold", analytics.totalItems],
            ["Avg Order Value", analytics.totalOrders > 0
                ? Number((analytics.totalRevenue / analytics.totalOrders).toFixed(2))
                : 0]
        ];

        const topItems = [
            ["Item Name", "Category", "Quantity Sold", "Revenue (ZAR)", "Avg Price (ZAR)"],
            ...Object.values(analytics.topItems)
                .sort((a, b) => b.quantity - a.quantity)
                .map(item => [item.name, item.category, item.quantity,
                    Number(item.revenue.toFixed(2)), Number(item.avgPrice.toFixed(2))])
        ];

        const peakHours = [
            ["Hour", "Orders"],
            ...Object.entries(analytics.peakHours)
                .sort((a, b) => Number(a[0]) - Number(b[0]))
                .map(([h, c]) => [`${h}:00`, c])
        ];

        const daily = [
            ["Date", "Revenue (ZAR)"],
            ...Object.entries(analytics.ordersByDay)
                .sort()
                .map(([day, rev]) => [day, Number(rev.toFixed(2))])
        ];

        const categories = [
            ["Category", "Revenue (ZAR)", "Items Sold"],
            ...Object.entries(analytics.itemsByCategory)
                .sort((a, b) => b[1].revenue - a[1].revenue)
                .map(([cat, data]) => [cat, Number(data.revenue.toFixed(2)), data.quantity])
        ];

        const customerRows = [
            ["Rank", "Customer", "Orders", "Total Spent (ZAR)", "Last Order"],
            ...customers
                .sort((a, b) => b.totalSpent - a.totalSpent)
                .map((row, idx) => [
                    idx + 1,
                    row.customerName,
                    row.orderCount,
                    Number(row.totalSpent.toFixed(2)),
                    row.lastOrder ? row.lastOrder.toISOString().split("T")[0] : ""
                ])
        ];

        return { summary, topItems, peakHours, daily, categories, customerRows };
    }

    function exportToExcel(analytics) {
        if (typeof XLSX === "undefined") {
            updateStatusMessage("Excel library not loaded — try again in a moment.", true);
            return;
        }
        const t = buildExportTables(analytics);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.summary), "Summary");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.topItems), "Top Items");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.peakHours), "Peak Hours");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.daily), "Daily Revenue");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.categories), "Categories");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.customerRows), "Customers");
        const filename = `vendor-analytics-${new Date().toISOString().split("T")[0]}.xlsx`;
        XLSX.writeFile(wb, filename);
        updateStatusMessage("Excel workbook exported.", false);
    }

    // ------------------------------------------------------------------------
    // PDF export (uses jsPDF loaded via CDN)
    // ------------------------------------------------------------------------

    function drawPdfTable(doc, headers, rows, startY, colWidths) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const usable = pageWidth - margin * 2;
        const widths = colWidths || headers.map(() => usable / headers.length);
        const rowH = 7;
        let y = startY;

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        let x = margin;
        headers.forEach((h, i) => {
            doc.rect(x, y, widths[i], rowH);
            doc.text(String(h), x + 1.5, y + 5);
            x += widths[i];
        });
        y += rowH;

        doc.setFont("helvetica", "normal");
        rows.forEach(row => {
            if (y + rowH > pageHeight - margin) {
                doc.addPage();
                y = margin;
            }
            x = margin;
            row.forEach((cell, i) => {
                doc.rect(x, y, widths[i], rowH);
                const text = String(cell == null ? "" : cell);
                const maxChars = Math.floor(widths[i] / 1.7);
                const clipped = text.length > maxChars ? text.substring(0, maxChars - 1) + "…" : text;
                doc.text(clipped, x + 1.5, y + 5);
                x += widths[i];
            });
            y += rowH;
        });
        return y;
    }

    function exportToPDF(analytics) {
        if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
            updateStatusMessage("PDF library not loaded — try again in a moment.", true);
            return;
        }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const t = buildExportTables(analytics);
        const pageWidth = doc.internal.pageSize.getWidth();
        const startStr = document.getElementById("start-date-input")?.value || "";
        const endStr = document.getElementById("end-date-input")?.value || "";

        // Header
        doc.setFont("helvetica", "bold");
        doc.setFontSize(18);
        doc.text("Vendor Analytics Report", 14, 18);
        doc.setFontSize(10);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(110);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
        if (startStr && endStr) {
            doc.text(`Period: ${startStr} → ${endStr}`, 14, 31);
        } else {
            doc.text("Period: All time", 14, 31);
        }
        doc.setTextColor(0);

        // Summary KPIs
        let y = 40;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Summary", 14, y);
        y += 5;
        y = drawPdfTable(doc, t.summary[0], t.summary.slice(1), y, [80, pageWidth - 14 - 14 - 80]);

        // Top items
        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Top items", 14, y);
        y += 5;
        y = drawPdfTable(doc, t.topItems[0], t.topItems.slice(1), y, [60, 40, 25, 30, 27]);

        // Categories
        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Categories", 14, y);
        y += 5;
        y = drawPdfTable(doc, t.categories[0], t.categories.slice(1), y, [80, 50, 52]);

        // Peak hours
        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Peak hours", 14, y);
        y += 5;
        y = drawPdfTable(doc, t.peakHours[0], t.peakHours.slice(1), y, [60, 122]);

        // Customers
        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold");
        doc.setFontSize(12);
        doc.text("Customer activity", 14, y);
        y += 5;
        y = drawPdfTable(doc, t.customerRows[0], t.customerRows.slice(1), y, [16, 70, 24, 38, 34]);

        // Embed revenue trend chart if available
        const trendCanvas = document.getElementById("revenue-trend-chart");
        if (trendCanvas && typeof trendCanvas.toDataURL === "function") {
            try {
                const img = trendCanvas.toDataURL("image/png");
                doc.addPage();
                doc.setFont("helvetica", "bold");
                doc.setFontSize(14);
                doc.text("Revenue trend", 14, 18);
                doc.addImage(img, "PNG", 14, 24, pageWidth - 28, 90);
            } catch (err) {
                // Canvas may be tainted or empty — skip silently
            }
        }

        const filename = `vendor-analytics-${new Date().toISOString().split("T")[0]}.pdf`;
        doc.save(filename);
        updateStatusMessage("PDF report exported.", false);
    }

    // ------------------------------------------------------------------------
    // Data fetching
    // ------------------------------------------------------------------------

    async function fetchVendorOrders(db, firestoreFns, vendorUid) {
        if (!db || !firestoreFns || !vendorUid) {
            throw new Error("Missing required dependencies for order fetching");
        }
        const { collection, query, where, getDocs } = firestoreFns;
        const ordersRef = collection(db, "orders");
        const q = query(ordersRef, where("vendorUid", "==", vendorUid));
        const snapshot = await getDocs(q);
        const orders = [];
        snapshot.forEach(doc => {
            orders.push({ id: doc.id, ...doc.data() });
        });
        const normalizedVendorUid = normalizeText(vendorUid);
        return orders.filter(order => normalizeText(order.vendorUid) === normalizedVendorUid);
    }

    // ------------------------------------------------------------------------
    // Init + filtering
    // ------------------------------------------------------------------------

    async function initializeAnalyticsDashboard(options = {}) {
        if (initInFlight) return initInFlight;

        initInFlight = (async () => {
            try {
                updateStatusMessage("Loading analytics...", false);

                const db = resolveFirestore(options.db);
                const auth = resolveAuth(options.auth);
                const authFns = resolveAuthFns(options.authFns);
                const firestoreFns = resolveFirestoreFns(options.firestoreFns);

                if (!db || !auth || !authFns || !firestoreFns) {
                    throw new Error("Missing required Firebase dependencies");
                }

                const { onAuthStateChanged } = authFns;
                await new Promise((resolve, reject) => {
                    onAuthStateChanged(auth, user => {
                        if (user) {
                            currentVendorUid = user.uid;
                            resolve();
                        } else {
                            window.location.href = "../authentication/login.html";
                            reject(new Error("User not authenticated"));
                        }
                    });
                });

                allOrders = await fetchVendorOrders(db, firestoreFns, currentVendorUid);

                const startEl = document.getElementById("start-date-input");
                const endEl = document.getElementById("end-date-input");
                const currentStart = normalizeText(startEl?.value);
                const currentEnd = normalizeText(endEl?.value);
                if (!currentStart && !currentEnd) {
                    const endDate = new Date();
                    const startDate = new Date(endDate);
                    startDate.setDate(startDate.getDate() - 30);
                    if (startEl) startEl.value = startDate.toISOString().split("T")[0];
                    if (endEl) endEl.value = endDate.toISOString().split("T")[0];
                }

                await applyDateFilter();
                attachEventListeners();

                updateStatusMessage("Analytics loaded successfully!", false);
                console.log(`[${MODULE_NAME}] Dashboard initialized with ${allOrders.length} orders`);
            } catch (error) {
                console.error(`[${MODULE_NAME}] Initialization error:`, error);
                updateStatusMessage(`Error loading analytics: ${error.message}`, true);
            } finally {
                initInFlight = null;
            }
        })();

        return initInFlight;
    }

    async function applyDateFilter() {
        const startEl = document.getElementById("start-date-input");
        const endEl = document.getElementById("end-date-input");
        const startStr = startEl?.value;
        const endStr = endEl?.value;
        const startDate = startStr ? new Date(startStr) : null;
        const endDate = endStr ? new Date(endStr) : null;
        if (endDate) endDate.setHours(23, 59, 59, 999);

        filteredOrders = filterOrdersByDateRange(allOrders, startDate, endDate);
        // Reset pagination when filters change
        itemsState.page = 1;
        bottomItemsState.page = 1;
        customersState.page = 1;
        renderEverything();

        const dateRange = startStr && endStr ? ` (${startStr} to ${endStr})` : " (All time)";
        updateStatusMessage(`Showing analytics for ${filteredOrders.length} orders${dateRange}`, false);
    }

    function renderEverything() {
        const analytics = calculateAnalytics(filteredOrders);
        updateMetrics(analytics);
        createPeakHoursChart(analytics);
        createTopItemsChart(analytics);
        createRevenueTrendChart(analytics);
        createStatusDistributionChart(analytics);
        createCategoryChart(analytics);
        createWeeklyChart(analytics);
        renderTopItemsTable();
        renderBottomItemsTable();
        renderCustomerInsightsTable();
        renderHeatmap();
        renderComparisonPanel();
        renderInsights(generateInsights(analytics));
    }

    function applyTimeWindowChip(key) {
        const refDate = new Date();
        const { start, end } = resolveTimeWindow(key, refDate);
        const startEl = document.getElementById("start-date-input");
        const endEl = document.getElementById("end-date-input");
        if (start && end) {
            if (startEl) startEl.value = start.toISOString().split("T")[0];
            if (endEl) endEl.value = end.toISOString().split("T")[0];
        } else {
            // "all"
            if (startEl) startEl.value = "";
            if (endEl) endEl.value = "";
        }
        document.querySelectorAll(".time-chip").forEach(btn => {
            btn.classList.toggle("active", btn.getAttribute("data-window") === key);
            btn.setAttribute("aria-pressed", btn.getAttribute("data-window") === key ? "true" : "false");
        });
        applyDateFilter();
    }

    // ------------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------------

    function attachEventListeners() {
        if (eventListenersAttached) return;
        attachSectionSwitchers();

        document.getElementById("apply-filter-button")?.addEventListener("click", () => applyDateFilter());
        document.getElementById("reset-filter-button")?.addEventListener("click", () => {
            const endDate = new Date();
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 30);
            const startEl = document.getElementById("start-date-input");
            const endEl = document.getElementById("end-date-input");
            if (startEl) startEl.value = startDate.toISOString().split("T")[0];
            if (endEl) endEl.value = endDate.toISOString().split("T")[0];
            applyDateFilter();
        });
        document.getElementById("export-csv-button")?.addEventListener("click", () => {
            if (filteredOrders.length === 0) {
                updateStatusMessage("No data to export", true);
                return;
            }
            exportToCSV(calculateAnalytics(filteredOrders));
        });
        document.getElementById("export-excel-button")?.addEventListener("click", () => {
            if (filteredOrders.length === 0) {
                updateStatusMessage("No data to export", true);
                return;
            }
            exportToExcel(calculateAnalytics(filteredOrders));
        });
        document.getElementById("export-pdf-button")?.addEventListener("click", () => {
            if (filteredOrders.length === 0) {
                updateStatusMessage("No data to export", true);
                return;
            }
            exportToPDF(calculateAnalytics(filteredOrders));
        });
        document.getElementById("refresh-data-button")?.addEventListener("click", () => {
            initInFlight = null;
            initializeAnalyticsDashboard({
                db: resolveFirestore(),
                auth: resolveAuth(),
                authFns: resolveAuthFns(),
                firestoreFns: resolveFirestoreFns()
            });
        });

        document.querySelectorAll(".time-chip").forEach(btn => {
            btn.addEventListener("click", () => applyTimeWindowChip(btn.getAttribute("data-window")));
        });

        attachTableControls("top-items", itemsState, renderTopItemsTable);
        attachTableControls("bottom-items", bottomItemsState, renderBottomItemsTable);
        attachTableControls("customer-insights", customersState, renderCustomerInsightsTable);

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

    function attachSectionSwitchers() {
        const menuItems = document.querySelectorAll(".menu-item");
        menuItems.forEach(item => {
            item.addEventListener("click", () => {
                const sectionName = item.getAttribute("data-section");
                if (!sectionName) return;
                menuItems.forEach(m => m.classList.remove("active"));
                document.querySelectorAll(".content-section").forEach(s => s.classList.remove("active"));
                item.classList.add("active");
                document.getElementById(`${sectionName}-section`)?.classList.add("active");
            });
        });
    }

    // ------------------------------------------------------------------------
    // Auto-init in browser only
    // ------------------------------------------------------------------------

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
        attachSectionSwitchers();
        const startInit = () => initializeAnalyticsDashboard({
            db: globalScope.db,
            auth: globalScope.auth,
            authFns: globalScope.authFns,
            firestoreFns: globalScope.firestoreFns
        });
        if (globalScope.db && globalScope.auth && globalScope.authFns && globalScope.firestoreFns) {
            startInit();
            return;
        }
        waitForFirebaseDependencies()
            .then(startInit)
            .catch(error => {
                console.error(`${MODULE_NAME} initialization error:`, error);
                updateStatusMessage(`Error loading analytics: ${error.message}`, true);
            });
    }

    // ------------------------------------------------------------------------
    // Exports
    // ------------------------------------------------------------------------

    // Test-only handle for exercising DOM-coupled code paths in jsdom.
    // Not part of the public API surface — prefixed with __ to signal intent.
    const __internals = {
        setAllOrders(orders) { allOrders = Array.isArray(orders) ? orders.slice() : []; },
        setFilteredOrders(orders) { filteredOrders = Array.isArray(orders) ? orders.slice() : []; },
        setEventListenersAttached(v) { eventListenersAttached = Boolean(v); },
        setInitInFlight(v) { initInFlight = v; },
        getAllOrders() { return allOrders.slice(); },
        getFilteredOrders() { return filteredOrders.slice(); },
        getItemsState() { return itemsState; },
        getBottomItemsState() { return bottomItemsState; },
        getCustomersState() { return customersState; },
        getAnalyticsCharts() { return analyticsCharts; },
        resetState() {
            allOrders = [];
            filteredOrders = [];
            previousPeriodOrders = [];
            analyticsCharts = {};
            eventListenersAttached = false;
            initInFlight = null;
            Object.assign(itemsState, { search: "", sort: "quantity", dir: "desc", page: 1, size: 10 });
            Object.assign(bottomItemsState, { search: "", sort: "quantity", dir: "asc", page: 1, size: 10 });
            Object.assign(customersState, { search: "", sort: "totalSpent", dir: "desc", page: 1, size: 10 });
        },
        updateStatusMessage,
        escapeHtml,
        setText,
        updateMetrics,
        createChart,
        createPeakHoursChart,
        createTopItemsChart,
        createRevenueTrendChart,
        createStatusDistributionChart,
        createCategoryChart,
        createWeeklyChart,
        renderItemRow,
        renderTopItemsTable,
        renderBottomItemsTable,
        renderCustomerInsightsTable,
        updatePaginationOutputs,
        renderHeatmap,
        renderComparisonPanel,
        renderComparisonCard,
        renderInsights,
        exportToCSV,
        buildExportTables,
        exportToExcel,
        exportToPDF,
        drawPdfTable,
        fetchVendorOrders,
        initializeAnalyticsDashboard,
        applyDateFilter,
        renderEverything,
        applyTimeWindowChip,
        attachEventListeners,
        attachTableControls,
        attachSectionSwitchers,
        waitForFirebaseDependencies,
        initializePage,
        resolveFirestore,
        resolveAuth,
        resolveAuthFns,
        resolveFirestoreFns
    };

    const publicApi = {
        // pure helpers
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
        generateInsights,
        __internals
    };

    if (typeof globalScope !== "undefined") {
        globalScope.vendorAnalytics = {
            ...publicApi,
            initialize: initializeAnalyticsDashboard
        };
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
