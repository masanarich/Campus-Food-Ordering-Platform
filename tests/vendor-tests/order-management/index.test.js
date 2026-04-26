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

function resetIndexGlobals() {
    delete window.db;
    delete global.db;
    delete window.auth;
    delete global.auth;
    delete window.authFns;
    delete global.authFns;
    delete window.firestoreFns;
    delete global.firestoreFns;
    delete window.orderService;
    delete global.orderService;
    delete window.orderStatus;
    delete global.orderStatus;
    delete window.orderFormatters;
    delete global.orderFormatters;
}

afterEach(() => {
    jest.restoreAllMocks();
    resetIndexGlobals();
});

describe("vendor/order-management/index.js - helpers", () => {
    test("resolve helpers support explicit arguments and global fallbacks", () => {
        const db = { kind: "db" };
        const auth = { currentUser: { uid: "vendor-1" } };
        const authFns = { onAuthStateChanged: jest.fn() };
        const firestoreFns = { getDoc: jest.fn() };
        const orderService = { getVendorOrders: jest.fn() };
        const orderStatus = { getOrderStatusLabel: jest.fn(), normalizeOrderStatus: jest.fn() };
        const orderFormatters = { formatOrderSummary: jest.fn() };

        window.db = db;
        window.auth = auth;
        window.authFns = authFns;
        window.firestoreFns = firestoreFns;
        window.orderService = orderService;
        window.orderStatus = orderStatus;
        window.orderFormatters = orderFormatters;

        expect(vendorOrderManagementPage.resolveFirestore(db)).toBe(db);
        expect(vendorOrderManagementPage.resolveFirestore()).toBe(db);
        expect(vendorOrderManagementPage.resolveAuth(auth)).toBe(auth);
        expect(vendorOrderManagementPage.resolveAuth()).toBe(auth);
        expect(vendorOrderManagementPage.resolveAuthFns(authFns)).toBe(authFns);
        expect(vendorOrderManagementPage.resolveAuthFns()).toBe(authFns);
        expect(vendorOrderManagementPage.resolveFirestoreFns(firestoreFns)).toBe(firestoreFns);
        expect(vendorOrderManagementPage.resolveFirestoreFns()).toBe(firestoreFns);
        expect(vendorOrderManagementPage.resolveOrderService(orderService)).toBe(orderService);
        expect(vendorOrderManagementPage.resolveOrderService()).toBe(orderService);
        expect(vendorOrderManagementPage.resolveOrderStatus(orderStatus)).toBe(orderStatus);
        expect(vendorOrderManagementPage.resolveOrderStatus()).toBe(orderStatus);
        expect(vendorOrderManagementPage.resolveOrderFormatters(orderFormatters)).toBe(orderFormatters);
        expect(vendorOrderManagementPage.resolveOrderFormatters()).toBe(orderFormatters);
    });

    test("waitForAuthReady supports immediate, listener, error, and timeout flows", async () => {
        jest.useFakeTimers();

        try {
            const auth = {
                currentUser: {
                    uid: "vendor-1"
                }
            };
            const immediate = await vendorOrderManagementPage.waitForAuthReady(auth, null);
            const listenerUser = await vendorOrderManagementPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn((safeAuth, onChange) => {
                    onChange({ uid: "vendor-2" });
                })
            });
            const errorFallback = await vendorOrderManagementPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn((safeAuth, onChange, onError) => {
                    onError(new Error("auth failed"));
                })
            });
            const timeoutPromise = vendorOrderManagementPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn(() => jest.fn())
            }, 25);

            jest.advanceTimersByTime(25);

            await expect(timeoutPromise).resolves.toBe(auth.currentUser);
            expect(immediate).toBe(auth.currentUser);
            expect(listenerUser).toEqual({ uid: "vendor-2" });
            expect(errorFallback).toBe(auth.currentUser);
        } finally {
            jest.useRealTimers();
        }
    });

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

    test("setStatusMessage safely ignores missing elements", () => {
        expect(vendorOrderManagementPage.setStatusMessage(null, "Ignored")).toBeUndefined();
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

    test("mapOrderRecord and renderSummary fall back cleanly without shared formatters", () => {
        const mapped = vendorOrderManagementPage.mapOrderRecord({
            id: "raw-order-1",
            customerName: "",
            total: 0,
            status: " ACCEPTED "
        });

        vendorOrderManagementPage.renderSummary(dom.summaryElement, [createOrder({ total: 0, status: "completed" })], null);

        expect(mapped).toEqual({
            orderId: "raw-order-1",
            customerName: "Customer",
            itemCount: 0,
            totalText: "R0.00",
            status: "accepted",
            statusLabel: "accepted",
            tone: "info",
            summaryText: "Customer • 0 items",
            updatedText: "Unknown time"
        });
        expect(dom.summaryElement.textContent).toContain("Vendor: Vendor User");
        expect(dom.summaryElement.textContent).toContain("Combined order value: R0.00");
    });

    test("renderSummary and renderOrders safely ignore missing containers", () => {
        expect(vendorOrderManagementPage.renderSummary(null, [], null)).toBeUndefined();
        expect(vendorOrderManagementPage.renderOrders([], null)).toBeUndefined();
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

    test("fetchVendorProfile falls back to Firestore and then current user after errors", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const firestoreResult = await vendorOrderManagementPage.fetchVendorProfile({
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => ({
                    exists: () => true,
                    data: () => ({
                        vendorOwnerName: "Vendor Owner",
                        vendorStatus: "approved"
                    })
                }))
            },
            currentUser: {
                uid: "vendor-1",
                displayName: "",
                email: "Vendor@Example.com"
            }
        });
        const fallbackResult = await vendorOrderManagementPage.fetchVendorProfile({
            authService: {
                getCurrentUserProfile: jest.fn(async () => {
                    throw new Error("auth profile failed");
                })
            },
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => {
                    throw new Error("firestore failed");
                })
            },
            currentUser: {
                uid: "vendor-1",
                displayName: "Campus Bites"
            }
        });

        expect(firestoreResult.displayName).toBe("Vendor Owner");
        expect(firestoreResult.email).toBe("vendor@example.com");
        expect(fallbackResult.displayName).toBe("Campus Bites");
        expect(errorSpy).toHaveBeenCalledTimes(2);
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

    test("fetchVendorOrders covers missing vendor, docs-array fallback, and failure paths", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const missingVendor = await vendorOrderManagementPage.fetchVendorOrders({
            vendorUid: ""
        });
        const docsArrayResult = await vendorOrderManagementPage.fetchVendorOrders({
            db: { kind: "db" },
            vendorUid: "vendor-1",
            firestoreFns: {
                collection: jest.fn(() => ({ kind: "collection" })),
                getDocs: jest.fn(async () => ({
                    docs: [
                        {
                            id: "",
                            data: () => createOrder({ orderId: "fallback-id", customerName: "Docs Array" })
                        }
                    ]
                }))
            }
        });
        const serviceThenNoFirestore = await vendorOrderManagementPage.fetchVendorOrders({
            db: { kind: "db" },
            vendorUid: "vendor-1",
            orderService: {
                getVendorOrders: jest.fn(async () => {
                    throw new Error("service exploded");
                })
            },
            firestoreFns: {}
        });
        const fetchFailure = await vendorOrderManagementPage.fetchVendorOrders({
            db: { kind: "db" },
            vendorUid: "vendor-1",
            firestoreFns: {
                collection: jest.fn(() => ({ kind: "collection" })),
                getDocs: jest.fn(async () => {
                    const error = new Error("permission denied");
                    error.code = "permission-denied";
                    throw error;
                })
            }
        });

        expect(missingVendor.error.code).toBe("missing-vendor");
        expect(docsArrayResult.success).toBe(true);
        expect(docsArrayResult.orders[0].orderId).toBe("fallback-id");
        expect(serviceThenNoFirestore.error.code).toBe("no-firestore");
        expect(fetchFailure.success).toBe(false);
        expect(fetchFailure.error.code).toBe("permission-denied");
        expect(fetchFailure.error.message).toBe("permission denied");
        expect(errorSpy).toHaveBeenCalledTimes(1);
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

    test("init supports missing containers, fetched errors, auth listeners, and empty results", async () => {
        document.body.innerHTML = "<p>Missing vendor containers</p>";
        const missingContainers = await vendorOrderManagementPage.init();

        expect(missingContainers).toEqual({
            success: false,
            error: "Vendor order management containers not found."
        });

        dom = createDOM();

        const fetchedError = await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            statusSelector: "#vendor-order-management-status",
            summarySelector: "#vendor-order-management-summary",
            containerSelector: "#vendor-orders-container"
        });

        expect(fetchedError.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Vendor order access is not available right now.");

        dom = createDOM();

        const emptyResult = await vendorOrderManagementPage.init({
            auth: {
                currentUser: {
                    uid: "vendor-1",
                    displayName: "Campus Bites"
                }
            },
            authFns: {
                onAuthStateChanged: jest.fn((auth, onChange) => {
                    onChange(auth.currentUser);
                })
            },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: { collection: jest.fn(), getDocs: jest.fn() },
            orderService: {
                getVendorOrders: jest.fn(async () => [])
            },
            statusSelector: "#vendor-order-management-status",
            summarySelector: "#vendor-order-management-summary",
            containerSelector: "#vendor-orders-container"
        });

        expect(emptyResult.success).toBe(true);
        expect(emptyResult.orders).toEqual([]);
        expect(dom.statusElement.textContent).toContain("There are no vendor orders to manage right now.");
        expect(dom.container.textContent).toContain("no vendor orders");
    });
});
