const orderFormatters = require("../../../public/shared/orders/order-formatters.js");

test("order-formatters stub logs a testing message", () => {
    expect(orderFormatters.MODULE_NAME).toBe("order-formatters");
    expect(orderFormatters.logTesting()).toBe("order-formatters: testing...");
});
