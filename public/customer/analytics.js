/**
 * customer/analytics.js
 *
 * Customer analytics dashboard functionality.
 * Features:
 * - Displays customer spending metrics and trends
 * - Interactive charts for spending patterns, vendor preferences, and favorite items
 * - Date filtering for custom date ranges
 * - CSV export functionality
 * - Personalized insights and recommendations
 * - Ensures customer can only see their own data
 */

(function attachCustomerAnalyticsDashboard(globalScope) {
    "use strict";

    const MODULE_NAME = "customer/analytics";
    let initInFlight = null;
    let currentCustomerUid = null;
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

    function getMonthFromTimestamp(timestamp) {
        const date = getDateFromTimestamp(timestamp);
        if (!date) return null;
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, "0");
        return `${year}-${month}`;
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

    function calculateCustomerAnalytics(orders) {
        const analytics = {
            totalSpent: 0,
            totalOrders: 0,
            completedOrders: 0,
            totalItems: 0,
            ordersByMonth: {},
            vendorSpending: {},
            itemFrequency: {},
            ordersByHour: {},
            categorySpending: {},
            recentOrders: []
        };

        orders.forEach(order => {
            // Total spending and orders
            const amount = order.paymentAmount || order.totalAmount || 0;
            analytics.totalSpent += amount;
            analytics.totalOrders++;

            if (order.status === "completed") {
                analytics.completedOrders++;
            }

            // Monthly breakdown
            const month = getMonthFromTimestamp(order.createdAt);
            if (month) {
                analytics.ordersByMonth[month] = (analytics.ordersByMonth[month] || 0) + amount;
            }

            // Order frequency by hour
            const hour = getHourFromTimestamp(order.createdAt);
            if (hour !== null) {
                analytics.ordersByHour[hour] = (analytics.ordersByHour[hour] || 0) + 1;
            }

            // Vendor spending
            const vendorName = normalizeText(order.vendorName);
            if (vendorName) {
                if (!analytics.vendorSpending[vendorName]) {
                    analytics.vendorSpending[vendorName] = {
                        name: vendorName,
                        uid: order.vendorUid,
                        spending: 0,
                        orders: 0,
                        lastOrder: order.createdAt,
                        items: []
                    };
                }
                analytics.vendorSpending[vendorName].spending += amount;
                analytics.vendorSpending[vendorName].orders++;
                analytics.vendorSpending[vendorName].lastOrder = order.createdAt;
            }

            // Process items
            if (Array.isArray(order.items)) {
                order.items.forEach(item => {
                    const itemKey = normalizeText(item.menuItemId || item.name);
                    const quantity = item.quantity || 0;
                    const price = item.price || 0;
                    const revenue = quantity * price;

                    analytics.totalItems += quantity;

                    // Item frequency
                    if (!analytics.itemFrequency[itemKey]) {
                        analytics.itemFrequency[itemKey] = {
                            name: normalizeText(item.name),
                            vendor: vendorName,
                            category: normalizeText(item.category),
                            timesOrdered: 0,
                            totalSpent: 0,
                            avgPrice: 0
                        };
                    }

                    analytics.itemFrequency[itemKey].timesOrdered += quantity;
                    analytics.itemFrequency[itemKey].totalSpent += revenue;
                    analytics.itemFrequency[itemKey].avgPrice = 
                        Math.round(analytics.itemFrequency[itemKey].totalSpent / 
                                  analytics.itemFrequency[itemKey].timesOrdered);

                    // Category spending
                    const category = normalizeText(item.category);
                    if (!analytics.categorySpending[category]) {
                        analytics.categorySpending[category] = {
                            revenue: 0,
                            items: 0
                        };
                    }
                    analytics.categorySpending[category].revenue += revenue;
                    analytics.categorySpending[category].items += quantity;
                });
            }

            // Add to recent orders
            analytics.recentOrders.push({
                id: order.id,
                vendor: vendorName,
                amount,
                status: order.status,
                date: order.createdAt,
                itemCount: order.itemCount || (Array.isArray(order.items) ? order.items.length : 0),
                items: Array.isArray(order.items) ? order.items.map(i => i.name).join(", ") : ""
            });
        });

        // Sort recent orders by date (newest first)
        analytics.recentOrders.sort((a, b) => {
            const dateA = getDateFromTimestamp(a.date);
            const dateB = getDateFromTimestamp(b.date);
            return dateB - dateA;
        });

        return analytics;
    }

    // ========================================================================
    // DOM Update Functions
    // ========================================================================

    function updateMetrics(analytics) {
        const totalOrders = analytics.totalOrders;
        const avgOrderValue = totalOrders > 0 ? analytics.totalSpent / totalOrders : 0;
        const avgItemsPerOrder = totalOrders > 0 ? Math.round(analytics.totalItems / totalOrders) : 0;

        // Find favorite vendor (highest spending)
        const vendors = Object.values(analytics.vendorSpending);
        const favoriteVendor = vendors.reduce((max, v) => v.spending > max.spending ? v : max, 
                                              vendors.length > 0 ? vendors[0] : null);
        
        // Find most used vendor (most orders)
        const mostUsedVendor = vendors.reduce((max, v) => v.orders > max.orders ? v : max,
                                              vendors.length > 0 ? vendors[0] : null);

        document.getElementById("total-spent").textContent = formatCurrency(analytics.totalSpent);
        document.getElementById("total-orders").textContent = totalOrders.toString();
        document.getElementById("avg-order-value").textContent = formatCurrency(avgOrderValue);
        document.getElementById("total-items").textContent = analytics.totalItems.toString();

        if (favoriteVendor) {
            document.getElementById("favorite-vendor").textContent = favoriteVendor.name.substring(0, 20);
            document.getElementById("favorite-vendor-label").textContent = 
                `${formatCurrency(favoriteVendor.spending)} spent`;
        }

        if (mostUsedVendor) {
            document.getElementById("most-orders-vendor").textContent = mostUsedVendor.name.substring(0, 20);
            document.getElementById("most-orders-label").textContent = 
                `${mostUsedVendor.orders} orders`;
        }
    }

    // ========================================================================
    // Chart Creation Functions
    // ========================================================================

    function createChart(canvasId, type, data, options = {}) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return null;

        if (analyticsCharts[canvasId]) {
            analyticsCharts[canvasId].destroy();
        }

        const defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { position: "top" } }
        };

        const mergedOptions = { ...defaultOptions, ...options };

        const chart = new Chart(ctx, { type, data, options: mergedOptions });
        analyticsCharts[canvasId] = chart;
        return chart;
    }

    function createMonthlySpendingChart(analytics) {
        const months = Object.keys(analytics.ordersByMonth).sort();
        const amounts = months.map(m => (analytics.ordersByMonth[m] || 0) / 100);

        const chartData = {
            labels: months.map(m => {
                const [year, month] = m.split("-");
                return new Date(year, month - 1).toLocaleDateString("en-ZA", { month: "short", year: "numeric" });
            }),
            datasets: [{
                label: "Monthly Spending (ZAR 100s)",
                data: amounts,
                borderColor: "#667eea",
                backgroundColor: "rgba(102, 126, 234, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointBackgroundColor: "#667eea"
            }]
        };

        createChart("monthly-spending-chart", "line", chartData);
    }

    function createVendorSpendingChart(analytics) {
        const vendors = Object.values(analytics.vendorSpending)
            .sort((a, b) => b.spending - a.spending)
            .slice(0, 8);

        const chartData = {
            labels: vendors.map(v => v.name.substring(0, 15)),
            datasets: [{
                label: "Total Spending (ZAR 100s)",
                data: vendors.map(v => v.spending / 100),
                backgroundColor: "rgba(118, 75, 162, 0.7)",
                borderColor: "#764ba2",
                borderWidth: 2
            }]
        };

        createChart("vendor-spending-chart", "bar", chartData);
    }

    function createFavoriteItemsChart(analytics) {
        const sorted = Object.values(analytics.itemFrequency)
            .sort((a, b) => b.timesOrdered - a.timesOrdered)
            .slice(0, 10);

        const chartData = {
            labels: sorted.map(item => item.name.substring(0, 15)),
            datasets: [{
                label: "Times Ordered",
                data: sorted.map(item => item.timesOrdered),
                backgroundColor: [
                    "#667eea", "#764ba2", "#f093fb", "#4facfe",
                    "#43e97b", "#fa709a", "#feca57", "#ff6b6b",
                    "#ee5a6f", "#c44569"
                ],
                borderColor: "#fff",
                borderWidth: 2
            }]
        };

        createChart("favorite-items-chart", "doughnut", chartData);
    }

    function createOrderFrequencyChart(analytics) {
        const hours = Array.from({ length: 24 }, (_, i) => i);
        const data = hours.map(h => analytics.ordersByHour[h] || 0);

        const chartData = {
            labels: hours.map(h => `${h}:00`),
            datasets: [{
                label: "Orders",
                data,
                borderColor: "#43e97b",
                backgroundColor: "rgba(67, 233, 123, 0.1)",
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }]
        };

        createChart("order-frequency-chart", "line", chartData);
    }

    function createCategoryChart(analytics) {
        const sorted = Object.entries(analytics.categorySpending)
            .map(([cat, data]) => ({ category: cat, ...data }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 8);

        const chartData = {
            labels: sorted.map(c => c.category || "Other"),
            datasets: [{
                label: "Spending (ZAR 100s)",
                data: sorted.map(c => c.revenue / 100),
                backgroundColor: "rgba(240, 147, 251, 0.7)",
                borderColor: "#f093fb",
                borderWidth: 2
            }]
        };

        createChart("category-chart", "bar", chartData);
    }

    function createTopVendorsChart(analytics) {
        const vendors = Object.values(analytics.vendorSpending)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 6);

        const chartData = {
            labels: vendors.map(v => v.name.substring(0, 12)),
            datasets: [{
                label: "Orders",
                data: vendors.map(v => v.orders),
                backgroundColor: [
                    "#667eea", "#764ba2", "#f093fb", "#4facfe",
                    "#43e97b", "#fa709a"
                ],
                borderColor: "#fff",
                borderWidth: 2
            }]
        };

        createChart("top-vendors-chart", "doughnut", chartData);
    }

    // ========================================================================
    // Table Update Functions
    // ========================================================================

    function updateItemsTables(analytics) {
        const sorted = Object.values(analytics.itemFrequency)
            .sort((a, b) => b.timesOrdered - a.timesOrdered);

        const topItems = sorted.slice(0, 10);

        const table = document.getElementById("favorite-items-table");
        if (table) {
            const tbody = table.querySelector("tbody");
            tbody.innerHTML = topItems.length > 0 ? topItems.map((item, index) => `
                <tr>
                    <td><span class="rank-badge">#${index + 1}</span></td>
                    <td>${item.name}</td>
                    <td>${item.vendor}</td>
                    <td>${item.timesOrdered}</td>
                    <td>${formatCurrency(item.totalSpent)}</td>
                    <td>${formatCurrency(item.avgPrice)}</td>
                </tr>
            `).join("") : `<tr><td colspan="6" class="loading-message">No items ordered yet.</td></tr>`;
        }
    }

    function updateVendorsTables(analytics) {
        const sorted = Object.values(analytics.vendorSpending)
            .sort((a, b) => b.orders - a.orders)
            .slice(0, 10);

        const table = document.getElementById("top-vendors-table");
        if (table) {
            const tbody = table.querySelector("tbody");
            tbody.innerHTML = sorted.length > 0 ? sorted.map((vendor, index) => {
                const lastOrderDate = formatDate(vendor.lastOrder);
                const avgOrder = vendor.orders > 0 ? vendor.spending / vendor.orders : 0;
                return `
                    <tr>
                        <td><span class="rank-badge">#${index + 1}</span></td>
                        <td>${vendor.name}</td>
                        <td>${vendor.orders}</td>
                        <td>${formatCurrency(vendor.spending)}</td>
                        <td>${formatCurrency(avgOrder)}</td>
                        <td>${lastOrderDate}</td>
                    </tr>
                `;
            }).join("") : `<tr><td colspan="6" class="loading-message">No orders placed yet.</td></tr>`;
        }
    }

    function updateRecentOrders(analytics) {
        const container = document.getElementById("recent-orders-container");
        if (!container) return;

        const recent = analytics.recentOrders.slice(0, 6);

        if (recent.length === 0) {
            container.innerHTML = `<p class="empty-state">No orders found in this period.</p>`;
            return;
        }

        container.innerHTML = recent.map(order => {
            const date = getDateFromTimestamp(order.date);
            const dateStr = date ? date.toLocaleDateString("en-ZA") : "Unknown";
            const timeStr = date ? date.toLocaleTimeString("en-ZA", { hour: "2-digit", minute: "2-digit" }) : "";
            
            return `
                <div class="recent-order-card">
                    <div class="order-header">
                        <div class="order-vendor">${order.vendor}</div>
                        <span class="order-status-badge ${order.status}">${order.status}</span>
                    </div>
                    <div class="order-amount">${formatCurrency(order.amount)}</div>
                    <div class="order-date">${dateStr} at ${timeStr}</div>
                    <div class="order-items">${order.itemCount} item${order.itemCount !== 1 ? "s" : ""}</div>
                </div>
            `;
        }).join("");
    }

    // ========================================================================
    // Insights Generation
    // ========================================================================

    function generateInsights(analytics) {
        const insights = [];
        const totalOrders = analytics.totalOrders;
        const vendors = Object.values(analytics.vendorSpending);

        // Spending insight
        if (analytics.totalSpent > 0) {
            const avgMonthly = Object.values(analytics.ordersByMonth).length > 0
                ? analytics.totalSpent / Object.values(analytics.ordersByMonth).length
                : analytics.totalSpent;
            insights.push({
                icon: "💰",
                title: "Your Spending Summary",
                text: `You've spent ${formatCurrency(analytics.totalSpent)} across ${totalOrders} orders. Average monthly: ${formatCurrency(avgMonthly)}`,
                type: "info"
            });
        }

        // Favorite vendor
        if (vendors.length > 0) {
            const favorite = vendors.reduce((max, v) => v.spending > max.spending ? v : max);
            insights.push({
                icon: "🏪",
                title: "Your Favorite Vendor",
                text: `You love "${favorite.name}"! You've spent ${formatCurrency(favorite.spending)} there across ${favorite.orders} orders.`,
                type: "success"
            });
        }

        // Most ordered item
        if (Object.keys(analytics.itemFrequency).length > 0) {
            const topItem = Object.values(analytics.itemFrequency)
                .reduce((max, item) => item.timesOrdered > max.timesOrdered ? item : max);
            insights.push({
                icon: "⭐",
                title: "Your Go-To Item",
                text: `"${topItem.name}" is your most ordered item (${topItem.timesOrdered}x). You must love it!`,
                type: "success"
            });
        }

        // Peak ordering time
        if (Object.keys(analytics.ordersByHour).length > 0) {
            const peakHour = Object.entries(analytics.ordersByHour)
                .reduce((max, [hour, count]) => count > max[1] ? [hour, count] : max);
            insights.push({
                icon: "⏰",
                title: "Your Ordering Habits",
                text: `You typically order around ${peakHour[0]}:00. That's when you crave campus food!`,
                type: "info"
            });
        }

        // Category preference
        if (Object.keys(analytics.categorySpending).length > 0) {
            const topCat = Object.entries(analytics.categorySpending)
                .reduce((max, [cat, data]) => data.revenue > max.revenue ? { category: cat, ...data } : max);
            insights.push({
                icon: "🍱",
                title: "Your Favorite Category",
                text: `You love "${topCat.category}" the most! ${formatCurrency(topCat.revenue)} spent on this category.`,
                type: "info"
            });
        }

        // Diversity tip
        const uniqueVendors = vendors.length;
        if (uniqueVendors <= 2 && uniqueVendors > 0) {
            insights.push({
                icon: "🎯",
                title: "Tip: Explore New Vendors",
                text: `You mostly order from ${uniqueVendors} vendor(s). Try exploring more vendors on campus!`,
                type: "tip"
            });
        } else if (uniqueVendors > 5) {
            insights.push({
                icon: "🌟",
                title: "Adventurous Eater!",
                text: `You've ordered from ${uniqueVendors} different vendors. Great way to explore campus food!`,
                type: "success"
            });
        }

        // Items count insight
        if (analytics.totalItems > 0) {
            const avgPerOrder = totalOrders > 0 ? (analytics.totalItems / totalOrders).toFixed(1) : 0;
            insights.push({
                icon: "📊",
                title: "Your Order Patterns",
                text: `Average ${avgPerOrder} items per order across ${totalOrders} total orders.`,
                type: "info"
            });
        }

        return insights;
    }

    function renderInsights(insights) {
        const container = document.getElementById("insights-container");
        if (!container) return;

        if (insights.length === 0) {
            container.innerHTML = `<p class="empty-state">No insights available yet. Start ordering!</p>`;
            return;
        }

        container.innerHTML = insights.map(insight => `
            <div class="insight-item ${insight.type}">
                <div class="insight-icon">${insight.icon}</div>
                <div class="insight-title">${insight.title}</div>
                <div class="insight-text">${insight.text}</div>
            </div>
        `).join("");
    }

    // ========================================================================
    // Export Functions
    // ========================================================================

    function exportToCSV(analytics, filteredOrders) {
        const rows = [];
        rows.push(["Campus Food Ordering Platform - Customer Analytics Export"]);
        rows.push(["Export Date", new Date().toLocaleString()]);
        rows.push([]);

        // Summary
        rows.push(["SUMMARY"]);
        rows.push(["Metric", "Value"]);
        rows.push(["Total Spent", formatCurrency(analytics.totalSpent)]);
        rows.push(["Total Orders", analytics.totalOrders]);
        rows.push(["Total Items Ordered", analytics.totalItems]);
        rows.push(["Average Order Value", formatCurrency(analytics.totalOrders > 0 ? analytics.totalSpent / analytics.totalOrders : 0)]);
        rows.push([]);

        // Top vendors
        rows.push(["TOP VENDORS"]);
        rows.push(["Vendor Name", "Orders", "Total Spent", "Average Order"]);
        Object.values(analytics.vendorSpending)
            .sort((a, b) => b.spending - a.spending)
            .slice(0, 10)
            .forEach(v => {
                rows.push([v.name, v.orders, formatCurrency(v.spending), formatCurrency(v.spending / v.orders)]);
            });
        rows.push([]);

        // Favorite items
        rows.push(["FAVORITE ITEMS"]);
        rows.push(["Item Name", "Vendor", "Times Ordered", "Total Spent", "Avg Price"]);
        Object.values(analytics.itemFrequency)
            .sort((a, b) => b.timesOrdered - a.timesOrdered)
            .slice(0, 10)
            .forEach(item => {
                rows.push([item.name, item.vendor, item.timesOrdered, formatCurrency(item.totalSpent), formatCurrency(item.avgPrice)]);
            });
        rows.push([]);

        // Monthly breakdown
        rows.push(["MONTHLY BREAKDOWN"]);
        rows.push(["Month", "Spending"]);
        Object.entries(analytics.ordersByMonth)
            .sort()
            .forEach(([month, amount]) => {
                rows.push([month, formatCurrency(amount)]);
            });
        rows.push([]);

        // Category breakdown
        rows.push(["CATEGORY BREAKDOWN"]);
        rows.push(["Category", "Spending", "Items Ordered"]);
        Object.entries(analytics.categorySpending)
            .sort((a, b) => b[1].revenue - a[1].revenue)
            .forEach(([cat, data]) => {
                rows.push([cat, formatCurrency(data.revenue), data.items]);
            });

        const csv = rows.map(row => row.map(cell => {
            const value = String(cell).replace(/"/g, '""');
            return value.includes(",") || value.includes("\n") || value.includes("\"") ? `"${value}"` : value;
        }).join(",")).join("\n");

        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `customer-analytics-${new Date().toISOString().split("T")[0]}.csv`);
        link.style.visibility = "hidden";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        updateStatusMessage("Analytics exported successfully!", false);
    }

    // ========================================================================
    // Data Fetching
    // ========================================================================

    async function fetchCustomerOrders(db, firestoreFns, customerUid) {
        if (!db || !firestoreFns || !customerUid) {
            throw new Error("Missing required dependencies");
        }

        const { collection, query, where, getDocs } = firestoreFns;

        try {
            const ordersRef = collection(db, "orders");
            const q = query(ordersRef, where("customerUid", "==", customerUid));
            const snapshot = await getDocs(q);

            const orders = [];
            snapshot.forEach(doc => {
                orders.push({ id: doc.id, ...doc.data() });
            });

            return orders;
        } catch (error) {
            console.error("Error fetching customer orders:", error);
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
                updateStatusMessage("Loading your analytics...", false);

                const db = resolveFirestore(options.db);
                const auth = resolveAuth(options.auth);
                const authFns = resolveAuthFns(options.authFns);
                const firestoreFns = resolveFirestoreFns(options.firestoreFns);

                if (!db || !auth || !authFns || !firestoreFns) {
                    throw new Error("Missing required Firebase dependencies");
                }

                const { onAuthStateChanged } = authFns;

                await new Promise((resolve) => {
                    onAuthStateChanged(auth, (user) => {
                        if (user) {
                            currentCustomerUid = user.uid;
                            resolve();
                        } else {
                            window.location.href = "../authentication/login.html";
                            resolve();
                        }
                    });
                });

                allOrders = await fetchCustomerOrders(db, firestoreFns, currentCustomerUid);

                // Set default date range (last 12 months)
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 12);

                document.getElementById("start-date-input").value = startDate.toISOString().split("T")[0];
                document.getElementById("end-date-input").value = endDate.toISOString().split("T")[0];

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
        const startDateStr = document.getElementById("start-date-input").value;
        const endDateStr = document.getElementById("end-date-input").value;

        const startDate = startDateStr ? new Date(startDateStr) : null;
        const endDate = endDateStr ? new Date(endDateStr) : null;

        if (endDate) {
            endDate.setHours(23, 59, 59, 999);
        }

        filteredOrders = filterOrdersByDateRange(allOrders, startDate, endDate);
        const analytics = calculateCustomerAnalytics(filteredOrders);

        updateMetrics(analytics);
        createMonthlySpendingChart(analytics);
        createVendorSpendingChart(analytics);
        createFavoriteItemsChart(analytics);
        createOrderFrequencyChart(analytics);
        createCategoryChart(analytics);
        createTopVendorsChart(analytics);
        updateItemsTables(analytics);
        updateVendorsTables(analytics);
        updateRecentOrders(analytics);

        const insights = generateInsights(analytics);
        renderInsights(insights);

        const dateRange = startDateStr && endDateStr
            ? ` (${startDateStr} to ${endDateStr})`
            : " (All time)";
        updateStatusMessage(`Showing analytics for ${filteredOrders.length} orders${dateRange}`, false);
    }

    function attachEventListeners() {
        const applyFilterBtn = document.getElementById("apply-filter-button");
        if (applyFilterBtn) {
            applyFilterBtn.addEventListener("click", () => applyDateFilter());
        }

        const resetFilterBtn = document.getElementById("reset-filter-button");
        if (resetFilterBtn) {
            resetFilterBtn.addEventListener("click", () => {
                const endDate = new Date();
                const startDate = new Date(endDate);
                startDate.setMonth(startDate.getMonth() - 12);

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
                const analytics = calculateCustomerAnalytics(filteredOrders);
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
    }

    globalScope.customerAnalytics = {
        initialize: initializeAnalyticsDashboard
    };

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => {
            initializeAnalyticsDashboard({
                db: globalScope.db,
                auth: globalScope.auth,
                authFns: globalScope.authFns,
                firestoreFns: globalScope.firestoreFns
            });
        });
    } else {
        initializeAnalyticsDashboard({
            db: globalScope.db,
            auth: globalScope.auth,
            authFns: globalScope.authFns,
            firestoreFns: globalScope.firestoreFns
        });
    }

})(typeof window !== "undefined" ? window : global);
