let cart = [];

function getCart() {
  return cart;
}

function addToCart(item) {
  const existing = cart.find(i => i.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  return cart;
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  return cart;
}

function clearCart() {
  cart = [];
  return cart;
}

// IMPORTANT: keep this for tests (alias of clearCart)
function resetCart() {
  cart = [];
}

function getTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

module.exports = {
  getCart,
  addToCart,
  removeFromCart,
  clearCart,
  resetCart,
  getTotal
};