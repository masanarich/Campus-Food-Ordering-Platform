/**
 * vendor/analytics.js
 *
 * Vendor analytics dashboard functionality.
 * Features:
 * - Displays key performance indicators (KPIs)
 * - Interactive charts for peak hours, top items, revenue trends
 * - Date filtering for custom date ranges
 * - CSV export functionality
 * - AI-powered insights and recommendations
 * - Ensures vendor can only see their own data
 */

(function attachVendorAnalyticsDashboard(globalScope) {
    "use strict";

    const MODULE_NAME = "vendor/analytics";
    let initInFlight = null;
    let currentVendorUid = null;
    let allOrders = [];
    let filteredOrders = [];
    let analyticsCharts = {};

    // ========================================================================
    // Helper Functions
    // ========================================================================

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

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

    function formatCurrency(amount) {
        return new Intl.NumberFormat("en-ZA", {
            style: "currency",
            currency: "ZAR"
        }).format(amount);
    }

    function formatDate(date) {
        if (!date) return "N/A";
        if (date instanceof Date) return date.toISOString().split("T")[0];
        if (typeof date === "string") return date.split("T")[0];
        if (date.toDate) return date.toDate().toISOString().split("T")[0];
        return "N/A";
    }

    function getDateFromTimestamp(timestamp) {
        if (!timestamp) return null;
        if (timestamp instanceof Date) return timestamp;
        if (typeof timestamp === "string") return new Date(timestamp);
        if (timestamp.toDate) return timestamp.toDate();
        return null;
    }

    // ========================================================================
    // Order Filtering & Analytics Calculation
    // ========================================================================

    function getHourFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        if (!date) return null;
        return date.getHours();
    }

    function getDayFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        if (!date) return null;
        return date.toISOString().split("T")[0];
    }

    function getWeekFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        if (!date) return null;
        
        const d = new Date(date);
        const dayNum = d.getUTCDay() || 7;
        d.setUTCDate(d.getUTCDate() + 4 - dayNum);
        const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 4));
        return Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    }

    function filterOrdersByDateRange(orders, startDate, endDate) {
        if (!startDate && !endDate) return orders;

        return orders.filter(order => {
            const orderDate = getDateFromTimestamp(order.createdAt);
            if (!orderDate) return false;

            if (startDate && orderDate < startDate) return false;
            if (endDate && orderDate > endDate) return false;

            return true;
        });
    }

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
            // Total revenue and orders
            const amount = order.paymentAmount || order.totalAmount || 0;
            analytics.totalRevenue += amount;
            analytics.totalOrders++;

            // Count completed orders
            if (order.status === "completed") {
                analytics.completedOrders++;
            }

            // Count order status
            const status = order.status || "unknown";
            analytics.ordersByStatus[status] = (analytics.ordersByStatus[status] || 0) + 1;

            // Peak hours analysis
            const hour = getHourFromTimestamp(order.createdAt);
            if (hour !== null) {
                analytics.peakHours[hour] = (analytics.peakHours[hour] || 0) + 1;
            }

            // Daily breakdown
            const day = getDayFromTimestamp(order.createdAt);
            if (day) {
                analytics.ordersByDay[day] = (analytics.ordersByDay[day] || 0) + (order.paymentAmount || 0);
            }

            // Weekly breakdown
            const week = getWeekFromTimestamp(order.createdAt);
            if (week) {
                analytics.ordersByWeek[week] = (analytics.ordersByWeek[week] || 0) + (order.paymentAmount || 0);
            }

            // Process items in order
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemKey = normalizeText(item.menuItemId || item.name);
                    const quantity = item.quantity || 0;
                    const price = item.price || 0;
                    const revenue = quantity * price;

                    analytics.totalItems += quantity;

                    // Top items
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

                    // Category performance
                    const category = normalizeText(item.category);
                    if (!analytics.itemsByCategory[category]) {
                        analytics.itemsByCategory[category] = {
                            revenue: 0,
                            quantity: 0
                        };
                    }
                    analytics.itemsByCategory[category].revenue += revenue;
                    analytics.itemsByCategory[category].quantity += quantity;
                });
            }
        });

        // Calculate average prices
        Object.keys(analytics.topItems).forEach(itemKey => {
            const item = analytics.topItems[itemKey];
            item.avgPrice = item.quantity > 0 ? Math.round(item.revenue / item.quantity) : 0;
        });

        return analytics;
    }

    // ========================================================================
    // DOM Update Functions
    // ========================================================================

    function updateMetrics(analytics) {
        const totalOrders = analytics.totalOrders;
        const completedOrders = analytics.completedOrders;
        const avgOrderValue = totalOrders > 0 ? analytics.totalRevenue / totalOrders : 0;
        const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;
        const avgItemsPerOrder = totalOrders > 0 ? Math.round(analytics.totalItems / totalOrders) : 0;

        document.getElementById("total-revenue").textContent = formatCurrency(analytics.totalRevenue);
        document.getElementById("total-orders").textContent = totalOrders.toString();
        document.getElementById("avg-order-value").textContent = formatCurrency(avgOrderValue);
        document.getElementById("completion-rate").textContent = `${completionRate}%`;
        document.getElementById("total-items-sold").textContent = analytics.totalItems.toString();
        document.getElementById("avg-items-per-order").textContent = avgItemsPerOrder.toString();
    }

    // ========================================================================
    // Chart Creation Functions
    // ========================================================================

    function createChart(canvasId, type, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        // Destroy existing chart if it exists
        if (analyticsCharts[canvasId]) {
            analyticsCharts[canvasId].destroy();
        }

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: "top"
                }
            }
        };

        const mergedOptions = { ...defaultOptions, ...options };

        const chart = new Chart(ctx, {
            type,
            data,
            options: mergedOptions
        });

        analyticsCharts[canvasId] = chart;
        return chart;
    }

    function createPeakHoursChart(analytics) {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const data = hours.map(h => analytics.peakHours[h] || 0);

        const chartData = {
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
        };

        createChart("peak-hours-chart", "line", chartData, {
            plugins: {
                legend: { display: true }
            }
        });
    }

    function createTopItemsChart(analytics) {
        const sorted = Object.values(analytics.topItems)
            .sort((a, b) => b.quantity - a.quantity)
            .slice(0, 10);

        const chartData = {
            labels: sorted.map(item => item.name.substring(0, 20)),
            datasets: [{
                label: "Quantity Sold",
                data: sorted.map(item => item.quantity),
                backgroundColor: [
                    "#c56a1a",
                    "#9f4d0d",
                    "#6a8468",
                    "#e3a857",
                    "#d4874c",
                    "#a85c38",
                    "#815a2b",
                    "#b8956e",
                    "#9a7e72",
                    "#d7a5a5"
                ],
                borderColor: "#fff",
                borderWidth: 2
            }]
        };

        createChart("top-items-chart", "doughnut", chartData);
    }

    function createRevenueTrendChart(analytics) {
        const days = Object.keys(analytics.ordersByDay).sort();
        const revenues = days.map(day => (analytics.ordersByDay[day] || 0) / 100);

        const chartData = {
            labels: days.map(day => new Date(day).toLocaleDateString("en-ZA", { month: "short", day: "numeric" })),
            datasets: [{
                label: "Daily Revenue (ZAR 100s)",
                data: revenues,
                borderColor: "#c56a1a",
                backgroundColor: "rgba(197, 106, 26, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 4,
                pointBackgroundColor: "#c56a1a"
            }]
        };

        createChart("revenue-trend-chart", "line", chartData);
    }

    function createStatusDistributionChart(analytics) {
        const chartData = {
            labels: Object.keys(analytics.ordersByStatus).map(s => s.charAt(0).toUpperCase() + s.slice(1)),
            datasets: [{
                data: Object.values(analytics.ordersByStatus),
                backgroundColor: [
                    "#6a8468",
                    "#c56a1a",
                    "#d7a5a5",
                    "#b8956e",
                    "#9a7e72"
                ],
                borderColor: "#fff",
                borderWidth: 2
            }]
        };

        createChart("status-distribution-chart", "pie", chartData);
    }

    function createCategoryChart(analytics) {
        const sorted = Object.entries(analytics.itemsByCategory)
            .map(([category, data]) => ({ category, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 8);

        const chartData = {
            labels: sorted.map(item => item.category || "Uncategorized"),
            datasets: [{
                label: "Revenue (ZAR 100s)",
                data: sorted.map(item => item.revenue / 100),
                backgroundColor: "rgba(106, 132, 104, 0.7)",
                borderColor: "#6a8468",
                borderWidth: 2
            }]
        };

        createChart("category-chart", "bar", chartData);
    }

    function createWeeklyChart(analytics) {
        const weeks = Object.keys(analytics.ordersByWeek).sort((a, b) => a - b);
        const revenues = weeks.map(week => (analytics.ordersByWeek[week] || 0) / 100);

        const chartData = {
            labels: weeks.map(week => `Week ${week}`),
            datasets: [{
                label: "Weekly Revenue (ZAR 100s)",
                data: revenues,
                borderColor: "#6a8468",
                backgroundColor: "rgba(106, 132, 104, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        };

        createChart("weekly-chart", "line", chartData);
    }

    // ========================================================================
    // Table Update Functions
    // ========================================================================

    function updateItemsTables(analytics) {
        const sorted = Object.values(analytics.topItems)
            .sort((a, b) => b.quantity - a.quantity);

        const topItems = sorted.slice(0, 10);
        const bottomItems = sorted.reverse().slice(0, 10).reverse();

        // Top items table
        const topTable = document.getElementById("top-items-table");
        if (topTable) {
            const tbody = topTable.querySelector("tbody");
            tbody.innerHTML = topItems.map((item, index) => `
                <tr>
                    <td><span class="rank-badge">#${index + 1}</span></td>
                    <td>${item.name}</td>
                    <td>${item.category}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.revenue)}</td>
                    <td>${formatCurrency(item.avgPrice)}</td>
                </tr>
            `).join("") || `<tr><td colspan="6" class="loading-message">No items sold in this period.</td></tr>`;
        }

        // Bottom items table
        const bottomTable = document.getElementById("bottom-items-table");
        if (bottomTable) {
            const tbody = bottomTable.querySelector("tbody");
            tbody.innerHTML = bottomItems.length > 0 ? bottomItems.map((item, index) => `
                <tr>
                    <td><span class="rank-badge">#${index + 1}</span></td>
                    <td>${item.name}</td>
                    <td>${item.category}</td>
                    <td>${item.quantity}</td>
                    <td>${formatCurrency(item.revenue)}</td>
                    <td>${formatCurrency(item.avgPrice)}</td>
                </tr>
            `).join("") : `<tr><td colspan="6" class="loading-message">No underperforming items found.</td></tr>`;
        }
    }

    // ========================================================================
    // Insights Generation
    // ========================================================================

    function generateInsights(analytics, filteredOrders) {
        const insights = [];
        const totalOrders = analytics.totalOrders;
        const completionRate = totalOrders > 0 ? (analytics.completedOrders / totalOrders) * 100 : 0;
        const avgOrderValue = totalOrders > 0 ? analytics.totalRevenue / totalOrders : 0;

        // Peak hour insight
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

        // Top performer
        if (Object.keys(analytics.topItems).length > 0) {
            const topItem = Object.values(analytics.topItems)
                .reduce((max, item) => item.quantity > max.quantity ? item : max);
            insights.push({
                icon: "⭐",
                title: "Best Seller",
                text: `"${topItem.name}" is your top performer with ${topItem.quantity} units sold (${formatCurrency(topItem.revenue)} revenue). Keep this well-stocked!`,
                type: "success"
            });
        }

        // Completion rate insight
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

        // Revenue trend
        if (analytics.totalRevenue > 0) {
            const avgDaily = Object.values(analytics.ordersByDay).length > 0
                ? analytics.totalRevenue / Object.values(analytics.ordersByDay).length
                : 0;
            insights.push({
                icon: "💰",
                title: "Revenue Overview",
                text: `Total revenue: ${formatCurrency(analytics.totalRevenue)} | Average order value: ${formatCurrency(avgOrderValue)} | Average daily revenue: ${formatCurrency(avgDaily)}`,
                type: "info"
            });
        }

        // Category performance
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

        // Menu optimization
        const underperformers = Object.values(analytics.topItems)
            .filter(item => item.quantity < 3 && item.quantity > 0);
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
            <div class="insight-card ${insight.type}">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-content">
                    <div class="insight-title">${insight.title}</div>
                    <div class="insight-text">${insight.text}</div>
                </div>
            </div>
        `).join("");
    }

    // ========================================================================
    // Export Functions
    // ========================================================================

    function exportToCSV(analytics, filteredOrders) {
        const rows = [];
        rows.push(["Campus Food Ordering Platform - Vendor Analytics Export"]);
        rows.push(["Export Date", new Date().toLocaleString()]);
        rows.push([]);

        // Summary metrics
        rows.push(["SUMMARY METRICS"]);
        rows.push(["Metric", "Value"]);
        rows.push(["Total Revenue", formatCurrency(analytics.totalRevenue)]);
        rows.push(["Total Orders", analytics.totalOrders]);
        rows.push(["Completed Orders", analytics.completedOrders]);
        rows.push(["Completion Rate", `${analytics.totalOrders > 0 ? Math.round((analytics.completedOrders / analytics.totalOrders) * 100) : 0}%`]);
        rows.push(["Total Items Sold", analytics.totalItems]);
        rows.push([]);

        // Peak hours
        rows.push(["PEAK HOURS ANALYSIS"]);
        rows.push(["Hour", "Orders"]);
        Object.entries(analytics.peakHours)
            .sort((a, b) => b[1] - a[1])
            .forEach(([hour, count]) => {
                rows.push([`${hour}:00`, count]);
            });
        rows.push([]);

        // Top items
        rows.push(["TOP SELLING ITEMS"]);
        rows.push(["Item Name", "Category", "Quantity Sold", "Revenue", "Average Price"]);
        Object.values(analytics.topItems)
            .sort((a, b) => b.quantity - a.quantity)
            .forEach(item => {
                rows.push([
                    item.name,
                    item.category,
                    item.quantity,
                    formatCurrency(item.revenue),
                    formatCurrency(item.avgPrice)
                ]);
            });
        rows.push([]);

        // Daily breakdown
        rows.push(["DAILY BREAKDOWN"]);
        rows.push(["Date", "Revenue"]);
        Object.entries(analytics.ordersByDay)
            .sort()
            .forEach(([day, revenue]) => {
                rows.push([day, formatCurrency(revenue)]);
            });
        rows.push([]);

        // Category performance
        rows.push(["CATEGORY PERFORMANCE"]);
        rows.push(["Category", "Revenue", "Items Sold"]);
        Object.entries(analytics.itemsByCategory)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([category, data]) => {
                rows.push([
                    category,
                    formatCurrency(data.revenue),
                    data.quantity
                ]);
            });

        // Convert to CSV
        const csv = rows.map(row => row.map(cell => {
            const value = String(cell).replace(/"/g, '""');
            return value.includes(",") || value.includes("\n") || value.includes("\"") ? `"${value}"` : value;
        }).join(",")).join("\n");

        // Download
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

    // ========================================================================
    // Data Fetching
    // ========================================================================

    async function fetchVendorOrders(db, firestoreFns, vendorUid) {
        if (!db || !firestoreFns || !vendorUid) {
            throw new Error("Missing required dependencies for order fetching");
        }

        const { collection, query, where, getDocs } = firestoreFns;

        try {
            const ordersRef = collection(db, "orders");
            const q = query(ordersRef, where("vendorUid", "==", vendorUid));
            const snapshot = await getDocs(q);

            const orders = [];
            snapshot.forEach(doc => {
                const data = doc.data();
                orders.push({
                    id: doc.id,
                    ...data
                });
            });

            return orders;
        } catch (error) {
            console.error("Error fetching vendor orders:", error);
            throw error;
        }
    }

    // ========================================================================
    // Initialization
    // ========================================================================

    async function initializeAnalyticsDashboard(options = {}) {
        if (initInFlight) {
            return initInFlight;
        }

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

                // Wait for auth state
                await new Promise((resolve, reject) => {
                    onAuthStateChanged(auth, (user) => {
                        if (user) {
                            currentVendorUid = user.uid;
                            resolve();
                        } else {
                            window.location.href = "../authentication/login.html";
                            reject(new Error("User not authenticated"));
                        }
                    });
                });

                // Fetch orders
                allOrders = await fetchVendorOrders(db, firestoreFns, currentVendorUid);

                // Set default date range (last 30 days)
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 30);

                document.getElementById("start-date-input").value = startDate.toISOString().split("T")[0];
                document.getElementById("end-date-input").value = endDate.toISOString().split("T")[0];

                // Initial load
                await applyDateFilter();

                // Attach event listeners
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
        const startDateStr = document.getElementById("start-date-input").value;
        const endDateStr = document.getElementById("end-date-input").value;

        const startDate = startDateStr ? new Date(startDateStr) : null;
        const endDate = endDateStr ? new Date(endDateStr) : null;

        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        filteredOrders = filterOrdersByDateRange(allOrders, startDate, endDate);
        const analytics = calculateAnalytics(filteredOrders);

        // Update all visualizations
        updateMetrics(analytics);
        createPeakHoursChart(analytics);
        createTopItemsChart(analytics);
        createRevenueTrendChart(analytics);
        createStatusDistributionChart(analytics);
        createCategoryChart(analytics);
        createWeeklyChart(analytics);
        updateItemsTables(analytics);

        const insights = generateInsights(analytics, filteredOrders);
        renderInsights(insights);

        const dateRange = startDateStr && endDateStr
            ? ` (${startDateStr} to ${endDateStr})`
            : " (All time)";
        updateStatusMessage(`Showing analytics for ${filteredOrders.length} orders${dateRange}`, false);
    }

    function attachEventListeners() {
        const applyFilterBtn = document.getElementById("apply-filter-button");
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener("click", () => {
                applyDateFilter();
            });
        }

        const resetFilterBtn = document.getElementById("reset-filter-button");
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener("click", () => {
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setDate(startDate.getDate() - 30);

                document.getElementById("start-date-input").value = startDate.toISOString().split("T")[0];
                document.getElementById("end-date-input").value = endDate.toISOString().split("T")[0];

                applyDateFilter();
            });
        }

        const exportBtn = document.getElementById("export-csv-button");
        if (exportBtn) {
            exportBtn.addEventListener("click", () => {
                if (filteredOrders.length === 0) {
                    updateStatusMessage("No data to export", true);
                    return;
                }
                const analytics = calculateAnalytics(filteredOrders);
                exportToCSV(analytics, filteredOrders);
            });
        }

        const refreshBtn = document.getElementById("refresh-data-button");
        if (refreshBtn) {
            refreshBtn.addEventListener("click", () => {
                initializeAnalyticsDashboard({
                    db: resolveFirestore(),
                    auth: resolveAuth(),
                    authFns: resolveAuthFns(),
                    firestoreFns: resolveFirestoreFns()
                });
            });
        }

        // Add section switching functionality
        attachSectionSwitchers();
    }

    function attachSectionSwitchers() {
        const menuItems = document.querySelectorAll(".menu-item");
        
        menuItems.forEach(item => {
            item.addEventListener("click", () => {
                const sectionName = item.getAttribute("data-section");
                if (!sectionName) return;

                // Remove active class from all items and sections
                menuItems.forEach(m => m.classList.remove("active"));
                const sections = document.querySelectorAll(".content-section");
                sections.forEach(s => s.classList.remove("active"));

                // Add active class to clicked item and corresponding section
                item.classList.add("active");
                const targetSection = document.getElementById(`${sectionName}-section`);
                if (targetSection) {
                    targetSection.classList.add("active");
                }
            });
        });
    }

    // ========================================================================
    // Module Exports
    // ========================================================================

    globalScope.vendorAnalytics = {
        initialize: initializeAnalyticsDashboard
    };

    // Auto-initialize on page load and attach sidebar controls early
    function initializePage() {
        attachSectionSwitchers();
        initializeAnalyticsDashboard({
            db: globalScope.db,
            auth: globalScope.auth,
            authFns: globalScope.authFns,
            firestoreFns: globalScope.firestoreFns
        });
    }

    function waitForFirebaseDependencies(timeoutMs = 5000) {
        return new Promise((resolve, reject) => {
            const start = Date.now();

            const checkDependencies = () => {
                if (
                    globalScope.db &&
                    globalScope.auth &&
                    globalScope.authFns &&
                    globalScope.firestoreFns
                ) {
                    resolve();
                    return;
                }

                if (Date.now() - start >= timeoutMs) {
                    reject(new Error("Timed out waiting for Firebase dependencies"));
                    return;
                }

                setTimeout(checkDependencies, 100);
            };

            checkDependencies();
        });
    }

    async function initializePage() {
        attachSectionSwitchers();

        try {
            await waitForFirebaseDependencies();
            await initializeAnalyticsDashboard({
                db: globalScope.db,
                auth: globalScope.auth,
                authFns: globalScope.authFns,
                firestoreFns: globalScope.firestoreFns
            });
        } catch (error) {
            console.error(`${MODULE_NAME} initialization error:`, error);
            updateStatusMessage(`Error loading analytics: ${error.message}`, true);
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializePage);
    } else {
        initializePage();
    }

})(typeof window !== "undefined" ? window : global);
