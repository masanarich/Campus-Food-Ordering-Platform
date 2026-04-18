/**
 * @jest-environment jsdom
 *
 * Tests for public/vendor/order_tracking/order_trackingv.js
 */

const { onSnapshot, updateDoc } = require("../__mocks__/firebase-firestore.js");

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  document.body.innerHTML = `
    <ul id="orders-list"></ul>
    <div id="modal-overlay" class="hidden"></div>
    <h3 id="modal-order-title"></h3>
    <p id="modal-student-name"></p>
    <ul id="modal-items-list"></ul>
    <p id="modal-message" class="hidden"></p>
    <button id="btn-received">Order Received</button>
    <button id="btn-preparing">Preparing</button>
    <button id="btn-ready">Ready for Pickup</button>
    <button id="btn-close">Close</button>
  `;
});

function loadModule(snapshotOrders = []) {
  onSnapshot.mockImplementation((ref, callback) => {
    callback({
      empty: snapshotOrders.length === 0,
      forEach: (fn) => snapshotOrders.forEach(fn)
    });
    return jest.fn();
  });

  require("../../public/vendor/order_tracking/order_trackingv.js");
}

function clickManage(index = 0) {
  const btns = document.querySelectorAll(".manage-btn");
  btns[index].click();
}

describe("order_trackingv — order list rendering", () => {

  test("shows empty state when no orders", () => {
    loadModule([]);
    const li = document.getElementById("orders-list").querySelector("li");
    expect(li.className).toBe("empty-state");
    expect(li.textContent).toBe("No orders yet.");
  });

  test("renders correct number of rows", () => {
    loadModule([
      { id: "001", data: () => ({ studentName: "Thabo", status: "received" }) },
      { id: "002", data: () => ({ studentName: "Lerato", status: "preparing" }) },
      { id: "003", data: () => ({ studentName: "Sipho", status: "ready" }) }
    ]);
    const lis = document.getElementById("orders-list").querySelectorAll("li");
    expect(lis.length).toBe(3);
  });

  test("renders correct order ID", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received" }) }]);
    const idSpan = document.getElementById("orders-list").querySelector(".order-id");
    expect(idSpan.textContent).toBe("Order #4821");
  });

  test("renders correct student name", () => {
    loadModule([{ id: "001", data: () => ({ studentName: "Lerato Dlamini", status: "received" }) }]);
    const studentSpan = document.getElementById("orders-list").querySelector(".order-student");
    expect(studentSpan.textContent).toBe("Lerato Dlamini");
  });

  test("falls back to 'Unknown' when studentName is missing", () => {
    loadModule([{ id: "001", data: () => ({ status: "received" }) }]);
    const studentSpan = document.getElementById("orders-list").querySelector(".order-student");
    expect(studentSpan.textContent).toBe("Unknown");
  });

  test("renders correct tag class for preparing", () => {
    loadModule([{ id: "001", data: () => ({ studentName: "Thabo", status: "preparing" }) }]);
    const tag = document.getElementById("orders-list").querySelector(".tag");
    expect(tag.className).toContain("tag-preparing");
  });

  test("renders correct tag class for ready", () => {
    loadModule([{ id: "001", data: () => ({ studentName: "Thabo", status: "ready" }) }]);
    const tag = document.getElementById("orders-list").querySelector(".tag");
    expect(tag.className).toContain("tag-ready");
  });

  test("renders correct tag label for ready", () => {
    loadModule([{ id: "001", data: () => ({ studentName: "Thabo", status: "ready" }) }]);
    const tag = document.getElementById("orders-list").querySelector(".tag");
    expect(tag.textContent).toBe("Ready for Pickup");
  });

  test("each row has a Manage button", () => {
    loadModule([
      { id: "001", data: () => ({ status: "received" }) },
      { id: "002", data: () => ({ status: "preparing" }) }
    ]);
    const btns = document.getElementById("orders-list").querySelectorAll(".manage-btn");
    expect(btns.length).toBe(2);
  });

});

describe("order_trackingv — openModal()", () => {

  test("shows modal when Manage is clicked", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: ["Burger"] }) }]);
    clickManage(0);
    expect(document.getElementById("modal-overlay").classList.contains("hidden")).toBe(false);
  });

  test("sets correct order title in modal", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: [] }) }]);
    clickManage(0);
    expect(document.getElementById("modal-order-title").textContent).toBe("Order #4821");
  });

  test("sets correct student name in modal", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Lerato Dlamini", status: "received", items: [] }) }]);
    clickManage(0);
    expect(document.getElementById("modal-student-name").textContent).toBe("Lerato Dlamini");
  });

  test("falls back to 'Unknown student' when name missing", () => {
    loadModule([{ id: "4821", data: () => ({ status: "received", items: [] }) }]);
    clickManage(0);
    expect(document.getElementById("modal-student-name").textContent).toBe("Unknown student");
  });

  test("renders items in modal", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: ["Burger", "Chips"] }) }]);
    clickManage(0);
    const lis = document.getElementById("modal-items-list").querySelectorAll("li");
    expect(lis.length).toBe(2);
    expect(lis[0].textContent).toBe("Burger");
  });

  test("shows 'No items listed.' when items empty", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: [] }) }]);
    clickManage(0);
    const li = document.getElementById("modal-items-list").querySelector("li");
    expect(li.textContent).toBe("No items listed.");
  });

  test("shows 'No items listed.' when items field missing", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received" }) }]);
    clickManage(0);
    const li = document.getElementById("modal-items-list").querySelector("li");
    expect(li.textContent).toBe("No items listed.");
  });

});

describe("order_trackingv — closeModal()", () => {

  test("hides modal when Close is clicked", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-close").click();
    expect(document.getElementById("modal-overlay").classList.contains("hidden")).toBe(true);
  });

});

describe("order_trackingv — setStatus()", () => {

  test("calls updateDoc when Received button clicked", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "preparing", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-received").click();
    expect(updateDoc).toHaveBeenCalled();
  });

  test("calls updateDoc when Preparing button clicked", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-preparing").click();
    expect(updateDoc).toHaveBeenCalled();
  });

  test("calls updateDoc when Ready button clicked", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "preparing", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-ready").click();
    expect(updateDoc).toHaveBeenCalled();
  });

  test("calls updateDoc with status received", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "preparing", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-received").click();
    const callArgs = updateDoc.mock.calls[0][1];
    expect(callArgs.status).toBe("received");
  });

  test("calls updateDoc with status preparing", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "received", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-preparing").click();
    const callArgs = updateDoc.mock.calls[0][1];
    expect(callArgs.status).toBe("preparing");
  });

  test("calls updateDoc with status ready", () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "preparing", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-ready").click();
    const callArgs = updateDoc.mock.calls[0][1];
    expect(callArgs.status).toBe("ready");
  });

});

describe("order_trackingv — showMessage()", () => {

  test("shows message after status update", async () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "preparing", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-ready").click();
    await Promise.resolve();
    expect(document.getElementById("modal-message").classList.contains("hidden")).toBe(false);
  });

  test("message contains correct status text after ready", async () => {
    loadModule([{ id: "4821", data: () => ({ studentName: "Thabo", status: "preparing", items: [] }) }]);
    clickManage(0);
    document.getElementById("btn-ready").click();
    await Promise.resolve();
    expect(document.getElementById("modal-message").textContent).toContain("Ready for Pickup");
  });

});