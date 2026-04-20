const orderService = require("../../../public/shared/orders/order-service.js");

test("order-service stub logs a testing message", () => {
    expect(orderService.MODULE_NAME).toBe("order-service");
    expect(orderService.logTesting()).toBe("order-service: testing...");
});
