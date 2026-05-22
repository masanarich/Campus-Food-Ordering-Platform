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
        paymentStatus: "paid",
        paymentProvider: "paystack",
        paymentReference: "paystack-ref",
        paymentAmount: 120,
        paymentCurrency: "ZAR",
        updatedAt: "2026-04-20T12:00:00.000Z",
        ...overrides
    };
}

function createCheckout(overrides = {}) {
    return {
        checkoutId: "checkout-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        itemCount: 2,
        total: 120,
        status: "payment_pending",
        paymentReference: "checkout-ref",
        paymentAmount: 120,
        paymentCurrency: "ZAR",
        updatedAt: "2026-04-20T12:00:00.000Z",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <p id="order-tracking-status"></p>
        <p id="active-checkouts-summary"></p>
        <section id="active-checkouts-container"></section>
        <section id="tracked-orders-container"></section>
    `;

    return {
        statusElement: document.getElementById("order-tracking-status"),
        checkoutsSummary: document.getElementById("active-checkouts-summary"),
        checkoutsContainer: document.getElementById("active-checkouts-container"),
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

function createCheckoutStatusStub() {
    return {
        normalizeCheckoutStatus: jest.fn((status, fallbackStatus = "draft") => {
            const safeStatus = typeof status === "string" ? status.trim().toLowerCase() : "";
            return safeStatus || fallbackStatus;
        }),
        getCheckoutStatusLabel: jest.fn(status => {
            const labels = {
                draft: "Checkout Draft",
                payment_pending: "Payment Pending",
                payment_failed: "Payment Failed"
            };
            return labels[status] || "Unknown Checkout Status";
        }),
        getCheckoutStatusTone: jest.fn(status => {
            const tones = {
                draft: "neutral",
                payment_pending: "loading",
                payment_failed: "error"
            };
            return tones[status] || "neutral";
        }),
        getCheckoutStatusActionLabel: jest.fn(status => {
            const labels = {
                draft: "Start Payment",
                payment_pending: "Resume Payment",
                payment_failed: "Retry Payment"
            };
            return labels[status] || "Resume Payment";
        }),
        getResumableCheckoutStatusList: jest.fn(() => ["draft", "payment_pending", "payment_failed"])
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

    test("mapOrderRecord formats payment status, amount, and reference", () => {
        const orderStatus = createOrderStatusStub();
        const orderFormatters = createOrderFormattersStub();
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();

        const mapped = customerOrderTrackingPage.mapOrderRecord(createOrder(), {
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        expect(mapped.paymentStatus).toBe("paid");
        expect(mapped.paymentStatusLabel).toBe("Paid");
        expect(mapped.paymentTone).toBe("success");
        expect(mapped.paymentAmount).toBe(120);
        expect(mapped.paymentAmountText).toBe("R120.00");
        expect(mapped.paymentCurrency).toBe("ZAR");
        expect(mapped.paymentReference).toBe("paystack-ref");
        expect(mapped.paymentProvider).toBe("paystack");
    });

    test("mapOrderRecord falls back to unpaid defaults without payment helpers", () => {
        const mapped = customerOrderTrackingPage.mapOrderRecord({
            orderId: "order-9",
            total: 30
        });

        expect(mapped.paymentStatus).toBe("unpaid");
        expect(mapped.paymentTone).toBe("neutral");
        expect(mapped.paymentAmount).toBe(30);
        expect(mapped.paymentAmountText).toBe("R30.00");
        expect(mapped.paymentReference).toBe("");
        expect(mapped.paymentProvider).toBe("paystack");
    });

    test("mapCheckoutRecord formats unfinished checkout status and payment amount", () => {
        const checkoutStatus = createCheckoutStatusStub();
        const orderFormatters = createOrderFormattersStub();
        const paymentFormatters = createPaymentFormattersStub();

        const mapped = customerOrderTrackingPage.mapCheckoutRecord(createCheckout(), {
            checkoutStatus,
            orderFormatters,
            paymentFormatters
        });

        expect(mapped.checkoutId).toBe("checkout-1");
        expect(mapped.status).toBe("payment_pending");
        expect(mapped.statusLabel).toBe("Payment Pending");
        expect(mapped.tone).toBe("loading");
        expect(mapped.actionLabel).toBe("Resume Payment");
        expect(mapped.totalText).toBe("R120.00");
        expect(mapped.paymentAmountText).toBe("R120.00");
        expect(mapped.paymentReference).toBe("checkout-ref");
    });

    test("buildOrderDetailUrl includes the orderId query parameter", () => {
        const url = customerOrderTrackingPage.buildOrderDetailUrl("order-55");

        expect(url).toContain("order-detail.html");
        expect(url).toContain("orderId=order-55");
    });

    test("canReportIssueOnOrder returns true only for paid or completed orders", () => {
        expect(customerOrderTrackingPage.canReportIssueOnOrder({
            status: "preparing",
            paymentStatus: "paid"
        })).toBe(true);
        expect(customerOrderTrackingPage.canReportIssueOnOrder({
            status: "completed",
            paymentStatus: "paid"
        })).toBe(true);
        expect(customerOrderTrackingPage.canReportIssueOnOrder({
            status: "completed",
            paymentStatus: "unpaid"
        })).toBe(true);

        expect(customerOrderTrackingPage.canReportIssueOnOrder({
            status: "pending",
            paymentStatus: "unpaid"
        })).toBe(false);
        expect(customerOrderTrackingPage.canReportIssueOnOrder({
            status: "cancelled",
            paymentStatus: "failed"
        })).toBe(false);

        expect(customerOrderTrackingPage.canReportIssueOnOrder(null)).toBe(false);
        expect(customerOrderTrackingPage.canReportIssueOnOrder("not an object")).toBe(false);
    });

    test("buildReportIssueUrl points at the support new-ticket page with the orderId", () => {
        const url = customerOrderTrackingPage.buildReportIssueUrl("order-77");
        expect(url).toContain("../support/new.html".replace("../", ""));
        expect(url).toContain("orderId=order-77");

        const noOrderUrl = customerOrderTrackingPage.buildReportIssueUrl("");
        expect(noOrderUrl).toContain("support/new.html");
        expect(noOrderUrl).not.toContain("orderId=");
    });

    test("buildCheckoutUrl includes checkout and vendor details", () => {
        const url = customerOrderTrackingPage.buildCheckoutUrl(createCheckout({
            checkoutId: "checkout-55",
            vendorUid: "vendor-55",
            vendorName: "Campus Bites"
        }));

        expect(url).toContain("checkout.html");
        expect(url).toContain("checkoutId=checkout-55");
        expect(url).toContain("vendorUid=vendor-55");
        expect(url).toContain("vendorName=Campus+Bites");
    });

    test("resolvePaymentStatus and resolvePaymentFormatters prefer explicit then globals", () => {
        const paymentStatus = createPaymentStatusStub();
        const paymentFormatters = createPaymentFormattersStub();

        expect(customerOrderTrackingPage.resolvePaymentStatus(paymentStatus)).toBe(paymentStatus);
        expect(customerOrderTrackingPage.resolvePaymentFormatters(paymentFormatters)).toBe(paymentFormatters);
        expect(customerOrderTrackingPage.resolvePaymentStatus(null)).toBe(null);
        expect(customerOrderTrackingPage.resolvePaymentFormatters(null)).toBe(null);

        window.paymentStatus = paymentStatus;
        window.paymentFormatters = paymentFormatters;

        try {
            expect(customerOrderTrackingPage.resolvePaymentStatus()).toBe(paymentStatus);
            expect(customerOrderTrackingPage.resolvePaymentFormatters()).toBe(paymentFormatters);
        } finally {
            delete window.paymentStatus;
            delete window.paymentFormatters;
        }
    });

    test("resolveCheckout helpers prefer explicit then globals", () => {
        const checkoutStatus = createCheckoutStatusStub();
        const checkoutQueries = { fetchCustomerCheckouts: jest.fn() };

        expect(customerOrderTrackingPage.resolveCheckoutStatus(checkoutStatus)).toBe(checkoutStatus);
        expect(customerOrderTrackingPage.resolveCheckoutQueries(checkoutQueries)).toBe(checkoutQueries);
        expect(customerOrderTrackingPage.resolveCheckoutStatus(null)).toBe(null);
        expect(customerOrderTrackingPage.resolveCheckoutQueries(null)).toBe(null);

        window.checkoutStatus = checkoutStatus;
        window.checkoutQueries = checkoutQueries;

        try {
            expect(customerOrderTrackingPage.resolveCheckoutStatus()).toBe(checkoutStatus);
            expect(customerOrderTrackingPage.resolveCheckoutQueries()).toBe(checkoutQueries);
        } finally {
            delete window.checkoutStatus;
            delete window.checkoutQueries;
        }
    });
});

describe("customer/order-tracking/index.js - rendering", () => {
    let dom;
    let orderStatus;
    let orderFormatters;
    let paymentStatus;
    let paymentFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
        paymentStatus = createPaymentStatusStub();
        paymentFormatters = createPaymentFormattersStub();
    });

    test("renderOrders shows empty state when no orders exist", () => {
        customerOrderTrackingPage.renderOrders([], dom.container, {
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        expect(dom.container.textContent).toContain("do not have any orders");
    });

    test("renderOrders creates tracking cards with action links", () => {
        customerOrderTrackingPage.renderOrders([
            createOrder({ orderId: "order-1", vendorName: "Campus Bites" }),
            createOrder({ orderId: "order-2", vendorName: "Fresh Drinks", status: "ready" })
        ], dom.container, {
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        expect(dom.container.querySelectorAll(".tracking-order-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("Campus Bites");
        expect(dom.container.textContent).toContain("Ready for Pickup");
        expect(dom.container.querySelector('a[href*="orderId=order-2"]')).not.toBeNull();
    });

    test("renderOrders adds a Report an issue link only on paid or completed orders", () => {
        customerOrderTrackingPage.renderOrders([
            createOrder({
                orderId: "order-paid",
                vendorName: "Paid Vendor",
                status: "preparing",
                paymentStatus: "paid"
            }),
            createOrder({
                orderId: "order-done",
                vendorName: "Done Vendor",
                status: "completed",
                paymentStatus: "unpaid"
            }),
            createOrder({
                orderId: "order-unpaid",
                vendorName: "Unpaid Vendor",
                status: "pending",
                paymentStatus: "unpaid"
            }),
            createOrder({
                orderId: "order-cancelled",
                vendorName: "Cancelled Vendor",
                status: "cancelled",
                paymentStatus: "failed"
            })
        ], dom.container, {
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        const reportLinks = dom.container.querySelectorAll(".tracking-order-report-link");
        const reportedOrderIds = Array.from(reportLinks).map((link) => link.getAttribute("data-order-id"));
        expect(reportedOrderIds).toEqual(["order-paid", "order-done"]);

        const paidLink = dom.container.querySelector(
            '.tracking-order-report-link[data-order-id="order-paid"]'
        );
        expect(paidLink.getAttribute("href")).toContain("support/new.html");
        expect(paidLink.getAttribute("href")).toContain("orderId=order-paid");
        expect(paidLink.textContent).toBe("Report an issue");

        // Unpaid + cancelled orders do not get the link.
        expect(
            dom.container.querySelector('.tracking-order-report-link[data-order-id="order-unpaid"]')
        ).toBeNull();
        expect(
            dom.container.querySelector('.tracking-order-report-link[data-order-id="order-cancelled"]')
        ).toBeNull();
    });

    test("renderOrders shows payment status, amount, and reference for each order", () => {
        customerOrderTrackingPage.renderOrders([
            createOrder({
                orderId: "order-1",
                vendorName: "Campus Bites",
                paymentStatus: "paid",
                paymentReference: "paystack-ref-1",
                paymentAmount: 120
            }),
            createOrder({
                orderId: "order-2",
                vendorName: "Fresh Drinks",
                paymentStatus: "pending",
                paymentReference: "paystack-ref-2",
                paymentAmount: 50
            })
        ], dom.container, {
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        const cards = dom.container.querySelectorAll(".tracking-order-card");
        expect(cards).toHaveLength(2);

        const firstCard = cards[0];
        const firstPaymentStatus = firstCard.querySelector(".tracking-order-payment-status");
        expect(firstPaymentStatus.textContent).toBe("Payment: Paid");
        expect(firstPaymentStatus.getAttribute("data-tone")).toBe("success");
        expect(firstPaymentStatus.getAttribute("data-payment-status")).toBe("paid");
        expect(firstCard.querySelector(".tracking-order-payment-amount").textContent).toBe("Payment Amount: R120.00");
        expect(firstCard.querySelector(".tracking-order-payment-reference").textContent).toBe("Reference: paystack-ref-1");

        const secondPaymentStatus = cards[1].querySelector(".tracking-order-payment-status");
        expect(secondPaymentStatus.textContent).toBe("Payment: Payment Pending");
        expect(secondPaymentStatus.getAttribute("data-tone")).toBe("loading");
    });

    test("renderOrders omits the reference line when no payment reference exists", () => {
        customerOrderTrackingPage.renderOrders([
            createOrder({ paymentStatus: "unpaid", paymentReference: "" })
        ], dom.container, {
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters
        });

        const card = dom.container.querySelector(".tracking-order-card");
        expect(card.querySelector(".tracking-order-payment-status").textContent).toBe("Payment: Unpaid");
        expect(card.querySelector(".tracking-order-payment-reference")).toBeNull();
    });

    test("renderCheckouts creates unfinished checkout cards with resume links", () => {
        const checkoutStatus = createCheckoutStatusStub();

        customerOrderTrackingPage.renderCheckouts([
            createCheckout({
                checkoutId: "checkout-1",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites"
            })
        ], dom.checkoutsContainer, {
            checkoutStatus,
            orderFormatters,
            paymentFormatters
        });

        const card = dom.checkoutsContainer.querySelector(".tracking-checkout-card");
        const link = card.querySelector("a");

        expect(card.textContent).toContain("Checkout: Payment Pending");
        expect(card.textContent).toContain("This checkout has not become an order yet.");
        expect(link.textContent).toBe("Resume Payment");
        expect(link.getAttribute("href")).toContain("checkoutId=checkout-1");
        expect(link.getAttribute("href")).toContain("vendorUid=vendor-1");
    });

    test("renderCheckouts shows empty state when there are no active sessions", () => {
        customerOrderTrackingPage.renderCheckouts([], dom.checkoutsContainer);

        expect(dom.checkoutsContainer.textContent).toContain("unfinished checkout payments");
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
    let paymentStatus;
    let paymentFormatters;

    beforeEach(() => {
        dom = createDOM();
        orderStatus = createOrderStatusStub();
        orderFormatters = createOrderFormattersStub();
        paymentStatus = createPaymentStatusStub();
        paymentFormatters = createPaymentFormattersStub();
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

    test("fetchCustomerCheckouts uses checkout queries when available", async () => {
        const fetchCustomerCheckouts = jest.fn(async () => [
            createCheckout({ checkoutId: "checkout-1" })
        ]);
        const checkoutStatus = createCheckoutStatusStub();

        const result = await customerOrderTrackingPage.fetchCustomerCheckouts({
            db: { kind: "db" },
            firestoreFns: {},
            customerUid: "customer-1",
            checkoutQueries: { fetchCustomerCheckouts },
            checkoutStatus
        });

        expect(result.success).toBe(true);
        expect(result.checkouts).toHaveLength(1);
        expect(fetchCustomerCheckouts).toHaveBeenCalledWith(expect.objectContaining({
            customerUid: "customer-1",
            statuses: ["draft", "payment_pending", "payment_failed"],
            checkoutStatus
        }));
    });

    test("fetchCustomerCheckouts falls back to Firestore query", async () => {
        const firestoreFns = {
            collection: jest.fn(() => ({ kind: "collection" })),
            where: jest.fn((field, op, value) => ({ field, op, value })),
            query: jest.fn(() => ({ kind: "query" })),
            getDocs: jest.fn(async () => ({
                forEach(callback) {
                    callback({
                        id: "checkout-1",
                        data: () => createCheckout()
                    });
                    callback({
                        id: "checkout-converted",
                        data: () => createCheckout({
                            checkoutId: "checkout-converted",
                            status: "converted"
                        })
                    });
                }
            }))
        };

        const result = await customerOrderTrackingPage.fetchCustomerCheckouts({
            db: { kind: "db" },
            firestoreFns,
            customerUid: "customer-1",
            checkoutQueries: null
        });

        expect(result.success).toBe(true);
        expect(result.checkouts).toHaveLength(1);
        expect(result.checkouts[0].checkoutId).toBe("checkout-1");
        expect(firestoreFns.collection).toHaveBeenCalledWith({ kind: "db" }, "checkoutSessions");
        expect(firestoreFns.where).toHaveBeenCalledWith("customerUid", "==", "customer-1");
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

    test("init wires the filter form so changing status narrows the rendered cards", async () => {
        document.body.innerHTML = `
            <p id="order-tracking-status"></p>
            <form id="orders-filter-form">
                <input id="orders-search" name="search" type="search" />
                <select id="orders-status-filter" name="status">
                    <option value="all" selected>All</option>
                    <option value="ready">Ready</option>
                </select>
                <select id="orders-payment-filter" name="payment">
                    <option value="all" selected>All</option>
                </select>
                <select id="orders-sort" name="sort">
                    <option value="newest" selected>Newest</option>
                </select>
            </form>
            <p id="tracked-orders-summary"></p>
            <p id="active-checkouts-summary"></p>
            <section id="active-checkouts-container"></section>
            <section id="tracked-orders-container"></section>
            <nav id="tracked-orders-pagination" hidden>
                <p id="orders-pagination-status"></p>
                <menu>
                    <li><button type="button" data-page-action="prev">Prev</button></li>
                    <li><button type="button" data-page-action="next">Next</button></li>
                </menu>
            </nav>
        `;

        const container = document.getElementById("tracked-orders-container");
        const checkoutsContainer = document.getElementById("active-checkouts-container");
        const summary = document.getElementById("tracked-orders-summary");
        const statusSelect = document.getElementById("orders-status-filter");
        const form = document.getElementById("orders-filter-form");

        const getCustomerOrders = jest.fn(async () => [
            createOrder({ orderId: "order-1", vendorName: "Campus Bites", status: "preparing" }),
            createOrder({ orderId: "order-2", vendorName: "Fresh Drinks", status: "ready" }),
            createOrder({ orderId: "order-3", vendorName: "Sweet Treats", status: "ready" })
        ]);

        await customerOrderTrackingPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getCustomerOrders },
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters,
            checkoutStatus: createCheckoutStatusStub(),
            checkoutQueries: {
                fetchCustomerCheckouts: jest.fn(async () => [
                    createCheckout({ checkoutId: "checkout-1" })
                ])
            }
        });

        expect(container.querySelectorAll(".tracking-order-card")).toHaveLength(3);
        expect(checkoutsContainer.querySelectorAll(".tracking-checkout-card")).toHaveLength(1);
        expect(summary.textContent).toContain("all 3");

        statusSelect.value = "ready";
        form.dispatchEvent(new Event("change", { bubbles: true }));

        expect(container.querySelectorAll(".tracking-order-card")).toHaveLength(2);
        expect(summary.textContent).toContain("2 of 3");
    });

    test("init renders fetched orders for the current customer", async () => {
        const getCustomerOrders = jest.fn(async () => [
            createOrder({
                orderId: "order-1",
                vendorName: "Campus Bites",
                status: "preparing",
                paymentStatus: "paid",
                paymentReference: "paystack-ref-1"
            }),
            createOrder({
                orderId: "order-2",
                vendorName: "Fresh Drinks",
                status: "ready",
                paymentStatus: "pending",
                paymentReference: "paystack-ref-2"
            })
        ]);
        const fetchCustomerCheckouts = jest.fn(async () => [
            createCheckout({
                checkoutId: "checkout-1",
                vendorName: "Campus Bites",
                status: "payment_pending"
            })
        ]);

        const result = await customerOrderTrackingPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getCustomerOrders },
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters,
            checkoutStatus: createCheckoutStatusStub(),
            checkoutQueries: { fetchCustomerCheckouts },
            containerSelector: "#tracked-orders-container",
            statusSelector: "#order-tracking-status",
            checkoutsContainerSelector: "#active-checkouts-container",
            checkoutsSummarySelector: "#active-checkouts-summary"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(2);
        expect(result.checkouts).toHaveLength(1);
        expect(dom.container.querySelectorAll(".tracking-order-card")).toHaveLength(2);
        expect(dom.checkoutsContainer.querySelectorAll(".tracking-checkout-card")).toHaveLength(1);
        expect(dom.checkoutsSummary.textContent).toContain("1 unfinished checkout payment");
        expect(dom.statusElement.textContent).toContain("Tracking 2 orders and 1 unfinished checkout");
        expect(dom.container.textContent).toContain("Payment: Paid");
        expect(dom.container.textContent).toContain("Payment: Payment Pending");
        expect(dom.container.textContent).toContain("Reference: paystack-ref-1");
    });
});

describe("customer/order-tracking/index.js - filter, sort, paginate", () => {
    function makeOrder(overrides) {
        return {
            orderId: "order-x",
            vendorName: "Sample Vendor",
            status: "pending",
            paymentStatus: "unpaid",
            paymentReference: "",
            total: 100,
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

        const sorted = customerOrderTrackingPage.sortOrders(orders, "newest");

        expect(sorted.map(o => o.orderId)).toEqual(["b", "c", "a"]);
    });

    test("sortOrders supports oldest, price-desc, price-asc", () => {
        const orders = [
            makeOrder({ orderId: "a", total: 50, updatedAt: "2026-01-01T00:00:00Z" }),
            makeOrder({ orderId: "b", total: 200, updatedAt: "2026-05-01T00:00:00Z" }),
            makeOrder({ orderId: "c", total: 120, updatedAt: "2026-03-01T00:00:00Z" })
        ];

        expect(customerOrderTrackingPage.sortOrders(orders, "oldest").map(o => o.orderId))
            .toEqual(["a", "c", "b"]);
        expect(customerOrderTrackingPage.sortOrders(orders, "price-desc").map(o => o.orderId))
            .toEqual(["b", "c", "a"]);
        expect(customerOrderTrackingPage.sortOrders(orders, "price-asc").map(o => o.orderId))
            .toEqual(["a", "c", "b"]);
    });

    test("filterOrders narrows by status, payment, and search across vendor/order/reference", () => {
        const orders = [
            makeOrder({ orderId: "a", vendorName: "Campus Bites", status: "ready", paymentStatus: "paid", paymentReference: "ref-aaa" }),
            makeOrder({ orderId: "b", vendorName: "Fresh Drinks", status: "preparing", paymentStatus: "pending", paymentReference: "ref-bbb" }),
            makeOrder({ orderId: "c", vendorName: "Sweet Treats", status: "ready", paymentStatus: "paid", paymentReference: "ref-ccc" })
        ];

        expect(customerOrderTrackingPage.filterOrders(orders, { status: "ready" }).map(o => o.orderId))
            .toEqual(["a", "c"]);
        expect(customerOrderTrackingPage.filterOrders(orders, { payment: "pending" }).map(o => o.orderId))
            .toEqual(["b"]);
        expect(customerOrderTrackingPage.filterOrders(orders, { search: "fresh" }).map(o => o.orderId))
            .toEqual(["b"]);
        expect(customerOrderTrackingPage.filterOrders(orders, { search: "ref-ccc" }).map(o => o.orderId))
            .toEqual(["c"]);
        expect(customerOrderTrackingPage.filterOrders(orders, {
            status: "ready",
            payment: "paid",
            search: "campus"
        }).map(o => o.orderId)).toEqual(["a"]);
    });

    test("paginateOrders returns the correct slice and clamps the page index", () => {
        const orders = Array.from({ length: 15 }, (_, index) => makeOrder({ orderId: `order-${index + 1}` }));

        const page1 = customerOrderTrackingPage.paginateOrders(orders, 1, 6);
        expect(page1.pageOrders).toHaveLength(6);
        expect(page1.totalPages).toBe(3);
        expect(page1.page).toBe(1);

        const page3 = customerOrderTrackingPage.paginateOrders(orders, 3, 6);
        expect(page3.pageOrders).toHaveLength(3);
        expect(page3.pageOrders[0].orderId).toBe("order-13");

        const clamped = customerOrderTrackingPage.paginateOrders(orders, 99, 6);
        expect(clamped.page).toBe(3);

        const empty = customerOrderTrackingPage.paginateOrders([], 1, 6);
        expect(empty.totalPages).toBe(1);
        expect(empty.pageOrders).toHaveLength(0);
    });

    test("buildResultSummary distinguishes filtered vs unfiltered counts", () => {
        expect(customerOrderTrackingPage.buildResultSummary(0, 0)).toBe("");
        expect(customerOrderTrackingPage.buildResultSummary(5, 5)).toBe("Showing all 5 orders.");
        expect(customerOrderTrackingPage.buildResultSummary(2, 5)).toBe("Showing 2 of 5 orders.");
        expect(customerOrderTrackingPage.buildResultSummary(1, 1)).toBe("Showing all 1 order.");
    });
});

/**
 * @jest-environment jsdom
 */
describe("customer/order-tracking/index.js - rating helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("canRateOrder returns true only for completed orders", () => {
        expect(customerOrderTrackingPage.canRateOrder({ status: "completed" })).toBe(true);
        expect(customerOrderTrackingPage.canRateOrder({ status: "ready" })).toBe(false);
        expect(customerOrderTrackingPage.canRateOrder(null)).toBe(false);
    });

    test("getStarDisplay produces ★/☆ glyphs for any rating", () => {
        expect(customerOrderTrackingPage.getStarDisplay(0)).toBe("☆☆☆☆☆");
        expect(customerOrderTrackingPage.getStarDisplay(3)).toBe("★★★☆☆");
        expect(customerOrderTrackingPage.getStarDisplay(5)).toBe("★★★★★");
        // Out-of-range clamps to bounds rather than overflowing.
        expect(customerOrderTrackingPage.getStarDisplay(7)).toBe("★★★★★");
    });

    test("buildRatingButton attaches order id and the open-rate-modal data-action", () => {
        const btn = customerOrderTrackingPage.buildRatingButton({ orderId: "abc" });
        expect(btn.tagName).toBe("BUTTON");
        expect(btn.getAttribute("data-action")).toBe("open-rate-modal");
        expect(btn.getAttribute("data-order-id")).toBe("abc");
        expect(btn.textContent).toBe("Rate Order");
    });

    test("buildRatingModal returns the same dialog on repeated calls (idempotent)", () => {
        const first = customerOrderTrackingPage.buildRatingModal();
        const second = customerOrderTrackingPage.buildRatingModal();
        expect(first).toBe(second);
        expect(document.querySelectorAll("#rating-modal").length).toBe(1);
    });

    test("renderStarPicker draws 5 radio inputs and pre-selects the current value", () => {
        const host = document.createElement("section");
        document.body.appendChild(host);
        customerOrderTrackingPage.renderStarPicker(host, 3, "vendorRating");
        const inputs = host.querySelectorAll("input[type='radio']");
        expect(inputs.length).toBe(5);
        const checked = host.querySelector("input[type='radio']:checked");
        expect(checked.value).toBe("3");
    });

    test("renderStarPicker emits stars in 5→1 DOM order (paired with row-reverse layout)", () => {
        // Regression guard: the highlight logic relies on stars being in
        // descending DOM order so `:checked ~ sibling` lights up lower-value
        // stars. If a future refactor flips the loop back to 1→5, the UI
        // would visually invert (selecting 1 star would light up all 5).
        const host = document.createElement("section");
        document.body.appendChild(host);
        customerOrderTrackingPage.renderStarPicker(host, null, "vendorRating");

        const values = Array.from(host.querySelectorAll("input[type='radio']"))
            .map(function readValue(input) { return input.value; });
        expect(values).toEqual(["5", "4", "3", "2", "1"]);

        const labels = Array.from(host.querySelectorAll(".rating-star-button"))
            .map(function readAttr(label) { return label.getAttribute("data-rating-value"); });
        expect(labels).toEqual(["5", "4", "3", "2", "1"]);
    });

    test("fillRatingModal renders the order items in the per-item rating list", () => {
        const dialog = customerOrderTrackingPage.fillRatingModal({
            orderId: "abc-12345678",
            vendorName: "Burger Hut",
            items: [
                { menuItemId: "m1", name: "Burger" },
                { menuItemId: "m2", name: "Shake" }
            ]
        }, null);

        const rows = dialog.querySelectorAll(".rating-item-row");
        expect(rows.length).toBe(2);
        expect(rows[0].dataset.menuItemId).toBe("m1");
        expect(rows[1].dataset.menuItemName).toBe("Shake");
    });

    test("fillRatingModal pre-fills the form when editing an existing review", () => {
        const dialog = customerOrderTrackingPage.fillRatingModal({
            orderId: "abc-12345678",
            vendorName: "Burger Hut",
            items: [{ menuItemId: "m1", name: "Burger" }]
        }, {
            vendorRating: 4,
            vendorComment: "Tasty",
            isAnonymous: true,
            itemRatings: [{ menuItemId: "m1", rating: 5, comment: "Loved it" }]
        });

        expect(dialog.querySelector("#rating-vendor-comment").value).toBe("Tasty");
        expect(dialog.querySelector("#rating-anonymous").checked).toBe(true);
        expect(dialog.querySelector("#rating-modal-heading").textContent).toBe("Update your rating");
        expect(dialog.querySelector('input[name="vendorRating"]:checked').value).toBe("4");
    });

    test("readRatingFormValues reads the chosen vendor rating + per-item ratings + comments", () => {
        const order = {
            orderId: "abc",
            vendorName: "Burger Hut",
            items: [{ menuItemId: "m1", name: "Burger" }]
        };
        const dialog = customerOrderTrackingPage.fillRatingModal(order, null);
        // Manually select 5 stars and fill comment fields.
        dialog.querySelector('input[name="vendorRating"][value="5"]').checked = true;
        dialog.querySelector("#rating-vendor-comment").value = "Excellent";
        dialog.querySelector('input[name="itemRating-0"][value="4"]').checked = true;
        dialog.querySelector('input[name="itemComment-0"]').value = "Juicy";
        dialog.querySelector("#rating-anonymous").checked = true;

        const values = customerOrderTrackingPage.readRatingFormValues(dialog, order);
        expect(values).toEqual({
            vendorRating: 5,
            vendorComment: "Excellent",
            isAnonymous: true,
            itemRatings: [{
                menuItemId: "m1",
                name: "Burger",
                rating: 4,
                comment: "Juicy"
            }]
        });
    });
});

describe("customer/order-tracking/index.js - createOrderCard with existing review", () => {
    test("a completed order with an existing review shows the rating summary + Edit button", () => {
        const order = {
            orderId: "abc-12345678",
            vendorName: "Burger Hut",
            status: "completed",
            paymentStatus: "paid",
            total: 100,
            items: []
        };

        const card = customerOrderTrackingPage.createOrderCard(order, {
            existingReviews: {
                "abc-12345678": { vendorRating: 5, vendorComment: "Great" }
            }
        });

        expect(card.querySelector(".tracking-order-rating-summary")).not.toBeNull();
        const rateButton = card.querySelector('button[data-action="open-rate-modal"]');
        expect(rateButton).not.toBeNull();
        expect(rateButton.textContent).toBe("Edit your rating");
        expect(rateButton.getAttribute("data-has-review")).toBe("true");
    });

    test("a completed order without a review shows the Rate Order button only", () => {
        const order = {
            orderId: "abc-22222222",
            vendorName: "Burger Hut",
            status: "completed",
            paymentStatus: "paid",
            total: 100,
            items: []
        };

        const card = customerOrderTrackingPage.createOrderCard(order, {});
        expect(card.querySelector(".tracking-order-rating-summary")).toBeNull();
        const rateButton = card.querySelector('button[data-action="open-rate-modal"]');
        expect(rateButton).not.toBeNull();
        expect(rateButton.textContent).toBe("Rate Order");
    });

    test("non-completed orders do not get a Rate button", () => {
        const order = {
            orderId: "abc",
            vendorName: "Burger Hut",
            status: "ready",
            paymentStatus: "paid",
            total: 100,
            items: []
        };

        const card = customerOrderTrackingPage.createOrderCard(order, {});
        expect(card.querySelector('button[data-action="open-rate-modal"]')).toBeNull();
    });
});
