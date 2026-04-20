/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeLowerText,
    normalizeVendorStatus,
    normalizeAdminApplicationStatus,
    normalizeAccountStatus,
    resolveAuthUtils,
    getFallbackRoutes,
    getPortalRoute,
    hasAuthenticatedIdentity,
    normalizeProfile,
    getRoleLabel,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    canApplyForVendor,
    canApplyForAdmin,
    getVendorStatusLabel,
    getAdminStatusLabel,
    getAccessSummary,
    getVendorApplicationNote,
    getAdminApplicationNote,
    getApplicationActionConfig,
    getWelcomeMessage,
    getHomeState,
    getDefaultAvatar,
    setText,
    setHidden,
    setStatusMessage,
    setImage,
    renderCustomerHomePage,
    attachNavigationHandler,
    attachSignOutHandler,
    loadCustomerHomeState,
    initializeCustomerHomePage
} = require("../../public/customer/index.js");

function createCustomerHomeDom() {
    document.body.innerHTML = `
        <main>
            <p id="customer-home-status"></p>

            <img id="profile-photo" src="" alt="">
            <p id="profile-photo-caption"></p>

            <output id="profile-name-line"></output>
            <output id="profile-role-line"></output>
            <output id="profile-email-line"></output>
            <output id="profile-vendor-line"></output>
            <output id="profile-admin-line"></output>

            <p id="access-summary"></p>
            <p id="welcome-message"></p>
            <p id="vendor-application-note"></p>
            <p id="admin-application-note"></p>

            <button id="go-profile-button" type="button">Profile</button>
            <button id="choose-portal-button" type="button">Choose Portal</button>
            <button id="go-vendor-application-button" type="button">Vendor</button>
            <button id="go-admin-application-button" type="button">Admin</button>
            <button id="browse-stores-button" type="button">Stores</button>
            <button id="view-orders-button" type="button">Orders</button>
            <button id="get-support-button" type="button">Support</button>
            <button id="sign-out-button" type="button">Sign out</button>

            <button id="go-customer-portal-button" type="button">Customer</button>
            <button id="go-vendor-portal-button" type="button">Vendor Portal</button>
            <button id="go-admin-portal-button" type="button">Admin Portal</button>
        </main>
    `;

    return {
        statusElement: document.querySelector("#customer-home-status"),
        profilePhoto: document.querySelector("#profile-photo"),
        photoCaptionElement: document.querySelector("#profile-photo-caption"),
        nameLine: document.querySelector("#profile-name-line"),
        roleLine: document.querySelector("#profile-role-line"),
        emailLine: document.querySelector("#profile-email-line"),
        vendorLine: document.querySelector("#profile-vendor-line"),
        adminLine: document.querySelector("#profile-admin-line"),
        accessSummaryElement: document.querySelector("#access-summary"),
        welcomeMessageElement: document.querySelector("#welcome-message"),
        vendorApplicationNoteElement: document.querySelector("#vendor-application-note"),
        adminApplicationNoteElement: document.querySelector("#admin-application-note"),
        profileButton: document.querySelector("#go-profile-button"),
        choosePortalButton: document.querySelector("#choose-portal-button"),
        vendorApplicationButton: document.querySelector("#go-vendor-application-button"),
        adminApplicationButton: document.querySelector("#go-admin-application-button"),
        browseStoresButton: document.querySelector("#browse-stores-button"),
        myOrdersButton: document.querySelector("#view-orders-button"),
        supportButton: document.querySelector("#get-support-button"),
        signOutButton: document.querySelector("#sign-out-button"),
        customerPortalButton: document.querySelector("#go-customer-portal-button"),
        vendorPortalButton: document.querySelector("#go-vendor-portal-button"),
        adminPortalButton: document.querySelector("#go-admin-portal-button")
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("customer/index.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("normalizers clean text and statuses", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(null)).toBe("");
        expect(normalizeLowerText("  HeLLo ")).toBe("hello");
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("mystery")).toBe("none");
        expect(normalizeAdminApplicationStatus("SUSPENDED")).toBe("blocked");
        expect(normalizeAdminApplicationStatus("mystery")).toBe("none");
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("inactive")).toBe("active");
    });

    test("resolveAuthUtils prefers explicit then window", () => {
        const explicitUtils = { value: 1 };
        window.authUtils = { value: 2 };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);

        delete window.authUtils;
        expect(resolveAuthUtils()).toBeNull();
    });

    test("getFallbackRoutes and getPortalRoute return expected routes", () => {
        expect(getFallbackRoutes()).toEqual({
            customer: "./index.html",
            vendor: "../vendor/index.html",
            admin: "../admin/index.html",
            rolechoice: "../authentication/role-choice.html",
            profile: "../authentication/profile.html",
            vendorapplication: "./vendor-application.html",
            adminapplication: "./admin-application.html",
            stores: "./browse-stores.html",
            orders: "./my-orders.html",
            support: "./support.html",
            login: "../authentication/login.html"
        });

        expect(getPortalRoute("customer")).toBe("./index.html");
        expect(getPortalRoute("vendor")).toBe("../vendor/index.html");
        expect(getPortalRoute("admin")).toBe("../admin/index.html");
        expect(getPortalRoute("roleChoice")).toBe("../authentication/role-choice.html");
        expect(getPortalRoute("profile")).toBe("../authentication/profile.html");
        expect(getPortalRoute("vendorApplication")).toBe("./vendor-application.html");
        expect(getPortalRoute("adminApplication")).toBe("./admin-application.html");
        expect(getPortalRoute("stores")).toBe("./browse-stores.html");
        expect(getPortalRoute("orders")).toBe("./my-orders.html");
        expect(getPortalRoute("support")).toBe("./support.html");
        expect(getPortalRoute("signOut")).toBe("../authentication/login.html");
    });

    test("getPortalRoute uses authUtils when available", () => {
        const authUtils = {
            getPortalRoute: jest.fn((route) => `/custom/${route}.html`),
            PORTAL_ROUTES: {
                roleChoice: "/special/role-choice.html",
                vendorApplication: "/special/vendor.html",
                adminApplication: "/special/admin.html",
                login: "/special/login.html"
            }
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(getPortalRoute("vendor", authUtils)).toBe("/custom/vendor.html");
        expect(getPortalRoute("admin", authUtils)).toBe("/custom/admin.html");
        expect(getPortalRoute("roleChoice", authUtils)).toBe("/special/role-choice.html");
        expect(getPortalRoute("vendorApplication", authUtils)).toBe("/special/vendor.html");
        expect(getPortalRoute("adminApplication", authUtils)).toBe("/special/admin.html");
        expect(getPortalRoute("signOut", authUtils)).toBe("/special/login.html");
    });

    test("hasAuthenticatedIdentity recognises uid email or phone", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({ email: "user@example.com" })).toBe(true);
        expect(hasAuthenticatedIdentity({ phoneNumber: "+27712345678" })).toBe(true);
        expect(hasAuthenticatedIdentity({})).toBe(false);
    });

    test("normalizeProfile uses auth utils normaliser when present", () => {
        const normalized = {
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "",
            isAdmin: false,
            vendorStatus: "none",
            vendorReason: "",
            adminApplicationStatus: "pending",
            adminApplicationReason: "",
            accountStatus: "active"
        };

        const authUtils = {
            normaliseUserData: jest.fn(() => normalized)
        };

        expect(normalizeProfile({ uid: "raw" }, authUtils)).toBe(normalized);
        expect(authUtils.normaliseUserData).toHaveBeenCalledWith({ uid: "raw" });
    });

    test("normalizeProfile derives admin approval and normalizes fallback values", () => {
        expect(
            normalizeProfile({
                uid: " user-1 ",
                fullName: " Faranani ",
                email: " USER@example.com ",
                phoneNumber: " 0712345678 ",
                photoURL: " https://example.com/p.jpg ",
                admin: true,
                vendorStatus: "suspended",
                rejectionReason: " Missing docs ",
                adminApplicationStatus: "none",
                accountStatus: "inactive"
            })
        ).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/p.jpg",
            isAdmin: true,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            adminApplicationStatus: "approved",
            adminApplicationReason: "",
            accountStatus: "active"
        });
    });

    test("role label and portal access helpers match the new model", () => {
        expect(getRoleLabel({ isAdmin: true, vendorStatus: "approved" })).toBe("Admin and Vendor");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ uid: "user-1" })).toBe("Customer");

        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);
        expect(canAccessVendorPortal({ vendorStatus: "approved", accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isAdmin: true, accountStatus: "active" })).toBe(false);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("can apply helpers defer to auth utils and fallback correctly", () => {
        const authUtils = {
            canSubmitVendorApplication: jest.fn(() => true),
            canSubmitAdminApplication: jest.fn(() => false)
        };

        expect(canApplyForVendor({ uid: "user-1" }, authUtils)).toBe(true);
        expect(canApplyForAdmin({ uid: "user-1" }, authUtils)).toBe(false);

        expect(
            canApplyForVendor({ uid: "user-1", vendorStatus: "none", accountStatus: "active" })
        ).toBe(true);
        expect(
            canApplyForVendor({ isAdmin: true, vendorStatus: "none", accountStatus: "active" })
        ).toBe(false);
        expect(
            canApplyForAdmin({ uid: "user-1", adminApplicationStatus: "rejected", accountStatus: "active" })
        ).toBe(true);
        expect(
            canApplyForAdmin({ isAdmin: true, adminApplicationStatus: "approved", accountStatus: "active" })
        ).toBe(false);
    });

    test("status labels and summaries are user friendly", () => {
        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "blocked" })).toBe("Blocked");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");

        expect(getAdminStatusLabel({ isAdmin: true })).toBe("Approved");
        expect(getAdminStatusLabel({ adminApplicationStatus: "pending" })).toBe("Pending");
        expect(getAdminStatusLabel({ adminApplicationStatus: "blocked" })).toBe("Blocked");
        expect(getAdminStatusLabel({ adminApplicationStatus: "none" })).toBe("Not Applied");

        expect(
            getAccessSummary({
                showCustomerPortal: true,
                showVendorPortal: true,
                showAdminPortal: true
            })
        ).toBe("You can switch between the customer, vendor, and admin portals.");

        expect(
            getAccessSummary({
                showCustomerPortal: true,
                showVendorPortal: false,
                showAdminPortal: true
            })
        ).toBe("You can switch between the customer and admin portals.");

        expect(
            getAccessSummary({
                showCustomerPortal: false,
                showVendorPortal: false,
                showAdminPortal: false
            })
        ).toBe("Your account cannot access the customer portal right now. Please contact support.");
    });

    test("application notes and action config reflect vendor and admin states", () => {
        expect(getVendorApplicationNote({ vendorStatus: "pending" }))
            .toBe("Your vendor application is pending review.");
        expect(getVendorApplicationNote({ vendorStatus: "approved" }))
            .toBe("You already have vendor access.");
        expect(getVendorApplicationNote({ vendorStatus: "rejected", vendorReason: "Missing docs" }))
            .toBe("Your vendor application was rejected: Missing docs");
        expect(getVendorApplicationNote({ uid: "user-1", vendorStatus: "none", accountStatus: "active" }))
            .toBe("You can apply to become a vendor from this dashboard.");

        expect(getAdminApplicationNote({ isAdmin: true }))
            .toBe("You already have admin access.");
        expect(getAdminApplicationNote({ adminApplicationStatus: "pending" }))
            .toBe("Your admin application is pending review.");
        expect(getAdminApplicationNote({ adminApplicationStatus: "rejected", adminApplicationReason: "Incomplete motivation" }))
            .toBe("Your admin application was rejected: Incomplete motivation");
        expect(getAdminApplicationNote({ uid: "user-1", adminApplicationStatus: "none", accountStatus: "active" }))
            .toBe("You can apply to become an admin from this dashboard.");

        expect(getApplicationActionConfig({ vendorStatus: "none", accountStatus: "active" }, null, "vendor"))
            .toEqual({
                visible: true,
                label: "Apply to Become a Vendor",
                route: "./vendor-application.html"
            });

        expect(getApplicationActionConfig({ vendorStatus: "rejected", accountStatus: "active" }, null, "vendor"))
            .toEqual({
                visible: true,
                label: "Update Vendor Application",
                route: "./vendor-application.html"
            });

        expect(getApplicationActionConfig({ adminApplicationStatus: "pending", accountStatus: "active" }, null, "admin"))
            .toEqual({
                visible: true,
                label: "View Admin Application",
                route: "./admin-application.html"
            });

        expect(getApplicationActionConfig({ isAdmin: true, accountStatus: "active" }, null, "admin"))
            .toEqual({
                visible: false,
                label: "",
                route: "./admin-application.html"
            });
    });

    test("welcome message, home state and default avatar are generated", () => {
        const state = getHomeState({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            vendorStatus: "none",
            adminApplicationStatus: "pending",
            accountStatus: "active"
        });

        expect(getWelcomeMessage({ displayName: "Faranani" })).toBe("Welcome back, Faranani.");
        expect(state.displayName).toBe("Faranani");
        expect(state.roleLabel).toBe("Customer");
        expect(state.vendorStatusLabel).toBe("Not Applied");
        expect(state.adminStatusLabel).toBe("Pending");
        expect(state.showCustomerPortal).toBe(true);
        expect(state.showVendorPortal).toBe(false);
        expect(state.showAdminPortal).toBe(false);
        expect(state.showChoosePortal).toBe(false);
        expect(state.vendorApplicationAction.visible).toBe(true);
        expect(state.adminApplicationAction.visible).toBe(true);
        expect(getDefaultAvatar("Faranani")).toContain("data:image/svg+xml");
    });
});

describe("customer/index.js DOM helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("set helpers update DOM safely", () => {
        const paragraph = document.createElement("p");
        const image = document.createElement("img");

        setText(paragraph, "Hello");
        expect(paragraph.textContent).toBe("Hello");
        expect(() => setText(null, "Ignored")).not.toThrow();

        setHidden(paragraph, true);
        expect(paragraph.hidden).toBe(true);
        expect(paragraph.getAttribute("aria-hidden")).toBe("true");

        setStatusMessage(paragraph, "Loaded", "success");
        expect(paragraph.textContent).toBe("Loaded");
        expect(paragraph.dataset.state).toBe("success");

        setImage(image, "https://example.com/photo.jpg", "Photo alt", "Faranani");
        expect(image.src).toContain("https://example.com/photo.jpg");
        expect(image.alt).toBe("Photo alt");

        setImage(image, "", "", "Faranani");
        expect(image.src).toContain("data:image/svg+xml");
        expect(image.alt).toBe("User profile picture");
    });

    test("renderCustomerHomePage renders the new dashboard state", () => {
        const elements = createCustomerHomeDom();

        renderCustomerHomePage(elements, {
            profile: {
                email: "user@example.com",
                photoURL: "",
                adminApplicationStatus: "pending"
            },
            displayName: "Faranani",
            roleLabel: "Customer",
            vendorStatusLabel: "Not Applied",
            adminStatusLabel: "Pending",
            accessSummary: "You currently have customer portal access only.",
            welcomeMessage: "Welcome back, Faranani.",
            vendorApplicationNote: "You can apply to become a vendor from this dashboard.",
            adminApplicationNote: "Your admin application is pending review.",
            showCustomerPortal: true,
            showVendorPortal: false,
            showAdminPortal: false,
            showChoosePortal: false,
            vendorApplicationAction: {
                visible: true,
                label: "Apply to Become a Vendor"
            },
            adminApplicationAction: {
                visible: true,
                label: "View Admin Application"
            }
        });

        expect(elements.statusElement.textContent).toBe("Customer dashboard loaded.");
        expect(elements.nameLine.textContent).toBe("Faranani");
        expect(elements.roleLine.textContent).toBe("Customer");
        expect(elements.emailLine.textContent).toBe("user@example.com");
        expect(elements.vendorLine.textContent).toBe("Not Applied");
        expect(elements.adminLine.textContent).toBe("Pending");
        expect(elements.accessSummaryElement.textContent).toBe(
            "You currently have customer portal access only."
        );
        expect(elements.vendorApplicationButton.textContent).toBe("Apply to Become a Vendor");
        expect(elements.adminApplicationButton.textContent).toBe("View Admin Application");
        expect(elements.customerPortalButton.hidden).toBe(false);
        expect(elements.vendorPortalButton.hidden).toBe(true);
        expect(elements.adminPortalButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(true);
        expect(elements.vendorApplicationButton.hidden).toBe(false);
        expect(elements.adminApplicationButton.hidden).toBe(false);
        expect(elements.profilePhoto.src).toContain("data:image/svg+xml");
        expect(elements.photoCaptionElement.textContent).toBe(
            "No profile picture found yet, so we are showing your default avatar."
        );
    });

    test("renderCustomerHomePage handles existing photos and hidden action buttons", () => {
        const elements = createCustomerHomeDom();

        renderCustomerHomePage(elements, {
            profile: {
                email: "admin@example.com",
                photoURL: "https://example.com/profile.jpg"
            },
            displayName: "Admin User",
            roleLabel: "Admin",
            vendorStatusLabel: "Not Applied",
            adminStatusLabel: "Approved",
            accessSummary: "You can switch between the customer and admin portals.",
            welcomeMessage: "Welcome back, Admin User.",
            vendorApplicationNote: "Vendor application actions are unavailable right now.",
            adminApplicationNote: "You already have admin access.",
            showCustomerPortal: true,
            showVendorPortal: false,
            showAdminPortal: true,
            showChoosePortal: true,
            vendorApplicationAction: {
                visible: false,
                label: ""
            },
            adminApplicationAction: {
                visible: false,
                label: ""
            }
        });

        expect(elements.photoCaptionElement.textContent).toBe(
            "Your current profile picture is shown here."
        );
        expect(elements.profilePhoto.src).toContain("https://example.com/profile.jpg");
        expect(elements.vendorApplicationButton.hidden).toBe(true);
        expect(elements.adminApplicationButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(false);
    });

    test("renderCustomerHomePage and handlers tolerate missing values", async () => {
        expect(() => renderCustomerHomePage(null, null)).not.toThrow();
        expect(attachNavigationHandler({ button: null, route: "/next" })).toBeNull();
        expect(attachNavigationHandler({ button: document.createElement("button"), route: "" })).toBeNull();
        expect(attachSignOutHandler({ button: null, authService: {}, nextRoute: "/login" })).toBeNull();

        const button = document.createElement("button");
        const navigate = jest.fn();
        const navController = attachNavigationHandler({
            button,
            route: "/next-page.html",
            navigate
        });

        expect(
            navController.handleClick({
                preventDefault: jest.fn()
            })
        ).toBe("/next-page.html");
        expect(navigate).toHaveBeenCalledWith("/next-page.html");

        const statusElement = document.createElement("p");
        const signOutController = attachSignOutHandler({
            button,
            authService: {
                signOutUser: jest.fn().mockResolvedValue(true)
            },
            navigate,
            nextRoute: "/login.html",
            statusElement
        });

        const result = await signOutController.handleClick({
            preventDefault: jest.fn()
        });

        expect(result).toEqual({
            success: true,
            nextRoute: "/login.html"
        });
        expect(statusElement.textContent).toBe("Signing you out...");
    });

    test("attachSignOutHandler reports errors", async () => {
        const button = document.createElement("button");
        const statusElement = document.createElement("p");

        const controller = attachSignOutHandler({
            button,
            authService: {
                signOutUser: jest.fn().mockRejectedValue(new Error("Sign out failed"))
            },
            navigate: jest.fn(),
            nextRoute: "/login.html",
            statusElement
        });

        const result = await controller.handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Sign out failed");
        expect(statusElement.textContent).toBe("Sign out failed");
        expect(statusElement.dataset.state).toBe("error");
    });
});

describe("customer/index.js loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("loadCustomerHomeState validates auth service dependencies", async () => {
        await expect(
            loadCustomerHomeState({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");

        await expect(
            loadCustomerHomeState({
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadCustomerHomeState redirects signed-out users", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        await expect(loadCustomerHomeState({ authService })).resolves.toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });
    });

    test("loadCustomerHomeState returns state for signed-in users and falls back to auth data", async () => {
        const authServiceWithProfile = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-1"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
                displayName: "Faranani",
                email: "user@example.com",
                vendorStatus: "approved",
                adminApplicationStatus: "none",
                accountStatus: "active"
            })
        };

        const profiledResult = await loadCustomerHomeState({ authService: authServiceWithProfile });
        expect(profiledResult.success).toBe(true);
        expect(profiledResult.state.showVendorPortal).toBe(true);

        const authServiceFallback = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                displayName: "Fallback User",
                email: "fallback@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue(null)
        };

        const fallbackResult = await loadCustomerHomeState({ authService: authServiceFallback });
        expect(fallbackResult.success).toBe(true);
        expect(fallbackResult.profile.uid).toBe("user-2");
        expect(fallbackResult.state.displayName).toBe("Fallback User");
    });

    test("initializeCustomerHomePage requires auth service and redirects signed-out users", async () => {
        createCustomerHomeDom();

        await expect(initializeCustomerHomePage()).rejects.toThrow("authService is required.");

        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn(),
            signOutUser: jest.fn()
        };
        const navigate = jest.fn();

        const result = await initializeCustomerHomePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(true);
        expect(result.nextRoute).toBe("../authentication/login.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
    });

    test("initializeCustomerHomePage renders state and wires all customer actions", async () => {
        const elements = createCustomerHomeDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3",
                displayName: "Customer User",
                email: "customer@example.com",
                vendorStatus: "none",
                adminApplicationStatus: "pending",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(true)
        };

        const navigate = jest.fn();

        const result = await initializeCustomerHomePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(false);
        expect(result.profileController).toBeTruthy();
        expect(result.choosePortalController).toBeNull();
        expect(result.vendorApplicationController).toBeTruthy();
        expect(result.adminApplicationController).toBeTruthy();
        expect(result.customerPortalController).toBeTruthy();
        expect(result.vendorPortalController).toBeNull();
        expect(result.adminPortalController).toBeNull();
        expect(result.browseStoresController).toBeTruthy();
        expect(result.myOrdersController).toBeTruthy();
        expect(result.supportController).toBeTruthy();
        expect(result.signOutController).toBeTruthy();

        elements.profileButton.click();
        elements.vendorApplicationButton.click();
        elements.adminApplicationButton.click();
        elements.browseStoresButton.click();
        elements.myOrdersButton.click();
        elements.supportButton.click();
        await result.signOutController.handleClick({
            preventDefault: jest.fn()
        });

        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../authentication/profile.html");
        expect(navigate).toHaveBeenCalledWith("./vendor-application.html");
        expect(navigate).toHaveBeenCalledWith("./admin-application.html");
        expect(navigate).toHaveBeenCalledWith("./browse-stores.html");
        expect(navigate).toHaveBeenCalledWith("./my-orders.html");
        expect(navigate).toHaveBeenCalledWith("./support.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
        expect(elements.adminApplicationButton.hidden).toBe(false);
    });

    test("initializeCustomerHomePage wires multi-portal users correctly", async () => {
        const elements = createCustomerHomeDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-4"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                displayName: "Admin Vendor",
                email: "admin.vendor@example.com",
                isAdmin: true,
                vendorStatus: "approved",
                adminApplicationStatus: "approved",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(true)
        };

        const navigate = jest.fn();

        const result = await initializeCustomerHomePage({
            authService,
            navigate
        });

        expect(result.redirected).toBe(false);
        expect(result.choosePortalController).toBeTruthy();
        expect(result.vendorPortalController).toBeTruthy();
        expect(result.adminPortalController).toBeTruthy();
        expect(elements.vendorApplicationButton.hidden).toBe(true);
        expect(elements.adminApplicationButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(false);

        elements.choosePortalButton.click();
        elements.vendorPortalButton.click();
        elements.adminPortalButton.click();

        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../authentication/role-choice.html");
        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");
        expect(navigate).toHaveBeenCalledWith("../admin/index.html");
    });

    test("initializeCustomerHomePage reports loading failures and uses window.authService", async () => {
        const elements = createCustomerHomeDom();

        const failingService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-5"
            })),
            getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile")),
            signOutUser: jest.fn()
        };

        const failedResult = await initializeCustomerHomePage({
            authService: failingService
        });

        expect(failedResult.redirected).toBe(false);
        expect(failedResult.message).toBe("Failed to load profile");
        expect(elements.statusElement.textContent).toBe("Failed to load profile");
        expect(elements.statusElement.dataset.state).toBe("error");

        createCustomerHomeDom();

        window.authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-6",
                displayName: "Window User",
                email: "window@example.com",
                vendorStatus: "none",
                adminApplicationStatus: "none",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(true)
        };

        const windowResult = await initializeCustomerHomePage();
        expect(windowResult.redirected).toBe(false);
        expect(window.authService.getCurrentUser).toHaveBeenCalledTimes(1);
    });
});
