const {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal,
  resetCart
} = require("../cart");

const {
  createOrder,
  getOrders,
  getOrderById,
  updateOrderStatus,
  cancelOrder,
  clearOrders,
  ORDER_STATUS
} = require("../../public/customer/order");

describe("FULL ORDER MANAGEMENT SYSTEM (TDD)", () => {

  beforeEach(() => {
    resetCart();
    clearOrders();
  });

  // ---------------- CART TESTS ----------------
  test("adds items to cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    expect(getCart().length).toBe(1);
    expect(getCart()[0].quantity).toBe(1);
  });

  test("increases quantity for same item", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });
    addToCart({ id: "1", name: "Burger", price: 50 });

    expect(getCart()[0].quantity).toBe(2);
  });

  test("calculates correct total", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });
    addToCart({ id: "2", name: "Pizza", price: 80 });

    expect(getTotal()).toBe(130);
  });

  test("removes item from cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    removeFromCart("1");

    expect(getCart().length).toBe(0);
  });

  test("clears cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    clearCart();

    expect(getCart().length).toBe(0);
  });

  // ---------------- ORDER TESTS ----------------
  test("creates order from cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    const order = createOrder(
      "user1",
      "vendor1",
      getCart(),
      getTotal()
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

});