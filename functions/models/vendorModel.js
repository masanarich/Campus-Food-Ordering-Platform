let vendors = [
  { id: "1", name: "Vendor A", status: "pending" }
];

/**
 * GET ALL
 */
function getVendors() {
  return vendors;
}

/**
 * APPROVE
 */
function approveVendor(id) {
  const v = vendors.find(v => v.id === id);
  if (!v) throw new Error("Vendor not found");

  v.status = "approved";
  return v;
}

/**
 * SUSPEND
 */
function suspendVendor(id) {
  const v = vendors.find(v => v.id === id);
  if (!v) throw new Error("Vendor not found");

  v.status = "suspended";
  return v;
}

/**
 * RESET (TEST ONLY)
 */
function __resetVendors() {
  vendors = [{ id: "1", name: "Vendor A", status: "pending" }];
}

module.exports = {
  getVendors,
  approveVendor,
  suspendVendor,
  __resetVendors
};