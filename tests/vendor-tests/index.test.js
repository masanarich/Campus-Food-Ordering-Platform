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
    getVendorWorkspaceNote,
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
    attachSignOutHandler,
    loadVendorHomeState,
    initializeVendorHomePage
} = require("../../public/vendor/index.js");

function createVendorHomeDom() {
    document.body.innerHTML = `
        <main>
            <p id="vendor-home-status"></p>

            <img id="profile-photo" src="" alt="">
            <p id="profile-photo-caption"></p>

            <output id="profile-name-line"></output>
            <output id="profile-role-line"></output>
            <output id="profile-email-line"></output>
            <output id="profile-vendor-line"></output>

            <p id="portal-summary"></p>
            <p id="welcome-message"></p>
            <p id="vendor-portal-note"></p>
            <p id="vendor-workspace-note"></p>

            <button id="go-profile-button" type="button">Profile</button>
            <button id="go-shop-button" type="button">Shop</button>
            <button id="go-products-button" type="button">Products</button>
            <button id="choose-portal-button" type="button">Choose Portal</button>
            <button id="sign-out-button" type="button">Sign Out</button>
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
        vendorWorkspaceNoteElement: document.querySelector("#vendor-workspace-note"),
        profileButton: document.querySelector("#go-profile-button"),
        shopButton: document.querySelector("#go-shop-button"),
        productsButton: document.querySelector("#go-products-button"),
        choosePortalButton: document.querySelector("#choose-portal-button"),
        signOutButton: document.querySelector("#sign-out-button"),
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

    test("normalizers and auth util resolution work", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("mystery")).toBe("none");
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("inactive")).toBe("active");

        const explicitUtils = { value: 1 };
        window.authUtils = { value: 2 };
        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);
        delete window.authUtils;
        expect(resolveAuthUtils()).toBeNull();
    });

    test("portal routes and profile normalization work", () => {
        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("./index.html");
        expect(getPortalRoute("admin")).toBe("../admin/index.html");
        expect(getPortalRoute("shop")).toBe("./shop.html");
        expect(getPortalRoute("products")).toBe("./products.html");
        expect(getPortalRoute("signOut")).toBe("../authentication/login.html");

        const authUtils = {
            getPortalRoute: jest.fn((route) => `/custom/${route}.html`),
            PORTAL_ROUTES: {
                roleChoice: "/special/role-choice.html",
                login: "/special/login.html"
            }
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(getPortalRoute("roleChoice", authUtils)).toBe("/special/role-choice.html");
        expect(getPortalRoute("signOut", authUtils)).toBe("/special/login.html");

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
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            accountStatus: "active"
        });
    });

    test("role labels, access checks, and notes work", () => {
        expect(hasAuthenticatedIdentity({ uid: "abc123" })).toBe(true);
        expect(hasAuthenticatedIdentity({})).toBe(false);

        expect(getRoleLabel({ isAdmin: true, vendorStatus: "approved" })).toBe("Admin and Vendor");
        expect(getRoleLabel({ isAdmin: true })).toBe("Admin");
        expect(getRoleLabel({ vendorStatus: "approved" })).toBe("Vendor");
        expect(getRoleLabel({ uid: "user-1" })).toBe("Customer");

        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);
        expect(canAccessVendorPortal({ vendorStatus: "approved", accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);

        expect(getVendorStatusLabel({ vendorStatus: "approved" })).toBe("Approved");
        expect(getVendorStatusLabel({ vendorStatus: "none" })).toBe("Not Applied");

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
                showVendorPortal: true,
                showAdminPortal: false
            })
        ).toBe("You can switch between the customer and vendor portals.");

        expect(
            getVendorPortalNote({
                isAdmin: true,
                vendorStatus: "approved"
            })
        ).toBe("You can work as both an admin and a vendor from this account.");

        expect(
            getVendorPortalNote({
                vendorStatus: "blocked",
                vendorReason: "Policy issue"
            })
        ).toBe("Your vendor access is blocked: Policy issue");

        expect(
            getVendorWorkspaceNote({
                vendorStatus: "approved"
            })
        ).toContain("maintain your shop profile");

        expect(getWelcomeMessage({ displayName: "Faranani" })).toBe("Welcome back, Faranani.");
    });

    test("home state and redirect helpers work", () => {
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
        expect(state.shopRoute).toBe("./shop.html");
        expect(state.productsRoute).toBe("./products.html");
        expect(state.signOutRoute).toBe("../authentication/login.html");

        expect(getDefaultAvatar("Faranani")).toContain("data:image/svg+xml");
        expect(
            getSafeRedirectRoute({
                uid: "user-1",
                vendorStatus: "none",
                accountStatus: "active"
            })
        ).toBe("../customer/index.html");
    });
});

describe("vendor/index.js DOM helpers", () => {
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

    test("renderVendorHomePage renders dashboard state", () => {
        const elements = createVendorHomeDom();

        renderVendorHomePage(elements, {
            profile: {
                email: "user@example.com",
                photoURL: ""
            },
            displayName: "Faranani",
            roleLabel: "Vendor",
            vendorStatusLabel: "Approved",
            portalSummary: "You can switch between the customer and vendor portals.",
            welcomeMessage: "Welcome back, Faranani.",
            vendorPortalNote: "Your vendor account is approved and ready to manage a shop.",
            vendorWorkspaceNote: "From here you can maintain your shop profile, keep your menu updated, and prepare for order management.",
            showCustomerPortal: true,
            showVendorPortal: true,
            showAdminPortal: false,
            showChoosePortal: true
        });

        expect(elements.statusElement.textContent).toBe("Vendor dashboard loaded.");
        expect(elements.nameLine.textContent).toBe("Faranani");
        expect(elements.roleLine.textContent).toBe("Vendor");
        expect(elements.emailLine.textContent).toBe("user@example.com");
        expect(elements.vendorLine.textContent).toBe("Approved");
        expect(elements.portalSummaryElement.textContent)
            .toBe("You can switch between the customer and vendor portals.");
        expect(elements.vendorPortalNoteElement.textContent)
            .toBe("Your vendor account is approved and ready to manage a shop.");
        expect(elements.vendorWorkspaceNoteElement.textContent)
            .toContain("maintain your shop profile");
        expect(elements.photoCaptionElement.textContent)
            .toBe("No profile picture was found, so a default avatar is being shown.");
        expect(elements.customerPortalButton.hidden).toBe(false);
        expect(elements.vendorPortalButton.hidden).toBe(false);
        expect(elements.adminPortalButton.hidden).toBe(true);
        expect(elements.choosePortalButton.hidden).toBe(false);
    });

    test("navigation helpers work", async () => {
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
});

describe("vendor/index.js loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
        delete window.authService;
    });

    test("loadVendorHomeState validates auth service dependencies", async () => {
        await expect(
            loadVendorHomeState({
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");

        await expect(
            loadVendorHomeState({
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("loadVendorHomeState redirects signed-out users to login", async () => {
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
        const result = await loadVendorHomeState({
            authService: {
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
            }
        });

        expect(result.success).toBe(false);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loadVendorHomeState returns state for vendor and fallback auth profile", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-2",
                displayName: "Vendor User",
                email: "vendor@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
                displayName: "Vendor User",
                email: "vendor@example.com",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/fallback.jpg",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const result = await loadVendorHomeState({ authService });

        expect(result.success).toBe(true);
        expect(result.profile.uid).toBe("user-2");
        expect(result.state.displayName).toBe("Vendor User");
    });

    test("initializeVendorHomePage renders state and wires navigation", async () => {
        const elements = createVendorHomeDom();
        const navigate = jest.fn();

        const result = await initializeVendorHomePage({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-3"
                })),
                getCurrentUserProfile: jest.fn().mockResolvedValue({
                    uid: "user-3",
                    displayName: "Admin Vendor",
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
        expect(result.shopController).toBeTruthy();
        expect(result.productsController).toBeTruthy();
        expect(result.choosePortalController).toBeTruthy();
        expect(result.customerPortalController).toBeTruthy();
        expect(result.vendorPortalController).toBeTruthy();
        expect(result.adminPortalController).toBeTruthy();
        expect(result.signOutController).toBeTruthy();

        elements.profileButton.click();
        elements.shopButton.click();
        elements.productsButton.click();
        elements.customerPortalButton.click();
        elements.adminPortalButton.click();

        await result.signOutController.handleClick({
            preventDefault: jest.fn()
        });
        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../authentication/profile.html");
        expect(navigate).toHaveBeenCalledWith("./shop.html");
        expect(navigate).toHaveBeenCalledWith("./products.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("../admin/index.html");
        expect(navigate).toHaveBeenCalledWith("../authentication/login.html");
        expect(elements.roleLine.textContent).toBe("Admin and Vendor");
    });

    test("initializeVendorHomePage handles loading failures and window authService fallback", async () => {
        const elements = createVendorHomeDom();

        const failed = await initializeVendorHomePage({
            authService: {
                getCurrentUser: jest.fn(() => ({
                    uid: "user-4"
                })),
                getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile")),
                signOutUser: jest.fn()
            }
        });

        expect(failed.redirected).toBe(false);
        expect(failed.message).toBe("Failed to load profile");
        expect(elements.statusElement.textContent).toBe("Failed to load profile");

        createVendorHomeDom();
        window.authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-5"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-5",
                displayName: "Window Vendor",
                email: "window@example.com",
                vendorStatus: "approved",
                accountStatus: "active"
            }),
            signOutUser: jest.fn().mockResolvedValue(true)
        };

        const result = await initializeVendorHomePage();
        expect(result.redirected).toBe(false);
        expect(window.authService.getCurrentUser).toHaveBeenCalledTimes(1);
    });
});
