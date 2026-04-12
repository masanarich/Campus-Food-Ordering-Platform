const API = "http://localhost:3000/menu";

// LOAD MENU
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
      <em>${item.description}</em>
      <br/>
      <img src="${item.photo || 'https://via.placeholder.com/100'}" width="100"/>
      <br/>
      ${item.available ? "Available" : "Sold Out"}
      <br/>
      <button onclick="markSoldOut('${item.id}')">Sold Out</button>
    `;

    list.appendChild(li);
  });
}

// ADD ITEM
async function addItem() {
  const name = document.getElementById("name").value;
  const description = document.getElementById("description").value;
  const price = document.getElementById("price").value;
  const photo = document.getElementById("photo").value;

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, description, price, photo })
  });

  loadMenu();
}

// SOLD OUT
async function markSoldOut(id) {
  await fetch(`${API}/${id}/soldout`, { method: "PUT" });
  loadMenu();
}

// FORM
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

// TEST EXPORT
if (typeof module !== "undefined") {
  module.exports = { loadMenu };
}