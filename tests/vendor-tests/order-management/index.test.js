/**
 * @jest-environment jsdom
 */

const vendorOrderManagementPage = require("../../../public/vendor/order-management/index.js");

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
        createdAt: "2026-04-20T12:00:00.000Z",
        updatedAt: "2026-04-20T12:15:00.000Z",
        ...overrides
    };
}

function createVendorProfile(overrides = {}) {
    return {
        uid: "vendor-1",
        displayName: "Campus Bites",
        email: "vendor@example.com",
        vendorStatus: "approved",
        accountStatus: "active",
        isAdmin: false,
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="vendor-order-management-status"></p>
        <section id="vendor-order-management-summary"></section>
        <section id="vendor-orders-container"></section>
    `;

    return {
        statusElement: document.getElementById("vendor-order-management-status"),
        summaryElement: document.getElementById("vendor-order-management-summary"),
        container: document.getElementById("vendor-orders-container")
    };
}

function createOrderFormattersStub() {
    return {
        getOrderStatusLabel: jest.fn(status => {
            const labels = {
                pending: "Order Received",
                accepted: "Accepted",
                preparing: "Preparing",
                ready: "Ready for Pickup",
                completed: "Completed"
            };
            return labels[status] || "Unknown Status";
        }),
        getOrderStatusTone: jest.fn(status => {
            const tones = {
                pending: "info",
                accepted: "info",
                preparing: "loading",
                ready: "success",
                completed: "success"
            };
            return tones[status] || "info";
        }),
        formatOrderSummary: jest.fn(order => `${order.customerName} • ${order.itemCount} items • R${Number(order.total || 0).toFixed(2)}`),
        formatOrderTotal: jest.fn(order => `R${Number(order.total || 0).toFixed(2)}`),
        formatDateTime: jest.fn(() => "20 Apr 2026, 12:15"),
        formatCurrency: jest.fn(value => `R${Number(value || 0).toFixed(2)}`)
    };
}

describe("vendor/order-management/index.js - helpers", () => {
    test("normalizeVendorProfile and access checks work", () => {
        const normalized = vendorOrderManagementPage.normalizeVendorProfile({
            uid: " vendor-1 ",
            displayName: " Campus Bites ",
            email: " VENDOR@Example.com ",
            vendorStatus: " approved ",
            accountStatus: " active "
        });

        expect(normalized).toEqual({
            uid: "vendor-1",
            displayName: "Campus Bites",
            email: "vendor@example.com",
            vendorStatus: "approved",
            accountStatus: "active",
            isAdmin: false
        });
        expect(vendorOrderManagementPage.canAccessVendorWorkspace(normalized)).toBe(true);
        expect(vendorOrderManagementPage.canAccessVendorWorkspace({
            vendorStatus: "none",
            accountStatus: "active",
            isAdmin: false
        })).toBe(false);
        expect(vendorOrderManagementPage.canAccessVendorWorkspace({
            vendorStatus: "none",
            accountStatus: "active",
            isAdmin: true
        })).toBe(true);
    });

    test("buildOrderDetailUrl includes orderId", () => {
        const url = vendorOrderManagementPage.buildOrderDetailUrl("order-77");

        expect(url).toContain("order-detail.html");
        expect(url).toContain("orderId=order-77");
    });
});

describe("vendor/order-management/index.js - rendering", () => {
    let dom;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderFormatters = createOrderFormattersStub();
    });

    test("renderSummary shows vendor order totals", () => {
        vendorOrderManagementPage.renderSummary(
            dom.summaryElement,
            [
                createOrder({ status: "pending", total: 85 }),
                createOrder({ orderId: "order-2", status: "ready", total: 50 })
            ],
            createVendorProfile(),
            { orderFormatters }
        );

        expect(dom.summaryElement.textContent).toContain("Campus Bites");
        expect(dom.summaryElement.textContent).toContain("Orders loaded: 2");
        expect(dom.summaryElement.textContent).toContain("Ready for pickup: 1");
        expect(dom.summaryElement.textContent).toContain("R135.00");
    });

    test("renderOrders shows empty state when there are no orders", () => {
        vendorOrderManagementPage.renderOrders([], dom.container, { orderFormatters });

        expect(dom.container.textContent).toContain("no vendor orders");
    });

    test("renderOrders creates cards with order detail links", () => {
        vendorOrderManagementPage.renderOrders([
            createOrder({ orderId: "order-1", customerName: "Student One", status: "pending" }),
            createOrder({ orderId: "order-2", customerName: "Student Two", status: "ready" })
        ], dom.container, { orderFormatters });

        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("Student One");
        expect(dom.container.textContent).toContain("Ready for Pickup");
        expect(dom.container.querySelector('a[href*="orderId=order-2"]')).not.toBeNull();
    });
});

describe("vendor/order-management/index.js - data loading and init", () => {
    let dom;
    let orderFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderFormatters = createOrderFormattersStub();
    });

    test("fetchVendorProfile uses authService when available", async () => {
        const authService = {
            getCurrentUserProfile: jest.fn(async () => createVendorProfile())
        };

        const result = await vendorOrderManagementPage.fetchVendorProfile({
            authService,
            currentUser: { uid: "vendor-1" }
        });

        expect(result.uid).toBe("vendor-1");
        expect(result.displayName).toBe("Campus Bites");
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("vendor-1");
    });

    test("fetchVendorOrders uses orderService when available", async () => {
        const getVendorOrders = jest.fn(async () => [createOrder()]);

        const result = await vendorOrderManagementPage.fetchVendorOrders({
            db: { kind: "db" },
            firestoreFns: {},
            vendorUid: "vendor-1",
            orderService: { getVendorOrders }
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(1);
        expect(getVendorOrders).toHaveBeenCalledWith(expect.objectContaining({
            vendorUid: "vendor-1"
        }));
    });

    test("fetchVendorOrders falls back to Firestore query", async () => {
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

        const result = await vendorOrderManagementPage.fetchVendorOrders({
            db: { kind: "db" },
            firestoreFns,
            vendorUid: "vendor-1"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(1);
        expect(firestoreFns.collection).toHaveBeenCalledWith({ kind: "db" }, "orders");
    });

    test("init requires a signed-in user", async () => {
        const result = await vendorOrderManagementPage.init({
            currentUser: null,
            statusSelector: "#vendor-order-management-status",
            summarySelector: "#vendor-order-management-summary",
            containerSelector: "#vendor-orders-container"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Please sign in");
    });

    test("init blocks users without vendor access", async () => {
        const result = await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile({
                    vendorStatus: "none",
                    isAdmin: false
                }))
            },
            statusSelector: "#vendor-order-management-status",
            summarySelector: "#vendor-order-management-summary",
            containerSelector: "#vendor-orders-container"
        });

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("do not have vendor order access");
    });

    test("init renders vendor orders for approved vendor users", async () => {
        const getVendorOrders = jest.fn(async () => [
            createOrder({ orderId: "order-1", customerName: "Student One", status: "pending" }),
            createOrder({ orderId: "order-2", customerName: "Student Two", status: "ready" })
        ]);

        const result = await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getVendorOrders },
            orderFormatters,
            statusSelector: "#vendor-order-management-status",
            summarySelector: "#vendor-order-management-summary",
            containerSelector: "#vendor-orders-container"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(2);
        expect(dom.summaryElement.textContent).toContain("Orders loaded: 2");
        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toContain("Loaded 2 vendor orders");
    });
});
