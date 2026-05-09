/**
 * role-choice.js
 *
 * Portal selection page logic for the Campus Food Ordering Platform.
 * This file:
 * - reads the signed-in user's profile
 * - determines which portals they can access
 * - shows only the allowed portal buttons/sections
 * - redirects automatically when only one portal is available
 *
 * Canonical access fields:
 * - isAdmin
 * - vendorStatus
 * - adminApplicationStatus
 * - accountStatus
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizePortal(portal) {
    return normalizeText(portal).toLowerCase();
}

function normalizeVendorStatus(status) {
    const value = normalizeText(status).toLowerCase();

    if (value === "suspended") {
        return "blocked";
    }

    if (
        value === "none" ||
        value === "pending" ||
        value === "approved" ||
        value === "rejected" ||
        value === "blocked"
    ) {
        return value;
    }

    return "none";
}

function normalizeAdminApplicationStatus(status, isAdmin = false) {
    const value = normalizeText(status).toLowerCase();

    if (isAdmin === true) {
        return "approved";
    }

    if (value === "suspended") {
        return "blocked";
    }

    if (
        value === "none" ||
        value === "pending" ||
        value === "approved" ||
        value === "rejected" ||
        value === "blocked"
    ) {
        return value;
    }

    return "none";
}

function normalizeAccountStatus(status) {
    const value = normalizeText(status).toLowerCase();

    if (value === "disabled" || value === "blocked") {
        return value;
    }

    return "active";
}

function isValidPortal(portal) {
    const normalizedPortal = normalizePortal(portal);

    return (
        normalizedPortal === "customer" ||
        normalizedPortal === "vendor" ||
        normalizedPortal === "admin"
    );
}

function resolveAuthUtils(explicitUtils) {
    if (explicitUtils) {
        return explicitUtils;
    }

    if (typeof window !== "undefined" && window.authUtils) {
        return window.authUtils;
    }

    return null;
}

function getFallbackPortalRoutes() {
    return {
        customer: "../customer/index.html",
        vendor: "../vendor/index.html",
        admin: "../admin/index.html",
        roleChoice: "../authentication/role-choice.html",
        profile: "../authentication/profile.html",
        login: "../authentication/login.html"
    };
}

function getPortalRoute(portal, authUtils) {
    const normalizedPortal = normalizePortal(portal);
    const fallbackRoutes = getFallbackPortalRoutes();

    if (
        authUtils &&
        typeof authUtils.getPortalRoute === "function" &&
        (
            normalizedPortal === "customer" ||
            normalizedPortal === "vendor" ||
            normalizedPortal === "admin"
        )
    ) {
        return authUtils.getPortalRoute(normalizedPortal);
    }

    if (
        authUtils &&
        authUtils.PORTAL_ROUTES &&
        typeof authUtils.PORTAL_ROUTES === "object"
    ) {
        if (normalizedPortal === "customer") {
            return authUtils.PORTAL_ROUTES.customer || fallbackRoutes.customer;
        }

        if (normalizedPortal === "vendor") {
            return authUtils.PORTAL_ROUTES.vendor || fallbackRoutes.vendor;
        }

        if (normalizedPortal === "admin") {
            return authUtils.PORTAL_ROUTES.admin || fallbackRoutes.admin;
        }

        if (normalizedPortal === "rolechoice") {
            return authUtils.PORTAL_ROUTES.roleChoice || fallbackRoutes.roleChoice;
        }

        if (normalizedPortal === "profile") {
            return authUtils.PORTAL_ROUTES.profile || fallbackRoutes.profile;
        }

        if (normalizedPortal === "login") {
            return authUtils.PORTAL_ROUTES.login || fallbackRoutes.login;
        }
    }

    if (normalizedPortal === "customer") {
        return fallbackRoutes.customer;
    }

    if (normalizedPortal === "vendor") {
        return fallbackRoutes.vendor;
    }

    if (normalizedPortal === "admin") {
        return fallbackRoutes.admin;
    }

    if (normalizedPortal === "rolechoice") {
        return fallbackRoutes.roleChoice;
    }

    if (normalizedPortal === "profile") {
        return fallbackRoutes.profile;
    }

    return fallbackRoutes.login;
}

function setStatusMessage(statusElement, message, state) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message || "";
    statusElement.dataset.state = state || "";
}

function setButtonState(button, isDisabled) {
    if (!button) {
        return;
    }

    button.disabled = !!isDisabled;
}

function setElementHidden(element, isHidden) {
    if (!element) {
        return;
    }

    element.hidden = !!isHidden;
    element.setAttribute("aria-hidden", isHidden ? "true" : "false");
}

function setElementText(element, value) {
    if (!element) {
        return;
    }

    element.textContent = value || "";
}

function ensureArray(value) {
    return Array.isArray(value) ? value : [];
}

function hasAuthenticatedIdentity(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : {};

    return (
        normalizeText(safeProfile.uid).length > 0 ||
        normalizeText(safeProfile.email).length > 0 ||
        normalizeText(safeProfile.phoneNumber).length > 0
    );
}

function normalizeUserProfile(profile, authUtils) {
    if (authUtils && typeof authUtils.normaliseUserData === "function") {
        return authUtils.normaliseUserData(profile);
    }

    if (authUtils && typeof authUtils.normalizeUserData === "function") {
        return authUtils.normalizeUserData(profile);
    }

    const safeProfile = profile && typeof profile === "object" ? profile : {};
    const isAdmin = safeProfile.isAdmin === true || safeProfile.admin === true;

    return {
        uid: normalizeText(safeProfile.uid),
        displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
        email: normalizeText(safeProfile.email).toLowerCase(),
        phoneNumber: normalizeText(safeProfile.phoneNumber),
        photoURL: normalizeText(safeProfile.photoURL),
        isAdmin,
        vendorStatus: normalizeVendorStatus(safeProfile.vendorStatus),
        vendorReason: normalizeText(
            safeProfile.vendorReason ||
            safeProfile.rejectionReason ||
            safeProfile.blockReason
        ),
        adminApplicationStatus: normalizeAdminApplicationStatus(
            safeProfile.adminApplicationStatus,
            isAdmin
        ),
        adminApplicationReason: normalizeText(
            safeProfile.adminApplicationReason ||
            safeProfile.adminRejectionReason ||
            safeProfile.adminBlockReason
        ),
        accountStatus: normalizeAccountStatus(safeProfile.accountStatus)
    };
}

function canAccessCustomerPortal(profile) {
    const safeProfile = normalizeUserProfile(profile);

    return (
        safeProfile.accountStatus === "active" &&
        hasAuthenticatedIdentity(safeProfile)
    );
}

function canAccessVendorPortal(profile) {
    const safeProfile = normalizeUserProfile(profile);

    return (
        safeProfile.accountStatus === "active" &&
        safeProfile.vendorStatus === "approved"
    );
}

function canAccessAdminPortal(profile) {
    const safeProfile = normalizeUserProfile(profile);

    return (
        safeProfile.accountStatus === "active" &&
        safeProfile.isAdmin === true
    );
}

function getAvailablePortals(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (authUtils && typeof authUtils.getAvailablePortals === "function") {
        return ensureArray(authUtils.getAvailablePortals(safeProfile));
    }

    const portals = [];

    if (canAccessCustomerPortal(safeProfile)) {
        portals.push("customer");
    }

    if (canAccessVendorPortal(safeProfile)) {
        portals.push("vendor");
    }

    if (canAccessAdminPortal(safeProfile)) {
        portals.push("admin");
    }

    return portals;
}

function shouldGoToRoleChoice(profile, authUtils) {
    if (authUtils && typeof authUtils.shouldGoToRoleChoice === "function") {
        return authUtils.shouldGoToRoleChoice(profile);
    }

    return getAvailablePortals(profile, authUtils).length > 1;
}

function getDefaultPortalRoute(profile, authUtils) {
    if (authUtils && typeof authUtils.getDefaultPortalRoute === "function") {
        return authUtils.getDefaultPortalRoute(profile);
    }

    const portals = getAvailablePortals(profile, authUtils);

    if (portals.length === 0) {
        return getPortalRoute("login", authUtils);
    }

    if (portals.length === 1) {
        return getPortalRoute(portals[0], authUtils);
    }

    return getPortalRoute("rolechoice", authUtils);
}

function getRoleChoiceState(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);
    const availablePortals = getAvailablePortals(safeProfile, authUtils);
    const needsChoice = shouldGoToRoleChoice(safeProfile, authUtils);
    const defaultRoute = getDefaultPortalRoute(safeProfile, authUtils);

    return {
        profile: safeProfile,
        availablePortals,
        needsChoice,
        defaultRoute,
        canAccessCustomer: availablePortals.includes("customer"),
        canAccessVendor: availablePortals.includes("vendor"),
        canAccessAdmin: availablePortals.includes("admin")
    };
}

function getPortalSummaryText(state) {
    if (!state || !Array.isArray(state.availablePortals)) {
        return "";
    }

    const availablePortals = state.availablePortals;

    if (
        availablePortals.includes("customer") &&
        availablePortals.includes("vendor") &&
        availablePortals.includes("admin")
    ) {
        return "Choose where you want to work next. All three portals are available to you.";
    }

    if (
        availablePortals.includes("customer") &&
        availablePortals.includes("admin")
    ) {
        return "You can continue to either the customer portal or the admin portal.";
    }

    if (
        availablePortals.includes("customer") &&
        availablePortals.includes("vendor")
    ) {
        return "You can continue to either the customer portal or the vendor portal.";
    }

    if (availablePortals.includes("customer")) {
        return "Your account currently has customer access only.";
    }

    return "You do not currently have access to any portal.";
}

function getApplicationStatusMessage(profile) {
    const safeProfile = normalizeUserProfile(profile);
    const messages = [];

    if (safeProfile.vendorStatus === "pending") {
        messages.push("Vendor application pending approval.");
    } else if (safeProfile.vendorStatus === "rejected") {
        messages.push(
            safeProfile.vendorReason
                ? `Vendor application rejected: ${safeProfile.vendorReason}`
                : "Vendor application rejected."
        );
    } else if (safeProfile.vendorStatus === "blocked") {
        messages.push(
            safeProfile.vendorReason
                ? `Vendor access blocked: ${safeProfile.vendorReason}`
                : "Vendor access is blocked."
        );
    }

    if (safeProfile.isAdmin === true) {
        messages.push("Admin access approved.");
    } else if (safeProfile.adminApplicationStatus === "pending") {
        messages.push("Admin application pending approval.");
    } else if (safeProfile.adminApplicationStatus === "rejected") {
        messages.push(
            safeProfile.adminApplicationReason
                ? `Admin application rejected: ${safeProfile.adminApplicationReason}`
                : "Admin application rejected."
        );
    } else if (safeProfile.adminApplicationStatus === "blocked") {
        messages.push(
            safeProfile.adminApplicationReason
                ? `Admin application blocked: ${safeProfile.adminApplicationReason}`
                : "Admin application is blocked."
        );
    }

    return messages.join(" ");
}

function canAccessPortal(portal, profile, authUtils) {
    const normalizedPortal = normalizePortal(portal);
    const state = getRoleChoiceState(profile, authUtils);

    return state.availablePortals.includes(normalizedPortal);
}

async function submitPortalChoice(portal, dependencies = {}) {
    const normalizedPortal = normalizePortal(portal);
    const authService = dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies.authUtils);

    if (!isValidPortal(normalizedPortal)) {
        return {
            success: false,
            message: "Please choose a valid portal."
        };
    }

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    const user = authService.getCurrentUser();

    if (!user || !user.uid) {
        return {
            success: false,
            message: "No user is currently signed in.",
            nextRoute: getPortalRoute("login", authUtils)
        };
    }

    const profile = await authService.getCurrentUserProfile(user.uid);

    const state = getRoleChoiceState(
        profile || {
            uid: user.uid,
            displayName: user.displayName || "",
            email: user.email || "",
            phoneNumber: user.phoneNumber || "",
            photoURL: user.photoURL || ""
        },
        authUtils
    );

    if (!canAccessPortal(normalizedPortal, state.profile, authUtils)) {
        return {
            success: false,
            message: "You do not have access to that portal."
        };
    }

    return {
        success: true,
        portal: normalizedPortal,
        profile: state.profile,
        nextRoute: getPortalRoute(normalizedPortal, authUtils)
    };
}

function attachPortalChoiceHandler(options = {}) {
    const {
        button,
        portal,
        authService,
        authUtils,
        statusElement,
        navigate,
        onSuccess,
        onError
    } = options;

    if (!button) {
        throw new Error("A portal button is required.");
    }

    if (!isValidPortal(portal)) {
        throw new Error("A valid portal is required.");
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setButtonState(button, true);
        setStatusMessage(statusElement, "", "");

        try {
            const result = await submitPortalChoice(portal, {
                authService,
                authUtils
            });

            setButtonState(button, false);

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to continue right now.",
                    "error"
                );

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            setStatusMessage(statusElement, "Opening portal...", "success");

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            if (typeof navigate === "function" && result.nextRoute) {
                navigate(result.nextRoute);
            }

            return result;
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to continue right now.";

            setButtonState(button, false);
            setStatusMessage(statusElement, message, "error");

            if (typeof onError === "function") {
                onError(error);
            }

            return {
                success: false,
                message
            };
        }
    }

    button.addEventListener("click", handleClick);

    return {
        handleClick
    };
}

function getPortalDisplayElement(sectionElement, buttonElement) {
    if (sectionElement) {
        return sectionElement;
    }

    if (buttonElement && typeof buttonElement.closest === "function") {
        return buttonElement.closest("section") || buttonElement;
    }

    return buttonElement || null;
}

function renderRoleChoicePage(elements = {}, state) {
    const {
        customerButton,
        vendorButton,
        adminButton,
        customerSection,
        vendorSection,
        adminSection,
        statusElement,
        summaryElement,
        applicationStateElement
    } = elements;

    if (!state) {
        setStatusMessage(statusElement, "Unable to load portal access.", "error");
        return;
    }

    const customerDisplayElement = getPortalDisplayElement(customerSection, customerButton);
    const vendorDisplayElement = getPortalDisplayElement(vendorSection, vendorButton);
    const adminDisplayElement = getPortalDisplayElement(adminSection, adminButton);

    setElementHidden(customerDisplayElement, !state.canAccessCustomer);
    setElementHidden(vendorDisplayElement, !state.canAccessVendor);
    setElementHidden(adminDisplayElement, !state.canAccessAdmin);

    setButtonState(customerButton, false);
    setButtonState(vendorButton, false);
    setButtonState(adminButton, false);

    setStatusMessage(
        statusElement,
        state.needsChoice ? "Choose a portal to continue." : "",
        state.needsChoice ? "info" : ""
    );

    setElementText(summaryElement, getPortalSummaryText(state));
    setElementText(applicationStateElement, getApplicationStatusMessage(state.profile || {}));

    if (customerButton) {
        customerButton.dataset.portal = "customer";
        customerButton.textContent = "Open Customer Portal";
    }

    if (vendorButton) {
        vendorButton.dataset.portal = "vendor";
        vendorButton.textContent = "Open Vendor Portal";
    }

    if (adminButton) {
        adminButton.dataset.portal = "admin";
        adminButton.textContent = "Open Admin Portal";
    }
}

async function loadRoleChoiceState(dependencies = {}) {
    const authService = dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies.authUtils);

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    const user = authService.getCurrentUser();

    if (!user || !user.uid) {
        return {
            success: false,
            message: "No user is currently signed in.",
            nextRoute: getPortalRoute("login", authUtils)
        };
    }

    const profile = await authService.getCurrentUserProfile(user.uid);

    const fallbackProfile = {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        photoURL: user.photoURL || ""
    };

    const state = getRoleChoiceState(profile || fallbackProfile, authUtils);

    return {
        success: true,
        user,
        profile: state.profile,
        state
    };
}

async function initializeRoleChoicePage(options = {}) {
    const authService =
        options.authService ||
        (typeof window !== "undefined" ? window.authService : undefined);

    const authUtils = resolveAuthUtils(options.authUtils);

    const statusSelector = options.statusSelector || "#role-choice-status";
    const summarySelector = options.summarySelector || "#role-choice-summary";
    const applicationStateSelector = options.applicationStateSelector || "#application-status-message";

    const customerSectionSelector =
        options.customerSectionSelector || "#customer-portal-section";

    const vendorSectionSelector =
        options.vendorSectionSelector || "#vendor-portal-section";

    const adminSectionSelector =
        options.adminSectionSelector || "#admin-portal-section";

    const customerButtonSelector =
        options.customerButtonSelector ||
        "#choose-customer, #go-customer, [data-portal-button='customer']";

    const vendorButtonSelector =
        options.vendorButtonSelector ||
        "#choose-vendor, #go-vendor, [data-portal-button='vendor']";

    const adminButtonSelector =
        options.adminButtonSelector ||
        "#choose-admin, #go-admin, [data-portal-button='admin']";

    if (!authService) {
        throw new Error("authService is required.");
    }

    const statusElement = document.querySelector(statusSelector);
    const summaryElement = document.querySelector(summarySelector);
    const applicationStateElement = document.querySelector(applicationStateSelector);

    const customerSection = document.querySelector(customerSectionSelector);
    const vendorSection = document.querySelector(vendorSectionSelector);
    const adminSection = document.querySelector(adminSectionSelector);

    const customerButton = document.querySelector(customerButtonSelector);
    const vendorButton = document.querySelector(vendorButtonSelector);
    const adminButton = document.querySelector(adminButtonSelector);

    const resolvedNavigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function goToRoute(nextRoute) {
                window.location.href = nextRoute;
            };

    setStatusMessage(statusElement, "Checking your access...", "loading");

    try {
        const result = await loadRoleChoiceState({
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(
                statusElement,
                result.message || "Unable to load your access right now.",
                "error"
            );

            if (result.nextRoute) {
                resolvedNavigate(result.nextRoute);
            }

            return {
                redirected: true,
                nextRoute: result.nextRoute || getPortalRoute("login", authUtils)
            };
        }

        const state = result.state;

        renderRoleChoicePage(
            {
                customerButton,
                vendorButton,
                adminButton,
                customerSection,
                vendorSection,
                adminSection,
                statusElement,
                summaryElement,
                applicationStateElement
            },
            state
        );

        if (!state.needsChoice) {
            const nextRoute =
                state.defaultRoute && state.defaultRoute !== getPortalRoute("rolechoice", authUtils)
                    ? state.defaultRoute
                    : getPortalRoute("customer", authUtils);

            resolvedNavigate(nextRoute);

            return {
                redirected: true,
                nextRoute,
                state
            };
        }

        const customerController = customerButton && state.canAccessCustomer
            ? attachPortalChoiceHandler({
                button: customerButton,
                portal: "customer",
                authService,
                authUtils,
                statusElement,
                navigate: resolvedNavigate
            })
            : null;

        const vendorController = vendorButton && state.canAccessVendor
            ? attachPortalChoiceHandler({
                button: vendorButton,
                portal: "vendor",
                authService,
                authUtils,
                statusElement,
                navigate: resolvedNavigate
            })
            : null;

        const adminController = adminButton && state.canAccessAdmin
            ? attachPortalChoiceHandler({
                button: adminButton,
                portal: "admin",
                authService,
                authUtils,
                statusElement,
                navigate: resolvedNavigate
            })
            : null;

        return {
            redirected: false,
            state,
            customerController,
            vendorController,
            adminController
        };
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load your access right now.";

        setStatusMessage(statusElement, message, "error");

        return {
            redirected: false,
            error,
            message
        };
    }
}

const roleChoicePage = {
    normalizeText,
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
    initializeRoleChoicePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = roleChoicePage;
}

if (typeof window !== "undefined") {
    window.roleChoicePage = roleChoicePage;
}
