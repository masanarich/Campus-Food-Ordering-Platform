/*let orders = [];

const ORDER_STATUS = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

function createOrder(userId, vendorId, items, total) {
  const order = {
    orderId: String(Date.now()),
    userId,
    vendorId,
    items,
    total,
    status: ORDER_STATUS.CREATED
  };

  orders.push(order);
  return order;
}

function getOrders() {
  return orders;
}

function getOrderById(orderId) {
  return orders.find(o => o.orderId === orderId);
}

function updateOrderStatus(orderId, status) {
  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw new Error("Invalid order status");
  }

  const order = getOrderById(orderId);
  if (order) order.status = status;

  return order;
}

function cancelOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
}

function clearOrders() {
  orders = [];
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  clearOrders,
  ORDER_STATUS
};*/

let orders = [];

const ORDER_STATUS = {
  CREATED: "CREATED",
  PENDING: "PENDING",
  PREPARING: "PREPARING",
  READY: "READY",
  COMPLETED: "COMPLETED",
  CANCELLED: "CANCELLED"
};

// 🔹 Create order
function createOrder(userId, vendorId, items, total) {
  const order = {
    orderId: generateOrderId(),
    userId,
    vendorId,
    items,
    total,
    status: ORDER_STATUS.CREATED,
    createdAt: new Date()
  };

  orders.push(order);
  return order;
}

// 🔹 Get all orders
function getOrders() {
  return orders;
}

// 🔹 Get single order
function getOrderById(orderId) {
  return orders.find(o => o.orderId === orderId);
}

// 🔹 Update order status (safer version)
function updateOrderStatus(orderId, status) {
  if (!ORDER_STATUS[status]) {
    throw new Error("Invalid order status");
  }

  const order = getOrderById(orderId);

  if (!order) {
    throw new Error("Order not found");
  }

  order.status = status;
  return order;
}

// 🔹 Cancel order
function cancelOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
}

// 🔹 Clear all orders (admin/debug use)
function clearOrders() {
  orders = [];
}

// 🔹 Generate better order ID
function generateOrderId() {
  return "ORD-" + Date.now();
}

module.exports = {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  clearOrders,
  ORDER_STATUS
};