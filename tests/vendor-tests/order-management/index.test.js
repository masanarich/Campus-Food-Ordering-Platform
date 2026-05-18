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
        paymentStatus: "paid",
        paymentProvider: "paystack",
        paymentReference: "paystack-ref",
        paymentAmount: 85,
        paymentCurrency: "ZAR",
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

function createPaymentStatusStub() {
    return {
        normalizePaymentStatus: jest.fn((status, fallbackStatus = "unpaid") => {
            const safeStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
            return safeStatus || fallbackStatus;
        }),
        getPaymentStatusLabel: jest.fn(status => {
            const labels = {
                unpaid: "Unpaid",
                pending: "Payment Pending",
                paid: "Paid",
                failed: "Payment Failed"
            };
            return labels[status] || "Unknown Payment Status";
        }),
        getPaymentStatusTone: jest.fn(status => {
            const tones = {
                unpaid: "neutral",
                pending: "loading",
                paid: "success",
                failed: "error"
            };
            return tones[status] || "neutral";
        })
    };
}

function createPaymentFormattersStub() {
    return {
        formatPaymentAmount: jest.fn((amount, currency = "ZAR") => {
            const numeric = Number(amount);
            const safeAmount = Number.isFinite(numeric) ? numeric : 0;
            return currency === "ZAR"
                ? `R${safeAmount.toFixed(2)}`
                : `${currency} ${safeAmount.toFixed(2)}`;
        })
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
    delete window.paymentStatus;
    delete global.paymentStatus;
    delete window.paymentFormatters;
    delete global.paymentFormatters;
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
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();

        window.db = db;
        window.auth = auth;
        window.authFns = authFns;
        window.firestoreFns = firestoreFns;
        window.orderService = orderService;
        window.orderStatus = orderStatus;
        window.orderFormatters = orderFormatters;
        window.paymentStatus = paymentStatus;
        window.paymentFormatters = paymentFormatters;

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
        expect(vendorOrderManagementPage.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
        expect(vendorOrderManagementPage.resolvePaymentStatus()).toBe(paymentStatus);
        expect(vendorOrderManagementPage.resolvePaymentFormatters(paymentFormatters)).toBe(paymentFormatters);
        expect(vendorOrderManagementPage.resolvePaymentFormatters()).toBe(paymentFormatters);
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
    let paymentStatus;
    let paymentFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderFormatters = createOrderFormattersStub();
        paymentStatus = createPaymentStatusStub();
        paymentFormatters = createPaymentFormattersStub();
    });

    test("renderSummary shows vendor order totals and payment counts", () => {
        vendorOrderManagementPage.renderSummary(
            dom.summaryElement,
            [
                createOrder({ status: "pending", total: 85, paymentStatus: "paid" }),
                createOrder({ orderId: "order-2", status: "ready", total: 50, paymentStatus: "unpaid" })
            ],
            createVendorProfile(),
            { orderFormatters }
        );

        expect(dom.summaryElement.textContent).toContain("Campus Bites");
        expect(dom.summaryElement.textContent).toContain("Orders loaded: 2");
        expect(dom.summaryElement.textContent).toContain("Fulfilment-ready paid orders: 1");
        expect(dom.summaryElement.textContent).toContain("Active paid orders: 1");
        expect(dom.summaryElement.textContent).toContain("Ready for pickup: 0");
        expect(dom.summaryElement.textContent).toContain("Blocked unpaid records: 1");
        expect(dom.summaryElement.textContent).toContain("R85.00");
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

    test("renderOrders shows payment status, amount, and reference per card", () => {
        vendorOrderManagementPage.renderOrders([
            createOrder({
                orderId: "order-1",
                customerName: "Student One",
                paymentStatus: "paid",
                paymentReference: "paystack-ref-1",
                paymentAmount: 85
            }),
            createOrder({
                orderId: "order-2",
                customerName: "Student Two",
                paymentStatus: "pending",
                paymentReference: "paystack-ref-2",
                paymentAmount: 50
            })
        ], dom.container, {
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        const cards = dom.container.querySelectorAll(".vendor-order-card");
        expect(cards).toHaveLength(2);

        const firstCard = cards[0];
        const firstPaymentStatus = firstCard.querySelector(".vendor-order-card-payment-status");
        expect(firstPaymentStatus.textContent).toBe("Payment: Paid");
        expect(firstPaymentStatus.getAttribute("data-tone")).toBe("success");
        expect(firstPaymentStatus.getAttribute("data-payment-status")).toBe("paid");
        expect(firstCard.getAttribute("data-fulfillment-ready")).toBe("true");
        expect(firstCard.querySelector(".vendor-order-card-payment-amount").textContent).toBe("Payment Amount: R85.00");
        expect(firstCard.querySelector(".vendor-order-card-payment-reference").textContent).toBe("Reference: paystack-ref-1");

        const secondPaymentStatus = cards[1].querySelector(".vendor-order-card-payment-status");
        expect(secondPaymentStatus.textContent).toBe("Payment: Payment Pending");
        expect(secondPaymentStatus.getAttribute("data-tone")).toBe("loading");
        expect(cards[1].getAttribute("data-fulfillment-ready")).toBe("false");
        expect(cards[1].classList.contains("vendor-order-card-payment-blocked")).toBe(true);
        expect(cards[1].querySelector(".vendor-order-card-payment-guard").textContent)
            .toContain("Payment is not confirmed");
    });

    test("renderOrders omits the reference line when no payment reference exists", () => {
        vendorOrderManagementPage.renderOrders([
            createOrder({ paymentStatus: "unpaid", paymentReference: "" })
        ], dom.container, {
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        const card = dom.container.querySelector(".vendor-order-card");
        expect(card.querySelector(".vendor-order-card-payment-status").textContent).toBe("Payment: Unpaid");
        expect(card.querySelector(".vendor-order-card-payment-reference")).toBeNull();
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
            updatedText: "Unknown time",
            paymentStatus: "unpaid",
            paymentStatusLabel: "unpaid",
            paymentTone: "neutral",
            paymentAmount: 0,
            paymentAmountText: "R0.00",
            paymentCurrency: "ZAR",
            paymentReference: "",
            paymentProvider: "paystack",
            isPaid: false,
            isPaymentBlocked: true,
            paymentGuardMessage: "Payment is not confirmed. Do not accept, prepare, or fulfil this order until payment is completed."
        });
        expect(dom.summaryElement.textContent).toContain("Vendor: Vendor User");
        expect(dom.summaryElement.textContent).toContain("Paid order value: R0.00");
        expect(dom.summaryElement.textContent).toContain("Fulfilment-ready paid orders: 1");
    });

    test("mapOrderRecord uses payment helpers when supplied", () => {
        const mapped = vendorOrderManagementPage.mapOrderRecord(createOrder(), {
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        expect(mapped.paymentStatus).toBe("paid");
        expect(mapped.paymentStatusLabel).toBe("Paid");
        expect(mapped.paymentTone).toBe("success");
        expect(mapped.paymentAmount).toBe(85);
        expect(mapped.paymentAmountText).toBe("R85.00");
        expect(mapped.paymentReference).toBe("paystack-ref");
        expect(mapped.paymentProvider).toBe("paystack");
        expect(mapped.isPaid).toBe(true);
        expect(mapped.isPaymentBlocked).toBe(false);
        expect(mapped.paymentGuardMessage).toBe("");
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
            createOrder({
                orderId: "order-1",
                customerName: "Student One",
                status: "pending",
                paymentStatus: "paid",
                paymentReference: "paystack-ref-1"
            }),
            createOrder({
                orderId: "order-2",
                customerName: "Student Two",
                status: "ready",
                paymentStatus: "pending",
                paymentReference: "paystack-ref-2"
            })
        ]);
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();

        const result = await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getVendorOrders },
            orderFormatters,
            paymentStatus,
            paymentFormatters,
            statusSelector: "#vendor-order-management-status",
            summarySelector: "#vendor-order-management-summary",
            containerSelector: "#vendor-orders-container"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(2);
        expect(dom.summaryElement.textContent).toContain("Orders loaded: 2");
        expect(dom.summaryElement.textContent).toContain("Fulfilment-ready paid orders: 1");
        expect(dom.summaryElement.textContent).toContain("Blocked unpaid records: 1");
        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("Payment: Paid");
        expect(dom.container.textContent).toContain("Payment: Payment Pending");
        expect(dom.container.textContent).toContain("Payment is not confirmed");
        expect(dom.container.textContent).toContain("Reference: paystack-ref-1");
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

describe("vendor/order-management/index.js - filter, sort, paginate", () => {
    function makeOrder(overrides) {
        return {
            orderId: "order-x",
            vendorUid: "vendor-1",
            customerUid: "customer-x",
            customerName: "Sample Student",
            itemCount: 1,
            total: 100,
            status: "pending",
            paymentStatus: "unpaid",
            paymentReference: "",
            createdAt: "2026-04-20T12:00:00.000Z",
            updatedAt: "2026-04-20T12:00:00.000Z",
            ...overrides
        };
    }

    test("sortOrders defaults to newest first", () => {
        const orders = [
            makeOrder({ orderId: "a", updatedAt: "2026-01-01T00:00:00Z" }),
            makeOrder({ orderId: "b", updatedAt: "2026-05-01T00:00:00Z" }),
            makeOrder({ orderId: "c", updatedAt: "2026-03-01T00:00:00Z" })
        ];

        const sorted = vendorOrderManagementPage.sortOrders(orders, "newest");

        expect(sorted.map(o => o.orderId)).toEqual(["b", "c", "a"]);
    });

    test("sortOrders supports oldest, price, and customer sorts", () => {
        const orders = [
            makeOrder({ orderId: "a", customerName: "Alice", total: 50, updatedAt: "2026-01-01T00:00:00Z" }),
            makeOrder({ orderId: "b", customerName: "Charlie", total: 200, updatedAt: "2026-05-01T00:00:00Z" }),
            makeOrder({ orderId: "c", customerName: "Bob", total: 120, updatedAt: "2026-03-01T00:00:00Z" })
        ];

        expect(vendorOrderManagementPage.sortOrders(orders, "oldest").map(o => o.orderId))
            .toEqual(["a", "c", "b"]);
        expect(vendorOrderManagementPage.sortOrders(orders, "price-desc").map(o => o.orderId))
            .toEqual(["b", "c", "a"]);
        expect(vendorOrderManagementPage.sortOrders(orders, "price-asc").map(o => o.orderId))
            .toEqual(["a", "c", "b"]);
        expect(vendorOrderManagementPage.sortOrders(orders, "customer-asc").map(o => o.orderId))
            .toEqual(["a", "c", "b"]);
        expect(vendorOrderManagementPage.sortOrders(orders, "customer-desc").map(o => o.orderId))
            .toEqual(["b", "c", "a"]);
    });

    test("filterOrders narrows by status, payment, and search across customer/order/reference", () => {
        const orders = [
            makeOrder({ orderId: "a", customerName: "Alice", status: "ready", paymentStatus: "paid", paymentReference: "ref-aaa" }),
            makeOrder({ orderId: "b", customerName: "Bob", status: "preparing", paymentStatus: "pending", paymentReference: "ref-bbb" }),
            makeOrder({ orderId: "c", customerName: "Charlie", status: "cancelled", paymentStatus: "paid", paymentReference: "ref-ccc" })
        ];

        expect(vendorOrderManagementPage.filterOrders(orders, { status: "ready" }).map(o => o.orderId))
            .toEqual(["a"]);
        expect(vendorOrderManagementPage.filterOrders(orders, { status: "cancelled" }).map(o => o.orderId))
            .toEqual(["c"]);
        expect(vendorOrderManagementPage.filterOrders(orders, { payment: "paid" }).map(o => o.orderId))
            .toEqual(["a", "c"]);
        expect(vendorOrderManagementPage.filterOrders(orders, { search: "bob" }).map(o => o.orderId))
            .toEqual([]);
        expect(vendorOrderManagementPage.filterOrders(orders, { search: "bob", payment: "all" }).map(o => o.orderId))
            .toEqual(["b"]);
        expect(vendorOrderManagementPage.filterOrders(orders, { search: "ref-ccc" }).map(o => o.orderId))
            .toEqual(["c"]);
    });

    test("filterOrders treats the 'incoming' status as pending plus accepted", () => {
        const orders = [
            makeOrder({ orderId: "a", status: "pending", paymentStatus: "paid" }),
            makeOrder({ orderId: "b", status: "accepted", paymentStatus: "paid" }),
            makeOrder({ orderId: "c", status: "preparing", paymentStatus: "paid" }),
            makeOrder({ orderId: "d", status: "ready", paymentStatus: "paid" }),
            makeOrder({ orderId: "e", status: "pending", paymentStatus: "unpaid" })
        ];

        expect(vendorOrderManagementPage.filterOrders(orders, { status: "incoming" }).map(o => o.orderId))
            .toEqual(["a", "b"]);
        expect(vendorOrderManagementPage.filterOrders(orders, { status: "incoming", payment: "all" }).map(o => o.orderId))
            .toEqual(["a", "b", "e"]);
    });

    test("paginateOrders returns the correct slice and clamps the page index", () => {
        const orders = Array.from({ length: 15 }, (_, index) => makeOrder({ orderId: `order-${index + 1}` }));

        const page1 = vendorOrderManagementPage.paginateOrders(orders, 1, 6);
        expect(page1.pageOrders).toHaveLength(6);
        expect(page1.totalPages).toBe(3);
        expect(page1.page).toBe(1);

        const page3 = vendorOrderManagementPage.paginateOrders(orders, 3, 6);
        expect(page3.pageOrders).toHaveLength(3);
        expect(page3.pageOrders[0].orderId).toBe("order-13");

        const clamped = vendorOrderManagementPage.paginateOrders(orders, 99, 6);
        expect(clamped.page).toBe(3);

        const empty = vendorOrderManagementPage.paginateOrders([], 1, 6);
        expect(empty.totalPages).toBe(1);
        expect(empty.pageOrders).toHaveLength(0);
    });

    test("buildResultSummary distinguishes filtered vs unfiltered counts", () => {
        expect(vendorOrderManagementPage.buildResultSummary(0, 0)).toBe("");
        expect(vendorOrderManagementPage.buildResultSummary(5, 5)).toBe("Showing all 5 orders.");
        expect(vendorOrderManagementPage.buildResultSummary(2, 5)).toBe("Showing 2 of 5 orders.");
        expect(vendorOrderManagementPage.buildResultSummary(1, 1)).toBe("Showing all 1 order.");
    });

    test("applyQuickFilter updates the form selects to the right preset", () => {
        document.body.innerHTML = `
            <form id="qf-form">
                <select name="status">
                    <option value="all" selected>All</option>
                    <option value="incoming">Incoming</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select name="payment">
                    <option value="all" selected>All</option>
                    <option value="paid">Paid</option>
                    <option value="blocked">Blocked</option>
                </select>
                <select name="sort">
                    <option value="newest" selected>Newest</option>
                </select>
                <input name="search" />
            </form>
        `;
        const form = document.getElementById("qf-form");

        const incoming = vendorOrderManagementPage.applyQuickFilter(form, "incoming");
        expect(incoming).toEqual(expect.objectContaining({ status: "incoming", payment: "paid" }));

        const paid = vendorOrderManagementPage.applyQuickFilter(form, "paid");
        expect(paid).toEqual(expect.objectContaining({ status: "all", payment: "paid" }));

        const cancelled = vendorOrderManagementPage.applyQuickFilter(form, "cancelled");
        expect(cancelled).toEqual(expect.objectContaining({ status: "cancelled", payment: "paid" }));

        const reset = vendorOrderManagementPage.applyQuickFilter(form, "all");
        expect(reset).toEqual(expect.objectContaining({ status: "all", payment: "paid" }));

        const blocked = vendorOrderManagementPage.applyQuickFilter(form, "blocked-payment");
        expect(blocked).toEqual(expect.objectContaining({ status: "all", payment: "blocked" }));

        expect(vendorOrderManagementPage.applyQuickFilter(form, "unknown-key")).toBeNull();
    });
});

describe("vendor/order-management/index.js - toolbar integration", () => {
    function setupToolbarDom() {
        document.body.innerHTML = `
            <p id="vendor-order-management-status"></p>
            <section id="vendor-order-management-summary"></section>
            <form id="vendor-orders-filter-form">
                <input id="vendor-orders-search" name="search" type="search" />
                <select id="vendor-orders-status-filter" name="status">
                    <option value="all" selected>All statuses</option>
                    <option value="incoming">Incoming</option>
                    <option value="preparing">Preparing</option>
                    <option value="ready">Ready</option>
                    <option value="cancelled">Cancelled</option>
                </select>
                <select id="vendor-orders-payment-filter" name="payment">
                    <option value="all">All</option>
                    <option value="paid" selected>Paid</option>
                    <option value="blocked">Blocked</option>
                </select>
                <select id="vendor-orders-sort" name="sort">
                    <option value="newest" selected>Newest</option>
                    <option value="price-desc">Price high → low</option>
                </select>
            </form>
            <p id="vendor-orders-results-summary"></p>
            <menu class="vendor-orders-quick-filters">
                <li><button type="button" data-quick-filter="all">All</button></li>
                <li><button type="button" data-quick-filter="incoming">Incoming</button></li>
                <li><button type="button" data-quick-filter="ready">Ready</button></li>
                <li><button type="button" data-quick-filter="paid">Paid</button></li>
                <li><button type="button" data-quick-filter="blocked-payment">Payment Review</button></li>
                <li><button type="button" data-quick-filter="cancelled">Cancelled</button></li>
            </menu>
            <section id="vendor-orders-container"></section>
            <nav id="vendor-orders-pagination" hidden>
                <p id="vendor-orders-pagination-status"></p>
                <menu>
                    <li><button type="button" data-page-action="prev">Prev</button></li>
                    <li><button type="button" data-page-action="next">Next</button></li>
                </menu>
            </nav>
        `;

        return {
            statusElement: document.getElementById("vendor-order-management-status"),
            summaryElement: document.getElementById("vendor-order-management-summary"),
            container: document.getElementById("vendor-orders-container"),
            form: document.getElementById("vendor-orders-filter-form"),
            statusSelect: document.getElementById("vendor-orders-status-filter"),
            paymentSelect: document.getElementById("vendor-orders-payment-filter"),
            sortSelect: document.getElementById("vendor-orders-sort"),
            resultsSummary: document.getElementById("vendor-orders-results-summary"),
            quickFilters: document.querySelector(".vendor-orders-quick-filters"),
            pagination: document.getElementById("vendor-orders-pagination"),
            paginationStatus: document.getElementById("vendor-orders-pagination-status")
        };
    }

    function createOrder(overrides = {}) {
        return {
            orderId: "order-1",
            vendorUid: "vendor-1",
            customerName: "Student One",
            itemCount: 2,
            total: 85,
            status: "pending",
            paymentStatus: "paid",
            paymentReference: "paystack-ref",
            createdAt: "2026-04-20T12:00:00Z",
            updatedAt: "2026-04-20T12:15:00Z",
            ...overrides
        };
    }

    function approvedProfile(overrides = {}) {
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

    test("init wires the filter form so changing status narrows the rendered cards", async () => {
        const dom = setupToolbarDom();

        const getVendorOrders = jest.fn(async () => [
            createOrder({ orderId: "order-1", customerName: "Alice", status: "pending" }),
            createOrder({ orderId: "order-2", customerName: "Bob", status: "ready" }),
            createOrder({ orderId: "order-3", customerName: "Carol", status: "ready" })
        ]);

        await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => approvedProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getVendorOrders }
        });

        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(3);
        expect(dom.resultsSummary.textContent).toContain("all 3");

        dom.statusSelect.value = "ready";
        dom.form.dispatchEvent(new Event("change", { bubbles: true }));

        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(2);
        expect(dom.resultsSummary.textContent).toContain("2 of 3");
    });

    test("init paginates with the configured page size and Next moves to the next page", async () => {
        const dom = setupToolbarDom();

        const orders = Array.from({ length: 8 }, (_, index) => createOrder({
            orderId: `order-${index + 1}`,
            customerName: `Student ${index + 1}`,
            status: index % 2 === 0 ? "pending" : "ready",
            updatedAt: `2026-04-${String(index + 1).padStart(2, "0")}T00:00:00Z`
        }));

        const getVendorOrders = jest.fn(async () => orders);

        await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => approvedProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getVendorOrders },
            pageSize: 3
        });

        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(3);
        expect(dom.pagination.hasAttribute("hidden")).toBe(false);
        expect(dom.paginationStatus.textContent).toBe("Page 1 of 3");

        dom.pagination.querySelector('[data-page-action="next"]').click();

        expect(dom.paginationStatus.textContent).toBe("Page 2 of 3");
        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(3);
    });

    test("quick filter buttons activate the right preset and mark the active chip", async () => {
        const dom = setupToolbarDom();

        const getVendorOrders = jest.fn(async () => [
            createOrder({ orderId: "order-1", status: "pending", paymentStatus: "unpaid" }),
            createOrder({ orderId: "order-2", status: "ready", paymentStatus: "paid" }),
            createOrder({ orderId: "order-3", status: "ready", paymentStatus: "paid" })
        ]);

        await vendorOrderManagementPage.init({
            currentUser: { uid: "vendor-1" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => approvedProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getVendorOrders }
        });

        const paidButton = dom.quickFilters.querySelector('[data-quick-filter="paid"]');
        paidButton.click();

        expect(dom.paymentSelect.value).toBe("paid");
        expect(dom.statusSelect.value).toBe("all");
        expect(paidButton.dataset.active).toBe("true");
        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(2);

        const readyButton = dom.quickFilters.querySelector('[data-quick-filter="ready"]');
        readyButton.click();

        expect(dom.statusSelect.value).toBe("ready");
        expect(dom.paymentSelect.value).toBe("paid");
        expect(readyButton.dataset.active).toBe("true");
        expect(paidButton.dataset.active).toBeUndefined();
        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(2);

        const blockedButton = dom.quickFilters.querySelector('[data-quick-filter="blocked-payment"]');
        blockedButton.click();

        expect(dom.paymentSelect.value).toBe("blocked");
        expect(dom.statusSelect.value).toBe("all");
        expect(blockedButton.dataset.active).toBe("true");
        expect(dom.container.querySelectorAll(".vendor-order-card")).toHaveLength(1);
        expect(dom.container.textContent).toContain("Payment is not confirmed");
    });
});
