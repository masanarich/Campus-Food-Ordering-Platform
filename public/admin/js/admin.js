const VENDOR_API = "http://localhost:3000/vendors";

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
      <strong>${v.name}</strong> - ${v.status}
      <br/>
      <button onclick="approveVendor('${v.id}')">Approve</button>
      <button onclick="suspendVendor('${v.id}')">Suspend</button>
    `;

    list.appendChild(li);
  });
}

// APPROVE
async function approveVendor(id) {
  await fetch(`${VENDOR_API}/${id}/approve`, { method: "PUT" });
  loadVendors();
}

// SUSPEND
async function suspendVendor(id) {
  await fetch(`${VENDOR_API}/${id}/suspend`, { method: "PUT" });
  loadVendors();
}

loadVendors();

// TEST EXPORT
if (typeof module !== "undefined") {
  module.exports = { loadVendors };
}