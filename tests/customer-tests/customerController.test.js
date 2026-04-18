const {
  addItemToCart,
  removeItemFromCart,
  placeOrder,
  cancelCustomerOrder,
  viewMenu
} = require("../../public/customer/customerController");

const { getCart } = require("../../public/customer/cart");
const { getOrders, clearOrders } = require("../../public/customer/order");

describe("Customer Controller Integration Tests", () => {

  beforeEach(() => {
    clearOrders();
  });

  test("view menu returns items", () => {
    const menu = viewMenu();
    expect(menu.length).toBeGreaterThan(0);
  });

  test("adds item to cart", () => {
    addItemToCart("1");

    expect(getCart().length).toBe(1);
    expect(getCart()[0].id).toBe("1");
  });

  test("removes item from cart", () => {
    addItemToCart("1");
    removeItemFromCart("1");

    expect(getCart().length).toBe(0);
  });

  test("places order from cart", () => {
    addItemToCart("1");

    const order = placeOrder("user1", "vendor1");

    expect(order.userId).toBe("user1");
    expect(getCart().length).toBe(0); // IMPORTANT
  });

  test("cancels order", () => {
  addItemToCart("1"); // REQUIRED

  const order = placeOrder("user1", "vendor1");

  const result = cancelCustomerOrder(order.orderId);

  expect(result).toBeDefined();
    });

});