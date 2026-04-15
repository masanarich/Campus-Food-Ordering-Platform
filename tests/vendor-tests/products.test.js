/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeLowerText,
    parsePrice,
    formatPrice,
    isValidPhotoUrl,
    normalizeAvailability,
    validateProduct,
    toProduct,
    createVendorProductsPage
} = require("../../public/vendor/products.js");

function createDom() {
    document.body.innerHTML = `
        <main>
            <section>
                <p id="products-status"></p>
                <p id="products-note"></p>
                <menu>
                    <li><button id="back-button" type="button">Back</button></li>
                </menu>
            </section>

            <section id="products-form-section">
                <form id="products-form">
                    <input id="product-id" type="hidden">

                    <input id="product-name" type="text">
                    <p id="product-name-error" hidden></p>

                    <textarea id="product-description"></textarea>
                    <p id="product-description-error" hidden></p>

                    <input id="product-price" type="number">
                    <p id="product-price-error" hidden></p>

                    <input id="product-photo" type="url">
                    <p id="product-photoUrl-error" hidden></p>

                    <select id="product-availability">
                        <option value="available">Available</option>
                        <option value="unavailable">Unavailable</option>
                    </select>
                    <p id="product-availability-error" hidden></p>

                    <input id="product-sold-out" type="checkbox">

                    <button id="save-product-button" type="submit">Save Product</button>
                    <button id="clear-product-button" type="reset">Clear Form</button>
                </form>
            </section>

            <section>
                <output id="product-name-output"></output>
                <output id="product-description-output"></output>
                <output id="product-price-output"></output>
                <output id="product-photo-output"></output>
                <output id="product-availability-output"></output>
                <output id="product-sold-out-output"></output>
            </section>

            <section>
                <p id="products-empty-state"></p>
                <ul id="products-list"></ul>
            </section>
        </main>
    `;
}

function createStorageMock() {
    const store = {};

    return {
        getItem: jest.fn((key) => Object.prototype.hasOwnProperty.call(store, key) ? store[key] : null),
        setItem: jest.fn((key, value) => {
            store[key] = String(value);
        }),
        removeItem: jest.fn((key) => {
            delete store[key];
        }),
        clear: jest.fn(() => {
            Object.keys(store).forEach((key) => delete store[key]);
        })
    };
}

function fillValidForm() {
    document.getElementById("product-name").value = "Chicken Burger";
    document.getElementById("product-description").value = "A juicy chicken burger with chips.";
    document.getElementById("product-price").value = "55.00";
    document.getElementById("product-photo").value = "https://example.com/burger.jpg";
    document.getElementById("product-availability").value = "available";
    document.getElementById("product-sold-out").checked = false;
}

describe("products.js helpers", () => {
    test("normalizeText trims strings", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
        expect(normalizeText(null)).toBe("");
    });

    test("normalizeLowerText lowercases text", () => {
        expect(normalizeLowerText("  HeLLo  ")).toBe("hello");
    });

    test("parsePrice parses valid values", () => {
        expect(parsePrice("45.50")).toBe(45.5);
        expect(parsePrice("0")).toBe(0);
        expect(parsePrice("abc")).toBeNull();
    });

    test("formatPrice formats prices correctly", () => {
        expect(formatPrice(25)).toBe("R25.00");
        expect(formatPrice("12.5")).toBe("R12.50");
        expect(formatPrice("bad")).toBe("-");
    });

    test("isValidPhotoUrl accepts blank and valid urls", () => {
        expect(isValidPhotoUrl("")).toBe(true);
        expect(isValidPhotoUrl("https://example.com/image.jpg")).toBe(true);
        expect(isValidPhotoUrl("http://example.com/image.jpg")).toBe(true);
        expect(isValidPhotoUrl("ftp://example.com/image.jpg")).toBe(false);
    });

    test("normalizeAvailability defaults to available", () => {
        expect(normalizeAvailability("available")).toBe("available");
        expect(normalizeAvailability("unavailable")).toBe("unavailable");
        expect(normalizeAvailability("other")).toBe("available");
    });

    test("validateProduct returns errors for invalid fields", () => {
        const result = validateProduct({
            name: "",
            description: "short",
            price: "-5",
            photoUrl: "bad-url"
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.name).toBe("Please enter the item name.");
        expect(result.errors.description).toBe("Please enter a longer item description.");
        expect(result.errors.price).toBe("Please enter a valid price of R0.00 or more.");
        expect(result.errors.photoUrl).toBe("Please enter a valid photo URL starting with http:// or https://");
    });

    test("validateProduct passes valid product data", () => {
        const result = validateProduct({
            name: "Burger",
            description: "A tasty burger with chips.",
            price: "45.00",
            photoUrl: "https://example.com/burger.jpg"
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("toProduct creates product object", () => {
        const result = toProduct({
            productId: "abc",
            name: "Burger",
            description: "A tasty burger with chips.",
            price: "45.00",
            photoUrl: "https://example.com/burger.jpg",
            availability: "unavailable",
            soldOut: true
        });

        expect(result).toEqual({
            id: "abc",
            name: "Burger",
            description: "A tasty burger with chips.",
            price: 45,
            photoUrl: "https://example.com/burger.jpg",
            availability: "unavailable",
            soldOut: true
        });
    });
});

describe("createVendorProductsPage", () => {
    let storage;
    let page;
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        storage = createStorageMock();
        page = createVendorProductsPage({ storage });

        jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
            callback();
            return 0;
        });

        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("initializeProductsPage loads with default messages", () => {
        const result = page.initializeProductsPage();

        expect(result.success).toBe(true);
        expect(document.getElementById("products-status").textContent)
            .toBe("Complete the form below to add a menu item.");
        expect(document.getElementById("products-note").textContent)
            .toBe("Add a new product or select an existing one to update it.");
        expect(document.getElementById("products-empty-state").hidden).toBe(false);
    });

    test("saveCurrentProduct shows validation errors for invalid form", () => {
        page.initializeProductsPage();

        document.getElementById("products-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(document.getElementById("products-status").textContent)
            .toBe("Please enter the item name.");
        expect(document.getElementById("product-name-error").textContent)
            .toBe("Please enter the item name.");
        expect(page.state.products).toHaveLength(0);
    });

    test("saveCurrentProduct creates a new product", () => {
        page.initializeProductsPage();
        fillValidForm();

        document.getElementById("products-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(page.state.products).toHaveLength(1);
        expect(page.state.products[0].name).toBe("Chicken Burger");
        expect(document.getElementById("products-status").textContent)
            .toBe("Product created successfully.");
        expect(document.getElementById("product-name-output").textContent).toBe("Chicken Burger");
        expect(document.getElementById("product-price-output").textContent).toBe("R55.00");
        expect(storage.setItem).toHaveBeenCalled();
    });

    test("saveCurrentProduct updates an existing product", () => {
        page.initializeProductsPage();
        fillValidForm();

        document.getElementById("products-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        const existingId = page.state.products[0].id;

        document.getElementById("product-id").value = existingId;
        document.getElementById("product-name").value = "Updated Burger";
        document.getElementById("product-description").value = "An updated burger with chips and sauce.";
        document.getElementById("product-price").value = "60.00";
        document.getElementById("product-photo").value = "https://example.com/updated.jpg";
        document.getElementById("product-availability").value = "unavailable";
        document.getElementById("product-sold-out").checked = true;

        document.getElementById("products-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        expect(page.state.products).toHaveLength(1);
        expect(page.state.products[0].id).toBe(existingId);
        expect(page.state.products[0].name).toBe("Updated Burger");
        expect(page.state.products[0].soldOut).toBe(true);
        expect(document.getElementById("products-status").textContent)
            .toBe("Product updated successfully.");
    });

    test("rendered product can be selected and loaded into form", () => {
        page.initializeProductsPage();
        fillValidForm();

        document.getElementById("products-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        const listButtons = document.querySelectorAll("#products-list button");
        expect(listButtons.length).toBe(1);

        listButtons[0].click();

        expect(document.getElementById("product-name").value).toBe("Chicken Burger");
        expect(document.getElementById("products-status").textContent)
            .toBe("Loaded product into the form for editing.");
    });

    test("live validation updates summary", () => {
        page.initializeProductsPage();

        const nameInput = document.getElementById("product-name");
        const descriptionInput = document.getElementById("product-description");
        const priceInput = document.getElementById("product-price");

        nameInput.value = "Wrap";
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));

        descriptionInput.value = "Tasty chicken wrap with sauce.";
        descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));

        priceInput.value = "35";
        priceInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("product-name-output").textContent).toBe("Wrap");
        expect(document.getElementById("product-description-output").textContent)
            .toBe("Tasty chicken wrap with sauce.");
        expect(document.getElementById("product-price-output").textContent).toBe("R35.00");
    });

    test("sold out checkbox updates summary", () => {
        page.initializeProductsPage();

        document.getElementById("product-sold-out").checked = true;
        document.getElementById("product-sold-out")
            .dispatchEvent(new Event("change", { bubbles: true }));

        expect(document.getElementById("product-sold-out-output").textContent).toBe("Yes");
    });

    test("reset clears form state and summary", () => {
        page.initializeProductsPage();
        fillValidForm();

        document.getElementById("products-form")
            .dispatchEvent(new Event("reset", { bubbles: true }));

        expect(document.getElementById("products-status").textContent)
            .toBe("Complete the form below to add a menu item.");
        expect(document.getElementById("products-note").textContent)
            .toBe("The form has been cleared.");
        expect(document.getElementById("product-name-output").textContent).toBe("-");
    });

    test("initializeProductsPage loads products from storage", () => {
        storage.getItem.mockReturnValue(JSON.stringify([
            {
                id: "p1",
                name: "Loaded Burger",
                description: "Loaded from storage.",
                price: 44,
                photoUrl: "https://example.com/loaded.jpg",
                availability: "available",
                soldOut: false
            }
        ]));

        page = createVendorProductsPage({ storage });
        page.initializeProductsPage();

        expect(page.state.products).toHaveLength(1);
        expect(document.querySelectorAll("#products-list button").length).toBe(1);
        expect(document.getElementById("products-empty-state").hidden).toBe(true);
    });

    test("initializeProductsPage handles broken storage json safely", () => {
        storage.getItem.mockReturnValue("not-json");

        page = createVendorProductsPage({ storage });
        page.initializeProductsPage();

        expect(page.state.products).toEqual([]);
        expect(document.getElementById("products-empty-state").hidden).toBe(false);
    });

    test("back button executes navigation code path", () => {
        page.initializeProductsPage();
        document.getElementById("back-button").click();
        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("global initializer attaches instance", () => {
        expect(typeof window.vendorProductsPage.initializeProductsPage).toBe("function");

        const result = window.vendorProductsPage.initializeProductsPage({ storage });

        expect(result.success).toBe(true);
        expect(window.vendorProductsPage.instance).toBeDefined();
    });
});