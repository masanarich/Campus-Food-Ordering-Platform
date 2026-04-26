const customerOrderManagementPage = require("../../../public/customer/order-management/index.js");

test("customer order management page stub initializes", () => {
    document.body.innerHTML = '<p id="order-management-status"></p>';

    expect(customerOrderManagementPage.initializeOrderManagementPage())
        .toBe("customer/order-management/index: testing...");
    expect(document.getElementById("order-management-status").textContent)
        .toBe("customer/order-management/index: testing...");
});
