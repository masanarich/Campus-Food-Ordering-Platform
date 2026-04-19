/**
 * @jest-environment jsdom
 */

const fs = require("fs");
const path = require("path");

const scriptPath = path.resolve(
  __dirname,
  "..",
  "..",
  "public",
  "customer",
  "track_order",
  "script.js"
);

describe("Order tracking client script", () => {
  beforeEach(() => {
    // reset modules so requiring the script re-executes
    jest.resetModules();

    // minimal DOM elements expected by the script
    document.body.innerHTML = `
      <div id="order-list"></div>
      <form id="create-order-form">
        <input id="studentName" />
        <input id="itemName" />
        <input id="vendorName" />
      </form>
      <div id="create-order-feedback"></div>
    `;

    // mock global alert to avoid actual alerts during tests
    global.alert = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
    delete global.io;
    jest.clearAllMocks();
  });

  test("renders empty state when no orders", async () => {
    // mock fetch to return no orders
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [] })
    });

    // mock socket.io global - minimal on handler
    global.io = jest.fn(() => ({ on: jest.fn() }));

    // require the script (it will execute and call loadOrders)
    require(scriptPath);

    // wait for promises and microtasks to complete
    await new Promise((resolve) => setTimeout(resolve, 0));

    const orderList = document.getElementById("order-list");
    expect(orderList.innerHTML).toContain("No orders yet.");
  });

  test("renders an order with Ready for Pickup and shows notify text", async () => {
    const now = new Date().toISOString();
    const sampleOrder = {
      orderId: "123",
      itemName: "Pizza",
      studentName: "Alice",
      vendorName: "Campus Vendor",
      status: "Ready for Pickup",
      createdAt: now,
      timeline: [
        { status: "Placed", timestamp: now },
        { status: "Ready for Pickup", timestamp: now }
      ]
    };

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ orders: [sampleOrder] })
    });

    global.io = jest.fn(() => ({ on: jest.fn() }));

    require(scriptPath);

    // wait for async loadOrders and DOM updates
    await new Promise((resolve) => setTimeout(resolve, 0));

    const orderList = document.getElementById("order-list");
    // should include the item name and ready notify text
    expect(orderList.innerHTML).toContain("Pizza");
    expect(orderList.innerHTML).toContain("Ready for collection");
    // the article should have the ready class
    expect(orderList.querySelectorAll(".order.ready").length).toBeGreaterThan(0);
  });
});
