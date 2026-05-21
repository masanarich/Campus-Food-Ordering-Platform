/**
 * customer-analytics.js
 *
 * Customer analytics page (filtered to the current student).
 * Pure logic (aggregators, filters, sorters, paginators) is exported via
 * module.exports so it can be unit-tested without DOM or Firebase access.
 * DOM + Firestore wiring auto-runs only in a browser context.
 */

(function attachCustomerAnalytics(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/analytics";

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

    const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

    // ------------------------------------------------------------------------
    // Time window
    // ------------------------------------------------------------------------

    /**
     * Resolve a named time window into {start, end}.
     * Keys: "month" | "3m" | "6m" | "year" | "all".
     * `refDate` allows tests to pass a deterministic "now".
     */
    function resolveTimeWindow(key, refDate) {
        const now = refDate instanceof Date ? new Date(refDate.getTime()) : new Date();
        const end = new Date(now.getTime());
        end.setHours(23, 59, 59, 999);

        switch (key) {
            case "month":
                return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end };
            case "3m": {
                const start = new Date(now.getFullYear(), now.getMonth() - 2, 1, 0, 0, 0, 0);
                return { start, end };
            }
            case "6m": {
                const start = new Date(now.getFullYear(), now.getMonth() - 5, 1, 0, 0, 0, 0);
                return { start, end };
            }
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

    // ------------------------------------------------------------------------
    // Aggregators
    // ------------------------------------------------------------------------

    /**
     * Build monthly-spending series for the orders given.
     * Returns { keys: [{year, month}], labels: ["Jan 2026", ...], totals: [...] }.
     */
    function aggregateMonthly(orders) {
        const map = new Map();
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (!date) return;
            const key = `${date.getFullYear()}-${String(date.getMonth()).padStart(2, "0")}`;
            if (!map.has(key)) {
                map.set(key, {
                    year: date.getFullYear(),
                    month: date.getMonth(),
                    total: 0,
                    orderCount: 0
                });
            }
            const slot = map.get(key);
            slot.total += getOrderAmount(order);
            slot.orderCount++;
        });
        const rows = Array.from(map.values()).sort((a, b) =>
            a.year === b.year ? a.month - b.month : a.year - b.year);
        return {
            keys: rows.map(r => ({ year: r.year, month: r.month })),
            labels: rows.map(r => `${MONTH_NAMES[r.month]} ${r.year}`),
            totals: rows.map(r => r.total),
            orderCounts: rows.map(r => r.orderCount)
        };
    }

    /**
     * Aggregate orders by vendor. Returns array of {vendor, orders, totalSpent, lastOrder}.
     */
    function aggregateVendors(orders) {
        const map = new Map();
        orders.forEach(order => {
            const vendor = normalizeText(order.vendorName) || "Unknown";
            if (!map.has(vendor)) {
                map.set(vendor, { vendor, orders: 0, totalSpent: 0, lastOrder: null });
            }
            const row = map.get(vendor);
            row.orders++;
            row.totalSpent += getOrderAmount(order);
            const date = getDateFromTimestamp(order.createdAt);
            if (date && (!row.lastOrder || date > row.lastOrder)) row.lastOrder = date;
        });
        return Array.from(map.values());
    }

    /**
     * Aggregate the items inside orders. Returns array of {name, category, quantity, totalSpent}.
     */
    function aggregateItems(orders) {
        const map = new Map();
        orders.forEach(order => {
            (order.items || []).forEach(item => {
                const name = normalizeText(item.name) || "Unknown";
                const category = normalizeText(item.category);
                const qty = Number(item.quantity) || 1;
                const price = Number(item.price) || 0;
                if (!map.has(name)) {
                    map.set(name, { name, category, quantity: 0, totalSpent: 0 });
                }
                const row = map.get(name);
                row.quantity += qty;
                row.totalSpent += qty * price;
                if (!row.category && category) row.category = category;
            });
        });
        return Array.from(map.values());
    }

    /**
     * Counts of orders per hour (24-slot array).
     */
    function aggregateHourly(orders) {
        const counts = new Array(24).fill(0);
        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (date) counts[date.getHours()]++;
        });
        return counts;
    }

    /**
     * Aggregate by category. Returns array of {category, quantity, totalSpent}.
     * Items without a category are bucketed under "Uncategorized".
     */
    function aggregateCategories(orders) {
        const map = new Map();
        orders.forEach(order => {
            (order.items || []).forEach(item => {
                const category = normalizeText(item.category) || "Uncategorized";
                const qty = Number(item.quantity) || 1;
                const price = Number(item.price) || 0;
                if (!map.has(category)) {
                    map.set(category, { category, quantity: 0, totalSpent: 0 });
                }
                const row = map.get(category);
                row.quantity += qty;
                row.totalSpent += qty * price;
            });
        });
        return Array.from(map.values());
    }

    /**
     * Compute spend trend KPIs.
     *   - thisMonth, lastMonth: totals
     *   - monthDeltaPct, direction
     *   - avgPerWeek (over the entire history)
     *   - projectedMonth (linear projection for current month)
     */
    function computeSpendTrends(orders, refDate) {
        const now = refDate instanceof Date ? refDate : new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0);
        const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);

        let thisMonth = 0;
        let lastMonth = 0;
        let firstDate = null;
        let totalSpent = 0;

        orders.forEach(order => {
            const date = getDateFromTimestamp(order.createdAt);
            if (!date) return;
            const amt = getOrderAmount(order);
            totalSpent += amt;
            if (!firstDate || date < firstDate) firstDate = date;
            if (date >= startOfThisMonth && date <= now) thisMonth += amt;
            if (date >= startOfLastMonth && date <= endOfLastMonth) lastMonth += amt;
        });

        let monthDeltaPct = 0;
        if (lastMonth !== 0) monthDeltaPct = ((thisMonth - lastMonth) / Math.abs(lastMonth)) * 100;
        else if (thisMonth !== 0) monthDeltaPct = 100;
        let direction = "flat";
        if (thisMonth > lastMonth) direction = "up";
        else if (thisMonth < lastMonth) direction = "down";

        // Average per week over the active history
        let avgPerWeek = 0;
        if (firstDate) {
            const weeks = Math.max(1, (now - firstDate) / (1000 * 60 * 60 * 24 * 7));
            avgPerWeek = totalSpent / weeks;
        }

        // Linear projection of this-month spend based on days elapsed
        const dayOfMonth = now.getDate();
        const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
        const projectedMonth = dayOfMonth > 0
            ? (thisMonth / dayOfMonth) * daysInMonth
            : thisMonth;

        return {
            thisMonth,
            lastMonth,
            monthDeltaPct,
            direction,
            avgPerWeek,
            projectedMonth,
            totalSpent
        };
    }

    /**
     * Generate human-readable milestones from the orders.
     * Returns array of { icon, title, text }.
     */
    function computeMilestones(orders, refDate) {
        const milestones = [];
        if (orders.length === 0) return milestones;

        const now = refDate instanceof Date ? refDate : new Date();
        const startOfThisMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        const thisMonthOrders = orders.filter(o => {
            const d = getDateFromTimestamp(o.createdAt);
            return d && d >= startOfThisMonth && d <= now;
        });

        if (thisMonthOrders.length >= 1) {
            milestones.push({
                icon: "📅",
                title: `${thisMonthOrders.length} order${thisMonthOrders.length === 1 ? "" : "s"} this month`,
                text: thisMonthOrders.length >= 5
                    ? "You're a regular this month — keep it going!"
                    : "Off to a good start."
            });
        }

        const vendors = aggregateVendors(orders).sort((a, b) => b.orders - a.orders);
        if (vendors.length > 0) {
            const top = vendors[0];
            milestones.push({
                icon: "⭐",
                title: `Favourite vendor: ${top.vendor}`,
                text: `${top.orders} order${top.orders === 1 ? "" : "s"} • ${fmtRand(top.totalSpent)} spent there.`
            });
        }

        const items = aggregateItems(orders).sort((a, b) => b.quantity - a.quantity);
        if (items.length > 0 && items[0].quantity >= 3) {
            milestones.push({
                icon: "🍔",
                title: `Top item: ${items[0].name}`,
                text: `Ordered ${items[0].quantity} times.`
            });
        }

        if (orders.length >= 10) {
            milestones.push({
                icon: "🎯",
                title: `${orders.length} total orders`,
                text: "You've been busy — thanks for using Campus Eats."
            });
        }

        return milestones;
    }

    // ------------------------------------------------------------------------
    // Search / sort / paginate
    // ------------------------------------------------------------------------

    /**
     * Search the order list by vendor name OR item name (case-insensitive partial).
     */
    function searchOrders(orders, term) {
        const t = normalizeLowerText(term);
        if (!t) return orders.slice();
        return orders.filter(order => {
            if (normalizeLowerText(order.vendorName).includes(t)) return true;
            return (order.items || []).some(item => normalizeLowerText(item.name).includes(t));
        });
    }

    const ORDER_SORT_KEYS = {
        date: o => {
            const d = getDateFromTimestamp(o.createdAt);
            return d ? d.getTime() : 0;
        },
        total: o => getOrderAmount(o),
        vendor: o => normalizeLowerText(o.vendorName)
    };

    function sortOrders(orders, sortKey, direction) {
        const getter = ORDER_SORT_KEYS[sortKey];
        if (!getter) return orders.slice();
        const dir = direction === "asc" ? 1 : -1;
        const copy = orders.slice();
        copy.sort((a, b) => {
            const av = getter(a);
            const bv = getter(b);
            if (av < bv) return -1 * dir;
            if (av > bv) return 1 * dir;
            return 0;
        });
        return copy;
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

    // ========================================================================
    // BROWSER-ONLY: DOM + Firestore wiring
    // ========================================================================

    let charts = {
        spending: null,
        vendors: null,
        items: null,
        habits: null,
        categories: null
    };
    let cachedOrders = [];
    let unsubscribe = null;

    const historyState = { search: "", sort: "date", dir: "desc", page: 1, size: 10 };
    let currentWindowKey = "all";

    const COLORS = ["#f97316", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#f59e0b", "#06b6d4", "#84cc16"];

    function escapeHtml(value) {
        return String(value == null ? "" : value)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = value;
    }

    function destroyChart(name) {
        if (charts[name]) {
            charts[name].destroy();
            charts[name] = null;
        }
    }

    function getFilteredOrders() {
        return applyTimeWindow(cachedOrders, currentWindowKey);
    }

    // ------------------------------------------------------------------------
    // KPI cards
    // ------------------------------------------------------------------------

    function renderStats() {
        const orders = getFilteredOrders();
        const trends = computeSpendTrends(orders, new Date());
        const vendors = aggregateVendors(orders).sort((a, b) => b.totalSpent - a.totalSpent);
        const favouriteVendor = vendors[0]?.vendor || "—";
        const activeMonths = new Set(orders.map(o => {
            const d = getDateFromTimestamp(o.createdAt);
            return d ? `${d.getFullYear()}-${d.getMonth()}` : null;
        }).filter(Boolean)).size;

        setText("stat-total-spent", fmtRand(trends.totalSpent));
        setText("stat-total-orders", fmtNum(orders.length));
        setText("stat-fav-vendor", favouriteVendor);
        setText("stat-active-months", fmtNum(activeMonths));
        setText("stat-this-month", fmtRand(trends.thisMonth));
        setText("stat-projection", fmtRand(trends.projectedMonth));
        setText("stat-avg-week", fmtRand(trends.avgPerWeek));

        const deltaEl = document.getElementById("stat-month-delta");
        if (deltaEl) {
            const arrow = trends.direction === "up" ? "▲" : trends.direction === "down" ? "▼" : "•";
            const pct = Math.abs(trends.monthDeltaPct).toFixed(1);
            deltaEl.textContent = `${arrow} ${pct}% vs last month`;
            deltaEl.className = `stat-delta ${trends.direction}`;
        }
    }

    // ------------------------------------------------------------------------
    // Charts
    // ------------------------------------------------------------------------

    function renderSpendingChart() {
        const ctx = document.getElementById("spendingChart");
        if (!ctx || typeof Chart === "undefined") return;
        destroyChart("spending");
        const data = aggregateMonthly(getFilteredOrders());
        charts.spending = new Chart(ctx, {
            type: "bar",
            data: {
                labels: data.labels,
                datasets: [{
                    label: "Amount spent (R)",
                    data: data.totals,
                    backgroundColor: COLORS[0],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, ticks: { callback: v => "R" + v } } }
            }
        });
    }

    function renderVendorsChart() {
        const ctx = document.getElementById("vendorsChart");
        if (!ctx || typeof Chart === "undefined") return;
        destroyChart("vendors");
        const sorted = aggregateVendors(getFilteredOrders())
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 6);
        charts.vendors = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: sorted.map(x => x.vendor),
                datasets: [{ data: sorted.map(x => x.totalSpent), backgroundColor: COLORS }]
            }
        });

        const tbody = document.getElementById("vendorsTableBody");
        if (tbody) {
            tbody.innerHTML = sorted.length === 0
                ? `<tr><td colspan="4" class="loading-text">No data.</td></tr>`
                : sorted.map((v, idx) => `
                    <tr>
                      <td data-label="Rank">${idx + 1}</td>
                      <td data-label="Vendor">${escapeHtml(v.vendor)}</td>
                      <td data-label="Orders">${v.orders}</td>
                      <td data-label="Total spent">${escapeHtml(fmtRand(v.totalSpent))}</td>
                    </tr>`).join("");
        }
    }

    function renderItemsChart() {
        const ctx = document.getElementById("itemsChart");
        if (!ctx || typeof Chart === "undefined") return;
        destroyChart("items");
        const sorted = aggregateItems(getFilteredOrders())
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 6);
        charts.items = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: sorted.map(x => x.name),
                datasets: [{ data: sorted.map(x => x.quantity), backgroundColor: COLORS }]
            }
        });

        const tbody = document.getElementById("itemsTableBody");
        if (tbody) {
            tbody.innerHTML = sorted.length === 0
                ? `<tr><td colspan="3" class="loading-text">No data.</td></tr>`
                : sorted.map((item, idx) => `
                    <tr>
                      <td data-label="Rank">${idx + 1}</td>
                      <td data-label="Item">${escapeHtml(item.name)}</td>
                      <td data-label="Times ordered">${item.quantity}</td>
                    </tr>`).join("");
        }
    }

    function renderHabitsChart() {
        const ctx = document.getElementById("habitsChart");
        if (!ctx || typeof Chart === "undefined") return;
        destroyChart("habits");
        const hours = aggregateHourly(getFilteredOrders());
        const max = Math.max(...hours, 1);
        charts.habits = new Chart(ctx, {
            type: "bar",
            data: {
                labels: hours.map((_, i) => i === 0 ? "12am" : i < 12 ? `${i}am` : i === 12 ? "12pm" : `${i - 12}pm`),
                datasets: [{
                    label: "Orders",
                    data: hours,
                    backgroundColor: hours.map(v => v > max * 0.6 ? COLORS[0] : COLORS[3]),
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { beginAtZero: true, precision: 0 } }
            }
        });

        const peak = hours.indexOf(max);
        const insight = document.getElementById("habitsInsight");
        if (insight) {
            insight.textContent = hours[peak] > 0
                ? `You order most around ${peak}:00 — ${hours[peak]} order${hours[peak] === 1 ? "" : "s"} at that hour.`
                : "Not enough data yet.";
        }
    }

    function renderCategoriesChart() {
        const ctx = document.getElementById("categoriesChart");
        if (!ctx || typeof Chart === "undefined") return;
        destroyChart("categories");
        const cats = aggregateCategories(getFilteredOrders())
            .sort((a, b) => b.totalSpent - a.totalSpent);
        if (cats.length === 0) {
            const wrap = document.getElementById("categoriesWrap");
            if (wrap) wrap.innerHTML = `<p class="loading-text">No category data yet.</p>`;
            return;
        }
        charts.categories = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: cats.map(c => c.category),
                datasets: [{ data: cats.map(c => c.totalSpent), backgroundColor: COLORS }]
            }
        });
    }

    // ------------------------------------------------------------------------
    // Order history table
    // ------------------------------------------------------------------------

    function renderHistoryTable() {
        const tbody = document.getElementById("historyTableBody");
        if (!tbody) return;

        const orders = getFilteredOrders();
        const searched = searchOrders(orders, historyState.search);
        const sorted = sortOrders(searched, historyState.sort, historyState.dir);
        const result = paginate(sorted, historyState.page, historyState.size);
        historyState.page = result.page;

        if (result.total === 0) {
            tbody.innerHTML = `<tr><td colspan="5" class="loading-text">No orders match.</td></tr>`;
        } else {
            tbody.innerHTML = result.rows.map(o => {
                const date = getDateFromTimestamp(o.createdAt);
                const dateStr = date
                    ? date.toLocaleDateString("en-ZA", { year: "numeric", month: "short", day: "numeric" })
                    : "—";
                const items = (o.items || [])
                    .map(i => `${escapeHtml(i.name)}${i.quantity > 1 ? ` x${i.quantity}` : ""}`)
                    .join(", ") || "—";
                return `
                  <tr>
                    <td data-label="Date">${escapeHtml(dateStr)}</td>
                    <td data-label="Vendor">${escapeHtml(o.vendorName || "Unknown")}</td>
                    <td data-label="Items">${items}</td>
                    <td data-label="Total">${escapeHtml(fmtRand(getOrderAmount(o)))}</td>
                    <td data-label="Status"><span class="status-badge">${escapeHtml(o.status || "completed")}</span></td>
                  </tr>`;
            }).join("");
        }

        updatePaginationOutputs("history", result);
    }

    function updatePaginationOutputs(prefix, result) {
        const indicator = document.getElementById(`${prefix}-page-indicator`);
        if (indicator) {
            indicator.textContent = result.total === 0
                ? "0 results"
                : `Page ${result.page} of ${result.totalPages} • ${result.startIndex}–${result.endIndex} of ${result.total}`;
        }
        const prev = document.getElementById(`${prefix}-prev-button`);
        if (prev) prev.disabled = result.page <= 1;
        const next = document.getElementById(`${prefix}-next-button`);
        if (next) next.disabled = result.page >= result.totalPages;
    }

    // ------------------------------------------------------------------------
    // Milestones
    // ------------------------------------------------------------------------

    function renderMilestones() {
        const wrap = document.getElementById("milestonesWrap");
        if (!wrap) return;
        const milestones = computeMilestones(getFilteredOrders(), new Date());
        if (milestones.length === 0) {
            wrap.innerHTML = `<p class="loading-text">Place your first order to start earning milestones!</p>`;
            return;
        }
        wrap.innerHTML = milestones.map(m => `
            <article class="milestone-card">
                <i class="milestone-icon" aria-hidden="true">${m.icon}</i>
                <section class="milestone-text">
                    <strong>${escapeHtml(m.title)}</strong>
                    <small>${escapeHtml(m.text)}</small>
                </section>
            </article>`).join("");
    }

    // ------------------------------------------------------------------------
    // Master render
    // ------------------------------------------------------------------------

    function renderAll() {
        renderStats();
        renderSpendingChart();
        renderVendorsChart();
        renderItemsChart();
        renderHabitsChart();
        renderCategoriesChart();
        renderMilestones();
        renderHistoryTable();
    }

    function applyTimeWindowChip(key) {
        currentWindowKey = key;
        historyState.page = 1;
        document.querySelectorAll(".time-chip").forEach(btn => {
            const isActive = btn.getAttribute("data-window") === key;
            btn.classList.toggle("active", isActive);
            btn.setAttribute("aria-pressed", isActive ? "true" : "false");
        });
        renderAll();
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

    function toCsv(rows) {
        return rows.map(row => row.map(cell => {
            const value = String(cell == null ? "" : cell).replace(/"/g, '""');
            return /[",\n]/.test(value) ? `"${value}"` : value;
        }).join(",")).join("\n");
    }

    function buildExportTables() {
        const orders = getFilteredOrders();
        const trends = computeSpendTrends(orders, new Date());
        const monthly = aggregateMonthly(orders);
        const vendors = aggregateVendors(orders).sort((a, b) => b.totalSpent - a.totalSpent);
        const items = aggregateItems(orders).sort((a, b) => b.quantity - a.quantity);
        const hourly = aggregateHourly(orders);
        const cats = aggregateCategories(orders).sort((a, b) => b.totalSpent - a.totalSpent);

        const summary = [
            ["Metric", "Value"],
            ["Total spent (R)", Number(trends.totalSpent.toFixed(2))],
            ["Total orders", orders.length],
            ["This month (R)", Number(trends.thisMonth.toFixed(2))],
            ["Last month (R)", Number(trends.lastMonth.toFixed(2))],
            ["Month delta (%)", Number(trends.monthDeltaPct.toFixed(1))],
            ["Avg per week (R)", Number(trends.avgPerWeek.toFixed(2))],
            ["Projected this month (R)", Number(trends.projectedMonth.toFixed(2))]
        ];

        const ordersSheet = [
            ["Date", "Vendor", "Items", "Total (R)", "Status"],
            ...orders.map(o => {
                const d = getDateFromTimestamp(o.createdAt);
                const items = (o.items || [])
                    .map(i => `${i.name}${i.quantity > 1 ? ` x${i.quantity}` : ""}`).join("; ");
                return [
                    d ? d.toISOString().split("T")[0] : "",
                    o.vendorName || "Unknown",
                    items,
                    Number(getOrderAmount(o).toFixed(2)),
                    o.status || "completed"
                ];
            })
        ];

        const vendorSheet = [
            ["Rank", "Vendor", "Orders", "Total spent (R)"],
            ...vendors.map((v, i) => [i + 1, v.vendor, v.orders, Number(v.totalSpent.toFixed(2))])
        ];

        const itemSheet = [
            ["Rank", "Item", "Category", "Times ordered", "Total spent (R)"],
            ...items.map((it, i) => [i + 1, it.name, it.category, it.quantity, Number(it.totalSpent.toFixed(2))])
        ];

        const monthlySheet = [
            ["Month", "Total spent (R)", "Order count"],
            ...monthly.labels.map((label, i) => [label, Number(monthly.totals[i].toFixed(2)), monthly.orderCounts[i]])
        ];

        const habitsSheet = [
            ["Hour", "Orders"],
            ...hourly.map((count, h) => [`${h}:00`, count])
        ];

        const categorySheet = [
            ["Category", "Times ordered", "Total spent (R)"],
            ...cats.map(c => [c.category, c.quantity, Number(c.totalSpent.toFixed(2))])
        ];

        return { summary, ordersSheet, vendorSheet, itemSheet, monthlySheet, habitsSheet, categorySheet };
    }

    function exportCSV() {
        if (cachedOrders.length === 0) { alert("No data to export."); return; }
        const tables = buildExportTables();
        // Glue all sections into one CSV separated by a blank row
        const all = [
            ["Campus Eats — My Analytics"],
            ["Exported", new Date().toLocaleString()],
            [],
            ["SUMMARY"], ...tables.summary, [],
            ["MONTHLY SPENDING"], ...tables.monthlySheet, [],
            ["FAVOURITE VENDORS"], ...tables.vendorSheet, [],
            ["MOST ORDERED ITEMS"], ...tables.itemSheet, [],
            ["ORDERING HABITS (HOURLY)"], ...tables.habitsSheet, [],
            ["CATEGORIES"], ...tables.categorySheet, [],
            ["ORDER HISTORY"], ...tables.ordersSheet
        ];
        downloadBlob(new Blob([toCsv(all)], { type: "text/csv;charset=utf-8;" }),
            `my-analytics-${new Date().toISOString().split("T")[0]}.csv`);
    }

    function exportExcel() {
        if (typeof XLSX === "undefined") { alert("Excel library not loaded."); return; }
        if (cachedOrders.length === 0) { alert("No data to export."); return; }
        const t = buildExportTables();
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.summary), "Summary");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.monthlySheet), "Monthly");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.vendorSheet), "Vendors");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.itemSheet), "Items");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.habitsSheet), "Habits");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.categorySheet), "Categories");
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(t.ordersSheet), "Orders");
        XLSX.writeFile(wb, `my-analytics-${new Date().toISOString().split("T")[0]}.xlsx`);
    }

    function drawPdfTable(doc, headers, rows, startY, widths) {
        const pageWidth = doc.internal.pageSize.getWidth();
        const pageHeight = doc.internal.pageSize.getHeight();
        const margin = 14;
        const usable = pageWidth - margin * 2;
        const colWidths = widths || headers.map(() => usable / headers.length);
        const rowH = 7;
        let y = startY;
        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        let x = margin;
        headers.forEach((h, i) => {
            doc.rect(x, y, colWidths[i], rowH);
            doc.text(String(h), x + 1.5, y + 5);
            x += colWidths[i];
        });
        y += rowH;
        doc.setFont("helvetica", "normal");
        rows.forEach(row => {
            if (y + rowH > pageHeight - margin) { doc.addPage(); y = margin; }
            x = margin;
            row.forEach((cell, i) => {
                doc.rect(x, y, colWidths[i], rowH);
                const text = String(cell == null ? "" : cell);
                const maxChars = Math.floor(colWidths[i] / 1.7);
                const clipped = text.length > maxChars ? text.substring(0, maxChars - 1) + "…" : text;
                doc.text(clipped, x + 1.5, y + 5);
                x += colWidths[i];
            });
            y += rowH;
        });
        return y;
    }

    function exportPDF() {
        if (typeof window === "undefined" || !window.jspdf || !window.jspdf.jsPDF) {
            alert("PDF library not loaded.");
            return;
        }
        if (cachedOrders.length === 0) { alert("No data to export."); return; }
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        const t = buildExportTables();
        const pageWidth = doc.internal.pageSize.getWidth();

        doc.setFont("helvetica", "bold"); doc.setFontSize(18);
        doc.text("My Analytics", 14, 18);
        doc.setFont("helvetica", "normal"); doc.setFontSize(10); doc.setTextColor(110);
        doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 25);
        doc.setTextColor(0);

        let y = 35;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Summary", 14, y); y += 5;
        y = drawPdfTable(doc, t.summary[0], t.summary.slice(1), y, [80, pageWidth - 14 - 14 - 80]);

        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Monthly spending", 14, y); y += 5;
        y = drawPdfTable(doc, t.monthlySheet[0], t.monthlySheet.slice(1), y, [70, 60, 52]);

        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Favourite vendors", 14, y); y += 5;
        y = drawPdfTable(doc, t.vendorSheet[0], t.vendorSheet.slice(1), y, [20, 80, 30, 52]);

        y += 6;
        if (y > 240) { doc.addPage(); y = 20; }
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Most ordered items", 14, y); y += 5;
        y = drawPdfTable(doc, t.itemSheet[0], t.itemSheet.slice(1), y, [16, 70, 40, 28, 28]);

        doc.addPage();
        y = 20;
        doc.setFont("helvetica", "bold"); doc.setFontSize(12);
        doc.text("Order history", 14, y); y += 5;
        y = drawPdfTable(doc, t.ordersSheet[0], t.ordersSheet.slice(1), y, [28, 50, 60, 24, 20]);

        doc.save(`my-analytics-${new Date().toISOString().split("T")[0]}.pdf`);
    }

    // ------------------------------------------------------------------------
    // Wiring
    // ------------------------------------------------------------------------

    let listenersAttached = false;

    function attachEventListeners() {
        if (listenersAttached) return;

        document.querySelectorAll(".time-chip").forEach(btn => {
            btn.addEventListener("click", () => applyTimeWindowChip(btn.getAttribute("data-window")));
        });

        document.getElementById("history-search")?.addEventListener("input", e => {
            historyState.search = e.target.value;
            historyState.page = 1;
            renderHistoryTable();
        });
        document.getElementById("history-sort")?.addEventListener("change", e => {
            const [sort, dir] = (e.target.value || "").split(":");
            if (sort) historyState.sort = sort;
            if (dir) historyState.dir = dir;
            historyState.page = 1;
            renderHistoryTable();
        });
        document.getElementById("history-page-size")?.addEventListener("change", e => {
            historyState.size = parseInt(e.target.value, 10) || 10;
            historyState.page = 1;
            renderHistoryTable();
        });
        document.getElementById("history-prev-button")?.addEventListener("click", () => {
            if (historyState.page > 1) { historyState.page--; renderHistoryTable(); }
        });
        document.getElementById("history-next-button")?.addEventListener("click", () => {
            historyState.page++;
            renderHistoryTable();
        });

        document.getElementById("exportCsvBtn")?.addEventListener("click", exportCSV);
        document.getElementById("exportExcelBtn")?.addEventListener("click", exportExcel);
        document.getElementById("exportPdfBtn")?.addEventListener("click", exportPDF);

        listenersAttached = true;
    }

    // ------------------------------------------------------------------------
    // Firestore real-time stream
    // ------------------------------------------------------------------------

    function startLifecycle(deps) {
        const { auth, db, firestoreFns, authFns } = deps;
        const { onAuthStateChanged } = authFns;
        const { collection, query, where, onSnapshot } = firestoreFns;

        onAuthStateChanged(auth, user => {
            if (!user) {
                window.location.href = "../../authentication/login.html";
                return;
            }

            attachEventListeners();

            const q = query(
                collection(db, "orders"),
                where("customerUid", "==", user.uid),
                where("status", "==", "completed")
            );

            if (unsubscribe) unsubscribe();
            unsubscribe = onSnapshot(q, snapshot => {
                const orders = snapshot.docs.map(doc => {
                    const data = doc.data();
                    return {
                        ...data,
                        createdAt: getDateFromTimestamp(data.createdAt)
                    };
                }).sort((a, b) => {
                    const ad = a.createdAt ? a.createdAt.getTime() : 0;
                    const bd = b.createdAt ? b.createdAt.getTime() : 0;
                    return bd - ad;
                });
                cachedOrders = orders;
                renderAll();
            }, err => {
                console.error(`[${MODULE_NAME}] snapshot error:`, err);
            });
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
        const start = () => startLifecycle({
            db: globalScope.db,
            auth: globalScope.auth,
            authFns: globalScope.authFns,
            firestoreFns: globalScope.firestoreFns
        });
        if (globalScope.db && globalScope.auth && globalScope.authFns && globalScope.firestoreFns) {
            start();
            return;
        }
        waitForFirebaseDependencies()
            .then(start)
            .catch(err => console.error(`[${MODULE_NAME}] dep wait error:`, err));
    }

    // ========================================================================
    // PUBLIC API
    // ========================================================================

    const publicApi = {
        normalizeText,
        normalizeLowerText,
        getDateFromTimestamp,
        getOrderAmount,
        fmtRand,
        fmtNum,
        resolveTimeWindow,
        applyTimeWindow,
        filterOrdersByDateRange,
        aggregateMonthly,
        aggregateVendors,
        aggregateItems,
        aggregateHourly,
        aggregateCategories,
        computeSpendTrends,
        computeMilestones,
        searchOrders,
        sortOrders,
        paginate
    };

    if (typeof globalScope !== "undefined") {
        globalScope.customerAnalytics = { ...publicApi, initialize: initializePage };
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
