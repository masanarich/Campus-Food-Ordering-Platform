const customerOrderManagementCart = require("../../../public/customer/order-management/cart.js");

test("customer cart stub logs a testing message", () => {
    expect(customerOrderManagementCart.logTesting())
        .toBe("customer/order-management/cart: testing...");
});
