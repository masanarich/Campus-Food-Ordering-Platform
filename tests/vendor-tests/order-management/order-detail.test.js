const vendorOrderDetailPage = require("../../../public/vendor/order-management/order-detail.js");

test("vendor order detail page stub initializes", () => {
    document.body.innerHTML = '<p id="vendor-order-detail-status"></p>';

    expect(vendorOrderDetailPage.initializeVendorOrderDetailPage())
        .toBe("vendor/order-management/order-detail: testing...");
    expect(document.getElementById("vendor-order-detail-status").textContent)
        .toBe("vendor/order-management/order-detail: testing...");
});
