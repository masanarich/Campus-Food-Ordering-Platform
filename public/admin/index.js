/**
 * customer/index.js
 *
 * Customer portal landing page logic.
 * This file:
 * - reads the signed-in user and profile
 * - renders name, role, profile picture, email, and vendor status
 * - shows portal navigation buttons
 * - shows all portal buttons for owner/admin users
 * - shows a profile button and vendor application button
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
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

function normalizeAccountStatus(status) {
    const value = normalizeText(status).toLowerCase();

    if (value === "disabled" || value === "blocked") {
        return value;
    }

    return "active";
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

function getFallbackRoutes() {
    return {
        customer: "./index.html",
        vendor: "../vendor/index.html",
        admin: "../admin/index.html",
        roleChoice: "../authentication/role-choice.html",
        profile: "../authentication/profile.html",
        vendorApplication: "../authentication/vendor-application.html",
        login: "../authentication/login.html"
    };
}

function getPortalRoute(routeName, authUtils) {
    const routes = getFallbackRoutes();
    const key = normalizeText(routeName);

    if (
        authUtils &&
        authUtils.PORTAL_ROUTES &&
        typeof authUtils.PORTAL_ROUTES === "object"
    ) {
        if (key === "customer") {
            return authUtils.PORTAL_ROUTES.customer || routes.customer;
        }

        if (key === "vendor") {
            return authUtils.PORTAL_ROUTES.vendor || routes.vendor;
        }

        if (key === "admin") {
            return authUtils.PORTAL_ROUTES.admin || routes.admin;
        }

        if (key === "roleChoice") {
            return authUtils.PORTAL_ROUTES.roleChoice || routes.roleChoice;
        }

        if (key === "login") {
            return authUtils.PORTAL_ROUTES.login || routes.login;
        }

        if (key === "vendorApplication") {
            return authUtils.PORTAL_ROUTES.vendorApplication || routes.vendorApplication;
        }
    }

    if (key === "customer") {
        return routes.customer;
    }

    if (key === "vendor") {
        return routes.vendor;
    }

    if (key === "admin") {
        return routes.admin;
    }

    if (key === "roleChoice") {
        return routes.roleChoice;
    }

    if (key === "profile") {
        return routes.profile;
    }

    if (key === "vendorApplication") {
        return routes.vendorApplication;
    }

    return routes.login;
}

function hasAuthenticatedIdentity(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : {};

    return (
        normalizeText(safeProfile.uid).length > 0 ||
        normalizeText(safeProfile.email).length > 0 ||
        normalizeText(safeProfile.phoneNumber).length > 0
    );
}

function normalizeProfile(profile, authUtils) {
    if (authUtils && typeof authUtils.normaliseUserData === "function") {
        return authUtils.normaliseUserData(profile);
    }

    if (authUtils && typeof authUtils.normalizeUserData === "function") {
        return authUtils.normalizeUserData(profile);
    }

    const safeProfile = profile && typeof profile === "object" ? profile : {};
    const isOwner = safeProfile.isOwner === true || safeProfile.owner === true;
    const isAdmin =
        safeProfile.isAdmin === true ||
        safeProfile.admin === true ||
        isOwner === true;

    return {
        uid: normalizeText(safeProfile.uid),
        displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
        email: normalizeText(safeProfile.email).toLowerCase(),
        phoneNumber: normalizeText(safeProfile.phoneNumber),
        photoURL: normalizeText(safeProfile.photoURL),
        isAdmin,
        isOwner,
        vendorStatus: normalizeVendorStatus(safeProfile.vendorStatus),
        vendorReason: normalizeText(
            safeProfile.vendorReason ||
            safeProfile.rejectionReason ||
            safeProfile.blockReason
        ),
        accountStatus: normalizeAccountStatus(safeProfile.accountStatus)
    };
}

function getRoleLabel(profile) {
    const safeProfile = normalizeProfile(profile);

    if (safeProfile.isOwner === true) {
        return "Owner";
    }

    if (safeProfile.isAdmin === true) {
        return "Admin";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Vendor";
    }

    return "Customer";
}

function canAccessCustomerPortal(profile) {
    const safeProfile = normalizeProfile(profile);

    return (
        safeProfile.accountStatus === "active" &&
        (
            hasAuthenticatedIdentity(safeProfile) ||
            safeProfile.isAdmin === true ||
            safeProfile.isOwner === true
        )
    );
}

function canAccessVendorPortal(profile) {
    const safeProfile = normalizeProfile(profile);

    return (
        safeProfile.accountStatus === "active" &&
        (
            safeProfile.isOwner === true ||
            safeProfile.isAdmin === true ||
            safeProfile.vendorStatus === "approved"
        )
    );
}

function canAccessAdminPortal(profile) {
    const safeProfile = normalizeProfile(profile);

    return (
        safeProfile.accountStatus === "active" &&
        (
            safeProfile.isOwner === true ||
            safeProfile.isAdmin === true
        )
    );
}

function canApplyForVendor(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (
        authUtils &&
        typeof authUtils.canSubmitVendorApplication === "function"
    ) {
        return authUtils.canSubmitVendorApplication(safeProfile);
    }

    if (safeProfile.accountStatus !== "active") {
        return false;
    }

    if (safeProfile.isOwner === true || safeProfile.isAdmin === true) {
        return false;
    }

    return (
        safeProfile.vendorStatus === "none" ||
        safeProfile.vendorStatus === "rejected"
    );
}

function getVendorStatusLabel(profile) {
    const safeProfile = normalizeProfile(profile);

    if (safeProfile.vendorStatus === "approved") {
        return "Approved";
    }

    if (safeProfile.vendorStatus === "pending") {
        return "Pending";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return "Rejected";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return "Blocked";
    }

    return "Not Applied";
}

function getPortalSummary(state) {
    if (!state) {
        return "";
    }

    if (state.profile.isOwner === true) {
        return "You have owner access and can open every portal.";
    }

    if (
        state.showCustomerPortal &&
        state.showVendorPortal &&
        state.showAdminPortal
    ) {
        return "You can open the customer, vendor, and admin portals.";
    }

    if (state.showCustomerPortal && state.showAdminPortal) {
        return "You can open the customer and admin portals.";
    }

    if (state.showCustomerPortal && state.showVendorPortal) {
        return "You can open the customer and vendor portals.";
    }

    if (state.showCustomerPortal) {
        return "You currently have customer portal access.";
    }

    return "You do not currently have portal access.";
}

function getVendorApplicationNote(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "pending") {
        return "Your vendor application is still pending approval.";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "You already have vendor access.";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return safeProfile.vendorReason
            ? `Your vendor application was rejected: ${safeProfile.vendorReason}`
            : "Your vendor application was rejected.";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return safeProfile.vendorReason
            ? `Your vendor access is blocked: ${safeProfile.vendorReason}`
            : "Your vendor access is blocked.";
    }

    if (canApplyForVendor(safeProfile, authUtils)) {
        return "You can apply to become a vendor from this page.";
    }

    return "Vendor application actions are not available right now.";
}

function getWelcomeMessage(profile) {
    const safeProfile = normalizeProfile(profile);
    const name = normalizeText(safeProfile.displayName) || "there";
    return `Welcome back, ${name}.`;
}

function getHomeState(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);
    const displayName = normalizeText(safeProfile.displayName) || "Customer User";

    return {
        profile: safeProfile,
        displayName,
        roleLabel: getRoleLabel(safeProfile),
        vendorStatusLabel: getVendorStatusLabel(safeProfile),
        welcomeMessage: getWelcomeMessage(safeProfile),
        vendorApplicationNote: getVendorApplicationNote(safeProfile, authUtils),
        portalSummary: getPortalSummary({
            profile: safeProfile,
            showCustomerPortal: canAccessCustomerPortal(safeProfile),
            showVendorPortal: canAccessVendorPortal(safeProfile),
            showAdminPortal: canAccessAdminPortal(safeProfile)
        }),
        showCustomerPortal: canAccessCustomerPortal(safeProfile),
        showVendorPortal: canAccessVendorPortal(safeProfile),
        showAdminPortal: canAccessAdminPortal(safeProfile),
        showChoosePortal:
            [
                canAccessCustomerPortal(safeProfile),
                canAccessVendorPortal(safeProfile),
                canAccessAdminPortal(safeProfile)
            ].filter(Boolean).length > 1,
        showVendorApplication: canApplyForVendor(safeProfile, authUtils)
    };
}

function getDefaultAvatar(name) {
    const trimmedName = normalizeText(name) || "U";
    const firstLetter = encodeURIComponent(trimmedName.charAt(0).toUpperCase());

    return `data:image/svg+xml;charset=UTF-8,` +
        `<svg xmlns="http://www.w3.org/2000/svg" width="2400/svg" width="240" height="240" viewBox="0 0 240 240">` +
        `<rect width="240" height="240" rx="120" fill="%23f0dfd1"></rect>` +
        `<text x="120" y="138" text-anchor="middle" font-size="92" font-family="Arial" fill="%238a5b3e">${firstLetter}</text>` +
        `</svg>`;
}

function setText(element, value) {
    if (!element) {
        return;
    }

    element.textContent = value || "";
}

function setHidden(element, isHidden) {
    if (!element) {
        return;
    }

    element.hidden = !!isHidden;
    element.setAttribute("aria-hidden", isHidden ? "true" : "false");
}

function setStatusMessage(element, message, state) {
    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.dataset.state = state || "";
}

function setImage(imageElement, imageUrl, altText, fallbackName) {
    if (!imageElement) {
        return;
    }

    imageElement.src = normalizeText(imageUrl) || getDefaultAvatar(fallbackName);
    imageElement.alt = normalizeText(altText) || "User profile picture";
}

function renderCustomerHomePage(elements, state) {
    if (!elements || !state) {
        return;
    }

    setStatusMessage(elements.statusElement, "Home page loaded.", "success");

    setText(elements.nameLine, `Name: ${state.displayName}`);
    setText(elements.roleLine, `Role: ${state.roleLabel}`);
    setText(
        elements.emailLine,
        `Email: ${normalizeText(state.profile.email) || "No email available"}`
    );
    setText(elements.vendorLine, `Vendor status: ${state.vendorStatusLabel}`);
    setText(elements.portalSummaryElement, state.portalSummary);
    setText(elements.welcomeMessageElement, state.welcomeMessage);
    setText(elements.vendorApplicationNoteElement, state.vendorApplicationNote);

    setImage(
        elements.profilePhoto,
        state.profile.photoURL,
        `${state.displayName} profile picture`,
        state.displayName
    );

    setHidden(elements.customerPortalButton, !state.showCustomerPortal);
    setHidden(elements.vendorPortalButton, !state.showVendorPortal);
    setHidden(elements.adminPortalButton, !state.showAdminPortal);
    setHidden(elements.choosePortalButton, !state.showChoosePortal);
    setHidden(elements.vendorApplicationButton, !state.showVendorApplication);
}

function attachNavigationHandler(options = {}) {
    const button = options.button;
    const route = options.route;
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };

    if (!button || !route) {
        return null;
    }

    function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        navigate(route);
        return route;
    }

    button.addEventListener("click", handleClick);

    return {
        handleClick
    };
}

async function loadCustomerHomeState(dependencies = {}) {
    const authService = dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies.authUtils);

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

    const fallbackProfile = {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        photoURL: user.photoURL || ""
    };

    const state = getHomeState(profile || fallbackProfile, authUtils);

    return {
        success: true,
        user,
        profile: state.profile,
        state
    };
}

async function initializeCustomerHomePage(options = {}) {
    const authService =
        options.authService ||
        (typeof window !== "undefined" ? window.authService : undefined);

    const authUtils = resolveAuthUtils(options.authUtils);

    if (!authService) {
        throw new Error("authService is required.");
    }

    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function goToRoute(nextRoute) {
                window.location.href = nextRoute;
            };

    const elements = {
        statusElement: document.querySelector("#customer-home-status"),
        profilePhoto: document.querySelector("#profile-photo"),
        nameLine: document.querySelector("#profile-name-line"),
        roleLine: document.querySelector("#profile-role-line"),
        emailLine: document.querySelector("#profile-email-line"),
        vendorLine: document.querySelector("#profile-vendor-line"),
        portalSummaryElement: document.querySelector("#portal-summary"),
        welcomeMessageElement: document.querySelector("#welcome-message"),
        vendorApplicationNoteElement: document.querySelector("#vendor-application-note"),
        profileButton: document.querySelector("#go-profile-button"),
        choosePortalButton: document.querySelector("#choose-portal-button"),
        vendorApplicationButton: document.querySelector("#go-vendor-application-button"),
        customerPortalButton: document.querySelector("#go-customer-portal-button"),
        vendorPortalButton: document.querySelector("#go-vendor-portal-button"),
        adminPortalButton: document.querySelector("#go-admin-portal-button")
    };

    setStatusMessage(elements.statusElement, "Loading your home page...", "loading");

    try {
        const result = await loadCustomerHomeState({
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(
                elements.statusElement,
                result.message || "Unable to load your home page right now.",
                "error"
            );

            if (result.nextRoute) {
                navigate(result.nextRoute);
            }

            return {
                redirected: true,
                nextRoute: result.nextRoute || getPortalRoute("login", authUtils)
            };
        }

        renderCustomerHomePage(elements, result.state);

        const profileController = attachNavigationHandler({
            button: elements.profileButton,
            route: getPortalRoute("profile", authUtils),
            navigate
        });

        const choosePortalController = result.state.showChoosePortal
            ? attachNavigationHandler({
                button: elements.choosePortalButton,
                route: getPortalRoute("roleChoice", authUtils),
                navigate
            })
            : null;

        const vendorApplicationController = result.state.showVendorApplication
            ? attachNavigationHandler({
                button: elements.vendorApplicationButton,
                route: getPortalRoute("vendorApplication", authUtils),
                navigate
            })
            : null;

        const customerPortalController = result.state.showCustomerPortal
            ? attachNavigationHandler({
                button: elements.customerPortalButton,
                route: getPortalRoute("customer", authUtils),
                navigate
            })
            : null;

        const vendorPortalController = result.state.showVendorPortal
            ? attachNavigationHandler({
                button: elements.vendorPortalButton,
                route: getPortalRoute("vendor", authUtils),
                navigate
            })
            : null;

        const adminPortalController = result.state.showAdminPortal
            ? attachNavigationHandler({
                button: elements.adminPortalButton,
                route: getPortalRoute("admin", authUtils),
                navigate
            })
            : null;

        return {
            redirected: false,
            state: result.state,
            profileController,
            choosePortalController,
            vendorApplicationController,
            customerPortalController,
            vendorPortalController,
            adminPortalController
        };
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load your home page right now.";

        setStatusMessage(elements.statusElement, message, "error");

        return {
            redirected: false,
            error,
            message
        };
    }
}

const customerHomePage = {
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
    canApplyForVendor,
    getVendorStatusLabel,
    getPortalSummary,
    getVendorApplicationNote,
    getWelcomeMessage,
    getHomeState,
    getDefaultAvatar,
    setText,
    setHidden,
    setStatusMessage,
    setImage,
    renderCustomerHomePage,
    attachNavigationHandler,
    loadCustomerHomeState,
    initializeCustomerHomePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = customerHomePage;
}

if (typeof window !== "undefined") {
    window.customerHomePage = customerHomePage;

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", function onReady() {
            if (window.authService) {
                initializeCustomerHomePage({
                    authService: window.authService,
                    authUtils: window.authUtils
                });
            }
        });
    } else if (window.authService) {
        initializeCustomerHomePage({
            authService: window.authService,
            authUtils: window.authUtils
        });
    }
}