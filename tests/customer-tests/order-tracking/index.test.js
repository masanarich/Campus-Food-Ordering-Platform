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

    test("buildOrderDetailUrl includes the orderId query parameter", () => {
        const url = customerOrderTrackingPage.buildOrderDetailUrl("order-55");

        expect(url).toContain("order-detail.html");
        expect(url).toContain("orderId=order-55");
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
            paymentFormatters
        });

        expect(container.querySelectorAll(".tracking-order-card")).toHaveLength(3);
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

        const result = await customerOrderTrackingPage.init({
            currentUser: { uid: "customer-1" },
            db: { kind: "db" },
            firestoreFns: {},
            orderService: { getCustomerOrders },
            orderStatus,
            orderFormatters,
            paymentStatus,
            paymentFormatters,
            containerSelector: "#tracked-orders-container",
            statusSelector: "#order-tracking-status"
        });

        expect(result.success).toBe(true);
        expect(result.orders).toHaveLength(2);
        expect(dom.container.querySelectorAll(".tracking-order-card")).toHaveLength(2);
        expect(dom.statusElement.textContent).toContain("Tracking 2 orders");
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
