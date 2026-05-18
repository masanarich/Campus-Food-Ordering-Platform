/**
 * @jest-environment jsdom
 */

const customerOrderDetailPage = require("../../../public/customer/order-tracking/order-detail.js");

function createOrder(overrides = {}) {
    return {
        orderId: "order-1",
        checkoutId: "checkout-1",
        checkoutStatus: "converted",
        customerUid: "customer-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        itemCount: 2,
        total: 120,
        status: "preparing",
        paymentStatus: "paid",
        paymentProvider: "paystack",
        paymentReference: "paystack-ref",
        paymentAmount: 120,
        paymentCurrency: "ZAR",
        paymentPaidAt: "2026-04-20T12:05:00.000Z",
        paymentFailedAt: null,
        paymentFailureReason: "",
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
        <section id="order-detail-actions"></section>
        <section id="order-detail-summary"></section>
        <section id="order-detail-items"></section>
        <section id="order-detail-payment"></section>
        <section id="order-detail-timeline"></section>
    `;

    return {
        statusElement: document.getElementById("order-tracking-detail-status"),
        actionsContainer: document.getElementById("order-detail-actions"),
        summaryContainer: document.getElementById("order-detail-summary"),
        itemsContainer: document.getElementById("order-detail-items"),
        paymentContainer: document.getElementById("order-detail-payment"),
        timelineContainer: document.getElementById("order-detail-timeline")
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
        getPaymentStatusActionLabel: jest.fn(status => {
            const labels = {
                unpaid: "Start Payment",
                pending: "Verify Payment",
                paid: "View Payment",
                failed: "Retry Payment"
            };
            return labels[status] || "Review Payment";
        })
    };
}

function createCheckoutStatusStub() {
    return {
        normalizeCheckoutStatus: jest.fn((status, fallbackStatus = "") => {
            const safeStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
            return safeStatus || fallbackStatus;
        }),
        getCheckoutStatusLabel: jest.fn(status => {
            const labels = {
                converted: "Order Created",
                payment_pending: "Payment Pending",
                payment_failed: "Payment Failed"
            };
            return labels[status] || "Unknown Checkout Status";
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
        dom.actionsContainer.innerHTML = "<button>stale</button>";

        customerOrderDetailPage.renderEmptyState({
            summary: dom.summaryContainer,
            items: dom.itemsContainer,
            timeline: dom.timelineContainer,
            payment: dom.paymentContainer,
            actions: dom.actionsContainer
        });

        expect(dom.summaryContainer.textContent).toContain("No order summary available");
        expect(dom.itemsContainer.textContent).toContain("No items available");
        expect(dom.timelineContainer.textContent).toContain("No timeline available");
        expect(dom.paymentContainer.textContent).toContain("No payment details available");
        expect(dom.actionsContainer.innerHTML).toBe("");
    });
});

describe("customer/order-tracking/order-detail.js - payment rendering", () => {
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

    test("buildPaymentView returns a paid summary with retry disabled", () => {
        const view = customerOrderDetailPage.buildPaymentView(createOrder(), {
            paymentStatus,
            paymentFormatters,
            orderFormatters,
            checkoutStatus: createCheckoutStatusStub()
        });

        expect(view.status).toBe("paid");
        expect(view.statusLabel).toBe("Paid");
        expect(view.tone).toBe("success");
        expect(view.amountText).toBe("R120.00");
        expect(view.providerLabel).toBe("Paystack");
        expect(view.reference).toBe("paystack-ref");
        expect(view.checkoutId).toBe("checkout-1");
        expect(view.checkoutStatusLabel).toBe("Order Created");
        expect(view.canRetry).toBe(false);
        expect(view.retryUrl).toBe("");
    });

    test("buildPaymentView returns a retry URL with vendor query for failed payments", () => {
        const view = customerOrderDetailPage.buildPaymentView(
            createOrder({
                paymentStatus: "failed",
                paymentFailureReason: "Card was declined.",
                paymentFailedAt: "2026-04-20T12:06:00.000Z"
            }),
            { paymentStatus, paymentFormatters, orderFormatters }
        );

        expect(view.status).toBe("failed");
        expect(view.canRetry).toBe(true);
        expect(view.actionLabel).toBe("Retry Payment");
        expect(view.retryUrl).toContain("../order-management/checkout.html?checkoutId=checkout-1");
        expect(view.retryUrl).toContain("vendorUid=vendor-1");
        expect(view.retryUrl).toContain("vendorName=Campus+Bites");
        expect(view.failureReason).toBe("Card was declined.");
    });

    test("buildPaymentView lets pending payments resume the same checkout", () => {
        const view = customerOrderDetailPage.buildPaymentView(
            createOrder({ paymentStatus: "pending", paymentReference: "pending-ref" }),
            { paymentStatus, paymentFormatters, orderFormatters }
        );

        expect(view.status).toBe("pending");
        expect(view.canRetry).toBe(true);
        expect(view.actionLabel).toBe("Resume Payment");
        expect(view.retryUrl).toContain("checkoutId=checkout-1");
        expect(view.guardMessage).toContain("Complete payment");
    });

    test("buildPaymentView falls back to order.total when paymentAmount is missing", () => {
        const view = customerOrderDetailPage.buildPaymentView(
            createOrder({ paymentStatus: "unpaid", paymentAmount: undefined, paymentReference: "" }),
            { paymentStatus, paymentFormatters }
        );

        expect(view.status).toBe("unpaid");
        expect(view.amount).toBe(120);
        expect(view.amountText).toBe("R120.00");
        expect(view.canRetry).toBe(true);
    });

    test("renderOrderPayment writes status, amount, reference, and retry link for failed payments", () => {
        customerOrderDetailPage.renderOrderPayment(
            createOrder({
                paymentStatus: "failed",
                paymentFailureReason: "Card was declined.",
                paymentFailedAt: "2026-04-20T12:06:00.000Z"
            }),
            dom.paymentContainer,
            {
                paymentStatus,
                paymentFormatters,
                orderFormatters
            }
        );

        const statusLine = dom.paymentContainer.querySelector(".order-detail-payment-status");
        expect(statusLine.textContent).toBe("Status: Payment Failed");
        expect(statusLine.getAttribute("data-tone")).toBe("error");
        expect(statusLine.getAttribute("data-payment-status")).toBe("failed");

        expect(dom.paymentContainer.querySelector(".order-detail-payment-amount").textContent).toBe("Amount: R120.00");
        expect(dom.paymentContainer.querySelector(".order-detail-payment-provider").textContent).toBe("Provider: Paystack");
        expect(dom.paymentContainer.querySelector(".order-detail-payment-reference").textContent).toBe("Reference: paystack-ref");
        expect(dom.paymentContainer.querySelector(".order-detail-payment-checkout-id").textContent).toBe("Checkout ID: checkout-1");
        expect(dom.paymentContainer.querySelector(".order-detail-payment-failure-reason").textContent).toContain("Card was declined.");
        expect(dom.paymentContainer.querySelector(".order-detail-payment-guard").textContent).toContain("Complete payment");

        const retryLink = dom.paymentContainer.querySelector(".order-detail-payment-actions a");
        expect(retryLink).not.toBeNull();
        expect(retryLink.textContent).toBe("Retry Payment");
        expect(retryLink.getAttribute("href")).toContain("vendorUid=vendor-1");
    });

    test("renderOrderPayment does not show retry link for paid orders", () => {
        customerOrderDetailPage.renderOrderPayment(createOrder(), dom.paymentContainer, {
            paymentStatus,
            paymentFormatters,
            orderFormatters
        });

        expect(dom.paymentContainer.querySelector(".order-detail-payment-actions")).toBeNull();
        expect(dom.paymentContainer.querySelector(".order-detail-payment-status").textContent).toBe("Status: Paid");
    });

    test("renderOrderPayment shows a Pay Now link for unpaid orders", () => {
        customerOrderDetailPage.renderOrderPayment(
            createOrder({ paymentStatus: "unpaid", paymentReference: "" }),
            dom.paymentContainer,
            { paymentStatus, paymentFormatters, orderFormatters }
        );

        const link = dom.paymentContainer.querySelector(".order-detail-payment-actions a");
        expect(link).not.toBeNull();
        expect(link.textContent).toBe("Pay Now");
        expect(link.getAttribute("href")).toContain("checkoutId=checkout-1");
        expect(dom.paymentContainer.querySelector(".order-detail-payment-reference")).toBeNull();
    });

    test("renderOrderPayment shows an empty state when the order is missing", () => {
        customerOrderDetailPage.renderOrderPayment(null, dom.paymentContainer, {
            paymentStatus,
            paymentFormatters
        });

        expect(dom.paymentContainer.textContent).toContain("Payment details are unavailable");
    });

    test("buildRetryPaymentUrl falls back to the checkout route when vendorUid is missing", () => {
        expect(customerOrderDetailPage.buildRetryPaymentUrl({})).toBe("../order-management/checkout.html");
    });

    test("buildRetryPaymentUrl can target checkoutId without vendor details", () => {
        expect(customerOrderDetailPage.buildRetryPaymentUrl({ checkoutId: "checkout-solo" }))
            .toBe("../order-management/checkout.html?checkoutId=checkout-solo");
    });
});

describe("customer/order-tracking/order-detail.js - collection action", () => {
    let dom;

    beforeEach(() => {
        dom = createDOM();
    });

    test("getCustomerCollectionAction returns an action when ready and not yet confirmed", () => {
        const action = customerOrderDetailPage.getCustomerCollectionAction(
            createOrder({ status: "ready", customerConfirmedCollected: false })
        );

        expect(action).not.toBeNull();
        expect(action.type).toBe("confirm_collection");
    });

    test("getCustomerCollectionAction returns null when customer already confirmed", () => {
        const action = customerOrderDetailPage.getCustomerCollectionAction(
            createOrder({ status: "ready", customerConfirmedCollected: true })
        );

        expect(action).toBeNull();
    });

    test("getCustomerCollectionAction returns null for non-ready statuses", () => {
        expect(customerOrderDetailPage.getCustomerCollectionAction(
            createOrder({ status: "preparing" })
        )).toBeNull();
        expect(customerOrderDetailPage.getCustomerCollectionAction(
            createOrder({ status: "completed" })
        )).toBeNull();
    });

    test("getCustomerCollectionAction returns null when ready order is not paid", () => {
        const action = customerOrderDetailPage.getCustomerCollectionAction(
            createOrder({
                status: "ready",
                paymentStatus: "pending",
                customerConfirmedCollected: false
            }),
            { paymentStatus: createPaymentStatusStub() }
        );

        expect(action).toBeNull();
    });

    test("renderActionButtons shows the confirm button when ready", () => {
        customerOrderDetailPage.renderActionButtons(
            createOrder({ status: "ready", customerConfirmedCollected: false }),
            dom.actionsContainer
        );

        const button = dom.actionsContainer.querySelector("button[data-action-type='confirm_collection']");
        expect(button).not.toBeNull();
        expect(button.textContent).toContain("Confirm");
    });

    test("renderActionButtons shows a waiting message after the customer confirmed", () => {
        customerOrderDetailPage.renderActionButtons(
            createOrder({
                status: "ready",
                customerConfirmedCollected: true,
                vendorConfirmedCollected: false
            }),
            dom.actionsContainer
        );

        expect(dom.actionsContainer.querySelector("button")).toBeNull();
        expect(dom.actionsContainer.textContent).toContain("Waiting for the vendor");
    });

    test("renderActionButtons hides the button for completed orders", () => {
        customerOrderDetailPage.renderActionButtons(
            createOrder({ status: "completed" }),
            dom.actionsContainer
        );

        expect(dom.actionsContainer.querySelector("button")).toBeNull();
    });

    test("renderActionButtons explains why unpaid orders have no actions", () => {
        customerOrderDetailPage.renderActionButtons(
            createOrder({ status: "ready", paymentStatus: "failed" }),
            dom.actionsContainer,
            { paymentStatus: createPaymentStatusStub() }
        );

        expect(dom.actionsContainer.querySelector("button")).toBeNull();
        expect(dom.actionsContainer.textContent).toContain("Complete payment");
    });

    test("handleConfirmCollection calls orderService.confirmOrderCollection as customer", async () => {
        const confirmOrderCollection = jest.fn(async () => ({
            success: true,
            order: createOrder({ status: "ready", customerConfirmedCollected: true })
        }));
        const order = createOrder({ status: "ready", customerConfirmedCollected: false });

        const result = await customerOrderDetailPage.handleConfirmCollection(
            { type: "confirm_collection" },
            {
                orderService: { confirmOrderCollection },
                currentOrder: order,
                currentUser: { uid: "customer-1", displayName: "Sam" },
                db: { kind: "db" },
                firestoreFns: {}
            }
        );

        expect(result.success).toBe(true);
        expect(confirmOrderCollection).toHaveBeenCalledWith(expect.objectContaining({
            order,
            actorRole: "customer",
            actorUid: "customer-1",
            actorName: "Sam"
        }));
    });

    test("handleConfirmCollection surfaces service errors", async () => {
        const confirmOrderCollection = jest.fn(async () => ({
            success: false,
            error: { message: "Cannot confirm yet." }
        }));

        const result = await customerOrderDetailPage.handleConfirmCollection(
            { type: "confirm_collection" },
            {
                orderService: { confirmOrderCollection },
                currentOrder: createOrder({ status: "ready" }),
                currentUser: { uid: "customer-1" }
            }
        );

        expect(result.success).toBe(false);
        expect(dom.statusElement.textContent).toContain("Cannot confirm yet.");
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

    test("init renders the order even when the customerUid does not match the viewer", async () => {
        // Firestore rules already gate read access (customer/vendor/admin only).
        // The page should render whatever the rules let through and let the
        // action helpers decide which buttons to show.
        const getOrderById = jest.fn(async () => createOrder({
            customerUid: "another-customer",
            status: "ready"
        }));

        const result = await customerOrderDetailPage.init({
            currentUser: { uid: "vendor-7" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById },
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#order-tracking-detail-status",
            actionSelector: "#order-detail-actions",
            summarySelector: "#order-detail-summary",
            itemsSelector: "#order-detail-items",
            timelineSelector: "#order-detail-timeline"
        });

        expect(result.success).toBe(true);
        expect(dom.summaryContainer.textContent).toContain("Campus Bites");
        // No confirm button because the viewer isn't the customer.
        expect(dom.actionsContainer.querySelector("button[data-action-type='confirm_collection']")).toBeNull();
    });

    test("getCustomerCollectionAction hides the confirm button for non-customer viewers", () => {
        const action = customerOrderDetailPage.getCustomerCollectionAction(
            createOrder({ status: "ready", customerUid: "customer-1", customerConfirmedCollected: false }),
            { currentUser: { uid: "vendor-7" } }
        );

        expect(action).toBeNull();
    });

    test("init renders the requested order for the signed-in customer", async () => {
        const getOrderById = jest.fn(async () => createOrder());
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();

        const result = await customerOrderDetailPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById },
            orderFormatters,
            paymentStatus,
            paymentFormatters,
            orderId: "order-1",
            statusSelector: "#order-tracking-detail-status",
            summarySelector: "#order-detail-summary",
            itemsSelector: "#order-detail-items",
            paymentSelector: "#order-detail-payment",
            timelineSelector: "#order-detail-timeline"
        });

        expect(result.success).toBe(true);
        expect(dom.summaryContainer.textContent).toContain("Campus Bites");
        expect(dom.itemsContainer.textContent).toContain("Burger");
        expect(dom.timelineContainer.textContent).toContain("Order Received");
        expect(dom.statusElement.textContent).toContain("Campus Bites");
        expect(dom.paymentContainer.textContent).toContain("Status: Paid");
        expect(dom.paymentContainer.textContent).toContain("Reference: paystack-ref");
    });

    test("init renders the confirm collection button when the order is ready", async () => {
        const getOrderById = jest.fn(async () => createOrder({
            status: "ready",
            customerConfirmedCollected: false
        }));

        const result = await customerOrderDetailPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getOrderById, confirmOrderCollection: jest.fn() },
            orderFormatters,
            orderId: "order-1",
            statusSelector: "#order-tracking-detail-status",
            actionSelector: "#order-detail-actions",
            summarySelector: "#order-detail-summary",
            itemsSelector: "#order-detail-items",
            timelineSelector: "#order-detail-timeline"
        });

        expect(result.success).toBe(true);
        const button = dom.actionsContainer.querySelector("button[data-action-type='confirm_collection']");
        expect(button).not.toBeNull();
    });
});
