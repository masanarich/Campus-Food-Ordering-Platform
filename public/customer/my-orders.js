/**
 * my-orders.js
 *
 * Handles fetching and displaying customer orders from Firestore.
 * Displays order history with items, totals, status, and timestamps.
 */

// Get the current user ID (you'll need to integrate with your auth system)
async function getCurrentUserId() {
  try {
    // This will get the current user from localStorage or session
    // You should integrate this with your Firebase Auth
    const userJson = localStorage.getItem('currentUser');
    if (userJson) {
      const user = JSON.parse(userJson);
      return user.uid || user.id;
    }
    return null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
}

/**
 * Fetch customer orders from the server
 */
async function fetchCustomerOrders(customerId) {
  try {
    // If no customerId, fetch all orders
    let endpoint = '/api/orders';
    
    if (customerId) {
      endpoint = `/api/orders/customer/${customerId}`;
    }
    
    const response = await fetch(endpoint);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch orders: ${response.statusText}`);
    }
    
    const data = await response.json();
    
    // Handle both old and new response formats
    if (data.orders) {
      return data.orders;
    } else if (Array.isArray(data)) {
      return data;
    }
    
    return [];
  } catch (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }
}

/**
 * Format Firestore timestamp to readable date
 */
function formatTimestamp(timestamp) {
  if (!timestamp) return 'Unknown date';
  
  let date;
  if (timestamp.toDate && typeof timestamp.toDate === 'function') {
    // Firestore Timestamp object
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (typeof timestamp === 'number') {
    // Milliseconds since epoch
    date = new Date(timestamp);
  } else if (typeof timestamp === 'string') {
    date = new Date(timestamp);
  } else {
    return 'Unknown date';
  }
  
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(date);
}

/**
 * Get status badge class
 */
function getStatusClass(status) {
  const statusLower = (status || '').toLowerCase();
  if (statusLower.includes('pending')) return 'status-pending';
  if (statusLower.includes('preparing')) return 'status-preparing';
  if (statusLower.includes('ready')) return 'status-ready';
  return 'status-pending';
}

/**
 * Render a single order card
 */
function renderOrderCard(order) {
  const {
    id,
    items = [],
    status = 'pending',
    totalAmount = 0,
    vendorID = 'Unknown Vendor',
    CreatedAt
  } = order;

  const itemsHtml = items.map(item => `
    <div class="item">
      <div class="item-name">${item.name || 'Unknown Item'}</div>
      <div class="item-details">
        Quantity: ${item.Quantity || 1} × R${(item.price || 0).toFixed(2)}
      </div>
    </div>
  `).join('');

  const statusClass = getStatusClass(status);
  const createdAtFormatted = formatTimestamp(CreatedAt);

  return `
    <div class="order-card">
      <div class="order-header">
        <span class="order-id">Order #${id.substring(0, 8)}</span>
        <span class="order-status ${statusClass}">${status}</span>
      </div>
      
      <div class="order-details">
        <p><span class="detail-label">Vendor:</span> ${vendorID}</p>
        <p class="vendor-badge">Vendor ID: ${vendorID}</p>
      </div>

      <div class="order-items">
        <h4>Items</h4>
        ${itemsHtml || '<p>No items</p>'}
      </div>

      <div class="order-total">
        Total: R${totalAmount.toFixed(2)}
      </div>

      <div class="order-timestamp">
        Ordered: ${createdAtFormatted}
      </div>
    </div>
  `;
}

/**
 * Render orders list
 */
function renderOrders(orders) {
  const ordersContainer = document.getElementById('orders-content');
  
  if (!orders || orders.length === 0) {
    ordersContainer.innerHTML = `
      <div class="no-orders">
        <p>You haven't placed any orders yet.</p>
        <p><a href="./browse-stores.html">Start ordering now!</a></p>
      </div>
    `;
    return;
  }

  const ordersHtml = orders.map(order => renderOrderCard(order)).join('');
  ordersContainer.innerHTML = `<div class="orders-list">${ordersHtml}</div>`;
}

/**
 * Display error message
 */
function showError(message) {
  const errorContainer = document.getElementById('error-container');
  errorContainer.innerHTML = `
    <div class="error-message">
      <strong>Error:</strong> ${message}
    </div>
  `;
}

/**
 * Load and display customer orders
 */
async function loadOrders() {
  try {
    const ordersContainer = document.getElementById('orders-content');
    ordersContainer.innerHTML = '<div class="loading">Loading your orders...</div>';

    // Get current user ID (default to "1" for testing/development)
    let userId = await getCurrentUserId();
    if (!userId) {
      userId = "1"; // Default to CustomerID 1
    }
    
    // Fetch orders (with or without userId filter)
    const orders = await fetchCustomerOrders(userId);

    // Sort orders by creation date (newest first)
    orders.sort((a, b) => {
      const timeA = a.CreatedAt?.toMillis?.() || new Date(a.CreatedAt).getTime() || 0;
      const timeB = b.CreatedAt?.toMillis?.() || new Date(b.CreatedAt).getTime() || 0;
      return timeB - timeA;
    });

    renderOrders(orders);
  } catch (error) {
    console.error('Failed to load orders:', error);
    showError(error.message || 'Failed to load your orders. Please try again later.');
    document.getElementById('orders-content').innerHTML = '';
  }
}

/**
 * Set up real-time updates using Socket.io
 */
function setupRealtimeUpdates() {
  try {
    // Check if Socket.io is available
    if (typeof io !== 'undefined') {
      const socket = io();

      // Listen for order updates
      socket.on('order-created', (order) => {
        console.log('New order created:', order);
        loadOrders(); // Reload orders
      });

      socket.on('order-updated', (order) => {
        console.log('Order updated:', order);
        loadOrders(); // Reload orders
      });

      socket.on('bootstrap-orders', (data) => {
        console.log('Bootstrap orders received:', data);
      });
    }
  } catch (error) {
    console.log('Socket.io not available, using polling only:', error);
  }
}

/**
 * Initialize the page
 */
document.addEventListener('DOMContentLoaded', () => {
  loadOrders();
  setupRealtimeUpdates();

  // Refresh orders every 30 seconds
  setInterval(() => {
    loadOrders();
  }, 30000);
});
