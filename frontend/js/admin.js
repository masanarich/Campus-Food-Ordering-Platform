const MENU_API = "http://localhost:3000/menu";
const VENDOR_API = "http://localhost:3000/vendors";


// =======================
// MENU FUNCTIONS
// =======================

// LOAD MENU
async function loadMenu() {
  const res = await fetch(MENU_API);
  const data = await res.json();

  const list = document.getElementById("menuList");
  if (!list) return;

  list.innerHTML = "";

  data.forEach(item => {
    const li = document.createElement("li");

    li.innerHTML = `
      <b>${item.name}</b> - R${item.price}
      (${item.available ? "Available" : "Sold Out"})
      <br/>
      <button onclick="markSoldOut('${item.id}')">Sold Out</button>
      <button onclick="editItem('${item.id}', '${item.name}', ${item.price})">Edit</button>
      <hr/>
    `;

    list.appendChild(li);
  });
}


// ADD ITEM
async function addItem() {
  const name = document.getElementById("name").value;
  const price = document.getElementById("price").value;

  if (!name || !price) {
    alert("Fill all fields");
    return;
  }

  await fetch(MENU_API, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price })
  });

  document.getElementById("name").value = "";
  document.getElementById("price").value = "";

  loadMenu();
}


// MARK SOLD OUT
async function markSoldOut(id) {
  await fetch(`${MENU_API}/${id}/soldout`, {
    method: "PUT"
  });

  loadMenu();
}


// EDIT ITEM
function editItem(id, name, price) {
  const newName = prompt("New name:", name);
  const newPrice = prompt("New price:", price);

  if (!newName || !newPrice) return;

  updateItem(id, newName, newPrice);
}


// UPDATE ITEM
async function updateItem(id, name, price) {
  await fetch(`${MENU_API}/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name, price })
  });

  loadMenu();
}



// =======================
// VENDOR FUNCTIONS
// =======================

// LOAD VENDORS
async function loadVendors() {
  const res = await fetch(VENDOR_API);
  const data = await res.json();

  const list = document.getElementById("vendorList");
  if (!list) return;

  list.innerHTML = "";

  data.forEach(v => {
    const li = document.createElement("li");

    li.innerHTML = `
      <b>${v.name}</b> - ${v.status}
      <br/>
      <button onclick="approveVendor('${v.id}')">Approve</button>
      <button onclick="suspendVendor('${v.id}')">Suspend</button>
      <hr/>
    `;

    list.appendChild(li);
  });
}


// APPROVE
async function approveVendor(id) {
  await fetch(`${VENDOR_API}/${id}/approve`, {
    method: "PUT"
  });

  loadVendors();
}


// SUSPEND
async function suspendVendor(id) {
  await fetch(`${VENDOR_API}/${id}/suspend`, {
    method: "PUT"
  });

  loadVendors();
}



// =======================
// INITIAL LOAD
// =======================

loadMenu();
loadVendors();