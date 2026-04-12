let vendors = [
  { id: "1", name: "Vendor A", status: "pending" }
];

function getVendors() {
  return vendors;
}

function approveVendor(id) {
  const v = vendors.find(v => v.id === id);
  if (!v) throw new Error("Vendor not found");

  v.status = "approved";
  return v;
}

function suspendVendor(id) {
  const v = vendors.find(v => v.id === id);
  if (!v) throw new Error("Vendor not found");

  v.status = "suspended";
  return v;
}

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