const customerBrowseVendors = require("../../../public/customer/order-management/browse-vendors.js");

test("browse-vendors stub logs a testing message", () => {
    expect(customerBrowseVendors.logTesting())
        .toBe("customer/order-management/browse-vendors: testing...");
});
