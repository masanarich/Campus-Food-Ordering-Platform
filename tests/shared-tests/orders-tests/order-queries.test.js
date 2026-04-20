const orderQueries = require("../../../public/shared/orders/order-queries.js");

test("order-queries stub logs a testing message", () => {
    expect(orderQueries.MODULE_NAME).toBe("order-queries");
    expect(orderQueries.logTesting()).toBe("order-queries: testing...");
});
