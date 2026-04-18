/**
 * @jest-environment jsdom
 *
 * Tests for public/customer/order_tracking/order_trackingc.js
 */

const { onSnapshot } = require("../__mocks__/firebase-firestore.js");

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();

  document.body.innerHTML = `
    <input id="order-id-input" />
    <button id="btn-track">Track</button>
    <section id="tracking-section" class="hidden"></section>
    <p id="not-found" class="hidden"></p>
    <h3 id="order-title"></h3>
    <p id="order-sub"></p>
    <span id="status-tag"></span>
    <aside id="ready-banner" class="hidden"></aside>
    <ul id="items-list"></ul>
    <article class="step" id="s0"><span class="dot" id="d0"></span></article>
    <article class="step" id="s1"><span class="dot" id="d1"></span></article>
    <article class="step" id="s2"><span class="dot" id="d2"></span></article>
  `;
});

function setupAndRender(snapData, queryParams = "") {
  delete window.location;
  window.location = { search: queryParams, href: "" };

  onSnapshot.mockImplementation((ref, callback) => {
    callback({
      exists: () => snapData !== null,
      data: () => snapData
    });
    return jest.fn();
  });

  require("../../public/customer/order_tracking/order_trackingc.js");
}

describe("order_trackingc — no order ID in URL", () => {

  test("shows 'No order ID found.' when orderId is missing", () => {
    setupAndRender(null, "");
    expect(document.getElementById("order-title").textContent).toBe("No order ID found.");
  });

  test("shows URL hint when orderId is missing", () => {
    setupAndRender(null, "");
    expect(document.getElementById("order-sub").textContent).toContain("?order=");
  });

});

describe("order_trackingc — order not found", () => {

  test("shows 'Order not found.' when snap does not exist", () => {
    setupAndRender(null, "?order=9999");
    expect(document.getElementById("order-title").textContent).toBe("Order not found.");
  });

});

describe("order_trackingc — renderOrder()", () => {

  test("displays correct order title", () => {
    setupAndRender({ status: "received", studentName: "Thabo", station: "Station B" }, "?order=4821");
    expect(document.getElementById("order-title").textContent).toBe("Order #4821");
  });

  test("displays student name and station", () => {
    setupAndRender({ status: "received", studentName: "Thabo Nkosi", station: "Station B" }, "?order=4821");
    expect(document.getElementById("order-sub").textContent).toBe("Thabo Nkosi · Station B");
  });

  test("sets correct tag label for received", () => {
    setupAndRender({ status: "received", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("status-tag").textContent).toBe("Order received");
  });

  test("sets correct tag label for preparing", () => {
    setupAndRender({ status: "preparing", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("status-tag").textContent).toBe("Preparing");
  });

  test("sets correct tag label for ready", () => {
    setupAndRender({ status: "ready", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("status-tag").textContent).toBe("Ready for pickup");
  });

  test("sets correct CSS class for received", () => {
    setupAndRender({ status: "received", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("status-tag").className).toContain("tag-received");
  });

  test("sets correct CSS class for preparing", () => {
    setupAndRender({ status: "preparing", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("status-tag").className).toContain("tag-preparing");
  });

  test("sets correct CSS class for ready", () => {
    setupAndRender({ status: "ready", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("status-tag").className).toContain("tag-ready");
  });

  test("shows ready banner when status is ready", () => {
    setupAndRender({ status: "ready", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("ready-banner").classList.contains("hidden")).toBe(false);
  });

  test("hides ready banner when status is preparing", () => {
    setupAndRender({ status: "preparing", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("ready-banner").classList.contains("hidden")).toBe(true);
  });

  test("hides ready banner when status is received", () => {
    setupAndRender({ status: "received", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("ready-banner").classList.contains("hidden")).toBe(true);
  });

});

describe("order_trackingc — updateSteps()", () => {

  test("stage 0 (received): step 0 active, others inactive", () => {
    setupAndRender({ status: "received", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("s0").classList.contains("active")).toBe(true);
    expect(document.getElementById("s1").classList.contains("active")).toBe(false);
    expect(document.getElementById("s2").classList.contains("active")).toBe(false);
  });

  test("stage 1 (preparing): step 0 done, step 1 active", () => {
    setupAndRender({ status: "preparing", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("s0").classList.contains("done")).toBe(true);
    expect(document.getElementById("d0").textContent).toBe("✓");
    expect(document.getElementById("s1").classList.contains("active")).toBe(true);
  });

  test("stage 2 (ready): steps 0 and 1 done, step 2 active", () => {
    setupAndRender({ status: "ready", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("s0").classList.contains("done")).toBe(true);
    expect(document.getElementById("s1").classList.contains("done")).toBe(true);
    expect(document.getElementById("s2").classList.contains("active")).toBe(true);
  });

  test("done steps show tick in dot", () => {
    setupAndRender({ status: "ready", studentName: "Thabo", station: "" }, "?order=001");
    expect(document.getElementById("d0").textContent).toBe("✓");
    expect(document.getElementById("d1").textContent).toBe("✓");
    expect(document.getElementById("d2").textContent).toBe("");
  });

});

describe("order_trackingc — onSnapshot called correctly", () => {

  test("calls onSnapshot when order ID is present", () => {
    setupAndRender({ status: "received", studentName: "Thabo", station: "" }, "?order=4821");
    expect(onSnapshot).toHaveBeenCalled();
  });

  test("does NOT call onSnapshot when order ID is missing", () => {
    setupAndRender(null, "");
    expect(onSnapshot).not.toHaveBeenCalled();
  });

});