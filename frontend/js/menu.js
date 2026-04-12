// ⚠️ IMPORTANT: correct backend URL
const API = "http://localhost:3000/menu";

// LOAD MENU
async function loadMenu() {
  const res = await fetch(API);
  const data = await res.json();

  const list = document.getElementById("menuList");
  list.innerHTML = "";

  data.forEach(item => {
    const li = document.createElement("li");
    li.innerHTML = `
      ${item.name} - R${item.price}
      (${item.available ? "Available" : "Sold Out"})
      <button onclick="soldOut('${item.id}')">Sold Out</button>
    `;
    list.appendChild(li);
  });
}

// ADD ITEM
async function addItem() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;

  await fetch(API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price })
  });

  loadMenu();
}

// SOLD OUT
async function soldOut(id) {
  await fetch(`${API}/${id}/soldout`, { method: "PUT" });
  loadMenu();
}

loadMenu();