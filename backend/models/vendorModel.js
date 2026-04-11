let vendors = [
  { id: "1", name: "Vendor A", status: "pending" }
];

// --------------------
// GET ALL VENDORS
// --------------------
function getVendors() {
  return vendors;
}

// --------------------
// APPROVE VENDOR
// --------------------
function approveVendor(id) {
  const vendor = vendors.find(v => v.id == id);

  if (!vendor) throw new Error("Vendor not found");

  vendor.status = "approved";
  return vendor;
}

// --------------------
// SUSPEND VENDOR
// --------------------
function suspendVendor(id) {
  const vendor = vendors.find(v => v.id == id);

  if (!vendor) throw new Error("Vendor not found");

  vendor.status = "suspended";
  return vendor;
}

// --------------------
// RESET (IMPORTANT FOR TESTS)
// --------------------
function __resetVendors() {
  vendors = [
    { id: "1", name: "Vendor A", status: "pending" }
  ];
}

module.exports = {
  getVendors,
  approveVendor,
  suspendVendor,
  __resetVendors
};