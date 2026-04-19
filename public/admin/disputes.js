/**
 * admin/disputes.js
 *
 * Placeholder disputes workspace for the admin portal.
 * The full support and dispute handling flow will be implemented later.
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
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

function getRoute(routeName, authUtils) {
    const key = normalizeText(routeName).toLowerCase();
    const fallbackRoutes = {
        dashboard: "./index.html",
        users: "./users.html",
        profile: "../authentication/profile.html"
    };

    if (
        authUtils &&
        typeof authUtils.getPortalRoute === "function" &&
        key === "admin"
    ) {
        return authUtils.getPortalRoute("admin");
    }

    if (key === "admin" || key === "dashboard") {
        return fallbackRoutes.dashboard;
    }

    if (key === "users") {
        return fallbackRoutes.users;
    }

    if (key === "profile") {
        return fallbackRoutes.profile;
    }

    return fallbackRoutes.dashboard;
}

function setStatusMessage(element, message, state) {
    if (!element) {
        return;
    }

    element.textContent = message || "";
    element.dataset.state = state || "";
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

function initializeAdminDisputesPage(options = {}) {
    const authUtils = resolveAuthUtils(options.authUtils);
    const navigate =
        typeof options.navigate === "function"
            ? options.navigate
            : function fallbackNavigate(nextRoute) {
                window.location.href = nextRoute;
            };

    const elements = {
        statusElement: document.querySelector("#admin-disputes-status"),
        backButton: document.querySelector("#back-to-admin-dashboard-button"),
        manageUsersButton: document.querySelector("#go-manage-users-button")
    };

    setStatusMessage(
        elements.statusElement,
        "Disputes workspace placeholder loaded. Full dispute handling will be added later.",
        "info"
    );

    const backController = attachNavigationHandler({
        button: elements.backButton,
        route: getRoute("dashboard", authUtils),
        navigate
    });

    const manageUsersController = attachNavigationHandler({
        button: elements.manageUsersButton,
        route: getRoute("users", authUtils),
        navigate
    });

    return {
        backController,
        manageUsersController
    };
}

const adminDisputesPage = {
    normalizeText,
    resolveAuthUtils,
    getRoute,
    setStatusMessage,
    attachNavigationHandler,
    initializeAdminDisputesPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = adminDisputesPage;
}

if (typeof window !== "undefined") {
    window.adminDisputesPage = adminDisputesPage;
}
