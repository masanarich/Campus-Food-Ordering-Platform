/**
 * @jest-environment jsdom
 */

const {
    normalizeText,
<<<<<<< HEAD
    normalizePortal,
    normalizeVendorStatus,
    normalizeAdminApplicationStatus,
    normalizeAccountStatus,
    isValidPortal,
    resolveAuthUtils,
    getFallbackPortalRoutes,
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
    getApplicationStatusMessage,
    canAccessPortal,
    submitPortalChoice,
    attachPortalChoiceHandler,
    getPortalDisplayElement,
    renderRoleChoicePage,
    loadRoleChoiceState,
=======
    normalizeRole,
    isValidRole,
    setStatusMessage,
    setButtonState,
    getNextRouteForRole,
    buildRoleUpdates,
    submitRoleChoice,
    attachRoleChoiceHandler,
>>>>>>> 18e586b (fixed something)
    initializeRoleChoicePage
} = require("../../public/authentication/role-choice.js");

function createRoleChoiceDom() {
    document.body.innerHTML = `
<<<<<<< HEAD
        <main>
            <p id="role-choice-status"></p>
            <p id="role-choice-summary"></p>
            <p id="application-status-message"></p>

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
=======
        <section>
            <p id="role-choice-status"></p>
            <button id="choose-customer" type="button">Customer</button>
            <button id="choose-vendor" type="button">Vendor</button>
        </section>
>>>>>>> 18e586b (fixed something)
    `;

    return {
        statusElement: document.querySelector("#role-choice-status"),
<<<<<<< HEAD
        summaryElement: document.querySelector("#role-choice-summary"),
        applicationStateElement: document.querySelector("#application-status-message"),
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

    test("normalizers handle text, portals, and statuses", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
        expect(normalizeText(42)).toBe("");
        expect(normalizePortal("  Vendor  ")).toBe("vendor");
        expect(normalizeVendorStatus("suspended")).toBe("blocked");
        expect(normalizeVendorStatus("unknown")).toBe("none");
        expect(normalizeAdminApplicationStatus("SUSPENDED")).toBe("blocked");
        expect(normalizeAdminApplicationStatus("whatever")).toBe("none");
        expect(normalizeAdminApplicationStatus("none", true)).toBe("approved");
        expect(normalizeAccountStatus("disabled")).toBe("disabled");
        expect(normalizeAccountStatus("inactive")).toBe("active");
    });

    test("portal validation and auth utils resolution work", () => {
        expect(isValidPortal("customer")).toBe(true);
        expect(isValidPortal("vendor")).toBe(true);
        expect(isValidPortal("admin")).toBe(true);
        expect(isValidPortal("roleChoice")).toBe(false);

        const explicitUtils = { name: "explicit" };
        window.authUtils = { name: "window" };

        expect(resolveAuthUtils(explicitUtils)).toBe(explicitUtils);
        expect(resolveAuthUtils()).toBe(window.authUtils);
        delete window.authUtils;
        expect(resolveAuthUtils()).toBeNull();
    });

    test("portal routes use fallbacks and auth utils overrides", () => {
        expect(getFallbackPortalRoutes()).toEqual({
            customer: "../customer/index.html",
            vendor: "../vendor/index.html",
            admin: "../admin/index.html",
            roleChoice: "../authentication/role-choice.html",
            profile: "../authentication/profile.html",
            login: "../authentication/login.html"
        });

        expect(getPortalRoute("customer")).toBe("../customer/index.html");
        expect(getPortalRoute("vendor")).toBe("../vendor/index.html");
        expect(getPortalRoute("admin")).toBe("../admin/index.html");
        expect(getPortalRoute("profile")).toBe("../authentication/profile.html");
        expect(getPortalRoute("unknown")).toBe("../authentication/login.html");

        const authUtils = {
            getPortalRoute: jest.fn((portal) => `/custom/${portal}.html`),
            PORTAL_ROUTES: {
                roleChoice: "/role-choice.html",
                profile: "/profile.html",
                login: "/login.html"
            }
        };

        expect(getPortalRoute("customer", authUtils)).toBe("/custom/customer.html");
        expect(getPortalRoute("roleChoice", authUtils)).toBe("/role-choice.html");
        expect(getPortalRoute("profile", authUtils)).toBe("/profile.html");
        expect(getPortalRoute("login", authUtils)).toBe("/login.html");
    });

    test("small DOM helpers work safely", () => {
        const { statusElement, customerButton, customerSection, summaryElement } = createRoleChoiceDom();

        setStatusMessage(statusElement, "Saved.", "success");
        expect(statusElement.textContent).toBe("Saved.");
        expect(statusElement.dataset.state).toBe("success");
        expect(() => setStatusMessage(null, "Saved.", "success")).not.toThrow();

        setButtonState(customerButton, true);
        expect(customerButton.disabled).toBe(true);
        expect(() => setButtonState(null, true)).not.toThrow();

        setElementHidden(customerSection, true);
        expect(customerSection.hidden).toBe(true);
        expect(customerSection.getAttribute("aria-hidden")).toBe("true");

        setElementText(summaryElement, "Portal summary");
        expect(summaryElement.textContent).toBe("Portal summary");
    });

    test("hasAuthenticatedIdentity recognises uid email or phone", () => {
        expect(hasAuthenticatedIdentity({ uid: "user-1" })).toBe(true);
        expect(hasAuthenticatedIdentity({ email: "user@example.com" })).toBe(true);
        expect(hasAuthenticatedIdentity({ phoneNumber: "+27712345678" })).toBe(true);
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
            vendorStatus: "approved",
            vendorReason: "",
            adminApplicationStatus: "approved",
            adminApplicationReason: "",
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
            fullName: " Faranani ",
            email: " USER@Example.com ",
            phoneNumber: " 0712345678 ",
            photoURL: " https://example.com/photo.jpg ",
            isAdmin: false,
            vendorStatus: "suspended",
            rejectionReason: " Missing docs ",
            adminApplicationStatus: "rejected",
            adminApplicationReason: " Need clearer reason ",
            accountStatus: "inactive"
        });

        expect(result).toEqual({
            uid: "user-1",
            displayName: "Faranani",
            email: "user@example.com",
            phoneNumber: "0712345678",
            photoURL: "https://example.com/photo.jpg",
            isAdmin: false,
            vendorStatus: "blocked",
            vendorReason: "Missing docs",
            adminApplicationStatus: "rejected",
            adminApplicationReason: "Need clearer reason",
            accountStatus: "active"
        });
    });

    test("portal access helpers match the new access model", () => {
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "active" })).toBe(true);
        expect(canAccessCustomerPortal({ uid: "user-1", accountStatus: "blocked" })).toBe(false);
        expect(canAccessVendorPortal({ vendorStatus: "approved", accountStatus: "active" })).toBe(true);
        expect(canAccessVendorPortal({ isAdmin: true, vendorStatus: "none", accountStatus: "active" })).toBe(false);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(canAccessAdminPortal({ isAdmin: true, accountStatus: "disabled" })).toBe(false);
    });

    test("available portals, default route, and choice state are derived correctly", () => {
        const authUtils = {
            getAvailablePortals: jest.fn(() => ["customer", "admin"]),
            shouldGoToRoleChoice: jest.fn(() => true),
            getDefaultPortalRoute: jest.fn(() => "/special-default.html")
        };

        expect(getAvailablePortals({ uid: "user-1" }, authUtils)).toEqual(["customer", "admin"]);
        expect(shouldGoToRoleChoice({ uid: "user-1" }, authUtils)).toBe(true);
        expect(getDefaultPortalRoute({ uid: "user-1" }, authUtils)).toBe("/special-default.html");

        expect(
            getAvailablePortals({
                uid: "user-1",
                vendorStatus: "approved",
                accountStatus: "active"
            })
        ).toEqual(["customer", "vendor"]);

        expect(getDefaultPortalRoute({})).toBe("../authentication/login.html");
        expect(getDefaultPortalRoute({ uid: "user-1" })).toBe("../customer/index.html");
        expect(
            getDefaultPortalRoute({
                uid: "user-1",
                vendorStatus: "approved"
            })
        ).toBe("../authentication/role-choice.html");

        const state = getRoleChoiceState({
            uid: "user-1",
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(state.availablePortals).toEqual(["customer", "vendor"]);
        expect(state.needsChoice).toBe(true);
        expect(state.canAccessAdmin).toBe(false);
    });

    test("summary and application messages are friendly and role-based", () => {
        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "vendor", "admin"]
            })
        ).toBe("Choose where you want to work next. All three portals are available to you.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "admin"]
            })
        ).toBe("You can continue to either the customer portal or the admin portal.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer", "vendor"]
            })
        ).toBe("You can continue to either the customer portal or the vendor portal.");

        expect(
            getPortalSummaryText({
                availablePortals: ["customer"]
            })
        ).toBe("Your account currently has customer access only.");

        expect(getPortalSummaryText({ availablePortals: [] })).toBe(
            "You do not currently have access to any portal."
        );

        expect(
            getApplicationStatusMessage({
                vendorStatus: "pending",
                adminApplicationStatus: "none"
            })
        ).toBe("Vendor application pending approval.");

        expect(
            getApplicationStatusMessage({
                vendorStatus: "rejected",
                vendorReason: "Missing documents",
                adminApplicationStatus: "blocked",
                adminApplicationReason: "Policy issue"
            })
        ).toBe("Vendor application rejected: Missing documents Admin application blocked: Policy issue");

        expect(
            getApplicationStatusMessage({
                isAdmin: true,
                adminApplicationStatus: "approved"
            })
        ).toBe("Admin access approved.");
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
=======
        customerButton: document.querySelector("#choose-customer"),
        vendorButton: document.querySelector("#choose-vendor")
    };
}

describe("role-choice.js helpers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("normalizeText trims whitespace", () => {
        expect(normalizeText("  Hello  ")).toBe("Hello");
    });

    test("normalizeText returns empty string for non-string values", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(42)).toBe("");
    });

    test("normalizeRole trims and lowercases role", () => {
        expect(normalizeRole("  Vendor  ")).toBe("vendor");
    });

    test("isValidRole accepts customer", () => {
        expect(isValidRole("customer")).toBe(true);
    });

    test("isValidRole accepts vendor", () => {
        expect(isValidRole("vendor")).toBe(true);
    });

    test("isValidRole accepts mixed case with spaces", () => {
        expect(isValidRole("  CuStOmEr ")).toBe(true);
    });

    test("isValidRole rejects admin", () => {
        expect(isValidRole("admin")).toBe(false);
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

    test("setButtonState disables button", () => {
        const { customerButton } = createRoleChoiceDom();

        setButtonState(customerButton, true);

        expect(customerButton.disabled).toBe(true);
    });

    test("setButtonState enables button", () => {
        const { customerButton } = createRoleChoiceDom();

        setButtonState(customerButton, false);

        expect(customerButton.disabled).toBe(false);
    });

    test("setButtonState does nothing when button is missing", () => {
        expect(() => setButtonState(null, true)).not.toThrow();
    });

    test("getNextRouteForRole returns customer route", () => {
        expect(getNextRouteForRole("customer")).toBe("../customer/index.html");
    });

    test("getNextRouteForRole returns vendor route", () => {
        expect(getNextRouteForRole("vendor")).toBe("./pending-vendor.html");
    });

    test("buildRoleUpdates returns customer updates", () => {
        const result = buildRoleUpdates("customer", {
            roles: { admin: false, vendor: false, customer: true }
        });

        expect(result).toEqual({
            roles: {
                customer: true,
                vendor: false,
                admin: false
            },
            vendorStatus: "none"
        });
    });

    test("buildRoleUpdates returns vendor updates and preserves admin", () => {
        const result = buildRoleUpdates("vendor", {
            roles: { admin: true, vendor: false, customer: true }
        });

        expect(result).toEqual({
            roles: {
                customer: false,
                vendor: true,
                admin: true
            },
            vendorStatus: "pending"
        });
    });

    test("buildRoleUpdates handles missing profile", () => {
        const result = buildRoleUpdates("customer");

        expect(result).toEqual({
            roles: {
                customer: true,
                vendor: false,
                admin: false
            },
            vendorStatus: "none"
        });
>>>>>>> 18e586b (fixed something)
    });
});

describe("role-choice.js service submission", () => {
<<<<<<< HEAD
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("submitPortalChoice validates portal and dependencies", async () => {
        await expect(submitPortalChoice("roleChoice", {})).resolves.toEqual({
            success: false,
            message: "Please choose a valid portal."
        });

        await expect(
            submitPortalChoice("customer", {
                authService: {
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");

        await expect(
            submitPortalChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" }))
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });

    test("submitPortalChoice handles signed out, denied, and successful access", async () => {
        const signedOutService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        await expect(submitPortalChoice("customer", { authService: signedOutService })).resolves.toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });

        const deniedService = {
=======
    test("submitRoleChoice updates current user to customer", async () => {
        const authService = {
>>>>>>> 18e586b (fixed something)
            getCurrentUser: jest.fn(() => ({
                uid: "user-1"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1",
<<<<<<< HEAD
                vendorStatus: "none",
                accountStatus: "active"
            })
        };

        await expect(submitPortalChoice("vendor", { authService: deniedService })).resolves.toEqual({
            success: false,
            message: "You do not have access to that portal."
        });

        const allowedService = {
=======
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-1"
            })
        };

        const result = await submitRoleChoice("customer", { authService });

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(authService.getCurrentUserProfile).toHaveBeenCalledWith("user-1");
        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-1", {
            roles: {
                customer: true,
                vendor: false,
                admin: false
            },
            vendorStatus: "none"
        });
        expect(result).toEqual({
            success: true,
            role: "customer",
            updates: {
                roles: {
                    customer: true,
                    vendor: false,
                    admin: false
                },
                vendorStatus: "none"
            },
            nextRoute: "../customer/index.html"
        });
    });

    test("submitRoleChoice updates current user to vendor", async () => {
        const authService = {
>>>>>>> 18e586b (fixed something)
            getCurrentUser: jest.fn(() => ({
                uid: "user-2"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2",
<<<<<<< HEAD
                vendorStatus: "approved",
                accountStatus: "active"
            })
        };

        const result = await submitPortalChoice("vendor", { authService: allowedService });
        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("../vendor/index.html");
        expect(result.profile.vendorStatus).toBe("approved");
    });

    test("submitPortalChoice uses auth fallback profile when Firestore profile is missing", async () => {
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
        expect(result.profile.email).toBe("fallback@example.com");
    });
});

describe("role-choice.js DOM rendering and handlers", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("portal display element helper finds the correct element", () => {
        const { customerSection, customerButton } = createRoleChoiceDom();

        expect(getPortalDisplayElement(customerSection, customerButton)).toBe(customerSection);
        expect(getPortalDisplayElement(null, customerButton)).toBe(customerSection);

        const lonelyButton = document.createElement("button");
        document.body.appendChild(lonelyButton);

        expect(getPortalDisplayElement(null, lonelyButton)).toBe(lonelyButton);
        expect(getPortalDisplayElement(null, null)).toBeNull();
    });

    test("renderRoleChoicePage shows correct sections and messages", () => {
        const elements = createRoleChoiceDom();

        renderRoleChoicePage(elements, {
            profile: {
                vendorStatus: "rejected",
                vendorReason: "Missing documents",
                adminApplicationStatus: "pending"
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
        expect(elements.summaryElement.textContent).toBe(
            "You can continue to either the customer portal or the admin portal."
        );
        expect(elements.applicationStateElement.textContent).toBe(
            "Vendor application rejected: Missing documents Admin application pending approval."
        );
        expect(elements.customerButton.textContent).toBe("Open Customer Portal");
        expect(elements.vendorButton.textContent).toBe("Open Vendor Portal");
        expect(elements.adminButton.textContent).toBe("Open Admin Portal");
    });

    test("renderRoleChoicePage handles missing state", () => {
        const { statusElement } = createRoleChoiceDom();

        renderRoleChoicePage({ statusElement }, null);

        expect(statusElement.textContent).toBe("Unable to load portal access.");
        expect(statusElement.dataset.state).toBe("error");
    });

    test("attachPortalChoiceHandler handles success, service errors, and thrown errors", async () => {
        const { customerButton, vendorButton, statusElement } = createRoleChoiceDom();

        const successService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-4"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                vendorStatus: "none",
                accountStatus: "active"
=======
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-2"
            })
        };

        const result = await submitRoleChoice("vendor", { authService });

        expect(authService.updateUserProfile).toHaveBeenCalledWith("user-2", {
            roles: {
                customer: false,
                vendor: true,
                admin: false
            },
            vendorStatus: "pending"
        });
        expect(result.success).toBe(true);
        expect(result.role).toBe("vendor");
        expect(result.nextRoute).toBe("./pending-vendor.html");
    });

    test("submitRoleChoice returns error for invalid role", async () => {
        const authService = {
            getCurrentUser: jest.fn(),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const result = await submitRoleChoice("admin", { authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Please choose a valid role.");
        expect(authService.getCurrentUser).not.toHaveBeenCalled();
    });

    test("submitRoleChoice returns error when no user is signed in", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const result = await submitRoleChoice("customer", { authService });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No user is currently signed in.");
        expect(authService.getCurrentUserProfile).not.toHaveBeenCalled();
        expect(authService.updateUserProfile).not.toHaveBeenCalled();
    });

    test("submitRoleChoice throws when getCurrentUser is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUserProfile: jest.fn(),
                    updateUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUser is required.");
    });

    test("submitRoleChoice throws when updateUserProfile is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" })),
                    getCurrentUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.updateUserProfile is required.");
    });

    test("submitRoleChoice throws when getCurrentUserProfile is missing", async () => {
        await expect(
            submitRoleChoice("customer", {
                authService: {
                    getCurrentUser: jest.fn(() => ({ uid: "user-1" })),
                    updateUserProfile: jest.fn()
                }
            })
        ).rejects.toThrow("authService.getCurrentUserProfile is required.");
    });
});

describe("role-choice.js button flow", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("attachRoleChoiceHandler saves customer choice and navigates", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-3"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-3"
>>>>>>> 18e586b (fixed something)
            })
        };

        const onSuccess = jest.fn();
        const navigate = jest.fn();

<<<<<<< HEAD
        const successHandler = attachPortalChoiceHandler({
            button: customerButton,
            portal: "customer",
            authService: successService,
=======
        const { handleClick } = attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
>>>>>>> 18e586b (fixed something)
            statusElement,
            onSuccess,
            navigate
        });

<<<<<<< HEAD
        const successResult = await successHandler.handleClick({
            preventDefault: jest.fn()
        });

        expect(successResult.success).toBe(true);
        expect(statusElement.textContent).toBe("Opening portal...");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");

        const deniedService = {
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
        const deniedHandler = attachPortalChoiceHandler({
            button: vendorButton,
            portal: "vendor",
            authService: deniedService,
            statusElement,
            onError
        });

        const deniedResult = await deniedHandler.handleClick({
            preventDefault: jest.fn()
        });

        expect(deniedResult.success).toBe(false);
        expect(statusElement.textContent).toBe("You do not have access to that portal.");
        expect(onError).toHaveBeenCalledTimes(1);

        const throwingHandler = attachPortalChoiceHandler({
            button: customerButton,
            portal: "customer",
            authService: {
                getCurrentUser: jest.fn(() => {
                    throw new Error("Unexpected failure");
                }),
                getCurrentUserProfile: jest.fn()
            },
            statusElement,
            onError
        });

        const thrownResult = await throwingHandler.handleClick({
            preventDefault: jest.fn()
        });

        expect(thrownResult.success).toBe(false);
        expect(thrownResult.message).toBe("Unexpected failure");
        expect(statusElement.textContent).toBe("Unexpected failure");
    });

    test("attachPortalChoiceHandler validates setup and works through real button clicks", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        expect(() =>
            attachPortalChoiceHandler({
                button: null,
                portal: "customer",
                authService: {}
            })
        ).toThrow("A portal button is required.");

        expect(() =>
            attachPortalChoiceHandler({
                button: customerButton,
                portal: "roleChoice",
                authService: {}
            })
        ).toThrow("A valid portal is required.");

        expect(() =>
            attachPortalChoiceHandler({
                button: customerButton,
                portal: "customer"
            })
        ).toThrow("authService is required.");
=======
        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe("Role selected successfully.");
        expect(statusElement.dataset.state).toBe("success");
        expect(onSuccess).toHaveBeenCalledTimes(1);
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
        expect(customerButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler saves vendor choice and navigates", async () => {
        const { vendorButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-4"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            }),
            updateUserProfile: jest.fn().mockResolvedValue({
                uid: "user-4"
            })
        };

        const navigate = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: vendorButton,
            role: "vendor",
            authService,
            statusElement,
            navigate
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(true);
        expect(statusElement.textContent).toBe("Role selected successfully.");
        expect(statusElement.dataset.state).toBe("success");
        expect(navigate).toHaveBeenCalledWith("./pending-vendor.html");
        expect(vendorButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler shows returned service error", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
            statusElement,
            onError
        });

        const result = await handleClick({
            preventDefault: jest.fn()
        });

        expect(result.success).toBe(false);
        expect(statusElement.textContent).toBe("No user is currently signed in.");
        expect(statusElement.dataset.state).toBe("error");
        expect(onError).toHaveBeenCalledTimes(1);
        expect(customerButton.disabled).toBe(false);
    });

    test("attachRoleChoiceHandler handles thrown errors", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => {
                throw new Error("Unexpected failure");
            }),
            getCurrentUserProfile: jest.fn(),
            updateUserProfile: jest.fn()
        };

        const onError = jest.fn();

        const { handleClick } = attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
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

    test("attachRoleChoiceHandler throws if button is missing", () => {
        expect(() =>
            attachRoleChoiceHandler({
                button: null,
                role: "customer",
                authService: {}
            })
        ).toThrow("A role choice button is required.");
    });

    test("attachRoleChoiceHandler throws if role is invalid", () => {
        const { customerButton } = createRoleChoiceDom();

        expect(() =>
            attachRoleChoiceHandler({
                button: customerButton,
                role: "admin",
                authService: {}
            })
        ).toThrow("A valid role is required.");
    });

    test("attachRoleChoiceHandler throws if authService is missing", () => {
        const { customerButton } = createRoleChoiceDom();

        expect(() =>
            attachRoleChoiceHandler({
                button: customerButton,
                role: "customer"
            })
        ).toThrow("authService is required.");
    });

    test("attached click listener works through real button click", async () => {
        const { customerButton, statusElement } = createRoleChoiceDom();
>>>>>>> 18e586b (fixed something)

        const authService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-6"
            })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
<<<<<<< HEAD
                uid: "user-6",
                vendorStatus: "none",
                accountStatus: "active"
            })
=======
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
>>>>>>> 18e586b (fixed something)
        };

        const navigate = jest.fn();

<<<<<<< HEAD
        attachPortalChoiceHandler({
            button: customerButton,
            portal: "customer",
=======
        attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
>>>>>>> 18e586b (fixed something)
            authService,
            statusElement,
            navigate
        });

        customerButton.click();
<<<<<<< HEAD
        await flushPromises();

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Opening portal...");
=======

        await new Promise((resolve) => setTimeout(resolve, 0));

        expect(authService.getCurrentUser).toHaveBeenCalledTimes(1);
        expect(statusElement.textContent).toBe("Role selected successfully.");
>>>>>>> 18e586b (fixed something)
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });
});

<<<<<<< HEAD
describe("role-choice.js page loading and initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
        delete window.authUtils;
    });

    test("loadRoleChoiceState validates dependencies and handles signed-out state", async () => {
        const authService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        await expect(loadRoleChoiceState({ authService })).resolves.toEqual({
            success: false,
            message: "No user is currently signed in.",
            nextRoute: "../authentication/login.html"
        });

        await expect(loadRoleChoiceState({})).rejects.toThrow("authService is required.");

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
        expect(result.profile.email).toBe("fallback@example.com");
        expect(result.state.availablePortals).toEqual(["customer"]);
    });

    test("initializeRoleChoicePage redirects single-portal users and signed-out users", async () => {
        createRoleChoiceDom();

        const customerOnlyService = {
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
        const customerOnlyResult = await initializeRoleChoicePage({
            authService: customerOnlyService,
            navigate
        });

        expect(customerOnlyResult.redirected).toBe(true);
        expect(customerOnlyResult.nextRoute).toBe("../customer/index.html");
        expect(navigate).toHaveBeenCalledWith("../customer/index.html");

        createRoleChoiceDom();

        const signedOutService = {
            getCurrentUser: jest.fn(() => null),
            getCurrentUserProfile: jest.fn()
        };

        const signedOutResult = await initializeRoleChoicePage({
            authService: signedOutService,
            navigate
        });

        expect(signedOutResult.redirected).toBe(true);
        expect(signedOutResult.nextRoute).toBe("../authentication/login.html");
    });

    test("initializeRoleChoicePage renders and wires buttons when choice is needed", async () => {
        const {
            statusElement,
            summaryElement,
            applicationStateElement,
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
                adminApplicationStatus: "pending",
                accountStatus: "active"
            })
=======
describe("role-choice.js page initialization", () => {
    beforeEach(() => {
        document.body.innerHTML = "";
    });

    test("initializeRoleChoicePage wires both buttons", () => {
        const { customerButton, vendorButton } = createRoleChoiceDom();

        const addEventListenerSpyCustomer = jest.spyOn(customerButton, "addEventListener");
        const addEventListenerSpyVendor = jest.spyOn(vendorButton, "addEventListener");

        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-7" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
        };

        const result = initializeRoleChoicePage({
            authService
        });

        expect(result.customerController).toBeTruthy();
        expect(result.vendorController).toBeTruthy();
        expect(addEventListenerSpyCustomer).toHaveBeenCalledWith("click", expect.any(Function));
        expect(addEventListenerSpyVendor).toHaveBeenCalledWith("click", expect.any(Function));
    });

    test("initializeRoleChoicePage uses custom navigate function", async () => {
        createRoleChoiceDom();

        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-8" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
>>>>>>> 18e586b (fixed something)
        };

        const navigate = jest.fn();

<<<<<<< HEAD
        const result = await initializeRoleChoicePage({
=======
        const result = initializeRoleChoicePage({
>>>>>>> 18e586b (fixed something)
            authService,
            navigate
        });

<<<<<<< HEAD
        expect(result.redirected).toBe(false);
        expect(result.customerController).toBeTruthy();
        expect(result.vendorController).toBeTruthy();
        expect(result.adminController).toBeNull();

        expect(statusElement.textContent).toBe("Choose a portal to continue.");
        expect(summaryElement.textContent).toBe(
            "You can continue to either the customer portal or the vendor portal."
        );
        expect(applicationStateElement.textContent).toBe("Admin application pending approval.");
        expect(adminSection.hidden).toBe(true);

        vendorButton.click();
        await flushPromises();

        expect(navigate).toHaveBeenCalledWith("../vendor/index.html");
    });

    test("initializeRoleChoicePage reports loading failures and requires auth service", async () => {
        const { statusElement } = createRoleChoiceDom();

        const failingService = {
            getCurrentUser: jest.fn(() => ({
                uid: "user-10"
            })),
            getCurrentUserProfile: jest.fn().mockRejectedValue(new Error("Failed to load profile"))
        };

        const result = await initializeRoleChoicePage({
            authService: failingService
        });

        expect(result.redirected).toBe(false);
        expect(result.message).toBe("Failed to load profile");
        expect(statusElement.textContent).toBe("Failed to load profile");
        expect(statusElement.dataset.state).toBe("error");

        await expect(initializeRoleChoicePage()).rejects.toThrow("authService is required.");
    });
});
=======
        await result.customerController.handleClick({
            preventDefault: jest.fn()
        });

        expect(navigate).toHaveBeenCalledWith("../customer/index.html");
    });

    test("initializeRoleChoicePage returns null controller when vendor button is missing", () => {
        document.body.innerHTML = `
            <section>
                <p id="role-choice-status"></p>
                <button id="choose-customer" type="button">Customer</button>
            </section>
        `;

        const authService = {
            getCurrentUser: jest.fn(() => ({ uid: "user-9" })),
            getCurrentUserProfile: jest.fn().mockResolvedValue({
                roles: { customer: false, vendor: false, admin: false }
            }),
            updateUserProfile: jest.fn().mockResolvedValue({})
        };

        const result = initializeRoleChoicePage({
            authService
        });

        expect(result.customerController).toBeTruthy();
        expect(result.vendorController).toBeNull();
    });

    test("initializeRoleChoicePage throws when authService is missing", () => {
        createRoleChoiceDom();

        expect(() => initializeRoleChoicePage()).toThrow("authService is required.");
    });
});
>>>>>>> 18e586b (fixed something)
