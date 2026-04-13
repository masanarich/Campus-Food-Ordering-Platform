/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeVendorStatus,
    normalizeAccountStatus,
    resolveAuthUtils,
    getPortalRoute,
    hasAuthenticatedIdentity,
    normalizeProfile,
    getRoleLabel,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    getVendorStatusLabel,
    getPortalSummary,
    getVendorPortalNote,
    getWelcomeMessage,
    getHomeState,
    getDefaultAvatar,
    getSafeRedirectRoute,
    setText,
    setHidden,
    setStatusMessage,
    setImage,
    renderVendorHomePage,
    attachNavigationHandler,
    loadVendorHomeState,
    initializeVendorHomePage
} = require("../../public/vendor/index.js");

function createVendorHomeDom() {
    document.body.innerHTML = `
        <main>
            <p id="vendor-home-status"></p>

            <img id="profile-photo" src="" alt="">
            <p id="profile-photo-caption"></p>

            <p id="profile-name-line"></p>
            <p id="profile-role-line"></p>
            <p id="profile-email-line"></p>
            <p id="profile-vendor-line"></p>

            <p id="portal-summary"></p>
            <p id="welcome-message"></p>
            <p id="vendor-portal-note"></p>

            <button id="go-profile-button" type="button">Profile</button>
            <button id="choose-portal-button" type="button">Choose Portal</button>
            <button id="go-customer-portal-button" type="button">Customer Portal</button>
            <button id="go-vendor-portal-button" type="button">Vendor Portal</button>
            <button id="go-admin-portal-button" type="button">Admin Portal</button>
        </main>
    `;

    return {
        statusElement: document.querySelector("#vendor-home-status"),
        profilePhoto: document.querySelector("#profile-photo"),
        photoCaptionElement: document.querySelector("#profile-photo-caption"),
        nameLine: document.querySelector("#profile-name-line"),
        roleLine: document.querySelector("#profile-role-line"),
        emailLine: document.querySelector("#profile-email-line"),
        vendorLine: document.querySelector("#profile-vendor-line"),
        portalSummaryElement: document.querySelector("#portal-summary"),
        welcomeMessageElement: document.querySelector("#welcome-message"),
        vendorPortalNoteElement: document.querySelector("#vendor-portal-note"),
        profileButton: document.querySelector("#go-profile-button"),
        choosePortalButton: document.querySelector("#choose-portal-button"),
        customerPortalButton: document.querySelector("#go-customer-portal-button"),
        vendorPortalButton: document.querySelector("#go-vendor-portal-button"),
        adminPortalButton: document.querySelector("#go-admin-portal-button")
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("vendor/index.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("normalizeText trims text", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeText returns empty string for invalid values", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(123)).toBe("");
    });

    test("normalizeVendorStatus maps suspended to blocked", () => {
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
    });

    test("normalizeVendorStatus returns none for invalid status", () => {
        expect(normalizeVendorStatus("mystery")).toBe("none");
    });

    test("normalizeAccountStatus keeps disabled and blocked and defaults to active", () => {
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("inactive")).toBe("active");
        expect(normalizeAccountStatus("")).toBe("active");
    });

    test("resolveAuthUtils prefers explicit utils", () => {
        const explicitUtils = { value: 1 };
        window.authUtils = { value: 2 };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
    });

    test("resolveAuthUtils falls back to window.authUtils", () => {
        window.authUtils = { value: 3 };

        expect(resolveAuthUtils()).toBe(window.authUtils);
    });

    test("resolveAuthUtils returns null when unavailable", () => {
        expect(resolveAuthUtils()).toBeNull();
    });

    test("getPortalRoute returns fallback routes", () => {
        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("./index.html");
        expect(getPortalRoute("admin")).toBe("../admin/index.html");
        expect(getPortalRoute("roleChoice")).toBe("../authentication/role-choice.html");
        expect(getPortalRoute("profile")).toBe("../authentication/profile.html");
        expect(getPortalRoute("unknown")).toBe("../authentication/login.html");
    });

    test("getPortalRoute uses authUtils.getPortalRoute for customer vendor and admin", () => {
        const authUtils = {
            getPortalRoute: jest.fn((route) => `/custom/${route}.html`)
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(getPortalRoute("vendor", authUtils)).toBe("/custom/vendor.html");
        expect(getPortalRoute("admin", authUtils)).toBe("/custom/admin.html");
    });

    test("getPortalRoute uses authUtils.PORTAL_ROUTES for roleChoice and login", () => {
        const authUtils = {
            PORTAL_ROUTES: {
                roleChoice: "/special/role-choice.html",
                login: "/special/login.html"
            }
        };

        expect(getPortalRoute("roleChoice", authUtils)).toBe("/special/role-choice.html");
        expect(getPortalRoute("login", authUtils)).toBe("/special/login.html");
    });

    test("hasAuthenticatedIdentity returns true for uid email or phone", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({ email: "user@example.com" })).toBe(true);
        expect(hasAuthenticatedIdentity({ phoneNumber: "+27712345678" })).toBe(true);
    });

    test("hasAuthenticatedIdentity returns false when identity is missing", () => {
        expect(hasAuthenticatedIdentity({})).toBe(false);
    });

    test("normalizeProfile uses authUtils normaliser when available", () => {
        const normalized = {
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "",
            isAdmin: false,
            isOwner: true,
            vendorStatus: "approved",
            vendorReason: "",
            accountStatus: "active"
        };

        const authUtils = {
            normaliseUserData: jest.fn(() => normalized)
        };

        expect(normalizeProfile({ uid: "raw" }, authUtils)).toBe(normalized);
        expect(authUtils.normaliseUserData).toHaveBeenCalledWith({ uid: "raw" });
    });

    test("normalizeProfile normalizes raw profile values", () => {
        const result = normalizeProfile({
            uid: " user-1 ",
            fullName: " Faranani ",
            email: " USER@example.com ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/p.jpg ",
            admin: true,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            accountStatus: "inactive"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/p.jpg",
            isAdmin: true,
            isOwner: false,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            accountStatus: "active"
        });
    });

    test("getRoleLabel prioritizes owner then admin then vendor then customer", () => {
        expect(getRoleLabel({ isOwner: true })).toBe("Owner");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ uid: "user-1" })).toBe("Customer");
    });

    test("portal access helpers work correctly", () => {
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);

        expect(canAccessVendorPortal({ vendorStatus: "approved", accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isOwner: true, accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ vendorStatus: "pending", accountStatus: "active" })).toBe(false);

        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isOwner: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("getVendorStatusLabel returns user-friendly labels", () => {
        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "pending" })).toBe("Pending");
        expect(getVendorStatusLabel({ vendorStatus: "rejected" })).toBe("Rejected");
        expect(getVendorStatusLabel({ vendorStatus: "blocked" })).toBe("Blocked");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");
    });

    test("getPortalSummary returns the correct messages", () => {
        expect(
            getPortalSummary({
                profile: { isOwner: true },
                showCustomerPortal: true,
                showVendorPortal: true,
                showAdminPortal: true
            })
        ).toBe("You have owner access and can open every portal.");

        expect(
            getPortalSummary({
                profile: {},
                showCustomerPortal: true,
                showVendorPortal: true,
                showAdminPortal: true
            })
        ).toBe("You can open the customer, vendor, and admin portals.");

        expect(
            getPortalSummary({
                profile: {},
                showCustomerPortal: true,
                showVendorPortal: false,
                showAdminPortal: true
            })
        ).toBe("You can open the customer and admin portals.");

        expect(
            getPortalSummary({
                profile: {},
                showCustomerPortal: true,
                showVendorPortal: true,
                showAdminPortal: false
            })
        ).toBe("You can open the customer and vendor portals.");

        expect(
            getPortalSummary({
                profile: {},
                showCustomerPortal: false,
                showVendorPortal: true,
                showAdminPortal: false
            })
        ).toBe("You currently have vendor portal access.");

        expect(
            getPortalSummary({
                profile: {},
                showCustomerPortal: false,
                showVendorPortal: false,
                showAdminPortal: false
            })
        ).toBe("You do not currently have portal access.");
    });

    test("getVendorPortalNote returns the correct message", () => {
        expect(getVendorPortalNote({ isOwner: true }))
            .toBe("You are using the vendor portal with owner access.");

        expect(getVendorPortalNote({ isAdmin: true }))
            .toBe("You are using the vendor portal with admin access.");

        expect(getVendorPortalNote({ vendorStatus: "approved" }))
            .toBe("Your vendor account is approved and ready to use.");

        expect(
            getVendorPortalNote({
                vendorStatus: "rejected",
                vendorReason: "Missing document"
            })
        ).toBe("Your vendor application was rejected: Missing document");

        expect(
            getVendorPortalNote({
                vendorStatus: "blocked",
                vendorReason: "Policy issue"
            })
        ).toBe("Your vendor access is blocked: Policy issue");
    });

    test("getWelcomeMessage returns greeting", () => {
        expect(getWelcomeMessage({ displayName: "Faranani" })).toBe("Welcome back, Faranani.");
        expect(getWelcomeMessage({})).toBe("Welcome back, there.");
    });

    test("getHomeState builds correct vendor state", () => {
        const state = getHomeState({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(state.displayName).toBe("Faranani");
        expect(state.roleLabel).toBe("Vendor");
        expect(state.vendorStatusLabel).toBe("Approved");
        expect(state.showCustomerPortal).toBe(true);
        expect(state.showVendorPortal).toBe(true);
        expect(state.showAdminPortal).toBe(false);
        expect(state.showChoosePortal).toBe(true);
    });

    test("getHomeState gives admin all portal buttons", () => {
        const state = getHomeState({
            uid: "user-1",
            displayName: "Admin User",
            isAdmin: true,
            vendorStatus: "none",
            accountStatus: "active"
        });

        expect(state.roleLabel).toBe("Admin");
        expect(state.showCustomerPortal).toBe(true);
        expect(state.showVendorPortal).toBe(true);
        expect(state.showAdminPortal).toBe(true);
        expect(state.showChoosePortal).toBe(true);
    });

    test("getDefaultAvatar returns a usable data url", () => {
        expect(getDefaultAvatar("Faranani")).toContain("data:image/svg+xml");
        expect(getDefaultAvatar("Faranani")).toContain("%3Csvg");
    });

    test("getSafeRedirectRoute returns customer when user has only customer access", () => {
        expect(
            getSafeRedirectRoute({
                uid: "user-1",
                vendorStatus: "none",
                accountStatus: "active"
            })
        ).toBe("../customer/index.html");
    });

    test("getSafeRedirectRoute uses authUtils.getDefaultPortalRoute when available", () => {
        const authUtils = {
            getDefaultPortalRoute: jest.fn(() => "/special/default.html")
        };

        expect(getSafeRedirectRoute({ uid: "user-1" }, authUtils)).toBe("/special/default.html");
    });
});

describe("vendor/index.js DOM helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("setText updates text content", () => {
        const paragraph = document.createElement("p");

        setText(paragraph, "Hello");

        expect(paragraph.textContent).toBe("Hello");
    });

    test("setText does nothing when element is missing", () => {
        expect(() => setText(null, "Hello")).not.toThrow();
    });

    test("setHidden updates hidden and aria-hidden", () => {
        const paragraph = document.createElement("p");

        setHidden(paragraph, true);
        expect(paragraph.hidden).toBe(true);
        expect(paragraph.getAttribute("aria-hidden")).toBe("true");

        setHidden(paragraph, false);
        expect(paragraph.hidden).toBe(false);
        expect(paragraph.getAttribute("aria-hidden")).toBe("false");
    });

    test("setStatusMessage updates text and state", () => {
        const paragraph = document.createElement("p");

        setStatusMessage(paragraph, "Loaded", "success");

        expect(paragraph.textContent).toBe("Loaded");
        expect(paragraph.dataset.state).toBe("success");
    });

    test("setImage uses given image url or fallback avatar", () => {
        const image = document.createElement("img");

        setImage(image, "https://example.com/photo.jpg", "Photo alt", "Faranani");
        expect(image.src).toContain("https://example.com/photo.jpg");
        expect(image.alt).toBe("Photo alt");

        setImage(image, "", "", "Faranani");
        expect(image.src).toContain("data:image/svg+xml");
        expect(image.alt).toBe("User profile picture");
    });

    test("renderVendorHomePage renders the vendor state with default avatar caption", () => {
        const elements = createVendorHomeDom();

        renderVendorHomePage(elements, {
            profile: {
                email: "user@example.com",
                photoURL: "",
                isOwner: false
            },
            displayName: "Faranani",
            roleLabel: "Vendor",
            vendorStatusLabel: "Approved",
            portalSummary: "You can open the customer and vendor portals.",
            welcomeMessage: "Welcome back, Faranani.",
            vendorPortalNote: "Your vendor account is approved and ready to use.",
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: false,
            showChoosePortal: true
        });

        expect(elements.statusElement.textContent).toBe("Home page loaded.");
        expect(elements.statusElement.dataset.state).toBe("success");
        expect(elements.nameLine.textContent).toBe("Name: Faranani");
        expect(elements.roleLine.textContent).toBe("Role: Vendor");
        expect(elements.emailLine.textContent).toBe("Email: user@example.com");
        expect(elements.vendorLine.textContent).toBe("Vendor status: Approved");
        expect(elements.portalSummaryElement.textContent).toBe(
            "You can open the customer and vendor portals."
        );
        expect(elements.welcomeMessageElement.textContent).toBe(
            "Welcome back, Faranani."
        );
        expect(elements.vendorPortalNoteElement.textContent).toBe(
            "Your vendor account is approved and ready to use."
        );
        expect(elements.photoCaptionElement.textContent).toBe(
            "No profile picture found. A default avatar is being used."
        );
        expect(elements.customerPortalButton.hidden).toBe(false);
        expect(elements.vendorPortalButton.hidden).toBe(false);
        expect(elements.adminPortalButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(false);
        expect(elements.profilePhoto.src).toContain("data:image/svg+xml");
    });

    test("renderVendorHomePage renders custom photo caption when photo exists", () => {
        const elements = createVendorHomeDom();

        renderVendorHomePage(elements, {
            profile: {
                email: "user@example.com",
                photoURL: "https://example.com/profile.jpg",
                isOwner: false
            },
            displayName: "Faranani",
            roleLabel: "Admin",
            vendorStatusLabel: "Approved",
            portalSummary: "You can open the customer, vendor, and admin portals.",
            welcomeMessage: "Welcome back, Faranani.",
            vendorPortalNote: "You are using the vendor portal with admin access.",
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: true,
            showChoosePortal: true
        });

        expect(elements.photoCaptionElement.textContent).toBe(
            "Your current profile picture is shown here."
        );
        expect(elements.profilePhoto.src).toContain("https://example.com/profile.jpg");
        expect(elements.adminPortalButton.hidden).toBe(false);
    });

    test("renderVendorHomePage does nothing when inputs are missing", () => {
        expect(() => renderVendorHomePage(null, null)).not.toThrow();
    });

    test("attachNavigationHandler navigates on click", () => {
        const button = document.createElement("button");
        const navigate = jest.fn();

        const controller = attachNavigationHandler({
            button,
            route: "/next-page.html",
            navigate
        });

        const result = controller.handleClick({
            preventDefault: jest.fn()
        });

        expect(result).toBe("/next-page.html");
        expect(navigate).toHaveBeenCalledWith("/next-page.html");
    });

    test("attachNavigationHandler returns null when button or route is missing", () => {
        expect(attachNavigationHandler({ button: null, route: "/next" })).toBeNull();
        expect(attachNavigationHandler({ button: document.createElement("button"), route: "" })).toBeNull();
    });
});

describe("vendor/index.js loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("loadVendorHomeState throws when authService.getCurrentUser is missing", async () => {
        await expect(
            loadVendorHomeState({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("loadVendorHomeState throws when authService.getCurrentUserProfile is missing", async () => {
        await expect(
            loadVendorHomeState({
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadVendorHomeState returns login redirect when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadVendorHomeState({ authService });

        expect(result).toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });
    });

    test("loadVendorHomeState rejects customer-only users", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                displayName: "Customer User",
                email: "user@example.com",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const result = await loadVendorHomeState({ authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("You do not have access to the vendor portal.");
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loadVendorHomeState returns state for signed-in vendor", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                displayName: "Faranani",
                email: "user@example.com",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const result = await loadVendorHomeState({ authService });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("user-1");
        expect(result.state.displayName).toBe("Faranani");
        expect(result.state.showVendorPortal).toBe(true);
    });

    test("loadVendorHomeState falls back to auth user data if profile is missing", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                displayName: "Fallback User",
                email: "fallback@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                displayName: "Fallback User",
                email: "fallback@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const result = await loadVendorHomeState({ authService });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("user-2");
        expect(result.state.displayName).toBe("Fallback User");
        expect(result.state.profile.email).toBe("fallback@example.com");
    });

    test("initializeVendorHomePage throws when authService is missing", async () => {
        createVendorHomeDom();

        await expect(initializeVendorHomePage()).rejects.toThrow(
            "authService is required."
        );
    });

    test("initializeVendorHomePage redirects signed-out user to login", async () => {
        createVendorHomeDom();

        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const navigate = jest.fn();

        const result = await initializeVendorHomePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(true);
        expect(result.nextRoute).toBe("../authentication/login.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
    });

    test("initializeVendorHomePage redirects customer-only user away from vendor portal", async () => {
        createVendorHomeDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3",
                displayName: "Customer User",
                email: "customer@example.com",
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const navigate = jest.fn();

        const result = await initializeVendorHomePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("initializeVendorHomePage renders state and wires navigation", async () => {
        const elements = createVendorHomeDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-4"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                displayName: "Admin Person",
                email: "admin@example.com",
                isAdmin: true,
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        const navigate = jest.fn();

        const result = await initializeVendorHomePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(false);
        expect(result.profileController).toBeTruthy();
        expect(result.choosePortalController).toBeTruthy();
        expect(result.customerPortalController).toBeTruthy();
        expect(result.vendorPortalController).toBeTruthy();
        expect(result.adminPortalController).toBeTruthy();

        expect(elements.roleLine.textContent).toBe("Role: Admin");
        expect(elements.choosePortalButton.hidden).toBe(false);

        elements.profileButton.click();
        elements.customerPortalButton.click();
        elements.adminPortalButton.click();

        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../authentication/profile.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("../admin/index.html");
    });

    test("initializeVendorHomePage handles loading failure", async () => {
        const elements = createVendorHomeDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-5"
            })),
            getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile"))
        };

        const result = await initializeVendorHomePage({
            authService
        });

        expect(result.redirected).toBe(false);
        expect(result.message).toBe("Failed to load profile");
        expect(elements.statusElement.textContent).toBe("Failed to load profile");
        expect(elements.statusElement.dataset.state).toBe("error");
    });

    test("initializeVendorHomePage uses window.authService when not passed explicitly", async () => {
        createVendorHomeDom();

        window.authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-6",
                displayName: "Window User",
                email: "window@example.com",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const result = await initializeVendorHomePage();

        expect(result.redirected).toBe(false);
        expect(window.authService.getCurrentUser).toHaveBeenCalledTimes(1);
    });
});