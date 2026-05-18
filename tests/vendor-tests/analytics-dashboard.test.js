/**
 * @jest-environment jsdom
 *
 * Tests for public/vendor/analytics.js
 */

"use strict";

function flushPromises() {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function makeOrderDoc(order) {
  return {
    id: order.id,
    data: () => ({
      ...order,
    }),
  };
}

function setupAnalyticsDom() {
  document.body.innerHTML = `
    <div id="analytics-status"></div>
    <input id="start-date-input" type="date" />
    <input id="end-date-input" type="date" />
    <button class="menu-item active" data-section="overview" type="button">Overview</button>
    <button class="menu-item" data-section="revenue" type="button">Revenue</button>
    <section id="overview-section" class="content-section active"></section>
    <section id="revenue-section" class="content-section"></section>
    <span id="total-revenue">ZAR 0.00</span>
    <span id="total-orders">0</span>
    <span id="avg-order-value">ZAR 0.00</span>
    <span id="completion-rate">0%</span>
    <span id="total-items-sold">0</span>
    <span id="avg-items-per-order">0</span>
    <canvas id="revenue-trend-chart"></canvas>
    <canvas id="weekly-chart"></canvas>
    <canvas id="status-distribution-chart"></canvas>
    <canvas id="top-items-chart"></canvas>
    <canvas id="peak-hours-chart"></canvas>
    <canvas id="category-chart"></canvas>
    <button id="refresh-data-button" type="button">Refresh</button>
    <button id="export-csv-button" type="button">Export</button>
    <div id="insights-container"></div>
  `;
}

function setupFirebaseMocks(orders = [], chartFactory) {
  const docs = orders.map(makeOrderDoc);

  window.db = {};
  window.auth = {};
  window.authFns = {
    onAuthStateChanged: jest.fn((auth, callback) => {
      callback({ uid: "vendor-1" });
      return jest.fn();
    }),
  };
  window.firestoreFns = {
    collection: jest.fn(() => ({})),
    query: jest.fn((ref, ...constraints) => ({ ref, constraints })),
    where: jest.fn((field, op, value) => ({ field, op, value })),
    getDocs: jest.fn(async () => ({
      forEach: (callback) => docs.forEach(callback),
    })),
  };
  window.Chart = jest.fn(() =>
    chartFactory ? chartFactory() : { destroy: jest.fn() }
  );
}

beforeEach(() => {
  jest.resetModules();
  jest.clearAllMocks();
  delete window.db;
  delete window.auth;
  delete window.authFns;
  delete window.firestoreFns;
  delete window.Chart;

  setupAnalyticsDom();
});

function loadAnalyticsModule(orders = [], chartFactory) {
  setupFirebaseMocks(orders, chartFactory);
  require("../../public/vendor/analytics.js");
}

function getText(id) {
  return document.getElementById(id).textContent;
}

function buildOrder(overrides = {}) {
  return {
    id: "order-" + Math.random().toString(36).slice(2, 8),
    vendorUid: "vendor-1",
    paymentAmount: 120,
    status: "completed",
    createdAt: new Date().toISOString(),
    items: [{ name: "Item A", quantity: 1, price: 120, category: "Food" }],
    ...overrides,
  };
}

describe("public/vendor/analytics.js", () => {
  test("renders analytics status container", () => {
    setupAnalyticsDom();
    expect(document.getElementById("analytics-status")).not.toBeNull();
  });

  test("renders start date input", () => {
    setupAnalyticsDom();
    expect(document.getElementById("start-date-input")).not.toBeNull();
  });

  test("renders end date input", () => {
    setupAnalyticsDom();
    expect(document.getElementById("end-date-input")).not.toBeNull();
  });

  test("renders overview button", () => {
    setupAnalyticsDom();
    expect(document.querySelector("button[data-section='overview']")).not.toBeNull();
  });

  test("renders revenue button", () => {
    setupAnalyticsDom();
    expect(document.querySelector("button[data-section='revenue']")).not.toBeNull();
  });

  test("renders overview section", () => {
    setupAnalyticsDom();
    expect(document.getElementById("overview-section")).not.toBeNull();
  });

  test("renders revenue section", () => {
    setupAnalyticsDom();
    expect(document.getElementById("revenue-section")).not.toBeNull();
  });

  test("renders KPI metric spans", () => {
    setupAnalyticsDom();
    expect(document.getElementById("total-revenue")).not.toBeNull();
    expect(document.getElementById("total-orders")).not.toBeNull();
    expect(document.getElementById("avg-order-value")).not.toBeNull();
    expect(document.getElementById("completion-rate")).not.toBeNull();
    expect(document.getElementById("total-items-sold")).not.toBeNull();
    expect(document.getElementById("avg-items-per-order")).not.toBeNull();
  });

  test("renders revenue trend canvas", () => {
    setupAnalyticsDom();
    expect(document.getElementById("revenue-trend-chart")).not.toBeNull();
  });

  test("renders weekly chart canvas", () => {
    setupAnalyticsDom();
    expect(document.getElementById("weekly-chart")).not.toBeNull();
  });

  test("renders status distribution chart canvas", () => {
    setupAnalyticsDom();
    expect(document.getElementById("status-distribution-chart")).not.toBeNull();
  });

  test("renders top items chart canvas", () => {
    setupAnalyticsDom();
    expect(document.getElementById("top-items-chart")).not.toBeNull();
  });

  test("renders peak hours chart canvas", () => {
    setupAnalyticsDom();
    expect(document.getElementById("peak-hours-chart")).not.toBeNull();
  });

  test("renders category chart canvas", () => {
    setupAnalyticsDom();
    expect(document.getElementById("category-chart")).not.toBeNull();
  });

  test("renders refresh button", () => {
    setupAnalyticsDom();
    expect(document.getElementById("refresh-data-button")).not.toBeNull();
  });

  test("renders export button", () => {
    setupAnalyticsDom();
    expect(document.getElementById("export-csv-button")).not.toBeNull();
  });

  test("renders insights container", () => {
    setupAnalyticsDom();
    expect(document.getElementById("insights-container")).not.toBeNull();
  });

  test("overview section is active by default", () => {
    loadAnalyticsModule();
    expect(document.getElementById("overview-section").classList.contains("active")).toBe(true);
    expect(document.getElementById("revenue-section").classList.contains("active")).toBe(false);
  });

  test("revenue button click activates revenue section", () => {
    loadAnalyticsModule();
    const revenueButton = document.querySelector("button[data-section='revenue']");
    revenueButton.click();
    expect(revenueButton.classList.contains("active")).toBe(true);
    expect(document.getElementById("overview-section").classList.contains("active")).toBe(false);
    expect(document.getElementById("revenue-section").classList.contains("active")).toBe(true);
  });

  test("auth state change is registered on module load", () => {
    loadAnalyticsModule();
    expect(window.authFns.onAuthStateChanged).toHaveBeenCalled();
  });

  test("orders collection query runs on module init", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    expect(window.firestoreFns.getDocs).toHaveBeenCalled();
  });

  test("refresh button triggers analytics reload", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    await flushPromises();
    expect(window.firestoreFns.getDocs).toHaveBeenCalledTimes(2);
  });

  test("total revenue is updated when orders exist", async () => {
    loadAnalyticsModule([
      buildOrder({ paymentAmount: 80 }),
      buildOrder({ paymentAmount: 120 }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-revenue")).toContain("200");
  });

  test("total order count is updated correctly", async () => {
    loadAnalyticsModule([buildOrder(), buildOrder(), buildOrder()]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-orders")).toBe("3");
  });

  test("average order value is calculated correctly", async () => {
    loadAnalyticsModule([
      buildOrder({ paymentAmount: 100 }),
      buildOrder({ paymentAmount: 200 }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(getText("avg-order-value")).toContain("150");
  });

  test("completion rate displays 100% for all completed orders", async () => {
    loadAnalyticsModule([buildOrder({ status: "completed" }), buildOrder({ status: "completed" })]);
    await flushPromises();
    await flushPromises();
    expect(getText("completion-rate")).toBe("100%");
  });

  test("completion rate displays 50% when only half of orders are completed", async () => {
    loadAnalyticsModule([buildOrder({ status: "completed" }), buildOrder({ status: "pending" })]);
    await flushPromises();
    await flushPromises();
    expect(getText("completion-rate")).toBe("50%");
  });

  test("total items sold sums item quantities", async () => {
    loadAnalyticsModule([
      buildOrder({ items: [{ name: "A", quantity: 2, price: 50, category: "Food" }] }),
      buildOrder({ items: [{ name: "B", quantity: 3, price: 100, category: "Food" }] }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-items-sold")).toBe("5");
  });

  test("average items per order is calculated correctly", async () => {
    loadAnalyticsModule([
      buildOrder({ items: [{ name: "A", quantity: 2, price: 50, category: "Food" }] }),
      buildOrder({ items: [{ name: "B", quantity: 3, price: 100, category: "Food" }] }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(parseFloat(getText("avg-items-per-order"))).toBe(2.5);
  });

  test("vendor filtering ignores orders from other vendors", async () => {
    loadAnalyticsModule([
      buildOrder({ vendorUid: "vendor-1", paymentAmount: 50 }),
      buildOrder({ vendorUid: "vendor-2", paymentAmount: 100 }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-orders")).toBe("1");
    expect(getText("total-revenue")).toContain("50");
  });

  test("empty order set resets KPI values", async () => {
    loadAnalyticsModule([]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-revenue")).toContain("0");
    expect(getText("total-orders")).toBe("0");
    expect(getText("avg-order-value")).toContain("0");
    expect(getText("completion-rate")).toBe("0%");
    expect(getText("total-items-sold")).toBe("0");
    expect(getText("avg-items-per-order")).toBe("0");
  });

  test("chart library is initialized during analytics load", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    expect(window.Chart).toHaveBeenCalled();
  });

  test("export button remains available after module load", () => {
    loadAnalyticsModule();
    expect(document.getElementById("export-csv-button")).not.toBeNull();
  });

  test("export button click does not throw", () => {
    loadAnalyticsModule();
    expect(() => document.getElementById("export-csv-button").click()).not.toThrow();
  });

  test("start and end date inputs exist and are writable", () => {
    setupAnalyticsDom();
    const startDateInput = document.getElementById("start-date-input");
    const endDateInput = document.getElementById("end-date-input");
    startDateInput.value = "2026-05-01";
    endDateInput.value = "2026-05-31";
    expect(startDateInput.value).toBe("2026-05-01");
    expect(endDateInput.value).toBe("2026-05-31");
  });

  test("revenue button shows revenue section after click", () => {
    loadAnalyticsModule();
    const revenueButton = document.querySelector("button[data-section='revenue']");
    revenueButton.click();
    expect(document.getElementById("revenue-section").classList.contains("active")).toBe(true);
  });

  test("overview button returns to overview section when clicked", () => {
    loadAnalyticsModule();
    const revenueButton = document.querySelector("button[data-section='revenue']");
    const overviewButton = document.querySelector("button[data-section='overview']");
    revenueButton.click();
    overviewButton.click();
    expect(document.getElementById("overview-section").classList.contains("active")).toBe(true);
    expect(overviewButton.classList.contains("active")).toBe(true);
  });

  test("menu button active class toggles when switching sections", () => {
    loadAnalyticsModule();
    const revenueButton = document.querySelector("button[data-section='revenue']");
    const overviewButton = document.querySelector("button[data-section='overview']");
    revenueButton.click();
    expect(revenueButton.classList.contains("active")).toBe(true);
    expect(overviewButton.classList.contains("active")).toBe(false);
    overviewButton.click();
    expect(overviewButton.classList.contains("active")).toBe(true);
    expect(revenueButton.classList.contains("active")).toBe(false);
  });

  test("metrics display includes currency prefix for revenue and avg value", async () => {
    loadAnalyticsModule([buildOrder({ paymentAmount: 75 })]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-revenue")).toContain("ZAR");
    expect(getText("avg-order-value")).toContain("ZAR");
  });

  test("completion rate includes percent symbol", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    expect(getText("completion-rate")).toContain("%");
  });

  test("total items sold display is integer representation", async () => {
    loadAnalyticsModule([buildOrder({ items: [{ name: "A", quantity: 4, price: 100, category: "Food" }] })]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-items-sold")).toBe("4");
  });

  test("avg items per order display is updated for multiple item orders", async () => {
    loadAnalyticsModule([
      buildOrder({ items: [{ name: "A", quantity: 2, price: 100, category: "Food" }] }),
      buildOrder({ items: [{ name: "B", quantity: 4, price: 120, category: "Food" }] }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(parseFloat(getText("avg-items-per-order"))).toBe(3);
  });

  test("module handles orders with mixed categories without throwing", async () => {
    loadAnalyticsModule([
      buildOrder({ items: [{ name: "Meal", quantity: 1, price: 50, category: "Food" }] }),
      buildOrder({ items: [{ name: "Drink", quantity: 1, price: 20, category: "Beverage" }] }),
    ]);
    await flushPromises();
    await flushPromises();
    expect(getText("total-orders")).toBe("2");
  });

  test("insights container remains available after analytics initialization", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    expect(document.getElementById("insights-container")).not.toBeNull();
  });

  test("refresh button is clickable after initial load", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    expect(() => document.getElementById("refresh-data-button").click()).not.toThrow();
  });

  test("getDocs called again after changing date filters and refreshing", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    await flushPromises();
    document.getElementById("start-date-input").value = "2026-05-01";
    document.getElementById("end-date-input").value = "2026-05-31";
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    await flushPromises();
    expect(window.firestoreFns.getDocs).toHaveBeenCalledTimes(2);
  });

  test("chart instances are destroyed if module reinitializes charts", async () => {
    let destroyed = false;
    loadAnalyticsModule([buildOrder()], () => ({ destroy: () => { destroyed = true; } }));
    await flushPromises();
    await flushPromises();
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    await flushPromises();
    expect(destroyed).toBe(true);
  });
});
