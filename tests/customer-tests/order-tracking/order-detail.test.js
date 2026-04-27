/**
 * @jest-environment jsdom
 */

const customerOrderDetailPage = require("../../../public/customer/order-tracking/order-detail.js");

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        itemCount: 2,
        total: 120,
        status: "preparing",
        items: [
            {
                menuItemId: "item-1",
                name: "Burger",
                quantity: 1,
                price: 50,
                subtotal: 50,
                notes: ""
            },
            {
                menuItemId: "item-2",
                name: "Juice",
                quantity: 2,
                price: 35,
                subtotal: 70,
                notes: "No ice"
            }
        ],
        timeline: [
            {
                status: "pending",
                actorRole: "customer",
                actorName: "Student",
                note: "Order placed.",
                at: "2026-04-20T12:00:00.000Z"
            },
            {
                status: "preparing",
                actorRole: "vendor",
                actorName: "Campus Bites",
                note: "Kitchen started preparing.",
                at: "2026-04-20T12:10:00.000Z"
            }
        ],
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:10:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="order-tracking-detail-status"></p>
        <section id="order-detail-summary"></section>
        <section id="order-detail-items"></section>
        <section id="order-detail-timeline"></section>
    `;

    return {
        statusElement: document.getElementById("order-tracking-detail-status"),
        summaryContainer: document.getElementById("order-detail-summary"),
        itemsContainer: document.getElementById("order-detail-items"),
        timelineContainer: document.getElementById("order-detail-timeline")
    };
}

function createOrderFormattersStub() {
    return {
        formatOrderId: jest.fn(orderId => `Order #${orderId}`),
        getOrderStatusLabel: jest.fn(status => {
            const labels = {
                pending: "Order Received",
                preparing: "Preparing",
                ready: "Ready for Pickup",
                completed: "Completed"
            };
            return labels[status] || "Unknown Status";
        }),
        getOrderStatusTone: jest.fn(status => {
            const tones = {
                pending: "info",
                preparing: "loading",
                ready: "success",
                completed: "success"
            };
            return tones[status] || "info";
        }),
        formatOrderTotal: jest.fn(order => `R${Number(order.total || 0).toFixed(2)}`),
        formatItemCount: jest.fn(count => `${count} ${count === 1 ? "item" : "items"}`),
        formatDateTime: jest.fn(() => "20 Apr 2026, 12:10"),
        formatCurrency: jest.fn(value => `R${Number(value || 0).toFixed(2)}`),
        buildTrackingSteps: jest.fn(() => [
            {
                status: "pending",
                label: "Order Received",
                description: "The vendor still needs to respond.",
                tone: "info"
            },
            {
                status: "preparing",
                label: "Preparing",
                description: "The vendor is actively preparing the order.",
                tone: "loading"
            }
        ]),
        formatTimeline: jest.fn(() => [
            {
                label: "Order Received",
                actorLabel: "Customer",
                note: "Order placed.",
                timestampText: "20 Apr 2026, 12:00",
                tone: "info"
            },
            {
                label: "Preparing",
                actorLabel: "Vendor",
                note: "Kitchen started preparing.",
                timestampText: "20 Apr 2026, 12:10",
                tone: "loading"
            }
        ]),
        formatOrderSummary: jest.fn(() => "Campus Bites • 2 items • R120.00 • Preparing")
    };
}

describe("customer/order-tracking/order-detail.js - helpers", () => {
    test("getOrderIdFromLocation reads the query string", () => {
        const orderId = customerOrderDetailPage.getOrderIdFromLocation({
            href: "http://localhost/public/customer/order-tracking/order-detail.html?orderId=abc-123"
        });

        expect(orderId).toBe("abc-123");
    });

    test("setStatusMessage updates content and state", () => {
        const dom = createDOM();

        customerOrderDetailPage.setStatusMessage(dom.statusElement, "Loaded.", "success");

        expect(dom.statusElement.textContent).toBe("Loaded.");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");
    });
});

describe("customer/order-tracking/order-detail.js - rendering", () => {
    let dom;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderFormatters = createOrderFormattersStub();
    });

    test("renderOrderSummary shows overview lines", () => {
        customerOrderDetailPage.renderOrderSummary(createOrder(), dom.summaryContainer, {
            orderFormatters
        });

        expect(dom.summaryContainer.textContent).toContain("Campus Bites");
        expect(dom.summaryContainer.textContent).toContain("Preparing");
        expect(dom.summaryContainer.textContent).toContain("R120.00");
    });

    test("renderOrderItems shows ordered items and notes", () => {
        customerOrderDetailPage.renderOrderItems(createOrder(), dom.itemsContainer, {
            orderFormatters
        });

        expect(dom.itemsContainer.textContent).toContain("Burger");
        expect(dom.itemsContainer.textContent).toContain("Juice");
        expect(dom.itemsContainer.textContent).toContain("No ice");
    });

    test("renderOrderTimeline shows progress and history", () => {
        customerOrderDetailPage.renderOrderTimeline(createOrder(), dom.timelineContainer, {
            orderFormatters
        });

        expect(dom.timelineContainer.textContent).toContain("Progress");
        expect(dom.timelineContainer.textContent).toContain("Recorded Updates");
        expect(dom.timelineContainer.textContent).toContain("Kitchen started preparing.");
    });

    test("renderEmptyState resets all containers", () => {
        customerOrderDetailPage.renderEmptyState({
            summary: dom.summaryContainer,
            items: dom.itemsContainer,
            timeline: dom.timelineContainer
        });

        expect(dom.summaryContainer.textContent).toContain("No order summary available");
        expect(dom.itemsContainer.textContent).toContain("No items available");
        expect(dom.timelineContainer.textContent).toContain("No timeline available");
    });
});

describe("customer/order-tracking/order-detail.js - fetching and init", () => {
    let dom;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderFormatters = createOrderFormattersStub();
    });

    test("fetchOrderDetail uses orderService when available", async () => {
        const getOrderById = jest.fn(async () => createOrder());

        const result = await customerOrderDetailPage.fetchOrderDetail({
            db: { kind: "db" },
            firestoreFns: {},
            orderId: "order-1",
            orderService: { getOrderById }
        });

        expect(result.success).toBe(true);
        expect(result.order.orderId).toBe("order-1");
        expect(getOrderById).toHaveBeenCalledWith(expect.objectContaining({
            orderId: "order-1"
        }));
    });

    test("fetchOrderDetail falls back to Firestore getDoc", async () => {
        const firestoreFns = {
            doc: jest.fn(() => ({ kind: "doc" })),
            getDoc: jest.fn(async () => ({
                id: "order-1",
                exists: () => true,
                data: () => createOrder()
            }))
        };

        const result = await customerOrderDetailPage.fetchOrderDetail({
            db: { kind: "db" },
            firestoreFns,
            orderId: "order-1"
        });

        expect(result.success).toBe(true);
        expect(result.order.orderId).toBe("order-1");
        expect(firestoreFns.doc).toHaveBeenCalledWith({ kind: "db" }, "orders", "order-1");
    });

    test("init requires a signed-in user", async () => {
        const result = await customerOrderDetailPage.init({
            currentUser: null,
            orderId: "order-1",
            orderFormatters,
            statusSelector: "#order-tracking-detail-status",
            summarySelector: "#order-detail-summary",
            itemsSelector: "#order-detail-items",
            timelineSelector: "#order-detail-timeline"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Please sign in");
    });

    test("init blocks access to another customer's order", async () => {
        const getOrderById = jest.fn(async () => createOrder({
            customerUid: "another-customer"
        }));

        const result = await customerOrderDetailPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById },
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#order-tracking-detail-status",
            summarySelector: "#order-detail-summary",
            itemsSelector: "#order-detail-items",
            timelineSelector: "#order-detail-timeline"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("do not have permission");
    });

    test("init renders the requested order for the signed-in customer", async () => {
        const getOrderById = jest.fn(async () => createOrder());

        const result = await customerOrderDetailPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById },
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#order-tracking-detail-status",
            summarySelector: "#order-detail-summary",
            itemsSelector: "#order-detail-items",
            timelineSelector: "#order-detail-timeline"
        });

        expect(result.success).toBe(true);
        expect(dom.summaryContainer.textContent).toContain("Campus Bites");
        expect(dom.itemsContainer.textContent).toContain("Burger");
        expect(dom.timelineContainer.textContent).toContain("Order Received");
        expect(dom.statusElement.textContent).toContain("Campus Bites");
    });
});
