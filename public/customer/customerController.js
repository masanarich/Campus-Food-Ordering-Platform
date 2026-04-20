/*const { getMenu } = require("./menu");

const {
  addToCart,
  removeFromCart,
  getCart,
  getTotal,
  clearCart
} = require("./cart");

const {
  createOrder,
  cancelOrder
} = require("./order");

function viewMenu() {
  return getMenu();
}

function addItemToCart(itemId) {
  const menu = getMenu();
  const item = menu.find(i => i.id === itemId);

  if (!item) throw new Error("Item not found");

  addToCart(item);
  return getCart();
}

function removeItemFromCart(itemId) {
  removeFromCart(itemId);
  return getCart();
}

function placeOrder(userId, vendorId) {
  const items = getCart();
  const total = getTotal();

  if (items.length === 0) {
    throw new Error("Cart empty");
  }

  const order = createOrder(userId, vendorId, items, total);

  clearCart();

  return order;
}

function cancelCustomerOrder(orderId) {
  return cancelOrder(orderId);
}

module.exports = {
  viewMenu,
  addItemToCart,
  removeItemFromCart,
  placeOrder,
  cancelCustomerOrder
};*/

const { getMenu } = require("./menu");
const { createOrder, cancelOrder } = require("./order");

/**
 * View menu items
 */
function viewMenu() {
  return getMenu();
}

/**
 * Add item to cart (ONLY works if backend manages cart state)
 * ⚠️ Not used in your current frontend setup, but kept for completeness
 */
function addItemToCart(itemId, cart) {
  const menu = getMenu();
  const item = menu.find(i => i.id === itemId);

  if (!item) {
    throw new Error("Item not found");
  }

  const existing = cart.find(i => i.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  return cart;
}

/**
 * Remove item from cart
 */
function removeItemFromCart(itemId, cart) {
  return cart.filter(item => item.id !== itemId);
}

/**
 * 🔥 MAIN FIX: Place order from frontend cart
 * This is what your checkout API should call
 */
function placeOrder(userId, vendorId, cartItems) {
  if (!cartItems || cartItems.length === 0) {
    throw new Error("Cart empty");
  }

  const total = calculateTotal(cartItems);

  const order = createOrder(userId, vendorId, cartItems, total);

  return order;
}

/**
 * Cancel order
 */
function cancelCustomerOrder(orderId) {
  return cancelOrder(orderId);
}

/**
 * Helper: calculate total price
 */
function calculateTotal(items) {
  return items.reduce((sum, item) => {
    return sum + item.price * item.quantity;
  }, 0);
}

module.exports = {
  viewMenu,
  addItemToCart,
  removeItemFromCart,
  placeOrder,
  cancelCustomerOrder
};