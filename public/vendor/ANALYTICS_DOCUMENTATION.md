# Vendor Analytics Dashboard - Feature Documentation

## Overview

The Vendor Analytics Dashboard is a comprehensive business intelligence tool that enables vendors to track their performance, understand customer behavior, and optimize their operations. This feature provides vendors with actionable insights through interactive visualizations, detailed metrics, and data export capabilities.

---

## Features

### 1. **Key Performance Indicators (KPIs)**

Six primary metrics are displayed at the top of the dashboard:

- **Total Revenue**: Cumulative sales revenue for the selected period (in ZAR)
- **Total Orders**: Count of all orders (completed, pending, cancelled)
- **Average Order Value**: Mean revenue per order
- **Completion Rate**: Percentage of orders that reached "completed" status
- **Total Items Sold**: Total quantity of items sold across all orders
- **Average Items per Order**: Mean number of items per order

**Use Case**: Quickly assess business health and performance trends.

### 2. **Interactive Charts**

#### Peak Hours Analysis
- **Chart Type**: Line chart
- **Purpose**: Identify when customers order most frequently
- **Data**: Order count by hour of day (0-23)
- **Action**: Use this to optimize staffing levels and inventory management

#### Top Selling Items
- **Chart Type**: Doughnut chart
- **Purpose**: Identify best-performing menu items
- **Data**: Top 10 items by quantity sold
- **Action**: Keep popular items well-stocked and consider featuring them prominently

#### Daily Revenue Trend
- **Chart Type**: Line chart
- **Purpose**: Track revenue patterns over time
- **Data**: Revenue by day for the selected period
- **Action**: Identify seasonal trends and plan marketing campaigns accordingly

#### Order Status Distribution
- **Chart Type**: Pie chart
- **Purpose**: Monitor order lifecycle efficiency
- **Data**: Breakdown of orders by status (completed, pending, cancelled, etc.)
- **Action**: Identify bottlenecks in the order fulfillment process

#### Category Performance
- **Chart Type**: Bar chart
- **Purpose**: Understand which product categories generate most revenue
- **Data**: Top categories by revenue
- **Action**: Allocate menu space and resources to high-performing categories

#### Weekly Comparison
- **Chart Type**: Line chart
- **Purpose**: Compare week-over-week performance
- **Data**: Revenue by week
- **Action**: Detect trends and plan promotions during slow periods

### 3. **Item Performance Tables**

#### Top 10 Items
Displays the best-performing items with:
- Rank
- Item Name
- Category
- Quantity Sold
- Revenue Generated
- Average Price

#### Bottom Items (Needs Attention)
Shows underperforming items to help identify:
- Items to remove or redesign
- Potential for bundling with popular items
- Pricing issues

### 4. **AI-Powered Insights**

The dashboard automatically generates contextual recommendations:

- **Peak Hours Alert**: Identifies the busiest hour and suggests staffing adjustments
- **Best Seller Recognition**: Highlights top items with revenue figures
- **Completion Rate Status**: Alerts if completion rate is below 80%, or praises high rates
- **Revenue Overview**: Provides comprehensive revenue statistics
- **Category Performance**: Identifies the top-performing category
- **Menu Optimization**: Flags underperforming items requiring attention

### 5. **Date Filtering**

- **Start Date**: Select beginning of analysis period
- **End Date**: Select end of analysis period
- **Apply Filter**: Updates all charts and metrics based on selected range
- **Reset**: Returns to default 30-day range

**Default Range**: Last 30 days from today

### 6. **Data Export**

- **Format**: CSV (Comma-Separated Values)
- **Content**: Complete analytics data including:
  - Summary metrics
  - Peak hours breakdown
  - Top items with revenues
  - Daily revenue breakdown
  - Category performance
- **File Naming**: `vendor-analytics-[DATE].csv`
- **Use**: Import into spreadsheet applications, business intelligence tools, or create custom reports

### 7. **Data Refresh**

- **Manual Refresh**: Click "Refresh Data" to pull latest orders from Firestore
- **Real-time Updates**: Each refresh fetches all orders where `vendorUid` matches current user
- **Auto-calculations**: All metrics and charts update automatically

---

## Security & Privacy

### Data Access Control

✅ **Vendor-Specific Data Only**
- Each vendor can ONLY view their own analytics
- Data is filtered by `vendorUid` from Firebase Authentication
- Backend queries enforce `where("vendorUid", "==", currentUser.uid)`

### Implementation Details

```javascript
// All orders are fetched with vendor-specific filter
const ordersRef = collection(db, "orders");
const q = query(ordersRef, where("vendorUid", "==", vendorUid));
const snapshot = await getDocs(q);
```

### Authentication

- Users must be authenticated to access the dashboard
- Auto-redirect to login page if not authenticated
- Session persists using Firebase Authentication

---

## Data Calculations

### Metrics Calculation

```
Total Revenue = SUM(order.paymentAmount) for all orders
Total Orders = COUNT(orders)
Completion Rate = (COUNT(orders where status == "completed") / Total Orders) × 100%
Average Order Value = Total Revenue / Total Orders
Total Items Sold = SUM(item.quantity) for all items in all orders
Average Items per Order = Total Items Sold / Total Orders
```

### Peak Hours

Hours are extracted from `order.createdAt` timestamp:
```javascript
const hour = getDateFromTimestamp(order.createdAt).getHours();
peakHours[hour]++; // Count orders by hour
```

### Top Items

Items are aggregated by `menuItemId` and sorted by quantity:
```
Item Metrics:
- Quantity = SUM(item.quantity) for each unique item
- Revenue = SUM(item.quantity × item.price)
- Avg Price = Revenue / Quantity
```

### Category Performance

Categories are extracted from `item.category`:
```
Category Revenue = SUM(item.quantity × item.price) grouped by category
Category Items = SUM(item.quantity) grouped by category
```

### Daily/Weekly Breakdown

Dates are extracted from `order.createdAt`:
```
Daily: Group by date (YYYY-MM-DD)
Weekly: Group by ISO week number
```

---

## Data Structure from Firestore

The analytics feature uses the following fields from the `orders` collection:

```javascript
{
  createdAt: Timestamp,           // When order was created (used for peak hours)
  vendorUid: string,               // Vendor identifier (security filter)
  status: string,                  // Order status (completed, pending, etc.)
  paymentAmount: number,           // Total order amount in minor units
  totalAmount: number,             // Alternative amount field
  items: [
    {
      menuItemId: string,          // Item identifier
      name: string,                // Item name
      category: string,            // Item category
      quantity: number,            // Units sold
      price: number,               // Price per unit
      notes: string               // Optional notes
    }
  ]
}
```

---

## Usage Guide

### Step 1: Access Analytics
1. Log in as a vendor
2. Click "Analytics" in the navigation menu
3. Dashboard loads with default 30-day data

### Step 2: Set Date Range
1. Modify "Start Date" and "End Date" fields
2. Click "Apply Filter"
3. All charts and metrics update automatically

### Step 3: Analyze Performance
1. **Review KPIs**: Check overall health metrics at the top
2. **Examine Charts**: Understand patterns and trends
3. **Read Insights**: Review AI-generated recommendations
4. **Compare Items**: Check top and bottom performing items

### Step 4: Take Action
Based on insights, vendors can:
- Increase stock of best-selling items
- Remove or revamp underperforming items
- Adjust staffing during peak hours
- Optimize menu categories
- Plan promotions during slow periods

### Step 5: Export Data
1. Click "📥 Export to CSV"
2. File downloads to your computer
3. Open in Excel, Google Sheets, or analytics tools

---

## Browser Compatibility

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- Mobile browsers (responsive design)

### Required JavaScript Features

- ES6+ support
- Fetch API
- LocalStorage
- Canvas API (for Chart.js)

---

## Performance Considerations

- **Initial Load**: Queries all vendor orders from Firestore (~100-1000 orders typical)
- **Chart Rendering**: 6 Chart.js instances run simultaneously
- **Large Datasets**: Dashboard handles 5000+ orders efficiently
- **Export**: CSV generation handles large datasets (1000+ rows)

### Optimization Tips

1. Use date filters to narrow analysis scope
2. Review monthly trends rather than all-time data
3. Export data periodically for historical analysis

---

## Advanced Features & Suggestions

### Additional Sub-Features Implemented

1. **Weekly Comparison Charts**: Compare revenue trends week-over-week
2. **Category Analysis**: Detailed breakdown of sales by food category
3. **Item-Level Details**: Comprehensive tables with top and bottom performers
4. **Status Distribution**: Understand order fulfillment patterns
5. **Smart Insights**: AI-generated recommendations based on data

### Potential Future Enhancements

1. **Predictive Analytics**: Forecast revenue based on historical trends
2. **Customer Segmentation**: Identify repeat vs. new customers
3. **Rating & Reviews**: Track customer satisfaction scores
4. **Inventory Integration**: Link to stock levels for smarter recommendations
5. **Competitor Benchmarking**: Compare metrics against similar vendors
6. **Email Reports**: Automated weekly/monthly summary emails
7. **Real-time Dashboard**: Live order notifications on analytics page
8. **Custom Dashboards**: Vendors can create custom metric views
9. **Advanced Filtering**: Filter by item, category, customer, payment method
10. **Attribution Analysis**: Track which promotions drive most sales

---

## API & Dependencies

### External Libraries

- **Chart.js 4.4.0**: Interactive chart library
  - Source: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
  - Charts: Line, Doughnut, Pie, Bar

### Firebase Integration

- **Firestore**: Order data retrieval
- **Firebase Auth**: Vendor authentication
- **Security Rules**: Enforced at Firestore level

### Internal Dependencies

```javascript
// Auth modules
- ../authentication/auth-utils.js
- ../authentication/auth-core.js
- ../authentication/config.js
- ../authentication/auth.js

// Order modules
- ../shared/orders/order-status.js
- ../shared/orders/order-model.js
- ../shared/orders/order-queries.js
- ../shared/orders/order-service.js
- ../shared/orders/order-formatters.js
- ../shared/payments/payment-status.js
- ../shared/payments/payment-model.js
- ../shared/payments/payment-formatters.js
```

---

## Troubleshooting

### Charts Not Displaying

**Issue**: Charts appear blank or don't render
- **Solution**: Ensure Chart.js CDN is accessible and browser allows canvas

### No Data Showing

**Issue**: Analytics page shows empty results
- **Solution**: 
  - Verify vendor has completed orders in database
  - Check date range includes actual orders
  - Refresh page and try again

### Slow Performance

**Issue**: Dashboard takes long to load
- **Solution**:
  - Use a smaller date range
  - Close other browser tabs
  - Check internet connection

### Export Not Working

**Issue**: CSV download fails
- **Solution**:
  - Check browser pop-up blockers
  - Ensure there is data to export
  - Try a different browser

### Authentication Issues

**Issue**: Redirected to login page
- **Solution**:
  - Verify you're logged in as vendor
  - Clear browser cache
  - Re-authenticate

---

## Contact & Support

For issues or feature requests regarding the Analytics Dashboard, contact the development team or create an issue in the project repository.

---

**Last Updated**: May 2026  
**Version**: 1.0  
**Status**: Production Ready
