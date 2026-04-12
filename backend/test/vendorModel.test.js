const {
  getVendors,
  approveVendor,
  suspendVendor,
  __resetVendors
} = require("../../backend/models/vendorModel");

beforeEach(() => __resetVendors());

test("approve vendor", () => {
  const v = getVendors()[0];
  approveVendor(v.id);
  expect(getVendors()[0].status).toBe("approved");
});

test("suspend vendor", () => {
  const v = getVendors()[0];
  suspendVendor(v.id);
  expect(getVendors()[0].status).toBe("suspended");
});