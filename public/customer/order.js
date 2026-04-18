let orders = [];

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
    orderId: Date.now().toString(),
    userId,
    vendorId,
    items,
    total,
    status: ORDER_STATUS.CREATED,
    createdAt: Date.now()
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
  const order = getOrderById(orderId);
  if (!order) return null;

  if (!Object.values(ORDER_STATUS).includes(status)) {
    throw new Error("Invalid order status");
  }

  order.status = status;
  return order;
}

function cancelOrder(orderId) {
  return updateOrderStatus(orderId, ORDER_STATUS.CANCELLED);
}

function clearOrders() {
  orders = [];
}

module.exports = {
  ORDER_STATUS,
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  clearOrders
};