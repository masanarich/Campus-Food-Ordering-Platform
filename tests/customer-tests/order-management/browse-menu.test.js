const customerBrowseMenu = require("../../../public/customer/order-management/browse-menu.js");

test("browse-menu stub logs a testing message", () => {
    expect(customerBrowseMenu.logTesting())
        .toBe("customer/order-management/browse-menu: testing...");
});
