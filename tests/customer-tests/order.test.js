const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  clearOrders,
  ORDER_STATUS
} = require("../../public/customer/order");

describe("Order Tracking System", () => {

  beforeEach(() => {
    clearOrders();
  });

  test("creates an order with default status CREATED", () => {
    const order = createOrder(
      "user1",
      "vendor1",
      [{ id: "1", name: "Burger", price: 50 }],
      50
    );

    expect(order.status).toBe(ORDER_STATUS.CREATED);
    expect(getOrders().length).toBe(1);
  });

  test("updates order status", () => {
    const order = createOrder("u1", "v1", [], 0);

    updateOrderStatus(order.orderId, ORDER_STATUS.PREPARING);

    expect(getOrderById(order.orderId).status).toBe(ORDER_STATUS.PREPARING);
  });

  test("cancels order", () => {
    const order = createOrder("u1", "v1", [], 0);

    cancelOrder(order.orderId);

    expect(getOrderById(order.orderId).status).toBe(ORDER_STATUS.CANCELLED);
  });

  test("rejects invalid status", () => {
    const order = createOrder("u1", "v1", [], 0);

    expect(() =>
      updateOrderStatus(order.orderId, "UNKNOWN")
    ).toThrow("Invalid order status");
  });

});