/**
 * @jest-environment jsdom
 */

const customerCheckout = require("../../../public/customer/order-management/checkout.js");
const fs = require("fs");
const path = require("path");

function createCartItem(overrides = {}) {
    const requestedPrice = Number.isFinite(Number(overrides.price)) ? Number(overrides.price) : 55;
    const requestedVendorPrice = Number.isFinite(Number(overrides.vendorPrice))
        ? Number(overrides.vendorPrice)
        : Number.isFinite(Number(overrides.customerPrice))
            ? Math.round((Number(overrides.customerPrice) / 1.1 + Number.EPSILON) * 100) / 100
            : Math.round((requestedPrice / 1.1 + Number.EPSILON) * 100) / 100;
    const requestedPlatformFee = Number.isFinite(Number(overrides.platformFee))
        ? Number(overrides.platformFee)
        : Math.round(((requestedPrice - requestedVendorPrice) + Number.EPSILON) * 100) / 100;
    const requestedCustomerPrice = Number.isFinite(Number(overrides.customerPrice))
        ? Number(overrides.customerPrice)
        : requestedPrice;

    return {
        menuItemId: "item-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        name: "Burger",
        category: "Meals",
        vendorPrice: requestedVendorPrice,
        basePrice: requestedVendorPrice,
        platformFeeRate: 0.1,
        platformFee: requestedPlatformFee,
        customerPrice: requestedCustomerPrice,
        price: requestedCustomerPrice,
        quantity: 2,
        dietary: ["halal"],
        allergens: ["gluten"],
        photoURL: "",
        notes: "",
        ...overrides
    };
}

function createDOM() {
    document.body.innerHTML = `
        <section id="checkout-back-button-host"></section>
        <p id="checkout-status"></p>
        <h2 id="checkout-vendor-heading">Checkout</h2>
        <section id="checkout-items-container"></section>
        <section id="checkout-summary"></section>
        <p id="checkout-session-status"></p>
        <button id="resume-payment-button" type="button">Resume Payment</button>
        <button id="cancel-checkout-button" type="button">Cancel Checkout</button>
        <textarea id="checkout-notes"></textarea>
        <button id="place-order-button" type="button">Place Order</button>
    `;

    return {
        backButtonHost: document.getElementById("checkout-back-button-host"),
        statusElement: document.getElementById("checkout-status"),
        vendorHeading: document.getElementById("checkout-vendor-heading"),
        container: document.getElementById("checkout-items-container"),
        summarySection: document.getElementById("checkout-summary"),
        sessionStatusElement: document.getElementById("checkout-session-status"),
        resumePaymentButton: document.getElementById("resume-payment-button"),
        cancelCheckoutButton: document.getElementById("cancel-checkout-button"),
        notesInput: document.getElementById("checkout-notes"),
        placeOrderButton: document.getElementById("place-order-button")
    };
}

function seedCart(items) {
    window.localStorage.setItem(
        customerCheckout.CART_STORAGE_KEY,
        JSON.stringify(items || [])
    );
}

function useTestStorage(overrides = {}) {
    const storage = {
        getItem: jest.fn(() => null),
        setItem: jest.fn(),
        ...overrides
    };

    window.__campusFoodTestLocalStorage = storage;
    global.__campusFoodTestLocalStorage = storage;

    return storage;
}

function resetCheckoutGlobals() {
    delete window.__campusFoodTestLocalStorage;
    delete global.__campusFoodTestLocalStorage;
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
    delete window.checkoutStatus;
    delete global.checkoutStatus;
    delete window.checkoutModel;
    delete global.checkoutModel;
    delete window.checkoutValidation;
    delete global.checkoutValidation;
    delete window.checkoutQueries;
    delete global.checkoutQueries;
    delete window.checkoutService;
    delete global.checkoutService;
}

function createCheckoutFirestoreFns(overrides = {}) {
    return {
        doc: jest.fn((first, collectionName, docId) => ({
            first,
            collectionName,
            docId,
            id: docId || "generated-checkout"
        })),
        setDoc: jest.fn(async () => true),
        updateDoc: jest.fn(async () => true),
        serverTimestamp: jest.fn(() => "server-time"),
        ...overrides
    };
}

describe("customer/order-management/checkout.js - helpers", () => {
    beforeEach(() => {
        window.localStorage.clear();
        resetCheckoutGlobals();
    });

    test("buildCheckoutContext filters the cart by vendor UID from search", () => {
        seedCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 1, price: 5 })
        ]);

        const context = customerCheckout.buildCheckoutContext({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites"
        });

        expect(context.vendorUid).toBe("vendor-1");
        expect(context.vendorName).toBe("Campus Bites");
        expect(context.vendorItems).toHaveLength(1);
        expect(context.itemCount).toBe(2);
        expect(context.subtotal).toBe(20);
        expect(context.customerTotal).toBe(20);
        expect(context.platformFee).toBeCloseTo(1.82);
        expect(context.vendorSubtotal).toBeCloseTo(18.18);
    });

    test("normalizeCartItem adds 10% for older cart prices and preserves newer split prices", () => {
        const olderItem = customerCheckout.normalizeCartItem({
            menuItemId: "old-item",
            vendorUid: "vendor-1",
            price: 100
        });
        const newerItem = customerCheckout.normalizeCartItem(createCartItem({
            vendorPrice: 100,
            platformFee: 10,
            customerPrice: 110,
            price: 110
        }));

        expect(olderItem.vendorPrice).toBe(100);
        expect(olderItem.platformFee).toBe(10);
        expect(olderItem.customerPrice).toBe(110);
        expect(olderItem.price).toBe(110);
        expect(newerItem.vendorPrice).toBe(100);
        expect(newerItem.platformFee).toBe(10);
        expect(newerItem.customerPrice).toBe(110);
        expect(newerItem.price).toBe(110);
        expect(newerItem.dietary).toEqual(["halal"]);
        expect(newerItem.allergens).toEqual(["gluten"]);
    });

    test("tag helpers normalize aliases and format checkout display text", () => {
        const taggedItem = customerCheckout.normalizeCartItem({
            menuItemId: "tagged-item",
            vendorUid: "vendor-1",
            dietaryTags: "Halal, gluten free, halal",
            allergenTags: [" Nuts ", "dairy", "nuts"],
            price: 50
        });

        expect(customerCheckout.normalizeTagList("Halal, gluten free, halal")).toEqual([
            "halal",
            "gluten free"
        ]);
        expect(customerCheckout.formatTag("gluten free")).toBe("Gluten-free");
        expect(customerCheckout.formatTagList(["halal", "gluten free"])).toBe("Halal, Gluten-free");
        expect(taggedItem.dietary).toEqual(["halal", "gluten free"]);
        expect(taggedItem.allergens).toEqual(["nuts", "dairy"]);
    });

    test("buildCustomerSnapshot maps the authenticated user", () => {
        const snapshot = customerCheckout.buildCustomerSnapshot({
            uid: "customer-1",
            displayName: "Ama",
            email: "ama@example.com"
        });

        expect(snapshot.customerUid).toBe("customer-1");
        expect(snapshot.customerName).toBe("Ama");
        expect(snapshot.customerEmail).toBe("ama@example.com");
    });

    test("removeVendorItemsFromCart keeps non-target vendor items", () => {
        const remaining = customerCheckout.removeVendorItemsFromCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1" }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2" })
        ], "vendor-1");

        expect(remaining).toHaveLength(1);
        expect(remaining[0].vendorUid).toBe("vendor-2");
    });

    test("normalizes utility values and resolves shared globals", () => {
        window.db = { kind: "db" };
        window.auth = { currentUser: { uid: "customer-1" } };
        window.authFns = { onAuthStateChanged: jest.fn() };
        window.firestoreFns = { collection: jest.fn() };
        window.functions = { kind: "functions" };
        window.functionsFns = { httpsCallable: jest.fn() };
        window.orderService = { createOrders: jest.fn() };

        expect(customerCheckout.normalizePrice("42.5")).toBe(42.5);
        expect(customerCheckout.normalizePrice("-2")).toBe(0);
        expect(customerCheckout.normalizePositiveQuantity("3")).toBe(3);
        expect(customerCheckout.normalizePositiveQuantity("0", 2)).toBe(2);
        expect(customerCheckout.formatCurrency("12.5")).toBe("R12.50");
        expect(customerCheckout.decodeText("Campus%20Bites")).toBe("Campus Bites");
        expect(customerCheckout.decodeText("%")).toBe("%");

        expect(customerCheckout.resolveFirestore()).toBe(window.db);
        expect(customerCheckout.resolveAuth()).toBe(window.auth);
        expect(customerCheckout.resolveAuthFns()).toBe(window.authFns);
        expect(customerCheckout.resolveFirestoreFns()).toBe(window.firestoreFns);
        expect(customerCheckout.resolveFunctions()).toBe(window.functions);
        expect(customerCheckout.resolveFunctionsFns()).toBe(window.functionsFns);
        expect(customerCheckout.resolveOrderService()).toBe(window.orderService);
        expect(customerCheckout.resolveOrderService({ createOrders: jest.fn() })).toEqual(
            expect.objectContaining({ createOrders: expect.any(Function) })
        );
    });

    test("uses test storage overrides and safely handles bad cart storage data", () => {
        const readErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
        const storage = useTestStorage({
            getItem: jest.fn(() => "{")
        });

        expect(customerCheckout.getStorageArea()).toBe(storage);
        expect(customerCheckout.getCart()).toEqual([]);

        readErrorSpy.mockRestore();
    });

    test("saveCart returns false when storage cannot persist and supports direct-create detection", () => {
        useTestStorage({
            setItem: undefined
        });

        expect(customerCheckout.saveCart([createCartItem()])).toBe(false);
        expect(customerCheckout.supportsDirectOrderCreation({})).toBe(false);
        expect(
            customerCheckout.supportsDirectOrderCreation({
                collection: jest.fn(),
                addDoc: jest.fn(),
                serverTimestamp: jest.fn()
            })
        ).toBe(true);
    });

    test("waitForAuthReady resolves with direct state or listener callbacks", async () => {
        const listenerUser = {
            uid: "customer-2"
        };
        const auth = {
            currentUser: {
                uid: "fallback-user"
            }
        };
        const immediateResult = await customerCheckout.waitForAuthReady(auth, null);
        const listenerResult = await customerCheckout.waitForAuthReady(auth, {
            onAuthStateChanged: jest.fn((safeAuth, onChange) => {
                onChange(listenerUser);
                return jest.fn();
            })
        });
        const errorFallbackResult = await customerCheckout.waitForAuthReady(auth, {
            onAuthStateChanged: jest.fn((safeAuth, onChange, onError) => {
                onError(new Error("auth failed"));
                return jest.fn();
            })
        });

        expect(immediateResult).toBe(auth.currentUser);
        expect(listenerResult).toBe(listenerUser);
        expect(errorFallbackResult).toBe(auth.currentUser);
    });

    test("createBackButton uses browser history when available", () => {
        const originalLength = window.history.length;
        const backSpy = jest.spyOn(window.history, "back").mockImplementation(() => {});

        Object.defineProperty(window.history, "length", {
            configurable: true,
            value: 2
        });

        const button = customerCheckout.createBackButton();
        button.click();

        expect(button.textContent).toBe("Back");
        expect(backSpy).toHaveBeenCalledTimes(1);

        backSpy.mockRestore();
        Object.defineProperty(window.history, "length", {
            configurable: true,
            value: originalLength
        });
    });

    test("createCheckoutItemArticle renders the expected checkout item details", () => {
        const article = customerCheckout.createCheckoutItemArticle(
            createCartItem({
                quantity: 3,
                price: 15
            })
        );

        expect(article.querySelector(".checkout-item-name").textContent).toBe("Burger");
        expect(article.textContent).toContain("Quantity: 3");
        expect(article.textContent).toContain("Customer Price: R15.00");
        expect(article.textContent).toContain("platform fee");
        expect(article.textContent).toContain("Dietary info:");
        expect(article.textContent).toContain("Halal");
        expect(article.textContent).toContain("Allergen info:");
        expect(article.textContent).toContain("Gluten");
        expect(article.textContent).toContain("Line Total: R45.00");
        expect(article.querySelector(".checkout-item-dietary .checkout-item-value").tagName).toBe("OUTPUT");
        expect(article.querySelectorAll("span")).toHaveLength(0);
    });

    test("createCheckoutItemArticle omits tag lines when no tag data exists", () => {
        const article = customerCheckout.createCheckoutItemArticle(createCartItem({
            dietary: [],
            allergens: []
        }));

        expect(article.querySelector(".checkout-item-dietary")).toBeNull();
        expect(article.querySelector(".checkout-item-allergens")).toBeNull();
    });

    test("builds payment order details and resolves payment callables", () => {
        const callable = jest.fn(async () => ({
            data: {
                success: true
            }
        }));
        const httpsCallable = jest.fn(() => callable);
        const functions = { kind: "functions" };
        const order = customerCheckout.buildPaymentOrder({
            id: "order-1",
            customerUid: "customer-1",
            customerEmail: "ama@example.com",
            total: 42.5
        }, {
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            subtotal: 42.5
        });

        expect(order).toEqual(expect.objectContaining({
            orderId: "order-1",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            paymentAmount: 42.5,
            paymentAmountInMinorUnits: 4250,
            paymentCurrency: "ZAR",
            paymentProvider: "paystack"
        }));
        expect(customerCheckout.getOrderIdentifier({ id: "order-1" })).toBe("order-1");
        expect(customerCheckout.shouldInitializePayment({ functions, functionsFns: { httpsCallable } })).toBe(true);
        expect(customerCheckout.shouldInitializePayment({ requirePayment: false })).toBe(false);
        expect(
            customerCheckout.resolveInitializePaymentCallable({
                functions,
                functionsFns: { httpsCallable }
            })
        ).toBe(callable);
        expect(httpsCallable).toHaveBeenCalledWith(functions, "initializePayment");
        expect(customerCheckout.normalizeCallableResult({ data: { success: true } })).toEqual({ success: true });
        expect(customerCheckout.normalizeCallableResult({ success: true })).toEqual({ success: true });
        expect(customerCheckout.getPaymentCallbackUrl({
            paymentCallbackUrl: "https://example.com/callback.html"
        })).toBe("https://example.com/callback.html");
        expect(customerCheckout.appendUrlQueryParam(
            "https://example.com/callback.html?reference=ref-1",
            "checkoutId",
            "checkout-1"
        )).toBe("https://example.com/callback.html?reference=ref-1&checkoutId=checkout-1");
        expect(customerCheckout.getPaymentCallbackUrlForCheckout({
            checkoutId: "checkout-1"
        }, {
            paymentCallbackUrl: "https://example.com/callback.html"
        })).toBe("https://example.com/callback.html?checkoutId=checkout-1");
    });
});

describe("customer/order-management/checkout.js - rendering", () => {
    let dom;

    beforeEach(() => {
        window.localStorage.clear();
        dom = createDOM();
        resetCheckoutGlobals();
    });

    test("renderCheckoutItems shows empty state when no items exist", () => {
        customerCheckout.renderCheckoutItems([], dom.container);

        expect(dom.container.textContent).toContain("No cart items are available");
    });

    test("renderCheckoutItems shows checkout item cards", () => {
        customerCheckout.renderCheckoutItems([
            createCartItem({
                menuItemId: "item-1",
                vendorUid: "vendor-1",
                dietary: ["halal", "gluten free"],
                allergens: ["nuts"]
            }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-1" })
        ], dom.container);

        expect(dom.container.querySelectorAll(".checkout-item-card")).toHaveLength(2);
        expect(dom.container.querySelector(".checkout-item-dietary").textContent)
            .toContain("Halal, Gluten-free");
        expect(dom.container.querySelector(".checkout-item-allergens").textContent)
            .toContain("Nuts");
    });

    test("renderCheckoutSummary shows vendor, items, and total", () => {
        customerCheckout.renderCheckoutSummary({
            vendorName: "Campus Bites",
            itemCount: 3,
            vendorSubtotal: 68.18,
            platformFee: 6.82,
            subtotal: 75
        }, dom.summarySection);

        expect(dom.summarySection.textContent).toContain("Vendor: Campus Bites");
        expect(dom.summarySection.textContent).toContain("Items: 3");
        expect(dom.summarySection.textContent).toContain("Vendor Earnings: R68.18");
        expect(dom.summarySection.textContent).toContain("Platform Fee: R6.82");
        expect(dom.summarySection.textContent).toContain("Customer Total: R75.00");
    });

    test("updateCheckoutView updates heading and status", () => {
        const context = {
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            vendorItems: [createCartItem()],
            itemCount: 2,
            subtotal: 110
        };

        customerCheckout.updateCheckoutView(context, {
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            vendorNameHeading: dom.vendorHeading,
            placeOrderButton: dom.placeOrderButton
        });

        expect(dom.vendorHeading.textContent).toBe("Campus Bites");
        expect(dom.statusElement.textContent).toContain("ready to order");
        expect(dom.placeOrderButton.disabled).toBe(false);
    });

    test("renderCheckoutSession enables resume and cancel actions for unfinished payment", () => {
        const checkout = {
            checkoutId: "checkout-1",
            status: "payment_pending",
            paymentReference: "paystack-ref",
            paymentAuthorizationUrl: "https://checkout.paystack.com/test"
        };

        customerCheckout.renderCheckoutSession(checkout, {
            sessionStatusElement: dom.sessionStatusElement,
            resumePaymentButton: dom.resumePaymentButton,
            cancelCheckoutButton: dom.cancelCheckoutButton
        });

        expect(dom.sessionStatusElement.textContent).toContain("Payment Pending");
        expect(dom.sessionStatusElement.textContent).toContain("paystack-ref");
        expect(dom.resumePaymentButton.disabled).toBe(false);
        expect(dom.cancelCheckoutButton.disabled).toBe(false);
        expect(dom.resumePaymentButton.dataset.checkoutId).toBe("checkout-1");
    });

    test("renderCheckoutSession disables actions when no checkout is available", () => {
        customerCheckout.renderCheckoutSession(null, {
            sessionStatusElement: dom.sessionStatusElement,
            resumePaymentButton: dom.resumePaymentButton,
            cancelCheckoutButton: dom.cancelCheckoutButton
        });

        expect(dom.sessionStatusElement.textContent).toContain("No unfinished checkout");
        expect(dom.resumePaymentButton.disabled).toBe(true);
        expect(dom.cancelCheckoutButton.disabled).toBe(true);
    });
});

describe("customer/order-management/checkout.js - placeOrder and init", () => {
    let dom;

    beforeEach(() => {
        window.localStorage.clear();
        dom = createDOM();
        resetCheckoutGlobals();
    });

    test("placeOrder returns a sign-in error when no current user exists", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites" })
        ]);

        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns: { doc: jest.fn(), setDoc: jest.fn() },
            orderService: { createOrders: jest.fn() },
            auth: { currentUser: null }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("checkout/not-signed-in");
    });

    test("placeOrder returns a no-items error when the selected vendor has nothing in the cart", async () => {
        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            currentUser: {
                uid: "customer-1"
            }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("checkout/no-items");
    });

    test("placeOrder returns no-db and no-firestore errors for incomplete setup", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites" })
        ]);

        const noDbResult = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            currentUser: {
                uid: "customer-1"
            }
        });
        const noFirestoreResult = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            },
            db: { kind: "db" },
            firestoreFns: {}
        });

        expect(noDbResult.success).toBe(false);
        expect(noDbResult.error.code).toBe("checkout/no-db");
        expect(noFirestoreResult.success).toBe(false);
        expect(noFirestoreResult.error.code).toBe("checkout/create-unavailable");
    });

    test("placeOrder creates a checkout session and keeps cart items until payment is confirmed", async () => {
        seedCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 1, price: 5 })
        ]);

        const createOrders = jest.fn();
        const firestoreFns = createCheckoutFirestoreFns();

        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns,
            orderService: { createOrders },
            checkoutId: "checkout-1",
            initializePaymentCallable: jest.fn(async () => ({
                data: {
                    success: true,
                    authorizationUrl: "https://checkout.paystack.com/test",
                    accessCode: "access-code",
                    reference: "paystack-ref"
                }
            })),
            navigateToPayment: jest.fn(),
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            },
            orderNotes: "Please prepare quickly"
        });

        expect(result.success).toBe(true);
        expect(result.source).toBe("checkout-session");
        expect(result.checkout.checkoutId).toBe("checkout-1");
        expect(result.checkout.notes).toBe("Please prepare quickly");
        expect(createOrders).not.toHaveBeenCalled();
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(2);
        expect(JSON.parse(window.localStorage.getItem(customerCheckout.CART_STORAGE_KEY))).toHaveLength(2);
    });

    test("placeOrder initializes payment when a callable payment function is available", async () => {
        seedCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 1, price: 5 })
        ]);

        const navigateToPayment = jest.fn();
        const firestoreFns = createCheckoutFirestoreFns();
        const initializePaymentCallable = jest.fn(async () => ({
            data: {
                success: true,
                authorizationUrl: "https://checkout.paystack.com/test",
                accessCode: "access-code",
                reference: "paystack-ref",
                payment: {
                    orderId: "checkout-2",
                    status: "pending"
                }
            }
        }));
        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns,
            checkoutId: "checkout-2",
            initializePaymentCallable,
            navigateToPayment,
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            }
        });

        expect(result.success).toBe(true);
        expect(result.payment.paymentRequired).toBe(true);
        expect(result.payment.reference).toBe("paystack-ref");
        expect(initializePaymentCallable).toHaveBeenCalledWith({
            order: expect.objectContaining({
                orderId: "checkout-2",
                checkoutId: "checkout-2",
                paymentAmount: 20,
                paymentAmountInMinorUnits: 2000
            }),
            options: expect.objectContaining({
                reference: expect.stringContaining("checkout-checkout-2"),
                metadata: expect.objectContaining({
                    checkoutId: "checkout-2",
                    source: "checkout-session"
                })
            })
        });
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(2);
        expect(navigateToPayment).toHaveBeenCalledWith("https://checkout.paystack.com/test");
        expect(JSON.parse(window.localStorage.getItem(customerCheckout.CART_STORAGE_KEY))).toHaveLength(2);
    });

    test("placeOrder refreshes an unfinished checkout payment instead of creating a duplicate session", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 1, price: 10 })
        ]);

        const navigateToPayment = jest.fn();
        const createCheckout = jest.fn();
        const initializeCheckoutPayment = jest.fn(async options => ({
            success: true,
            checkout: {
                ...options.checkout,
                paymentReference: "existing-ref"
            }
        }));
        const applyInitializedPayment = jest.fn((checkout, payment) => ({
            success: true,
            checkout: {
                ...checkout,
                paymentReference: payment.reference,
                paymentAccessCode: payment.accessCode,
                paymentAuthorizationUrl: payment.authorizationUrl
            }
        }));
        const updateCheckoutWithPlan = jest.fn(async plan => plan);
        const initializePaymentCallable = jest.fn(async () => ({
            data: {
                success: true,
                authorizationUrl: "https://checkout.paystack.com/fresh",
                accessCode: "fresh-access",
                reference: "fresh-ref",
                payment: {
                    checkoutId: "checkout-existing",
                    status: "pending"
                }
            }
        }));
        const fetchResumableCustomerCheckout = jest.fn(async () => ({
            checkoutId: "checkout-existing",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "payment_pending",
            paymentReference: "existing-ref",
            paymentAuthorizationUrl: "https://checkout.paystack.com/existing"
        }));
        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns: createCheckoutFirestoreFns({
                getDocs: jest.fn()
            }),
            checkoutQueries: {
                fetchResumableCustomerCheckout
            },
            checkoutService: {
                createCheckout,
                initializeCheckoutPayment,
                applyInitializedPayment,
                updateCheckoutWithPlan
            },
            initializePaymentCallable,
            navigateToPayment,
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            }
        });

        expect(result.success).toBe(true);
        expect(result.source).toBe("checkout-session-resume");
        expect(createCheckout).not.toHaveBeenCalled();
        expect(fetchResumableCustomerCheckout).toHaveBeenCalledWith(expect.objectContaining({
            customerUid: "customer-1"
        }));
        expect(initializePaymentCallable).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({
                forceNewTransaction: true,
                refreshPayment: true,
                reference: undefined
            })
        }));
        expect(navigateToPayment).toHaveBeenCalledWith("https://checkout.paystack.com/fresh");
    });

    test("createOrderDirectly creates an order and vendor or customer notifications", async () => {
        const addDoc = jest.fn()
            .mockResolvedValueOnce({ id: "order-1" })
            .mockResolvedValueOnce({ id: "notification-1" })
            .mockResolvedValueOnce({ id: "notification-2" });
        const firestoreFns = {
            collection: jest.fn((db, name) => ({ db, name })),
            addDoc,
            serverTimestamp: jest.fn(() => "server-time")
        };

        const result = await customerCheckout.createOrderDirectly({
            db: { kind: "db" },
            firestoreFns,
            context: {
                vendorUid: "vendor-1",
                vendorName: "Campus Bites",
                vendorItems: [createCartItem({ quantity: 2, price: 10 })],
                itemCount: 2,
                subtotal: 20
            },
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            },
            orderNotes: "Please hurry"
        });

        expect(result.success).toBe(true);
        expect(result.source).toBe("direct-firestore");
        expect(addDoc).toHaveBeenCalledTimes(3);
        expect(result.orders[0]).toEqual(
            expect.objectContaining({
                id: "order-1",
                vendorUid: "vendor-1",
                notes: "Please hurry",
                paymentStatus: "unpaid",
                paymentProvider: "paystack",
                paymentAmount: 20,
                paymentAmountInMinorUnits: 2000,
                paymentCurrency: "ZAR",
                customerTotal: 20
            })
        );
        expect(result.orders[0].vendorSubtotal).toBeCloseTo(18.18);
        expect(result.orders[0].vendorEarnings).toBeCloseTo(18.18);
        expect(result.orders[0].platformFee).toBeCloseTo(1.82);
        expect(result.orders[0].platformEarnings).toBeCloseTo(1.82);
        expect(result.orders[0].items[0].dietary).toEqual(["halal"]);
        expect(result.orders[0].items[0].allergens).toEqual(["gluten"]);
    });

    test("initializeOrderPayment calls the cloud function, patches the order, and navigates to Paystack", async () => {
        const updateDoc = jest.fn(async () => true);
        const doc = jest.fn((db, collectionName, orderId) => ({ db, collectionName, orderId }));
        const navigateToPayment = jest.fn();
        const initializePaymentCallable = jest.fn(async () => ({
            data: {
                success: true,
                authorizationUrl: "https://checkout.paystack.com/test",
                accessCode: "access-code",
                reference: "paystack-ref",
                payment: {
                    orderId: "order-1",
                    status: "pending"
                },
                patch: {
                    paymentStatus: "pending",
                    paymentReference: "paystack-ref",
                    paymentAuthorizationUrl: "https://checkout.paystack.com/test"
                }
            }
        }));

        const result = await customerCheckout.initializeOrderPayment({
            orderId: "order-1",
            customerUid: "customer-1",
            customerEmail: "ama@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            total: 20
        }, {
            db: { kind: "db" },
            firestoreFns: { doc, updateDoc },
            initializePaymentCallable,
            paymentCallbackUrl: "https://example.com/customer/order-management/payment-callback.html",
            navigateToPayment
        });

        expect(result.success).toBe(true);
        expect(result.paymentRequired).toBe(true);
        expect(result.reference).toBe("paystack-ref");
        expect(initializePaymentCallable).toHaveBeenCalledWith({
            order: expect.objectContaining({
                orderId: "order-1",
                paymentAmount: 20,
                paymentAmountInMinorUnits: 2000
            }),
            options: {
                callbackUrl: "https://example.com/customer/order-management/payment-callback.html"
            }
        });
        expect(updateDoc).toHaveBeenCalledWith(
            {
                db: { kind: "db" },
                collectionName: "orders",
                orderId: "order-1"
            },
            {
                paymentStatus: "pending",
                paymentReference: "paystack-ref",
                paymentAuthorizationUrl: "https://checkout.paystack.com/test"
            }
        );
        expect(navigateToPayment).toHaveBeenCalledWith("https://checkout.paystack.com/test");
    });

    test("initializeOrderPayment skips when payment helpers are unavailable", async () => {
        await expect(
            customerCheckout.initializeOrderPayment({ orderId: "order-1" }, {})
        ).resolves.toEqual({
            success: true,
            skipped: true,
            paymentRequired: false
        });
    });

    test("initializeOrderPayment returns payment errors without patching", async () => {
        const updateDoc = jest.fn();
        const result = await customerCheckout.initializeOrderPayment({
            orderId: "order-1",
            customerEmail: "ama@example.com",
            total: 20
        }, {
            db: { kind: "db" },
            firestoreFns: {
                doc: jest.fn(),
                updateDoc
            },
            initializePaymentCallable: jest.fn(async () => ({
                data: {
                    success: false,
                    error: {
                        code: "payments/problem",
                        message: "Payment failed."
                    }
                }
            }))
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual({
            code: "payments/problem",
            message: "Payment failed."
        });
        expect(updateDoc).not.toHaveBeenCalled();
    });

    test("buildPaymentOrderFromCheckout maps checkout sessions into payment payloads", () => {
        expect(customerCheckout.buildPaymentOrderFromCheckout({
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            customerName: "Ama",
            customerEmail: "ama@example.com",
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            total: 42.5,
            paymentReference: "paystack-ref"
        })).toEqual(expect.objectContaining({
            orderId: "checkout-1",
            checkoutId: "checkout-1",
            customerEmail: "ama@example.com",
            vendorUid: "vendor-1",
            paymentAmount: 42.5,
            paymentAmountInMinorUnits: 4250,
            paymentReference: "paystack-ref",
            metadata: expect.objectContaining({
                checkoutId: "checkout-1",
                source: "checkout-session"
            })
        }));
    });

    test("resumeCheckoutPayment refreshes stale saved authorization URLs by default", async () => {
        const navigateToPayment = jest.fn();
        const initializeCheckoutPayment = jest.fn(async options => ({
            success: true,
            checkout: {
                ...options.checkout,
                paymentReference: "old-ref"
            }
        }));
        const applyInitializedPayment = jest.fn((checkout, payment) => ({
            success: true,
            checkout: {
                ...checkout,
                paymentReference: payment.reference,
                paymentAccessCode: payment.accessCode,
                paymentAuthorizationUrl: payment.authorizationUrl
            }
        }));
        const updateCheckoutWithPlan = jest.fn(async plan => plan);
        const initializePaymentCallable = jest.fn(async () => ({
            data: {
                success: true,
                authorizationUrl: "https://checkout.paystack.com/fresh",
                accessCode: "fresh-access",
                reference: "fresh-ref",
                payment: {
                    checkoutId: "checkout-1",
                    status: "pending"
                }
            }
        }));
        const result = await customerCheckout.resumeCheckoutPayment({
            checkoutId: "checkout-1",
            status: "payment_pending",
            paymentReference: "old-ref",
            paymentAuthorizationUrl: "https://checkout.paystack.com/test"
        }, {
            db: { kind: "db" },
            firestoreFns: createCheckoutFirestoreFns(),
            checkoutService: {
                createCheckout: jest.fn(),
                initializeCheckoutPayment,
                applyInitializedPayment,
                updateCheckoutWithPlan
            },
            initializePaymentCallable,
            navigateToPayment
        });

        expect(result.success).toBe(true);
        expect(result.reference).toBe("fresh-ref");
        expect(initializePaymentCallable).toHaveBeenCalledWith(expect.objectContaining({
            options: expect.objectContaining({
                forceNewTransaction: true,
                refreshPayment: true,
                reference: undefined
            })
        }));
        expect(navigateToPayment).toHaveBeenCalledWith("https://checkout.paystack.com/fresh");
    });

    test("resumeCheckoutPayment can reuse an authorization URL when explicitly requested", async () => {
        const navigateToPayment = jest.fn();
        const result = await customerCheckout.resumeCheckoutPayment({
            checkoutId: "checkout-1",
            status: "payment_pending",
            paymentAuthorizationUrl: "https://checkout.paystack.com/test"
        }, {
            reuseAuthorizationUrl: true,
            navigateToPayment
        });

        expect(result.success).toBe(true);
        expect(result.resumed).toBe(true);
        expect(navigateToPayment).toHaveBeenCalledWith("https://checkout.paystack.com/test");
    });

    test("cancelCheckoutSession delegates unpaid cancellation to the checkout service", async () => {
        const cancelCheckout = jest.fn(async options => ({
            success: true,
            checkout: {
                ...options.checkout,
                status: "cancelled"
            }
        }));
        const result = await customerCheckout.cancelCheckoutSession({
            checkoutId: "checkout-1",
            status: "payment_pending"
        }, {
            checkoutService: {
                createCheckout: jest.fn(),
                cancelCheckout
            }
        });

        expect(result.success).toBe(true);
        expect(result.checkout.status).toBe("cancelled");
        expect(cancelCheckout).toHaveBeenCalledWith(expect.objectContaining({
            checkout: expect.objectContaining({ checkoutId: "checkout-1" }),
            actorRole: "customer"
        }));
    });

    test("findResumableCheckout can load a requested checkout by id", async () => {
        const checkout = {
            checkoutId: "checkout-1",
            customerUid: "customer-1",
            vendorUid: "vendor-1",
            status: "payment_pending"
        };
        const getCheckoutById = jest.fn(async () => checkout);
        const result = await customerCheckout.findResumableCheckout({
            vendorUid: "vendor-1"
        }, {
            uid: "customer-1"
        }, {
            search: "?checkoutId=checkout-1",
            db: { kind: "db" },
            firestoreFns: createCheckoutFirestoreFns(),
            checkoutService: {
                createCheckout: jest.fn(),
                getCheckoutById
            }
        });

        expect(result).toBe(checkout);
        expect(getCheckoutById).toHaveBeenCalledWith(expect.objectContaining({
            checkoutId: "checkout-1"
        }));
    });

    test("findResumableCheckout skips the lookup while a Firestore index is building", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});
        const fetchResumableCustomerCheckout = jest.fn(async () => {
            const error = new Error("The query requires an index. That index is currently building and cannot be used yet.");
            error.code = "failed-precondition";
            throw error;
        });

        try {
            const result = await customerCheckout.findResumableCheckout({
                vendorUid: "vendor-1"
            }, {
                uid: "customer-1"
            }, {
                db: { kind: "db" },
                firestoreFns: createCheckoutFirestoreFns(),
                checkoutQueries: {
                    fetchResumableCustomerCheckout
                }
            });

            expect(result).toBeNull();
            expect(fetchResumableCustomerCheckout).toHaveBeenCalledWith(expect.objectContaining({
                customerUid: "customer-1"
            }));
            expect(warnSpy).toHaveBeenCalled();
        } finally {
            warnSpy.mockRestore();
        }
    });

    test("createOrderDirectly rejects missing Firestore helpers", async () => {
        await expect(
            customerCheckout.createOrderDirectly({
                db: { kind: "db" },
                firestoreFns: {},
                context: {
                    vendorUid: "vendor-1",
                    vendorName: "Campus Bites",
                    vendorItems: [createCartItem()],
                    itemCount: 2,
                    subtotal: 110
                },
                currentUser: {
                    uid: "customer-1"
                }
            })
        ).rejects.toThrow("Firestore functions not available.");
    });

    test("placeOrder does not create vendor orders when checkout session creation cannot be saved", async () => {
        seedCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 1, price: 5 })
        ]);

        const addDoc = jest.fn();
        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns: {
                collection: jest.fn((db, name) => ({ db, name })),
                addDoc,
                serverTimestamp: jest.fn(() => "server-time")
            },
            orderService: {
                createOrders: jest.fn(async () => ({
                    success: false,
                    error: {
                        code: "orders/write-failed",
                        message: "Shared order service failed."
                    }
                }))
            },
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            }
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("checkout/create-unavailable");
        expect(addDoc).not.toHaveBeenCalled();
        expect(JSON.parse(window.localStorage.getItem(customerCheckout.CART_STORAGE_KEY))).toHaveLength(2);
    });

    test("placeOrder returns checkout payment errors and leaves the cart untouched", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites" })
        ]);

        const firestoreFns = createCheckoutFirestoreFns();
        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns,
            checkoutId: "checkout-failed-payment",
            initializePaymentCallable: jest.fn(async () => ({
                data: {
                    success: false,
                    error: {
                        code: "payments/failed",
                        message: "Payment service failed."
                    }
                }
            })),
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            }
        });

        expect(result.success).toBe(false);
        expect(result.error).toEqual({
            code: "payments/failed",
            message: "Payment service failed."
        });
        expect(firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(firestoreFns.updateDoc).toHaveBeenCalledTimes(2);
        expect(JSON.parse(window.localStorage.getItem(customerCheckout.CART_STORAGE_KEY))).toHaveLength(1);
    });

    test("init renders vendor checkout state and wires the back button", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 })
        ]);

        const result = await customerCheckout.init({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            containerSelector: "#checkout-items-container",
            summarySelector: "#checkout-summary",
            statusSelector: "#checkout-status",
            vendorNameSelector: "#checkout-vendor-heading",
            notesSelector: "#checkout-notes",
            placeOrderButtonSelector: "#place-order-button",
            backButtonHostSelector: "#checkout-back-button-host"
        });

        expect(result.success).toBe(true);
        expect(result.context.vendorItems).toHaveLength(1);
        expect(dom.vendorHeading.textContent).toBe("Campus Bites");
        expect(dom.backButtonHost.querySelector(".checkout-back-button")).not.toBeNull();
        expect(dom.summarySection.textContent).toContain("Customer Total: R20.00");
    });

    test("place order button updates the status after a successful click", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 1, price: 10 })
        ]);

        await customerCheckout.init({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            },
            db: { kind: "db" },
            firestoreFns: createCheckoutFirestoreFns(),
            checkoutId: "checkout-click",
            initializePaymentCallable: jest.fn(async () => ({
                data: {
                    success: true,
                    authorizationUrl: "https://checkout.paystack.com/test",
                    accessCode: "access-code",
                    reference: "paystack-ref"
                }
            })),
            navigateToPayment: jest.fn(),
            containerSelector: "#checkout-items-container",
            summarySelector: "#checkout-summary",
            statusSelector: "#checkout-status",
            vendorNameSelector: "#checkout-vendor-heading",
            notesSelector: "#checkout-notes",
            placeOrderButtonSelector: "#place-order-button",
            backButtonHostSelector: "#checkout-back-button-host",
            sessionStatusSelector: "#checkout-session-status",
            resumePaymentButtonSelector: "#resume-payment-button",
            cancelCheckoutButtonSelector: "#cancel-checkout-button"
        });

        dom.notesInput.value = "No onions";
        dom.placeOrderButton.click();

        await new Promise(resolve => setTimeout(resolve, 0));
        await new Promise(resolve => setTimeout(resolve, 0));

        expect(dom.statusElement.textContent).toContain("Checkout saved");
        expect(dom.sessionStatusElement.textContent).toContain("Payment Pending");
        expect(dom.container.textContent).toContain("Burger");
    });

    test("setupEventListeners reports empty checkout clicks immediately", () => {
        customerCheckout.setupEventListeners({
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            vendorNameHeading: dom.vendorHeading,
            placeOrderButton: dom.placeOrderButton,
            backButtonHost: dom.backButtonHost
        });

        dom.placeOrderButton.click();

        expect(dom.statusElement.textContent).toContain("No cart items are available for this vendor.");
        expect(dom.placeOrderButton.disabled).toBe(true);
        expect(dom.backButtonHost.querySelector(".checkout-back-button")).not.toBeNull();
    });

    test("init returns an error when the checkout container cannot be found", async () => {
        document.body.innerHTML = "<p>Missing checkout container</p>";

        const result = await customerCheckout.init({
            containerSelector: "#checkout-items-container"
        });

        expect(result).toEqual({
            success: false,
            error: "Checkout container not found."
        });
    });

    test("init reuses the in-flight initialization promise", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 1, price: 10 })
        ]);

        const initOptions = {
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            containerSelector: "#checkout-items-container",
            summarySelector: "#checkout-summary",
            statusSelector: "#checkout-status",
            vendorNameSelector: "#checkout-vendor-heading",
            notesSelector: "#checkout-notes",
            placeOrderButtonSelector: "#place-order-button",
            backButtonHostSelector: "#checkout-back-button-host"
        };

        const firstInit = customerCheckout.init(initOptions);
        const secondInit = customerCheckout.init(initOptions);
        const [firstResult, secondResult] = await Promise.all([firstInit, secondInit]);

        expect(firstResult).toEqual(secondResult);
        expect(firstResult.success).toBe(true);
        expect(dom.backButtonHost.querySelectorAll(".checkout-back-button")).toHaveLength(1);
    });
});

describe("customer/order-management/checkout.js - semantic source audit", () => {
    test("touched checkout public files avoid div and span semantics", () => {
        const files = [
            "public/customer/order-management/checkout.html",
            "public/customer/order-management/checkout.js"
        ];

        files.forEach((relativePath) => {
            const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
            expect(source).not.toMatch(/<\/?(div|span)\b/i);
            expect(source).not.toMatch(/createElement\(["'](div|span)["']\)/i);
        });
    });
});
