/**
 * @jest-environment jsdom
 */

const paymentCallback = require("../../../public/customer/order-management/payment-callback.js");

function createDOM() {
    document.body.innerHTML = `
        <p id="payment-callback-status"></p>
        <output id="payment-callback-summary"></output>
        <menu id="payment-callback-actions"></menu>
        <section id="payment-callback-back-host"></section>
    `;

    return {
        statusElement: document.getElementById("payment-callback-status"),
        summaryElement: document.getElementById("payment-callback-summary"),
        actionsElement: document.getElementById("payment-callback-actions"),
        backButtonHost: document.getElementById("payment-callback-back-host")
    };
}

function resetGlobals() {
    delete window.db;
    delete window.auth;
    delete window.authFns;
    delete window.firestoreFns;
    delete window.functions;
    delete window.functionsFns;
    delete window.paymentFormatters;
    delete window.paymentStatus;
    delete window.checkoutStatus;
    delete window.checkoutModel;
    delete window.checkoutValidation;
    delete window.checkoutQueries;
    delete window.checkoutService;
    delete window.orderService;
    delete global.db;
    delete global.auth;
    delete global.functions;
    delete global.functionsFns;
    delete global.firestoreFns;
    delete global.checkoutStatus;
    delete global.checkoutModel;
    delete global.checkoutValidation;
    delete global.checkoutQueries;
    delete global.checkoutService;
    delete global.orderService;
}

function createOrderRecord(overrides = {}) {
    return {
        orderId: "order-1",
        customerUid: "customer-1",
        customerEmail: "ama@example.com",
        customerName: "Ama",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        paymentProvider: "paystack",
        paymentReference: "paystack-ref",
        paymentAccessCode: "access-code",
        paymentAuthorizationUrl: "https://checkout.paystack.com/test",
        paymentAmount: 42.5,
        paymentAmountInMinorUnits: 4250,
        paymentCurrency: "ZAR",
        paymentStatus: "pending",
        total: 42.5,
        ...overrides
    };
}

function createCheckoutRecord(overrides = {}) {
    return {
        checkoutId: "checkout-1",
        customerUid: "customer-1",
        customerEmail: "ama@example.com",
        customerName: "Ama",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        items: [
            {
                menuItemId: "item-1",
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                name: "Burger",
                category: "Meals",
                price: 42.5,
                quantity: 1
            }
        ],
        itemCount: 1,
        subtotal: 42.5,
        total: 42.5,
        status: "payment_pending",
        paymentProvider: "paystack",
        paymentReference: "paystack-ref",
        paymentAccessCode: "access-code",
        paymentAuthorizationUrl: "https://checkout.paystack.com/test",
        paymentAmount: 42.5,
        paymentAmountInMinorUnits: 4250,
        paymentCurrency: "ZAR",
        notes: "No onions",
        ...overrides
    };
}

function createFirestoreFns(overrides = {}) {
    return {
        collection: jest.fn((db, name) => ({ db, name })),
        doc: jest.fn((db, name, id) => ({ db, name, id })),
        query: jest.fn(function buildQuery() {
            return { args: Array.from(arguments) };
        }),
        where: jest.fn((field, op, value) => ({ field, op, value })),
        limit: jest.fn((count) => ({ limit: count })),
        getDocs: jest.fn(async () => ({
            forEach: function forEach(callback) {
                callback({
                    id: "order-1",
                    data: function getData() {
                        return createOrderRecord();
                    }
                });
            }
        })),
        updateDoc: jest.fn(async () => true),
        ...overrides
    };
}

describe("customer/order-management/payment-callback.js - helpers", () => {
    beforeEach(() => {
        resetGlobals();
    });

    test("normalizeText, normalizeUpperText and normalizeNumber behave safely", () => {
        expect(paymentCallback.normalizeText("  hi  ")).toBe("hi");
        expect(paymentCallback.normalizeText(null)).toBe("");
        expect(paymentCallback.normalizeUpperText(" zar ")).toBe("ZAR");
        expect(paymentCallback.normalizeNumber("4.5")).toBe(4.5);
        expect(paymentCallback.normalizeNumber("not-a-number")).toBe(null);
    });

    test("getFallbackRoutes exposes expected routes", () => {
        const routes = paymentCallback.getFallbackRoutes();

        expect(routes.home).toBe("../index.html");
        expect(routes.cart).toBe("./cart.html");
        expect(routes.checkout).toBe("./checkout.html");
        expect(routes.orders).toBe("../order-tracking/index.html");
        expect(routes.browseVendors).toBe("./browse-vendors.html");
    });

    test("getPaymentReference reads explicit option then query string variants", () => {
        expect(paymentCallback.getPaymentReference({ reference: "explicit-ref" })).toBe("explicit-ref");
        expect(paymentCallback.getPaymentReference({ search: "?reference=ref-1" })).toBe("ref-1");
        expect(paymentCallback.getPaymentReference({ search: "?trxref=ref-2" })).toBe("ref-2");
        expect(paymentCallback.getPaymentReference({ search: "" })).toBe("");
    });

    test("getCheckoutId reads explicit option then callback query string", () => {
        expect(paymentCallback.getCheckoutId({ checkoutId: "checkout-explicit" })).toBe("checkout-explicit");
        expect(paymentCallback.getCheckoutId({ sessionId: "session-explicit" })).toBe("session-explicit");
        expect(paymentCallback.getCheckoutId({ search: "?checkoutId=checkout-1" })).toBe("checkout-1");
        expect(paymentCallback.getCheckoutId({ search: "?sessionId=session-1" })).toBe("session-1");
        expect(paymentCallback.getCheckoutId({ search: "" })).toBe("");
    });

    test("resolveFirestore and friends fall back to globals", () => {
        window.db = { kind: "db" };
        window.auth = { kind: "auth" };
        window.functions = { kind: "functions" };
        window.firestoreFns = { collection: jest.fn() };
        window.functionsFns = { httpsCallable: jest.fn() };
        window.authFns = { onAuthStateChanged: jest.fn() };
        window.paymentFormatters = { formatPaymentAmount: jest.fn(() => "R0.00") };
        window.paymentStatus = { getPaymentStatusLabel: jest.fn(() => "Paid") };
        window.checkoutStatus = { normalizeCheckoutStatus: jest.fn(value => value) };
        window.checkoutModel = { createOrderDraftFromCheckout: jest.fn() };
        window.checkoutValidation = { validateCheckoutConversion: jest.fn() };
        window.checkoutQueries = { fetchCheckoutById: jest.fn() };
        window.checkoutService = { convertCheckoutToOrder: jest.fn() };
        window.orderService = { createOrders: jest.fn() };

        expect(paymentCallback.resolveFirestore()).toBe(window.db);
        expect(paymentCallback.resolveAuth()).toBe(window.auth);
        expect(paymentCallback.resolveAuthFns()).toBe(window.authFns);
        expect(paymentCallback.resolveFirestoreFns()).toBe(window.firestoreFns);
        expect(paymentCallback.resolveFunctions()).toBe(window.functions);
        expect(paymentCallback.resolveFunctionsFns()).toBe(window.functionsFns);
        expect(paymentCallback.resolvePaymentFormatters()).toBe(window.paymentFormatters);
        expect(paymentCallback.resolvePaymentStatus()).toBe(window.paymentStatus);
        expect(paymentCallback.resolveCheckoutStatus()).toBe(window.checkoutStatus);
        expect(paymentCallback.resolveCheckoutModel()).toBe(window.checkoutModel);
        expect(paymentCallback.resolveCheckoutValidation()).toBe(window.checkoutValidation);
        expect(paymentCallback.resolveCheckoutQueries()).toBe(window.checkoutQueries);
        expect(paymentCallback.resolveCheckoutService()).toBe(window.checkoutService);
        expect(paymentCallback.resolveOrderService()).toBe(window.orderService);
    });

    test("formatAmount uses payment formatters when available", () => {
        const paymentFormatters = {
            formatPaymentAmount: jest.fn(() => "FORMATTED")
        };

        expect(paymentCallback.formatAmount(10, "ZAR", { paymentFormatters })).toBe("FORMATTED");
        expect(paymentFormatters.formatPaymentAmount).toHaveBeenCalledWith(10, "ZAR");
    });

    test("formatAmount falls back to manual formatting for ZAR and unknown currencies", () => {
        expect(paymentCallback.formatAmount(42.5, "ZAR", { paymentFormatters: null })).toBe("R42.50");
        expect(paymentCallback.formatAmount(10, "USD", { paymentFormatters: null })).toBe("USD 10.00");
        expect(paymentCallback.formatAmount("bad", "ZAR", { paymentFormatters: null })).toBe("R0.00");
    });

    test("getPaymentStatusLabel uses paymentStatus helper or fallback labels", () => {
        const paymentStatus = {
            getPaymentStatusLabel: jest.fn(() => "Custom Label")
        };

        expect(paymentCallback.getPaymentStatusLabel("paid", { paymentStatus })).toBe("Custom Label");
        expect(paymentCallback.getPaymentStatusLabel("paid", { paymentStatus: null })).toBe("Paid");
        expect(paymentCallback.getPaymentStatusLabel("pending", { paymentStatus: null })).toBe("Payment Pending");
        expect(paymentCallback.getPaymentStatusLabel("failed", { paymentStatus: null })).toBe("Payment Failed");
        expect(paymentCallback.getPaymentStatusLabel("unpaid", { paymentStatus: null })).toBe("Unpaid");
        expect(paymentCallback.getPaymentStatusLabel("weird", { paymentStatus: null })).toBe("Unknown Payment Status");
    });

    test("setStatusMessage writes text and data-state", () => {
        const dom = createDOM();

        paymentCallback.setStatusMessage(dom.statusElement, "Hello", "loading");

        expect(dom.statusElement.textContent).toBe("Hello");
        expect(dom.statusElement.getAttribute("data-state")).toBe("loading");
    });

    test("createBackButton uses browser history when available", () => {
        const backSpy = jest.spyOn(window.history, "back").mockImplementation(() => {});

        Object.defineProperty(window.history, "length", {
            configurable: true,
            value: 2
        });

        const button = paymentCallback.createBackButton({ label: "Go back" });
        button.click();

        expect(button.textContent).toBe("Go back");
        expect(backSpy).toHaveBeenCalledTimes(1);

        backSpy.mockRestore();
    });

    test("normalizeCallableResult unwraps callable data envelope", () => {
        expect(paymentCallback.normalizeCallableResult({ data: { success: true } })).toEqual({ success: true });
        expect(paymentCallback.normalizeCallableResult({ success: true })).toEqual({ success: true });
        expect(paymentCallback.normalizeCallableResult(null)).toBe(null);
    });

    test("resolveVerifyPaymentCallable prefers explicit callable, then paymentFunctions, then httpsCallable", () => {
        const callable = jest.fn();
        const httpsCallable = jest.fn(() => callable);
        const functions = { kind: "functions" };

        expect(
            paymentCallback.resolveVerifyPaymentCallable({ verifyPaymentCallable: callable })
        ).toBe(callable);
        expect(
            paymentCallback.resolveVerifyPaymentCallable({
                paymentFunctions: { verifyPayment: callable }
            })
        ).toBe(callable);
        expect(
            paymentCallback.resolveVerifyPaymentCallable({
                functions,
                functionsFns: { httpsCallable }
            })
        ).toBe(callable);
        expect(httpsCallable).toHaveBeenCalledWith(functions, "verifyPayment");
        expect(paymentCallback.resolveVerifyPaymentCallable({})).toBe(null);
    });

    test("resolveConvertCheckoutToOrderCallable prefers explicit callable, then paymentFunctions, then httpsCallable", () => {
        const callable = jest.fn();
        const httpsCallable = jest.fn(() => callable);
        const functions = { kind: "functions" };

        expect(
            paymentCallback.resolveConvertCheckoutToOrderCallable({ convertCheckoutToOrderCallable: callable })
        ).toBe(callable);
        expect(
            paymentCallback.resolveConvertCheckoutToOrderCallable({
                paymentFunctions: { convertCheckoutToOrder: callable }
            })
        ).toBe(callable);
        expect(
            paymentCallback.resolveConvertCheckoutToOrderCallable({
                functions,
                functionsFns: { httpsCallable }
            })
        ).toBe(callable);
        expect(httpsCallable).toHaveBeenCalledWith(functions, "convertCheckoutToOrder");
        expect(paymentCallback.resolveConvertCheckoutToOrderCallable({})).toBe(null);
    });

    test("buildPaymentSliceFromOrder maps order payment fields", () => {
        const slice = paymentCallback.buildPaymentSliceFromOrder(createOrderRecord(), "paystack-ref");

        expect(slice).toEqual(expect.objectContaining({
            orderId: "order-1",
            customerEmail: "ama@example.com",
            vendorUid: "vendor-1",
            reference: "paystack-ref",
            paymentReference: "paystack-ref",
            amount: 42.5,
            amountInMinorUnits: 4250,
            currency: "ZAR",
            provider: "paystack",
            status: "pending"
        }));
    });

    test("buildPaymentSliceFromOrder fills minor units from total when missing", () => {
        const slice = paymentCallback.buildPaymentSliceFromOrder({
            orderId: "order-2",
            total: 30
        }, "ref-2");

        expect(slice.amount).toBe(30);
        expect(slice.amountInMinorUnits).toBe(3000);
        expect(slice.currency).toBe("ZAR");
    });

    test("buildPaymentSliceFromCheckout maps checkout payment fields", () => {
        const slice = paymentCallback.buildPaymentSliceFromCheckout(createCheckoutRecord(), "paystack-ref");

        expect(slice).toEqual(expect.objectContaining({
            orderId: "checkout-1",
            checkoutId: "checkout-1",
            customerEmail: "ama@example.com",
            vendorUid: "vendor-1",
            reference: "paystack-ref",
            amount: 42.5,
            amountInMinorUnits: 4250,
            currency: "ZAR",
            provider: "paystack",
            status: "payment_pending",
            metadata: expect.objectContaining({
                checkoutId: "checkout-1",
                source: "checkout-session"
            })
        }));
    });

    test("supportsOrderQuery and supportsOrderUpdate detect required helpers", () => {
        expect(paymentCallback.supportsOrderQuery({})).toBe(false);
        expect(paymentCallback.supportsOrderQuery({
            collection: jest.fn(),
            query: jest.fn(),
            where: jest.fn(),
            getDocs: jest.fn()
        })).toBe(true);
        expect(paymentCallback.supportsOrderUpdate({})).toBe(false);
        expect(paymentCallback.supportsOrderUpdate({
            doc: jest.fn(),
            updateDoc: jest.fn()
        })).toBe(true);
    });
});

describe("customer/order-management/payment-callback.js - rendering", () => {
    let dom;

    beforeEach(() => {
        resetGlobals();
        dom = createDOM();
    });

    test("renderPaymentSummary writes a labeled card with details", () => {
        paymentCallback.renderPaymentSummary(dom.summaryElement, {
            tone: "success",
            heading: "Payment Confirmed",
            statusLabel: "Paid",
            reference: "paystack-ref",
            orderId: "order-1",
            vendorName: "Campus Bites",
            amountLabel: "R42.50",
            message: "Your payment was successful."
        });

        const card = dom.summaryElement.querySelector(".payment-callback-summary-card");

        expect(card).not.toBeNull();
        expect(card.getAttribute("data-tone")).toBe("success");
        expect(card.textContent).toContain("Payment Confirmed");
        expect(card.textContent).toContain("Status: Paid");
        expect(card.textContent).toContain("Reference: paystack-ref");
        expect(card.textContent).toContain("Order ID: order-1");
        expect(card.textContent).toContain("Vendor: Campus Bites");
        expect(card.textContent).toContain("Amount: R42.50");
        expect(card.textContent).toContain("Your payment was successful.");
    });

    test("renderActions renders success and failure action links", () => {
        paymentCallback.renderActions(dom.actionsElement, { outcome: "success" });
        const successLinks = dom.actionsElement.querySelectorAll("a");
        expect(successLinks).toHaveLength(3);
        expect(successLinks[0].className).toBe("button-primary");
        expect(successLinks[0].getAttribute("href")).toBe("../order-tracking/index.html");

        paymentCallback.renderActions(dom.actionsElement, {
            outcome: "failed",
            vendorUid: "vendor-1"
        });
        const failureLinks = dom.actionsElement.querySelectorAll("a");
        expect(failureLinks).toHaveLength(3);
        expect(failureLinks[0].textContent).toBe("Retry from Checkout");
        expect(failureLinks[0].getAttribute("href")).toBe("./checkout.html?vendorUid=vendor-1");
    });

    test("renderActions falls back to neutral actions when outcome is unknown", () => {
        paymentCallback.renderActions(dom.actionsElement, {});
        const links = dom.actionsElement.querySelectorAll("a");
        expect(links).toHaveLength(2);
        expect(links[0].textContent).toBe("View My Orders");
        expect(links[1].textContent).toBe("Back to Cart");
    });

    test("buildSuccessSummary uses verify result and order data", () => {
        const summary = paymentCallback.buildSuccessSummary(
            {
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                verification: { reference: "paystack-ref" }
            },
            createOrderRecord()
        );

        expect(summary).toEqual(expect.objectContaining({
            outcome: "success",
            heading: "Payment Confirmed",
            statusLabel: "Paid",
            reference: "paystack-ref",
            orderId: "order-1",
            vendorName: "Campus Bites"
        }));
        expect(summary.amountLabel).toContain("42.50");
    });

    test("buildFailureSummary includes order vendor and error message", () => {
        const summary = paymentCallback.buildFailureSummary(
            {
                error: { message: "Card declined." }
            },
            createOrderRecord(),
            "paystack-ref"
        );

        expect(summary.outcome).toBe("failed");
        expect(summary.heading).toBe("Payment Not Completed");
        expect(summary.statusLabel).toBe("Payment Failed");
        expect(summary.vendorUid).toBe("vendor-1");
        expect(summary.message).toBe("Card declined.");
    });
});

describe("customer/order-management/payment-callback.js - data flow", () => {
    beforeEach(() => {
        resetGlobals();
    });

    test("findOrderByReference returns the matching order data", async () => {
        const firestoreFns = createFirestoreFns();
        const result = await paymentCallback.findOrderByReference("paystack-ref", {
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.orderId).toBe("order-1");
        expect(result.data.vendorName).toBe("Campus Bites");
        expect(firestoreFns.where).toHaveBeenCalledWith("paymentReference", "==", "paystack-ref");
        expect(firestoreFns.limit).toHaveBeenCalledWith(1);
    });

    test("findOrderByReference fails when reference is missing", async () => {
        const result = await paymentCallback.findOrderByReference("", {
            db: { kind: "db" },
            firestoreFns: createFirestoreFns()
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payment-callback/missing-reference");
    });

    test("findOrderByReference fails when Firestore helpers are missing", async () => {
        const result = await paymentCallback.findOrderByReference("paystack-ref", {
            db: null,
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payment-callback/firestore-unavailable");
    });

    test("findOrderByReference returns not-found when query has no docs", async () => {
        const firestoreFns = createFirestoreFns({
            getDocs: jest.fn(async () => ({
                forEach: function forEach() {}
            }))
        });

        const result = await paymentCallback.findOrderByReference("paystack-ref", {
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payment-callback/order-not-found");
    });

    test("findOrderByReference reports Firestore errors", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const firestoreFns = createFirestoreFns({
            getDocs: jest.fn(async () => {
                throw new Error("network down");
            })
        });

        const result = await paymentCallback.findOrderByReference("paystack-ref", {
            db: { kind: "db" },
            firestoreFns
        });

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("network down");

        errorSpy.mockRestore();
    });

    test("findCheckoutForCallback prefers checkoutId lookup through checkout service", async () => {
        const checkout = createCheckoutRecord();
        const getCheckoutById = jest.fn(async () => checkout);
        const result = await paymentCallback.findCheckoutForCallback("paystack-ref", {
            search: "?reference=paystack-ref&checkoutId=checkout-1",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutService: {
                getCheckoutById
            }
        });

        expect(result.success).toBe(true);
        expect(result.checkoutId).toBe("checkout-1");
        expect(result.data).toBe(checkout);
        expect(getCheckoutById).toHaveBeenCalledWith(expect.objectContaining({
            checkoutId: "checkout-1"
        }));
    });

    test("findCheckoutForCallback can fall back to payment reference lookup", async () => {
        const checkout = createCheckoutRecord();
        const fetchCheckoutByPaymentReference = jest.fn(async () => checkout);
        const result = await paymentCallback.findCheckoutForCallback("paystack-ref", {
            search: "?reference=paystack-ref",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutQueries: {
                fetchCheckoutByPaymentReference
            }
        });

        expect(result.success).toBe(true);
        expect(result.checkoutId).toBe("checkout-1");
        expect(fetchCheckoutByPaymentReference).toHaveBeenCalledWith(expect.objectContaining({
            paymentReference: "paystack-ref"
        }));
    });

    test("findCheckoutForCallback reports checkout-not-found when checkoutId is present", async () => {
        const result = await paymentCallback.findCheckoutForCallback("paystack-ref", {
            search: "?reference=paystack-ref&checkoutId=missing-checkout",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutService: {
                getCheckoutById: jest.fn(async () => null)
            }
        });

        expect(result.success).toBe(false);
        expect(result.skipped).toBeUndefined();
        expect(result.error.code).toBe("payment-callback/checkout-not-found");
    });

    test("updateOrderPatch writes the patch via updateDoc", async () => {
        const firestoreFns = createFirestoreFns();
        const result = await paymentCallback.updateOrderPatch(
            "order-1",
            { paymentStatus: "paid" },
            { db: { kind: "db" }, firestoreFns }
        );

        expect(result.success).toBe(true);
        expect(firestoreFns.doc).toHaveBeenCalledWith({ kind: "db" }, "orders", "order-1");
        expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: { kind: "db" }, name: "orders", id: "order-1" },
            { paymentStatus: "paid" }
        );
    });

    test("updateOrderPatch skips when missing args", async () => {
        const result = await paymentCallback.updateOrderPatch("", {}, {
            db: null,
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.skipped).toBe(true);
    });

    test("updateOrderPatch surfaces Firestore errors", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const firestoreFns = createFirestoreFns({
            updateDoc: jest.fn(async () => {
                throw new Error("write failed");
            })
        });

        const result = await paymentCallback.updateOrderPatch(
            "order-1",
            { paymentStatus: "paid" },
            { db: { kind: "db" }, firestoreFns }
        );

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("write failed");

        errorSpy.mockRestore();
    });

    test("verifyPaymentForOrder calls the callable and returns success patch", async () => {
        const callable = jest.fn(async () => ({
            data: {
                success: true,
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                verification: { reference: "paystack-ref" },
                patch: { paymentStatus: "paid" },
                reference: "paystack-ref"
            }
        }));

        const result = await paymentCallback.verifyPaymentForOrder(
            "paystack-ref",
            createOrderRecord(),
            { verifyPaymentCallable: callable }
        );

        expect(result.success).toBe(true);
        expect(result.patch).toEqual({ paymentStatus: "paid" });
        expect(callable).toHaveBeenCalledWith({
            payment: expect.objectContaining({
                orderId: "order-1",
                reference: "paystack-ref"
            }),
            reference: "paystack-ref"
        });
    });

    test("verifyPaymentForOrder reports callable failure result", async () => {
        const callable = jest.fn(async () => ({
            data: {
                success: false,
                patch: { paymentStatus: "failed" },
                error: { code: "payments/declined", message: "Card was declined." }
            }
        }));

        const result = await paymentCallback.verifyPaymentForOrder(
            "paystack-ref",
            createOrderRecord(),
            { verifyPaymentCallable: callable }
        );

        expect(result.success).toBe(false);
        expect(result.patch).toEqual({ paymentStatus: "failed" });
        expect(result.error.code).toBe("payments/declined");
    });

    test("verifyPaymentForOrder handles missing callable", async () => {
        const result = await paymentCallback.verifyPaymentForOrder(
            "paystack-ref",
            createOrderRecord(),
            {}
        );

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("payment-callback/verify-unavailable");
    });

    test("verifyPaymentForOrder handles thrown callable errors", async () => {
        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const callable = jest.fn(async () => {
            throw new Error("callable exploded");
        });

        const result = await paymentCallback.verifyPaymentForOrder(
            "paystack-ref",
            createOrderRecord(),
            { verifyPaymentCallable: callable }
        );

        expect(result.success).toBe(false);
        expect(result.error.message).toBe("callable exploded");

        errorSpy.mockRestore();
    });

    test("verifyPaymentForCheckout calls the callable with checkout payment details", async () => {
        const callable = jest.fn(async () => ({
            data: {
                success: true,
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                verification: { reference: "paystack-ref", amountInMinorUnits: 4250, currency: "ZAR" },
                reference: "paystack-ref"
            }
        }));

        const result = await paymentCallback.verifyPaymentForCheckout(
            "paystack-ref",
            createCheckoutRecord(),
            { verifyPaymentCallable: callable }
        );

        expect(result.success).toBe(true);
        expect(callable).toHaveBeenCalledWith({
            payment: expect.objectContaining({
                checkoutId: "checkout-1",
                reference: "paystack-ref"
            }),
            reference: "paystack-ref"
        });
    });

    test("createOrderFromPaidCheckout can persist a paid checkout directly", async () => {
        const firestoreFns = createFirestoreFns({
            setDoc: jest.fn(async () => true),
            serverTimestamp: jest.fn(() => "server-time")
        });
        const result = await paymentCallback.createOrderFromPaidCheckout(
            createCheckoutRecord({
                status: "paid",
                paymentPaidAt: "paid-at",
                paymentVerifiedAt: "verified-at"
            }),
            {
                db: { kind: "db" },
                firestoreFns,
                orderId: "order-from-checkout",
                orderService: null
            }
        );

        expect(result.success).toBe(true);
        expect(result.orderId).toBe("order-from-checkout");
        expect(result.order).toEqual(expect.objectContaining({
            orderId: "order-from-checkout",
            checkoutId: "checkout-1",
            paymentStatus: "paid",
            vendorUid: "vendor-1"
        }));
        expect(firestoreFns.setDoc).toHaveBeenCalledWith(
            { db: { kind: "db" }, name: "orders", id: "order-from-checkout" },
            expect.objectContaining({
                checkoutId: "checkout-1",
                paymentStatus: "paid"
            })
        );
    });

    test("convertCheckoutAfterOrder patches checkout when checkout service is unavailable", async () => {
        const firestoreFns = createFirestoreFns({
            updateDoc: jest.fn(async () => true),
            serverTimestamp: jest.fn(() => "server-time")
        });
        const result = await paymentCallback.convertCheckoutAfterOrder(
            createCheckoutRecord({ status: "paid" }),
            "order-1",
            {
                db: { kind: "db" },
                firestoreFns,
                checkoutService: null
            }
        );

        expect(result.success).toBe(true);
        expect(result.checkout.status).toBe("converted");
        expect(result.checkout.convertedOrderId).toBe("order-1");
        expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: { kind: "db" }, name: "checkoutSessions", id: "checkout-1" },
            expect.objectContaining({
                status: "converted",
                convertedOrderId: "order-1"
            })
        );
    });

    test("convertPaidCheckoutOnServer calls the conversion callable and normalizes success", async () => {
        const callable = jest.fn(async () => ({
            data: {
                success: true,
                checkout: createCheckoutRecord({
                    status: "converted",
                    convertedOrderId: "order-checkout-1"
                }),
                order: createOrderRecord({
                    orderId: "order-checkout-1",
                    checkoutId: "checkout-1"
                }),
                orderId: "order-checkout-1"
            }
        }));

        const result = await paymentCallback.convertPaidCheckoutOnServer(
            createCheckoutRecord({ status: "paid" }),
            {
                convertCheckoutToOrderCallable: callable
            }
        );

        expect(result.success).toBe(true);
        expect(result.orderId).toBe("order-checkout-1");
        expect(result.checkout.status).toBe("converted");
        expect(callable).toHaveBeenCalledWith({
            checkoutId: "checkout-1",
            checkout: expect.objectContaining({
                checkoutId: "checkout-1",
                status: "paid"
            }),
            orderId: ""
        });
    });

    test("convertPaidCheckoutOnServer skips safely when callable is unavailable", async () => {
        const result = await paymentCallback.convertPaidCheckoutOnServer(
            createCheckoutRecord({ status: "paid" }),
            {}
        );

        expect(result.success).toBe(false);
        expect(result.skipped).toBe(true);
        expect(result.error.code).toBe("payment-callback/checkout-conversion-callable-unavailable");
    });

    test("convertPaidCheckoutOnServer reports callable failure and thrown errors", async () => {
        const failure = await paymentCallback.convertPaidCheckoutOnServer(
            createCheckoutRecord({ status: "paid" }),
            {
                convertCheckoutToOrderCallable: jest.fn(async () => ({
                    data: {
                        success: false,
                        error: {
                            code: "checkout/not-paid",
                            message: "Only paid checkouts can become orders."
                        }
                    }
                }))
            }
        );

        expect(failure.success).toBe(false);
        expect(failure.skipped).toBeUndefined();
        expect(failure.error.code).toBe("checkout/not-paid");

        const errorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const thrown = await paymentCallback.convertPaidCheckoutOnServer(
            createCheckoutRecord({ status: "paid" }),
            {
                convertCheckoutToOrderCallable: jest.fn(async () => {
                    throw new Error("callable down");
                })
            }
        );

        expect(thrown.success).toBe(false);
        expect(thrown.error.message).toBe("callable down");
        errorSpy.mockRestore();
    });

    test("processPaymentCallback runs the full happy path", async () => {
        const firestoreFns = createFirestoreFns();
        const callable = jest.fn(async () => ({
            data: {
                success: true,
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                patch: { paymentStatus: "paid" },
                verification: { reference: "paystack-ref" },
                reference: "paystack-ref"
            }
        }));

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref",
            db: { kind: "db" },
            firestoreFns,
            verifyPaymentCallable: callable
        });

        expect(result.success).toBe(true);
        expect(result.outcome).toBe("success");
        expect(callable).toHaveBeenCalledTimes(1);
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
    });

    test("processPaymentCallback verifies checkout, creates order, and converts checkout", async () => {
        const firestoreFns = createFirestoreFns();
        const checkout = createCheckoutRecord();
        const paidCheckout = createCheckoutRecord({
            status: "paid",
            paymentPaidAt: "paid-at",
            paymentVerifiedAt: "verified-at"
        });
        const convertedCheckout = {
            ...paidCheckout,
            status: "converted",
            convertedOrderId: "order-checkout-1"
        };
        const checkoutService = {
            getCheckoutById: jest.fn(async () => checkout),
            applyVerifiedPayment: jest.fn(() => ({
                success: true,
                checkout: paidCheckout,
                patch: { status: "paid" }
            })),
            updateCheckoutWithPlan: jest.fn(async plan => plan),
            convertCheckoutToOrder: jest.fn(async () => ({
                success: true,
                checkout: convertedCheckout,
                order: createOrderRecord({ orderId: "order-checkout-1", checkoutId: "checkout-1" })
            }))
        };
        const orderService = {
            createOrders: jest.fn(async () => ({
                success: true,
                orders: [createOrderRecord({ orderId: "order-checkout-1", checkoutId: "checkout-1" })]
            }))
        };
        const callable = jest.fn(async () => ({
            data: {
                success: true,
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                verification: { reference: "paystack-ref", amountInMinorUnits: 4250, currency: "ZAR" },
                reference: "paystack-ref"
            }
        }));

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref&checkoutId=checkout-1",
            db: { kind: "db" },
            firestoreFns,
            checkoutService,
            orderService,
            verifyPaymentCallable: callable
        });

        expect(result.success).toBe(true);
        expect(result.outcome).toBe("success");
        expect(result.checkout.status).toBe("converted");
        expect(result.orderId).toBe("order-checkout-1");
        expect(checkoutService.getCheckoutById).toHaveBeenCalledWith(expect.objectContaining({
            checkoutId: "checkout-1"
        }));
        expect(checkoutService.applyVerifiedPayment).toHaveBeenCalledWith(
            checkout,
            expect.objectContaining({
                reference: "paystack-ref",
                amountInMinorUnits: 4250,
                currency: "ZAR"
            }),
            expect.objectContaining({
                actorRole: "system"
            })
        );
        expect(orderService.createOrders).toHaveBeenCalledWith(expect.objectContaining({
            cartItems: checkout.items,
            initialPaymentStatus: "paid",
            paymentReference: "paystack-ref"
        }));
        expect(checkoutService.convertCheckoutToOrder).toHaveBeenCalledWith(expect.objectContaining({
            checkout: paidCheckout,
            orderId: "order-checkout-1"
        }));
    });

    test("processPaymentCallback converts paid checkout through the server callable when available", async () => {
        const checkout = createCheckoutRecord();
        const paidCheckout = createCheckoutRecord({
            status: "paid",
            paymentPaidAt: "paid-at",
            paymentVerifiedAt: "verified-at"
        });
        const serverOrder = createOrderRecord({
            orderId: "order-checkout-1",
            checkoutId: "checkout-1",
            paymentStatus: "paid"
        });
        const checkoutService = {
            getCheckoutById: jest.fn(async () => checkout),
            applyVerifiedPayment: jest.fn(() => ({
                success: true,
                checkout: paidCheckout,
                patch: { status: "paid" }
            })),
            updateCheckoutWithPlan: jest.fn(async plan => plan),
            convertCheckoutToOrder: jest.fn()
        };
        const orderService = {
            createOrders: jest.fn()
        };
        const verifyPaymentCallable = jest.fn(async () => ({
            data: {
                success: true,
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                verification: { reference: "paystack-ref", amountInMinorUnits: 4250, currency: "ZAR" },
                reference: "paystack-ref"
            }
        }));
        const convertCheckoutToOrderCallable = jest.fn(async () => ({
            data: {
                success: true,
                checkout: {
                    ...paidCheckout,
                    status: "converted",
                    convertedOrderId: "order-checkout-1"
                },
                order: serverOrder,
                orderId: "order-checkout-1"
            }
        }));

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref&checkoutId=checkout-1",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutService,
            orderService,
            verifyPaymentCallable,
            convertCheckoutToOrderCallable
        });

        expect(result.success).toBe(true);
        expect(result.completedByServer).toBe(true);
        expect(result.order).toBe(serverOrder);
        expect(result.orderId).toBe("order-checkout-1");
        expect(convertCheckoutToOrderCallable).toHaveBeenCalledWith({
            checkoutId: "checkout-1",
            checkout: paidCheckout,
            orderId: ""
        });
        expect(orderService.createOrders).not.toHaveBeenCalled();
        expect(checkoutService.convertCheckoutToOrder).not.toHaveBeenCalled();
    });

    test("processPaymentCallback stops when the server checkout conversion callable fails", async () => {
        const checkoutService = {
            getCheckoutById: jest.fn(async () => createCheckoutRecord()),
            applyVerifiedPayment: jest.fn(() => ({
                success: true,
                checkout: createCheckoutRecord({ status: "paid" }),
                patch: { status: "paid" }
            })),
            updateCheckoutWithPlan: jest.fn(async plan => plan)
        };
        const orderService = {
            createOrders: jest.fn()
        };

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref&checkoutId=checkout-1",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutService,
            orderService,
            verifyPaymentCallable: jest.fn(async () => ({
                data: {
                    success: true,
                    payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                    verification: { reference: "paystack-ref", amountInMinorUnits: 4250, currency: "ZAR" },
                    reference: "paystack-ref"
                }
            })),
            convertCheckoutToOrderCallable: jest.fn(async () => ({
                data: {
                    success: false,
                    error: {
                        code: "checkout/conversion-failed",
                        message: "Server conversion failed."
                    }
                }
            }))
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("order-create-failed");
        expect(result.error.message).toBe("Server conversion failed.");
        expect(orderService.createOrders).not.toHaveBeenCalled();
    });

    test("processPaymentCallback marks checkout failed when checkout verification fails", async () => {
        const failedCheckout = createCheckoutRecord({
            status: "payment_failed",
            paymentFailureReason: "Card was declined."
        });
        const checkoutService = {
            getCheckoutById: jest.fn(async () => createCheckoutRecord()),
            applyFailedPayment: jest.fn(() => ({
                success: true,
                checkout: failedCheckout,
                patch: { status: "payment_failed" }
            })),
            updateCheckoutWithPlan: jest.fn(async plan => plan)
        };
        const callable = jest.fn(async () => ({
            data: {
                success: false,
                error: { code: "payments/declined", message: "Card was declined." }
            }
        }));

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref&checkoutId=checkout-1",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutService,
            verifyPaymentCallable: callable
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("failed");
        expect(result.checkout.status).toBe("payment_failed");
        expect(checkoutService.applyFailedPayment).toHaveBeenCalledWith(
            expect.objectContaining({ checkoutId: "checkout-1" }),
            expect.objectContaining({ message: "Card was declined." }),
            expect.objectContaining({ actorRole: "system" })
        );
    });

    test("processPaymentCallback reports checkout-not-found when callback contains checkoutId", async () => {
        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref&checkoutId=missing-checkout",
            db: { kind: "db" },
            firestoreFns: createFirestoreFns(),
            checkoutService: {
                getCheckoutById: jest.fn(async () => null)
            },
            verifyPaymentCallable: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("checkout-not-found");
        expect(result.error.code).toBe("payment-callback/checkout-not-found");
    });

    test("processPaymentCallback reports missing reference", async () => {
        const result = await paymentCallback.processPaymentCallback({
            search: ""
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("missing-reference");
    });

    test("processPaymentCallback reports order-not-found", async () => {
        const firestoreFns = createFirestoreFns({
            getDocs: jest.fn(async () => ({
                forEach: function forEach() {}
            }))
        });

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=missing-ref",
            db: { kind: "db" },
            firestoreFns,
            verifyPaymentCallable: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("order-not-found");
    });

    test("processPaymentCallback applies failure patch when verification fails", async () => {
        const firestoreFns = createFirestoreFns();
        const callable = jest.fn(async () => ({
            data: {
                success: false,
                patch: { paymentStatus: "failed" },
                error: { code: "payments/declined", message: "Card was declined." }
            }
        }));

        const result = await paymentCallback.processPaymentCallback({
            search: "?reference=paystack-ref",
            db: { kind: "db" },
            firestoreFns,
            verifyPaymentCallable: callable
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("failed");
        expect(firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.objectContaining({ id: "order-1" }),
            { paymentStatus: "failed" }
        );
    });
});

describe("customer/order-management/payment-callback.js - init", () => {
    let dom;

    beforeEach(() => {
        resetGlobals();
        dom = createDOM();
    });

    test("init renders the success state and writes the patch", async () => {
        const firestoreFns = createFirestoreFns();
        const callable = jest.fn(async () => ({
            data: {
                success: true,
                payment: { amount: 42.5, currency: "ZAR", reference: "paystack-ref" },
                patch: { paymentStatus: "paid" },
                verification: { reference: "paystack-ref" },
                reference: "paystack-ref"
            }
        }));

        const result = await paymentCallback.init({
            search: "?reference=paystack-ref",
            db: { kind: "db" },
            firestoreFns,
            verifyPaymentCallable: callable
        });

        expect(result.success).toBe(true);
        expect(result.outcome).toBe("success");
        expect(dom.statusElement.getAttribute("data-state")).toBe("success");
        expect(dom.statusElement.textContent).toContain("Payment confirmed");
        expect(dom.summaryElement.textContent).toContain("Payment Confirmed");
        expect(dom.summaryElement.textContent).toContain("Reference: paystack-ref");
        expect(dom.actionsElement.querySelectorAll("a")).toHaveLength(3);
        expect(dom.backButtonHost.querySelector(".payment-callback-back-button")).not.toBeNull();
    });

    test("init renders the missing-reference state when no reference exists", async () => {
        const result = await paymentCallback.init({
            search: ""
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("missing-reference");
        expect(dom.statusElement.getAttribute("data-state")).toBe("error");
        expect(dom.summaryElement.textContent).toContain("No Payment Reference");
    });

    test("init renders the failure state when verification fails", async () => {
        const firestoreFns = createFirestoreFns();
        const callable = jest.fn(async () => ({
            data: {
                success: false,
                patch: { paymentStatus: "failed" },
                error: { code: "payments/declined", message: "Card was declined." }
            }
        }));

        const result = await paymentCallback.init({
            search: "?reference=paystack-ref",
            db: { kind: "db" },
            firestoreFns,
            verifyPaymentCallable: callable
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("failed");
        expect(dom.statusElement.getAttribute("data-state")).toBe("error");
        expect(dom.statusElement.textContent).toBe("Card was declined.");
        expect(dom.summaryElement.textContent).toContain("Payment Not Completed");
        expect(dom.actionsElement.querySelector("a").textContent).toBe("Retry from Checkout");
    });

    test("init renders the order-not-found state", async () => {
        const firestoreFns = createFirestoreFns({
            getDocs: jest.fn(async () => ({
                forEach: function forEach() {}
            }))
        });

        const result = await paymentCallback.init({
            search: "?reference=missing-ref",
            db: { kind: "db" },
            firestoreFns,
            verifyPaymentCallable: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.outcome).toBe("order-not-found");
        expect(dom.summaryElement.textContent).toContain("Order Not Found");
    });
});
