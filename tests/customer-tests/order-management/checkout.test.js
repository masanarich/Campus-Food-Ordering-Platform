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

describe("customer/order-management/checkout.js - helpers", () => {
    beforeEach(() => {
        window.localStorage.clear();
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
});

describe("customer/order-management/checkout.js - rendering", () => {
    let dom;

    beforeEach(() => {
        window.localStorage.clear();
        dom = createDOM();
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
});
