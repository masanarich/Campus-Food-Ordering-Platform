/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeLowerText,
    parsePrice,
    formatPrice,
    normalizeAvailability,
    normalizeTagList,
    formatTagList,
    normalizeProductRecord,
    validateProduct,
    toProduct,
    clearFileInput,
    createVendorProductsPage
} = require("../../public/vendor/products.js");

function createMockSnapshot(records) {
    return {
        forEach(callback) {
            records.forEach(function eachRecord(record, index) {
                callback({
                    id: record.id || `product-${index + 1}`,
                    data() {
                        return record;
                    }
                });
            });
        }
    };
}

function createDom() {
    document.body.innerHTML = `
        <main>
            <section>
                <p id="products-status"></p>
                <p id="products-note"></p>
                <button id="back-button" type="button">Back</button>
                <button id="reset-editor-button" type="button">New</button>
                <output id="products-total-count">0</output>
                <output id="products-available-count">0</output>
                <output id="products-sold-out-count">0</output>
                <output id="products-photo-count">0</output>
            </section>

            <section>
                <form id="products-form">
                    <input id="product-id" type="hidden">
                    <input id="product-name" type="text">
                    <p id="product-name-error" hidden></p>
                    <input id="product-category" type="text">
                    <p id="product-category-error" hidden></p>
                    <textarea id="product-description"></textarea>
                    <p id="product-description-error" hidden></p>
                    <input id="product-price" type="number">
                    <p id="product-price-error" hidden></p>
                    <input id="product-photo-file" type="file">
                    <select id="product-availability">
                        <option value="available">Available</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                    <p id="product-availability-error" hidden></p>
                    <input id="product-dietary-tags" type="text">
                    <p id="product-dietary-tags-error" hidden></p>
                    <input id="product-allergen-tags" type="text">
                    <p id="product-allergen-tags-error" hidden></p>
                    <input id="product-sold-out" type="checkbox">
                    <button id="save-product-button" type="submit">Save</button>
                    <button id="clear-product-button" type="reset">Clear</button>
                    <button id="delete-product-button" type="button" hidden>Delete</button>
                    <button id="preview-product-photo-button" type="button">Preview</button>
                    <button id="remove-product-photo-button" type="button">Remove</button>
                </form>
            </section>

            <section>
                <div id="editing-state-pill"></div>
                <output id="product-name-output"></output>
                <output id="product-category-output"></output>
                <output id="product-description-output"></output>
                <output id="product-price-output"></output>
                <output id="product-availability-output"></output>
                <output id="product-sold-out-output"></output>
                <output id="product-dietary-tags-output"></output>
                <output id="product-allergen-tags-output"></output>
                <img id="product-photo-preview" alt="preview" hidden>
                <p id="product-photo-empty-state"></p>
            </section>

            <section>
                <input id="products-search" type="search">
                <p id="products-empty-state"></p>
                <ul id="products-list"></ul>
            </section>
        </main>
    `;
}

function buildDependencies(options = {}) {
    const products =
        options.products ||
        [
            {
                id: "item-1",
                vendorUid: "vendor-1",
                name: "Chicken Burger",
                category: "Burgers",
                description: "A juicy chicken burger with chips.",
                price: 55,
                photoDataUrl: "data:image/png;base64,one",
                availability: "available",
                soldOut: false,
                dietaryTags: ["halal"],
                allergenTags: ["gluten"]
            },
            {
                id: "item-2",
                vendorUid: "vendor-1",
                name: "Strawberry Shake",
                category: "Drinks",
                description: "A creamy strawberry milkshake.",
                price: 30,
                photoDataUrl: "",
                availability: "available",
                soldOut: true,
                dietaryTags: ["vegetarian"],
                allergenTags: ["dairy"]
            }
        ];

    const authService = {
        getCurrentUser: jest.fn(() => options.currentUser === undefined ? { uid: "vendor-1" } : options.currentUser),
        getCurrentUserProfile: jest.fn(async () => options.currentProfile === undefined
            ? { uid: "vendor-1", vendorStatus: "approved", accountStatus: "active", isAdmin: false }
            : options.currentProfile)
    };

    const authUtils = {
        normaliseUserData: jest.fn((profile) => ({
            uid: profile.uid || "",
            vendorStatus: profile.vendorStatus || "none",
            accountStatus: profile.accountStatus || "active",
            isAdmin: profile.isAdmin === true
        })),
        canAccessVendorPortal: jest.fn((profile) => {
            return profile && profile.accountStatus === "active" &&
                (profile.vendorStatus === "approved" || profile.isAdmin === true);
        })
    };

    const firestoreFns = {
        collection: jest.fn((db, ...segments) => ({ db, segments })),
        getDocs: jest.fn(async () => {
            if (options.getDocsError) {
                throw options.getDocsError;
            }

            return createMockSnapshot(products);
        }),
        addDoc: jest.fn(async () => {
            if (options.addDocError) {
                throw options.addDocError;
            }

            return { id: "created-1" };
        }),
        setDoc: jest.fn(async () => {
            if (options.setDocError) {
                throw options.setDocError;
            }

            return true;
        }),
        doc: jest.fn((db, ...segments) => ({ db, segments })),
        deleteDoc: jest.fn(async () => {
            if (options.deleteDocError) {
                throw options.deleteDocError;
            }

            return true;
        }),
        serverTimestamp: jest.fn(() => "SERVER_TIME")
    };

    return {
        authService,
        authUtils,
        db: { app: "test-db" },
        firestoreFns,
        navigate: jest.fn(),
        products
    };
}

function fillValidForm() {
    document.getElementById("product-name").value = "Chicken Burger";
    document.getElementById("product-category").value = "Burgers";
    document.getElementById("product-description").value = "A juicy chicken burger with chips.";
    document.getElementById("product-price").value = "55.00";
    document.getElementById("product-availability").value = "available";
    document.getElementById("product-dietary-tags").value = "halal, grilled";
    document.getElementById("product-allergen-tags").value = "gluten";
    document.getElementById("product-sold-out").checked = false;
}

describe("products.js helpers", () => {
    test("basic normalization helpers work", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
        expect(normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(parsePrice("45.50")).toBe(45.5);
        expect(parsePrice("abc")).toBeNull();
        expect(formatPrice(25)).toBe("R25.00");
        expect(formatPrice("bad")).toBe("-");
        expect(normalizeAvailability("unavailable")).toBe("unavailable");
        expect(normalizeAvailability("other")).toBe("available");
        expect(normalizeTagList("halal, vegan, halal")).toEqual(["halal", "vegan"]);
        expect(formatTagList(["halal", "vegan"])).toBe("halal, vegan");
        expect(formatTagList([])).toBe("-");
    });

    test("normalizeProductRecord and toProduct create proper menu records", () => {
        expect(
            normalizeProductRecord({
                id: "item-1",
                vendorUid: "vendor-1",
                name: " Burger ",
                category: " Burgers ",
                description: " Nice burger ",
                price: "45.00",
                photoURL: "data:image/png;base64,one",
                availability: "unavailable",
                soldOut: true,
                dietaryTags: "halal,grilled",
                allergenTags: ["gluten", "dairy"]
            }, "fallback")
        ).toEqual({
            id: "item-1",
            vendorUid: "vendor-1",
            name: "Burger",
            category: "Burgers",
            description: "Nice burger",
            price: 45,
            photoDataUrl: "data:image/png;base64,one",
            availability: "unavailable",
            soldOut: true,
            dietaryTags: ["halal", "grilled"],
            allergenTags: ["gluten", "dairy"],
            createdAt: null,
            updatedAt: null
        });

        expect(
            toProduct({
                productId: "abc",
                vendorUid: "vendor-1",
                name: "Burger",
                category: "Burgers",
                description: "A tasty burger with chips.",
                price: "45.00",
                photoDataUrl: "data:image/png;base64,one",
                availability: "unavailable",
                dietaryTags: "halal",
                allergenTags: "gluten",
                soldOut: true
            })
        ).toEqual(expect.objectContaining({
            id: "abc",
            vendorUid: "vendor-1",
            price: 45,
            soldOut: true
        }));
    });

    test("validateProduct returns errors for invalid fields", () => {
        const result = validateProduct({
            name: "",
            category: "x",
            description: "short",
            price: "-5"
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.name).toBe("Please enter the item name.");
        expect(result.errors.category).toBe("Please use a longer category name.");
        expect(result.errors.description).toBe("Please enter a longer item description.");
        expect(result.errors.price).toBe("Please enter a valid price of R0.00 or more.");
    });

    test("clearFileInput clears a file input safely", () => {
        const input = document.createElement("input");
        input.type = "file";
        clearFileInput(input);
        expect(input.value).toBe("");
    });
});

describe("createVendorProductsPage", () => {
    let page;
    let deps;
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        deps = buildDependencies();
        page = createVendorProductsPage(deps);
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
        jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
            callback();
            return 0;
        });
    });

    afterEach(() => {
        jest.restoreAllMocks();
        if (consoleErrorSpy) {
            consoleErrorSpy.mockRestore();
        }
    });

    test("initializeProductsPage loads firestore menu items and stats", async () => {
        const result = await page.initializeProductsPage();

        expect(result.success).toBe(true);
        expect(deps.firestoreFns.collection).toHaveBeenCalledWith(deps.db, "users", "vendor-1", "menuItems");
        expect(deps.firestoreFns.getDocs).toHaveBeenCalled();
        expect(document.getElementById("products-total-count").textContent).toBe("2");
        expect(document.getElementById("products-available-count").textContent).toBe("1");
        expect(document.getElementById("products-sold-out-count").textContent).toBe("1");
        expect(document.getElementById("products-photo-count").textContent).toBe("1");
        expect(document.getElementById("products-list").textContent).toContain("Chicken Burger");
        expect(document.getElementById("products-status").textContent).toBe("Menu workspace ready.");
    });

    test("saveCurrentProduct shows validation errors for invalid form", async () => {
        await page.initializeProductsPage();

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(false);
        expect(document.getElementById("product-name-error").textContent).toBe("Please enter the item name.");
        expect(document.getElementById("products-status").textContent).toBe("Please enter the item name.");
    });

    test("saveCurrentProduct creates a new firestore menu item", async () => {
        await page.initializeProductsPage();
        fillValidForm();

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(true);
        expect(result.action).toBe("create");
        expect(deps.firestoreFns.addDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems"] },
            expect.objectContaining({
                vendorUid: "vendor-1",
                name: "Chicken Burger",
                category: "Burgers",
                description: "A juicy chicken burger with chips.",
                price: 55,
                photoDataUrl: "",
                availability: "available",
                soldOut: false,
                dietaryTags: ["halal", "grilled"],
                allergenTags: ["gluten"],
                createdAt: "SERVER_TIME",
                updatedAt: "SERVER_TIME"
            })
        );
        expect(document.getElementById("products-status").textContent).toBe("Menu item created successfully.");
    });

    test("editing a product fills the form and updates with setDoc", async () => {
        await page.initializeProductsPage();

        page.editProductById("item-1");
        expect(document.getElementById("product-name").value).toBe("Chicken Burger");
        document.getElementById("product-price").value = "60.00";

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(true);
        expect(result.action).toBe("update");
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems", "item-1"] },
            expect.objectContaining({
                name: "Chicken Burger",
                price: 60,
                updatedAt: "SERVER_TIME"
            }),
            { merge: true }
        );
    });

    test("deleteCurrentProduct deletes the selected menu item", async () => {
        await page.initializeProductsPage();

        page.editProductById("item-2");
        const result = await page.deleteCurrentProduct();

        expect(result.success).toBe(true);
        expect(deps.firestoreFns.deleteDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems", "item-2"] }
        );
        expect(document.getElementById("products-status").textContent).toBe("Menu item deleted successfully.");
    });

    test("removeSelectedPhoto clears the preview state", async () => {
        await page.initializeProductsPage();
        page.state.selectedPhotoDataUrl = "data:image/png;base64,one";
        const result = page.removeSelectedPhoto();

        expect(result.success).toBe(true);
        expect(page.state.selectedPhotoDataUrl).toBe("");
        expect(document.getElementById("products-status").textContent).toBe("Product photo removed.");
    });

    test("search filters the rendered menu items", async () => {
        await page.initializeProductsPage();

        const search = document.getElementById("products-search");
        search.value = "milkshake";
        search.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("products-list").textContent).toContain("Strawberry Shake");
        expect(document.getElementById("products-list").textContent).not.toContain("Chicken Burger");
    });

    test("loadProducts failure sets error status", async () => {
        deps = buildDependencies({ getDocsError: new Error("Firestore failed") });
        page = createVendorProductsPage(deps);

        const result = await page.initializeProductsPage();

        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Failed to load menu items.");
    });

    test("save failures set error status", async () => {
        deps = buildDependencies({ addDocError: new Error("Add failed") });
        page = createVendorProductsPage(deps);

        await page.initializeProductsPage();
        fillValidForm();

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Failed to save the menu item.");
    });

    test("vendor access guard blocks signed out or unauthorized users", async () => {
        deps = buildDependencies({ currentUser: null });
        page = createVendorProductsPage(deps);

        await page.initializeProductsPage();
        expect(deps.navigate).toHaveBeenCalledWith("../authentication/login.html");

        deps = buildDependencies({
            currentProfile: {
                uid: "vendor-1",
                vendorStatus: "none",
                accountStatus: "active",
                isAdmin: false
            }
        });
        page = createVendorProductsPage(deps);
        await page.initializeProductsPage();
        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });
});
