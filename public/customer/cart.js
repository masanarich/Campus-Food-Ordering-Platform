let cart = [];

export function getCart() {
  return cart;
}

export function addToCart(item) {
  const existing = cart.find(i => i.id === item.id);

  if (existing) {
    existing.quantity += 1;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  return cart;
}

export function removeFromCart(id) {
  const index = cart.findIndex(item => item.id === id);

  if (index !== -1) {
    cart.splice(index, 1);
  }

  return cart;
}

export function clearCart() {
  cart = [];
  return cart;
}

export function resetCart() {
  cart = [];
  return cart;
}

export function getTotal() {
  return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
}