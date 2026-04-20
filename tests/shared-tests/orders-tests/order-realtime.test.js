const orderRealtime = require("../../../public/shared/orders/order-realtime.js");

test("order-realtime stub logs a testing message", () => {
    expect(orderRealtime.MODULE_NAME).toBe("order-realtime");
    expect(orderRealtime.logTesting()).toBe("order-realtime: testing...");
});
