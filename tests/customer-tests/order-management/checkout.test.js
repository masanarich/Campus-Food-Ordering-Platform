/**
 * @jest-environment jsdom
 */

const customerCheckout = require("../../../public/customer/order-management/checkout.js");

function createCartItem(overrides = {}) {
    return {
        menuItemId: "item-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        name: "Burger",
        category: "Meals",
        price: 55,
        quantity: 2,
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
        <textarea id="checkout-notes"></textarea>
        <button id="place-order-button" type="button">Place Order</button>
    `;

    return {
        backButtonHost: document.getElementById("checkout-back-button-host"),
        statusElement: document.getElementById("checkout-status"),
        vendorHeading: document.getElementById("checkout-vendor-heading"),
        container: document.getElementById("checkout-items-container"),
        summarySection: document.getElementById("checkout-summary"),
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
    delete window.orderService;
    delete global.orderService;
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
        expect(article.textContent).toContain("Unit Price: R15.00");
        expect(article.textContent).toContain("Line Total: R45.00");
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
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1" }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-1" })
        ], dom.container);

        expect(dom.container.querySelectorAll(".checkout-item-card")).toHaveLength(2);
    });

    test("renderCheckoutSummary shows vendor, items, and total", () => {
        customerCheckout.renderCheckoutSummary({
            vendorName: "Campus Bites",
            itemCount: 3,
            subtotal: 75
        }, dom.summarySection);

        expect(dom.summarySection.textContent).toContain("Vendor: Campus Bites");
        expect(dom.summarySection.textContent).toContain("Items: 3");
        expect(dom.summarySection.textContent).toContain("Total: R75.00");
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
                uid: "customer-1"
            },
            db: { kind: "db" },
            firestoreFns: {}
        });

        expect(noDbResult.success).toBe(false);
        expect(noDbResult.error.code).toBe("checkout/no-db");
        expect(noFirestoreResult.success).toBe(false);
        expect(noFirestoreResult.error.code).toBe("checkout/no-firestore-fns");
    });

    test("placeOrder submits through orderService and removes ordered vendor items from cart", async () => {
        seedCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 1, price: 5 })
        ]);

        const createOrders = jest.fn(async () => ({
            success: true,
            orders: [{ orderId: "order-1" }]
        }));

        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns: { doc: jest.fn(), setDoc: jest.fn() },
            orderService: { createOrders },
            currentUser: {
                uid: "customer-1",
                displayName: "Ama",
                email: "ama@example.com"
            },
            orderNotes: "Please prepare quickly"
        });

        expect(result.success).toBe(true);
        expect(createOrders).toHaveBeenCalledWith(expect.objectContaining({
            notes: "Please prepare quickly"
        }));
        const remainingCart = JSON.parse(window.localStorage.getItem(customerCheckout.CART_STORAGE_KEY));
        expect(remainingCart).toHaveLength(1);
        expect(remainingCart[0].vendorUid).toBe("vendor-2");
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
                notes: "Please hurry"
            })
        );
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

    test("placeOrder falls back to direct Firestore creation when shared order creation fails", async () => {
        const warnSpy = jest.spyOn(console, "warn").mockImplementation(() => {});

        seedCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 1, price: 5 })
        ]);

        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns: {
                collection: jest.fn((db, name) => ({ db, name })),
                addDoc: jest.fn()
                    .mockResolvedValueOnce({ id: "order-7" })
                    .mockResolvedValueOnce({ id: "notification-1" })
                    .mockResolvedValueOnce({ id: "notification-2" }),
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

        expect(result.success).toBe(true);
        expect(result.source).toBe("direct-firestore");
        expect(JSON.parse(window.localStorage.getItem(customerCheckout.CART_STORAGE_KEY))).toHaveLength(1);

        warnSpy.mockRestore();
    });

    test("placeOrder returns the shared service error when no direct fallback exists", async () => {
        seedCart([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites" })
        ]);

        const result = await customerCheckout.placeOrder({
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            db: { kind: "db" },
            firestoreFns: { doc: jest.fn(), setDoc: jest.fn() },
            orderService: {
                createOrders: jest.fn(async () => ({
                    success: false,
                    error: {
                        code: "orders/failed",
                        message: "Service failed."
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
        expect(result.error).toEqual({
            code: "orders/failed",
            message: "Service failed."
        });
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
        expect(dom.summarySection.textContent).toContain("Total: R20.00");
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
            firestoreFns: { doc: jest.fn(), setDoc: jest.fn() },
            orderService: {
                createOrders: jest.fn(async () => ({
                    success: true,
                    orders: [{ orderId: "order-9" }]
                }))
            },
            containerSelector: "#checkout-items-container",
            summarySelector: "#checkout-summary",
            statusSelector: "#checkout-status",
            vendorNameSelector: "#checkout-vendor-heading",
            notesSelector: "#checkout-notes",
            placeOrderButtonSelector: "#place-order-button",
            backButtonHostSelector: "#checkout-back-button-host"
        });

        dom.notesInput.value = "No onions";
        dom.placeOrderButton.click();

        await new Promise(resolve => setTimeout(resolve, 0));

        expect(dom.statusElement.textContent).toContain("Order placed successfully");
        expect(dom.container.textContent).toContain("No cart items are available");
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
