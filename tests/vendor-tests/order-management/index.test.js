const vendorOrderManagementPage = require("../../../public/vendor/order-management/index.js");

test("vendor order management page stub initializes", () => {
    document.body.innerHTML = '<p id="vendor-order-management-status"></p>';

    expect(vendorOrderManagementPage.initializeVendorOrderManagementPage())
        .toBe("vendor/order-management/index: testing...");
    expect(document.getElementById("vendor-order-management-status").textContent)
        .toBe("vendor/order-management/index: testing...");
});
