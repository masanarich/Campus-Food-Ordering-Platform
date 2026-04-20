/**
 * admin/index.js
 *
 * Admin dashboard logic for authenticated admin users.
 * This file:
 * - loads the signed-in user's profile
 * - renders account and access summaries
 * - separates admin tools from portal switching
 * - supports sign out
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeLowerText(value) {
    return normalizeText(value).toLowerCase();
}

function normalizeVendorStatus(status) {
    const value = normalizeLowerText(status);

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
    const value = normalizeLowerText(status);

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
    const value = normalizeLowerText(status);

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
        customer: "../customer/index.html",
        vendor: "../vendor/index.html",
        admin: "./index.html",
        rolechoice: "../authentication/role-choice.html",
        profile: "../authentication/profile.html",
        users: "./users.html",
        disputes: "./disputes.html",
        login: "../authentication/login.html"
    };
}

function getPortalRoute(routeName, authUtils) {
    const routes = getFallbackRoutes();
    const key = normalizeLowerText(routeName);

    if (
        authUtils &&
        typeof authUtils.getPortalRoute === "function" &&
        (key === "customer" || key === "vendor" || key === "admin")
    ) {
        return authUtils.getPortalRoute(key);
    }

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

        if (key === "rolechoice") {
            return authUtils.PORTAL_ROUTES.roleChoice || routes.rolechoice;
        }

        if (key === "login" || key === "signout") {
            return authUtils.PORTAL_ROUTES.login || routes.login;
        }
    }

    if (Object.prototype.hasOwnProperty.call(routes, key)) {
        return routes[key];
    }

    if (key === "signout") {
        return routes.login;
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
    const isAdmin = safeProfile.isAdmin === true || safeProfile.admin === true;

    return {
        uid: normalizeText(safeProfile.uid),
        displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
        email: normalizeLowerText(safeProfile.email),
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

function getRoleLabel(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.isAdmin === true && safeProfile.vendorStatus === "approved") {
        return "Admin and Vendor";
    }

    if (safeProfile.isAdmin === true) {
        return "Admin";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Vendor";
    }

    return "Customer";
}

function canAccessCustomerPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (
        authUtils &&
        typeof authUtils.canAccessCustomerPortal === "function"
    ) {
        return authUtils.canAccessCustomerPortal(safeProfile);
    }

    return (
        safeProfile.accountStatus === "active" &&
        hasAuthenticatedIdentity(safeProfile)
    );
}

function canAccessVendorPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (
        authUtils &&
        typeof authUtils.canAccessVendorPortal === "function"
    ) {
        return authUtils.canAccessVendorPortal(safeProfile);
    }

    return (
        safeProfile.accountStatus === "active" &&
        safeProfile.vendorStatus === "approved"
    );
}

function canAccessAdminPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (
        authUtils &&
        typeof authUtils.canAccessAdminPortal === "function"
    ) {
        return authUtils.canAccessAdminPortal(safeProfile);
    }

    return (
        safeProfile.accountStatus === "active" &&
        safeProfile.isAdmin === true
    );
}

function getVendorStatusLabel(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

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

function getAdminStatusLabel(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.isAdmin === true) {
        return "Approved";
    }

    if (safeProfile.adminApplicationStatus === "pending") {
        return "Pending";
    }

    if (safeProfile.adminApplicationStatus === "rejected") {
        return "Rejected";
    }

    if (safeProfile.adminApplicationStatus === "blocked") {
        return "Blocked";
    }

    return "Not Applied";
}

function getPortalSummary(state) {
    if (!state) {
        return "";
    }

    if (
        state.showCustomerPortal &&
        state.showVendorPortal &&
        state.showAdminPortal
    ) {
        return "You can switch between the customer, vendor, and admin portals.";
    }

    if (state.showCustomerPortal && state.showAdminPortal) {
        return "You can switch between the customer and admin portals.";
    }

    if (state.showVendorPortal && state.showAdminPortal) {
        return "You can switch between the vendor and admin portals.";
    }

    if (state.showAdminPortal) {
        return "You currently have admin portal access only.";
    }

    return "You do not currently have portal access.";
}

function getManagementSummary(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "approved") {
        return "Manage users, review applications, and keep an eye on platform issues while still having vendor access.";
    }

    return "Manage users, review applications, and prepare to handle customer support disputes from this portal.";
}

function getAdminAccessNote(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.isAdmin === true) {
        return "Your admin access is approved and active.";
    }

    return "Admin access is not available right now.";
}

function getWelcomeMessage(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);
    const name = normalizeText(safeProfile.displayName) || "there";

    return `Welcome back, ${name}.`;
}

function getHomeState(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);
    const showCustomerPortal = canAccessCustomerPortal(safeProfile, authUtils);
    const showVendorPortal = canAccessVendorPortal(safeProfile, authUtils);
    const showAdminPortal = canAccessAdminPortal(safeProfile, authUtils);
    const displayName = normalizeText(safeProfile.displayName) || "Admin User";

    return {
        profile: safeProfile,
        displayName,
        roleLabel: getRoleLabel(safeProfile, authUtils),
        vendorStatusLabel: getVendorStatusLabel(safeProfile, authUtils),
        adminStatusLabel: getAdminStatusLabel(safeProfile, authUtils),
        welcomeMessage: getWelcomeMessage(safeProfile, authUtils),
        managementSummary: getManagementSummary(safeProfile, authUtils),
        adminAccessNote: getAdminAccessNote(safeProfile, authUtils),
        portalSummary: getPortalSummary({
            showCustomerPortal,
            showVendorPortal,
            showAdminPortal
        }),
        showCustomerPortal,
        showVendorPortal,
        showAdminPortal,
        showChoosePortal: [showCustomerPortal, showVendorPortal, showAdminPortal].filter(Boolean).length > 1,
        manageUsersRoute: getPortalRoute("users", authUtils),
        disputesRoute: getPortalRoute("disputes", authUtils),
        signOutRoute: getPortalRoute("signOut", authUtils)
    };
}

function getDefaultAvatar(name) {
    const trimmedName = normalizeText(name) || "U";
    const firstLetter = trimmedName.charAt(0).toUpperCase();

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
        `<rect width="240" height="240" rx="120" fill="#f0dfd1"></rect>` +
        `<text x="120" y="138" text-anchor="middle" font-size="92" font-family="Arial" fill="#8a5b3e">${firstLetter}</text>` +
        `</svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
}

function getSafeRedirectRoute(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (authUtils && typeof authUtils.getDefaultPortalRoute === "function") {
        return authUtils.getDefaultPortalRoute(safeProfile);
    }

    if (canAccessVendorPortal(safeProfile, authUtils)) {
        return getPortalRoute("vendor", authUtils);
    }

    if (canAccessCustomerPortal(safeProfile, authUtils)) {
        return getPortalRoute("customer", authUtils);
    }

    return getPortalRoute("login", authUtils);
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

function renderAdminHomePage(elements, state) {
    if (!elements || !state) {
        return;
    }

    setStatusMessage(elements.statusElement, "Admin dashboard loaded.", "success");

    setText(elements.nameLine, state.displayName);
    setText(elements.roleLine, state.roleLabel);
    setText(
        elements.emailLine,
        normalizeText(state.profile.email) || "No email available"
    );
    setText(elements.vendorLine, state.vendorStatusLabel);
    setText(elements.adminLine, state.adminStatusLabel);
    setText(elements.portalSummaryElement, state.portalSummary);
    setText(elements.welcomeMessageElement, state.welcomeMessage);
    setText(elements.managementSummaryElement, state.managementSummary);
    setText(elements.adminAccessNoteElement, state.adminAccessNote);

    if (elements.photoCaptionElement) {
        setText(
            elements.photoCaptionElement,
            normalizeText(state.profile.photoURL)
                ? "Your current profile picture is shown here."
                : "No profile picture was found, so a default avatar is being shown."
        );
    }

    setImage(
        elements.profilePhoto,
        state.profile.photoURL,
        `${state.displayName} profile picture`,
        state.displayName
    );

    setHidden(elements.customerPortalButton, !state.showCustomerPortal);
    setHidden(elements.vendorPortalButton, !state.showVendorPortal);
    setHidden(elements.choosePortalButton, !state.showChoosePortal);
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

function attachSignOutHandler(options = {}) {
    const button = options.button;
    const authService = options.authService;
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };
    const nextRoute = options.nextRoute;
    const statusElement = options.statusElement || null;

    if (!button || !authService || typeof authService.signOutUser !== "function" || !nextRoute) {
        return null;
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setStatusMessage(statusElement, "Signing you out...", "loading");

        try {
            await authService.signOutUser();
            navigate(nextRoute);
            return {
                success: true,
                nextRoute
            };
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to sign out right now.";

            setStatusMessage(statusElement, message, "error");

            return {
                success: false,
                error,
                message
            };
        }
    }

    button.addEventListener("click", handleClick);

    return {
        handleClick
    };
}

async function loadAdminHomeState(dependencies = {}) {
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

    if (!state.showAdminPortal) {
        return {
            success: false,
            message: "You do not have access to the admin portal.",
            nextRoute: getSafeRedirectRoute(state.profile, authUtils)
        };
    }

    return {
        success: true,
        user,
        profile: state.profile,
        state
    };
}

async function initializeAdminHomePage(options = {}) {
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
        profileButton: document.querySelector("#go-profile-button"),
        manageUsersButton: document.querySelector("#manage-users-button"),
        reviewDisputesButton: document.querySelector("#review-disputes-button"),
        choosePortalButton: document.querySelector("#choose-portal-button"),
        signOutButton: document.querySelector("#sign-out-button"),
        customerPortalButton: document.querySelector("#go-customer-portal-button"),
        vendorPortalButton: document.querySelector("#go-vendor-portal-button")
    };

    setStatusMessage(elements.statusElement, "Loading your admin dashboard...", "loading");

    try {
        const result = await loadAdminHomeState({
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(
                elements.statusElement,
                result.message || "Unable to load your admin dashboard right now.",
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

        renderAdminHomePage(elements, result.state);

        const profileController = attachNavigationHandler({
            button: elements.profileButton,
            route: getPortalRoute("profile", authUtils),
            navigate
        });

        const manageUsersController = attachNavigationHandler({
            button: elements.manageUsersButton,
            route: result.state.manageUsersRoute,
            navigate
        });

        const reviewDisputesController = attachNavigationHandler({
            button: elements.reviewDisputesButton,
            route: result.state.disputesRoute,
            navigate
        });

        const choosePortalController = result.state.showChoosePortal
            ? attachNavigationHandler({
                button: elements.choosePortalButton,
                route: getPortalRoute("roleChoice", authUtils),
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

        const signOutController = attachSignOutHandler({
            button: elements.signOutButton,
            authService,
            navigate,
            nextRoute: result.state.signOutRoute,
            statusElement: elements.statusElement
        });

        return {
            redirected: false,
            state: result.state,
            profileController,
            manageUsersController,
            reviewDisputesController,
            choosePortalController,
            customerPortalController,
            vendorPortalController,
            signOutController
        };
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load your admin dashboard right now.";

        setStatusMessage(elements.statusElement, message, "error");

        return {
            redirected: false,
            error,
            message
        };
    }
}

const adminHomePage = {
    normalizeText,
    normalizeVendorStatus,
    normalizeAdminApplicationStatus,
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
    getAdminStatusLabel,
    getPortalSummary,
    getManagementSummary,
    getAdminAccessNote,
    getWelcomeMessage,
    getHomeState,
    getDefaultAvatar,
    getSafeRedirectRoute,
    setText,
    setHidden,
    setStatusMessage,
    setImage,
    renderAdminHomePage,
    attachNavigationHandler,
    attachSignOutHandler,
    loadAdminHomeState,
    initializeAdminHomePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = adminHomePage;
}

if (typeof window !== "undefined") {
    window.adminHomePage = adminHomePage;
}
