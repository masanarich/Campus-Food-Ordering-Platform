/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeLowerText,
    getSafeUserProfile,
    getVendorApplicationFields,
    validateApplicationForm,
    getStatusViewModel,
    validatePhoneNumber,
    createVendorApplicationPage
} = require("../../public/customer/vendor-application.js");

async function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

function createDom() {
    document.body.innerHTML = `
        <main>
            <section>
                <p id="vendor-application-status"></p>
                <p id="vendor-application-note"></p>

                <menu>
                    <li><button id="back-button" type="button">Back</button></li>
                    <li><button id="go-vendor-portal-button" type="button" hidden>Vendor Portal</button></li>
                </menu>
            </section>

            <section id="vendor-application-form-section">
                <form id="vendor-application-form">
                    <input id="vendor-business-name" name="businessName" type="text">
                    <p id="vendor-businessName-error" hidden></p>

                    <input id="vendor-owner-name" name="ownerName" type="text">
                    <p id="vendor-ownerName-error" hidden></p>

                    <input id="vendor-email" name="businessEmail" type="email">
                    <p id="vendor-email-error" hidden></p>

                    <input id="vendor-phone" name="phoneNumber" type="tel">
                    <p id="vendor-phoneNumber-error" hidden></p>

                    <input id="vendor-university" name="university" type="text">
                    <p id="vendor-university-error" hidden></p>

                    <input id="vendor-location" name="location" type="text">
                    <p id="vendor-location-error" hidden></p>

                    <select id="vendor-food-type" name="foodType">
                        <option value="">Select one</option>
                        <option value="fast-food">Fast food</option>
                        <option value="restaurant">Restaurant meals</option>
                    </select>
                    <p id="vendor-foodType-error" hidden></p>

                    <textarea id="vendor-description" name="description"></textarea>
                    <p id="vendor-description-error" hidden></p>

                    <input id="vendor-confirm-checkbox" name="confirmed" type="checkbox">
                    <p id="vendor-confirmed-error" hidden></p>

                    <button id="submit-vendor-application-button" type="submit">Submit Vendor Application</button>
                    <button id="reset-vendor-application-button" type="reset">Clear Form</button>
                </form>
            </section>

            <section>
                <output id="vendor-status-output"></output>
                <output id="vendor-business-name-output"></output>
                <output id="vendor-owner-name-output"></output>
                <output id="vendor-email-output"></output>
                <output id="vendor-phone-output"></output>
                <output id="vendor-university-output"></output>
                <output id="vendor-location-output"></output>
                <output id="vendor-food-type-output"></output>
                <output id="vendor-description-output"></output>
                <output id="vendor-reason-output"></output>
            </section>
        </main>
    `;
}

function createAuthUtils() {
    return {
        normaliseUserData: jest.fn((user) => ({
            uid: user.uid || "",
            displayName: user.displayName || "",
            email: (user.email || "").trim().toLowerCase(),
            phoneNumber: user.phoneNumber || "",
            vendorStatus: (user.vendorStatus || "none").trim().toLowerCase(),
            vendorReason: user.vendorReason || "",
            accountStatus: user.accountStatus || "active",
            isAdmin: user.isAdmin === true,
            isOwner: user.isOwner === true,
            vendorBusinessName: user.vendorBusinessName || "",
            vendorOwnerName: user.vendorOwnerName || "",
            vendorEmail: (user.vendorEmail || "").trim().toLowerCase(),
            vendorPhoneNumber: user.vendorPhoneNumber || "",
            vendorUniversity: user.vendorUniversity || "",
            vendorLocation: user.vendorLocation || "",
            vendorFoodType: user.vendorFoodType || "",
            vendorDescription: user.vendorDescription || ""
        })),
        isValidEmail: jest.fn((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase()))
    };
}

function createDependencies(overrides = {}) {
    const authService = {
        getCurrentUser: jest.fn(() => ({ uid: "user-123" })),
        getCurrentUserProfile: jest.fn(async () => ({
            uid: "user-123",
            displayName: "Fara",
            email: "fara@example.com",
            phoneNumber: "0712345678",
            vendorStatus: "none",
            vendorReason: "",
            vendorBusinessName: "",
            vendorOwnerName: "",
            vendorEmail: "",
            vendorPhoneNumber: "",
            vendorUniversity: "",
            vendorLocation: "",
            vendorFoodType: "",
            vendorDescription: ""
        })),
        getUserProfile: jest.fn(async () => null),
        updateCurrentUserProfile: jest.fn(async (updates) => updates),
        updateUserProfile: jest.fn(async (uid, updates) => ({ uid, ...updates }))
    };

    const firestoreFns = {
        doc: jest.fn((db, collection, id) => ({ db, collection, id })),
        setDoc: jest.fn(async () => true),
        serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
    };

    return {
        authService,
        authUtils: createAuthUtils(),
        db: { name: "mock-db" },
        firestoreFns,
        ...overrides
    };
}

function fillValidForm() {
    document.getElementById("vendor-business-name").value = "Campus Bites";
    document.getElementById("vendor-owner-name").value = "Faranani Maduwa";
    document.getElementById("vendor-email").value = "vendor@example.com";
    document.getElementById("vendor-phone").value = "0712345678";
    document.getElementById("vendor-university").value = "Wits University";
    document.getElementById("vendor-location").value = "Matrix Food Court";
    document.getElementById("vendor-food-type").value = "fast-food";
    document.getElementById("vendor-description").value =
        "We sell affordable hot meals, snacks, and drinks for students every day.";
    document.getElementById("vendor-confirm-checkbox").checked = true;
}

describe("vendor-application.js helpers", () => {
    test("normalizeText trims strings and returns empty string for non-string", () => {
        expect(normalizeText("  hello  ")).toBe("hello");
        expect(normalizeText("")).toBe("");
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(12)).toBe("");
    });

    test("normalizeLowerText trims and lowercases", () => {
        expect(normalizeLowerText("  HeLLo  ")).toBe("hello");
        expect(normalizeLowerText(null)).toBe("");
    });

    test("getVendorApplicationFields maps and normalizes values", () => {
        expect(
            getVendorApplicationFields({
                businessName: " Campus Bites ",
                ownerName: " Faranani ",
                email: " TEST@EXAMPLE.COM ",
                phoneNumber: " 0712345678 ",
                university: " Wits ",
                location: " Matrix ",
                foodType: "fast-food",
                description: " Good food "
            })
        ).toEqual({
            vendorBusinessName: "Campus Bites",
            vendorOwnerName: "Faranani",
            vendorEmail: "test@example.com",
            vendorPhoneNumber: "0712345678",
            vendorUniversity: "Wits",
            vendorLocation: "Matrix",
            vendorFoodType: "fast-food",
            vendorDescription: "Good food"
        });
    });

    test("validatePhoneNumber handles empty, invalid, and valid values", () => {
        expect(validatePhoneNumber("")).toBe("Please enter a phone number.");
        expect(validatePhoneNumber("123")).toBe("Please enter a valid phone number with 10 to 15 digits.");
        expect(validatePhoneNumber("0712345678")).toBe("");
        expect(validatePhoneNumber("+27712345678")).toBe("");
    });

    test("validateApplicationForm returns all expected errors", () => {
        const authUtils = createAuthUtils();

        const result = validateApplicationForm(
            {
                businessName: "",
                ownerName: "",
                email: "bad-email",
                phoneNumber: "123",
                university: "",
                location: "",
                foodType: "",
                description: "short",
                confirmed: false
            },
            authUtils
        );

        expect(result.isValid).toBe(false);
        expect(result.errors.businessName).toBe("Please enter the business or restaurant name.");
        expect(result.errors.ownerName).toBe("Please enter the owner or manager name.");
        expect(result.errors.email).toBe("Please enter a valid business email.");
        expect(result.errors.phoneNumber).toBe("Please enter a valid phone number with 10 to 15 digits.");
        expect(result.errors.university).toBe("Please enter your university or campus.");
        expect(result.errors.location).toBe("Please enter the business location.");
        expect(result.errors.foodType).toBe("Please select a food category.");
        expect(result.errors.description).toBe("Please enter a slightly longer business description.");
        expect(result.errors.confirmed).toBe("Please confirm that the information is correct.");
    });

    test("validateApplicationForm passes valid data", () => {
        const authUtils = createAuthUtils();

        const result = validateApplicationForm(
            {
                businessName: "Campus Bites",
                ownerName: "Faranani Maduwa",
                email: "vendor@example.com",
                phoneNumber: "0712345678",
                university: "Wits University",
                location: "Matrix Food Court",
                foodType: "fast-food",
                description: "We sell affordable hot meals, snacks, and drinks for students.",
                confirmed: true
            },
            authUtils
        );

        expect(result.isValid).toBe(true);
        expect(result.errors).toEqual({});
    });

    test("getStatusViewModel handles all statuses", () => {
        expect(getStatusViewModel({ vendorStatus: "approved" })).toEqual({
            key: "approved",
            message: "Your vendor access is approved. You can now open the vendor portal.",
            canApply: false,
            canOpenVendorPortal: true
        });

        expect(getStatusViewModel({ vendorStatus: "pending" })).toEqual({
            key: "pending",
            message: "Your vendor application is pending review.",
            canApply: false,
            canOpenVendorPortal: false
        });

        expect(getStatusViewModel({ vendorStatus: "blocked" })).toEqual({
            key: "blocked",
            message: "Your vendor access is currently blocked. Please contact support or admin.",
            canApply: false,
            canOpenVendorPortal: false
        });

        expect(getStatusViewModel({ vendorStatus: "rejected" })).toEqual({
            key: "rejected",
            message: "Your vendor application was not approved. You can review your details and apply again.",
            canApply: true,
            canOpenVendorPortal: false
        });

        expect(getStatusViewModel({ vendorStatus: "none" })).toEqual({
            key: "none",
            message: "Complete the form below to apply for vendor access.",
            canApply: true,
            canOpenVendorPortal: false
        });
    });

    test("getSafeUserProfile uses authUtils.normaliseUserData when available", () => {
        const authUtils = createAuthUtils();

        const result = getSafeUserProfile(
            authUtils,
            {
                uid: "abc",
                email: "TEST@EXAMPLE.COM",
                vendorStatus: "PENDING"
            },
            "fallback"
        );

        expect(authUtils.normaliseUserData).toHaveBeenCalled();
        expect(result.uid).toBe("abc");
        expect(result.email).toBe("test@example.com");
        expect(result.vendorStatus).toBe("pending");
    });

    test("getSafeUserProfile falls back safely without authUtils", () => {
        const result = getSafeUserProfile(
            null,
            {
                fullName: "  Faranani ",
                email: " TEST@EXAMPLE.COM ",
                phoneNumber: " 0712345678 ",
                vendorStatus: " APPROVED ",
                vendorReason: " Good ",
                accountStatus: " ACTIVE ",
                vendorBusinessName: " Biz ",
                vendorOwnerName: " Owner ",
                vendorEmail: " SHOP@EXAMPLE.COM ",
                vendorPhoneNumber: " 0723456789 ",
                vendorUniversity: " Wits ",
                vendorLocation: " Matrix ",
                vendorFoodType: "fast-food",
                vendorDescription: " Good food "
            },
            "fallback-id"
        );

        expect(result).toEqual({
            uid: "fallback-id",
            displayName: "Faranani",
            email: "test@example.com",
            phoneNumber: "0712345678",
            vendorStatus: "approved",
            vendorReason: "Good",
            accountStatus: "active",
            isAdmin: false,
            isOwner: false,
            vendorBusinessName: "Biz",
            vendorOwnerName: "Owner",
            vendorEmail: "shop@example.com",
            vendorPhoneNumber: "0723456789",
            vendorUniversity: "Wits",
            vendorLocation: "Matrix",
            vendorFoodType: "fast-food",
            vendorDescription: "Good food"
        });
    });
});

describe("createVendorApplicationPage", () => {
    let dependencies;
    let page;
    let consoleErrorSpy;

    beforeEach(() => {
        createDom();
        dependencies = createDependencies();
        page = createVendorApplicationPage(dependencies);

        jest.spyOn(window, "setTimeout").mockImplementation((callback) => {
            callback();
            return 0;
        });

        consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    test("initializeVendorApplicationPage loads current profile and updates page", async () => {
        await page.initializeVendorApplicationPage();

        expect(dependencies.authService.getCurrentUser).toHaveBeenCalled();
        expect(dependencies.authService.getCurrentUserProfile).toHaveBeenCalledWith("user-123");
        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Complete the form below to apply for vendor access.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Complete the application form below and submit it for review.");
        expect(document.getElementById("vendor-status-output").textContent).toBe("none");
        expect(document.getElementById("submit-vendor-application-button").disabled).toBe(false);
    });

    test("initializeVendorApplicationPage handles signed out user", async () => {
        dependencies.authService.getCurrentUser.mockReturnValue(null);
        page = createVendorApplicationPage(dependencies);

        await page.initializeVendorApplicationPage();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Complete the form below to apply for vendor access.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Complete the application form below and submit it for review.");
    });

    test("initializeVendorApplicationPage falls back to getUserProfile when getCurrentUserProfile returns null", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue(null);
        dependencies.authService.getUserProfile.mockResolvedValue({
            uid: "user-123",
            email: "fallback@example.com",
            vendorStatus: "rejected",
            vendorReason: "Missing details"
        });

        page = createVendorApplicationPage(dependencies);
        await page.initializeVendorApplicationPage();

        expect(dependencies.authService.getUserProfile).toHaveBeenCalledWith("user-123");
        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Your vendor application was not approved. You can review your details and apply again.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Missing details");
    });

    test("approved profile hides form and shows vendor portal button", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            vendorStatus: "approved",
            vendorReason: "",
            vendorBusinessName: "Campus Bites"
        });

        page = createVendorApplicationPage(dependencies);
        await page.initializeVendorApplicationPage();

        expect(document.getElementById("vendor-application-form-section").hidden).toBe(true);
        expect(document.getElementById("go-vendor-portal-button").hidden).toBe(false);
        expect(document.getElementById("go-vendor-portal-button").disabled).toBe(false);
        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Your vendor access is approved. You can now open the vendor portal.");
    });

    test("pending profile disables form actions", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            vendorStatus: "pending"
        });

        page = createVendorApplicationPage(dependencies);
        await page.initializeVendorApplicationPage();

        expect(document.getElementById("submit-vendor-application-button").disabled).toBe(true);
        expect(document.getElementById("reset-vendor-application-button").disabled).toBe(true);
        expect(document.getElementById("vendor-application-form-section").hidden).toBe(true);
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Your application is under review. You cannot submit another one right now.");
    });

    test("blocked profile shows blocking reason", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            vendorStatus: "blocked",
            vendorReason: "Contact admin"
        });

        page = createVendorApplicationPage(dependencies);
        await page.initializeVendorApplicationPage();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Your vendor access is currently blocked. Please contact support or admin.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Contact admin");
    });

    test("live validation shows and clears phone error", async () => {
        await page.initializeVendorApplicationPage();

        const phoneInput = document.getElementById("vendor-phone");
        const phoneError = document.getElementById("vendor-phoneNumber-error");

        phoneInput.value = "123";
        phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(phoneError.textContent).toBe("Please enter a valid phone number with 10 to 15 digits.");
        expect(phoneInput.getAttribute("aria-invalid")).toBe("true");
        expect(phoneError.hidden).toBe(false);

        phoneInput.value = "0712345678";
        phoneInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(phoneError.textContent).toBe("");
        expect(phoneInput.hasAttribute("aria-invalid")).toBe(false);
        expect(phoneError.hidden).toBe(true);
    });

    test("live validation uses change event for checkbox and select", async () => {
        await page.initializeVendorApplicationPage();

        const checkbox = document.getElementById("vendor-confirm-checkbox");
        const checkboxError = document.getElementById("vendor-confirmed-error");
        const select = document.getElementById("vendor-food-type");
        const selectError = document.getElementById("vendor-foodType-error");

        checkbox.checked = false;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        expect(checkboxError.textContent).toBe("Please confirm that the information is correct.");

        checkbox.checked = true;
        checkbox.dispatchEvent(new Event("change", { bubbles: true }));
        expect(checkboxError.textContent).toBe("");

        select.value = "";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(selectError.textContent).toBe("Please select a food category.");

        select.value = "fast-food";
        select.dispatchEvent(new Event("change", { bubbles: true }));
        expect(selectError.textContent).toBe("");
    });

    test("blur validation works for text inputs", async () => {
        await page.initializeVendorApplicationPage();

        const emailInput = document.getElementById("vendor-email");
        const emailError = document.getElementById("vendor-email-error");

        emailInput.value = "bad-email";
        emailInput.dispatchEvent(new Event("blur", { bubbles: true }));

        expect(emailError.textContent).toBe("Please enter a valid business email.");
    });

    test("summary updates while typing", async () => {
        await page.initializeVendorApplicationPage();

        const businessInput = document.getElementById("vendor-business-name");
        businessInput.value = "Fresh Bites";
        businessInput.dispatchEvent(new Event("input", { bubbles: true }));

        const descriptionInput = document.getElementById("vendor-description");
        descriptionInput.value = "Fresh and tasty student meals every afternoon on campus.";
        descriptionInput.dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("vendor-business-name-output").textContent).toBe("Fresh Bites");
        expect(document.getElementById("vendor-description-output").textContent)
            .toBe("Fresh and tasty student meals every afternoon on campus.");
    });

    test("submit shows validation errors when form is invalid", async () => {
        await page.initializeVendorApplicationPage();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Please enter the business or restaurant name.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Please correct the highlighted fields and try again.");
        expect(document.getElementById("vendor-businessName-error").textContent)
            .toBe("Please enter the business or restaurant name.");
        expect(dependencies.authService.updateCurrentUserProfile).not.toHaveBeenCalled();
        expect(dependencies.firestoreFns.setDoc).not.toHaveBeenCalled();
    });

    test("submit succeeds with valid form and saves vendor application", async () => {
        await page.initializeVendorApplicationPage();
        fillValidForm();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();
        await flushPromises();

        expect(dependencies.authService.updateCurrentUserProfile).toHaveBeenCalledWith({
            vendorBusinessName: "Campus Bites",
            vendorOwnerName: "Faranani Maduwa",
            vendorEmail: "vendor@example.com",
            vendorPhoneNumber: "0712345678",
            vendorUniversity: "Wits University",
            vendorLocation: "Matrix Food Court",
            vendorFoodType: "fast-food",
            vendorDescription: "We sell affordable hot meals, snacks, and drinks for students every day.",
            vendorStatus: "pending",
            vendorReason: ""
        });

        expect(dependencies.firestoreFns.doc).toHaveBeenCalledWith(
            dependencies.db,
            "vendorApplications",
            "user-123"
        );

        expect(dependencies.firestoreFns.setDoc).toHaveBeenCalledWith(
            expect.objectContaining({
                collection: "vendorApplications",
                id: "user-123"
            }),
            expect.objectContaining({
                uid: "user-123",
                vendorBusinessName: "Campus Bites",
                vendorStatus: "pending",
                vendorReason: "",
                submittedAt: "SERVER_TIMESTAMP",
                updatedAt: "SERVER_TIMESTAMP"
            }),
            { merge: true }
        );

        expect(document.getElementById("vendor-status-output").textContent).toBe("pending");
        expect(document.getElementById("vendor-business-name-output").textContent).toBe("Campus Bites");
        expect(document.getElementById("vendor-food-type-output").textContent).toBe("Fast Food");
        expect(document.getElementById("submit-vendor-application-button").disabled).toBe(true);
    });

    test("submit falls back to updateUserProfile when updateCurrentUserProfile is unavailable", async () => {
        delete dependencies.authService.updateCurrentUserProfile;
        page = createVendorApplicationPage(dependencies);

        await page.initializeVendorApplicationPage();
        fillValidForm();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(dependencies.authService.updateUserProfile).toHaveBeenCalledWith(
            "user-123",
            expect.objectContaining({
                vendorBusinessName: "Campus Bites",
                vendorStatus: "pending"
            })
        );
    });

    test("submit handles missing profile update methods", async () => {
        delete dependencies.authService.updateCurrentUserProfile;
        delete dependencies.authService.updateUserProfile;
        page = createVendorApplicationPage(dependencies);

        await page.initializeVendorApplicationPage();
        fillValidForm();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Something went wrong while submitting the application.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("No supported profile update method was provided.");
    });

    test("submit handles thrown errors from updateCurrentUserProfile", async () => {
        dependencies.authService.updateCurrentUserProfile.mockRejectedValue(new Error("Database failed"));
        page = createVendorApplicationPage(dependencies);

        await page.initializeVendorApplicationPage();
        fillValidForm();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Something went wrong while submitting the application.");
        expect(document.getElementById("vendor-application-note").textContent).toBe("Database failed");
    });

    test("submit handles signed out state", async () => {
        dependencies.authService.getCurrentUser.mockReturnValue(null);
        page = createVendorApplicationPage(dependencies);

        await page.initializeVendorApplicationPage();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Please sign in to apply for vendor access.");
    });

    test("saveVendorApplicationRecord safely returns when firestore functions are missing", async () => {
        const limitedDeps = createDependencies({
            firestoreFns: {},
            db: null
        });

        page = createVendorApplicationPage(limitedDeps);
        await page.initializeVendorApplicationPage();
        fillValidForm();

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

        await flushPromises();
        await flushPromises();

        expect(limitedDeps.authService.updateCurrentUserProfile).toHaveBeenCalled();
    });

    test("reset clears field errors, summary, and shows reset note", async () => {
        await page.initializeVendorApplicationPage();

        document.getElementById("vendor-business-name").value = "";
        document.getElementById("vendor-business-name")
            .dispatchEvent(new Event("input", { bubbles: true }));

        expect(document.getElementById("vendor-businessName-error").textContent)
            .toBe("Please enter the business or restaurant name.");

        fillValidForm();
        document.getElementById("vendor-business-name-output").textContent = "Campus Bites";

        document
            .getElementById("vendor-application-form")
            .dispatchEvent(new Event("reset", { bubbles: true }));

        expect(document.getElementById("vendor-businessName-error").textContent).toBe("");
        expect(document.getElementById("vendor-business-name-output").textContent).toBe("-");
        expect(document.getElementById("vendor-description-output").textContent).toBe("-");
        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Complete the form below to apply for vendor access.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("The form has been cleared.");
    });

    test("back button executes navigation code path", async () => {
        await page.initializeVendorApplicationPage();

        document.getElementById("back-button").click();

        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("vendor portal button executes navigation code path", async () => {
        dependencies.authService.getCurrentUserProfile.mockResolvedValue({
            uid: "user-123",
            vendorStatus: "approved"
        });

        page = createVendorApplicationPage(dependencies);
        await page.initializeVendorApplicationPage();

        document.getElementById("go-vendor-portal-button").click();

        expect(consoleErrorSpy).toHaveBeenCalled();
    });

    test("initializeVendorApplicationPage handles load errors", async () => {
        dependencies.authService.getCurrentUserProfile.mockRejectedValue(new Error("Load failed"));
        page = createVendorApplicationPage(dependencies);

        await page.initializeVendorApplicationPage();

        expect(document.getElementById("vendor-application-status").textContent)
            .toBe("Unable to load your vendor application details.");
        expect(document.getElementById("vendor-application-note").textContent)
            .toBe("Please refresh the page and try again.");
    });

    test("module-level global initializer attaches instance to window.vendorApplicationPage", async () => {
        expect(typeof window.vendorApplicationPage.initializeVendorApplicationPage).toBe("function");

        await window.vendorApplicationPage.initializeVendorApplicationPage(dependencies);

        expect(window.vendorApplicationPage.instance).toBeDefined();
    });
});