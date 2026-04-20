const customerCheckout = require("../../../public/customer/order-management/checkout.js");

test("checkout stub logs a testing message", () => {
    expect(customerCheckout.logTesting())
        .toBe("customer/order-management/checkout: testing...");
});
