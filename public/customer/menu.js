const {
  addToCart,
  removeFromCart,
  getCart,
  getTotal,
  clearCart
} = require("../../public/customer/cart");

const menuItems = [
  { id: "1", name: "Burger", price: 50 },
  { id: "2", name: "Pizza", price: 80 },
  { id: "3", name: "Chips", price: 30 }
];

function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("total");

  if (!cartDiv || !totalDiv) return;

  cartDiv.innerHTML = "";

  const currentCart = getCart();

  currentCart.forEach(item => {
    const section = document.createElement("section");

    const btn = document.createElement("button");
    btn.textContent = "Remove";

    btn.onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };

    section.innerHTML = `<p>${item.name} x ${item.quantity}</p>`;
    section.appendChild(btn);

    cartDiv.appendChild(section);
  });

  totalDiv.innerText = "Total: R" + getTotal();
}

function renderMenu() {
  const menuDiv = document.getElementById("menu");
  if (!menuDiv) return;

  menuDiv.innerHTML = "";

  menuItems.forEach(item => {
    const section = document.createElement("section");

    const btn = document.createElement("button");
    btn.textContent = "Add";

    btn.onclick = () => {
      addToCart(item);
      renderCart();
    };

    section.innerHTML = `<p>${item.name} - R${item.price}</p>`;
    section.appendChild(btn);

    menuDiv.appendChild(section);
  });
}

function getMenu() {
  return menuItems;
}

function cancelOrder() {
  clearCart();
  renderCart();

  if (typeof window !== "undefined") {
    alert("Order cancelled");
  }
}

module.exports = {
  renderMenu,
  renderCart,
  getMenu,
  cancelOrder
};