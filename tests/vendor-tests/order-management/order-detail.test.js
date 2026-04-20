/**
 * @jest-environment jsdom
 */

const vendorOrderDetailPage = require("../../../public/vendor/order-management/order-detail.js");

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        vendorUid: "vendor-1",
        customerUid: "customer-1",
        customerName: "Student One",
        vendorName: "Campus Bites",
        itemCount: 2,
        total: 85,
        status: "pending",
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
                quantity: 1,
                price: 35,
                subtotal: 35,
                notes: "No ice"
            }
        ],
        timeline: [
            {
                status: "pending",
                actorRole: "customer",
                actorName: "Student One",
                note: "Order placed.",
                at: "2026-04-20T12:00:00.000Z"
            }
        ],
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:05:00.000Z",
        ...overrides
    };
}

function createVendorProfile(overrides = {}) {
    return {
        uid: "vendor-1",
        displayName: "Campus Bites",
        vendorStatus: "approved",
        accountStatus: "active",
        isAdmin: false,
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="vendor-order-detail-status"></p>
        <section id="vendor-order-action-container"></section>
        <section id="vendor-order-summary"></section>
        <section id="vendor-order-items"></section>
        <section id="vendor-order-timeline"></section>
    `;

    return {
        statusElement: document.getElementById("vendor-order-detail-status"),
        actionContainer: document.getElementById("vendor-order-action-container"),
        summaryContainer: document.getElementById("vendor-order-summary"),
        itemsContainer: document.getElementById("vendor-order-items"),
        timelineContainer: document.getElementById("vendor-order-timeline")
    };
}

function createOrderStatusStub() {
    return {
        ORDER_STATUSES: {
            PENDING: "pending",
            ACCEPTED: "accepted",
            PREPARING: "preparing",
            READY: "ready",
            COMPLETED: "completed",
            REJECTED: "rejected"
        },
        getAllowedNextStatuses: jest.fn((currentStatus, actorRole) => {
            if (actorRole !== "vendor") {
                return [];
            }

            if (currentStatus === "pending") {
                return ["accepted", "rejected"];
            }

            if (currentStatus === "accepted") {
                return ["preparing"];
            }

            if (currentStatus === "preparing") {
                return ["ready"];
            }

            if (currentStatus === "ready") {
                return ["completed"];
            }

            return [];
        }),
        getOrderStatusActionLabel: jest.fn(status => {
            const labels = {
                accepted: "Accept Order",
                rejected: "Reject Order",
                preparing: "Start Preparing",
                ready: "Mark Ready for Pickup",
                completed: "Complete Order"
            };
            return labels[status] || "Update Order";
        }),
        getOrderStatusTone: jest.fn(status => {
            const tones = {
                accepted: "info",
                rejected: "error",
                preparing: "loading",
                ready: "success",
                completed: "success"
            };
            return tones[status] || "info";
        })
    };
}

function createOrderFormattersStub() {
    return {
        formatOrderSummary: jest.fn(order => `${order.customerName} • ${order.itemCount} items • R${Number(order.total || 0).toFixed(2)} • ${order.status}`),
        formatOrderId: jest.fn(orderId => `Order #${orderId}`),
        getOrderStatusLabel: jest.fn(status => {
            const labels = {
                pending: "Order Received",
                accepted: "Accepted",
                preparing: "Preparing",
                ready: "Ready for Pickup",
                completed: "Completed",
                rejected: "Rejected"
            };
            return labels[status] || "Unknown Status";
        }),
        formatOrderTotal: jest.fn(order => `R${Number(order.total || 0).toFixed(2)}`),
        formatItemCount: jest.fn(count => `${count} ${count === 1 ? "item" : "items"}`),
        formatDateTime: jest.fn(() => "20 Apr 2026, 12:05"),
        formatCurrency: jest.fn(value => `R${Number(value || 0).toFixed(2)}`),
        formatTimeline: jest.fn(() => [
            {
                label: "Order Received",
                actorLabel: "Student One",
                note: "Order placed.",
                timestampText: "20 Apr 2026, 12:00"
            }
        ])
    };
}

describe("vendor/order-management/order-detail.js - helpers", () => {
    test("getOrderIdFromLocation reads orderId from query string", () => {
        const orderId = vendorOrderDetailPage.getOrderIdFromLocation({
            href: "http://localhost/public/vendor/order-management/order-detail.html?orderId=abc-123"
        });

        expect(orderId).toBe("abc-123");
    });

    test("getAllowedVendorActions derives valid vendor buttons", () => {
        const orderStatus = createOrderStatusStub();

        const actions = vendorOrderDetailPage.getAllowedVendorActions(createOrder(), {
            orderStatus
        });

        expect(actions).toHaveLength(2);
        expect(actions[0].label).toBe("Accept Order");
        expect(actions[1].label).toBe("Reject Order");
    });
});

describe("vendor/order-management/order-detail.js - rendering", () => {
    let dom;
    let orderStatus;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
    });

    test("renderOrderSummary shows customer and total information", () => {
        vendorOrderDetailPage.renderOrderSummary(createOrder(), dom.summaryContainer, {
            orderStatus,
            orderFormatters
        });

        expect(dom.summaryContainer.textContent).toContain("Student One");
        expect(dom.summaryContainer.textContent).toContain("Campus Bites");
        expect(dom.summaryContainer.textContent).toContain("R85.00");
    });

    test("renderOrderItems shows ordered items and notes", () => {
        vendorOrderDetailPage.renderOrderItems(createOrder(), dom.itemsContainer, {
            orderFormatters
        });

        expect(dom.itemsContainer.textContent).toContain("Burger");
        expect(dom.itemsContainer.textContent).toContain("Juice");
        expect(dom.itemsContainer.textContent).toContain("No ice");
    });

    test("renderOrderTimeline shows timeline entries", () => {
        vendorOrderDetailPage.renderOrderTimeline(createOrder(), dom.timelineContainer, {
            orderStatus,
            orderFormatters
        });

        expect(dom.timelineContainer.textContent).toContain("Order Received");
        expect(dom.timelineContainer.textContent).toContain("Order placed.");
    });

    test("renderActionButtons shows vendor controls", () => {
        vendorOrderDetailPage.renderActionButtons(createOrder(), dom.actionContainer, {
            orderStatus,
            orderFormatters
        });

        const buttons = dom.actionContainer.querySelectorAll("button");
        expect(buttons).toHaveLength(2);
        expect(dom.actionContainer.textContent).toContain("Accept Order");
        expect(dom.actionContainer.textContent).toContain("Reject Order");
    });
});

describe("vendor/order-management/order-detail.js - data loading and init", () => {
    let dom;
    let orderStatus;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
    });

    test("fetchOrderDetail uses orderService when available", async () => {
        const getOrderById = jest.fn(async () => createOrder());

        const result = await vendorOrderDetailPage.fetchOrderDetail({
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

    test("handleOrderAction updates status through shared service", async () => {
        const updateOrderStatus = jest.fn(async () => ({
            success: true,
            order: createOrder({ status: "accepted" })
        }));

        const result = await vendorOrderDetailPage.handleOrderAction({
            type: "status_change",
            nextStatus: "accepted"
        }, {
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById: jest.fn(), updateOrderStatus },
            currentOrder: createOrder(),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            statusSelector: "#vendor-order-detail-status"
        });

        expect(result.success).toBe(true);
        expect(updateOrderStatus).toHaveBeenCalledWith(expect.objectContaining({
            nextStatus: "accepted",
            actorRole: "vendor"
        }));
    });

    test("init requires a signed-in user", async () => {
        const result = await vendorOrderDetailPage.init({
            currentUser: null,
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Please sign in");
    });

    test("init blocks users without vendor access", async () => {
        const result = await vendorOrderDetailPage.init({
            currentUser: { uid: "vendor-1" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile({
                    vendorStatus: "none"
                }))
            },
            orderId: "order-1",
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("do not have vendor access");
    });

    test("init blocks vendor from opening another vendor's order", async () => {
        const result = await vendorOrderDetailPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: {
                getOrderById: jest.fn(async () => createOrder({ vendorUid: "vendor-2" }))
            },
            orderStatus,
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("do not have permission");
    });

    test("init renders vendor order detail for the owning vendor", async () => {
        const result = await vendorOrderDetailPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: {
                getOrderById: jest.fn(async () => createOrder())
            },
            orderStatus,
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(result.success).toBe(true);
        expect(dom.summaryContainer.textContent).toContain("Student One");
        expect(dom.itemsContainer.textContent).toContain("Burger");
        expect(dom.timelineContainer.textContent).toContain("Order Received");
        expect(dom.actionContainer.textContent).toContain("Accept Order");
        expect(dom.statusElement.textContent).toContain("Student One");
    });
});
