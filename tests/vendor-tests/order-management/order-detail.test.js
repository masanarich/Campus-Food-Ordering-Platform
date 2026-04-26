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

function resetOrderDetailGlobals() {
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
    resetOrderDetailGlobals();
});

describe("vendor/order-management/order-detail.js - helpers", () => {
    test("resolve helpers, auth waiting, and vendor profile fallback branches work", async () => {
        jest.useFakeTimers();

        try {
            const db = { kind: "db" };
            const auth = { currentUser: { uid: "vendor-1" } };
            const authFns = { onAuthStateChanged: jest.fn() };
            const firestoreFns = { getDoc: jest.fn() };
            const orderService = { getOrderById: jest.fn() };
            const orderStatus = createOrderStatusStub();
            const orderFormatters = createOrderFormattersStub();

            window.db = db;
            window.auth = auth;
            window.authFns = authFns;
            window.firestoreFns = firestoreFns;
            window.orderService = orderService;
            window.orderStatus = orderStatus;
            window.orderFormatters = orderFormatters;

            expect(vendorOrderDetailPage.resolveFirestore(db)).toBe(db);
            expect(vendorOrderDetailPage.resolveFirestore()).toBe(db);
            expect(vendorOrderDetailPage.resolveAuth(auth)).toBe(auth);
            expect(vendorOrderDetailPage.resolveAuth()).toBe(auth);
            expect(vendorOrderDetailPage.resolveAuthFns(authFns)).toBe(authFns);
            expect(vendorOrderDetailPage.resolveAuthFns()).toBe(authFns);
            expect(vendorOrderDetailPage.resolveFirestoreFns(firestoreFns)).toBe(firestoreFns);
            expect(vendorOrderDetailPage.resolveFirestoreFns()).toBe(firestoreFns);
            expect(vendorOrderDetailPage.resolveOrderService(orderService)).toBe(orderService);
            expect(vendorOrderDetailPage.resolveOrderService()).toBe(orderService);
            expect(vendorOrderDetailPage.resolveOrderStatus(orderStatus)).toBe(orderStatus);
            expect(vendorOrderDetailPage.resolveOrderStatus()).toBe(orderStatus);
            expect(vendorOrderDetailPage.resolveOrderFormatters(orderFormatters)).toBe(orderFormatters);
            expect(vendorOrderDetailPage.resolveOrderFormatters()).toBe(orderFormatters);

            const immediate = await vendorOrderDetailPage.waitForAuthReady(auth, null);
            const listenerUser = await vendorOrderDetailPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn((safeAuth, onChange) => {
                    onChange({ uid: "vendor-2" });
                })
            });
            const errorFallback = await vendorOrderDetailPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn((safeAuth, onChange, onError) => {
                    onError(new Error("auth failed"));
                })
            });
            const timeoutPromise = vendorOrderDetailPage.waitForAuthReady(auth, {
                onAuthStateChanged: jest.fn(() => jest.fn())
            }, 25);

            jest.advanceTimersByTime(25);

            await expect(timeoutPromise).resolves.toBe(auth.currentUser);
            expect(immediate).toBe(auth.currentUser);
            expect(listenerUser).toEqual({ uid: "vendor-2" });
            expect(errorFallback).toBe(auth.currentUser);

            const firestoreProfile = await vendorOrderDetailPage.fetchVendorProfile({
                db,
                firestoreFns: {
                    doc: jest.fn(() => ({ kind: "doc" })),
                    getDoc: jest.fn(async () => ({
                        exists: () => true,
                        data: () => ({
                            vendorOwnerName: "Campus Bites",
                            vendorStatus: "approved"
                        })
                    }))
                },
                currentUser: {
                    uid: "vendor-1",
                    displayName: ""
                }
            });

            expect(firestoreProfile.displayName).toBe("Campus Bites");
        } finally {
            jest.useRealTimers();
        }
    });

    test("getOrderIdFromLocation reads orderId from query string", () => {
        const orderId = vendorOrderDetailPage.getOrderIdFromLocation({
            href: "http://localhost/public/vendor/order-management/order-detail.html?orderId=abc-123"
        });

        expect(orderId).toBe("abc-123");
    });

    test("getOrderIdFromLocation and helpers return safe fallbacks when input is incomplete", () => {
        expect(vendorOrderDetailPage.getOrderIdFromLocation({ href: "" })).toBe("");
        expect(vendorOrderDetailPage.getAllowedVendorActions({}, {})).toEqual([]);
        expect(vendorOrderDetailPage.setStatusMessage(null, "Ignored")).toBeUndefined();
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

    test("render helpers cover empty states and formatter fallbacks", () => {
        vendorOrderDetailPage.renderOrderSummary(null, dom.summaryContainer);
        vendorOrderDetailPage.renderOrderItems({ items: [] }, dom.itemsContainer);
        vendorOrderDetailPage.renderOrderTimeline(createOrder(), dom.timelineContainer);
        vendorOrderDetailPage.renderActionButtons(createOrder({ status: "completed" }), dom.actionContainer, {
            orderStatus,
            orderFormatters
        });
        vendorOrderDetailPage.renderEmptyState({
            actions: dom.actionContainer,
            summary: dom.summaryContainer,
            items: dom.itemsContainer,
            timeline: dom.timelineContainer,
            missing: null
        });

        expect(dom.summaryContainer.textContent).toContain("No order information is available.");
        expect(dom.itemsContainer.textContent).toContain("No order information is available.");
        expect(dom.timelineContainer.textContent).toContain("No order information is available.");
        expect(dom.actionContainer.textContent).toContain("No order information is available.");
    });

    test("render helpers safely ignore missing containers and show direct empty states", () => {
        vendorOrderDetailPage.renderOrderSummary(null, null);
        vendorOrderDetailPage.renderOrderItems(createOrder(), null);
        vendorOrderDetailPage.renderOrderTimeline(createOrder(), null);
        vendorOrderDetailPage.renderActionButtons(createOrder(), null);

        vendorOrderDetailPage.renderOrderSummary(null, dom.summaryContainer);
        expect(dom.summaryContainer.textContent).toContain("Order summary is unavailable right now.");

        vendorOrderDetailPage.renderOrderItems({ items: [] }, dom.itemsContainer);
        expect(dom.itemsContainer.textContent).toContain("does not have any saved items");

        vendorOrderDetailPage.renderOrderTimeline(createOrder(), dom.timelineContainer, {});
        expect(dom.timelineContainer.textContent).toContain("No order timeline has been recorded yet.");

        vendorOrderDetailPage.renderActionButtons(createOrder({ status: "completed" }), dom.actionContainer, {
            orderStatus,
            orderFormatters
        });
        expect(dom.actionContainer.textContent).toContain("No further vendor actions are available");
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

    test("fetchOrderDetail covers missing IDs and Firestore fallback error cases", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const missingOrderId = await vendorOrderDetailPage.fetchOrderDetail({});
        const noFirestore = await vendorOrderDetailPage.fetchOrderDetail({
            orderId: "order-1",
            db: { kind: "db" },
            firestoreFns: {}
        });
        const serviceFailure = await vendorOrderDetailPage.fetchOrderDetail({
            orderId: "order-1",
            db: { kind: "db" },
            firestoreFns: {},
            orderService: {
                getOrderById: jest.fn(async () => {
                    throw new Error("service exploded");
                })
            }
        });
        const notFound = await vendorOrderDetailPage.fetchOrderDetail({
            orderId: "order-1",
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => ({
                    exists: () => false
                }))
            }
        });
        const firestoreSuccess = await vendorOrderDetailPage.fetchOrderDetail({
            orderId: "order-1",
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => ({
                    id: "",
                    exists: () => true,
                    data: () => createOrder({ orderId: "fallback-order-id" })
                }))
            }
        });
        const firestoreFailure = await vendorOrderDetailPage.fetchOrderDetail({
            orderId: "order-1",
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(() => ({ kind: "doc" })),
                getDoc: jest.fn(async () => {
                    const error = new Error("permission denied");
                    error.code = "permission-denied";
                    throw error;
                })
            }
        });

        expect(missingOrderId.error.code).toBe("missing-order-id");
        expect(noFirestore.error.code).toBe("no-firestore");
        expect(serviceFailure.error.code).toBe("no-firestore");
        expect(notFound.error.code).toBe("not-found");
        expect(firestoreSuccess.success).toBe(true);
        expect(firestoreSuccess.order.orderId).toBe("fallback-order-id");
        expect(firestoreFailure.error.code).toBe("permission-denied");
        expect(firestoreFailure.error.message).toBe("permission denied");
        expect(errorSpy).toHaveBeenCalledTimes(1);
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

    test("handleOrderAction covers unavailable service, failure states, confirm collection, and refresh after success", async () => {
        const unavailableResult = await vendorOrderDetailPage.handleOrderAction({
            type: "status_change",
            nextStatus: "accepted"
        }, {
            currentOrder: null
        });

        expect(unavailableResult).toEqual({
            success: false,
            error: "Order actions are not available right now."
        });

        const failingService = {
            getOrderById: jest.fn(),
            updateOrderStatus: jest.fn(async () => ({
                success: false,
                error: {
                    message: "Update failed."
                }
            }))
        };
        const failedResult = await vendorOrderDetailPage.handleOrderAction({
            type: "status_change",
            nextStatus: "accepted"
        }, {
            db: { kind: "db" },
            firestoreFns: {},
            orderService: failingService,
            currentOrder: createOrder(),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            statusSelector: "#vendor-order-detail-status"
        });

        expect(failedResult).toEqual({
            success: false,
            error: "Update failed."
        });
        expect(dom.statusElement.textContent).toContain("Update failed.");

        const orderService = {
            getOrderById: jest.fn(async () => createOrder({ status: "ready" })),
            confirmOrderCollection: jest.fn(async () => ({
                success: true,
                order: createOrder({
                    status: "ready",
                    customerConfirmedCollected: true,
                    vendorConfirmedCollected: true
                })
            }))
        };

        const initResult = await vendorOrderDetailPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService,
            orderStatus,
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });
        const confirmResult = await vendorOrderDetailPage.handleOrderAction({
            type: "confirm_collection",
            nextStatus: "completed"
        }, {
            db: { kind: "db" },
            firestoreFns: {},
            orderService,
            orderStatus,
            orderFormatters,
            currentOrder: createOrder({ status: "ready" }),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            statusSelector: "#vendor-order-detail-status"
        });

        expect(initResult.success).toBe(true);
        expect(confirmResult.success).toBe(true);
        expect(orderService.confirmOrderCollection).toHaveBeenCalledWith(expect.objectContaining({
            actorRole: "vendor"
        }));
        expect(orderService.getOrderById).toHaveBeenCalledTimes(2);
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

    test("init covers missing containers, fetch failures, and orderId from location objects", async () => {
        document.body.innerHTML = "<p>Missing detail containers</p>";
        const missingContainers = await vendorOrderDetailPage.init();

        expect(missingContainers).toEqual({
            success: false,
            error: "Vendor order detail containers were not found."
        });

        dom = createDOM();

        const fetchFailure = await vendorOrderDetailPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(fetchFailure.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Open this page from a vendor order link");
        expect(dom.summaryContainer.textContent).toContain("No order information is available.");

        dom = createDOM();

        const locationObjectResult = await vendorOrderDetailPage.init({
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
            firestoreFns: {},
            orderService: {
                getOrderById: jest.fn(async () => createOrder())
            },
            orderStatus,
            orderFormatters,
            locationObject: {
                href: "http://localhost/public/vendor/order-management/order-detail.html?orderId=order-1"
            },
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(locationObjectResult.success).toBe(true);
        expect(dom.summaryContainer.textContent).toContain("Student One");
    });
});
