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
}

function resetCart() {
  cart = []; // REQUIRED by your tests
}

function getTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}

module.exports = {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal,
  resetCart // ✅ FIXED (this was breaking CI)
};