/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
    normalizeCurrencyAmount,
    formatCurrency,
    normalizeVendorStatus,
    normalizeAdminApplicationStatus,
    normalizeAccountStatus,
    resolveAuthUtils,
    resolvePlatformPricing,
    getPortalRoute,
    hasAuthenticatedIdentity,
    normalizeProfile,
    getRoleLabel,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    getVendorStatusLabel,
    getAdminStatusLabel,
    getPortalSummary,
    getManagementSummary,
    getAdminAccessNote,
    getWelcomeMessage,
    getDefaultFinanceSummary,
    calculateAdminFinanceSummary,
    loadAdminFinanceSummary,
    getHomeState,
    getDefaultAvatar,
    getSafeRedirectRoute,
    setText,
    setHidden,
    setStatusMessage,
    setImage,
    renderFinanceSummary,
    renderAdminHomePage,
    attachNavigationHandler,
    attachSignOutHandler,
    loadAdminHomeState,
    initializeAdminHomePage
} = require("../../public/admin/index.js");
const platformPricing = require("../../public/shared/finance/platform-pricing.js");

function createAdminHomeDom() {
    document.body.innerHTML = `
        <main>
            <p id="admin-home-status"></p>

            <img id="profile-photo" src="" alt="">
            <p id="profile-photo-caption"></p>

            <output id="profile-name-line"></output>
            <output id="profile-role-line"></output>
            <output id="profile-email-line"></output>
            <output id="profile-vendor-line"></output>
            <output id="profile-admin-line"></output>

            <p id="portal-summary"></p>
            <p id="welcome-message"></p>
            <p id="management-summary"></p>
            <p id="admin-access-note"></p>

            <p id="admin-finance-note"></p>
            <output id="admin-platform-balance"></output>
            <output id="admin-customer-revenue"></output>
            <output id="admin-vendor-earnings"></output>
            <output id="admin-completed-orders"></output>

            <button id="go-profile-button" type="button">Profile</button>
            <button id="manage-users-button" type="button">Manage Users</button>
            <button id="finance-button" type="button">Finance</button>
            <button id="review-disputes-button" type="button">Review Disputes</button>
            <button id="admin-ticket-detail-link" type="button">Open Ticket Detail</button>
            <button id="analytics-button" type="button">View Analytics</button>
            <button id="choose-portal-button" type="button">Choose Portal</button>
            <button id="sign-out-button" type="button">Sign Out</button>
            <button id="go-customer-portal-button" type="button">Customer Portal</button>
            <button id="go-vendor-portal-button" type="button">Vendor Portal</button>
        </main>
    `;

    return {
        statusElement: document.querySelector("#admin-home-status"),
        profilePhoto: document.querySelector("#profile-photo"),
        photoCaptionElement: document.querySelector("#profile-photo-caption"),
        nameLine: document.querySelector("#profile-name-line"),
        roleLine: document.querySelector("#profile-role-line"),
        emailLine: document.querySelector("#profile-email-line"),
        vendorLine: document.querySelector("#profile-vendor-line"),
        adminLine: document.querySelector("#profile-admin-line"),
        portalSummaryElement: document.querySelector("#portal-summary"),
        welcomeMessageElement: document.querySelector("#welcome-message"),
        managementSummaryElement: document.querySelector("#management-summary"),
        adminAccessNoteElement: document.querySelector("#admin-access-note"),
        financeNoteElement: document.querySelector("#admin-finance-note"),
        platformBalanceElement: document.querySelector("#admin-platform-balance"),
        customerRevenueElement: document.querySelector("#admin-customer-revenue"),
        vendorEarningsElement: document.querySelector("#admin-vendor-earnings"),
        completedOrdersElement: document.querySelector("#admin-completed-orders"),
        profileButton: document.querySelector("#go-profile-button"),
        manageUsersButton: document.querySelector("#manage-users-button"),
        financeButton: document.querySelector("#finance-button"),
        reviewDisputesButton: document.querySelector("#review-disputes-button"),
        ticketDetailLink: document.querySelector("#admin-ticket-detail-link"),
        analyticsButton: document.querySelector("#analytics-button"),
        choosePortalButton: document.querySelector("#choose-portal-button"),
        signOutButton: document.querySelector("#sign-out-button"),
        customerPortalButton: document.querySelector("#go-customer-portal-button"),
        vendorPortalButton: document.querySelector("#go-vendor-portal-button")
    };
}

function flushPromises() {
    return new Promise((resolve) => setTimeout(resolve, 0));
}

describe("admin/index.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("normalize helpers clean values", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeCurrencyAmount("12.345")).toBe(12.35);
        expect(formatCurrency(120)).toContain("120");
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("mystery")).toBe("none");
        expect(normalizeAdminApplicationStatus("pending", false)).toBe("pending");
        expect(normalizeAdminApplicationStatus("anything", true)).toBe("approved");
        expect(normalizeAccountStatus("blocked")).toBe("blocked");
        expect(normalizeAccountStatus("inactive")).toBe("active");
        expect(resolvePlatformPricing(platformPricing)).toBe(platformPricing);
    });

    test("resolveAuthUtils prefers explicit utils then window utils", () => {
        const explicitUtils = { value: 1 };
        window.authUtils = { value: 2 };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);

        delete window.authUtils;
        expect(resolveAuthUtils()).toBeNull();
    });

    test("getPortalRoute returns expected routes", () => {
        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("../vendor/index.html");
        expect(getPortalRoute("admin")).toBe("./index.html");
        expect(getPortalRoute("profile")).toBe("../authentication/profile.html");
        expect(getPortalRoute("users")).toBe("./users.html");
        expect(getPortalRoute("finance")).toBe("./finance.html");
        expect(getPortalRoute("disputes")).toBe("./disputes.html");
        expect(getPortalRoute("ticketDetail")).toBe("./ticket-detail.html");
        expect(getPortalRoute("analytics")).toBe("./analytics.html");
        expect(getPortalRoute("signOut")).toBe("../authentication/login.html");
    });

    test("getPortalRoute uses authUtils route helpers when available", () => {
        const authUtils = {
            getPortalRoute: jest.fn((route) => `/custom/${route}.html`),
            PORTAL_ROUTES: {
                roleChoice: "/special/role-choice.html",
                login: "/special/login.html"
            }
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(getPortalRoute("vendor", authUtils)).toBe("/custom/vendor.html");
        expect(getPortalRoute("admin", authUtils)).toBe("/custom/admin.html");
        expect(getPortalRoute("roleChoice", authUtils)).toBe("/special/role-choice.html");
        expect(getPortalRoute("signOut", authUtils)).toBe("/special/login.html");
    });

    test("normalizeProfile shapes admin-facing account data", () => {
        const result = normalizeProfile({
            uid: " user-1 ",
            fullName: " Faranani ",
            email: " USER@example.com ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/p.jpg ",
            admin: true,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            adminRejectionReason: " Missing explanation ",
            accountStatus: "inactive"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/p.jpg",
            isAdmin: true,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            adminApplicationStatus: "approved",
            adminApplicationReason: "Missing explanation",
            accountStatus: "active"
        });
    });

    test("normalizeProfile uses authUtils normaliser when available", () => {
        const normalized = {
            uid: "user-2",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "",
            isAdmin: true,
            vendorStatus: "approved",
            vendorReason: "",
            adminApplicationStatus: "approved",
            adminApplicationReason: "",
            accountStatus: "active"
        };

        const authUtils = {
            normaliseUserData: jest.fn(() => normalized)
        };

        expect(normalizeProfile({ uid: "raw" }, authUtils)).toBe(normalized);
        expect(authUtils.normaliseUserData).toHaveBeenCalledWith({ uid: "raw" });
    });

    test("identity and role helpers return expected values", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({})).toBe(false);

        expect(getRoleLabel({ isAdmin: true, vendorStatus: "approved" })).toBe("Admin and Vendor");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ uid: "user-1" })).toBe("Customer");

        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");
        expect(getAdminStatusLabel({ isAdmin: true })).toBe("Approved");
        expect(getAdminStatusLabel({ adminApplicationStatus: "pending" })).toBe("Pending");
    });

    test("portal access helpers respect actual access state", () => {
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);
        expect(canAccessVendorPortal({ vendorStatus: "approved", accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isAdmin: true, accountStatus: "active" })).toBe(false);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("summary helpers produce the right admin messages", () => {
        expect(
            getPortalSummary({
                showCustomerPortal: true,
                showVendorPortal: true,
                showAdminPortal: true
            })
        ).toBe("You can switch between the customer, vendor, and admin portals.");

        expect(
            getPortalSummary({
                showCustomerPortal: true,
                showVendorPortal: false,
                showAdminPortal: true
            })
        ).toBe("You can switch between the customer and admin portals.");

        expect(
            getPortalSummary({
                showCustomerPortal: false,
                showVendorPortal: false,
                showAdminPortal: true
            })
        ).toBe("You currently have admin portal access only.");

        expect(getManagementSummary({ vendorStatus: "approved" }))
            .toContain("still having vendor access");
        expect(getManagementSummary({ vendorStatus: "none" }))
            .toContain("customer support disputes");
        expect(getAdminAccessNote({ isAdmin: true })).toBe("Your admin access is approved and active.");
        expect(getAdminAccessNote({})).toBe("Admin access is not available right now.");
        expect(getWelcomeMessage({ displayName: "Faranani" })).toBe("Welcome back, Faranani.");
    });

    test("finance summary helpers calculate platform earnings snapshots", async () => {
        expect(getDefaultFinanceSummary()).toEqual({
            completedOrders: 0,
            customerRevenue: 0,
            platformEarnings: 0,
            platformBalance: 0,
            vendorEarnings: 0
        });

        const summary = calculateAdminFinanceSummary([
            {
                orderId: "order-1",
                status: "completed",
                paymentStatus: "paid",
                paymentAmount: 110,
                vendorEarnings: 100,
                platformEarnings: 10
            },
            {
                orderId: "order-2",
                status: "ready",
                paymentStatus: "paid",
                paymentAmount: 55,
                vendorEarnings: 50,
                platformEarnings: 5
            }
        ], {
            platformPricing
        });

        expect(summary).toEqual({
            completedOrders: 1,
            customerRevenue: 110,
            platformEarnings: 10,
            platformBalance: 10,
            vendorEarnings: 100
        });

        await expect(loadAdminFinanceSummary({
            platformPricing,
            financeLoader: jest.fn(async () => ({
                orders: [
                    {
                        status: "completed",
                        paymentStatus: "paid",
                        paymentAmount: 220,
                        vendorEarnings: 200,
                        platformEarnings: 20
                    }
                ]
            }))
        })).resolves.toEqual({
            summary: {
                completedOrders: 1,
                customerRevenue: 220,
                platformEarnings: 20,
                platformBalance: 20,
                vendorEarnings: 200
            },
            error: null
        });
    });

    test("getHomeState builds admin dashboard state", () => {
        const state = getHomeState({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            isAdmin: true,
            vendorStatus: "none",
            accountStatus: "active"
        });

        expect(state.displayName).toBe("Faranani");
        expect(state.roleLabel).toBe("Admin");
        expect(state.vendorStatusLabel).toBe("Not Applied");
        expect(state.adminStatusLabel).toBe("Approved");
        expect(state.showCustomerPortal).toBe(true);
        expect(state.showVendorPortal).toBe(false);
        expect(state.showAdminPortal).toBe(true);
        expect(state.showChoosePortal).toBe(true);
        expect(state.manageUsersRoute).toBe("./users.html");
        expect(state.financeRoute).toBe("./finance.html");
        expect(state.disputesRoute).toBe("./disputes.html");
        expect(state.ticketDetailRoute).toBe("./ticket-detail.html");
        expect(state.analyticsRoute).toBe("./analytics.html");
        expect(state.signOutRoute).toBe("../authentication/login.html");
    });

    test("avatar and redirect helpers return safe fallbacks", () => {
        expect(getDefaultAvatar("Faranani")).toContain("data:image/svg+xml");
        expect(
            getSafeRedirectRoute({
                uid: "user-1",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        ).toBe("../vendor/index.html");
        expect(
            getSafeRedirectRoute({
                uid: "user-1",
                vendorStatus: "none",
                accountStatus: "active"
            })
        ).toBe("../customer/index.html");
    });
});

describe("admin/index.js DOM helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("basic DOM setters work", () => {
        const paragraph = document.createElement("p");
        const image = document.createElement("img");

        setText(paragraph, "Hello");
        expect(paragraph.textContent).toBe("Hello");

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

    test("renderAdminHomePage renders dashboard state", () => {
        const elements = createAdminHomeDom();

        renderAdminHomePage(elements, {
            profile: {
                email: "user@example.com",
                photoURL: ""
            },
            displayName: "Faranani",
            roleLabel: "Admin",
            vendorStatusLabel: "Not Applied",
            adminStatusLabel: "Approved",
            portalSummary: "You can switch between the customer and admin portals.",
            welcomeMessage: "Welcome back, Faranani.",
            managementSummary: "Manage users, review applications, and prepare to handle customer support disputes from this portal.",
            adminAccessNote: "Your admin access is approved and active.",
            financeSummary: {
                completedOrders: 1,
                customerRevenue: 110,
                platformEarnings: 10,
                platformBalance: 10,
                vendorEarnings: 100
            },
            financeStatusMessage: "Completed paid orders are reflected in this finance snapshot.",
            showCustomerPortal: true,
            showVendorPortal: false,
            showAdminPortal: true,
            showChoosePortal: true
        });

        expect(elements.statusElement.textContent).toBe("Admin dashboard loaded.");
        expect(elements.nameLine.textContent).toBe("Faranani");
        expect(elements.roleLine.textContent).toBe("Admin");
        expect(elements.emailLine.textContent).toBe("user@example.com");
        expect(elements.vendorLine.textContent).toBe("Not Applied");
        expect(elements.adminLine.textContent).toBe("Approved");
        expect(elements.portalSummaryElement.textContent)
            .toBe("You can switch between the customer and admin portals.");
        expect(elements.managementSummaryElement.textContent)
            .toContain("customer support disputes");
        expect(elements.financeNoteElement.textContent)
            .toBe("Completed paid orders are reflected in this finance snapshot.");
        expect(elements.platformBalanceElement.textContent).toContain("10");
        expect(elements.customerRevenueElement.textContent).toContain("110");
        expect(elements.vendorEarningsElement.textContent).toContain("100");
        expect(elements.completedOrdersElement.textContent).toBe("1");
        expect(elements.photoCaptionElement.textContent)
            .toBe("No profile picture was found, so a default avatar is being shown.");
        expect(elements.customerPortalButton.hidden).toBe(false);
        expect(elements.vendorPortalButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(false);

        renderFinanceSummary(elements, null);
        expect(elements.completedOrdersElement.textContent).toBe("0");
    });

    test("renderAdminHomePage does nothing with missing inputs", () => {
        expect(() => renderAdminHomePage(null, null)).not.toThrow();
        expect(() => setText(null, "Hello")).not.toThrow();
    });

    test("navigation helpers navigate correctly", async () => {
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

        const signOutController = attachSignOutHandler({
            button,
            authService: {
                signOutUser: jest.fn().mockResolvedValue(true)
            },
            navigate,
            nextRoute: "/signed-out.html",
            statusElement: document.createElement("p")
        });

        const result = await signOutController.handleClick({
            preventDefault: jest.fn()
        });

        expect(result).toEqual({
            success: true,
            nextRoute: "/signed-out.html"
        });
        expect(navigate).toHaveBeenCalledWith("/signed-out.html");
        expect(attachNavigationHandler({ button: null, route: "/x" })).toBeNull();
        expect(attachSignOutHandler({ button: null })).toBeNull();
    });

    test("attachSignOutHandler returns friendly error result on failure", async () => {
        const statusElement = document.createElement("p");
        const button = document.createElement("button");

        const controller = attachSignOutHandler({
            button,
            authService: {
                signOutUser: jest.fn().mockRejectedValue(new Error("Sign out failed"))
            },
            nextRoute: "/signed-out.html",
            statusElement
        });

        const result = await controller.handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Sign out failed");
        expect(statusElement.textContent).toBe("Sign out failed");
    });
});

describe("admin/index.js loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("loadAdminHomeState validates auth service dependencies", async () => {
        await expect(
            loadAdminHomeState({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");

        await expect(
            loadAdminHomeState({
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadAdminHomeState redirects signed-out users to login", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const result = await loadAdminHomeState({ authService });

        expect(result).toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });
    });

    test("loadAdminHomeState rejects customer and vendor users without admin access", async () => {
        const customerResult = await loadAdminHomeState({
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-1" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-1",
                    displayName: "Customer User",
                    email: "user@example.com",
                    vendorStatus: "none",
                    accountStatus: "active"
                })
            }
        });

        const vendorResult = await loadAdminHomeState({
            authService: {
                getCurrentUser: jest.fn(() => ({ uid: "user-2" })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-2",
                    displayName: "Vendor User",
                    email: "vendor@example.com",
                    vendorStatus: "approved",
                    accountStatus: "active"
                })
            }
        });

        expect(customerResult.success).toBe(false);
        expect(customerResult.nextRoute).toBe("../customer/index.html");
        expect(vendorResult.success).toBe(false);
        expect(vendorResult.nextRoute).toBe("../vendor/index.html");
    });

    test("loadAdminHomeState returns state for an admin", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3",
                displayName: "Faranani",
                email: "user@example.com",
                isAdmin: true,
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };
        const financeLoader = jest.fn(async () => ({
            orders: [
                {
                    status: "completed",
                    paymentStatus: "paid",
                    paymentAmount: 165,
                    vendorEarnings: 150,
                    platformEarnings: 15
                }
            ]
        }));

        const result = await loadAdminHomeState({
            authService,
            financeLoader,
            platformPricing
        });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("user-3");
        expect(result.state.displayName).toBe("Faranani");
        expect(result.state.showAdminPortal).toBe(true);
        expect(result.state.showVendorPortal).toBe(true);
        expect(result.state.financeSummary.platformBalance).toBe(15);
        expect(result.state.financeStatusMessage).toBe("Completed paid orders are reflected in this finance snapshot.");
        expect(financeLoader).toHaveBeenCalledTimes(1);
    });

    test("initializeAdminHomePage throws when authService is missing", async () => {
        createAdminHomeDom();

        await expect(initializeAdminHomePage()).rejects.toThrow(
            "authService is required."
        );
    });

    test("initializeAdminHomePage redirects signed-out user to login", async () => {
        createAdminHomeDom();

        const result = await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(() => null),
                getCurrentUserProfile: jest.fn()
            },
            navigate: jest.fn()
        });

        expect(result.redirected).toBe(true);
        expect(result.nextRoute).toBe("../authentication/login.html");
    });

    test("initializeAdminHomePage renders state and wires navigation", async () => {
        const elements = createAdminHomeDom();
        const navigate = jest.fn();

        const result = await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-4"
                })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-4",
                    displayName: "Admin User",
                    email: "admin@example.com",
                    isAdmin: true,
                    vendorStatus: "approved",
                    accountStatus: "active"
                }),
                signOutUser: jest.fn().mockResolvedValue(true)
            },
            navigate
        });

        expect(result.redirected).toBe(false);
        expect(result.profileController).toBeTruthy();
        expect(result.manageUsersController).toBeTruthy();
        expect(result.financeController).toBeTruthy();
        expect(result.reviewDisputesController).toBeTruthy();
        expect(result.ticketDetailController).toBeTruthy();
        expect(result.analyticsController).toBeTruthy();
        expect(result.choosePortalController).toBeTruthy();
        expect(result.customerPortalController).toBeTruthy();
        expect(result.vendorPortalController).toBeTruthy();
        expect(result.signOutController).toBeTruthy();

        elements.profileButton.click();
        elements.manageUsersButton.click();
        elements.financeButton.click();
        elements.reviewDisputesButton.click();
        elements.ticketDetailLink.click();
        elements.analyticsButton.click();
        elements.customerPortalButton.click();
        elements.vendorPortalButton.click();

        await result.signOutController.handleClick({
            preventDefault: jest.fn()
        });
        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../authentication/profile.html");
        expect(navigate).toHaveBeenCalledWith("./users.html");
        expect(navigate).toHaveBeenCalledWith("./finance.html");
        expect(navigate).toHaveBeenCalledWith("./disputes.html");
        expect(navigate).toHaveBeenCalledWith("./ticket-detail.html");
        expect(navigate).toHaveBeenCalledWith("./analytics.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
        expect(elements.roleLine.textContent).toBe("Admin and Vendor");
    });

    test("initializeAdminHomePage handles loading failures", async () => {
        const elements = createAdminHomeDom();

        const result = await initializeAdminHomePage({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-5"
                })),
                getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile")),
                signOutUser: jest.fn()
            }
        });

        expect(result.redirected).toBe(false);
        expect(result.message).toBe("Failed to load profile");
        expect(elements.statusElement.textContent).toBe("Failed to load profile");
        expect(elements.statusElement.dataset.state).toBe("error");
    });

    test("initializeAdminHomePage uses window.authService when not passed explicitly", async () => {
        createAdminHomeDom();

        window.authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-6",
                displayName: "Window Admin",
                email: "window@example.com",
                isAdmin: true,
                vendorStatus: "none",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(true)
        };

        const result = await initializeAdminHomePage();

        expect(result.redirected).toBe(false);
        expect(window.authService.getCurrentUser).toHaveBeenCalledTimes(1);
    });
}
);
