let cart = [];

const getCart = () => cart;

const addToCart = (item) => {
  const existing = cart.find(i => i.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  return cart;
};

const removeFromCart = (id) => {
  cart = cart.filter(item => item.id !== id);
  return cart;
};

const clearCart = () => {
  cart = [];
};

const getTotal = () => {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
};

module.exports = {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal
};