const orderNotifications = require("../../../public/shared/orders/order-notifications.js");

test("order-notifications stub logs a testing message", () => {
    expect(orderNotifications.MODULE_NAME).toBe("order-notifications");
    expect(orderNotifications.logTesting()).toBe("order-notifications: testing...");
});
