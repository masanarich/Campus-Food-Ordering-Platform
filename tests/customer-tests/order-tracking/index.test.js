/**
 * @jest-environment jsdom
 */

const customerOrderTrackingPage = require("../../../public/customer/order-tracking/index.js");

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        itemCount: 2,
        total: 120,
        status: "preparing",
        updatedAt: "2026-04-20T12:00:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="order-tracking-status"></p>
        <section id="tracked-orders-container"></section>
    `;

    return {
        statusElement: document.getElementById("order-tracking-status"),
        container: document.getElementById("tracked-orders-container")
    };
}

function createOrderStatusStub() {
    return {
        normalizeOrderStatus: jest.fn((status, fallbackStatus = "pending") => {
            const safeStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
            return safeStatus || fallbackStatus;
        }),
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
                preparing: "info",
                ready: "success",
                completed: "success"
            };
            return tones[status] || "info";
        })
    };
}

function createOrderFormattersStub() {
    return {
        formatCurrency: jest.fn(value => `R${Number(value || 0).toFixed(2)}`)
    };
}

describe("customer/order-tracking/index.js - helpers", () => {
    test("mapOrderRecord formats status and total text", () => {
        const orderStatus = createOrderStatusStub();
        const orderFormatters = createOrderFormattersStub();

        const mapped = customerOrderTrackingPage.mapOrderRecord(createOrder(), {
            orderStatus,
            orderFormatters
        });

        expect(mapped.status).toBe("preparing");
        expect(mapped.statusLabel).toBe("Preparing");
        expect(mapped.totalText).toBe("R120.00");
    });

    test("buildOrderDetailUrl includes the orderId query parameter", () => {
        const url = customerOrderTrackingPage.buildOrderDetailUrl("order-55");

        expect(url).toContain("order-detail.html");
        expect(url).toContain("orderId=order-55");
    });
});

describe("customer/order-tracking/index.js - rendering", () => {
    let dom;
    let orderStatus;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
    });

    test("renderOrders shows empty state when no orders exist", () => {
        customerOrderTrackingPage.renderOrders([], dom.container, {
            orderStatus,
            orderFormatters
        });

        expect(dom.container.textContent).toContain("do not have any orders");
    });

    test("renderOrders creates tracking cards with action links", () => {
        customerOrderTrackingPage.renderOrders([
            createOrder({ orderId: "order-1", vendorName: "Campus Bites" }),
            createOrder({ orderId: "order-2", vendorName: "Fresh Drinks", status: "ready" })
        ], dom.container, {
            orderStatus,
            orderFormatters
        });

        expect(dom.container.querySelectorAll(".tracking-order-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("Campus Bites");
        expect(dom.container.textContent).toContain("Ready for Pickup");
        expect(dom.container.querySelector('a[href*="orderId=order-2"]')).not.toBeNull();
    });

    test("setStatusMessage updates status text and tone", () => {
        customerOrderTrackingPage.setStatusMessage(dom.statusElement, "Tracking 2 orders.", "success");

        expect(dom.statusElement.textContent).toBe("Tracking 2 orders.");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");
    });
});

describe("customer/order-tracking/index.js - fetching and init", () => {
    let dom;
    let orderStatus;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
    });

    test("fetchCustomerOrders uses orderService when available", async () => {
        const getCustomerOrders = jest.fn(async () => [createOrder()]);

        const result = await customerOrderTrackingPage.fetchCustomerOrders({
            db: { kind: "db" },
            firestoreFns: {},
            customerUid: "customer-1",
            orderService: { getCustomerOrders }
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(1);
        expect(getCustomerOrders).toHaveBeenCalledWith(expect.objectContaining({
            customerUid: "customer-1"
        }));
    });

    test("fetchCustomerOrders falls back to Firestore query", async () => {
        const firestoreFns = {
            collection: jest.fn(() => ({ kind: "collection" })),
            where: jest.fn(() => ({ kind: "where" })),
            query: jest.fn(() => ({ kind: "query" })),
            getDocs: jest.fn(async () => ({
                forEach(callback) {
                    callback({
                        id: "order-1",
                        data: () => createOrder()
                    });
                }
            }))
        };

        const result = await customerOrderTrackingPage.fetchCustomerOrders({
            db: { kind: "db" },
            firestoreFns,
            customerUid: "customer-1"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(1);
        expect(firestoreFns.collection).toHaveBeenCalledWith({ kind: "db" }, "orders");
    });

    test("init requires a signed-in user", async () => {
        const result = await customerOrderTrackingPage.init({
            currentUser: null,
            containerSelector: "#tracked-orders-container",
            statusSelector: "#order-tracking-status"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Please sign in");
    });

    test("init renders fetched orders for the current customer", async () => {
        const getCustomerOrders = jest.fn(async () => [
            createOrder({ orderId: "order-1", vendorName: "Campus Bites", status: "preparing" }),
            createOrder({ orderId: "order-2", vendorName: "Fresh Drinks", status: "ready" })
        ]);

        const result = await customerOrderTrackingPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getCustomerOrders },
            orderStatus,
            orderFormatters,
            containerSelector: "#tracked-orders-container",
            statusSelector: "#order-tracking-status"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(2);
        expect(dom.container.querySelectorAll(".tracking-order-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toContain("Tracking 2 orders");
    });
});
