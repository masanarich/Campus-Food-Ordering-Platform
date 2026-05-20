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
        paymentStatus: "paid",
        paymentProvider: "paystack",
        paymentReference: "paystack-ref",
        paymentAmount: 85,
        paymentCurrency: "ZAR",
        paymentPaidAt: "2026-04-20T12:01:00.000Z",
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
        <section id="vendor-order-payment"></section>
        <section id="vendor-order-timeline"></section>
    `;

    return {
        statusElement: document.getElementById("vendor-order-detail-status"),
        actionContainer: document.getElementById("vendor-order-action-container"),
        summaryContainer: document.getElementById("vendor-order-summary"),
        itemsContainer: document.getElementById("vendor-order-items"),
        paymentContainer: document.getElementById("vendor-order-payment"),
        timelineContainer: document.getElementById("vendor-order-timeline")
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
        getPaymentStatusDescription: jest.fn(status => {
            const descriptions = {
                unpaid: "Payment has not been started for this order.",
                pending: "Payment has been started and is waiting for verification.",
                paid: "Payment was successfully verified.",
                failed: "Payment could not be verified or was not completed."
            };
            return descriptions[status] || "";
        }),
        getPaymentStatusTone: jest.fn(status => {
            const tones = {
                unpaid: "neutral",
                pending: "loading",
                paid: "success",
                failed: "error"
            };
            return tones[status] || "neutral";
        }),
        isPaymentPaid: jest.fn(status => status === "paid")
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

function createRefundStatusStub() {
    return {
        getDefaultRefundStatus: jest.fn(() => "not_requested"),
        normalizeRefundStatus: jest.fn((status, fallbackStatus = "not_requested") => {
            const safeStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
            return safeStatus || fallbackStatus;
        }),
        getRefundStatusLabel: jest.fn(status => {
            const labels = {
                not_requested: "Refund Not Requested",
                requested: "Refund Requested",
                processing: "Refund Processing",
                refunded: "Refunded",
                failed: "Refund Failed",
                cancelled: "Refund Cancelled"
            };
            return labels[status] || "Unknown Refund Status";
        }),
        getRefundStatusTone: jest.fn(status => {
            const tones = {
                not_requested: "neutral",
                requested: "loading",
                processing: "loading",
                refunded: "success",
                failed: "error",
                cancelled: "warning"
            };
            return tones[status] || "neutral";
        })
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
    delete window.functions;
    delete global.functions;
    delete window.functionsFns;
    delete global.functionsFns;
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
    delete window.refundStatus;
    delete global.refundStatus;
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
            const functions = { kind: "functions" };
            const functionsFns = { httpsCallable: jest.fn(() => jest.fn()) };
            const orderService = { getOrderById: jest.fn() };
            const orderStatus = createOrderStatusStub();
            const orderFormatters = createOrderFormattersStub();

            window.db = db;
            window.auth = auth;
            window.authFns = authFns;
            window.firestoreFns = firestoreFns;
            window.functions = functions;
            window.functionsFns = functionsFns;
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
            expect(vendorOrderDetailPage.resolveFunctions(functions)).toBe(functions);
            expect(vendorOrderDetailPage.resolveFunctions()).toBe(functions);
            expect(vendorOrderDetailPage.resolveFunctionsFns(functionsFns)).toBe(functionsFns);
            expect(vendorOrderDetailPage.resolveFunctionsFns()).toBe(functionsFns);
            expect(vendorOrderDetailPage.normalizeCallableResult({ data: { success: true } })).toEqual({ success: true });
            expect(vendorOrderDetailPage.resolveRefundPaymentCallable({
                refundPaymentCallable: functionsFns.httpsCallable()
            })).toBeDefined();
            expect(vendorOrderDetailPage.resolveRefundPaymentCallable({
                functions,
                functionsFns
            })).toBeDefined();
            expect(functionsFns.httpsCallable).toHaveBeenCalledWith(functions, "refundPayment");
            expect(vendorOrderDetailPage.resolveOrderService(orderService)).toBe(orderService);
            expect(vendorOrderDetailPage.resolveOrderService()).toBe(orderService);
            expect(vendorOrderDetailPage.resolveOrderStatus(orderStatus)).toBe(orderStatus);
            expect(vendorOrderDetailPage.resolveOrderStatus()).toBe(orderStatus);
            expect(vendorOrderDetailPage.resolveOrderFormatters(orderFormatters)).toBe(orderFormatters);
            expect(vendorOrderDetailPage.resolveOrderFormatters()).toBe(orderFormatters);

            const paymentStatusGlobal = createPaymentStatusStub();
            const paymentFormattersGlobal = createPaymentFormattersStub();
            const refundStatusGlobal = createRefundStatusStub();
            window.paymentStatus = paymentStatusGlobal;
            window.paymentFormatters = paymentFormattersGlobal;
            window.refundStatus = refundStatusGlobal;
            expect(vendorOrderDetailPage.resolvePaymentStatus(paymentStatusGlobal)).toBe(paymentStatusGlobal);
            expect(vendorOrderDetailPage.resolvePaymentStatus()).toBe(paymentStatusGlobal);
            expect(vendorOrderDetailPage.resolvePaymentFormatters(paymentFormattersGlobal)).toBe(paymentFormattersGlobal);
            expect(vendorOrderDetailPage.resolvePaymentFormatters()).toBe(paymentFormattersGlobal);
            expect(vendorOrderDetailPage.resolveRefundStatus(refundStatusGlobal)).toBe(refundStatusGlobal);
            expect(vendorOrderDetailPage.resolveRefundStatus()).toBe(refundStatusGlobal);

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

    test("renderActionButtons disables forward actions and shows a banner when payment is not paid", () => {
        const paymentStatus = createPaymentStatusStub();

        vendorOrderDetailPage.renderActionButtons(
            createOrder({ paymentStatus: "unpaid" }),
            dom.actionContainer,
            { orderStatus, orderFormatters, paymentStatus }
        );

        const banner = dom.actionContainer.querySelector(".vendor-order-payment-gate");
        expect(banner).not.toBeNull();
        expect(banner.textContent).toContain("until payment is completed");
        expect(banner.getAttribute("data-payment-status")).toBe("unpaid");

        const buttons = dom.actionContainer.querySelectorAll("button");
        const acceptButton = Array.from(buttons).find(button => button.dataset.nextStatus === "accepted");
        const rejectButton = Array.from(buttons).find(button => button.dataset.nextStatus === "rejected");

        expect(acceptButton.disabled).toBe(true);
        expect(acceptButton.dataset.blockedReason).toBe("payment-not-confirmed");
        expect(rejectButton.disabled).toBe(false);
    });

    test("renderActionButtons keeps the accept button enabled when payment is paid", () => {
        const paymentStatus = createPaymentStatusStub();

        vendorOrderDetailPage.renderActionButtons(
            createOrder({ paymentStatus: "paid" }),
            dom.actionContainer,
            { orderStatus, orderFormatters, paymentStatus }
        );

        expect(dom.actionContainer.querySelector(".vendor-order-payment-gate")).toBeNull();

        const buttons = dom.actionContainer.querySelectorAll("button");
        Array.from(buttons).forEach(button => expect(button.disabled).toBe(false));
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

describe("vendor/order-management/order-detail.js - payment rendering and gating", () => {
    let dom;
    let orderStatus;
    let orderFormatters;
    let paymentStatus;
    let paymentFormatters;
    let refundStatus;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
        paymentStatus = createPaymentStatusStub();
        paymentFormatters = createPaymentFormattersStub();
        refundStatus = createRefundStatusStub();
    });

    test("buildPaymentView returns a paid summary", () => {
        const view = vendorOrderDetailPage.buildPaymentView(createOrder(), {
            paymentStatus,
            paymentFormatters,
            orderFormatters,
            refundStatus
        });

        expect(view.status).toBe("paid");
        expect(view.statusLabel).toBe("Paid");
        expect(view.tone).toBe("success");
        expect(view.amountText).toBe("R85.00");
        expect(view.providerLabel).toBe("Paystack");
        expect(view.reference).toBe("paystack-ref");
        expect(view.isPaid).toBe(true);
        expect(view.refundStatus).toBe("not_requested");
        expect(view.refundStatusLabel).toBe("Refund Not Requested");
    });

    test("buildPaymentView falls back to unpaid with order.total when paymentAmount is missing", () => {
        const view = vendorOrderDetailPage.buildPaymentView({
            orderId: "order-2",
            status: "pending",
            total: 30
        }, { paymentStatus, paymentFormatters });

        expect(view.status).toBe("unpaid");
        expect(view.amount).toBe(30);
        expect(view.amountText).toBe("R30.00");
        expect(view.isPaid).toBe(false);
    });

    test("getPaymentGate blocks forward moves for unpaid pending orders", () => {
        const gate = vendorOrderDetailPage.getPaymentGate(
            createOrder({ paymentStatus: "unpaid", status: "pending" }),
            { paymentStatus }
        );

        expect(gate.blocked).toBe(true);
        expect(gate.paymentStatus).toBe("unpaid");
        expect(gate.reason).toContain("Unpaid");
    });

    test("getPaymentGate also blocks accepted orders that are still unpaid", () => {
        const gate = vendorOrderDetailPage.getPaymentGate(
            createOrder({ paymentStatus: "failed", status: "accepted" }),
            { paymentStatus }
        );

        expect(gate.blocked).toBe(true);
        expect(gate.paymentStatus).toBe("failed");
    });

    test("getPaymentGate does not block paid orders but blocks unpaid fulfilment states", () => {
        const paidGate = vendorOrderDetailPage.getPaymentGate(
            createOrder({ paymentStatus: "paid", status: "pending" }),
            { paymentStatus }
        );
        const readyGate = vendorOrderDetailPage.getPaymentGate(
            createOrder({ paymentStatus: "unpaid", status: "ready" }),
            { paymentStatus }
        );

        expect(paidGate.blocked).toBe(false);
        expect(readyGate.blocked).toBe(true);
        expect(readyGate.reason).toContain("complete");
    });

    test("getPaymentGate allows terminal rejected and completed orders to be reviewed", () => {
        const rejectedGate = vendorOrderDetailPage.getPaymentGate(
            createOrder({ paymentStatus: "unpaid", status: "rejected" }),
            { paymentStatus }
        );
        const completedGate = vendorOrderDetailPage.getPaymentGate(
            createOrder({ paymentStatus: "unpaid", status: "completed" }),
            { paymentStatus }
        );

        expect(rejectedGate.blocked).toBe(false);
        expect(completedGate.blocked).toBe(false);
    });

    test("renderOrderPayment writes status, amount, provider, reference for a paid order", () => {
        vendorOrderDetailPage.renderOrderPayment(createOrder(), dom.paymentContainer, {
            paymentStatus,
            paymentFormatters,
            orderFormatters,
            refundStatus
        });

        const statusLine = dom.paymentContainer.querySelector(".vendor-order-payment-status");
        expect(statusLine.textContent).toBe("Status: Paid");
        expect(statusLine.getAttribute("data-tone")).toBe("success");
        expect(statusLine.getAttribute("data-payment-status")).toBe("paid");

        expect(dom.paymentContainer.querySelector(".vendor-order-payment-amount").textContent).toBe("Amount: R85.00");
        expect(dom.paymentContainer.querySelector(".vendor-order-payment-provider").textContent).toBe("Provider: Paystack");
        expect(dom.paymentContainer.querySelector(".vendor-order-payment-reference").textContent).toBe("Reference: paystack-ref");
        expect(dom.paymentContainer.querySelector(".vendor-order-payment-paid-at").textContent).toContain("Paid at:");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-status").textContent).toBe("Refund status: Refund Not Requested");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-status").getAttribute("data-refund-status")).toBe("not_requested");
    });

    test("renderOrderPayment shows checkout id and refund detail when present", () => {
        vendorOrderDetailPage.renderOrderPayment(
            createOrder({
                checkoutId: "checkout-1",
                refundStatus: "requested",
                refundAmount: 25,
                refundReference: "refund-ref",
                refundReason: "Vendor rejected order."
            }),
            dom.paymentContainer,
            { paymentStatus, paymentFormatters, orderFormatters, refundStatus }
        );

        expect(dom.paymentContainer.querySelector(".vendor-order-payment-checkout-id").textContent).toBe("Checkout ID: checkout-1");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-status").textContent).toBe("Refund status: Refund Requested");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-status").getAttribute("data-tone")).toBe("loading");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-amount").textContent).toBe("Refund amount: R25.00");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-reference").textContent).toContain("refund-ref");
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-reason").textContent).toContain("Vendor rejected order.");
    });

    test("renderOrderPayment warns when a paid rejected order has not been refunded", () => {
        const view = vendorOrderDetailPage.buildPaymentView(
            createOrder({ status: "rejected", paymentStatus: "paid" }),
            { paymentStatus, paymentFormatters, refundStatus }
        );

        vendorOrderDetailPage.renderOrderPayment(
            createOrder({ status: "rejected", paymentStatus: "paid" }),
            dom.paymentContainer,
            { paymentStatus, paymentFormatters, refundStatus }
        );

        expect(view.requiresRefund).toBe(true);
        expect(dom.paymentContainer.querySelector(".vendor-order-refund-notice").textContent)
            .toContain("must be refunded");
    });

    test("builds refund requests only for paid rejected orders that still need refunds", () => {
        const paidOrder = createOrder({
            status: "pending",
            paymentStatus: "paid",
            paymentAmountInMinorUnits: 8500
        });
        const request = vendorOrderDetailPage.buildRefundPaymentRequest(paidOrder, {
            paymentStatus,
            paymentFormatters,
            refundStatus,
            currentUser: {
                uid: "vendor-1",
                displayName: "Campus Bites"
            }
        });

        expect(vendorOrderDetailPage.shouldRefundRejectedOrder(paidOrder, {
            paymentStatus,
            paymentFormatters,
            refundStatus
        })).toBe(true);
        expect(vendorOrderDetailPage.shouldRefundRejectedOrder(createOrder({
            paymentStatus: "unpaid"
        }), {
            paymentStatus,
            refundStatus
        })).toBe(false);
        expect(vendorOrderDetailPage.shouldRefundRejectedOrder(createOrder({
            paymentStatus: "paid",
            refundStatus: "processing"
        }), {
            paymentStatus,
            refundStatus
        })).toBe(false);
        expect(request).toEqual(expect.objectContaining({
            reference: "paystack-ref",
            refundAmount: 85,
            reason: "Vendor rejected the paid order."
        }));
        expect(request.payment).toEqual(expect.objectContaining({
            orderId: "order-1",
            status: "paid",
            paymentReference: "paystack-ref",
            amountInMinorUnits: 8500
        }));
        expect(request.metadata).toEqual(expect.objectContaining({
            orderId: "order-1",
            vendorUid: "vendor-1",
            rejectedByUid: "vendor-1",
            rejectedByName: "Campus Bites"
        }));
    });

    test("refundRejectedOrder calls the refund callable and unwraps callable data", async () => {
        const refundPaymentCallable = jest.fn(async request => ({
            data: {
                success: true,
                refund: {
                    refundReference: "refund-ref"
                },
                patch: {
                    refundStatus: "refunded"
                },
                patchResult: {
                    success: true
                },
                reference: request.reference
            }
        }));

        const result = await vendorOrderDetailPage.refundRejectedOrder(createOrder(), {
            paymentStatus,
            paymentFormatters,
            refundStatus,
            refundPaymentCallable,
            currentUser: {
                uid: "vendor-1"
            }
        });

        expect(result.success).toBe(true);
        expect(result.refund.refundReference).toBe("refund-ref");
        expect(result.patch.refundStatus).toBe("refunded");
        expect(refundPaymentCallable).toHaveBeenCalledWith(expect.objectContaining({
            reference: "paystack-ref",
            payment: expect.objectContaining({
                orderId: "order-1"
            })
        }));
    });

    test("refundRejectedOrder reports unavailable and failed refund callables", async () => {
        const unavailable = await vendorOrderDetailPage.refundRejectedOrder(createOrder(), {
            paymentStatus,
            paymentFormatters,
            refundStatus
        });
        const failed = await vendorOrderDetailPage.refundRejectedOrder(createOrder(), {
            paymentStatus,
            paymentFormatters,
            refundStatus,
            refundPaymentCallable: jest.fn(async () => ({
                data: {
                    success: false,
                    error: {
                        code: "payments/refund-failed",
                        message: "Refund failed."
                    }
                }
            }))
        });
        const thrown = await vendorOrderDetailPage.refundRejectedOrder(createOrder(), {
            paymentStatus,
            paymentFormatters,
            refundStatus,
            refundPaymentCallable: jest.fn(async () => {
                throw new Error("network down");
            })
        });

        expect(unavailable.success).toBe(false);
        expect(unavailable.error.code).toBe("vendor-order/refund-unavailable");
        expect(failed.success).toBe(false);
        expect(failed.error.message).toBe("Refund failed.");
        expect(thrown.success).toBe(false);
        expect(thrown.error.message).toBe("network down");
    });

    test("renderOrderPayment surfaces failure reason for failed payments", () => {
        vendorOrderDetailPage.renderOrderPayment(
            createOrder({
                paymentStatus: "failed",
                paymentFailureReason: "Card was declined.",
                paymentFailedAt: "2026-04-20T12:02:00.000Z"
            }),
            dom.paymentContainer,
            { paymentStatus, paymentFormatters, orderFormatters }
        );

        expect(dom.paymentContainer.querySelector(".vendor-order-payment-status").textContent).toBe("Status: Payment Failed");
        expect(dom.paymentContainer.querySelector(".vendor-order-payment-failure-reason").textContent).toContain("Card was declined.");
    });

    test("renderOrderPayment shows an empty state when the order is missing", () => {
        vendorOrderDetailPage.renderOrderPayment(null, dom.paymentContainer, {
            paymentStatus,
            paymentFormatters
        });

        expect(dom.paymentContainer.textContent).toContain("Payment details are unavailable");
    });

    test("handleOrderAction does not fire when a forward button is disabled by the payment gate", async () => {
        const updateOrderStatus = jest.fn();
        vendorOrderDetailPage.renderActionButtons(
            createOrder({ paymentStatus: "unpaid", status: "pending" }),
            dom.actionContainer,
            {
                orderStatus,
                orderFormatters,
                paymentStatus,
                orderService: { updateOrderStatus, getOrderById: jest.fn() },
                currentOrder: createOrder({ paymentStatus: "unpaid", status: "pending" }),
                currentUser: { uid: "vendor-1" }
            }
        );

        const acceptButton = Array.from(dom.actionContainer.querySelectorAll("button"))
            .find(button => button.dataset.nextStatus === "accepted");
        acceptButton.click();

        // Disabled button must not trigger the click handler.
        expect(updateOrderStatus).not.toHaveBeenCalled();
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

    test("handleOrderAction refuses unpaid forward moves before calling the service", async () => {
        const paymentStatus = createPaymentStatusStub();
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
            currentOrder: createOrder({ paymentStatus: "pending", status: "pending" }),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            paymentStatus,
            statusSelector: "#vendor-order-detail-status"
        });

        expect(result.success).toBe(false);
        expect(result.blockedByPayment).toBe(true);
        expect(result.error).toContain("Payment Pending");
        expect(updateOrderStatus).not.toHaveBeenCalled();
        expect(dom.statusElement.textContent).toContain("Payment Pending");
    });

    test("handleOrderAction still allows vendors to reject an unpaid order", async () => {
        const paymentStatus = createPaymentStatusStub();
        const updateOrderStatus = jest.fn(async () => ({
            success: true,
            order: createOrder({ status: "rejected", paymentStatus: "unpaid" })
        }));

        const result = await vendorOrderDetailPage.handleOrderAction({
            type: "status_change",
            nextStatus: "rejected"
        }, {
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById: jest.fn(), updateOrderStatus },
            currentOrder: createOrder({ paymentStatus: "unpaid", status: "pending" }),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            paymentStatus,
            statusSelector: "#vendor-order-detail-status"
        });

        expect(result.success).toBe(true);
        expect(updateOrderStatus).toHaveBeenCalledWith(expect.objectContaining({
            nextStatus: "rejected",
            actorRole: "vendor"
        }));
    });

    test("handleOrderAction refunds the customer when a paid order is rejected", async () => {
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();
        const refundStatus = createRefundStatusStub();
        const updateOrderStatus = jest.fn(async () => ({
            success: true,
            order: createOrder({ status: "rejected", paymentStatus: "paid" })
        }));
        const refundPaymentCallable = jest.fn(async () => ({
            data: {
                success: true,
                refund: {
                    refundReference: "refund-ref"
                },
                patch: {
                    refundStatus: "refunded",
                    refundReference: "refund-ref"
                },
                patchResult: {
                    success: true
                }
            }
        }));

        const result = await vendorOrderDetailPage.handleOrderAction({
            type: "status_change",
            nextStatus: "rejected"
        }, {
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById: jest.fn(), updateOrderStatus },
            currentOrder: createOrder({ paymentStatus: "paid", status: "pending" }),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            paymentStatus,
            paymentFormatters,
            refundStatus,
            refundPaymentCallable,
            statusSelector: "#vendor-order-detail-status"
        });

        expect(result.success).toBe(true);
        expect(result.refundRequired).toBe(true);
        expect(result.refundResult.success).toBe(true);
        expect(refundPaymentCallable).toHaveBeenCalledWith(expect.objectContaining({
            reference: "paystack-ref",
            reason: "Vendor rejected the paid order.",
            payment: expect.objectContaining({
                orderId: "order-1",
                status: "paid"
            })
        }));
        expect(dom.statusElement.textContent).toContain("refund started");
    });

    test("handleOrderAction reports refund failure after rejecting a paid order", async () => {
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();
        const refundStatus = createRefundStatusStub();
        const updateOrderStatus = jest.fn(async () => ({
            success: true,
            order: createOrder({ status: "rejected", paymentStatus: "paid" })
        }));
        const refundPaymentCallable = jest.fn(async () => ({
            data: {
                success: false,
                error: {
                    message: "Refund service failed."
                }
            }
        }));

        const result = await vendorOrderDetailPage.handleOrderAction({
            type: "status_change",
            nextStatus: "rejected"
        }, {
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById: jest.fn(), updateOrderStatus },
            currentOrder: createOrder({ paymentStatus: "paid", status: "pending" }),
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            paymentStatus,
            paymentFormatters,
            refundStatus,
            refundPaymentCallable,
            statusSelector: "#vendor-order-detail-status"
        });

        expect(result.success).toBe(false);
        expect(result.orderUpdated).toBe(true);
        expect(result.refundRequired).toBe(true);
        expect(result.error).toBe("Refund service failed.");
        expect(updateOrderStatus).toHaveBeenCalled();
        expect(refundPaymentCallable).toHaveBeenCalled();
        expect(dom.statusElement.textContent).toContain("Refund service failed.");
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
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();
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
            paymentStatus,
            paymentFormatters,
            orderId: "order-1",
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            paymentSelector: "#vendor-order-payment",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(result.success).toBe(true);
        expect(dom.summaryContainer.textContent).toContain("Student One");
        expect(dom.itemsContainer.textContent).toContain("Burger");
        expect(dom.timelineContainer.textContent).toContain("Order Received");
        expect(dom.actionContainer.textContent).toContain("Accept Order");
        expect(dom.statusElement.textContent).toContain("Student One");
        expect(dom.paymentContainer.textContent).toContain("Status: Paid");
        expect(dom.paymentContainer.textContent).toContain("Reference: paystack-ref");
    });

    test("init blocks accept and shows the payment gate banner when order payment is unpaid", async () => {
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();
        const result = await vendorOrderDetailPage.init({
            currentUser: { uid: "vendor-1", displayName: "Campus Bites" },
            authService: {
                getCurrentUserProfile: jest.fn(async () => createVendorProfile())
            },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: {
                getOrderById: jest.fn(async () => createOrder({ paymentStatus: "unpaid", paymentReference: "" }))
            },
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters,
            orderId: "order-1",
            statusSelector: "#vendor-order-detail-status",
            actionSelector: "#vendor-order-action-container",
            summarySelector: "#vendor-order-summary",
            itemsSelector: "#vendor-order-items",
            paymentSelector: "#vendor-order-payment",
            timelineSelector: "#vendor-order-timeline"
        });

        expect(result.success).toBe(true);
        expect(dom.actionContainer.querySelector(".vendor-order-payment-gate")).not.toBeNull();

        const acceptButton = Array.from(dom.actionContainer.querySelectorAll("button"))
            .find(button => button.dataset.nextStatus === "accepted");
        const rejectButton = Array.from(dom.actionContainer.querySelectorAll("button"))
            .find(button => button.dataset.nextStatus === "rejected");

        expect(acceptButton.disabled).toBe(true);
        expect(rejectButton.disabled).toBe(false);
        expect(dom.paymentContainer.textContent).toContain("Status: Unpaid");
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
