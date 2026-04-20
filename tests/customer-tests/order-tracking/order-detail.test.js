const customerOrderDetailPage = require("../../../public/customer/order-tracking/order-detail.js");

test("customer order detail page stub initializes", () => {
    document.body.innerHTML = '<p id="order-tracking-detail-status"></p>';

    expect(customerOrderDetailPage.initializeOrderDetailPage())
        .toBe("customer/order-tracking/order-detail: testing...");
    expect(document.getElementById("order-tracking-detail-status").textContent)
        .toBe("customer/order-tracking/order-detail: testing...");
});
