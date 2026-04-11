let vendors = [];

// --------------------
// CREATE VENDOR (MOCK)
// --------------------
function addVendor(vendor) {
  const newVendor = {
    id: Date.now().toString(),
    name: vendor.name,
    status: "pending"
  };

  vendors.push(newVendor);
  return newVendor;
}

// --------------------
// GET VENDORS
// --------------------
function getVendors() {
  return vendors;
}

// --------------------
// APPROVE VENDOR
// --------------------
function approveVendor(id) {
  const vendor = vendors.find(v => v.id === id);

  if (!vendor) throw new Error("Vendor not found");

  vendor.status = "approved";
  return vendor;
}

// --------------------
// SUSPEND VENDOR
// --------------------
function suspendVendor(id) {
  const vendor = vendors.find(v => v.id === id);

  if (!vendor) throw new Error("Vendor not found");

  vendor.status = "suspended";
  return vendor;
}

// --------------------
// FORMAT (UI helper)
// --------------------
function formatVendor(v) {
  return `${v.name} (${v.status})`;
}

module.exports = {
  addVendor,
  getVendors,
  approveVendor,
  suspendVendor,
  formatVendor
};