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

function normalizeAdminApplicationStatus(status) {
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
        customer: "./index.html",
        vendor: "../vendor/index.html",
        admin: "../admin/index.html",
        rolechoice: "../authentication/role-choice.html",
        profile: "../authentication/profile.html",
        vendorapplication: "./vendor-application.html",
        adminapplication: "./admin-application.html",
        browsevendors: "./order-management/browse-vendors.html",
        cart: "./order-management/cart.html",
        checkout: "./order-management/checkout.html",
        orders: "./order-tracking/index.html",
        notifications: "./order-tracking/notifications.html",
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

        if (key === "vendorapplication") {
            return authUtils.PORTAL_ROUTES.vendorApplication || routes.vendorapplication;
        }

        if (key === "adminapplication") {
            return authUtils.PORTAL_ROUTES.adminApplication || routes.adminapplication;
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
    const isAdmin =
        safeProfile.isAdmin === true ||
        safeProfile.admin === true;
    const vendorStatus = normalizeVendorStatus(safeProfile.vendorStatus);
    const adminApplicationStatus = isAdmin
        ? "approved"
        : normalizeAdminApplicationStatus(safeProfile.adminApplicationStatus);

    return {
        uid: normalizeText(safeProfile.uid),
        displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
        email: normalizeLowerText(safeProfile.email),
        phoneNumber: normalizeText(safeProfile.phoneNumber),
        photoURL: normalizeText(safeProfile.photoURL),
        isAdmin,
        vendorStatus,
        vendorReason: normalizeText(
            safeProfile.vendorReason ||
            safeProfile.rejectionReason ||
            safeProfile.blockReason
        ),
        adminApplicationStatus,
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

    if (safeProfile.isAdmin === true) {
        return false;
    }

    return (
        safeProfile.vendorStatus === "none" ||
        safeProfile.vendorStatus === "rejected"
    );
}

function canApplyForAdmin(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (
        authUtils &&
        typeof authUtils.canSubmitAdminApplication === "function"
    ) {
        return authUtils.canSubmitAdminApplication(safeProfile);
    }

    if (safeProfile.accountStatus !== "active") {
        return false;
    }

    if (safeProfile.isAdmin === true) {
        return false;
    }

    return (
        safeProfile.adminApplicationStatus === "none" ||
        safeProfile.adminApplicationStatus === "rejected"
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

function getAccessSummary(state) {
    if (!state) {
        return "";
    }

    if (!state.showCustomerPortal) {
        return "Your account cannot access the customer portal right now. Please contact support.";
    }

    if (
        state.showCustomerPortal &&
        state.showVendorPortal &&
        state.showAdminPortal
    ) {
        return "You can switch between the customer, vendor, and admin portals.";
    }

    if (state.showCustomerPortal && state.showVendorPortal) {
        return "You can switch between the customer and vendor portals.";
    }

    if (state.showCustomerPortal && state.showAdminPortal) {
        return "You can switch between the customer and admin portals.";
    }

    return "You currently have customer portal access only.";
}

function getVendorApplicationNote(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "pending") {
        return "Your vendor application is pending review.";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "You already have vendor access.";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return safeProfile.vendorReason
            ? `Your vendor application was rejected: ${safeProfile.vendorReason}`
            : "Your vendor application was rejected. You can update it and apply again.";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return safeProfile.vendorReason
            ? `Your vendor access is blocked: ${safeProfile.vendorReason}`
            : "Your vendor access is blocked right now.";
    }

    if (canApplyForVendor(safeProfile, authUtils)) {
        return "You can apply to become a vendor from this dashboard.";
    }

    return "Vendor application actions are unavailable right now.";
}

function getAdminApplicationNote(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    if (safeProfile.isAdmin === true) {
        return "You already have admin access.";
    }

    if (safeProfile.adminApplicationStatus === "pending") {
        return "Your admin application is pending review.";
    }

    if (safeProfile.adminApplicationStatus === "rejected") {
        return safeProfile.adminApplicationReason
            ? `Your admin application was rejected: ${safeProfile.adminApplicationReason}`
            : "Your admin application was rejected. You can update it and apply again.";
    }

    if (safeProfile.adminApplicationStatus === "blocked") {
        return safeProfile.adminApplicationReason
            ? `Your admin application is blocked: ${safeProfile.adminApplicationReason}`
            : "Your admin application is blocked right now.";
    }

    if (canApplyForAdmin(safeProfile, authUtils)) {
        return "You can apply to become an admin from this dashboard.";
    }

    return "Admin application actions are unavailable right now.";
}

function getApplicationActionConfig(profile, authUtils, type) {
    const safeProfile = normalizeProfile(profile, authUtils);
    const isVendorAction = type === "vendor";

    if (safeProfile.accountStatus !== "active") {
        return {
            visible: false,
            label: "",
            route: getPortalRoute(isVendorAction ? "vendorApplication" : "adminApplication", authUtils)
        };
    }

    if (isVendorAction) {
        if (safeProfile.isAdmin === true || safeProfile.vendorStatus === "approved") {
            return {
                visible: false,
                label: "",
                route: getPortalRoute("vendorApplication", authUtils)
            };
        }

        if (safeProfile.vendorStatus === "pending") {
            return {
                visible: true,
                label: "View Vendor Application",
                route: getPortalRoute("vendorApplication", authUtils)
            };
        }

        if (safeProfile.vendorStatus === "rejected") {
            return {
                visible: true,
                label: "Update Vendor Application",
                route: getPortalRoute("vendorApplication", authUtils)
            };
        }

        if (safeProfile.vendorStatus === "blocked") {
            return {
                visible: true,
                label: "View Vendor Application",
                route: getPortalRoute("vendorApplication", authUtils)
            };
        }

        return {
            visible: true,
            label: "Apply to Become a Vendor",
            route: getPortalRoute("vendorApplication", authUtils)
        };
    }

    if (safeProfile.isAdmin === true) {
        return {
            visible: false,
            label: "",
            route: getPortalRoute("adminApplication", authUtils)
        };
    }

    if (safeProfile.adminApplicationStatus === "pending") {
        return {
            visible: true,
            label: "View Admin Application",
            route: getPortalRoute("adminApplication", authUtils)
        };
    }

    if (safeProfile.adminApplicationStatus === "rejected") {
        return {
            visible: true,
            label: "Update Admin Application",
            route: getPortalRoute("adminApplication", authUtils)
        };
    }

    if (safeProfile.adminApplicationStatus === "blocked") {
        return {
            visible: true,
            label: "View Admin Application",
            route: getPortalRoute("adminApplication", authUtils)
        };
    }

    return {
        visible: true,
        label: "Apply to Become an Admin",
        route: getPortalRoute("adminApplication", authUtils)
    };
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
    const vendorApplicationAction = getApplicationActionConfig(safeProfile, authUtils, "vendor");
    const adminApplicationAction = getApplicationActionConfig(safeProfile, authUtils, "admin");
    const displayName = normalizeText(safeProfile.displayName) || "Customer User";

    return {
        profile: safeProfile,
        displayName,
        roleLabel: getRoleLabel(safeProfile, authUtils),
        vendorStatusLabel: getVendorStatusLabel(safeProfile, authUtils),
        adminStatusLabel: getAdminStatusLabel(safeProfile, authUtils),
        welcomeMessage: getWelcomeMessage(safeProfile, authUtils),
        vendorApplicationNote: getVendorApplicationNote(safeProfile, authUtils),
        adminApplicationNote: getAdminApplicationNote(safeProfile, authUtils),
        accessSummary: getAccessSummary({
            showCustomerPortal,
            showVendorPortal,
            showAdminPortal
        }),
        showCustomerPortal,
        showVendorPortal,
        showAdminPortal,
        showChoosePortal: [showCustomerPortal, showVendorPortal, showAdminPortal].filter(Boolean).length > 1,
        vendorApplicationAction,
        adminApplicationAction,
        browseVendorsRoute: getPortalRoute("browseVendors", authUtils),
        cartRoute: getPortalRoute("cart", authUtils),
        checkoutRoute: getPortalRoute("checkout", authUtils),
        myOrdersRoute: getPortalRoute("orders", authUtils),
        trackOrdersRoute: getPortalRoute("orders", authUtils),
        notificationsRoute: getPortalRoute("notifications", authUtils),
        signOutRoute: getPortalRoute("signOut", authUtils)
    };
}

function getDefaultAvatar(name) {
    const trimmedName = normalizeText(name) || "U";
    const firstLetter = trimmedName.charAt(0).toUpperCase();

    const svg =
        `<svg xmlns="http://www.w3.org/2000/svg" width="240" height="240" viewBox="0 0 240 240">` +
        `<rect width="240" height="240" rx="120" fill="#f3e4d4"></rect>` +
        `<text x="120" y="138" text-anchor="middle" font-size="92" font-family="Arial" fill="#8a5b3e">${firstLetter}</text>` +
        `</svg>`;

    return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
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

    setStatusMessage(elements.statusElement, "Customer dashboard loaded.", "success");

    setText(elements.nameLine, state.displayName);
    setText(elements.roleLine, state.roleLabel);
    setText(
        elements.emailLine,
        normalizeText(state.profile.email) || "No email available"
    );
    setText(elements.vendorLine, state.vendorStatusLabel);
    setText(elements.adminLine, state.adminStatusLabel);
    setText(elements.accessSummaryElement, state.accessSummary);
    setText(elements.welcomeMessageElement, state.welcomeMessage);
    setText(elements.vendorApplicationNoteElement, state.vendorApplicationNote);
    setText(elements.adminApplicationNoteElement, state.adminApplicationNote);

    if (elements.photoCaptionElement) {
        setText(
            elements.photoCaptionElement,
            normalizeText(state.profile.photoURL)
                ? "Your current profile picture is shown here."
                : "No profile picture found yet, so we are showing your default avatar."
        );
    }

    setImage(
        elements.profilePhoto,
        state.profile.photoURL,
        `${state.displayName} profile picture`,
        state.displayName
    );

    if (elements.vendorApplicationButton) {
        elements.vendorApplicationButton.textContent = state.vendorApplicationAction.label;
    }

    if (elements.adminApplicationButton) {
        elements.adminApplicationButton.textContent = state.adminApplicationAction.label;
    }

    setHidden(elements.customerPortalButton, !state.showCustomerPortal);
    setHidden(elements.vendorPortalButton, !state.showVendorPortal);
    setHidden(elements.adminPortalButton, !state.showAdminPortal);
    setHidden(elements.choosePortalButton, !state.showChoosePortal);
    setHidden(elements.vendorApplicationButton, !state.vendorApplicationAction.visible);
    setHidden(elements.adminApplicationButton, !state.adminApplicationAction.visible);
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
        browseVendorsButton: document.querySelector("#browse-vendors-button"),
        cartButton: document.querySelector("#view-cart-button"),
        checkoutButton: document.querySelector("#go-checkout-button"),
        myOrdersButton: document.querySelector("#view-orders-button"),
        trackOrdersButton: document.querySelector("#track-orders-button"),
        notificationsButton: document.querySelector("#view-notifications-button"),
        signOutButton: document.querySelector("#sign-out-button"),
        customerPortalButton: document.querySelector("#go-customer-portal-button"),
        vendorPortalButton: document.querySelector("#go-vendor-portal-button"),
        adminPortalButton: document.querySelector("#go-admin-portal-button")
    };

    setStatusMessage(elements.statusElement, "Loading your customer dashboard...", "loading");

    try {
        const result = await loadCustomerHomeState({
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(
                elements.statusElement,
                result.message || "Unable to load your dashboard right now.",
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

        const vendorApplicationController = result.state.vendorApplicationAction.visible
            ? attachNavigationHandler({
                button: elements.vendorApplicationButton,
                route: result.state.vendorApplicationAction.route,
                navigate
            })
            : null;

        const adminApplicationController = result.state.adminApplicationAction.visible
            ? attachNavigationHandler({
                button: elements.adminApplicationButton,
                route: result.state.adminApplicationAction.route,
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

        const browseVendorsController = attachNavigationHandler({
            button: elements.browseVendorsButton,
            route: result.state.browseVendorsRoute,
            navigate
        });

        const cartController = attachNavigationHandler({
            button: elements.cartButton,
            route: result.state.cartRoute,
            navigate
        });

        const checkoutController = attachNavigationHandler({
            button: elements.checkoutButton,
            route: result.state.checkoutRoute,
            navigate
        });

        const myOrdersController = attachNavigationHandler({
            button: elements.myOrdersButton,
            route: result.state.myOrdersRoute,
            navigate
        });

        const trackOrdersController = attachNavigationHandler({
            button: elements.trackOrdersButton,
            route: result.state.trackOrdersRoute,
            navigate
        });

        const notificationsController = attachNavigationHandler({
            button: elements.notificationsButton,
            route: result.state.notificationsRoute,
            navigate
        });

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
            choosePortalController,
            vendorApplicationController,
            adminApplicationController,
            customerPortalController,
            vendorPortalController,
            adminPortalController,
            browseVendorsController,
            cartController,
            checkoutController,
            myOrdersController,
            trackOrdersController,
            notificationsController,
            signOutController
        };
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load your dashboard right now.";

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
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = customerHomePage;
}

if (typeof window !== "undefined") {
    window.customerHomePage = customerHomePage;
}
