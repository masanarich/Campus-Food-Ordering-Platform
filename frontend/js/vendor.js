const API = "http://localhost:3000/menu";

async function loadMenu() {
  const res = await fetch(API);
  const data = await res.json();

  const list = document.getElementById("menuList");
  if (!list) return;

  list.innerHTML = "";

  data.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${item.name}</strong> - R${item.price}
      <br/>

      <em>${item.description || "No description"}</em>
      <br/>

      <img src="${item.photo || 'https://via.placeholder.com/100'}" width="100"/>
      <br/>

      ${item.available ? "Available" : "Sold Out"}
      <br/>

      <!-- NEW: Order Button (next sprint feature) -->
      <button onclick="placeOrder('${item.id}')">
        Order / Place Order
      </button>

      <!-- EXISTING -->
      <button onclick="markSoldOut('${item.id}')">
        Sold Out
      </button>

      <hr/>
    `;

    list.appendChild(li);
  });
}
// add item
async function addItem() {
  const name = document.getElementById("name").value;
  const description = document.getElementById("description").value;
  const price = document.getElementById("price").value;
  const photo = document.getElementById("photo").value;

  if (!name || !price) {
    alert("Please fill in required fields");
    return;
  }

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, price, photo })
  });

  // reset form after adding
  const form = document.getElementById("menuForm");
  if (form) form.reset();

  loadMenu(); // refresh list
}

// sold_out
async function markSoldOut(id) {
  await fetch(`${API}/${id}/soldout`, { method: "PUT" });
  loadMenu();
}

// this is the new  (placeholder)

function placeOrder(id) {
  alert("Order feature coming in next sprint 🚀");
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("menuForm");

  if (form) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      addItem();
    });
  }

  loadMenu();
});

if (typeof module !== "undefined") {
  module.exports = { loadMenu };
}