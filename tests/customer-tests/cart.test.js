/**
 * @jest-environment jsdom
 */

const {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal,
  resetCart
} = require("../../public/customer/cart");

describe("Cart Tests", () => {

  beforeEach(() => {
    resetCart();
  });

  test("adds item to cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    expect(getCart().length).toBe(1);
  });

  test("increases quantity", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });
    addToCart({ id: "1", name: "Burger", price: 50 });

    expect(getCart()[0].quantity).toBe(2);
  });

  test("calculates total", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });
    addToCart({ id: "2", name: "Pizza", price: 80 });

    expect(getTotal()).toBe(130);
  });

  test("removes item", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    removeFromCart("1");

    expect(getCart().length).toBe(0);
  });

  test("clears cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    clearCart();

    expect(getCart().length).toBe(0);
  });

});