# Customer Analytics Dashboard - Feature Documentation

## Overview

The Customer Analytics Dashboard empowers customers to track their spending habits, discover their food preferences, and gain insights into their ordering patterns on the Campus Food Ordering Platform. This feature provides personalized, data-driven insights to help customers understand their consumption behavior.

---

## Features

### 1. **Spending Overview Metrics**

Six key metrics display at the top of the dashboard:

- **Total Spent**: Cumulative spending across all orders (in ZAR)
- **Total Orders**: Count of all orders placed by the customer
- **Average Order Value**: Mean spending per order
- **Favorite Vendor**: Vendor where the customer spends the most money
- **Total Items Ordered**: Total quantity of items purchased
- **Most Used Vendor**: Vendor with the most orders from this customer

**Use Case**: Get an at-a-glance view of spending and ordering habits.

### 2. **Interactive Charts**

#### Monthly Spending Trend
- **Chart Type**: Line chart
- **Purpose**: Visualize spending patterns over time
- **Data**: Monthly expenditure over the last 12 months
- **Action**: Identify seasonal spending patterns and budget trends

#### Spending by Vendor
- **Chart Type**: Bar chart
- **Purpose**: Understand budget distribution across vendors
- **Data**: Top 8 vendors by total spending
- **Action**: Recognize favorite vendors and explore new ones

#### Your Favorite Items
- **Chart Type**: Doughnut chart
- **Purpose**: See which items are ordered most frequently
- **Data**: Top 10 most ordered items
- **Action**: Quick access to go-to menu items

#### When You Order
- **Chart Type**: Line chart
- **Purpose**: Identify your typical ordering times
- **Data**: Order frequency by hour of day (0-23)
- **Action**: Understand your daily rhythm and peak ordering times

#### Category Preferences
- **Chart Type**: Bar chart
- **Purpose**: Track spending by food category
- **Data**: Top 8 food categories by spending
- **Action**: Discover which cuisine types you prefer

#### Top Vendors
- **Chart Type**: Doughnut chart
- **Purpose**: See which vendors you order from most
- **Data**: Top 6 vendors by number of orders
- **Action**: Identify your go-to vendors

### 3. **Detailed Preference Tables**

#### Your Top 10 Items
Displays favorite items with:
- Rank
- Item Name
- Vendor
- Times Ordered
- Total Spent
- Average Price

#### Your Top Vendors
Shows vendors sorted by order frequency:
- Rank
- Vendor Name
- Number of Orders
- Total Spent
- Average Order Value
- Last Order Date

### 4. **Personal Insights**

Automatically generated insights include:

- **Spending Summary**: Total spent, orders placed, and average monthly spending
- **Favorite Vendor**: Recognition of your most-visited vendor with spending details
- **Go-To Item**: Your most frequently ordered item
- **Ordering Habits**: Your peak ordering time
- **Favorite Category**: Your preferred food category
- **Vendor Diversity**: Tips to explore new vendors or recognition for adventurous ordering
- **Order Patterns**: Average items per order and total statistics

### 5. **Recent Orders Summary**

Latest 6 orders displayed with:
- Vendor name
- Order status (completed, pending, cancelled)
- Amount spent
- Date and time
- Item count
- Item list

### 6. **Date Filtering**

- **Start Date**: Select beginning of analysis period
- **End Date**: Select end of analysis period
- **Apply Filter**: Updates all analytics based on selected range
- **Reset**: Returns to default 12-month range

**Default Range**: Last 12 months from today

### 7. **Data Export**

- **Format**: CSV (Comma-Separated Values)
- **Content**: Complete spending analytics including:
  - Summary metrics
  - Top vendors and spending breakdown
  - Favorite items and frequency
  - Monthly spending trends
  - Category preferences
- **File Naming**: `customer-analytics-[DATE].csv`
- **Use**: Import into budgeting apps, personal finance trackers, or create custom reports

### 8. **Data Refresh**

- **Manual Refresh**: Click "Refresh Data" to pull latest orders
- **Real-time Updates**: Fetches all orders where `customerUid` matches current user
- **Auto-calculations**: All metrics and charts update automatically

---

## Security & Privacy

### Data Access Control

✅ **Customer-Specific Data Only**
- Each customer sees ONLY their own orders and analytics
- Data is filtered by `customerUid` from Firebase Authentication
- Backend queries enforce `where("customerUid", "==", currentUser.uid)`

### Implementation Details

```javascript
// All orders are fetched with customer-specific filter
const ordersRef = collection(db, "orders");
const q = query(ordersRef, where("customerUid", "==", customerUid));
const snapshot = await getDocs(q);
```

### Authentication

- Users must be authenticated to access analytics
- Auto-redirect to login page if not authenticated
- Session persists using Firebase Authentication

---

## Data Calculations

### Metrics Calculation

```
Total Spent = SUM(order.paymentAmount) for all orders
Total Orders = COUNT(orders)
Average Order Value = Total Spent / Total Orders
Total Items = SUM(item.quantity) for all items
Average Items per Order = Total Items / Total Orders
```

### Vendor Analysis

```
Favorite Vendor = Vendor with highest SUM(order.paymentAmount)
Most Used Vendor = Vendor with highest COUNT(orders)
Vendor Spending = SUM(order.paymentAmount) grouped by vendor
Vendor Orders = COUNT(orders) grouped by vendor
```

### Item Frequency

Items are aggregated by `menuItemId`:
```
Times Ordered = SUM(item.quantity) for each unique item
Total Spent = SUM(item.quantity × item.price)
Average Price = Total Spent / Times Ordered
```

### Category Preferences

Categories are extracted from `item.category`:
```
Category Spending = SUM(item.quantity × item.price) grouped by category
Category Items = SUM(item.quantity) grouped by category
```

### Temporal Analysis

```
Monthly: Group orders by year-month
Hourly: Extract hour from order.createdAt timestamp
```

---

## Data Structure from Firestore

The analytics feature uses the following fields from the `orders` collection:

```javascript
{
  createdAt: Timestamp,           // When order was placed (for temporal analysis)
  customerUid: string,             // Customer identifier (security filter)
  vendorName: string,              // Vendor name
  vendorUid: string,               // Vendor ID
  status: string,                  // Order status
  paymentAmount: number,           // Total order amount
  totalAmount: number,             // Alternative amount field
  itemCount: number,               // Number of items
  items: [
    {
      menuItemId: string,          // Item identifier
      name: string,                // Item name
      category: string,            // Item category
      quantity: number,            // Quantity purchased
      price: number,               // Price per unit
    }
  ]
}
```

---

## Usage Guide

### Step 1: Access Your Analytics
1. Log in as a customer
2. Click "My Analytics" in the navigation menu
3. Dashboard loads with default 12-month data

### Step 2: Review Your Metrics
1. **Check Top Cards**: See total spending, orders, and favorites
2. **Read Summary**: Understand your spending patterns
3. **View Charts**: Explore visual representations

### Step 3: Analyze Your Preferences
1. **Check Tables**: View top items and favorite vendors
2. **Recent Orders**: See your last 6 orders
3. **Read Insights**: Get personalized recommendations

### Step 4: Adjust Date Range (Optional)
1. Modify "Start Date" and "End Date" fields
2. Click "Apply Filter"
3. All charts and metrics update automatically

### Step 5: Export Data
1. Click "📥 Export to CSV"
2. File downloads to your computer
3. Open in Excel or Google Sheets for further analysis

---

## Use Cases & Benefits

### Budget Tracking
- Monitor monthly spending trends
- Identify high-spending periods
- Plan food budget based on historical data

### Discovering Preferences
- Learn your favorite vendors and items
- Find new vendors in preferred categories
- Explore diverse food options

### Optimization
- Identify peak ordering times for quick service
- Find your go-to items for faster ordering
- Switch vendors based on average prices

### Social & Sharing
- Export analytics to share food preferences with friends
- Track spending with roommates for shared meals
- Plan group orders based on preferences

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

- **Initial Load**: Queries all customer orders from Firestore (typically 50-500 orders)
- **Chart Rendering**: 6 Chart.js instances run simultaneously
- **Large Datasets**: Dashboard handles 2000+ orders efficiently
- **Export**: CSV generation handles large datasets (1000+ rows)

### Optimization Tips

1. Use date filters to narrow analysis scope
2. Review recent data more frequently than all-time data
3. Export data periodically for historical comparison

---

## Advanced Features Implemented

### Core Capabilities

1. **Temporal Analysis**: Monthly trends and hourly patterns
2. **Vendor Intelligence**: Spending and order frequency by vendor
3. **Item Preferences**: Track favorite items and categories
4. **Comparative Metrics**: Last order dates and frequency comparisons
5. **Personal Insights**: AI-generated, contextual recommendations
6. **Recent Orders**: Quick reference to latest purchases

### Smart Insights Generated

1. **Spending Summary**: Total spent and monthly averages
2. **Vendor Recognition**: Favorite and most-used vendor identification
3. **Item Discovery**: Go-to items and categories
4. **Habit Analysis**: Peak ordering times
5. **Diversity Assessment**: Vendor exploration tips
6. **Pattern Recognition**: Average order composition

---

## Future Enhancement Suggestions

1. **Budget Goals**: Set spending targets and track progress
2. **Spending Alerts**: Notifications when approaching monthly limits
3. **Nutritional Analysis**: Track calories and macronutrients
4. **Price Tracking**: Compare prices across vendors
5. **Loyalty Programs**: Track points and rewards
6. **Meal Planning**: Suggest vendors based on history
7. **Friend Comparison**: Anonymous spending comparisons
8. **Seasonal Trends**: Identify seasonal ordering patterns
9. **Recommendations**: AI-powered vendor and item suggestions
10. **Wishlist**: Save items to order later

---

## API & Dependencies

### External Libraries

- **Chart.js 4.4.0**: Interactive chart library
  - Source: `https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js`
  - Charts: Line, Doughnut, Bar

### Firebase Integration

- **Firestore**: Order data retrieval
- **Firebase Auth**: Customer authentication
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
  - Verify you have placed orders in the system
  - Check date range includes your actual orders
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
  - Verify you're logged in as customer
  - Clear browser cache
  - Re-authenticate

---

## Contact & Support

For issues or feature requests regarding the Customer Analytics Dashboard, contact the development team or create an issue in the project repository.

---

**Last Updated**: May 2026  
**Version**: 1.0  
**Status**: Production Ready
