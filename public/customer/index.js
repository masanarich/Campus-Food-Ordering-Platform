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
        login: "../authentication/login.html",
        stores: "../Approved-vendors/index.html"
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

        if (key === "login") {
            return authUtils.PORTAL_ROUTES.login || routes.login;
        }

        if (key === "vendorapplication") {
            return authUtils.PORTAL_ROUTES.vendorApplication || routes.vendorapplication;
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

    if (key === "rolechoice") {
        return routes.rolechoice;
    }

    if (key === "profile") {
        return routes.profile;
    }

    if (key === "vendorapplication") {
        return routes.vendorapplication;
    }
    if (key === "stores"){
        return routes.stores;
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
        email: normalizeLowerText(safeProfile.email),
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

function getRoleLabel(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

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

function canAccessCustomerPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    return (
        safeProfile.accountStatus === "active" &&
        (
            hasAuthenticatedIdentity(safeProfile) ||
            safeProfile.isAdmin === true ||
            safeProfile.isOwner === true
        )
    );
}

function canAccessVendorPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

    return (
        safeProfile.accountStatus === "active" &&
        (
            safeProfile.isOwner === true ||
            safeProfile.isAdmin === true ||
            safeProfile.vendorStatus === "approved"
        )
    );
}

function canAccessAdminPortal(profile, authUtils) {
    const safeProfile = normalizeProfile(profile, authUtils);

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
    const displayName = normalizeText(safeProfile.displayName) || "Customer User";

    return {
        profile: safeProfile,
        displayName,
        roleLabel: getRoleLabel(safeProfile, authUtils),
        vendorStatusLabel: getVendorStatusLabel(safeProfile, authUtils),
        welcomeMessage: getWelcomeMessage(safeProfile, authUtils),
        vendorApplicationNote: getVendorApplicationNote(safeProfile, authUtils),
        portalSummary: getPortalSummary({
            profile: safeProfile,
            showCustomerPortal,
            showVendorPortal,
            showAdminPortal
        }),
        showCustomerPortal,
        showVendorPortal,
        showAdminPortal,
        showChoosePortal: [showCustomerPortal, showVendorPortal, showAdminPortal].filter(Boolean).length > 1,
        showVendorApplication: canApplyForVendor(safeProfile, authUtils)
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

    if (elements.photoCaptionElement) {
        setText(
            elements.photoCaptionElement,
            normalizeText(state.profile.photoURL)
                ? "Your current profile picture is shown here."
                : "No profile picture found. A default avatar is being used."
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
        photoCaptionElement: document.querySelector("#profile-photo-caption"),
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
        browseVendorsButton: document.querySelector("#browse-vendors"),
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
        const browseVendorsController = attachNavigationHandler({
            button: elements.browseVendorsButton,
            route: getPortalRoute("stores", authUtils),
            navigate
        });
        

        return {
            redirected: false,
            state: result.state,
            profileController,
            choosePortalController,
            vendorApplicationController,
            customerPortalController,
            vendorPortalController,
            adminPortalController,
            browseVendorsController
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
}