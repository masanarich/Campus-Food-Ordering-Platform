// Import cart logic (if using bundler OR copy functions if plain HTML setup)
// For simple setup, assume cart functions are globally available

const menuItems = [
  { id: "1", name: "Burger", price: 50 },
  { id: "2", name: "Pizza", price: 80 },
  { id: "3", name: "Chips", price: 30 }
];

// ---------------- CART (LOCAL VERSION FOR FRONTEND) ----------------
let cart = [];

function addToCart(item) {
  const existing = cart.find(i => i.id === item.id);

  if (existing) {
    existing.quantity++;
  } else {
    cart.push({ ...item, quantity: 1 });
  }

  renderCart();
}

function removeFromCart(id) {
  cart = cart.filter(item => item.id !== id);
  renderCart();
}

function clearCart() {
  cart = [];
  renderCart();
}

// ---------------- RENDER MENU ----------------
function renderMenu() {
  const menuDiv = document.getElementById("menu");

  menuItems.forEach(item => {
    const div = document.createElement("div");

    div.innerHTML = `
      <p>${item.name} - R${item.price}</p>
      <button onclick="addToCart(${JSON.stringify(item).replace(/"/g, '&quot;')})">
        Add
      </button>
    `;

    menuDiv.appendChild(div);
  });
}

// ---------------- RENDER CART ----------------
function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("total");

  cartDiv.innerHTML = "";

  let total = 0;

  cart.forEach(item => {
    total += item.price * item.quantity;

    const div = document.createElement("div");

    div.innerHTML = `
      <p>${item.name} x ${item.quantity}</p>
      <button onclick="removeFromCart('${item.id}')">Remove</button>
    `;

    cartDiv.appendChild(div);
  });

  totalDiv.innerText = "Total: R" + total;
}

// ---------------- CANCEL ORDER ----------------
function cancelOrder() {
  clearCart();
  alert("Order cancelled");
}

// ---------------- PLACE ORDER (BACKEND CONNECT) ----------------
async function placeOrder() {
  const userId = "student1";
  const vendorId = "vendor1";

  const response = await fetch("http://localhost:3000/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      userId,
      vendorId,
      items: cart
    })
  });

  if (response.ok) {
    clearCart();
    alert("Order placed successfully!");
  }
}

// ---------------- INIT ----------------
renderMenu();
renderCart();