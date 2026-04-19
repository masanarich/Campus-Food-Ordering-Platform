import { db } from "./config.js";
import {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal
} from "./cart.js";

console.log("Firestore ready:", db);

const menuItems = [
  { id: "1", name: "Burger", price: 50 },
  { id: "2", name: "Pizza", price: 80 },
  { id: "3", name: "Chips", price: 30 }
];

export function renderMenu() {
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

export function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("total");

  if (!cartDiv || !totalDiv) return;

  cartDiv.innerHTML = "";

  const currentCart = getCart();
  const total = getTotal();

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

  totalDiv.innerText = "Total: R" + total;
}

export function getMenu() {
  return menuItems;
}

export function cancelOrder() {
  clearCart();
  renderCart();

  if (typeof window !== "undefined") {
    alert("Order cancelled");
  }
}

export async function placeOrder() {
  const order = {
    userId: "student1",
    vendorId: "vendor1",
    items: getCart(),
    total: getTotal()
  };

  const response = await fetch("http://localhost:3000/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(order)
  });

  if (response.ok) {
    clearCart();
    renderCart();

    if (typeof window !== "undefined") {
      alert("Order placed successfully!");
    }
  }
}

if (typeof window !== "undefined") {
  renderMenu();
  renderCart();
}