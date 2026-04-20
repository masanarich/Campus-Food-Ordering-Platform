// tests/customer-tests/order-management/browse-menu.test.js

/**
 * @jest-environment jsdom
 */

const customerBrowseMenu = require("../../../public/customer/order-management/browse-menu.js");

// ==========================================
// TEST UTILITIES
// ==========================================

function createMockMenuItem(overrides = {}) {
    return {
        menuItemId: "item-1",
        id: "item-1",
        vendorUid: "vendor-1",
        vendorName: "Campus Bites",
        name: "Burger",
        category: "Meals",
        description: "Delicious beef burger",
        price: 50,
        photoURL: "https://example.com/burger.jpg",
        available: true,
        allergens: ["gluten"],
        dietary: ["halal"],
        ...overrides
    };
}

function createFirestoreFns(options = {}) {
    const querySnapshot = {
        forEach: jest.fn((callback) => {
            const mockItems = options.mockMenuItems || [];
            mockItems.forEach((itemData) => {
                callback({
                    id: itemData.menuItemId || itemData.id,
                    data: () => itemData
                });
            });
        })
    };

    return {
        collection: jest.fn(() => ({ kind: "collection" })),
        getDocs: jest.fn(async () => querySnapshot),
        query: jest.fn(() => ({ kind: "query" })),
        where: jest.fn(() => ({ kind: "where" })),
        orderBy: jest.fn(() => ({ kind: "orderBy" }))
    };
}

function createMockOrderService(options = {}) {
    return {
        getVendorMenuItems: jest.fn(async () => {
            if (options.shouldFail) {
                throw new Error("Service error");
            }
            return {
                success: true,
                menuItems: options.mockMenuItems || [],
                count: (options.mockMenuItems || []).length
            };
        })
    };
}

function createDOMElements() {
    document.body.innerHTML = `
        <section id="menu-container"></section>
        <p id="browse-menu-status"></p>
        <output id="cart-badge">0</output>
        <h2 id="vendor-name-heading">Menu</h2>
    `;

    return {
        container: document.getElementById("menu-container"),
        statusElement: document.getElementById("browse-menu-status"),
        cartBadge: document.getElementById("cart-badge"),
        vendorNameHeading: document.getElementById("vendor-name-heading")
    };
}

// Create a single shared store that can be reset
const sharedStore = {};

function resetLocalStorageStore() {
    Object.keys(sharedStore).forEach(k => delete sharedStore[k]);
}

function createFreshLocalStorageMock() {
    const mockLocalStorage = {
        getItem: jest.fn((key) => {
            const value = sharedStore[key];
            // localStorage always returns strings or null
            return value === undefined ? null : String(value);
        }),
        setItem: jest.fn((key, value) => {
            // localStorage stores everything as strings
            sharedStore[key] = String(value);
        }),
        removeItem: jest.fn((key) => {
            delete sharedStore[key];
        }),
        clear: jest.fn(() => {
            Object.keys(sharedStore).forEach(k => delete sharedStore[k]);
        }),
        get length() {
            return Object.keys(sharedStore).length;
        },
        key: jest.fn((index) => {
            const keys = Object.keys(sharedStore);
            return keys[index] || null;
        })
    };

    return mockLocalStorage;
}

// ==========================================
// TESTS: MODULE STRUCTURE
// ==========================================

describe("customer/order-management/browse-menu.js - Module Structure", () => {
    test("exports all required functions", () => {
        expect(customerBrowseMenu.init).toBeDefined();
        expect(customerBrowseMenu.fetchVendorMenu).toBeDefined();
        expect(customerBrowseMenu.renderMenuItems).toBeDefined();
        expect(customerBrowseMenu.createMenuItemCard).toBeDefined();
        expect(customerBrowseMenu.getCart).toBeDefined();
        expect(customerBrowseMenu.addToCart).toBeDefined();
        expect(customerBrowseMenu.getCartItemCount).toBeDefined();
    });

    test("all exported functions are functions", () => {
        expect(typeof customerBrowseMenu.init).toBe("function");
        expect(typeof customerBrowseMenu.fetchVendorMenu).toBe("function");
        expect(typeof customerBrowseMenu.addToCart).toBe("function");
    });
});

// ==========================================
// TESTS: CART MANAGEMENT
// ==========================================

describe("customer/order-management/browse-menu.js - Cart Management", () => {
    beforeEach(() => {
        // Reset shared store and create fresh localStorage mock
        resetLocalStorageStore();
        global.localStorage = createFreshLocalStorageMock();
    });

    test("getCart returns empty array when no cart exists", () => {
        const cart = customerBrowseMenu.getCart();
        expect(cart).toEqual([]);
    });

    test("getCart returns parsed cart from localStorage", () => {
        const cartData = [createMockMenuItem()];
        global.localStorage.setItem("campus-food-cart", JSON.stringify(cartData));

        const cart = customerBrowseMenu.getCart();
        expect(cart).toHaveLength(1);
        expect(cart[0].name).toBe("Burger");
    });

    test("saveCart stores cart in localStorage", () => {
        const cart = [createMockMenuItem()];
        const result = customerBrowseMenu.saveCart(cart);

        expect(result).toBe(true);
        expect(global.localStorage.setItem).toHaveBeenCalledWith(
            "campus-food-cart",
            JSON.stringify(cart)
        );
    });

    test("addToCart adds new item to cart", () => {
        const item = createMockMenuItem();
        const result = customerBrowseMenu.addToCart(item, 2);

        expect(result.success).toBe(true);
        expect(result.cart).toHaveLength(1);
        expect(result.cart[0].quantity).toBe(2);
        expect(result.cart[0].name).toBe("Burger");
    });

    test("addToCart updates quantity for existing item", () => {
        const item = createMockMenuItem();

        // Add first time
        customerBrowseMenu.addToCart(item, 1);

        // Add again
        const result = customerBrowseMenu.addToCart(item, 2);

        expect(result.cart).toHaveLength(1);
        expect(result.cart[0].quantity).toBe(3);
    });

    test("getCartItemCount returns total quantity", () => {
        customerBrowseMenu.addToCart(createMockMenuItem({ menuItemId: "item-1" }), 2);
        customerBrowseMenu.addToCart(createMockMenuItem({ menuItemId: "item-2", name: "Pizza" }), 3);

        const count = customerBrowseMenu.getCartItemCount();
        expect(count).toBe(5);
    });

    test("getCartItemCount returns 0 for empty cart", () => {
        const count = customerBrowseMenu.getCartItemCount();
        expect(count).toBe(0);
    });
});

// ==========================================
// TESTS: fetchVendorMenu
// ==========================================

describe("customer/order-management/browse-menu.js - fetchVendorMenu", () => {
    test("returns error when vendorUid is not provided", async () => {
        const result = await customerBrowseMenu.fetchVendorMenu({});

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-vendor-uid");
    });

    test("uses orderService when available", async () => {
        const mockMenuItems = [createMockMenuItem()];
        const orderService = createMockOrderService({ mockMenuItems });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            orderService
        });

        expect(result.success).toBe(true);
        expect(result.menuItems).toHaveLength(1);
        expect(orderService.getVendorMenuItems).toHaveBeenCalledWith({
            vendorUid: "vendor-1",
            firestoreFns: {}
        });
    });

    test("falls back to direct Firestore query", async () => {
        const mockMenuItems = [createMockMenuItem()];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItems).toHaveLength(1);
        expect(firestoreFns.collection).toHaveBeenCalledWith(mockDb, "users/vendor-1/menuItems");
    });

    test("handles orderService error gracefully", async () => {
        const orderService = createMockOrderService({ shouldFail: true });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            orderService
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("fetch-error");
    });

    test("returns error when Firestore functions unavailable", async () => {
        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            firestoreFns: {}
        });

        expect(result.success).toBe(false);
        expect(result.error.code).toBe("no-firestore-fns");
    });

    test("normalizes menu item data", async () => {
        const incompleteItem = {
            menuItemId: "item-minimal"
            // Missing most fields
        };

        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems: [incompleteItem] });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItems[0].name).toBe("Unknown Item");
        expect(result.menuItems[0].category).toBe("Other");
        expect(result.menuItems[0].price).toBe(0);
    });
});

// ==========================================
// TESTS: createMenuItemCard
// ==========================================

describe("customer/order-management/browse-menu.js - createMenuItemCard", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("creates menu item card with all elements", () => {
        const item = createMockMenuItem();
        const card = customerBrowseMenu.createMenuItemCard(item);

        expect(card.tagName).toBe("ARTICLE");
        expect(card.className).toBe("menu-item-card");

        // Check image
        const img = card.querySelector("img.menu-item-image");
        expect(img).not.toBeNull();
        expect(img.src).toContain("burger.jpg");

        // Check name
        const name = card.querySelector("h3.menu-item-name");
        expect(name.textContent).toBe("Burger");

        // Check category
        const category = card.querySelector("p.menu-item-category");
        expect(category.textContent).toBe("Meals");

        // Check price
        const price = card.querySelector(".menu-item-price strong");
        expect(price.textContent).toBe("R50.00");

        // Check add to cart button
        const button = card.querySelector(".add-to-cart-button");
        expect(button).not.toBeNull();
        expect(button.textContent).toBe("Add to Cart");
    });

    test("shows description when available", () => {
        const item = createMockMenuItem({ description: "Best burger ever" });
        const card = customerBrowseMenu.createMenuItemCard(item);

        const description = card.querySelector(".menu-item-description");
        expect(description).not.toBeNull();
        expect(description.textContent).toBe("Best burger ever");
    });

    test("shows dietary information when available", () => {
        const item = createMockMenuItem({ dietary: ["halal", "no-pork"] });
        const card = customerBrowseMenu.createMenuItemCard(item);

        const dietary = card.querySelector(".menu-item-dietary");
        expect(dietary).not.toBeNull();
        expect(dietary.textContent).toBe("halal, no-pork");
    });

    test("shows unavailable message for unavailable items", () => {
        const item = createMockMenuItem({ available: false });
        const card = customerBrowseMenu.createMenuItemCard(item);

        expect(card.className).toContain("unavailable");

        const button = card.querySelector(".add-to-cart-button");
        expect(button).toBeNull();

        const unavailableMsg = card.querySelector(".unavailable-message");
        expect(unavailableMsg).not.toBeNull();
        expect(unavailableMsg.textContent).toContain("Unavailable");
    });

    test("includes quantity input for available items", () => {
        const item = createMockMenuItem();
        const card = customerBrowseMenu.createMenuItemCard(item);

        const quantityInput = card.querySelector(".quantity-input");
        expect(quantityInput).not.toBeNull();
        expect(quantityInput.type).toBe("number");
        expect(quantityInput.value).toBe("1");
        expect(quantityInput.min).toBe("1");
        expect(quantityInput.max).toBe("99");
    });
});

// ==========================================
// TESTS: renderMenuItems
// ==========================================

describe("customer/order-management/browse-menu.js - renderMenuItems", () => {
    let container;

    beforeEach(() => {
        const elements = createDOMElements();
        container = elements.container;
    });

    test("renders multiple menu items grouped by category", () => {
        const items = [
            createMockMenuItem({ menuItemId: "item-1", category: "Meals", name: "Burger" }),
            createMockMenuItem({ menuItemId: "item-2", category: "Meals", name: "Pizza" }),
            createMockMenuItem({ menuItemId: "item-3", category: "Drinks", name: "Juice" })
        ];

        customerBrowseMenu.renderMenuItems(items, container);

        const categories = container.querySelectorAll(".menu-category");
        expect(categories).toHaveLength(2); // Meals and Drinks

        const cards = container.querySelectorAll(".menu-item-card");
        expect(cards).toHaveLength(3);
    });

    test("displays empty state when no items", () => {
        customerBrowseMenu.renderMenuItems([], container);

        const message = container.querySelector(".empty-state-message");
        expect(message).not.toBeNull();
        expect(message.textContent).toContain("No menu items available");
    });

    test("clears existing content before rendering", () => {
        container.innerHTML = "<p>Old content</p>";

        const items = [createMockMenuItem()];
        customerBrowseMenu.renderMenuItems(items, container);

        expect(container.textContent).not.toContain("Old content");
        expect(container.querySelectorAll(".menu-item-card")).toHaveLength(1);
    });

    test("sorts categories alphabetically", () => {
        const items = [
            createMockMenuItem({ category: "Snacks" }),
            createMockMenuItem({ category: "Drinks" }),
            createMockMenuItem({ category: "Meals" })
        ];

        customerBrowseMenu.renderMenuItems(items, container);

        const categoryHeadings = container.querySelectorAll(".category-heading");
        expect(categoryHeadings[0].textContent).toBe("Drinks");
        expect(categoryHeadings[1].textContent).toBe("Meals");
        expect(categoryHeadings[2].textContent).toBe("Snacks");
    });
});

// ==========================================
// TESTS: updateCartBadge
// ==========================================

describe("customer/order-management/browse-menu.js - updateCartBadge", () => {
    let badge;

    beforeEach(() => {
        // Reset shared store and create fresh localStorage mock
        resetLocalStorageStore();
        global.localStorage = createFreshLocalStorageMock();

        const elements = createDOMElements();
        badge = elements.cartBadge;
    });

    test("shows badge with count when cart has items", () => {
        customerBrowseMenu.addToCart(createMockMenuItem(), 3);

        customerBrowseMenu.updateCartBadge(badge);

        expect(badge.textContent).toBe("3");
        expect(badge.style.display).toBe("inline-block");
    });

    test("hides badge when cart is empty", () => {
        customerBrowseMenu.updateCartBadge(badge);

        expect(badge.style.display).toBe("none");
    });
});

// ==========================================
// TESTS: init
// ==========================================

describe("customer/order-management/browse-menu.js - init", () => {
    let originalSearchDescriptor;

    beforeEach(() => {
        // Reset shared store and create fresh localStorage mock
        resetLocalStorageStore();
        global.localStorage = createFreshLocalStorageMock();

        createDOMElements();

        // Mock location.search using Object.defineProperty
        originalSearchDescriptor = Object.getOwnPropertyDescriptor(global.location, 'search');
        Object.defineProperty(global.location, 'search', {
            writable: true,
            configurable: true,
            value: "?vendorUid=vendor-1&vendorName=Campus%20Bites"
        });
    });

    afterEach(() => {
        // Restore original location.search
        if (originalSearchDescriptor) {
            Object.defineProperty(global.location, 'search', originalSearchDescriptor);
        }
    });

    test("initializes successfully with menu items", async () => {
        const mockMenuItems = [createMockMenuItem()];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItemCount).toBe(1);
        expect(result.vendorUid).toBe("vendor-1");

        // Check rendered content
        const container = document.getElementById("menu-container");
        expect(container.querySelectorAll(".menu-item-card")).toHaveLength(1);
    });

    test("returns error when no vendor UID provided", async () => {
        // Override location.search for this test
        global.location.search = "";

        const result = await customerBrowseMenu.init();

        expect(result.success).toBe(false);
        expect(result.error).toContain("vendor UID");
    });

    test("sets vendor name in heading", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems: [] });

        await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns
        });

        const heading = document.getElementById("vendor-name-heading");
        expect(heading.textContent).toBe("Campus Bites");
    });

    test("handles fetch error gracefully", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems: [] });
        firestoreFns.getDocs.mockRejectedValue(new Error("Network error"));

        const result = await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(false);

        const statusElement = document.getElementById("browse-menu-status");
        expect(statusElement.getAttribute("data-state")).toBe("error");
    });
});

// ==========================================
// TESTS: setStatusMessage & setLoadingState
// ==========================================

describe("customer/order-management/browse-menu.js - UI Helpers", () => {
    let statusElement;
    let container;

    beforeEach(() => {
        const elements = createDOMElements();
        statusElement = elements.statusElement;
        container = elements.container;
    });

    test("setStatusMessage updates element", () => {
        customerBrowseMenu.setStatusMessage(statusElement, "Success!", "success");

        expect(statusElement.textContent).toBe("Success!");
        expect(statusElement.getAttribute("data-state")).toBe("success");
    });

    test("setLoadingState shows loading message", () => {
        customerBrowseMenu.setLoadingState(container, true);

        expect(container.textContent).toContain("Loading menu...");
        expect(container.getAttribute("data-loading")).toBe("true");
    });

    test("setLoadingState removes loading attribute", () => {
        container.setAttribute("data-loading", "true");

        customerBrowseMenu.setLoadingState(container, false);

        expect(container.getAttribute("data-loading")).toBeNull();
    });
});
