const { approveVendor, suspendVendor } = require('../models/vendorModel');

test("approve vendor", () => {
  const v = approveVendor(1);
  expect(v.status).toBe("approved");
});

test("suspend vendor", () => {
  const v = suspendVendor(1);
  expect(v.status).toBe("suspended");
});