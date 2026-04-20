const orderStatus = require("../../../public/shared/orders/order-status.js");

test("order-status stub logs a testing message", () => {
    expect(orderStatus.MODULE_NAME).toBe("order-status");
    expect(orderStatus.logTesting()).toBe("order-status: testing...");
});
