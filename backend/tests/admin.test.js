const { formatVendor } = require('../frontend/js/admin');

test("formats vendor", () => {
  const result = formatVendor({ name: "Vendor A", status: "approved" });
  expect(result).toBe("Vendor A (approved)");
});