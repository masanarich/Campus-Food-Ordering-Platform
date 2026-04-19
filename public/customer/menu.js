
const {
  addToCart,
  removeFromCart,
  clearCart,
  getCart,
  getTotal
} = (typeof window !== "undefined" && window.cart)
  ? window.cart
  : require("./cart");


const menuItems = [
  { id: "1", name: "Burger", price: 50 },
  { id: "2", name: "Pizza", price: 80 },
  { id: "3", name: "Chips", price: 30 }
];


function renderMenu() {
  const menuDiv = document.getElementById("menu");
  if (!menuDiv) return;

  menuDiv.innerHTML = ""; 

  menuItems.forEach(item => {
    const div = document.createElement("section");

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


function renderCart() {
  const cartDiv = document.getElementById("cart");
  const totalDiv = document.getElementById("total");

  if (!cartDiv || !totalDiv) return;

  cartDiv.innerHTML = ""; 

  const currentCart = getCart();
  const total = getTotal();

  currentCart.forEach(item => {
    const div = document.createElement("section");

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

    if (typeof window !== "undefined") {
      alert("Order placed successfully!");
    }
  }
}


if (typeof window !== "undefined") {
  renderMenu();
  renderCart();
}


module.exports = {
  renderMenu,
  renderCart,
  cancelOrder,
  placeOrder,
  menuItems,
  getMenu
};