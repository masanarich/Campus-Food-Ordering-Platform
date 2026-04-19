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
};