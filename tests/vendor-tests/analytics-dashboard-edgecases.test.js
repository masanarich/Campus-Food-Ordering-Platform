/**
 * @jest-environment jsdom
 *
 * Edge case tests for public/vendor/analytics.js
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

describe("public/vendor/analytics.js edge cases", () => {
  test("export button has button type", () => {
    loadAnalyticsModule();
    expect(document.getElementById("export-csv-button").type).toBe("button");
  });

  test("export button click does not throw with no loaded orders", () => {
    loadAnalyticsModule([]);
    expect(() => document.getElementById("export-csv-button").click()).not.toThrow();
  });

  test("refresh does not throw when start date is after end date", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    document.getElementById("start-date-input").value = "2026-12-31";
    document.getElementById("end-date-input").value = "2026-01-01";
    expect(() => document.getElementById("refresh-data-button").click()).not.toThrow();
  });

  test("handles order with zero payment amount", async () => {
    loadAnalyticsModule([buildOrder({ paymentAmount: 0 })]);
    await flushPromises();
    expect(getText("total-revenue")).toContain("0");
    expect(getText("total-orders")).toBe("1");
  });

  test("handles pending order and shows 0% completion rate", async () => {
    loadAnalyticsModule([buildOrder({ status: "pending" })]);
    await flushPromises();
    expect(getText("completion-rate")).toBe("0%");
  });

  test("completion rate is correct for mixed order statuses", async () => {
    loadAnalyticsModule([
      buildOrder({ status: "completed" }),
      buildOrder({ status: "pending" }),
      buildOrder({ status: "cancelled" }),
    ]);
    await flushPromises();
    expect(getText("completion-rate")).toBe("33%");
  });

  test("chart library is still initialized when no orders are present", async () => {
    loadAnalyticsModule([]);
    await flushPromises();
    expect(window.Chart).toHaveBeenCalled();
  });

  test("refresh twice increments getDocs call count", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    expect(window.firestoreFns.getDocs).toHaveBeenCalledTimes(3);
  });

  test("menu section active state remains valid after refresh", async () => {
    loadAnalyticsModule();
    const revenueButton = document.querySelector("button[data-section='revenue']");
    revenueButton.click();
    await flushPromises();
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    expect(revenueButton.classList.contains("active")).toBe(true);
    expect(document.getElementById("overview-section").classList.contains("active")).toBe(false);
  });

  test("zero-item order updates order count while items sold stays zero", async () => {
    loadAnalyticsModule([
      buildOrder({ items: [] }),
    ]);
    await flushPromises();
    expect(getText("total-orders")).toBe("1");
    expect(getText("total-items-sold")).toBe("0");
  });

  test("start and end date filters can be set and persist after refresh", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    document.getElementById("start-date-input").value = "2026-01-01";
    document.getElementById("end-date-input").value = "2026-01-31";
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    expect(document.getElementById("start-date-input").value).toBe("2026-01-01");
    expect(document.getElementById("end-date-input").value).toBe("2026-01-31");
  });

  test("loading no orders keeps average order value at zero", async () => {
    loadAnalyticsModule([]);
    await flushPromises();
    expect(getText("avg-order-value")).toContain("0");
  });

  test("handles orders from other vendors by excluding them", async () => {
    loadAnalyticsModule([
      buildOrder({ vendorUid: "vendor-2" }),
      buildOrder({ vendorUid: "vendor-1" }),
    ]);
    await flushPromises();
    expect(getText("total-orders")).toBe("1");
  });

  test("chart instances are recreated after refresh", async () => {
    loadAnalyticsModule([buildOrder()]);
    await flushPromises();
    const initialChartCalls = window.Chart.mock.calls.length;
    document.getElementById("refresh-data-button").click();
    await flushPromises();
    expect(window.Chart.mock.calls.length).toBeGreaterThanOrEqual(initialChartCalls + 1);
  });
});