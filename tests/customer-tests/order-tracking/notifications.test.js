const customerOrderNotificationsPage = require("../../../public/customer/order-tracking/notifications.js");

test("customer notifications stub initializes", () => {
    document.body.innerHTML = '<p id="order-tracking-notifications-status"></p>';

    expect(customerOrderNotificationsPage.initializeNotificationsPage())
        .toBe("customer/order-tracking/notifications: testing...");
    expect(document.getElementById("order-tracking-notifications-status").textContent)
        .toBe("customer/order-tracking/notifications: testing...");
});
