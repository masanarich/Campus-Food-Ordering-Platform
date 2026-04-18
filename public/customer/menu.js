// Works with browser + Jest (CommonJS style)

// Expect cart to be loaded globally OR imported in tests
const {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal
} = window.cart || require("./cart");

let cart = getCart();

const menuItems = [
  { id: "1", name: "Burger", price: 50 },
  { id: "2", name: "Pizza", price: 80 },
  { id: "3", name: "Chips", price: 30 }
];

// ---------------- MENU ----------------
function renderMenu() {
  const menuDiv = document.getElementById("menu");
  menuDiv.innerHTML = "";

  menuItems.forEach(item => {
    const div = document.createElement("div");

    const btn = document.createElement("button");
    btn.textContent = "Add";

    btn.onclick = () => {
      addToCart(item);
      renderCart();
    };

    div.innerHTML = `<p>${item.name} - R${item.price}</p>`;
    div.appendChild(btn);

    menuDiv.appendChild(div);
  });
}

// ---------------- CART ----------------
function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("total");

  cartDiv.innerHTML = "";

  const currentCart = getCart();
  const total = getTotal();

  currentCart.forEach(item => {
    const div = document.createElement("div");

    const btn = document.createElement("button");
    btn.textContent = "Remove";

    btn.onclick = () => {
      removeFromCart(item.id);
      renderCart();
    };

    div.innerHTML = `<p>${item.name} x ${item.quantity}</p>`;
    div.appendChild(btn);

    cartDiv.appendChild(div);
  });

  totalDiv.innerText = "Total: R" + total;
}

// ---------------- ACTIONS ----------------
function cancelOrder() {
  clearCart();
  renderCart();
  alert("Order cancelled");
}

async function placeOrder() {
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
    alert("Order placed successfully!");
  }
}

// INIT
renderMenu();
renderCart();