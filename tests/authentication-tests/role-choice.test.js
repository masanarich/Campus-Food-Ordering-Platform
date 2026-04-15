/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizePortal,
    normalizeVendorStatus,
    normalizeAccountStatus,
    isValidPortal,
    resolveAuthUtils,
    getPortalRoute,
    setStatusMessage,
    setButtonState,
    setElementHidden,
    setElementText,
    hasAuthenticatedIdentity,
    normalizeUserProfile,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    getAvailablePortals,
    shouldGoToRoleChoice,
    getDefaultPortalRoute,
    getRoleChoiceState,
    getPortalSummaryText,
    canAccessPortal,
    submitPortalChoice,
    attachPortalChoiceHandler,
    getPortalDisplayElement,
    renderRoleChoicePage,
    loadRoleChoiceState,
    initializeRoleChoicePage
} = require("../../public/authentication/role-choice.js");

function createRoleChoiceDom() {
    document.body.innerHTML = `
        <main>
            <p id="role-choice-status"></p>
            <p id="role-choice-summary"></p>
            <p id="vendor-status-message"></p>

            <section id="customer-portal-section">
                <button id="choose-customer" type="button">Customer</button>
            </section>

            <section id="vendor-portal-section">
                <button id="choose-vendor" type="button">Vendor</button>
            </section>

            <section id="admin-portal-section">
                <button id="choose-admin" type="button">Admin</button>
            </section>
        </main>
    `;

    return {
        statusElement: document.querySelector("#role-choice-status"),
        summaryElement: document.querySelector("#role-choice-summary"),
        vendorStateElement: document.querySelector("#vendor-status-message"),
        customerSection: document.querySelector("#customer-portal-section"),
        vendorSection: document.querySelector("#vendor-portal-section"),
        adminSection: document.querySelector("#admin-portal-section"),
        customerButton: document.querySelector("#choose-customer"),
        vendorButton: document.querySelector("#choose-vendor"),
        adminButton: document.querySelector("#choose-admin")
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("role-choice.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeText returns empty string for non-string values", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(42)).toBe("");
    });

    test("normalizePortal trims and lowercases portal", () => {
        expect(normalizePortal("  Vendor  ")).toBe("vendor");
    });

    test("normalizeVendorStatus maps suspended to blocked", () => {
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
    });

    test("normalizeVendorStatus returns none for invalid status", () => {
        expect(normalizeVendorStatus("unknown")).toBe("none");
    });

    test("normalizeAccountStatus keeps disabled and blocked, defaults to active", () => {
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("inactive")).toBe("active");
        expect(normalizeAccountStatus("")).toBe("active");
    });

    test("isValidPortal accepts customer vendor and admin", () => {
        expect(isValidPortal("customer")).toBe(true);
        expect(isValidPortal("vendor")).toBe(true);
        expect(isValidPortal("admin")).toBe(true);
    });

    test("isValidPortal rejects unsupported portal names", () => {
        expect(isValidPortal("roleChoice")).toBe(false);
        expect(isValidPortal("login")).toBe(false);
        expect(isValidPortal("")).toBe(false);
    });

    test("resolveAuthUtils prefers explicit utils", () => {
        const explicitUtils = { name: "explicit" };
        window.authUtils = { name: "window" };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
    });

    test("resolveAuthUtils falls back to window.authUtils", () => {
        window.authUtils = { name: "window-utils" };

        expect(resolveAuthUtils()).toBe(window.authUtils);
    });

    test("resolveAuthUtils returns null when nothing is available", () => {
        expect(resolveAuthUtils()).toBeNull();
    });

    test("getPortalRoute uses authUtils.getPortalRoute when available", () => {
        const authUtils = {
            getPortalRoute: jest.fn((portal) => `/custom/${portal}.html`)
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(authUtils.getPortalRoute).toHaveBeenCalledWith("customer");
    });

    test("getPortalRoute uses authUtils.PORTAL_ROUTES when getPortalRoute is absent", () => {
        const authUtils = {
            PORTAL_ROUTES: {
                customer: "/customer-home.html",
                vendor: "/vendor-home.html",
                admin: "/admin-home.html",
                roleChoice: "/role-choice.html",
                login: "/login.html"
            }
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/customer-home.html");
        expect(getPortalRoute("vendor", authUtils)).toBe("/vendor-home.html");
        expect(getPortalRoute("admin", authUtils)).toBe("/admin-home.html");
        expect(getPortalRoute("roleChoice", authUtils)).toBe("/role-choice.html");
        expect(getPortalRoute("login", authUtils)).toBe("/login.html");
    });

    test("getPortalRoute falls back to default routes", () => {
        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("../vendor/index.html");
        expect(getPortalRoute("admin")).toBe("../admin/index.html");
        expect(getPortalRoute("roleChoice")).toBe("../authentication/role-choice.html");
        expect(getPortalRoute("unknown")).toBe("../authentication/login.html");
    });

    test("setStatusMessage updates text and state", () => {
        const { statusElement } = createRoleChoiceDom();

        setStatusMessage(statusElement, "Saved.", "success");

        expect(statusElement.textContent).toBe("Saved.");
        expect(statusElement.dataset.state).toBe("success");
    });

    test("setStatusMessage does nothing when no element is passed", () => {
        expect(() => setStatusMessage(null, "Saved.", "success")).not.toThrow();
    });

    test("setButtonState disables and enables button", () => {
        const { customerButton } = createRoleChoiceDom();

        setButtonState(customerButton, true);
        expect(customerButton.disabled).toBe(true);

        setButtonState(customerButton, false);
        expect(customerButton.disabled).toBe(false);
    });

    test("setButtonState does nothing when button is missing", () => {
        expect(() => setButtonState(null, true)).not.toThrow();
    });

    test("setElementHidden updates hidden and aria-hidden", () => {
        const { customerSection } = createRoleChoiceDom();

        setElementHidden(customerSection, true);
        expect(customerSection.hidden).toBe(true);
        expect(customerSection.getAttribute("aria-hidden")).toBe("true");

        setElementHidden(customerSection, false);
        expect(customerSection.hidden).toBe(false);
        expect(customerSection.getAttribute("aria-hidden")).toBe("false");
    });

    test("setElementText updates text content", () => {
        const { summaryElement } = createRoleChoiceDom();

        setElementText(summaryElement, "Portal summary");
        expect(summaryElement.textContent).toBe("Portal summary");
    });

    test("hasAuthenticatedIdentity returns true for uid, email or phone", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({ email: "user@example.com" })).toBe(true);
        expect(hasAuthenticatedIdentity({ phoneNumber: "+27712345678" })).toBe(true);
    });

    test("hasAuthenticatedIdentity returns false when identity is missing", () => {
        expect(hasAuthenticatedIdentity({})).toBe(false);
    });
});

describe("role-choice.js profile and access helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("normalizeUserProfile uses authUtils.normaliseUserData when available", () => {
        const normalized = {
            uid: "user-1",
            email: "user@example.com",
            isAdmin: true,
            isOwner: false,
            vendorStatus: "approved",
            vendorReason: "",
            accountStatus: "active"
        };

        const authUtils = {
            normaliseUserData: jest.fn(() => normalized)
        };

        const result = normalizeUserProfile({ uid: "raw-user" }, authUtils);

        expect(result).toBe(normalized);
        expect(authUtils.normaliseUserData).toHaveBeenCalledWith({ uid: "raw-user" });
    });

    test("normalizeUserProfile falls back to local normalization", () => {
        const result = normalizeUserProfile({
            uid: " user-1 ",
            displayName: " Faranani ",
            email: " USER@Example.com ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/photo.jpg ",
            owner: true,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            accountStatus: "inactive"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/photo.jpg",
            isAdmin: true,
            isOwner: true,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            accountStatus: "active"
        });
    });

    test("canAccessCustomerPortal allows active authenticated users", () => {
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
    });

    test("canAccessCustomerPortal blocks inactive users", () => {
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);
    });

    test("canAccessVendorPortal allows approved vendors and owners", () => {
        expect(canAccessVendorPortal({ uid: "user-1", vendorStatus: "approved" })).toBe(true);
        expect(canAccessVendorPortal({ isOwner: true, vendorStatus: "none" })).toBe(true);
    });

    test("canAccessVendorPortal blocks pending vendors and plain admins", () => {
        expect(canAccessVendorPortal({ uid: "user-1", vendorStatus: "pending" })).toBe(false);
        expect(canAccessVendorPortal({ isAdmin: true, vendorStatus: "none" })).toBe(false);
    });

    test("canAccessAdminPortal allows admins and owners", () => {
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isOwner: true, accountStatus: "active" })).toBe(true);
    });

    test("canAccessAdminPortal blocks inactive admins", () => {
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("getAvailablePortals uses authUtils.getAvailablePortals when available", () => {
        const authUtils = {
            getAvailablePortals: jest.fn(() => ["customer", "admin"])
        };

        const result = getAvailablePortals({ uid: "user-1" }, authUtils);

        expect(result).toEqual(["customer", "admin"]);
    });

    test("getAvailablePortals falls back to local access logic", () => {
        expect(
            getAvailablePortals({
                uid: "user-1",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        ).toEqual(["customer", "vendor"]);

        expect(
            getAvailablePortals({
                isAdmin: true,
                accountStatus: "active"
            })
        ).toEqual(["customer", "admin"]);
    });

    test("shouldGoToRoleChoice uses authUtils when available", () => {
        const authUtils = {
            shouldGoToRoleChoice: jest.fn(() => true)
        };

        expect(shouldGoToRoleChoice({ uid: "user-1" }, authUtils)).toBe(true);
        expect(authUtils.shouldGoToRoleChoice).toHaveBeenCalledWith({ uid: "user-1" });
    });

    test("shouldGoToRoleChoice falls back to number of available portals", () => {
        expect(
            shouldGoToRoleChoice({
                uid: "user-1",
                vendorStatus: "approved"
            })
        ).toBe(true);

        expect(
            shouldGoToRoleChoice({
                uid: "user-1",
                vendorStatus: "none"
            })
        ).toBe(false);
    });

    test("getDefaultPortalRoute uses authUtils when available", () => {
        const authUtils = {
            getDefaultPortalRoute: jest.fn(() => "/special-default.html")
        };

        expect(getDefaultPortalRoute({ uid: "user-1" }, authUtils)).toBe("/special-default.html");
    });

    test("getDefaultPortalRoute falls back to login, single portal, or role-choice", () => {
        expect(getDefaultPortalRoute({})).toBe("../authentication/login.html");
        expect(getDefaultPortalRoute({ uid: "user-1" })).toBe("../customer/index.html");
        expect(
            getDefaultPortalRoute({
                uid: "user-1",
                vendorStatus: "approved"
            })
        ).toBe("../authentication/role-choice.html");
    });

    test("getRoleChoiceState returns a full derived state", () => {
        const state = getRoleChoiceState({
            uid: "user-1",
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(state.availablePortals).toEqual(["customer", "vendor"]);
        expect(state.needsChoice).toBe(true);
        expect(state.defaultRoute).toBe("../authentication/role-choice.html");
        expect(state.canAccessCustomer).toBe(true);
        expect(state.canAccessVendor).toBe(true);
        expect(state.canAccessAdmin).toBe(false);
    });

    test("getPortalSummaryText returns correct messages", () => {
        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "vendor", "admin"],
                profile: {}
            })
        ).toBe("You have access to the customer, vendor, and admin portals.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "admin"],
                profile: {}
            })
        ).toBe("You have access to the customer and admin portals.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "vendor"],
                profile: {}
            })
        ).toBe("You have access to the customer and vendor portals.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer"],
                profile: {}
            })
        ).toBe("You only have customer access.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "vendor", "admin"],
                profile: { isOwner: true }
            })
        ).toBe("You have owner access. Choose which portal you want to open.");

        expect(getPortalSummaryText({ availablePortals: [], profile: {} })).toBe(
            "You do not currently have access to any portal."
        );
    });

    test("canAccessPortal checks whether a specific portal is available", () => {
        const profile = {
            uid: "user-1",
            vendorStatus: "approved",
            accountStatus: "active"
        };

        expect(canAccessPortal("customer", profile)).toBe(true);
        expect(canAccessPortal("vendor", profile)).toBe(true);
        expect(canAccessPortal("admin", profile)).toBe(false);
    });
});

describe("role-choice.js service submission", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("submitPortalChoice returns error for invalid portal", async () => {
        const result = await submitPortalChoice("roleChoice", {});

        expect(result).toEqual({
            success: false,
            message: "Please choose a valid portal."
        });
    });

    test("submitPortalChoice throws when getCurrentUser is missing", async () => {
        await expect(
            submitPortalChoice("customer", {
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("submitPortalChoice throws when getCurrentUserProfile is missing", async () => {
        await expect(
            submitPortalChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("submitPortalChoice returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await submitPortalChoice("customer", { authService });

        expect(result).toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });
    });

    test("submitPortalChoice returns error when user cannot access chosen portal", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const result = await submitPortalChoice("vendor", { authService });

        expect(result).toEqual({
            success: false,
            message: "You do not have access to that portal."
        });
    });

    test("submitPortalChoice succeeds for allowed portal", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const result = await submitPortalChoice("vendor", { authService });

        expect(result.success).toBe(true);
        expect(result.portal).toBe("vendor");
        expect(result.nextRoute).toBe("../vendor/index.html");
        expect(result.profile.uid).toBe("user-2");
        expect(result.profile.vendorStatus).toBe("approved");
    });

    test("submitPortalChoice uses fallback profile from current user when profile is missing", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3",
                displayName: "Fallback User",
                email: "fallback@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue(null)
        };

        const result = await submitPortalChoice("customer", { authService });

        expect(result.success).toBe(true);
        expect(result.portal).toBe("customer");
        expect(result.nextRoute).toBe("../customer/index.html");
        expect(result.profile.uid).toBe("user-3");
        expect(result.profile.email).toBe("fallback@example.com");
    });
});

describe("role-choice.js DOM rendering and handlers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("getPortalDisplayElement prefers the section element", () => {
        const { customerSection, customerButton } = createRoleChoiceDom();

        expect(getPortalDisplayElement(customerSection, customerButton)).toBe(customerSection);
    });

    test("getPortalDisplayElement falls back to closest section or button", () => {
        const { customerButton, customerSection } = createRoleChoiceDom();

        expect(getPortalDisplayElement(null, customerButton)).toBe(customerSection);

        const lonelyButton = document.createElement("button");
        document.body.appendChild(lonelyButton);

        expect(getPortalDisplayElement(null, lonelyButton)).toBe(lonelyButton);
        expect(getPortalDisplayElement(null, null)).toBeNull();
    });

    test("renderRoleChoicePage shows the correct sections and messages", () => {
        const elements = createRoleChoiceDom();

        renderRoleChoicePage(elements, {
            profile: {
                vendorStatus: "rejected",
                vendorReason: "Missing documents"
            },
            canAccessCustomer: true,
            canAccessVendor: false,
            canAccessAdmin: true,
            needsChoice: true,
            availablePortals: ["customer", "admin"]
        });

        expect(elements.customerSection.hidden).toBe(false);
        expect(elements.vendorSection.hidden).toBe(true);
        expect(elements.adminSection.hidden).toBe(false);

        expect(elements.statusElement.textContent).toBe("Choose a portal to continue.");
        expect(elements.statusElement.dataset.state).toBe("info");
        expect(elements.summaryElement.textContent).toBe(
            "You have access to the customer and admin portals."
        );
        expect(elements.vendorStateElement.textContent).toBe(
            "Your vendor application was rejected: Missing documents"
        );

        expect(elements.customerButton.dataset.portal).toBe("customer");
        expect(elements.customerButton.textContent).toBe("Continue to Customer Portal");
        expect(elements.vendorButton.dataset.portal).toBe("vendor");
        expect(elements.vendorButton.textContent).toBe("Continue to Vendor Portal");
        expect(elements.adminButton.dataset.portal).toBe("admin");
        expect(elements.adminButton.textContent).toBe("Continue to Admin Portal");
    });

    test("renderRoleChoicePage shows blocked vendor message", () => {
        const elements = createRoleChoiceDom();

        renderRoleChoicePage(elements, {
            profile: {
                vendorStatus: "blocked",
                vendorReason: "Policy violation"
            },
            canAccessCustomer: true,
            canAccessVendor: false,
            canAccessAdmin: false,
            needsChoice: false,
            availablePortals: ["customer"]
        });

        expect(elements.vendorStateElement.textContent).toBe(
            "Your vendor access is blocked: Policy violation"
        );
    });

    test("renderRoleChoicePage shows pending vendor message", () => {
        const elements = createRoleChoiceDom();

        renderRoleChoicePage(elements, {
            profile: {
                vendorStatus: "pending"
            },
            canAccessCustomer: true,
            canAccessVendor: false,
            canAccessAdmin: false,
            needsChoice: false,
            availablePortals: ["customer"]
        });

        expect(elements.vendorStateElement.textContent).toBe(
            "Your vendor application is still pending approval."
        );
    });

    test("renderRoleChoicePage handles missing state", () => {
        const { statusElement } = createRoleChoiceDom();

        renderRoleChoicePage({ statusElement }, null);

        expect(statusElement.textContent).toBe("Unable to load portal access.");
        expect(statusElement.dataset.state).toBe("error");
    });

    test("attachPortalChoiceHandler handles successful portal choice", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-4"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

        const { handleClick } = attachPortalChoiceHandler({
            button: customerButton,
            portal: "customer",
            authService,
            statusElement,
            onSuccess,
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe("Opening portal...");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(customerButton.disabled).toBe(false);
    });

    test("attachPortalChoiceHandler shows returned service errors", async () => {
        const { vendorButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-5"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-5",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const onError = jest.fn();

        const { handleClick } = attachPortalChoiceHandler({
            button: vendorButton,
            portal: "vendor",
            authService,
            statusElement,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(statusElement.textContent).toBe("You do not have access to that portal.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(vendorButton.disabled).toBe(false);
    });

    test("attachPortalChoiceHandler handles thrown errors", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => {
                throw new Error("Unexpected failure");
            }),
            getCurrentUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleClick } = attachPortalChoiceHandler({
            button: customerButton,
            portal: "customer",
            authService,
            statusElement,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Unexpected failure");
        expect(statusElement.textContent).toBe("Unexpected failure");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(customerButton.disabled).toBe(false);
    });

    test("attachPortalChoiceHandler throws if button is missing", () => {
        expect(() =>
            attachPortalChoiceHandler({
                button: null,
                portal: "customer",
                authService: {}
            })
        ).toThrow("A portal button is required.");
    });

    test("attachPortalChoiceHandler throws if portal is invalid", () => {
        const { customerButton } = createRoleChoiceDom();

        expect(() =>
            attachPortalChoiceHandler({
                button: customerButton,
                portal: "roleChoice",
                authService: {}
            })
        ).toThrow("A valid portal is required.");
    });

    test("attachPortalChoiceHandler throws if authService is missing", () => {
        const { customerButton } = createRoleChoiceDom();

        expect(() =>
            attachPortalChoiceHandler({
                button: customerButton,
                portal: "customer"
            })
        ).toThrow("authService is required.");
    });

    test("attached click listener works through a real button click", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-6",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const navigate = jest.fn();

        attachPortalChoiceHandler({
            button: customerButton,
            portal: "customer",
            authService,
            statusElement,
            navigate
        });

        customerButton.click();
        await flushPromises();

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Opening portal...");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });
});

describe("role-choice.js page loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("loadRoleChoiceState returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadRoleChoiceState({ authService });

        expect(result).toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });
    });

    test("loadRoleChoiceState throws when authService is missing", async () => {
        await expect(loadRoleChoiceState({})).rejects.toThrow("authService is required.");
    });

    test("loadRoleChoiceState throws when getCurrentUserProfile is missing", async () => {
        await expect(
            loadRoleChoiceState({
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadRoleChoiceState builds fallback profile when Firestore profile is missing", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-7",
                displayName: "Fallback Name",
                email: "fallback@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue(null)
        };

        const result = await loadRoleChoiceState({ authService });

        expect(result.success).toBe(true);
        expect(result.user.uid).toBe("user-7");
        expect(result.profile.uid).toBe("user-7");
        expect(result.profile.email).toBe("fallback@example.com");
        expect(result.state.availablePortals).toEqual(["customer"]);
    });

    test("initializeRoleChoicePage redirects customer-only users immediately", async () => {
        createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-8"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-8",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const navigate = jest.fn();

        const result = await initializeRoleChoicePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("initializeRoleChoicePage renders and wires buttons when choice is needed", async () => {
        const {
            statusElement,
            summaryElement,
            vendorButton,
            adminSection
        } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-9"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-9",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const navigate = jest.fn();

        const result = await initializeRoleChoicePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(false);
        expect(result.customerController).toBeTruthy();
        expect(result.vendorController).toBeTruthy();
        expect(result.adminController).toBeNull();

        expect(statusElement.textContent).toBe("Choose a portal to continue.");
        expect(summaryElement.textContent).toBe(
            "You have access to the customer and vendor portals."
        );
        expect(adminSection.hidden).toBe(true);

        vendorButton.click();
        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");
    });

    test("initializeRoleChoicePage redirects signed-out users to login", async () => {
        createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const navigate = jest.fn();

        const result = await initializeRoleChoicePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(true);
        expect(result.nextRoute).toBe("../authentication/login.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
    });

    test("initializeRoleChoicePage returns error info when loading fails", async () => {
        const { statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-10"
            })),
            getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile"))
        };

        const result = await initializeRoleChoicePage({
            authService
        });

        expect(result.redirected).toBe(false);
        expect(result.message).toBe("Failed to load profile");
        expect(statusElement.textContent).toBe("Failed to load profile");
        expect(statusElement.dataset.state).toBe("error");
    });

    test("initializeRoleChoicePage throws when authService is missing", async () => {
        await expect(initializeRoleChoicePage()).rejects.toThrow("authService is required.");
    });
});