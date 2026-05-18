# Customer Analytics Dashboard - Architecture & Visual Guides

## 📐 System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Campus Food Ordering Platform                │
│                                                                 │
│  ┌────────────────┐                                            │
│  │ authentication │ (Firebase Auth)                            │
│  └────────┬───────┘                                            │
│           │ currentUser.uid                                    │
│           ▼                                                     │
│  ┌──────────────────────────────────────────────────────────┐ │
│  │        analytics-dashboard.html (Main Entry Point)       │ │
│  │                                                          │ │
│  │  ┌────────────────────┐  ┌──────────────────────────┐  │ │
│  │  │    SIDEBAR         │  │   MAIN CONTENT AREA      │  │ │
│  │  │  ┌──────────────┐  │  │  ┌──────────────────────┐ │  │ │
│  │  │  │ Nav Links    │  │  │  │  Active Page         │ │  │ │
│  │  │  │ - Overview   │  │  │  │  (Dynamic Content)   │ │  │ │
│  │  │  │ - Spending   │  │  │  │                      │ │  │ │
│  │  │  │ - Vendors    │  │  │  │ - KPI Metrics        │ │  │ │
│  │  │  │ - Items      │  │  │  │ - Charts             │ │  │ │
│  │  │  │ - Patterns   │  │  │  │ - Tables             │ │  │ │
│  │  │  │ - Orders     │  │  │  │ - Insights           │ │  │ │
│  │  │  │ - Settings   │  │  │  │                      │ │  │ │
│  │  │  └──────────────┘  │  │  └──────────────────────┘ │  │ │
│  │  │  ┌──────────────┐  │  │  Page: [Overview, Spending │  │ │
│  │  │  │ Filters      │  │  │          Vendors, Items,    │  │ │
│  │  │  │ - Start Date │  │  │          Patterns, Orders,  │  │ │
│  │  │  │ - End Date   │  │  │          Settings]           │  │ │
│  │  │  │ - Apply      │  │  │                      │ │  │ │
│  │  │  │ - Reset      │  │  │                      │ │  │ │
│  │  │  └──────────────┘  │  │                      │ │  │ │
│  │  │  ┌──────────────┐  │  │                      │ │  │ │
│  │  │  │ Export       │  │  │                      │ │  │ │
│  │  │  │ - CSV        │  │  │                      │ │  │ │
│  │  │  │ - PDF (soon) │  │  │                      │ │  │ │
│  │  │  └──────────────┘  │  │                      │ │  │ │
│  │  └────────────────────┘  └──────────────────────┘ │  │ │
│  └──────────────────────────────────────────────────────┘ │
│           │                              │                │
│           ▼                              ▼                │
│  ┌──────────────────────────────────────────────────────┐ │
│  │       analytics-dashboard.js (Logic & Processing)    │ │
│  │                                                      │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │ Data Processing                                  │ │ │
│  │ │ - calculateMetrics()                             │ │ │
│  │ │ - generateMonthlySpendingData()                  │ │ │
│  │ │ - generateCategorySpendingData()                 │ │ │
│  │ │ - generateVendorSpendingData()                   │ │ │
│  │ │ - generateTopItemsData()                         │ │ │
│  │ │ - generatePeakHoursData()                        │ │ │
│  │ │ - generateDayOfWeekData()                        │ │ │
│  │ │ - generateInsights()                             │ │ │
│  │ └──────────────────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │ Chart Rendering (Chart.js)                       │ │ │
│  │ │ - createLineChart()                              │ │ │
│  │ │ - createBarChart()                               │ │ │
│  │ │ - createDoughnutChart()                          │ │ │
│  │ └──────────────────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │ Page Rendering (7 Functions)                     │ │ │
│  │ │ - renderOverviewPage()                           │ │ │
│  │ │ - renderSpendingPage()                           │ │ │
│  │ │ - renderVendorPage()                             │ │ │
│  │ │ - renderItemsPage()                              │ │ │
│  │ │ - renderPatternsPage()                           │ │ │
│  │ │ - renderOrdersPage()                             │ │ │
│  │ │ - renderSettingsPage()                           │ │ │
│  │ └──────────────────────────────────────────────────┘ │ │
│  │ ┌──────────────────────────────────────────────────┐ │ │
│  │ │ Event Handling                                   │ │ │
│  │ │ - Page navigation clicks                         │ │ │
│  │ │ - Filter apply/reset                             │ │ │
│  │ │ - Export CSV                                     │ │ │
│  │ │ - Mobile hamburger menu                          │ │ │
│  │ └──────────────────────────────────────────────────┘ │ │
│  └──────────────────────────────────────────────────────┘ │
│           │                                               │
│           ▼                                               │
│  ┌──────────────────────────────────────────────────────┐ │
│  │              Firebase Firestore                      │ │
│  │                                                      │ │
│  │  Query:                                              │ │
│  │  - Collection: 'orders'                              │ │
│  │  - Filter: customerUid == currentUser.uid            │ │
│  │  - Filter: createdAt >= startDate                    │ │
│  │  - Filter: createdAt <= endDate                      │ │
│  │  - Sort: createdAt (descending)                      │ │
│  │                                                      │ │
│  │  Returns: [Order1, Order2, Order3, ...]              │ │
│  │           With: items, vendorName, status, etc.      │ │
│  └──────────────────────────────────────────────────────┘ │
│                                                          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🔄 Data Flow Diagram

```
User Opens Analytics
        │
        ▼
Load analytics-dashboard.html
        │
        ├─→ Load CSS (analytics-dashboard.css)
        ├─→ Load JS (analytics-dashboard.js)
        ├─→ Load Firebase SDK
        ├─→ Load Chart.js
        └─→ Load dependencies
                │
                ▼
        Initialize Event Listeners
                │
                ├─→ Page navigation clicks
                ├─→ Sidebar toggle
                ├─→ Filter buttons
                └─→ Export buttons
                │
                ▼
        Call initAnalytics()
                │
                ├─→ fetchCustomerOrders()
                │      │
                │      ├─→ Get currentUser.uid
                │      ├─→ Query Firestore
                │      │   where customerUid == uid
                │      │   AND createdAt >= startDate
                │      │   AND createdAt <= endDate
                │      │
                │      └─→ Load state.orders[]
                │
                ├─→ switchPage('overview')
                │      │
                │      ├─→ Hide all pages
                │      ├─→ Show overview page
                │      │
                │      └─→ renderOverviewPage()
                │             │
                │             ├─→ calculateMetrics(state.orders)
                │             │   Returns: {
                │             │     totalSpent,
                │             │     totalOrders,
                │             │     avgOrderValue,
                │             │     ... more metrics
                │             │   }
                │             │
                │             ├─→ Render KPI cards
                │             │   Show metrics in card format
                │             │
                │             ├─→ Get recent orders
                │             │   state.orders.slice(0, 3)
                │             │
                │             ├─→ Render order cards
                │             │   Display vendor, amount, date
                │             │
                │             ├─→ generateInsights()
                │             │   Analyze data patterns
                │             │   Return AI insights
                │             │
                │             └─→ Render insights
                │                 Display smart suggestions
                │
                └─→ Show status: "Analytics loaded"
                
        Dashboard Ready
                │
        ┌───────┴───────┐
        │               │
        ▼               ▼
    User Clicks      User Clicks
   Sidebar Link      Filter Button
        │               │
        ▼               ▼
  switchPage()      Filter Data
        │               │
        ├─→ Hide old     ├─→ Set startDate
        ├─→ Show new     ├─→ Set endDate
        └─→ Render       ├─→ Call initAnalytics()
           page          └─→ Update all pages
           content
```

---

## 📊 Page Rendering Flow

```
┌─ Overview Page ────────────────────────────┐
│ renderOverviewPage()                       │
│ │                                          │
│ ├─ Metrics: 6 KPI cards                   │
│ │  ├─ Total Spent                         │
│ │  ├─ Total Orders                        │
│ │  ├─ Avg Order Value                     │
│ │  ├─ Completion Rate                     │
│ │  ├─ Favorite Vendor                     │
│ │  └─ Total Items                         │
│ │                                          │
│ ├─ Recent Orders: 3 order cards           │
│ │  ├─ Vendor name                         │
│ │  ├─ Order amount                        │
│ │  ├─ Order date                          │
│ │  └─ Item count                          │
│ │                                          │
│ └─ Insights: Smart recommendations        │
│    ├─ Perfect Track Record                │
│    ├─ Premium Customer                    │
│    ├─ Adventurous Eater                   │
│    └─ Loyalty Suggestion                  │
└────────────────────────────────────────────┘

┌─ Spending Page ────────────────────────────┐
│ renderSpendingPage()                       │
│ │                                          │
│ ├─ Metrics: 3 KPI cards                   │
│ │  ├─ Total Spent                         │
│ │  ├─ Avg per Order                       │
│ │  └─ Monthly Average                     │
│ │                                          │
│ ├─ Charts: 2 visualizations               │
│ │  ├─ Monthly Trend (Line Chart)          │
│ │  │  X-axis: Months (last 12)            │
│ │  │  Y-axis: Amount spent                │
│ │  │  └─ Shows spending trends            │
│ │  │                                      │
│ │  └─ Category Breakdown (Doughnut)      │
│ │     Shows spending per category         │
│ │                                          │
│ └─ Table: Monthly breakdown                │
│    ├─ Month                                │
│    ├─ Total Orders                         │
│    ├─ Total Spent                          │
│    └─ Avg Order Value                      │
└────────────────────────────────────────────┘

┌─ Vendor Page ──────────────────────────────┐
│ renderVendorPage()                         │
│ │                                          │
│ ├─ Metrics: 3 KPI cards                   │
│ │  ├─ Total Vendors                       │
│ │  ├─ Top Vendor Spending                 │
│ │  └─ Avg per Vendor                      │
│ │                                          │
│ ├─ Charts: 2 visualizations               │
│ │  ├─ Vendor Spending (Bar Chart)         │
│ │  │  Top 10 vendors by spending          │
│ │  │                                      │
│ │  └─ Vendor Orders (Bar Chart)           │
│ │     Top 10 vendors by order count       │
│ │                                          │
│ └─ Table: Top vendors ranked               │
│    ├─ Rank                                 │
│    ├─ Vendor Name                          │
│    ├─ Orders                               │
│    ├─ Total Spent                          │
│    └─ Avg Order                            │
└────────────────────────────────────────────┘

┌─ Items Page ───────────────────────────────┐
│ renderItemsPage()                          │
│ │                                          │
│ ├─ Metrics: 3 KPI cards                   │
│ │  ├─ Unique Items                        │
│ │  ├─ Total Ordered                       │
│ │  └─ Favorite Category                   │
│ │                                          │
│ ├─ Charts: 2 visualizations               │
│ │  ├─ Top Items (Bar Chart)               │
│ │  │  Top 10 items by quantity            │
│ │  │                                      │
│ │  └─ Categories (Doughnut)               │
│ │     Spending per category               │
│ │                                          │
│ └─ Table: Top items ranked                 │
│    ├─ Rank                                 │
│    ├─ Item Name                            │
│    ├─ Times Ordered                        │
│    ├─ Total Spent                          │
│    └─ Vendor                               │
└────────────────────────────────────────────┘

┌─ Patterns Page ────────────────────────────┐
│ renderPatternsPage()                       │
│ │                                          │
│ ├─ Metrics: 3 KPI cards                   │
│ │  ├─ Total Orders                        │
│ │  ├─ Avg Items/Order                     │
│ │  └─ Active Vendors                      │
│ │                                          │
│ ├─ Charts: 2 visualizations               │
│ │  ├─ Peak Hours (Line Chart)             │
│ │  │  X-axis: Hours (0-23)                │
│ │  │  Y-axis: Order count                 │
│ │  │                                      │
│ │  └─ Day of Week (Bar Chart)             │
│ │     Orders per day of week              │
│ │                                          │
│ └─ Summary: Ordering habits                │
│    ├─ Most Active Day                      │
│    ├─ Peak Hour                            │
│    ├─ Avg Items per Order                  │
│    └─ Typical Order Time Range             │
└────────────────────────────────────────────┘

┌─ Orders Page ──────────────────────────────┐
│ renderOrdersPage()                         │
│ │                                          │
│ ├─ Metrics: 3 KPI cards                   │
│ │  ├─ Total Orders                        │
│ │  ├─ Completed Orders                    │
│ │  └─ Total Spent                         │
│ │                                          │
│ ├─ Order Cards: Grid of orders            │
│ │  ├─ Vendor Name                         │
│ │  ├─ Order Status                        │
│ │  ├─ Order Amount                        │
│ │  ├─ Order Date                          │
│ │  └─ Item Count                          │
│ │                                          │
│ └─ Status Legend: Explanation              │
│    ├─ Completed (green)                    │
│    └─ Pending (yellow)                     │
└────────────────────────────────────────────┘

┌─ Settings Page ────────────────────────────┐
│ renderSettingsPage()                       │
│ │                                          │
│ ├─ Export Options                          │
│ │  ├─ Export as CSV                        │
│ │  └─ Export as PDF (coming soon)          │
│ │                                          │
│ ├─ Date Range Controls                     │
│ │  ├─ Start Date Input                     │
│ │  ├─ End Date Input                       │
│ │  ├─ Apply Button                         │
│ │  └─ Reset Button                         │
│ │                                          │
│ └─ Analytics Information                   │
│    ├─ Data Updates: Real-time              │
│    ├─ Data Retention: Indefinite           │
│    └─ Last Updated: [timestamp]            │
└────────────────────────────────────────────┘
```

---

## 🏗️ Component Structure

```
analytics-dashboard.html
│
├─ <head>
│  └─ Links to:
│     ├─ analytics-dashboard.css
│     ├─ Chart.js CDN
│     └─ Firebase SDK
│
└─ <body>
   │
   └─ <div class="analytics-layout">
      │
      ├─ <aside class="analytics-sidebar">
      │  │
      │  ├─ Sidebar Header
      │  │  ├─ "📊 My Analytics" Title
      │  │  └─ Hamburger Menu (☰) [Mobile]
      │  │
      │  ├─ Navigation Menu
      │  │  ├─ Overview Link
      │  │  ├─ Spending Link
      │  │  ├─ Vendors Link
      │  │  ├─ Items Link
      │  │  ├─ Patterns Link
      │  │  ├─ Orders Link
      │  │  └─ Settings Link
      │  │
      │  ├─ Filter Section
      │  │  ├─ "DATE RANGE" Label
      │  │  ├─ Start Date Input
      │  │  ├─ End Date Input
      │  │  ├─ Apply Button
      │  │  └─ Reset Button
      │  │
      │  └─ Export Section
      │     ├─ "EXPORT" Label
      │     ├─ Export CSV Button
      │     └─ Export PDF Button
      │
      └─ <main class="analytics-main">
         │
         ├─ Status Bar (hidden by default)
         │
         ├─ <div class="analytics-page" data-page="overview">
         │  ├─ Page Header
         │  ├─ Metrics Grid (6 cards)
         │  ├─ Recent Orders Preview
         │  └─ Insights Container
         │
         ├─ <div class="analytics-page" data-page="spending">
         │  ├─ Page Header
         │  ├─ Metrics Grid (3 cards)
         │  ├─ Charts Grid (2 charts)
         │  └─ Table
         │
         ├─ <div class="analytics-page" data-page="vendors">
         │  ├─ Page Header
         │  ├─ Metrics Grid (3 cards)
         │  ├─ Charts Grid (2 charts)
         │  └─ Table
         │
         ├─ <div class="analytics-page" data-page="items">
         │  ├─ Page Header
         │  ├─ Metrics Grid (3 cards)
         │  ├─ Charts Grid (2 charts)
         │  └─ Table
         │
         ├─ <div class="analytics-page" data-page="patterns">
         │  ├─ Page Header
         │  ├─ Metrics Grid (3 cards)
         │  ├─ Charts Grid (2 charts)
         │  └─ Summary Section
         │
         ├─ <div class="analytics-page" data-page="orders">
         │  ├─ Page Header
         │  ├─ Metrics Grid (3 cards)
         │  ├─ Orders Grid
         │  └─ Status Legend
         │
         └─ <div class="analytics-page" data-page="settings">
            ├─ Page Header
            ├─ Export Section
            ├─ Settings Section
            └─ Info Section
```

---

## 📱 Responsive Breakpoints

```
Desktop View (1024px+)
┌──────────────────────────────────────────────────┐
│                    Navbar                        │
├────────────────┬─────────────────────────────────┤
│                │                                 │
│   SIDEBAR      │         MAIN CONTENT            │
│  (Fixed 280px) │         (Flexible)              │
│                │                                 │
│ - Dashboard    │ ┌─────────────────────────────┐ │
│ - Spending     │ │                             │ │
│ - Vendors      │ │  Page Title                 │ │
│ - Items        │ │                             │ │
│ - Patterns     │ │ ┌───────────┐ ┌───────────┐ │ │
│ - Orders       │ │ │ Metric1   │ │ Metric2   │ │ │
│ - Settings     │ │ └───────────┘ └───────────┘ │ │
│                │ │                             │ │
│ Filters:       │ │ ┌──────────────────────────┐ │ │
│ [Start Date]   │ │ │ Chart                    │ │ │
│ [End Date]     │ │ │                          │ │ │
│ [Apply][Reset] │ │ └──────────────────────────┘ │ │
│                │ │                             │ │
│ Export:        │ │ ┌──────────────────────────┐ │ │
│ [CSV] [PDF]    │ │ │ Table                    │ │ │
│                │ │ │                          │ │ │
│                │ │ └──────────────────────────┘ │ │
│                │ └─────────────────────────────┘ │
└────────────────┴─────────────────────────────────┘

Tablet View (768px - 1024px)
┌────────────────────────────────┐
│          Navbar                │
├────────┬──────────────────────┤
│SIDEBAR │   MAIN CONTENT       │
│(narrow)│                      │
│        │ ┌──────────────────┐ │
│ - Dash │ │ Metric1 Metric2  │ │
│ - Spen │ │ Metric3          │ │
│ - Vend │ │ ┌──────────────┐ │ │
│ - Item │ │ │ Chart        │ │ │
│ - Patt │ │ │              │ │ │
│ - Orde │ │ └──────────────┘ │ │
│ - Sett │ │ ┌──────────────┐ │ │
│        │ │ │ Table        │ │ │
│        │ │ │              │ │ │
│        │ │ └──────────────┘ │ │
│        │ └──────────────────┘ │
└────────┴──────────────────────┘

Mobile View (<768px)
┌────────────────────────┐
│ ☰ My Analytics         │  ← Hamburger toggle
├────────────────────────┤
│                        │
│     SIDEBAR MENU       │  ← Slides down on click
│   [Hide/Show Toggle]   │
│ - Dashboard            │
│ - Spending             │
│ - Vendors              │
│ - Items                │
│ - Patterns             │
│ - Orders               │
│ - Settings             │
│                        │
│ Filters:               │
│ [Start] [End]          │
│ [Apply] [Reset]        │
│                        │
│ Export:                │
│ [CSV] [PDF]            │
│                        │
├────────────────────────┤
│   MAIN CONTENT         │
│ (Full Width)           │
│ ┌────────────────────┐ │
│ │ Metric             │ │
│ │ Metric             │ │
│ │ ┌──────────────┐   │ │
│ │ │ Chart        │   │ │
│ │ │ (Responsive) │   │ │
│ │ └──────────────┘   │ │
│ │ ┌──────────────┐   │ │
│ │ │ Table        │   │ │
│ │ │ (Scrollable) │   │ │
│ │ └──────────────┘   │ │
│ └────────────────────┘ │
└────────────────────────┘
```

---

## 🔐 Security Model

```
User Authentication Flow
│
├─ User opens analytics-dashboard.html
│
├─ Firebase Auth checks: user logged in?
│  │
│  ├─ YES: currentUser.uid available
│  │  └─ Can proceed
│  │
│  └─ NO: Redirect to login
│
└─ Firestore Query with Security Filtering
   │
   ├─ Query: collection('orders')
   │
   ├─ Filter 1: customerUid == currentUser.uid
   │  └─ Only user's orders
   │
   ├─ Filter 2: createdAt >= startDate
   │  └─ Date range filtering
   │
   └─ Filter 3: createdAt <= endDate
      └─ Date range filtering
      
Result: Only user's orders in date range returned

┌─────────────────────────────────────┐
│   What Each User Sees               │
├─────────────────────────────────────┤
│                                     │
│ User A: analytics.uid = AAA        │
│ - Can see: Orders where             │
│   customerUid == 'AAA'              │
│ - Cannot see: Orders where          │
│   customerUid != 'AAA'              │
│                                     │
│ User B: analytics.uid = BBB        │
│ - Can see: Orders where             │
│   customerUid == 'BBB'              │
│ - Cannot see: Orders where          │
│   customerUid != 'BBB'              │
│                                     │
│ Result: No cross-user data access   │
│ ✅ SECURE                           │
│                                     │
└─────────────────────────────────────┘
```

---

## 🎨 Color & Design System

```
Primary Colors:
├─ Purple: #667eea      (Main accent)
├─ Purple Dark: #764ba2 (Secondary accent)
└─ Gray: #f5f5f5        (Background)

Gradient (Sidebar):
└─ linear-gradient(135deg, #667eea 0%, #764ba2 100%)

Chart Colors:
├─ Line: #667eea
├─ Bar Primary: #667eea
├─ Bar Secondary: #764ba2
├─ Doughnut: [#667eea, #764ba2, #f093fb, #4facfe, ...]
└─ Success: #4caf50, Warning: #ff9800, Info: #2196f3

Borders:
├─ Card Border: 2px solid #e0e0e0
├─ Hover Border: #764ba2
└─ Active Border: #ffd700

Text:
├─ Primary: #333
├─ Secondary: #666
├─ Tertiary: #999
└─ Light: rgba(255,255,255,0.9)
```

---

**Visual Guide Version:** 1.0
**Last Updated:** January 2025
