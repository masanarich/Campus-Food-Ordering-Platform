const orderModel = require("../../../public/shared/orders/order-model.js");

test("order-model stub logs a testing message", () => {
    expect(orderModel.MODULE_NAME).toBe("order-model");
    expect(orderModel.logTesting()).toBe("order-model: testing...");
});
