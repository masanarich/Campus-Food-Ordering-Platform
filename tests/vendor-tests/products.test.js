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
    getDisplayPhotoUrl,
    normalizeProductRecord,
    validateProduct,
    toProduct,
    readFileAsDataURL,
    loadImageFromSource,
    fileToOptimizedDataURL,
    clearFileInput,
    createMenuItemId,
    buildMenuItemPhotoPath,
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
                <input id="products-search" type="search">
                <p id="products-empty-state"></p>
                <p id="products-results-meta"></p>
                <ul id="products-list"></ul>
            </section>
        </main>

        <dialog id="products-editor-modal">
            <form id="products-form">
                <h3 id="products-form-heading"></h3>
                <p id="products-form-subheading"></p>
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
                <button id="close-editor-button" type="button">Close</button>
            </form>
        </dialog>

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
    `;

    const dialog = document.getElementById("products-editor-modal");
    dialog.open = false;
    dialog.showModal = function showModal() {
        this.open = true;
        this.setAttribute("open", "open");
    };
    dialog.close = function close() {
        this.open = false;
        this.removeAttribute("open");
    };
}

function createMockFile(name, type, size = 1024) {
    const file = new File(["hello"], name, { type });
    Object.defineProperty(file, "size", {
        value: size,
        configurable: true
    });
    return file;
}

function attachFile(input, file) {
    Object.defineProperty(input, "files", {
        value: file ? [file] : [],
        configurable: true
    });
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
                photoURL: "https://files.example/item-1.jpg",
                photoPath: "menuItemPhotos/vendor-1/item-1/cover.jpg",
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
                photoURL: "",
                photoPath: "",
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

    const storageFns = {
        ref: jest.fn((storage, path) => ({ storage, path })),
        uploadBytes: jest.fn(async () => {
            if (options.uploadBytesError) {
                throw options.uploadBytesError;
            }

            return true;
        }),
        getDownloadURL: jest.fn(async (storageRef) => {
            if (options.getDownloadURLError) {
                throw options.getDownloadURLError;
            }

            return `https://storage.example/${storageRef.path}`;
        }),
        deleteObject: jest.fn(async () => {
            if (options.deleteObjectError) {
                throw options.deleteObjectError;
            }

            return true;
        })
    };

    return {
        authService,
        authUtils,
        db: { app: "test-db" },
        storage: { app: "test-storage" },
        firestoreFns,
        storageFns,
        navigate: jest.fn(),
        confirmAction: jest.fn(() => options.confirmDelete === undefined ? true : options.confirmDelete),
        createId: jest.fn(() => "created-1"),
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
                photoURL: "https://files.example/menu.jpg",
                photoPath: "menuItemPhotos/vendor-1/item-1/cover.jpg",
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
            photoURL: "https://files.example/menu.jpg",
            photoPath: "menuItemPhotos/vendor-1/item-1/cover.jpg",
            availability: "unavailable",
            soldOut: true,
            dietaryTags: ["halal", "grilled"],
            allergenTags: ["gluten", "dairy"],
            createdAt: null,
            updatedAt: null
        });

        expect(getDisplayPhotoUrl({ photoDataUrl: "data:image/png;base64,one" })).toBe("data:image/png;base64,one");
        expect(buildMenuItemPhotoPath("vendor-1", "item-1", { type: "image/png" }))
            .toBe("menuItemPhotos/vendor-1/item-1/cover.png");

        expect(
            toProduct({
                productId: "abc",
                vendorUid: "vendor-1",
                name: "Burger",
                category: "Burgers",
                description: "A tasty burger with chips.",
                price: "45.00",
                photoURL: "https://files.example/menu.jpg",
                photoPath: "menuItemPhotos/vendor-1/abc/cover.jpg",
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

    test("clearFileInput clears a file input safely and ids can be generated", () => {
        const input = document.createElement("input");
        input.type = "file";
        clearFileInput(input);
        expect(input.value).toBe("");
        expect(typeof createMenuItemId()).toBe("string");
    });

    test("readFileAsDataURL resolves and rejects using FileReader", async () => {
        const originalFileReader = global.FileReader;

        global.FileReader = class MockFileReader {
            readAsDataURL() {
                this.result = "data:image/jpeg;base64,mock";
                this.onload();
            }
        };

        await expect(readFileAsDataURL(createMockFile("burger.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,mock");

        global.FileReader = class ErrorFileReader {
            readAsDataURL() {
                this.onerror();
            }
        };

        await expect(readFileAsDataURL(createMockFile("broken.jpg", "image/jpeg")))
            .rejects.toThrow("Unable to read the selected image.");

        global.FileReader = originalFileReader;
    });

    test("loadImageFromSource resolves and rejects using Image", async () => {
        const originalImage = global.Image;

        global.Image = class MockImage {
            set src(value) {
                this._src = value;
                this.naturalWidth = 640;
                this.naturalHeight = 480;
                this.onload();
            }
        };

        const image = await loadImageFromSource("data:image/jpeg;base64,mock");
        expect(image.naturalWidth).toBe(640);

        global.Image = class ErrorImage {
            set src(value) {
                this._src = value;
                this.onerror();
            }
        };

        await expect(loadImageFromSource("broken"))
            .rejects.toThrow("Unable to process the selected image.");

        global.Image = originalImage;
    });

    test("fileToOptimizedDataURL returns optimized or original data when canvas context is unavailable", async () => {
        const originalFileReader = global.FileReader;
        const originalImage = global.Image;
        const originalCreateElement = document.createElement.bind(document);

        global.FileReader = class MockFileReader {
            readAsDataURL() {
                this.result = "data:image/jpeg;base64,original";
                this.onload();
            }
        };

        global.Image = class MockImage {
            set src(value) {
                this._src = value;
                this.naturalWidth = 800;
                this.naturalHeight = 400;
                this.onload();
            }
        };

        jest.spyOn(document, "createElement").mockImplementation((tagName) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => ({
                        drawImage: jest.fn()
                    }),
                    toDataURL: jest.fn(() => "data:image/jpeg;base64,optimized")
                };
            }

            return originalCreateElement(tagName);
        });

        await expect(fileToOptimizedDataURL(createMockFile("burger.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,optimized");

        document.createElement.mockRestore();
        jest.spyOn(document, "createElement").mockImplementation((tagName) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => null
                };
            }

            return originalCreateElement(tagName);
        });

        await expect(fileToOptimizedDataURL(createMockFile("burger.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,original");

        document.createElement.mockRestore();
        global.FileReader = originalFileReader;
        global.Image = originalImage;
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
        expect(document.getElementById("products-results-meta").textContent).toBe("Showing 2 of 2 items");
        expect(document.getElementById("products-list").textContent).toContain("Chicken Burger");
        expect(document.querySelector('button[data-action="edit-product"]')).not.toBeNull();
        expect(document.getElementById("products-status").textContent).toBe("Menu workspace ready.");
    });

    test("openCreateModal opens the dialog for new items", async () => {
        await page.initializeProductsPage();

        page.openCreateModal();

        expect(document.getElementById("products-editor-modal").open).toBe(true);
        expect(document.getElementById("products-form-heading").textContent).toBe("Create Menu Item");
        expect(document.getElementById("editing-state-pill").textContent).toBe("Creating New Item");
    });

    test("button flows open and close the editor modal", async () => {
        await page.initializeProductsPage();

        document.getElementById("reset-editor-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(document.getElementById("products-editor-modal").open).toBe(true);

        document.getElementById("close-editor-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(document.getElementById("products-editor-modal").open).toBe(false);
    });

    test("editProductById opens the dialog and fills the form", async () => {
        await page.initializeProductsPage();

        page.editProductById("item-1");

        expect(document.getElementById("products-editor-modal").open).toBe(true);
        expect(document.getElementById("product-name").value).toBe("Chicken Burger");
        expect(document.getElementById("product-price").value).toBe("55.00");
        expect(document.getElementById("editing-state-pill").textContent).toBe("Editing Existing Item");
        expect(document.getElementById("products-form-heading").textContent).toBe("Update Menu Item");
    });

    test("clicking an edit card button uses delegated list handling", async () => {
        await page.initializeProductsPage();

        document.querySelector('button[data-action="edit-product"]')
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));

        expect(document.getElementById("products-editor-modal").open).toBe(true);
        expect(document.getElementById("product-name").value).toBe("Chicken Burger");
    });

    test("saveCurrentProduct shows validation errors for invalid form", async () => {
        await page.initializeProductsPage();

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(false);
        expect(document.getElementById("product-name-error").textContent).toBe("Please enter the item name.");
        expect(document.getElementById("products-status").textContent).toBe("Please enter the item name.");
    });

    test("saveCurrentProduct creates a new firestore menu item and uploads its photo", async () => {
        await page.initializeProductsPage();
        page.openCreateModal();
        fillValidForm();
        attachFile(document.getElementById("product-photo-file"), createMockFile("burger.jpg", "image/jpeg"));

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(true);
        expect(result.action).toBe("create");
        expect(result.productId).toBe("created-1");
        expect(deps.storageFns.uploadBytes).toHaveBeenCalled();
        expect(deps.storageFns.getDownloadURL).toHaveBeenCalledWith(
            { storage: deps.storage, path: "menuItemPhotos/vendor-1/created-1/cover.jpg" }
        );
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems", "created-1"] },
            expect.objectContaining({
                vendorUid: "vendor-1",
                name: "Chicken Burger",
                category: "Burgers",
                description: "A juicy chicken burger with chips.",
                price: 55,
                photoURL: "https://storage.example/menuItemPhotos/vendor-1/created-1/cover.jpg",
                photoPath: "menuItemPhotos/vendor-1/created-1/cover.jpg",
                availability: "available",
                soldOut: false,
                dietaryTags: ["halal", "grilled"],
                allergenTags: ["gluten"],
                createdAt: "SERVER_TIME",
                updatedAt: "SERVER_TIME"
            })
        );
        expect(document.getElementById("products-editor-modal").open).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Menu item created successfully.");
    });

    test("editing a product updates with setDoc and keeps existing photo info", async () => {
        await page.initializeProductsPage();

        page.editProductById("item-1");
        document.getElementById("product-price").value = "60.00";

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(true);
        expect(result.action).toBe("update");
        expect(deps.storageFns.uploadBytes).not.toHaveBeenCalled();
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems", "item-1"] },
            expect.objectContaining({
                name: "Chicken Burger",
                price: 60,
                photoURL: "https://files.example/item-1.jpg",
                photoPath: "menuItemPhotos/vendor-1/item-1/cover.jpg",
                updatedAt: "SERVER_TIME"
            }),
            { merge: true }
        );
    });

    test("removeSelectedPhoto and saving deletes the old image from storage", async () => {
        await page.initializeProductsPage();

        page.editProductById("item-1");
        page.removeSelectedPhoto();
        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(true);
        expect(deps.storageFns.deleteObject).toHaveBeenCalledWith(
            { storage: deps.storage, path: "menuItemPhotos/vendor-1/item-1/cover.jpg" }
        );
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems", "item-1"] },
            expect.objectContaining({
                photoURL: "",
                photoPath: ""
            }),
            { merge: true }
        );
    });

    test("deleteCurrentProduct deletes the selected menu item and its stored image", async () => {
        await page.initializeProductsPage();

        const result = await page.deleteCurrentProduct("item-1");

        expect(result.success).toBe(true);
        expect(deps.confirmAction).toHaveBeenCalled();
        expect(deps.storageFns.deleteObject).toHaveBeenCalledWith(
            { storage: deps.storage, path: "menuItemPhotos/vendor-1/item-1/cover.jpg" }
        );
        expect(deps.firestoreFns.deleteDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1", "menuItems", "item-1"] }
        );
        expect(document.getElementById("products-status").textContent).toBe("Menu item deleted successfully.");
    });

    test("deleteCurrentProduct respects cancellation", async () => {
        deps = buildDependencies({ confirmDelete: false });
        page = createVendorProductsPage(deps);

        await page.initializeProductsPage();
        const result = await page.deleteCurrentProduct("item-1");

        expect(result.success).toBe(false);
        expect(result.cancelled).toBe(true);
        expect(deps.firestoreFns.deleteDoc).not.toHaveBeenCalled();
    });

    test("removeSelectedPhoto clears the preview state", async () => {
        await page.initializeProductsPage();
        page.editProductById("item-1");
        const result = page.removeSelectedPhoto();

        expect(result.success).toBe(true);
        expect(page.state.selectedPhotoDataUrl).toBe("");
        expect(document.getElementById("products-status").textContent).toBe("Product photo removed.");
    });

    test("previewSelectedPhoto rejects non-image files", async () => {
        await page.initializeProductsPage();
        page.openCreateModal();
        attachFile(document.getElementById("product-photo-file"), createMockFile("notes.txt", "text/plain"));

        const result = await page.previewSelectedPhoto();

        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Please choose an image file.");
    });

    test("previewSelectedPhoto handles missing file and oversized file", async () => {
        await page.initializeProductsPage();
        page.openCreateModal();

        let result = await page.previewSelectedPhoto();
        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Choose a product photo first.");

        attachFile(
            document.getElementById("product-photo-file"),
            createMockFile("huge.jpg", "image/jpeg", 6 * 1024 * 1024)
        );
        result = await page.previewSelectedPhoto();
        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Please choose an image smaller than 5 MB.");
    });

    test("search filters the rendered menu items", async () => {
        await page.initializeProductsPage();

        const search = document.getElementById("products-search");
        search.value = "milkshake";
        search.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("products-list").textContent).toContain("Strawberry Shake");
        expect(document.getElementById("products-list").textContent).not.toContain("Chicken Burger");
        expect(document.getElementById("products-results-meta").textContent).toBe("Showing 1 of 2 items");
    });

    test("loadProducts failure sets error status", async () => {
        deps = buildDependencies({ getDocsError: new Error("Firestore failed") });
        page = createVendorProductsPage(deps);

        const result = await page.initializeProductsPage();

        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Failed to load menu items.");
    });

    test("save failures set error status", async () => {
        deps = buildDependencies({ uploadBytesError: new Error("Upload failed") });
        page = createVendorProductsPage(deps);

        await page.initializeProductsPage();
        page.openCreateModal();
        fillValidForm();
        attachFile(document.getElementById("product-photo-file"), createMockFile("burger.jpg", "image/jpeg"));

        const result = await page.saveCurrentProduct();

        expect(result.success).toBe(false);
        expect(document.getElementById("products-status").textContent).toBe("Upload failed");
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

    test("back and reset events are wired to navigation and editor reset messaging", async () => {
        await page.initializeProductsPage();
        page.openCreateModal();
        fillValidForm();

        document.getElementById("clear-product-button")
            .dispatchEvent(new Event("click", { bubbles: true }));
        document.getElementById("products-form")
            .dispatchEvent(new Event("reset", { bubbles: true }));

        expect(document.getElementById("products-status").textContent).toBe("Editor reset.");
        expect(document.getElementById("product-name").value).toBe("");

        document.getElementById("back-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true }));
        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });
});
