const { addToCart, removeFromCart, clearCart, getCart, getTotal } = window.cart; // or import

const menuItems = [
  { id: "1", name: "Burger", price: 50 },
  { id: "2", name: "Pizza", price: 80 },
  { id: "3", name: "Chips", price: 30 }
];

// ---------------- RENDER MENU ----------------
function renderMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  menuItems.forEach(item => {
    const div = document.createElement("div");

    const button = document.createElement("button");
    button.textContent = "Add";
    button.onclick = () => {
      addToCart(item);
      renderCart();
    };

    div.innerHTML = `<p>${item.name} - R${item.price}</p>`;
    div.appendChild(button);

    menuDiv.appendChild(div);
  });
}

// ---------------- RENDER CART ----------------
function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("total");

  cartDiv.innerHTML = "";

  const cart = getCart();
  let total = getTotal();

  cart.forEach(item => {
    const div = document.createElement("div");

    const removeBtn = document.createElement("button");
    removeBtn.textContent = "Remove";
    removeBtn.onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };

    div.innerHTML = `<p>${item.name} x ${item.quantity}</p>`;
    div.appendChild(removeBtn);

    cartDiv.appendChild(div);
  });

  totalDiv.innerText = "Total: R" + total;
}

// ---------------- CANCEL ORDER ----------------
function cancelOrder() {
  clearCart();
  renderCart();
  alert("Order cancelled");
}

// ---------------- PLACE ORDER ----------------
/*import { createOrder } from "./order"; 
async function placeOrder() {
  const response = await fetch("http://localhost:3000/orders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      userId: "student1",
      vendorId: "vendor1",
      items: getCart()
    })
  });

  if (response.ok) {
    clearCart();
    renderCart();
    alert("Order placed successfully!");
  }
}*/
import { createOrder } from "./order.js"; // or require if backend

async function placeOrder() {
  const order = createOrder(
    "student1",
    "vendor1",
    cart,
    getTotal()
  );

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
    alert("Order placed successfully!");
  }
}

// INIT
renderMenu();
renderCart();