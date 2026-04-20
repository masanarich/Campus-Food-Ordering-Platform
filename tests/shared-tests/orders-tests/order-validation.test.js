const orderValidation = require("../../../public/shared/orders/order-validation.js");

test("order-validation stub logs a testing message", () => {
    expect(orderValidation.MODULE_NAME).toBe("order-validation");
    expect(orderValidation.logTesting()).toBe("order-validation: testing...");
});
