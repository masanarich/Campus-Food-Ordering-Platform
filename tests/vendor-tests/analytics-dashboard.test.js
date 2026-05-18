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

function setupFirebaseMocks(orders = []) {
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
  window.Chart = jest.fn(() => ({ destroy: jest.fn() }));
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

function loadAnalyticsModule(orders = []) {
  setupFirebaseMocks(orders);
  require("../../public/vendor/analytics.js");
}

describe("public/vendor/analytics.js", () => {
  test("sidebar menu buttons toggle content sections", () => {
    loadAnalyticsModule();

    const revenueButton = document.querySelector("button[data-section='revenue']");
    const overviewSection = document.getElementById("overview-section");
    const revenueSection = document.getElementById("revenue-section");

    expect(overviewSection.classList.contains("active")).toBe(true);
    expect(revenueSection.classList.contains("active")).toBe(false);

    revenueButton.click();

    expect(revenueButton.classList.contains("active")).toBe(true);
    expect(overviewSection.classList.contains("active")).toBe(false);
    expect(revenueSection.classList.contains("active")).toBe(true);
  });

  test("initializes analytics data and updates KPI metrics", async () => {
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);

    loadAnalyticsModule([
      {
        id: "order-1",
        vendorUid: "vendor-1",
        paymentAmount: 150,
        status: "completed",
        createdAt: yesterday.toISOString(),
        items: [{ name: "Burger", quantity: 1, price: 150, category: "Food" }],
      },
      {
        id: "order-2",
        vendorUid: "vendor-1",
        paymentAmount: 50,
        status: "completed",
        createdAt: today.toISOString(),
        items: [{ name: "Fries", quantity: 1, price: 50, category: "Food" }],
      },
    ]);

    await flushPromises();
    await flushPromises();

    const revenueText = document.getElementById("total-revenue").textContent;
    const ordersText = document.getElementById("total-orders").textContent;
    const avgValueText = document.getElementById("avg-order-value").textContent;
    const completionText = document.getElementById("completion-rate").textContent;
    const itemsSoldText = document.getElementById("total-items-sold").textContent;
    const avgItemsText = document.getElementById("avg-items-per-order").textContent;

    expect(revenueText).toContain("200");
    expect(ordersText).toBe("2");
    expect(avgValueText).toContain("100");
    expect(completionText).toBe("100%");
    expect(itemsSoldText).toBe("2");
    expect(avgItemsText).toBe("1");
  });

  test("refresh button triggers analytics re-initialization", async () => {
    loadAnalyticsModule([
      {
        id: "order-1",
        vendorUid: "vendor-1",
        paymentAmount: 90,
        status: "completed",
        createdAt: new Date().toISOString(),
        items: [{ name: "Wrap", quantity: 1, price: 90, category: "Food" }],
      },
    ]);

    await flushPromises();
    await flushPromises();

    const refreshButton = document.getElementById("refresh-data-button");
    refreshButton.click();

    await flushPromises();
    await flushPromises();

    expect(window.firestoreFns.getDocs).toHaveBeenCalled();
  });
});
