/**
 * @jest-environment jsdom
 */

const {
    MODULE_NAME,
    MAX_IMAGE_SIZE_BYTES,
    FIELD_KEYS,
    normalizeText,
    normalizeLowerText,
    normalizeEmail,
    normalizePhoneNumber,
    isValidEmail,
    isValidPhoneNumber,
    isImageFile,
    readFileAsDataURL,
    loadImageFromSource,
    fileToOptimizedDataURL,
    getSelectedPhotoFile,
    clearFileInput,
    getFileExtension,
    buildShopPhotoPath,
    getDisplayShopPhotoUrl,
    normalizeShopRecord,
    validateShopValues,
    toShopUpdates,
    createVendorShopPage,
    initializeVendorShopPage
} = require("../../public/vendor/shop.js");

function createDom() {
    document.body.innerHTML = `
        <main>
            <p id="shop-status"></p>
            <p id="shop-note"></p>
            <output id="shop-vendor-status">-</output>
            <output id="shop-account-status">-</output>
            <output id="shop-visibility">-</output>
            <output id="shop-photo-state">No photo uploaded</output>

            <button id="back-to-dashboard-button" type="button">Back</button>

            <form id="vendor-shop-form">
                <input id="shop-business-name" name="businessName" type="text">
                <p id="shop-businessName-error" hidden></p>

                <input id="shop-food-type" name="foodType" type="text">
                <p id="shop-foodType-error" hidden></p>

                <textarea id="shop-description" name="description"></textarea>
                <p id="shop-description-error" hidden></p>

                <input id="shop-university" name="university" type="text">
                <p id="shop-university-error" hidden></p>

                <input id="shop-campus-location" name="campusLocation" type="text">
                <p id="shop-campusLocation-error" hidden></p>

                <input id="shop-opening-hours" name="openingHours" type="text">
                <p id="shop-openingHours-error" hidden></p>

                <input id="shop-contact-number" name="contactNumber" type="tel">
                <p id="shop-contactNumber-error" hidden></p>

                <input id="shop-business-email" name="businessEmail" type="email">
                <p id="shop-businessEmail-error" hidden></p>

                <input id="shop-accepting-orders" name="acceptingOrders" type="checkbox">

                <input id="shop-photo-file" name="photoFile" type="file">
                <button id="preview-shop-photo-button" type="button">Preview</button>
                <button id="remove-shop-photo-button" type="button">Remove</button>
                <img id="shop-photo-preview" alt="preview" hidden>
                <p id="shop-photo-empty-state"></p>

                <output id="shop-summary-name">-</output>
                <output id="shop-summary-food-type">-</output>
                <output id="shop-summary-university">-</output>
                <output id="shop-summary-location">-</output>
                <output id="shop-summary-hours">-</output>
                <output id="shop-summary-phone">-</output>
                <output id="shop-summary-email">-</output>
                <output id="shop-summary-accepting">-</output>
                <output id="shop-summary-description">-</output>

                <button id="save-shop-button" type="submit">Save</button>
                <button id="reset-shop-button" type="reset">Reset</button>
            </form>
        </main>
    `;
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
    const profileFromOptions =
        options.currentProfile === undefined
            ? {
                uid: "vendor-1",
                vendorStatus: "approved",
                accountStatus: "active",
                isAdmin: false,
                vendorBusinessName: "Burger Hut",
                vendorDescription: "Tasty burgers, fast service.",
                vendorLocation: "Hatfield Plaza, Stall 7",
                vendorUniversity: "University of Pretoria",
                vendorFoodType: "Burgers",
                vendorOpeningHours: "Mon-Fri 08:00-17:00",
                vendorPhoneNumber: "+27712345678",
                vendorEmail: "orders@burgerhut.co.za",
                vendorAcceptingOrders: true,
                vendorBannerURL: "https://files.example/banner.jpg",
                vendorBannerPath: "vendorShopPhotos/vendor-1/cover.jpg"
            }
            : options.currentProfile;

    const docData =
        options.docData === undefined ? profileFromOptions : options.docData;

    const authService = {
        getCurrentUser: jest.fn(() =>
            options.currentUser === undefined ? { uid: "vendor-1" } : options.currentUser
        ),
        getCurrentUserProfile: jest.fn(async () => profileFromOptions),
        updateUserProfile: jest.fn(async () => true)
    };

    const authUtils = {
        normaliseUserData: jest.fn((profile) => ({
            uid: (profile && profile.uid) || "",
            vendorStatus: (profile && profile.vendorStatus) || "none",
            accountStatus: (profile && profile.accountStatus) || "active",
            isAdmin: profile && profile.isAdmin === true,
            vendorBusinessName: profile && profile.vendorBusinessName,
            vendorDescription: profile && profile.vendorDescription,
            vendorLocation: profile && profile.vendorLocation,
            vendorUniversity: profile && profile.vendorUniversity,
            vendorFoodType: profile && profile.vendorFoodType,
            vendorOpeningHours: profile && profile.vendorOpeningHours,
            vendorPhoneNumber: profile && profile.vendorPhoneNumber,
            vendorEmail: profile && profile.vendorEmail,
            vendorAcceptingOrders: profile && profile.vendorAcceptingOrders,
            vendorBannerURL: profile && profile.vendorBannerURL,
            vendorBannerPath: profile && profile.vendorBannerPath
        })),
        canAccessVendorPortal: jest.fn((profile) =>
            options.canAccessVendor === undefined
                ? profile && profile.accountStatus === "active" && profile.vendorStatus === "approved"
                : options.canAccessVendor
        )
    };

    const firestoreFns = {
        doc: jest.fn((db, ...segments) => ({ db, segments })),
        getDoc: jest.fn(async () => {
            if (options.getDocError) {
                throw options.getDocError;
            }

            return {
                exists: () => true,
                data: () => docData || {}
            };
        }),
        updateDoc: jest.fn(async () => {
            if (options.updateDocError) {
                throw options.updateDocError;
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
        navigate: jest.fn()
    };
}

function fillValidForm() {
    document.getElementById("shop-business-name").value = "Burger Hut";
    document.getElementById("shop-food-type").value = "Burgers";
    document.getElementById("shop-description").value = "Tasty burgers, fast service.";
    document.getElementById("shop-university").value = "University of Pretoria";
    document.getElementById("shop-campus-location").value = "Hatfield Plaza, Stall 7";
    document.getElementById("shop-opening-hours").value = "Mon-Fri 08:00-17:00";
    document.getElementById("shop-contact-number").value = "+27712345678";
    document.getElementById("shop-business-email").value = "orders@burgerhut.co.za";
    document.getElementById("shop-accepting-orders").checked = true;
}

describe("vendor/shop.js helpers", () => {
    test("module exposes key constants and field keys", () => {
        expect(MODULE_NAME).toBe("vendor/shop");
        expect(MAX_IMAGE_SIZE_BYTES).toBe(5 * 1024 * 1024);
        expect(FIELD_KEYS).toEqual(expect.arrayContaining([
            "businessName",
            "foodType",
            "description",
            "university",
            "campusLocation",
            "openingHours",
            "contactNumber",
            "businessEmail"
        ]));
    });

    test("normalization helpers trim and lowercase appropriately", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(42)).toBe("");
        expect(normalizeLowerText("  HELLO  ")).toBe("hello");
        expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
        expect(normalizePhoneNumber(" +27 71 234 5678 ")).toBe("+27712345678");
    });

    test("email and phone validation", () => {
        expect(isValidEmail("foo@bar.com")).toBe(true);
        expect(isValidEmail("not-an-email")).toBe(false);
        expect(isValidEmail("")).toBe(false);
        expect(isValidPhoneNumber("+27712345678")).toBe(true);
        expect(isValidPhoneNumber("0712345678")).toBe(true);
        expect(isValidPhoneNumber("123")).toBe(false);
        expect(isValidPhoneNumber("abc")).toBe(false);
        expect(isValidPhoneNumber("")).toBe(false);
    });

    test("isImageFile and getFileExtension handle file types", () => {
        expect(isImageFile(createMockFile("a.png", "image/png"))).toBe(true);
        expect(isImageFile(createMockFile("a.txt", "text/plain"))).toBe(false);
        expect(isImageFile(null)).toBe(false);

        expect(getFileExtension(createMockFile("a.png", "image/png"))).toBe("png");
        expect(getFileExtension(createMockFile("a.webp", "image/webp"))).toBe("webp");
        expect(getFileExtension(createMockFile("a.gif", "image/gif"))).toBe("gif");
        expect(getFileExtension(createMockFile("a.jpg", "image/jpeg"))).toBe("jpg");
        expect(getFileExtension(null)).toBe("jpg");
        expect(getFileExtension({})).toBe("jpg");
    });

    test("buildShopPhotoPath builds vendor-scoped paths", () => {
        expect(buildShopPhotoPath("vendor-1", createMockFile("a.png", "image/png")))
            .toBe("vendorShopPhotos/vendor-1/cover.png");
        expect(buildShopPhotoPath("vendor-1", createMockFile("a.gif", "image/gif")))
            .toBe("vendorShopPhotos/vendor-1/cover.gif");
    });

    test("getDisplayShopPhotoUrl prefers banner URL over fallbacks", () => {
        expect(getDisplayShopPhotoUrl({ vendorBannerURL: "https://a" })).toBe("https://a");
        expect(getDisplayShopPhotoUrl({ shopPhotoDataUrl: "data:image/png;base64,x" }))
            .toBe("data:image/png;base64,x");
        expect(getDisplayShopPhotoUrl(null)).toBe("");
    });

    test("normalizeShopRecord normalizes profile data", () => {
        const result = normalizeShopRecord({
            uid: "vendor-1",
            vendorBusinessName: "  Burger Hut ",
            vendorDescription: "Tasty",
            vendorLocation: "Hatfield",
            vendorUniversity: "UP",
            vendorFoodType: "Burgers",
            vendorOpeningHours: "08-17",
            vendorPhoneNumber: " +27 71 234 5678 ",
            vendorEmail: "ORDERS@FOO.com",
            vendorAcceptingOrders: false,
            vendorBannerURL: "https://files.example/banner.jpg",
            vendorBannerPath: "vendorShopPhotos/vendor-1/cover.jpg",
            vendorStatus: "APPROVED",
            accountStatus: "active"
        });

        expect(result).toEqual({
            uid: "vendor-1",
            businessName: "Burger Hut",
            foodType: "Burgers",
            description: "Tasty",
            university: "UP",
            campusLocation: "Hatfield",
            openingHours: "08-17",
            contactNumber: "+27712345678",
            businessEmail: "orders@foo.com",
            acceptingOrders: false,
            shopPhotoURL: "https://files.example/banner.jpg",
            shopPhotoPath: "vendorShopPhotos/vendor-1/cover.jpg",
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(normalizeShopRecord(null)).toEqual(expect.objectContaining({
            uid: "",
            businessName: "",
            acceptingOrders: true,
            vendorStatus: "none",
            accountStatus: "active"
        }));

        expect(normalizeShopRecord({ businessName: "Fallback", phoneNumber: "0712345678" }))
            .toEqual(expect.objectContaining({
                businessName: "Fallback",
                contactNumber: "0712345678"
            }));
    });

    test("validateShopValues returns errors for invalid input", () => {
        const result = validateShopValues({
            businessName: "",
            foodType: "x",
            description: "short",
            campusLocation: "",
            contactNumber: "abc",
            businessEmail: "invalid"
        });

        expect(result.isValid).toBe(false);
        expect(result.errors.businessName).toBe("Please enter your business name.");
        expect(result.errors.foodType).toBe("Food type is too short.");
        expect(result.errors.description).toBe("Please write a longer shop description.");
        expect(result.errors.campusLocation).toBe("Please enter your campus stall location.");
        expect(result.errors.contactNumber).toBe("Please enter a valid contact number.");
        expect(result.errors.businessEmail).toBe("Please enter a valid email address.");
    });

    test("validateShopValues catches short business name and missing contact", () => {
        const result = validateShopValues({
            businessName: "A",
            description: "A long description here.",
            campusLocation: "Plaza",
            contactNumber: ""
        });

        expect(result.errors.businessName).toBe("Business name is too short.");
        expect(result.errors.contactNumber).toBe("Please enter a contact number.");
    });

    test("validateShopValues passes for valid input", () => {
        const result = validateShopValues({
            businessName: "Burger Hut",
            foodType: "Burgers",
            description: "Tasty burgers, fast service.",
            campusLocation: "Hatfield Plaza",
            contactNumber: "+27712345678",
            businessEmail: "orders@burgerhut.co.za"
        });

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("validateShopValues tolerates non-object input", () => {
        expect(validateShopValues(null).isValid).toBe(false);
    });

    test("toShopUpdates maps form values to Firestore fields", () => {
        const updates = toShopUpdates({
            businessName: "Burger Hut",
            foodType: "Burgers",
            description: "Tasty",
            university: "UP",
            campusLocation: "Hatfield",
            openingHours: "08-17",
            contactNumber: " +27 71 234 5678 ",
            businessEmail: "ORDERS@FOO.com",
            acceptingOrders: true,
            shopPhotoURL: "https://files.example/banner.jpg",
            shopPhotoPath: "vendorShopPhotos/vendor-1/cover.jpg"
        });

        expect(updates).toEqual({
            vendorBusinessName: "Burger Hut",
            businessName: "Burger Hut",
            vendorFoodType: "Burgers",
            vendorDescription: "Tasty",
            description: "Tasty",
            vendorUniversity: "UP",
            vendorLocation: "Hatfield",
            campusLocation: "Hatfield",
            vendorOpeningHours: "08-17",
            vendorPhoneNumber: "+27712345678",
            contactNumber: "+27712345678",
            vendorEmail: "orders@foo.com",
            vendorAcceptingOrders: true,
            vendorBannerURL: "https://files.example/banner.jpg",
            vendorBannerPath: "vendorShopPhotos/vendor-1/cover.jpg"
        });

        expect(toShopUpdates(null).vendorAcceptingOrders).toBe(false);
    });

    test("clearFileInput and getSelectedPhotoFile work safely", () => {
        const input = document.createElement("input");
        input.type = "file";
        clearFileInput(input);
        expect(input.value).toBe("");
        clearFileInput(null);

        expect(getSelectedPhotoFile(null)).toBeNull();
        expect(getSelectedPhotoFile({ files: [] })).toBeNull();
        expect(getSelectedPhotoFile({ files: ["a"] })).toBe("a");
    });

    test("readFileAsDataURL resolves on success and rejects on error", async () => {
        const originalFileReader = global.FileReader;

        global.FileReader = class MockFileReader {
            readAsDataURL() {
                this.result = "data:image/jpeg;base64,mock";
                this.onload();
            }
        };

        await expect(readFileAsDataURL(createMockFile("a.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,mock");

        global.FileReader = class ErrorFileReader {
            readAsDataURL() {
                this.onerror();
            }
        };

        await expect(readFileAsDataURL(createMockFile("a.jpg", "image/jpeg")))
            .rejects.toThrow("Unable to read the selected image.");

        global.FileReader = class EmptyFileReader {
            readAsDataURL() {
                this.result = null;
                this.onload();
            }
        };

        await expect(readFileAsDataURL(createMockFile("a.jpg", "image/jpeg")))
            .resolves.toBe("");

        global.FileReader = originalFileReader;
    });

    test("loadImageFromSource resolves and rejects", async () => {
        const originalImage = global.Image;

        global.Image = class MockImage {
            set src(value) {
                this._src = value;
                this.naturalWidth = 600;
                this.naturalHeight = 400;
                this.onload();
            }
        };

        const image = await loadImageFromSource("data:image/png;base64,x");
        expect(image.naturalWidth).toBe(600);

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

    test("fileToOptimizedDataURL optimizes when canvas is available, falls back otherwise", async () => {
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
                this.naturalWidth = 3000;
                this.naturalHeight = 2000;
                this.onload();
            }
        };

        const drawSpy = jest.fn();
        jest.spyOn(document, "createElement").mockImplementation((tagName) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => ({ drawImage: drawSpy }),
                    toDataURL: jest.fn(() => "data:image/jpeg;base64,optimized")
                };
            }
            return originalCreateElement(tagName);
        });

        await expect(fileToOptimizedDataURL(createMockFile("a.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,optimized");
        expect(drawSpy).toHaveBeenCalled();

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

        await expect(fileToOptimizedDataURL(createMockFile("a.jpg", "image/jpeg")))
            .resolves.toBe("data:image/jpeg;base64,original");

        document.createElement.mockRestore();

        jest.spyOn(document, "createElement").mockImplementation((tagName) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => ({ drawImage: jest.fn() }),
                    toDataURL: jest.fn(() => "data:image/png;base64,opt")
                };
            }
            return originalCreateElement(tagName);
        });

        await expect(fileToOptimizedDataURL(createMockFile("a.png", "image/png"), {
            maxWidth: 800,
            maxHeight: 800,
            quality: 0.7
        })).resolves.toBe("data:image/png;base64,opt");

        document.createElement.mockRestore();
        global.FileReader = originalFileReader;
        global.Image = originalImage;
    });
});

describe("createVendorShopPage", () => {
    let page;
    let deps;
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        deps = buildDependencies();
        page = createVendorShopPage(deps);
        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("initializeShopPage loads profile, fills form, updates stats and summary", async () => {
        const result = await page.initializeShopPage();

        expect(result.success).toBe(true);
        expect(deps.authService.getCurrentUser).toHaveBeenCalled();
        expect(deps.authService.getCurrentUserProfile).toHaveBeenCalledWith("vendor-1");
        expect(deps.firestoreFns.doc).toHaveBeenCalledWith(deps.db, "users", "vendor-1");
        expect(deps.firestoreFns.getDoc).toHaveBeenCalled();

        expect(document.getElementById("shop-business-name").value).toBe("Burger Hut");
        expect(document.getElementById("shop-description").value).toBe("Tasty burgers, fast service.");
        expect(document.getElementById("shop-campus-location").value).toBe("Hatfield Plaza, Stall 7");
        expect(document.getElementById("shop-contact-number").value).toBe("+27712345678");
        expect(document.getElementById("shop-business-email").value).toBe("orders@burgerhut.co.za");
        expect(document.getElementById("shop-accepting-orders").checked).toBe(true);
        expect(document.getElementById("shop-vendor-status").textContent).toBe("approved");
        expect(document.getElementById("shop-account-status").textContent).toBe("active");
        expect(document.getElementById("shop-visibility").textContent).toBe("Yes");
        expect(document.getElementById("shop-photo-state").textContent).toBe("Photo uploaded");
        expect(document.getElementById("shop-summary-name").textContent).toBe("Burger Hut");
        expect(document.getElementById("shop-photo-preview").hidden).toBe(false);
        expect(document.getElementById("shop-status").textContent).toBe("Shop details loaded.");
    });

    test("initializeShopPage redirects to login when not signed in", async () => {
        deps = buildDependencies({ currentUser: null });
        page = createVendorShopPage(deps);

        const result = await page.initializeShopPage();

        expect(result.success).toBe(false);
        expect(deps.navigate).toHaveBeenCalledWith("../authentication/login.html");
    });

    test("initializeShopPage redirects to dashboard for non-approved vendors", async () => {
        deps = buildDependencies({ canAccessVendor: false });
        page = createVendorShopPage(deps);

        const result = await page.initializeShopPage();

        expect(result.success).toBe(false);
        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("ensureVendorAccess throws when auth methods are missing", async () => {
        page = createVendorShopPage({ authService: {} });
        await expect(page.ensureVendorAccess())
            .rejects.toThrow("authService.getCurrentUser is required.");

        page = createVendorShopPage({ authService: { getCurrentUser: () => ({ uid: "v" }) } });
        await expect(page.ensureVendorAccess())
            .rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadShopProfile sets error status when getDoc throws", async () => {
        deps = buildDependencies({ getDocError: new Error("boom") });
        page = createVendorShopPage(deps);

        await page.ensureVendorAccess();
        const result = await page.loadShopProfile();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("We could not load your shop details right now.");
    });

    test("loadShopProfile uses profile fallback when firestore deps are missing", async () => {
        deps = buildDependencies();
        delete deps.firestoreFns.getDoc;
        page = createVendorShopPage(deps);

        await page.ensureVendorAccess();
        const result = await page.loadShopProfile();

        expect(result.success).toBe(true);
        expect(result.shop.businessName).toBe("Burger Hut");
        expect(document.getElementById("shop-status").textContent)
            .toBe("Shop details loaded from your profile.");
    });

    test("loadShopProfile errors when no current user", async () => {
        const result = await page.loadShopProfile();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("You must be signed in to view your shop details.");
    });

    test("back button click navigates to vendor dashboard", async () => {
        await page.initializeShopPage();

        document.getElementById("back-to-dashboard-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("goBack works programmatically", () => {
        page.goBack();
        expect(deps.navigate).toHaveBeenCalledWith("./index.html");
    });

    test("saveShop validates form and surfaces field errors", async () => {
        await page.initializeShopPage();

        document.getElementById("shop-business-name").value = "";
        document.getElementById("shop-description").value = "";
        document.getElementById("shop-campus-location").value = "";
        document.getElementById("shop-contact-number").value = "";

        const result = await page.saveShop();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-businessName-error").textContent)
            .toBe("Please enter your business name.");
        expect(document.getElementById("shop-status").textContent)
            .toBe("Please enter your business name.");
        expect(document.getElementById("shop-business-name").getAttribute("aria-invalid"))
            .toBe("true");
    });

    test("saveShop writes updates via updateDoc on success", async () => {
        await page.initializeShopPage();
        fillValidForm();

        const result = await page.saveShop();

        expect(result.success).toBe(true);
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            { db: deps.db, segments: ["users", "vendor-1"] },
            expect.objectContaining({
                vendorBusinessName: "Burger Hut",
                businessName: "Burger Hut",
                vendorFoodType: "Burgers",
                vendorDescription: "Tasty burgers, fast service.",
                vendorUniversity: "University of Pretoria",
                vendorLocation: "Hatfield Plaza, Stall 7",
                vendorOpeningHours: "Mon-Fri 08:00-17:00",
                vendorPhoneNumber: "+27712345678",
                vendorEmail: "orders@burgerhut.co.za",
                vendorAcceptingOrders: true,
                updatedAt: "SERVER_TIME"
            })
        );
        expect(document.getElementById("shop-status").textContent)
            .toBe("Shop details saved successfully.");
    });

    test("saveShop falls back to authService.updateUserProfile when firestore is unavailable", async () => {
        deps = buildDependencies();
        delete deps.firestoreFns.updateDoc;
        page = createVendorShopPage(deps);

        await page.initializeShopPage();
        fillValidForm();

        const result = await page.saveShop();

        expect(result.success).toBe(true);
        expect(deps.authService.updateUserProfile).toHaveBeenCalledWith(
            "vendor-1",
            expect.objectContaining({ vendorBusinessName: "Burger Hut" })
        );
    });

    test("saveShop reports failure when updateDoc throws", async () => {
        deps = buildDependencies({ updateDocError: new Error("offline") });
        page = createVendorShopPage(deps);

        await page.initializeShopPage();
        fillValidForm();

        const result = await page.saveShop();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent).toBe("offline");
    });

    test("saveShop fails gracefully when no user is signed in", async () => {
        const result = await page.saveShop();

        expect(result.success).toBe(false);
    });

    test("saveShop uploads selected photo to storage and stores URL", async () => {
        await page.initializeShopPage();
        fillValidForm();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("shop.png", "image/png")
        );

        const result = await page.saveShop();

        expect(result.success).toBe(true);
        expect(deps.storageFns.uploadBytes).toHaveBeenCalled();
        expect(deps.storageFns.getDownloadURL).toHaveBeenCalledWith(
            { storage: deps.storage, path: "vendorShopPhotos/vendor-1/cover.png" }
        );
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                vendorBannerURL: "https://storage.example/vendorShopPhotos/vendor-1/cover.png",
                vendorBannerPath: "vendorShopPhotos/vendor-1/cover.png"
            })
        );
    });

    test("saveShop reports an error when uploaded file is not an image", async () => {
        await page.initializeShopPage();
        fillValidForm();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("notes.txt", "text/plain")
        );

        const result = await page.saveShop();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Please choose an image file.");
    });

    test("saveShop rejects images larger than 5 MB", async () => {
        await page.initializeShopPage();
        fillValidForm();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("huge.jpg", "image/jpeg", 6 * 1024 * 1024)
        );

        const result = await page.saveShop();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Please choose an image smaller than 5 MB.");
    });

    test("saveShop after removeSelectedPhoto deletes the stored image", async () => {
        await page.initializeShopPage();
        fillValidForm();
        page.removeSelectedPhoto();

        const result = await page.saveShop();

        expect(result.success).toBe(true);
        expect(deps.storageFns.deleteObject).toHaveBeenCalledWith(
            { storage: deps.storage, path: "vendorShopPhotos/vendor-1/cover.jpg" }
        );
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            expect.anything(),
            expect.objectContaining({
                vendorBannerURL: "",
                vendorBannerPath: ""
            })
        );
    });

    test("deleteStoredShopPhoto via removeSelectedPhoto tolerates object-not-found", async () => {
        const notFoundError = Object.assign(new Error("missing"), { code: "storage/object-not-found" });
        deps = buildDependencies({ deleteObjectError: notFoundError });
        page = createVendorShopPage(deps);

        await page.initializeShopPage();
        fillValidForm();
        page.removeSelectedPhoto();

        const result = await page.saveShop();

        expect(result.success).toBe(true);
    });

    test("deleteStoredShopPhoto surfaces unexpected storage errors", async () => {
        deps = buildDependencies({ deleteObjectError: new Error("network down") });
        page = createVendorShopPage(deps);

        await page.initializeShopPage();
        fillValidForm();
        page.removeSelectedPhoto();

        const result = await page.saveShop();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent).toBe("network down");
    });

    test("previewSelectedPhoto requires a file", async () => {
        await page.initializeShopPage();

        const result = await page.previewSelectedPhoto();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Choose a shopfront photo first.");
    });

    test("previewSelectedPhoto rejects non-image files", async () => {
        await page.initializeShopPage();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("notes.txt", "text/plain")
        );

        const result = await page.previewSelectedPhoto();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Please choose an image file.");
    });

    test("previewSelectedPhoto rejects oversized files", async () => {
        await page.initializeShopPage();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("huge.jpg", "image/jpeg", 6 * 1024 * 1024)
        );

        const result = await page.previewSelectedPhoto();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Please choose an image smaller than 5 MB.");
    });

    test("previewSelectedPhoto returns optimized data url on success", async () => {
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
                this.naturalHeight = 600;
                this.onload();
            }
        };

        jest.spyOn(document, "createElement").mockImplementation((tagName) => {
            if (tagName === "canvas") {
                return {
                    width: 0,
                    height: 0,
                    getContext: () => ({ drawImage: jest.fn() }),
                    toDataURL: jest.fn(() => "data:image/jpeg;base64,optimized")
                };
            }
            return originalCreateElement(tagName);
        });

        await page.initializeShopPage();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("shop.jpg", "image/jpeg")
        );

        const result = await page.previewSelectedPhoto();

        expect(result.success).toBe(true);
        expect(result.photoDataUrl).toBe("data:image/jpeg;base64,optimized");
        expect(document.getElementById("shop-photo-preview").hidden).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Shopfront photo preview ready.");

        document.createElement.mockRestore();
        global.FileReader = originalFileReader;
        global.Image = originalImage;
    });

    test("previewSelectedPhoto surfaces optimization errors", async () => {
        const originalFileReader = global.FileReader;

        global.FileReader = class ErrorReader {
            readAsDataURL() {
                this.onerror();
            }
        };

        await page.initializeShopPage();
        attachFile(
            document.getElementById("shop-photo-file"),
            createMockFile("bad.jpg", "image/jpeg")
        );

        const result = await page.previewSelectedPhoto();

        expect(result.success).toBe(false);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Unable to read the selected image.");

        global.FileReader = originalFileReader;
    });

    test("preview button click triggers preview flow", async () => {
        await page.initializeShopPage();

        document.getElementById("preview-shop-photo-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(document.getElementById("shop-status").textContent)
            .toBe("Choose a shopfront photo first.");
    });

    test("remove button click clears the photo state", async () => {
        await page.initializeShopPage();

        document.getElementById("remove-shop-photo-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(page.state.selectedPhotoDataUrl).toBe("");
        expect(page.state.photoMarkedForRemoval).toBe(true);
        expect(document.getElementById("shop-status").textContent)
            .toBe("Shopfront photo removed.");
        expect(document.getElementById("shop-photo-state").textContent)
            .toBe("No photo uploaded");
    });

    test("reset button restores last loaded shop and clears errors", async () => {
        await page.initializeShopPage();

        document.getElementById("shop-business-name").value = "Changed";

        document.getElementById("reset-shop-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(document.getElementById("shop-business-name").value).toBe("Burger Hut");
        expect(document.getElementById("shop-status").textContent)
            .toBe("Changes discarded. Showing last saved shop details.");
    });

    test("handleResetForm uses defaults when no shop is loaded yet", () => {
        page.handleResetForm();

        expect(document.getElementById("shop-status").textContent)
            .toBe("Loading your shop details...");
        expect(document.getElementById("shop-note").textContent)
            .toBe("Update any field below, preview your shopfront image, then save your changes.");
    });

    test("live validation updates the summary on input", async () => {
        await page.initializeShopPage();

        const nameInput = document.getElementById("shop-business-name");
        nameInput.value = "New Name";
        nameInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("shop-summary-name").textContent).toBe("New Name");
    });

    test("live validation flags an invalid email", async () => {
        await page.initializeShopPage();

        const emailInput = document.getElementById("shop-business-email");
        emailInput.value = "not-an-email";
        emailInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("shop-businessEmail-error").textContent)
            .toBe("Please enter a valid email address.");
    });

    test("toggling accepting orders updates the summary", async () => {
        await page.initializeShopPage();

        const acceptInput = document.getElementById("shop-accepting-orders");
        acceptInput.checked = false;
        acceptInput.dispatchEvent(new Event("change", { bubbles: true }));

        expect(document.getElementById("shop-summary-accepting").textContent).toBe("No");
    });

    test("validateSingleField returns true for valid input", async () => {
        await page.initializeShopPage();

        document.getElementById("shop-business-name").value = "Valid";
        expect(page.validateSingleField("businessName")).toBe(true);
    });

    test("submit handler prevents default and triggers saveShop", async () => {
        await page.initializeShopPage();
        fillValidForm();

        const submitEvent = new Event("submit", { bubbles: true, cancelable: true });
        document.getElementById("vendor-shop-form").dispatchEvent(submitEvent);

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(submitEvent.defaultPrevented).toBe(true);
    });

    test("collectFormValues reads each input safely when missing", () => {
        document.body.innerHTML = "";
        expect(page.collectFormValues()).toEqual({
            businessName: "",
            foodType: "",
            description: "",
            university: "",
            campusLocation: "",
            openingHours: "",
            contactNumber: "",
            businessEmail: "",
            acceptingOrders: true
        });
    });

    test("fillForm with a null record clears the form safely", () => {
        page.fillForm(null);
        expect(document.getElementById("shop-business-name").value).toBe("");
        expect(document.getElementById("shop-accepting-orders").checked).toBe(true);
    });

    test("updateStatsPanel reports invisible state when not approved", () => {
        page.updateStatsPanel({ vendorStatus: "pending", accountStatus: "active" });
        expect(document.getElementById("shop-visibility").textContent).toBe("No");
        expect(document.getElementById("shop-vendor-status").textContent).toBe("pending");
    });

    test("updateSummary handles null input without throwing", () => {
        expect(() => page.updateSummary(null, "")).not.toThrow();
        expect(document.getElementById("shop-summary-name").textContent).toBe("-");
    });
});

describe("initializeVendorShopPage entry point", () => {
    beforeEach(() => {
        createDom();
    });

    test("wires the back button when no auth service is provided", () => {
        const navigate = jest.fn();

        const result = initializeVendorShopPage({ navigate });

        expect(result.success).toBe(true);

        document.getElementById("back-to-dashboard-button")
            .dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true }));

        expect(navigate).toHaveBeenCalledWith("./index.html");
    });

    test("creates and initializes a full page when dependencies are supplied", async () => {
        const deps = buildDependencies();
        const page = initializeVendorShopPage(deps);

        expect(page).toBeTruthy();
        expect(typeof page.initializeShopPage).toBe("function");

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(deps.authService.getCurrentUser).toHaveBeenCalled();
    });
});
