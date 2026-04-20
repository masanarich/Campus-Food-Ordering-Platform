/**
 * @jest-environment jsdom
 */

const {
    renderOrders,
    updateOrderStatus,
    selectOrder,
    orderTotal
} = require("../../../public/vendor/order-dashboard/order.js");

describe("Order Dashboard - Viewing Orders", () => {

    test("orders are displayed on screen", () => {
        document.body.innerHTML = `
            <ul id="orders-list"></ul>
            <span id="stat-pending"></span>
            <span id="stat-active"></span>
            <span id="stat-complete"></span>
            <span id="stat-revenue"></span>
        `;

        renderOrders();

        const list = document.getElementById("orders-list");

        expect(list.children.length).toBeGreaterThan(0);
    });

});

describe("Order Dashboard - Status Updates", () => {

    test("order status updates correctly", () => {
        document.body.innerHTML = `
            <div id="vendor-home-status"></div>
            <ul id="orders-list"></ul>
        `;

        renderOrders();
        updateOrderStatus("ORD-001", "accepted");

        const status = document.getElementById("vendor-home-status");

        expect(status.textContent).toContain("accepted");
    });

});

describe("Order Dashboard - Order Details", () => {

    test("selecting an order shows details", () => {
        document.body.innerHTML = `
            <div id="order-detail-body"></div>
            <div id="detail-placeholder"></div>
            <section id="order-detail-section"></section>
            <ul id="orders-list"></ul>
        `;

        renderOrders();
        selectOrder("ORD-001");

        const detail = document.getElementById("order-detail-body");

        expect(detail.innerHTML).toContain("ORD-001");
    });

});