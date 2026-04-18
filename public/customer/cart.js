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
  const index = cart.findIndex(item => item.id === id);

  if (index !== -1) {
    cart.splice(index, 1);
  }

  return cart;
}

function clearCart() {
  cart = [];
  return cart;
}

function resetCart() {
  cart = [];
  return cart;
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
  resetCart
};