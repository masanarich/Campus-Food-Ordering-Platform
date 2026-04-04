/*const API = "http://localhost:3000";

async function loadVendors() {
  const res = await fetch(`${API}/vendors`);
  const data = await res.json();

  const list = document.getElementById("vendorList");

  data.forEach(v => {
    list.innerHTML += `
      <div>
        <p>${v.name} (${v.status})</p>
        <button onclick="approve(${v.id})">Approve</button>
        <button onclick="suspend(${v.id})">Suspend</button>
      </div>
    `;
  });   
}

function approve(id) {
  fetch(`${API}/vendor/${id}/approve`, { method: "PUT" });
}

function suspend(id) {
  fetch(`${API}/vendor/${id}/suspend`, { method: "PUT" });
}

loadVendors();*/
function formatVendor(v) {
  return `${v.name} (${v.status})`;
}

module.exports = { formatVendor };