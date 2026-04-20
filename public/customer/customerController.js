import {
  getMenu
} from "./menu.js";

import {
  addToCart,
  removeFromCart,
  getCart,
  getTotal,
  clearCart
} from "./cart.js";

import {
  createOrder,
  cancelOrder
} from "./order.js";


export function viewMenu() {
  return getMenu();
}


export function addItemToCart(itemId) {
  const menu = getMenu();
  const item = menu.find(i => i.id === itemId);

  if (!item) throw new Error("Item not found");

  addToCart(item);
  return getCart();
}


export function removeItemFromCart(itemId) {
  removeFromCart(itemId);
  return getCart();
}


export function placeOrder(userId, vendorId) {
  const items = getCart();
  const total = getTotal();

  if (items.length === 0) {
    throw new Error("Cart empty");
  }

  const order = createOrder(userId, vendorId, items, total);

  clearCart();

  return order;
}


export function cancelCustomerOrder(orderId) {
  return cancelOrder(orderId);
}