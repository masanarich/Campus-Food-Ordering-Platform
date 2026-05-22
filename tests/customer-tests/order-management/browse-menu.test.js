// tests/customer-tests/order-management/browse-menu.test.js

/**
 * @jest-environment jsdom
 */

const customerBrowseMenu = require("../../../public/customer/order-management/browse-menu.js");
const fs = require("fs");
const path = require("path");

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
    const mockItems = options.mockMenuItems || [];
    const mockDocs = mockItems.map((itemData) => ({
        id: itemData.menuItemId || itemData.id,
        data: () => itemData
    }));
    const querySnapshot = {
        forEach: jest.fn((callback) => {
            mockDocs.forEach(callback);
        }),
        docs: mockDocs
    };

    return {
        collection: jest.fn(() => ({ kind: "collection" })),
        doc: jest.fn(() => ({ kind: "doc" })),
        getDoc: jest.fn(async () => ({
            id: "student-1",
            exists: () => false,
            data: () => ({})
        })),
        getDocs: jest.fn(async () => querySnapshot),
        limit: jest.fn((count) => ({ kind: "limit", count })),
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
        <section id="recommendation-section">
            <p id="recommendation-status"></p>
            <section id="recommendation-container"></section>
        </section>
        <section id="menu-container"></section>
        <nav id="menu-pagination"></nav>
        <p id="browse-menu-status"></p>
        <p id="campus-recommendation-notice" hidden></p>
        <output id="cart-badge">0</output>
        <h2 id="vendor-name-heading">Menu</h2>
    `;

    return {
        recommendationSection: document.getElementById("recommendation-section"),
        recommendationContainer: document.getElementById("recommendation-container"),
        recommendationStatus: document.getElementById("recommendation-status"),
        container: document.getElementById("menu-container"),
        paginationContainer: document.getElementById("menu-pagination"),
        statusElement: document.getElementById("browse-menu-status"),
        campusRecommendationNotice: document.getElementById("campus-recommendation-notice"),
        cartBadge: document.getElementById("cart-badge"),
        vendorNameHeading: document.getElementById("vendor-name-heading")
    };
}

function clearBrowserStorage() {
    if (window.localStorage && typeof window.localStorage.clear === "function") {
        window.localStorage.clear();
    }
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
        expect(customerBrowseMenu.renderRecommendations).toBeDefined();
        expect(customerBrowseMenu.loadMenuRecommendations).toBeDefined();
        expect(customerBrowseMenu.applyRecommendedItemFocus).toBeDefined();
        expect(customerBrowseMenu.renderCampusRecommendationNotice).toBeDefined();
        expect(customerBrowseMenu.getVisiblePageNumbers).toBeDefined();
        expect(customerBrowseMenu.calculateMenuItemPricing).toBeDefined();
        expect(customerBrowseMenu.getCart).toBeDefined();
        expect(customerBrowseMenu.addToCart).toBeDefined();
        expect(customerBrowseMenu.getCartItemCount).toBeDefined();
    });

    test("all exported functions are functions", () => {
        expect(typeof customerBrowseMenu.init).toBe("function");
        expect(typeof customerBrowseMenu.fetchVendorMenu).toBe("function");
        expect(typeof customerBrowseMenu.addToCart).toBe("function");
    });

    test("touched browse menu public files avoid div and span semantics", () => {
        const files = [
            "public/customer/order-management/browse-menu.html",
            "public/customer/order-management/browse-menu.js"
        ];

        files.forEach((relativePath) => {
            const source = fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");
            expect(source).not.toMatch(/<\/?(div|span)\b/i);
            expect(source).not.toMatch(/createElement\(["'](div|span)["']\)/i);
        });
    });
});

// ==========================================
// TESTS: CART MANAGEMENT
// ==========================================

describe("customer/order-management/browse-menu.js - Cart Management", () => {
    beforeEach(() => {
        clearBrowserStorage();
    });

    afterEach(() => {
        clearBrowserStorage();
    });

    test("getCart returns empty array when no cart exists", () => {
        const cart = customerBrowseMenu.getCart();
        expect(cart).toEqual([]);
    });

    test("getCart returns parsed cart from localStorage", () => {
        const cartData = [createMockMenuItem()];
        window.localStorage.setItem("campus-food-cart", JSON.stringify(cartData));

        const cart = customerBrowseMenu.getCart();
        expect(cart).toHaveLength(1);
        expect(cart[0].name).toBe("Burger");
    });

    test("saveCart stores cart in localStorage", () => {
        const cart = [createMockMenuItem()];
        const result = customerBrowseMenu.saveCart(cart);

        expect(result).toBe(true);
        expect(window.localStorage.getItem("campus-food-cart")).toBe(JSON.stringify(cart));
    });

    test("addToCart adds new item to cart", () => {
        const item = createMockMenuItem();
        const result = customerBrowseMenu.addToCart(item, 2);

        expect(result.success).toBe(true);
        expect(result.cart).toHaveLength(1);
        expect(result.cart[0].quantity).toBe(2);
        expect(result.cart[0].name).toBe("Burger");
        expect(result.cart[0].vendorPrice).toBe(50);
        expect(result.cart[0].platformFee).toBe(5);
        expect(result.cart[0].customerPrice).toBe(55);
        expect(result.cart[0].price).toBe(55);
        expect(result.cart[0].dietary).toEqual(["halal"]);
        expect(result.cart[0].allergens).toEqual(["gluten"]);
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

    test("addToCart does not add the platform fee twice when customerPrice exists", () => {
        const item = createMockMenuItem({
            vendorPrice: 50,
            platformFee: 5,
            customerPrice: 55,
            price: 55
        });

        const result = customerBrowseMenu.addToCart(item, 1);

        expect(result.cart[0].vendorPrice).toBe(50);
        expect(result.cart[0].platformFee).toBe(5);
        expect(result.cart[0].customerPrice).toBe(55);
        expect(result.cart[0].price).toBe(55);
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
        const mockDb = { kind: "db" };

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            orderService,
            db: mockDb
        });

        expect(result.success).toBe(true);
        expect(result.menuItems).toHaveLength(1);
        expect(orderService.getVendorMenuItems).toHaveBeenCalledWith({
            vendorUid: "vendor-1",
            vendorName: "Campus Bites",
            db: mockDb,
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
        expect(firestoreFns.collection).toHaveBeenCalledWith(
            mockDb,
            "users",
            "vendor-1",
            "menuItems"
        );
        expect(firestoreFns.getDocs).toHaveBeenCalledWith({ kind: "collection" });
    });

    test("handles orderService error gracefully", async () => {
        const orderService = createMockOrderService({ shouldFail: true });
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems: [] });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            orderService,
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItems).toEqual([]);
        expect(result.count).toBe(0);
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
            menuItemId: "item-minimal",
            soldOut: false
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

    test("normalizes older vendor prices into customer prices with platform fee", async () => {
        const mockMenuItems = [createMockMenuItem({ price: 100 })];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItems[0].vendorPrice).toBe(100);
        expect(result.menuItems[0].platformFee).toBe(10);
        expect(result.menuItems[0].customerPrice).toBe(110);
        expect(result.menuItems[0].price).toBe(110);
    });

    test("keeps stored customer prices from newer product records", async () => {
        const mockMenuItems = [
            createMockMenuItem({
                vendorPrice: 100,
                platformFee: 10,
                customerPrice: 110,
                price: 110
            })
        ];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItems[0].vendorPrice).toBe(100);
        expect(result.menuItems[0].platformFee).toBe(10);
        expect(result.menuItems[0].customerPrice).toBe(110);
        expect(result.menuItems[0].price).toBe(110);
    });

    test("normalizes vendor allergenTags for customer display", async () => {
        const itemWithVendorTags = createMockMenuItem({
            allergens: undefined,
            allergenTags: ["nuts", "dairy"],
            dietaryTags: ["vegetarian"],
            dietary: undefined
        });

        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems: [itemWithVendorTags] });

        const result = await customerBrowseMenu.fetchVendorMenu({
            vendorUid: "vendor-1",
            db: mockDb,
            firestoreFns
        });

        expect(result.success).toBe(true);
        expect(result.menuItems[0].allergens).toEqual(["nuts", "dairy"]);
        expect(result.menuItems[0].dietary).toEqual(["vegetarian"]);
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
        expect(category.textContent).toContain("Category:");
        expect(category.querySelector(".menu-item-value").textContent).toBe("Meals");
        expect(category.querySelector(".menu-item-label").tagName).toBe("STRONG");
        expect(category.querySelector(".menu-item-value").tagName).toBe("OUTPUT");

        // Check price
        const price = card.querySelector(".menu-item-price-amount");
        expect(price.textContent).toBe("R55.00");
        expect(card.querySelector(".menu-item-price .menu-item-label").textContent).toBe("Price:");
        expect(card.querySelector(".menu-item-price-note").textContent).toBe("Includes 10% platform fee");
        expect(card.querySelector(".menu-item-price-note").tagName).toBe("SMALL");
        expect(card.querySelectorAll("span")).toHaveLength(0);

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
        expect(description.textContent).toContain("Item info:");
        expect(description.querySelector(".menu-item-value").textContent).toBe("Best burger ever");
    });

    test("shows dietary information when available", () => {
        const item = createMockMenuItem({ dietary: ["halal", "no-pork"] });
        const card = customerBrowseMenu.createMenuItemCard(item);

        const dietary = card.querySelector(".menu-item-dietary");
        expect(dietary).not.toBeNull();
        expect(dietary.textContent).toContain("Dietary info:");
        expect(dietary.querySelector(".menu-item-value").textContent).toBe("halal, no-pork");
    });

    test("shows allergen information when available", () => {
        const item = createMockMenuItem({ allergens: ["gluten", "nuts"] });
        const card = customerBrowseMenu.createMenuItemCard(item);

        const allergens = card.querySelector(".menu-item-allergens");
        expect(allergens).not.toBeNull();
        expect(allergens.textContent).toContain("Allergen info:");
        expect(allergens.querySelector(".menu-item-value").textContent).toBe("gluten, nuts");
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

    test("creates recommendation cards with explainable ranking details", () => {
        const card = customerBrowseMenu.createRecommendationCard({
            rank: 1,
            confidence: 0.82,
            item: createMockMenuItem({ name: "Halal Wrap" }),
            reasons: ["Matches your Halal preference.", "Similar to meals you ordered before."]
        });

        expect(card.className).toContain("recommended-menu-item-card");
        expect(card.querySelector(".recommendation-explanation")).not.toBeNull();
        expect(card.querySelector(".recommendation-confidence").textContent).toBe("High");
        expect(card.querySelector(".recommendation-reasons").textContent).toContain("Halal preference");
        expect(card.querySelector(".add-to-cart-button")).not.toBeNull();
        expect(card.querySelectorAll("span")).toHaveLength(0);
    });
});

// ==========================================
// TESTS: renderMenuItems
// ==========================================

describe("customer/order-management/browse-menu.js - renderMenuItems", () => {
    let container;
    let campusRecommendationNotice;

    beforeEach(() => {
        const elements = createDOMElements();
        container = elements.container;
        campusRecommendationNotice = elements.campusRecommendationNotice;
    });

    test("marks, pins, and explains campus-wide recommended items", () => {
        const items = [
            createMockMenuItem({ menuItemId: "regular", name: "Regular Burger", category: "Meals" }),
            createMockMenuItem({ menuItemId: "campus-pick", name: "Campus Curry", category: "Meals" })
        ];
        const focusResult = customerBrowseMenu.applyRecommendedItemFocus(items, "campus-pick");

        expect(focusResult.found).toBe(true);
        expect(focusResult.menuItems[0].menuItemId).toBe("campus-pick");
        expect(focusResult.menuItems[0].isCampusRecommended).toBe(true);
        expect(customerBrowseMenu.menuItemMatchesRecommendedId(items[1], "campus-pick")).toBe(true);

        customerBrowseMenu.renderCampusRecommendationNotice(
            campusRecommendationNotice,
            focusResult,
            "Campus Bites"
        );
        customerBrowseMenu.renderMenuItems(focusResult.menuItems, container);

        expect(campusRecommendationNotice.hidden).toBe(false);
        expect(campusRecommendationNotice.textContent).toContain("Campus Curry");
        expect(campusRecommendationNotice.getAttribute("data-state")).toBe("success");
        expect(container.querySelector(".campus-recommendation-focus")).not.toBeNull();
        expect(container.querySelectorAll(".campus-recommended-menu-item-card")).toHaveLength(1);
        expect(container.querySelector(".campus-recommendation-badge").textContent)
            .toBe("Campus-wide recommendation");
        expect(container.querySelectorAll(".menu-category .menu-item-card")).toHaveLength(1);
    });

    test("campus recommendation notice reports unavailable handoff items", () => {
        customerBrowseMenu.renderCampusRecommendationNotice(
            campusRecommendationNotice,
            {
                recommendedItemId: "missing-meal",
                found: false,
                focusedItems: []
            },
            "Campus Bites"
        );

        expect(campusRecommendationNotice.hidden).toBe(false);
        expect(campusRecommendationNotice.textContent).toContain("not available");
        expect(campusRecommendationNotice.getAttribute("data-state")).toBe("info");

        customerBrowseMenu.renderCampusRecommendationNotice(
            campusRecommendationNotice,
            {
                recommendedItemId: "",
                found: false,
                focusedItems: []
            },
            "Campus Bites"
        );

        expect(campusRecommendationNotice.hidden).toBe(true);
        expect(campusRecommendationNotice.textContent).toBe("");
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

describe("customer/order-management/browse-menu.js - recommendations", () => {
    let dom;

    beforeEach(() => {
        dom = createDOMElements();
    });

    test("renderRecommendations shows ranked cards with normal add-to-cart controls", () => {
        customerBrowseMenu.renderRecommendations(
            {
                status: "personalized",
                recommendations: [
                    {
                        rank: 1,
                        confidence: 0.7,
                        item: createMockMenuItem({
                            menuItemId: "safe-wrap",
                            name: "Safe Wrap",
                            dietary: ["halal"],
                            allergens: []
                        }),
                        reasons: ["You often order Meals."]
                    }
                ]
            },
            dom.recommendationContainer,
            dom.recommendationStatus
        );

        expect(dom.recommendationStatus.textContent).toContain("personalized recommendation");
        expect(dom.recommendationContainer.querySelectorAll(".recommended-menu-item-card")).toHaveLength(1);
        expect(dom.recommendationContainer.querySelector(".add-to-cart-button")).not.toBeNull();
    });

    test("renderRecommendations explains opt-out and empty states", () => {
        customerBrowseMenu.renderRecommendations(
            { status: "opted-out", recommendations: [] },
            dom.recommendationContainer,
            dom.recommendationStatus
        );

        expect(dom.recommendationContainer.textContent).toContain("disabled");
        expect(dom.recommendationStatus.getAttribute("data-state")).toBe("info");

        customerBrowseMenu.renderRecommendations(
            { status: "empty", recommendations: [] },
            dom.recommendationContainer,
            dom.recommendationStatus
        );

        expect(dom.recommendationContainer.textContent).toContain("Browse the full menu");
    });

    test("loadMenuRecommendations uses profile, order history, and restrictions", async () => {
        const recommendationQueries = {
            loadRecommendationContext: jest.fn(async () => ({
                success: true,
                profile: {
                    uid: "student-1",
                    dietaryPreferences: ["halal"],
                    allergenRestrictions: ["nuts"],
                    recommendationOptIn: true
                },
                orders: [
                    {
                        orderId: "order-1",
                        createdAt: new Date().toISOString(),
                        items: [
                            createMockMenuItem({
                                menuItemId: "old-meal",
                                category: "Meals",
                                dietary: ["halal"],
                                allergens: [],
                                quantity: 2
                            })
                        ]
                    }
                ],
                orderCount: 1
            }))
        };

        const result = await customerBrowseMenu.loadMenuRecommendations({
            menuItems: [
                createMockMenuItem({
                    menuItemId: "unsafe",
                    name: "Nut Dessert",
                    allergens: ["nuts"],
                    dietary: ["halal"]
                }),
                createMockMenuItem({
                    menuItemId: "safe",
                    name: "Halal Curry",
                    category: "Meals",
                    allergens: [],
                    dietary: ["halal"]
                })
            ],
            recommendationQueries,
            maxRecommendations: 3
        });

        expect(result.success).toBe(true);
        expect(result.recommendations.map((recommendation) => recommendation.item.menuItemId))
            .toEqual(["safe"]);
        expect(result.excluded.map((recommendation) => recommendation.item.menuItemId))
            .toEqual(["unsafe"]);
    });
});

// ==========================================
// TESTS: updateCartBadge
// ==========================================

describe("customer/order-management/browse-menu.js - updateCartBadge", () => {
    let badge;

    beforeEach(() => {
        clearBrowserStorage();

        const elements = createDOMElements();
        badge = elements.cartBadge;
    });

    afterEach(() => {
        clearBrowserStorage();
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
    beforeEach(() => {
        clearBrowserStorage();
        createDOMElements();
    });

    afterEach(() => {
        clearBrowserStorage();
    });

    test("initializes successfully with menu items", async () => {
        const mockMenuItems = [createMockMenuItem()];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns,
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites"
        });

        expect(result.success).toBe(true);
        expect(result.menuItemCount).toBe(1);
        expect(result.vendorUid).toBe("vendor-1");

        // Check rendered content
        const container = document.getElementById("menu-container");
        expect(container.querySelectorAll(".menu-item-card")).toHaveLength(1);
    });

    test("renders recommendations above the normal menu during init", async () => {
        const mockMenuItems = [
            createMockMenuItem({ menuItemId: "meal-1", name: "Halal Curry" }),
            createMockMenuItem({ menuItemId: "meal-2", name: "Fruit Cup", dietary: ["vegan"] })
        ];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });
        const recommendationQueries = {
            loadRecommendationContext: jest.fn(async () => ({
                success: true,
                profile: {
                    uid: "student-1",
                    dietaryPreferences: ["halal"],
                    recommendationOptIn: true
                },
                orders: [],
                orderCount: 0
            }))
        };

        const result = await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns,
            recommendationQueries,
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites"
        });

        const recommendationContainer = document.getElementById("recommendation-container");
        const menuContainer = document.getElementById("menu-container");

        expect(result.success).toBe(true);
        expect(result.recommendations).toHaveLength(2);
        expect(recommendationContainer.compareDocumentPosition(menuContainer) & Node.DOCUMENT_POSITION_FOLLOWING)
            .toBeTruthy();
        expect(recommendationContainer.querySelectorAll(".recommended-menu-item-card").length)
            .toBeGreaterThan(0);
        expect(recommendationContainer.querySelector(".add-to-cart-button")).not.toBeNull();
    });

    test("pins a campus-wide recommended item from the dashboard handoff", async () => {
        const mockMenuItems = [
            createMockMenuItem({ menuItemId: "regular-meal", name: "Regular Meal" }),
            createMockMenuItem({ menuItemId: "campus-pick", name: "Campus Curry" })
        ];
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns,
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites&recommendedItemId=campus-pick"
        });

        const notice = document.getElementById("campus-recommendation-notice");
        const container = document.getElementById("menu-container");

        expect(result.success).toBe(true);
        expect(result.recommendedItemId).toBe("campus-pick");
        expect(result.recommendedItemFound).toBe(true);
        expect(result.focusedRecommendationItems[0].name).toBe("Campus Curry");
        expect(result.menuItems[0].menuItemId).toBe("campus-pick");
        expect(notice.hidden).toBe(false);
        expect(notice.textContent).toContain("Campus Curry");
        expect(container.querySelector(".campus-recommendation-focus")).not.toBeNull();
        expect(container.querySelectorAll(".campus-recommended-menu-item-card")).toHaveLength(1);
    });

    test("returns error when no vendor UID provided", async () => {
        const result = await customerBrowseMenu.init({ search: "" });

        expect(result.success).toBe(false);
        expect(result.error).toContain("vendor UID");
    });

    test("sets vendor name in heading", async () => {
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems: [] });

        await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns,
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites"
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
            firestoreFns,
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites"
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

// ==========================================
// TESTS: Pagination
// ==========================================

describe("customer/order-management/browse-menu.js - Pagination helpers", () => {
    test("getTotalPages handles empty, partial, and full pages", () => {
        expect(customerBrowseMenu.getTotalPages(0, 12)).toBe(1);
        expect(customerBrowseMenu.getTotalPages(5, 12)).toBe(1);
        expect(customerBrowseMenu.getTotalPages(12, 12)).toBe(1);
        expect(customerBrowseMenu.getTotalPages(13, 12)).toBe(2);
        expect(customerBrowseMenu.getTotalPages(36, 12)).toBe(3);
    });

    test("paginateItems returns the slice for the active page", () => {
        const items = Array.from({ length: 25 }, function buildItem(_, index) {
            return { menuItemId: `item-${index + 1}`, name: `Item ${index + 1}` };
        });

        const firstPage = customerBrowseMenu.paginateItems(items, 1, 10);
        const secondPage = customerBrowseMenu.paginateItems(items, 2, 10);
        const thirdPage = customerBrowseMenu.paginateItems(items, 3, 10);

        expect(firstPage).toHaveLength(10);
        expect(firstPage[0].menuItemId).toBe("item-1");
        expect(secondPage).toHaveLength(10);
        expect(secondPage[0].menuItemId).toBe("item-11");
        expect(thirdPage).toHaveLength(5);
        expect(thirdPage[0].menuItemId).toBe("item-21");
    });

    test("paginateItems clamps out-of-range pages back into the valid range", () => {
        const items = Array.from({ length: 5 }, function buildItem(_, index) {
            return { menuItemId: `item-${index + 1}` };
        });

        expect(customerBrowseMenu.paginateItems(items, 0, 12)).toHaveLength(5);
        expect(customerBrowseMenu.paginateItems(items, 99, 12)).toHaveLength(5);
        expect(customerBrowseMenu.paginateItems(items, "not a number", 12)).toHaveLength(5);
    });

    test("clampPageNumber keeps page within [1, totalPages]", () => {
        expect(customerBrowseMenu.clampPageNumber(-3, 4)).toBe(1);
        expect(customerBrowseMenu.clampPageNumber(2, 4)).toBe(2);
        expect(customerBrowseMenu.clampPageNumber(99, 4)).toBe(4);
        expect(customerBrowseMenu.clampPageNumber("2", 4)).toBe(2);
    });

    test("getVisiblePageNumbers centers the current page when many pages exist", () => {
        expect(customerBrowseMenu.getVisiblePageNumbers(1, 8)).toEqual([1, 2, 3, 4, 5]);
        expect(customerBrowseMenu.getVisiblePageNumbers(4, 8)).toEqual([2, 3, 4, 5, 6]);
        expect(customerBrowseMenu.getVisiblePageNumbers(8, 8)).toEqual([4, 5, 6, 7, 8]);
    });
});

describe("customer/order-management/browse-menu.js - renderPagination", () => {
    let dom;

    beforeEach(() => {
        dom = createDOMElements();
    });

    test("renders only the indicator (no Prev/Next) when there is one page", () => {
        customerBrowseMenu.renderPagination(1, 1, dom.paginationContainer, jest.fn(), { totalItems: 4 });

        expect(dom.paginationContainer.querySelector(".menu-pagination-prev")).toBeNull();
        expect(dom.paginationContainer.querySelector(".menu-pagination-next")).toBeNull();

        const indicator = dom.paginationContainer.querySelector(".menu-pagination-indicator");
        expect(indicator).not.toBeNull();
        expect(indicator.textContent).toBe("Showing 4 items");
    });

    test("uses singular wording when there is exactly one item", () => {
        customerBrowseMenu.renderPagination(1, 1, dom.paginationContainer, jest.fn(), { totalItems: 1 });

        const indicator = dom.paginationContainer.querySelector(".menu-pagination-indicator");
        expect(indicator.textContent).toBe("Showing 1 item");
    });

    test("renders Previous/Next buttons and a page indicator for multi-page menus", () => {
        customerBrowseMenu.renderPagination(2, 5, dom.paginationContainer, jest.fn(), {
            totalItems: 43,
            pageSize: 10
        });

        const prev = dom.paginationContainer.querySelector(".menu-pagination-prev");
        const next = dom.paginationContainer.querySelector(".menu-pagination-next");
        const indicator = dom.paginationContainer.querySelector(".menu-pagination-indicator");
        const meta = dom.paginationContainer.querySelector(".menu-pagination-meta");
        const pageButtons = dom.paginationContainer.querySelectorAll(".menu-pagination-page");

        expect(prev).not.toBeNull();
        expect(next).not.toBeNull();
        expect(indicator.textContent).toBe("Showing 11-20 of 43 items");
        expect(meta.textContent).toBe("Page 2 of 5");
        expect(pageButtons).toHaveLength(5);
        expect(prev.disabled).toBe(false);
        expect(next.disabled).toBe(false);
    });

    test("disables Previous on the first page and Next on the last page", () => {
        customerBrowseMenu.renderPagination(1, 3, dom.paginationContainer, jest.fn());
        expect(dom.paginationContainer.querySelector(".menu-pagination-prev").disabled).toBe(true);
        expect(dom.paginationContainer.querySelector(".menu-pagination-next").disabled).toBe(false);

        customerBrowseMenu.renderPagination(3, 3, dom.paginationContainer, jest.fn());
        expect(dom.paginationContainer.querySelector(".menu-pagination-prev").disabled).toBe(false);
        expect(dom.paginationContainer.querySelector(".menu-pagination-next").disabled).toBe(true);
    });

    test("invokes onPageChange with the next/previous page", () => {
        const onPageChange = jest.fn();
        customerBrowseMenu.renderPagination(2, 4, dom.paginationContainer, onPageChange);

        dom.paginationContainer.querySelector(".menu-pagination-next").click();
        dom.paginationContainer.querySelector(".menu-pagination-prev").click();

        expect(onPageChange).toHaveBeenNthCalledWith(1, 3);
        expect(onPageChange).toHaveBeenNthCalledWith(2, 1);
    });
});

describe("customer/order-management/browse-menu.js - renderMenuPage", () => {
    let dom;

    beforeEach(() => {
        dom = createDOMElements();
    });

    test("renders only the current page's items and the matching pagination control", () => {
        const allItems = Array.from({ length: 25 }, function buildItem(_, index) {
            return createMockMenuItem({
                menuItemId: `item-${index + 1}`,
                id: `item-${index + 1}`,
                name: `Item ${index + 1}`,
                category: index % 2 === 0 ? "Meals" : "Drinks"
            });
        });

        const state = { allItems, page: 1, pageSize: 10 };
        customerBrowseMenu.renderMenuPage(state, dom.container, dom.paginationContainer);

        expect(dom.container.querySelectorAll(".menu-item-card")).toHaveLength(10);
        expect(dom.paginationContainer.querySelector(".menu-pagination-indicator").textContent)
            .toBe("Showing 1-10 of 25 items");
        expect(dom.paginationContainer.querySelector(".menu-pagination-meta").textContent)
            .toBe("Page 1 of 3");
    });

    test("clicking Next re-renders with the second page's items", () => {
        const allItems = Array.from({ length: 14 }, function buildItem(_, index) {
            return createMockMenuItem({
                menuItemId: `item-${index + 1}`,
                id: `item-${index + 1}`,
                name: `Item ${index + 1}`,
                category: "Meals"
            });
        });

        const state = { allItems, page: 1, pageSize: 12 };
        customerBrowseMenu.renderMenuPage(state, dom.container, dom.paginationContainer);

        expect(dom.container.querySelectorAll(".menu-item-card")).toHaveLength(12);

        dom.paginationContainer.querySelector(".menu-pagination-next").click();

        expect(state.page).toBe(2);
        expect(dom.container.querySelectorAll(".menu-item-card")).toHaveLength(2);
        expect(dom.container.textContent).toContain("Item 13");
        expect(dom.container.textContent).toContain("Item 14");
    });
});

describe("customer/order-management/browse-menu.js - init pagination", () => {
    beforeEach(() => {
        if (window.localStorage && typeof window.localStorage.clear === "function") {
            window.localStorage.clear();
        }
        createDOMElements();
    });

    test("renders only the page-size slice and exposes pagination details", async () => {
        const mockMenuItems = Array.from({ length: 25 }, function buildItem(_, index) {
            return {
                menuItemId: `item-${index + 1}`,
                id: `item-${index + 1}`,
                name: `Item ${index + 1}`,
                category: "Meals",
                price: 10 + index,
                available: true
            };
        });
        const mockDb = { kind: "db" };
        const firestoreFns = createFirestoreFns({ mockMenuItems });

        const result = await customerBrowseMenu.init({
            db: mockDb,
            firestoreFns,
            search: "?vendorUid=vendor-1&vendorName=Campus%20Bites",
            pageSize: 10
        });

        expect(result.success).toBe(true);
        expect(result.menuItemCount).toBe(25);
        expect(result.totalPages).toBe(3);
        expect(result.page).toBe(1);

        const container = document.getElementById("menu-container");
        const pagination = document.getElementById("menu-pagination");

        expect(container.querySelectorAll(".menu-item-card")).toHaveLength(10);
        expect(pagination.querySelector(".menu-pagination-indicator").textContent).toBe("Showing 1-10 of 25 items");
        expect(pagination.querySelector(".menu-pagination-meta").textContent).toBe("Page 1 of 3");
    });
});
