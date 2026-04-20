const customerOrderTrackingPage = require("../../../public/customer/order-tracking/index.js");

test("customer order tracking page stub initializes", () => {
    document.body.innerHTML = '<p id="order-tracking-status"></p>';

    expect(customerOrderTrackingPage.initializeOrderTrackingPage())
        .toBe("customer/order-tracking/index: testing...");
    expect(document.getElementById("order-tracking-status").textContent)
        .toBe("customer/order-tracking/index: testing...");
});
