/**
 * @jest-environment jsdom
 */

global.alert = jest.fn();
const {
  renderMenu,
  renderCart,
  cancelOrder
} = require("../../public/customer/menu");

const {
  addToCart,
  getCart,
  resetCart
} = require("../../public/customer/cart");

describe("Menu + Cart UI", () => {

  beforeEach(() => {
    document.body.innerHTML = `
      <section id="menu"></section>
      <section id="cart"></section>
      <section id="total"></section>
    `;
    resetCart();
  });

  test("renders menu items", () => {
    renderMenu();

    const menuDiv = document.getElementById("menu");
    expect(menuDiv.children.length).toBeGreaterThan(0);
  });

  test("adds item to cart via UI", () => {
    renderMenu();

    const firstButton = document.querySelector("#menu button");
    firstButton.click();

    expect(getCart().length).toBe(1);
  });

  test("renders cart correctly", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    renderCart();

    const cartDiv = document.getElementById("cart");
    expect(cartDiv.children.length).toBe(1);
  });

  test("removes item from cart via UI", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    renderCart();

    const removeBtn = document.querySelector("#cart button");
    removeBtn.click();

    expect(getCart().length).toBe(0);
  });

  test("cancelOrder clears cart", () => {
    addToCart({ id: "1", name: "Burger", price: 50 });

    cancelOrder();

    expect(getCart().length).toBe(0);
  });

});