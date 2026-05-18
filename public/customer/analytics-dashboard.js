/**
 * customer/analytics-dashboard.js
 * 
 * Multi-page customer analytics dashboard with modular page management,
 * shared data fetching, and dynamic chart rendering.
 */

// ============================================================================
// Global State & Configuration
// ============================================================================

const ANALYTICS_CONFIG = {
    refreshInterval: 5 * 60 * 1000, // 5 minutes
    maxChartData: 12, // months or categories
    chartDefaults: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: {
                display: true,
                labels: { font: { size: 12 }, color: '#666' }
            }
        }
    }
};

// Global state
const state = {
    currentUser: null,
    orders: [],
    startDate: null,
    endDate: null,
    charts: {},
    lastUpdated: new Date()
};

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Resolve Firebase dependencies
 */
function resolveFirebase() {
    if (!window.db || !window.auth) {
        throw new Error('Firebase not initialized. Check config.js');
    }
    return { db: window.db, auth: window.auth };
}

/**
 * Resolve order service dependencies
 */
function resolveOrderService() {
    if (!window.orderService || !window.orderQueries) {
        throw new Error('Order service not initialized. Check order-service.js and order-queries.js');
    }
    return { orderService: window.orderService, orderQueries: window.orderQueries };
}

/**
 * Format currency
 */
function formatCurrency(amount) {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
}

/**
 * Format date
 */
function formatDate(date) {
    return new Intl.DateTimeFormat('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric'
    }).format(date);
}

/**
 * Get date range with default (last 12 months)
 */
function getDateRange() {
    if (!state.endDate) {
        state.endDate = new Date();
    }
    if (!state.startDate) {
        state.startDate = new Date(state.endDate);
        state.startDate.setMonth(state.startDate.getMonth() - 12);
    }
    return { startDate: state.startDate, endDate: state.endDate };
}

/**
 * Show status message
 */
function showStatus(message, type = 'info') {
    const statusBar = document.getElementById('status-bar');
    statusBar.textContent = message;
    statusBar.className = `status-bar active status-${type}`;
    setTimeout(() => statusBar.classList.remove('active'), 3000);
}

// ============================================================================
// Data Fetching Functions
// ============================================================================

/**
 * Fetch all customer orders within date range
 */
async function fetchCustomerOrders() {
    try {
        const { db, auth } = resolveFirebase();
        const { orderQueries } = resolveOrderService();
        
        const currentUser = auth.currentUser;
        if (!currentUser) {
            console.warn('No authenticated user');
            return [];
        }

        state.currentUser = currentUser;
        
        const { startDate, endDate } = getDateRange();
        
        const query = window.query(
            window.collection(db, 'orders'),
            window.where('customerUid', '==', currentUser.uid),
            window.where('createdAt', '>=', startDate),
            window.where('createdAt', '<=', endDate),
            window.orderBy('createdAt', 'desc')
        );
        
        const snapshot = await window.getDocs(query);
        state.orders = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        state.lastUpdated = new Date();
        
        document.getElementById('last-updated').textContent = formatDate(state.lastUpdated);
        
        return state.orders;
    } catch (error) {
        console.error('Error fetching orders:', error);
        showStatus('Error loading orders', 'error');
        return [];
    }
}

/**
 * Calculate key metrics from orders
 */
function calculateMetrics(orders = state.orders) {
    if (orders.length === 0) {
        return {
            totalSpent: 0,
            totalOrders: 0,
            avgOrderValue: 0,
            favoriteVendor: '-',
            totalItems: 0,
            completedOrders: 0,
            completionRate: '0%',
            avgItemsPerOrder: 0,
            mostOrderedCategory: '-',
            totalVendors: 0
        };
    }

    const totalSpent = orders.reduce((sum, order) => sum + (order.paymentAmount || 0), 0);
    const totalItems = orders.reduce((sum, order) => sum + (order.items?.length || 0), 0);
    const completedOrders = orders.filter(o => o.status === 'completed').length;

    // Vendor frequency
    const vendorMap = {};
    orders.forEach(order => {
        if (order.vendorUid) {
            vendorMap[order.vendorUid] = (vendorMap[order.vendorUid] || 0) + 1;
        }
    });
    const favoriteVendor = Object.entries(vendorMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    // Category frequency
    const categoryMap = {};
    orders.forEach(order => {
        order.items?.forEach(item => {
            const category = item.category || 'Other';
            categoryMap[category] = (categoryMap[category] || 0) + 1;
        });
    });
    const mostOrderedCategory = Object.entries(categoryMap).sort((a, b) => b[1] - a[1])[0]?.[0] || '-';

    return {
        totalSpent,
        totalOrders: orders.length,
        avgOrderValue: totalSpent / orders.length,
        favoriteVendor,
        totalItems,
        completedOrders,
        completionRate: `${Math.round((completedOrders / orders.length) * 100)}%`,
        avgItemsPerOrder: totalItems / orders.length,
        mostOrderedCategory,
        totalVendors: Object.keys(vendorMap).length
    };
}

/**
 * Generate monthly spending data
 */
function generateMonthlySpendingData(orders = state.orders) {
    const monthlyData = {};
    
    orders.forEach(order => {
        if (order.createdAt) {
            const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyData[monthKey]) {
                monthlyData[monthKey] = { orders: 0, spent: 0, items: 0 };
            }
            monthlyData[monthKey].orders += 1;
            monthlyData[monthKey].spent += order.paymentAmount || 0;
            monthlyData[monthKey].items += order.items?.length || 0;
        }
    });

    return Object.entries(monthlyData)
        .sort(([a], [b]) => a.localeCompare(b))
        .slice(-12);
}

/**
 * Generate spending by category data
 */
function generateCategorySpendingData(orders = state.orders) {
    const categoryData = {};

    orders.forEach(order => {
        order.items?.forEach(item => {
            const category = item.category || 'Other';
            if (!categoryData[category]) {
                categoryData[category] = 0;
            }
            categoryData[category] += (item.price || 0) * (item.quantity || 1);
        });
    });

    return Object.entries(categoryData)
        .map(([name, spent]) => ({ name, spent }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 10);
}

/**
 * Generate vendor spending data
 */
function generateVendorSpendingData(orders = state.orders) {
    const vendorData = {};

    orders.forEach(order => {
        const vendor = order.vendorName || order.vendorUid || 'Unknown';
        if (!vendorData[vendor]) {
            vendorData[vendor] = { orders: 0, spent: 0 };
        }
        vendorData[vendor].orders += 1;
        vendorData[vendor].spent += order.paymentAmount || 0;
    });

    return Object.entries(vendorData)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.spent - a.spent)
        .slice(0, 10);
}

/**
 * Generate top items data
 */
function generateTopItemsData(orders = state.orders) {
    const itemData = {};

    orders.forEach(order => {
        order.items?.forEach(item => {
            const itemKey = item.name || 'Unknown';
            if (!itemData[itemKey]) {
                itemData[itemKey] = {
                    quantity: 0,
                    spent: 0,
                    vendor: item.vendorName || order.vendorName || 'Unknown'
                };
            }
            itemData[itemKey].quantity += item.quantity || 1;
            itemData[itemKey].spent += (item.price || 0) * (item.quantity || 1);
        });
    });

    return Object.entries(itemData)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.quantity - a.quantity)
        .slice(0, 10);
}

/**
 * Generate peak hours data
 */
function generatePeakHoursData(orders = state.orders) {
    const hourData = Array(24).fill(0);

    orders.forEach(order => {
        if (order.createdAt) {
            const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            hourData[date.getHours()] += 1;
        }
    });

    return hourData;
}

/**
 * Generate day of week data
 */
function generateDayOfWeekData(orders = state.orders) {
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayData = Array(7).fill(0);

    orders.forEach(order => {
        if (order.createdAt) {
            const date = order.createdAt.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
            dayData[date.getDay()] += 1;
        }
    });

    return dayData.map((count, index) => ({ day: days[index], count }));
}

/**
 * Generate insights
 */
function generateInsights(orders = state.orders, metrics = calculateMetrics(orders)) {
    const insights = [];

    if (metrics.completionRate === '100%') {
        insights.push({
            type: 'success',
            icon: '✅',
            title: 'Perfect Track Record',
            text: `All your ${metrics.totalOrders} orders have been completed successfully!`
        });
    }

    if (metrics.avgOrderValue > 50) {
        insights.push({
            type: 'info',
            icon: 'ℹ️',
            title: 'Premium Customer',
            text: `Your average order value of ${formatCurrency(metrics.avgOrderValue)} is above average.`
        });
    }

    if (metrics.totalVendors > 10) {
        insights.push({
            type: 'info',
            icon: 'ℹ️',
            title: 'Adventurous Eater',
            text: `You've ordered from ${metrics.totalVendors} different vendors. Great diversity in your food choices!`
        });
    }

    if (metrics.totalOrders > 30) {
        insights.push({
            type: 'tip',
            icon: '💡',
            title: 'Loyalty Suggestion',
            text: 'Consider joining a loyalty program with your favorite vendor for discounts.'
        });
    }

    if (metrics.mostOrderedCategory) {
        insights.push({
            type: 'info',
            icon: '🍽️',
            title: 'Favorite Category',
            text: `You seem to love ${metrics.mostOrderedCategory}. Check out new restaurants in this category!`
        });
    }

    return insights.length > 0 ? insights : [{
        type: 'info',
        icon: 'ℹ️',
        title: 'Getting Started',
        text: 'Start placing orders to see personalized analytics and insights!'
    }];
}

// ============================================================================
// Chart Rendering Functions
// ============================================================================

/**
 * Create or update line chart
 */
function createLineChart(canvasId, labels, data, title) {
    if (state.charts[canvasId]) {
        state.charts[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'line',
        data: {
            labels,
            datasets: [{
                label: title,
                data,
                borderColor: '#667eea',
                backgroundColor: 'rgba(102, 126, 234, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true,
                pointRadius: 5,
                pointBackgroundColor: '#667eea',
                pointBorderColor: '#fff',
                pointBorderWidth: 2
            }]
        },
        options: {
            ...ANALYTICS_CONFIG.chartDefaults,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#999' }, grid: { color: '#f0f0f0' } },
                x: { ticks: { color: '#999' }, grid: { color: '#f0f0f0' } }
            }
        }
    });
}

/**
 * Create or update bar chart
 */
function createBarChart(canvasId, labels, data, title, color = '#667eea') {
    if (state.charts[canvasId]) {
        state.charts[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    state.charts[canvasId] = new Chart(ctx, {
        type: 'bar',
        data: {
            labels,
            datasets: [{
                label: title,
                data,
                backgroundColor: color,
                borderColor: color,
                borderWidth: 1
            }]
        },
        options: {
            ...ANALYTICS_CONFIG.chartDefaults,
            scales: {
                y: { beginAtZero: true, ticks: { color: '#999' }, grid: { color: '#f0f0f0' } },
                x: { ticks: { color: '#999' }, grid: { color: '#f0f0f0' } }
            }
        }
    });
}

/**
 * Create or update doughnut chart
 */
function createDoughnutChart(canvasId, labels, data, title) {
    if (state.charts[canvasId]) {
        state.charts[canvasId].destroy();
    }

    const ctx = document.getElementById(canvasId)?.getContext('2d');
    if (!ctx) return;

    const colors = [
        '#667eea', '#764ba2', '#f093fb', '#4facfe', '#43e97b',
        '#fa709a', '#fee140', '#30cfd0', '#a8edea', '#fed6e3'
    ];

    state.charts[canvasId] = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels,
            datasets: [{
                data,
                backgroundColor: colors.slice(0, labels.length),
                borderColor: '#fff',
                borderWidth: 2
            }]
        },
        options: {
            ...ANALYTICS_CONFIG.chartDefaults,
            plugins: {
                ...ANALYTICS_CONFIG.chartDefaults.plugins,
                tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${ctx.parsed}` } }
            }
        }
    });
}

// ============================================================================
// Page Rendering Functions
// ============================================================================

/**
 * Render overview page
 */
function renderOverviewPage() {
    const metrics = calculateMetrics();
    const metricsHtml = `
        <div class="metric-card">
            <h4>Total Spent</h4>
            <div class="metric-value">${formatCurrency(metrics.totalSpent)}</div>
            <div class="metric-label">Lifetime spending</div>
        </div>
        <div class="metric-card">
            <h4>Total Orders</h4>
            <div class="metric-value">${metrics.totalOrders}</div>
            <div class="metric-label">Orders placed</div>
        </div>
        <div class="metric-card">
            <h4>Average Order</h4>
            <div class="metric-value">${formatCurrency(metrics.avgOrderValue)}</div>
            <div class="metric-label">Per order</div>
        </div>
        <div class="metric-card">
            <h4>Completion Rate</h4>
            <div class="metric-value">${metrics.completionRate}</div>
            <div class="metric-label">Successful orders</div>
        </div>
        <div class="metric-card">
            <h4>Favorite Vendor</h4>
            <div class="metric-value" style="font-size: 1.2rem;">${metrics.favoriteVendor}</div>
            <div class="metric-label">Most ordered from</div>
        </div>
        <div class="metric-card">
            <h4>Total Items</h4>
            <div class="metric-value">${metrics.totalItems}</div>
            <div class="metric-label">Items ordered</div>
        </div>
    `;
    document.getElementById('overview-metrics').innerHTML = metricsHtml;

    // Recent orders
    const recentOrders = state.orders.slice(0, 3);
    const recentOrdersHtml = recentOrders.length > 0 ? recentOrders.map(order => `
        <div class="recent-order-card">
            <div class="order-header">
                <span class="order-vendor">${order.vendorName || 'Unknown Vendor'}</span>
                <span class="order-status-badge ${order.status}">${order.status || 'pending'}</span>
            </div>
            <div class="order-amount">${formatCurrency(order.paymentAmount || 0)}</div>
            <div class="order-date">${formatDate(order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt))}</div>
            <div class="order-items">${order.items?.length || 0} items</div>
        </div>
    `).join('') : '<div class="no-data">No recent orders</div>';
    document.getElementById('recent-orders-mini').innerHTML = recentOrdersHtml;

    // Insights
    const insights = generateInsights();
    const insightsHtml = insights.map(insight => `
        <div class="insight-item ${insight.type}">
            <div class="insight-icon">${insight.icon}</div>
            <div class="insight-title">${insight.title}</div>
            <div class="insight-text">${insight.text}</div>
        </div>
    `).join('');
    document.getElementById('insights-container').innerHTML = insightsHtml;
}

/**
 * Render spending analysis page
 */
function renderSpendingPage() {
    const metrics = calculateMetrics();
    
    // Metrics
    const metricsHtml = `
        <div class="metric-card">
            <h4>Total Spent</h4>
            <div class="metric-value">${formatCurrency(metrics.totalSpent)}</div>
        </div>
        <div class="metric-card">
            <h4>Avg per Order</h4>
            <div class="metric-value">${formatCurrency(metrics.avgOrderValue)}</div>
        </div>
        <div class="metric-card">
            <h4>Monthly Average</h4>
            <div class="metric-value">${formatCurrency(metrics.totalSpent / 12)}</div>
        </div>
    `;
    document.getElementById('spending-metrics').innerHTML = metricsHtml;

    // Monthly spending chart
    const monthlyData = generateMonthlySpendingData();
    const monthLabels = monthlyData.map(([month]) => {
        const [year, monthNum] = month.split('-');
        return new Date(year, monthNum - 1).toLocaleString('default', { month: 'short', year: '2-digit' });
    });
    const monthlyAmounts = monthlyData.map(([, data]) => data.spent);
    createLineChart('monthlySpendingChart', monthLabels, monthlyAmounts, 'Monthly Spending');

    // Category spending chart
    const categoryData = generateCategorySpendingData();
    const categoryLabels = categoryData.map(d => d.name);
    const categoryAmounts = categoryData.map(d => d.spent);
    createDoughnutChart('categorySpendingChart', categoryLabels, categoryAmounts, 'Spending by Category');

    // Monthly breakdown table
    const tableHtml = monthlyData.map(([month, data]) => {
        const [year, monthNum] = month.split('-');
        const monthName = new Date(year, monthNum - 1).toLocaleString('default', { month: 'long', year: 'numeric' });
        return `
            <tr>
                <td>${monthName}</td>
                <td>${data.orders}</td>
                <td>${formatCurrency(data.spent)}</td>
                <td>${formatCurrency(data.spent / data.orders)}</td>
            </tr>
        `;
    }).join('');
    document.getElementById('spending-breakdown-table').innerHTML = tableHtml;
}

/**
 * Render vendor insights page
 */
function renderVendorPage() {
    const vendorData = generateVendorSpendingData();
    const metrics = calculateMetrics();
    
    // Metrics
    const metricsHtml = `
        <div class="metric-card">
            <h4>Total Vendors</h4>
            <div class="metric-value">${metrics.totalVendors}</div>
        </div>
        <div class="metric-card">
            <h4>Top Vendor Spending</h4>
            <div class="metric-value">${formatCurrency(vendorData[0]?.spent || 0)}</div>
        </div>
        <div class="metric-card">
            <h4>Avg per Vendor</h4>
            <div class="metric-value">${formatCurrency(metrics.totalSpent / Math.max(metrics.totalVendors, 1))}</div>
        </div>
    `;
    document.getElementById('vendor-metrics').innerHTML = metricsHtml;

    // Vendor spending chart
    const vendorLabels = vendorData.map(d => d.name);
    const vendorAmounts = vendorData.map(d => d.spent);
    createBarChart('vendorSpendingChart', vendorLabels, vendorAmounts, 'Spending by Vendor');

    // Vendor orders chart
    const vendorOrders = vendorData.map(d => d.orders);
    createBarChart('vendorOrdersChart', vendorLabels, vendorOrders, 'Orders by Vendor', '#764ba2');

    // Top vendors table
    const tableHtml = vendorData.map((vendor, index) => `
        <tr>
            <td><span class="rank-badge">${index + 1}</span></td>
            <td>${vendor.name}</td>
            <td>${vendor.orders}</td>
            <td>${formatCurrency(vendor.spent)}</td>
            <td>${formatCurrency(vendor.spent / vendor.orders)}</td>
        </tr>
    `).join('');
    document.getElementById('top-vendors-table').innerHTML = tableHtml;
}

/**
 * Render food preferences page
 */
function renderItemsPage() {
    const itemData = generateTopItemsData();
    const categoryData = generateCategorySpendingData();
    
    // Metrics
    const metricsHtml = `
        <div class="metric-card">
            <h4>Unique Items</h4>
            <div class="metric-value">${itemData.length}</div>
        </div>
        <div class="metric-card">
            <h4>Total Items Ordered</h4>
            <div class="metric-value">${state.orders.reduce((sum, o) => sum + (o.items?.length || 0), 0)}</div>
        </div>
        <div class="metric-card">
            <h4>Favorite Category</h4>
            <div class="metric-value" style="font-size: 1.2rem;">${categoryData[0]?.name || 'N/A'}</div>
        </div>
    `;
    document.getElementById('items-metrics').innerHTML = metricsHtml;

    // Top items chart
    const itemLabels = itemData.map(d => d.name);
    const itemQuantities = itemData.map(d => d.quantity);
    createBarChart('topItemsChart', itemLabels, itemQuantities, 'Times Ordered', '#f093fb');

    // Categories chart
    const categoryLabels = categoryData.map(d => d.name);
    const categoryAmounts = categoryData.map(d => d.spent);
    createDoughnutChart('categoriesChart', categoryLabels, categoryAmounts, 'Spending by Category');

    // Top items table
    const tableHtml = itemData.map((item, index) => `
        <tr>
            <td><span class="rank-badge">${index + 1}</span></td>
            <td>${item.name}</td>
            <td>${item.quantity}</td>
            <td>${formatCurrency(item.spent)}</td>
            <td>${item.vendor}</td>
        </tr>
    `).join('');
    document.getElementById('top-items-table').innerHTML = tableHtml;
}

/**
 * Render ordering patterns page
 */
function renderPatternsPage() {
    const peakHoursData = generatePeakHoursData();
    const dayOfWeekData = generateDayOfWeekData();
    const metrics = calculateMetrics();
    
    // Metrics
    const metricsHtml = `
        <div class="metric-card">
            <h4>Total Orders</h4>
            <div class="metric-value">${metrics.totalOrders}</div>
        </div>
        <div class="metric-card">
            <h4>Avg Items/Order</h4>
            <div class="metric-value">${metrics.avgItemsPerOrder.toFixed(1)}</div>
        </div>
        <div class="metric-card">
            <h4>Active Vendors</h4>
            <div class="metric-value">${metrics.totalVendors}</div>
        </div>
    `;
    document.getElementById('patterns-metrics').innerHTML = metricsHtml;

    // Peak hours chart
    const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
    createLineChart('peakHoursChart', hourLabels, peakHoursData, 'Orders by Hour');

    // Day of week chart
    const dayLabels = dayOfWeekData.map(d => d.day);
    const dayCounts = dayOfWeekData.map(d => d.count);
    createBarChart('dayOfWeekChart', dayLabels, dayCounts, 'Orders by Day', '#43e97b');

    // Summary stats
    const peakHour = peakHoursData.indexOf(Math.max(...peakHoursData));
    const peakDay = dayOfWeekData.reduce((max, d) => d.count > max.count ? d : max);

    document.getElementById('most-active-day').textContent = peakDay.day;
    document.getElementById('peak-hour').textContent = `${peakHour}:00`;
    document.getElementById('avg-items').textContent = metrics.avgItemsPerOrder.toFixed(1);
    document.getElementById('typical-order-time').textContent = `${peakHour}:00 - ${(peakHour + 1) % 24}:00`;
}

/**
 * Render recent orders page
 */
function renderOrdersPage() {
    const metrics = calculateMetrics();
    
    // Metrics
    const metricsHtml = `
        <div class="metric-card">
            <h4>Total Orders</h4>
            <div class="metric-value">${metrics.totalOrders}</div>
        </div>
        <div class="metric-card">
            <h4>Completed</h4>
            <div class="metric-value">${metrics.completedOrders}</div>
        </div>
        <div class="metric-card">
            <h4>Total Spent</h4>
            <div class="metric-value">${formatCurrency(metrics.totalSpent)}</div>
        </div>
    `;
    document.getElementById('orders-metrics').innerHTML = metricsHtml;

    // Orders list
    const ordersHtml = state.orders.length > 0 ? state.orders.map(order => `
        <div class="recent-order-card">
            <div class="order-header">
                <span class="order-vendor">${order.vendorName || 'Unknown Vendor'}</span>
                <span class="order-status-badge ${order.status}">${order.status || 'pending'}</span>
            </div>
            <div class="order-amount">${formatCurrency(order.paymentAmount || 0)}</div>
            <div class="order-date">${formatDate(order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt))}</div>
            <div class="order-items">${order.items?.length || 0} items</div>
        </div>
    `).join('') : '<div class="no-data">No orders found</div>';
    document.getElementById('recent-orders-container').innerHTML = ordersHtml;
}

/**
 * Render settings page
 */
function renderSettingsPage() {
    // Settings will be handled by event listeners
    console.log('Settings page rendered');
}

// ============================================================================
// Page Navigation
// ============================================================================

/**
 * Switch to a different page
 */
function switchPage(pageName) {
    // Hide all pages
    document.querySelectorAll('.analytics-page').forEach(page => {
        page.classList.remove('active');
    });

    // Show selected page
    const page = document.querySelector(`.analytics-page[data-page="${pageName}"]`);
    if (page) {
        page.classList.add('active');
    }

    // Update sidebar
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelector(`.sidebar-link[data-page="${pageName}"]`)?.classList.add('active');

    // Render page content
    switch (pageName) {
        case 'overview':
            renderOverviewPage();
            break;
        case 'spending':
            renderSpendingPage();
            break;
        case 'vendors':
            renderVendorPage();
            break;
        case 'items':
            renderItemsPage();
            break;
        case 'patterns':
            renderPatternsPage();
            break;
        case 'orders':
            renderOrdersPage();
            break;
        case 'settings':
            renderSettingsPage();
            break;
    }

    // Trigger chart resize for responsive updates
    setTimeout(() => {
        Object.values(state.charts).forEach(chart => chart?.resize());
    }, 100);
}

// ============================================================================
// Export Functions
// ============================================================================

/**
 * Export analytics data as CSV
 */
function exportToCSV() {
    const metrics = calculateMetrics();
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `analytics-${timestamp}.csv`;

    let csv = 'Customer Analytics Report\n';
    csv += `Generated on: ${new Date().toLocaleString()}\n\n`;

    csv += 'Summary Metrics\n';
    csv += 'Total Spent,' + metrics.totalSpent + '\n';
    csv += 'Total Orders,' + metrics.totalOrders + '\n';
    csv += 'Average Order Value,' + metrics.avgOrderValue + '\n';
    csv += 'Completion Rate,' + metrics.completionRate + '\n\n';

    csv += 'Recent Orders\n';
    csv += 'Vendor,Amount,Date,Items,Status\n';
    state.orders.slice(0, 20).forEach(order => {
        const date = order.createdAt?.toDate ? order.createdAt.toDate() : new Date(order.createdAt);
        csv += `"${order.vendorName || 'Unknown'}",${order.paymentAmount},${formatDate(date)},${order.items?.length || 0},${order.status}\n`;
    });

    // Create download
    const element = document.createElement('a');
    element.setAttribute('href', 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv));
    element.setAttribute('download', filename);
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);

    showStatus(`Analytics exported as ${filename}`);
}

// ============================================================================
// Event Listeners
// ============================================================================

/**
 * Initialize event listeners
 */
function initializeEventListeners() {
    // Sidebar page switching
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const page = link.getAttribute('data-page');
            switchPage(page);
        });
    });

    // Sidebar toggle
    const sidebarToggle = document.getElementById('sidebar-toggle');
    if (sidebarToggle) {
        sidebarToggle.addEventListener('click', () => {
            const nav = document.getElementById('sidebar-nav');
            nav?.classList.toggle('active');
        });
    }

    // Filter buttons
    document.getElementById('apply-filter-sidebar')?.addEventListener('click', () => {
        const startDate = document.getElementById('startDate-sidebar')?.value;
        const endDate = document.getElementById('endDate-sidebar')?.value;
        if (startDate && endDate) {
            state.startDate = new Date(startDate);
            state.endDate = new Date(endDate);
            initAnalytics();
            showStatus('Filters applied');
        }
    });

    document.getElementById('reset-filter-sidebar')?.addEventListener('click', () => {
        state.startDate = null;
        state.endDate = null;
        document.getElementById('startDate-sidebar').value = '';
        document.getElementById('endDate-sidebar').value = '';
        initAnalytics();
        showStatus('Filters reset');
    });

    // Export buttons
    document.getElementById('export-csv-sidebar')?.addEventListener('click', exportToCSV);
    document.getElementById('export-csv-full')?.addEventListener('click', exportToCSV);
    document.getElementById('export-pdf-sidebar')?.addEventListener('click', () => {
        showStatus('PDF export coming soon');
    });
    document.getElementById('export-pdf-full')?.addEventListener('click', () => {
        showStatus('PDF export coming soon');
    });

    // Settings page controls
    document.getElementById('apply-filter-settings')?.addEventListener('click', () => {
        const startDate = document.getElementById('startDate-settings')?.value;
        const endDate = document.getElementById('endDate-settings')?.value;
        if (startDate && endDate) {
            state.startDate = new Date(startDate);
            state.endDate = new Date(endDate);
            initAnalytics();
            showStatus('Filters applied');
        }
    });

    document.getElementById('reset-filter-settings')?.addEventListener('click', () => {
        state.startDate = null;
        state.endDate = null;
        document.getElementById('startDate-settings').value = '';
        document.getElementById('endDate-settings').value = '';
        initAnalytics();
        showStatus('Filters reset');
    });
}

// ============================================================================
// Initialization
// ============================================================================

/**
 * Initialize analytics dashboard
 */
async function initAnalytics() {
    try {
        showStatus('Loading analytics data...');
        await fetchCustomerOrders();
        switchPage('overview');
        showStatus('Analytics loaded successfully', 'success');
    } catch (error) {
        console.error('Error initializing analytics:', error);
        showStatus('Error loading analytics', 'error');
    }
}

/**
 * Main initialization
 */
document.addEventListener('DOMContentLoaded', async () => {
    try {
        initializeEventListeners();
        await initAnalytics();
    } catch (error) {
        console.error('Initialization error:', error);
        showStatus('Failed to initialize analytics', 'error');
    }
});

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        calculateMetrics,
        generateMonthlySpendingData,
        generateCategorySpendingData,
        exportToCSV
    };
}
