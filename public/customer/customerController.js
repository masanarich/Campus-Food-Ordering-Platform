const { getMenu } = require("./menu");

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
};