async function loadVendors() {
  const res = await fetch('/vendors');
  const vendors = await res.json();

  const list = document.getElementById('vendorList');
  list.innerHTML = '';

  vendors.forEach(v => {
    const div = document.createElement('div');

    div.innerHTML = `
      <p>${v.name} (${v.status})</p>
      <button onclick="approveVendor('${v.id}')">Approve</button>
      <button onclick="suspendVendor('${v.id}')">Suspend</button>
    `;

    list.appendChild(div);
  });
}

async function approveVendor(id) {
  await fetch(`/vendors/${id}/approve`, { method: 'PUT' });
  loadVendors();
}

async function suspendVendor(id) {
  await fetch(`/vendors/${id}/suspend`, { method: 'PUT' });
  loadVendors();
}

loadVendors();