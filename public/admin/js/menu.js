const MENU_API = "http://localhost:3000/menu";


// load menu

async function loadMenu() {
  const res = await fetch(MENU_API);
  const data = await res.json();

  const list = document.getElementById("menuList");
  if (!list) return;

  list.innerHTML = "";

  data.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      <strong>${item.name}</strong> - R${item.price}
      <br/>
      <img src="${item.photo || 'https://via.placeholder.com/100'}" width="100"/>
      <br/>
      <span>${item.available ? "Available" : "Sold Out"}</span>
      <br/>
      <button onclick="markSoldOut('${item.id}')">Sold Out</button>
      <button onclick="editItem('${item.id}', '${item.name}', ${item.price})">Edit</button>
    `;

    list.appendChild(li);
  });
}



// add item

async function addItem() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;
  const photo = document.getElementById("photo").value;

  if (!name || !price) {
    alert("Fill all fields");
    return;
  }

  await fetch(MENU_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price, photo })
  });

  document.getElementById("name").value = "";
  document.getElementById("price").value = "";
  document.getElementById("photo").value = "";

  loadMenu();
}



// mark sold_out

async function markSoldOut(id) {
  await fetch(`${MENU_API}/${id}/soldout`, {
    method: "PUT"
  });

  loadMenu();
}



// edit menu

function editItem(id, name, price) {
  const newName = prompt("New name:", name);
  const newPrice = prompt("New price:", price);

  if (!newName || !newPrice) return;

  updateItem(id, newName, newPrice);
}



// update item

async function updateItem(id, name, price) {
  await fetch(`${MENU_API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price })
  });

  loadMenu();
}



// form submit

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



// export tests

if (typeof module !== "undefined") {
  module.exports = { loadMenu, addItem, markSoldOut, editItem, updateItem };
}