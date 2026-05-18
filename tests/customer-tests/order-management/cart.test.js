/**
 * @jest-environment jsdom
 */

const customerCart = require("../../../public/customer/order-management/cart.js");

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

function setCartStorage(items) {
    window.localStorage.setItem(
        customerCart.CART_STORAGE_KEY,
        JSON.stringify(items || [])
    );
}

function clearCartStorage() {
    window.localStorage.clear();
}

function createDOM() {
    document.body.innerHTML = `
        <section id="cart-back-button-host"></section>
        <p id="cart-status"></p>
        <section id="cart-items-container"></section>
        <section id="cart-summary"></section>
        <button id="clear-cart-button" type="button" class="cart-clear-button">Clear Cart</button>
        <a id="checkout-link" href="./checkout.html">Checkout</a>
        <a id="summary-checkout-link" href="./checkout.html">Go to Checkout</a>
    `;

    return {
        backButtonHost: document.getElementById("cart-back-button-host"),
        statusElement: document.getElementById("cart-status"),
        container: document.getElementById("cart-items-container"),
        summarySection: document.getElementById("cart-summary"),
        clearButton: document.getElementById("clear-cart-button"),
        checkoutLink: document.getElementById("checkout-link"),
        summaryCheckoutLink: document.getElementById("summary-checkout-link")
    };
}

describe("customer/order-management/cart.js - data helpers", () => {
    afterEach(() => {
        clearCartStorage();
        delete window.__campusFoodTestLocalStorage;
        delete global.__campusFoodTestLocalStorage;
    });

    test("getCart returns an empty array when storage is empty", () => {
        expect(customerCart.getCart()).toEqual([]);
    });

    test("getStorageArea prefers the test storage override", () => {
        const storage = {
            getItem: jest.fn(() => "[]"),
            setItem: jest.fn()
        };

        window.__campusFoodTestLocalStorage = storage;

        expect(customerCart.getStorageArea()).toBe(storage);
        expect(customerCart.getCart()).toEqual([]);
    });

    test("getCart and saveCart safely handle invalid storage", () => {
        const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);

        window.__campusFoodTestLocalStorage = {
            getItem: jest.fn(() => "{bad json"),
            setItem: jest.fn(() => {
                throw new Error("quota exceeded");
            })
        };

        expect(customerCart.getCart()).toEqual([]);
        expect(customerCart.saveCart([createCartItem()])).toBe(false);

        window.__campusFoodTestLocalStorage = {};

        expect(customerCart.saveCart([createCartItem()])).toBe(false);

        consoleSpy.mockRestore();
    });

    test("saveCart persists items to localStorage", () => {
        const cartItems = [createCartItem()];

        expect(customerCart.saveCart(cartItems)).toBe(true);
        expect(window.localStorage.getItem(customerCart.CART_STORAGE_KEY))
            .toBe(JSON.stringify(cartItems));
    });

    test("normalizeCartItem applies safe defaults", () => {
        const item = customerCart.normalizeCartItem({ vendorUid: "vendor-5" }, 3);

        expect(item.vendorName).toBe("Unknown Vendor");
        expect(item.name).toBe("Unknown Item");
        expect(item.price).toBe(0);
        expect(item.quantity).toBe(1);
        expect(item.itemKey).toBe("vendor-5::item-4");
    });

    test("groupCartItemsByVendor groups lines by vendor", () => {
        const groups = customerCart.groupCartItemsByVendor([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 1, price: 20 }),
            createCartItem({ menuItemId: "item-3", vendorUid: "vendor-2", vendorName: "Fresh Drinks", quantity: 3, price: 5 })
        ]);

        expect(groups).toHaveLength(2);
        expect(groups[0].vendorName).toBe("Campus Bites");
        expect(groups[0].itemCount).toBe(3);
        expect(groups[0].subtotal).toBe(40);
        expect(groups[1].vendorName).toBe("Fresh Drinks");
    });

    test("groupCartItemsByVendor sorts vendor names consistently", () => {
        const groups = customerCart.groupCartItemsByVendor([
            createCartItem({ vendorUid: "vendor-z", vendorName: "Zulu Meals" }),
            createCartItem({ vendorUid: "vendor-a", vendorName: "Alpha Cafe" })
        ]);

        expect(groups.map(group => group.vendorName)).toEqual(["Alpha Cafe", "Zulu Meals"]);
    });

    test("calculateCartSummary totals vendors, lines, items, and subtotal", () => {
        const summary = customerCart.calculateCartSummary([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", quantity: 1, price: 25 })
        ]);

        expect(summary.vendorCount).toBe(2);
        expect(summary.lineCount).toBe(2);
        expect(summary.itemCount).toBe(3);
        expect(summary.subtotal).toBe(45);
    });

    test("buildCheckoutLinkState enables direct checkout for one vendor only", () => {
        const oneVendorState = customerCart.buildCheckoutLinkState([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites" })
        ]);
        const multiVendorState = customerCart.buildCheckoutLinkState([
            createCartItem({ vendorUid: "vendor-1", vendorName: "Campus Bites" }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks" })
        ]);
        const emptyState = customerCart.buildCheckoutLinkState([]);

        expect(oneVendorState.enabled).toBe(true);
        expect(oneVendorState.href).toContain("vendorUid=vendor-1");
        expect(oneVendorState.href).toContain("vendorName=Campus+Bites");
        expect(multiVendorState.enabled).toBe(false);
        expect(multiVendorState.label).toBe("Choose Vendor Checkout");
        expect(emptyState.enabled).toBe(false);
        expect(emptyState.message).toContain("Add items");
    });

    test("updateItemQuantity updates only the matching item", () => {
        const updatedCart = customerCart.updateItemQuantity([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", quantity: 1 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-1", quantity: 4 })
        ], "vendor-1::item-2", 7);

        expect(updatedCart[0].quantity).toBe(1);
        expect(updatedCart[1].quantity).toBe(7);
    });

    test("removeItemFromCart removes the matching line", () => {
        const reducedCart = customerCart.removeItemFromCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1" }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2" })
        ], "vendor-1::item-1");

        expect(reducedCart).toHaveLength(1);
        expect(reducedCart[0].menuItemId).toBe("item-2");
    });
});

describe("customer/order-management/cart.js - rendering", () => {
    let dom;

    beforeEach(() => {
        clearCartStorage();
        dom = createDOM();
    });

    test("renderCart shows empty state when no items exist", () => {
        customerCart.renderCart([], dom.container);

        expect(dom.container.textContent).toContain("Your cart is empty");
    });

    test("renderCart shows vendor groups and item cards", () => {
        customerCart.renderCart([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites" }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks" })
        ], dom.container);

        expect(dom.container.querySelectorAll(".cart-vendor-group")).toHaveLength(2);
        expect(dom.container.querySelectorAll(".cart-item-card")).toHaveLength(2);
    });

    test("renderCartSummary renders summary text", () => {
        customerCart.renderCartSummary({
            vendorCount: 2,
            lineCount: 3,
            itemCount: 6,
            subtotal: 123.5
        }, dom.summarySection);

        expect(dom.summarySection.textContent).toContain("Vendors in Cart: 2");
        expect(dom.summarySection.textContent).toContain("Total Items: 6");
        expect(dom.summarySection.textContent).toContain("Subtotal: R123.50");
    });

    test("createBackButton falls back to home route", () => {
        const button = customerCart.createBackButton({ fallbackRoute: "../index.html" });

        expect(button.textContent).toBe("Back");
        expect(button.className).toContain("cart-back-button");
    });

    test("setStatusMessage and render helpers tolerate missing elements", () => {
        expect(() => customerCart.setStatusMessage(null, "No target")).not.toThrow();
        expect(() => customerCart.renderCart([], null)).not.toThrow();
        expect(() => customerCart.renderCartSummary({}, null)).not.toThrow();
        expect(() => customerCart.applyCheckoutLinkState(null, {})).not.toThrow();
    });

    test("renderCartSummary uses an empty fallback summary", () => {
        customerCart.renderCartSummary(null, dom.summarySection);

        expect(dom.summarySection.textContent).toContain("Lines in Cart: 0");
        expect(dom.summarySection.textContent).toContain("Subtotal: R0.00");
    });

    test("applyCheckoutLinkState writes disabled and ready link state", () => {
        customerCart.applyCheckoutLinkState(dom.checkoutLink, {
            enabled: false,
            href: "./checkout.html",
            label: "Choose Vendor Checkout",
            message: "Pick a vendor."
        });

        expect(dom.checkoutLink.getAttribute("aria-disabled")).toBe("true");
        expect(dom.checkoutLink.classList.contains("is-disabled")).toBe(true);
        expect(dom.checkoutLink.dataset.checkoutState).toBe("blocked");
        expect(dom.checkoutLink.textContent).toBe("Choose Vendor Checkout");

        customerCart.applyCheckoutLinkState(dom.checkoutLink, {
            enabled: true,
            href: "http://localhost/public/customer/order-management/checkout.html?vendorUid=vendor-1",
            label: "Checkout",
            message: "Ready."
        });

        expect(dom.checkoutLink.getAttribute("aria-disabled")).toBe("false");
        expect(dom.checkoutLink.classList.contains("is-disabled")).toBe(false);
        expect(dom.checkoutLink.href).toContain("vendorUid=vendor-1");
    });

    test("applyCheckoutLinkState falls back when state is missing", () => {
        customerCart.applyCheckoutLinkState(dom.checkoutLink);

        expect(dom.checkoutLink.getAttribute("aria-disabled")).toBe("true");
        expect(dom.checkoutLink.dataset.checkoutMessage).toContain("Add items");
    });
});

describe("customer/order-management/cart.js - interactions and init", () => {
    let dom;

    beforeEach(() => {
        clearCartStorage();
        dom = createDOM();
    });

    test("refreshCartView renders from persisted cart and updates checkout state", () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", quantity: 2, price: 10 }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-1", quantity: 1, price: 5 })
        ]);

        const result = customerCart.refreshCartView({
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        expect(result.summary.itemCount).toBe(3);
        expect(result.checkoutLinkState.enabled).toBe(true);
        expect(dom.statusElement.textContent).toContain("3 items ready for checkout");
        expect(dom.checkoutLink.getAttribute("aria-disabled")).toBe("false");
        expect(dom.checkoutLink.href).toContain("vendorUid=vendor-1");
        expect(dom.summaryCheckoutLink.href).toContain("vendorUid=vendor-1");
    });

    test("refreshCartView blocks generic checkout when cart contains multiple vendors", () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites" }),
            createCartItem({ menuItemId: "item-2", vendorUid: "vendor-2", vendorName: "Fresh Drinks" })
        ]);

        const result = customerCart.refreshCartView({
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        expect(result.checkoutLinkState.enabled).toBe(false);
        expect(dom.statusElement.textContent).toContain("Choose one vendor checkout below");
        expect(dom.checkoutLink.textContent).toBe("Choose Vendor Checkout");
        expect(dom.checkoutLink.getAttribute("aria-disabled")).toBe("true");
        expect(dom.summaryCheckoutLink.getAttribute("aria-disabled")).toBe("true");
        expect(dom.container.querySelectorAll(".cart-vendor-actions .button-primary")).toHaveLength(2);
    });

    test("handleCartInteraction removes an item and refreshes the DOM", () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1" })
        ]);

        customerCart.refreshCartView({
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        const removeButton = dom.container.querySelector(".cart-remove-button");
        const result = customerCart.handleCartInteraction({
            target: removeButton
        }, {
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        expect(result.action).toBe("remove");
        expect(customerCart.getCart()).toEqual([]);
        expect(dom.container.textContent).toContain("Your cart is empty");
    });

    test("handleCartInteraction updates quantity from the matching input", () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", quantity: 1 })
        ]);

        customerCart.refreshCartView({
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        const quantityInput = dom.container.querySelector(".cart-item-quantity-input");
        quantityInput.value = "5";
        const updateButton = dom.container.querySelector(".cart-update-button");

        const result = customerCart.handleCartInteraction({
            target: updateButton
        }, {
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        expect(result.action).toBe("update");
        expect(customerCart.getCart()[0].quantity).toBe(5);
    });

    test("handleCartInteraction handles clear buttons and unrelated events", () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1" })
        ]);

        const clearResult = customerCart.handleCartInteraction({
            target: dom.clearButton
        }, {
            container: dom.container,
            summarySection: dom.summarySection,
            statusElement: dom.statusElement,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink
        });

        expect(clearResult.action).toBe("clear");
        expect(customerCart.getCart()).toEqual([]);
        expect(customerCart.handleCartInteraction({ target: null })).toBeNull();
        expect(customerCart.handleCartInteraction({ target: document.createTextNode("x") })).toBeNull();
    });

    test("init renders cart content, summary, and back button host", async () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1", vendorName: "Campus Bites", quantity: 2, price: 10 })
        ]);

        const result = await customerCart.init({
            containerSelector: "#cart-items-container",
            summarySelector: "#cart-summary",
            statusSelector: "#cart-status",
            clearButtonSelector: "#clear-cart-button",
            checkoutLinkSelector: "#checkout-link",
            summaryCheckoutLinkSelector: "#summary-checkout-link",
            backButtonHostSelector: "#cart-back-button-host"
        });

        expect(result.success).toBe(true);
        expect(result.summary.itemCount).toBe(2);
        expect(dom.container.querySelectorAll(".cart-item-card")).toHaveLength(1);
        expect(dom.summarySection.textContent).toContain("Subtotal: R20.00");
        expect(dom.backButtonHost.querySelector(".cart-back-button")).not.toBeNull();
        expect(dom.summaryCheckoutLink.href).toContain("vendorUid=vendor-1");
    });

    test("init reports a missing cart container", async () => {
        document.body.innerHTML = "<p id=\"cart-status\"></p>";

        const result = await customerCart.init({
            containerSelector: "#missing-cart-container"
        });

        expect(result.success).toBe(false);
        expect(result.error).toContain("Cart container");
    });

    test("clear cart button empties the cart after init", async () => {
        setCartStorage([
            createCartItem({ menuItemId: "item-1", vendorUid: "vendor-1" })
        ]);

        await customerCart.init({
            containerSelector: "#cart-items-container",
            summarySelector: "#cart-summary",
            statusSelector: "#cart-status",
            clearButtonSelector: "#clear-cart-button",
            checkoutLinkSelector: "#checkout-link",
            summaryCheckoutLinkSelector: "#summary-checkout-link",
            backButtonHostSelector: "#cart-back-button-host"
        });

        dom.clearButton.click();

        expect(customerCart.getCart()).toEqual([]);
        expect(dom.container.textContent).toContain("Your cart is empty");
    });

    test("checkout guard prevents disabled generic checkout navigation", () => {
        const event = {
            target: dom.checkoutLink,
            preventDefault: jest.fn()
        };

        customerCart.applyCheckoutLinkState(dom.checkoutLink, {
            enabled: false,
            href: "./checkout.html",
            label: "Choose Vendor Checkout",
            message: "Choose a vendor checkout below."
        });

        const result = customerCart.handleCheckoutLinkClick(event, {
            statusElement: dom.statusElement
        });

        expect(result).toBe(false);
        expect(event.preventDefault).toHaveBeenCalled();
        expect(dom.statusElement.textContent).toContain("Choose a vendor");
    });

    test("checkout guard allows ready links and unknown targets", () => {
        const readyEvent = {
            target: dom.checkoutLink,
            preventDefault: jest.fn()
        };

        customerCart.applyCheckoutLinkState(dom.checkoutLink, {
            enabled: true,
            href: "./checkout.html?vendorUid=vendor-1",
            label: "Checkout",
            message: "Ready."
        });

        expect(customerCart.handleCheckoutLinkClick(readyEvent, {
            statusElement: dom.statusElement
        })).toBe(true);
        expect(readyEvent.preventDefault).not.toHaveBeenCalled();
        expect(customerCart.handleCheckoutLinkClick({ target: null })).toBe(true);
    });

    test("setupEventListeners binds checkout guards once", () => {
        customerCart.applyCheckoutLinkState(dom.checkoutLink, {
            enabled: false,
            href: "./checkout.html",
            label: "Choose Vendor Checkout",
            message: "Pick a vendor first."
        });

        customerCart.setupEventListeners({
            container: dom.container,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink,
            statusElement: dom.statusElement
        });
        customerCart.setupEventListeners({
            container: dom.container,
            checkoutLink: dom.checkoutLink,
            summaryCheckoutLink: dom.summaryCheckoutLink,
            statusElement: dom.statusElement
        });

        dom.checkoutLink.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(dom.checkoutLink.dataset.boundCheckoutGuard).toBe("true");
        expect(dom.statusElement.textContent).toContain("Pick a vendor first");
    });
});
