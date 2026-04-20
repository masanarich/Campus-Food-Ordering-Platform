const vendorOrderNotifications = require("../../../public/vendor/order-management/notifications.js");

test("vendor notifications stub logs a testing message", () => {
    expect(vendorOrderNotifications.logTesting())
        .toBe("vendor/order-management/notifications: testing...");
});
