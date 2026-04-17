const {
  addToCart,
  removeFromCart,
  clearCart,
  getCart
} = require("../customer-tests/cart");

beforeEach(() => {
  clearCart();
});

test("adds item to cart", () => {
  addToCart({ id: "1", name: "Burger", price: 50 });

  expect(getCart().length).toBe(1);
});

test("increases quantity if item exists", () => {
  addToCart({ id: "1", name: "Burger", price: 50 });
  addToCart({ id: "1", name: "Burger", price: 50 });

  expect(getCart()[0].quantity).toBe(2);
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