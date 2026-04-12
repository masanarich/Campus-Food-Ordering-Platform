/**
 * profile.js
 *
 * Profile page logic for the Campus Food Ordering Platform.
 * This file:
 * - loads the signed-in user's profile
 * - renders profile details into the page
 * - supports sign out
 * - uses injected services so it stays easy to test
 * - can be used in the browser through initializeProfilePage(...)
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function setTextContent(element, value, fallback = "-") {
    if (!element) {
        return;
    }

    const normalized = normalizeText(value);
    element.textContent = normalized || fallback;
}

function setStatusMessage(statusElement, message, state) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message || "";
    statusElement.dataset.state = state || "";
}

function getRoleLabel(profile) {
    if (!profile || !profile.roles) {
        return "Customer";
    }

    if (profile.roles.admin) {
        return "Admin";
    }

    if (profile.roles.vendor) {
        return "Vendor";
    }

    return "Customer";
}

function getVendorStatusLabel(profile) {
    if (!profile || !profile.vendorStatus) {
        return "None";
    }

    const status = String(profile.vendorStatus).toLowerCase();

    if (status === "pending") {
        return "Pending";
    }

    if (status === "approved") {
        return "Approved";
    }

    if (status === "rejected") {
        return "Rejected";
    }

    if (status === "suspended") {
        return "Suspended";
    }

    return "None";
}

function getDisplayName(profile, user) {
    if (profile && normalizeText(profile.displayName)) {
        return profile.displayName;
    }

    if (user && normalizeText(user.displayName)) {
        return user.displayName;
    }

    return "";
}

function getEmail(profile, user) {
    if (profile && normalizeText(profile.email)) {
        return profile.email;
    }

    if (user && normalizeText(user.email)) {
        return user.email;
    }

    return "";
}

function renderProfile(profileElements, profile, user) {
    const elements = profileElements || {};

    setTextContent(elements.nameElement, getDisplayName(profile, user));
    setTextContent(elements.emailElement, getEmail(profile, user));
    setTextContent(elements.roleElement, getRoleLabel(profile));
    setTextContent(elements.vendorStatusElement, getVendorStatusLabel(profile));
}

function waitForAuthenticatedUser(authService) {
    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    const currentUser = authService.getCurrentUser();
    if (currentUser) {
        return Promise.resolve(currentUser);
    }

    if (typeof authService.observeAuthState !== "function") {
        return Promise.resolve(null);
    }

    return new Promise((resolve) => {
        const unsubscribe = authService.observeAuthState((user) => {
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }

            resolve(user || null);
        });
    });
}

async function loadCurrentUserProfile(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    const user = await waitForAuthenticatedUser(authService);

    if (!user) {
        return {
            success: false,
            message: "No user is currently signed in."
        };
    }

    const profile = await authService.getCurrentUserProfile(user.uid);

    return {
        success: true,
        user,
        profile
    };
}

async function signOutCurrentUser(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.signOutUser !== "function") {
        throw new Error("authService.signOutUser is required.");
    }

    await authService.signOutUser();

    return {
        success: true
    };
}

async function initializeProfileView(options) {
    const {
        authService,
        statusElement,
        profileElements
    } = options || {};

    setStatusMessage(statusElement, "Loading profile...", "loading");

    try {
        const result = await loadCurrentUserProfile({
            authService
        });

        if (!result.success) {
            setStatusMessage(statusElement, result.message, "error");
            return result;
        }

        renderProfile(profileElements, result.profile, result.user);
        setStatusMessage(statusElement, "Profile loaded.", "success");

        return result;
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load profile right now. Please try again.";

        setStatusMessage(statusElement, message, "error");

        return {
            success: false,
            message
        };
    }
}

function attachSignOutHandler(options) {
    const {
        button,
        authService,
        statusElement,
        navigate,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        throw new Error("A sign out button is required.");
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        button.disabled = true;
        setStatusMessage(statusElement, "", "");

        try {
            const result = await signOutCurrentUser({
                authService
            });

            setStatusMessage(statusElement, "Signed out successfully.", "success");
            button.disabled = false;

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            if (typeof navigate === "function") {
                navigate("../index.html");
            }

            return result;
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to sign out right now. Please try again.";

            setStatusMessage(statusElement, message, "error");
            button.disabled = false;

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

function initializeProfilePage(options = {}) {
    const {
        authService = typeof window !== "undefined" ? window.authService : undefined,
        statusSelector = "#profile-status",
        nameSelector = "#profile-name",
        emailSelector = "#profile-email",
        roleSelector = "#profile-role",
        vendorStatusSelector = "#profile-vendor-status",
        signOutButtonSelector = "#signout-button",
        navigate
    } = options;

    const statusElement = document.querySelector(statusSelector);
    const profileElements = {
        nameElement: document.querySelector(nameSelector),
        emailElement: document.querySelector(emailSelector),
        roleElement: document.querySelector(roleSelector),
        vendorStatusElement: document.querySelector(vendorStatusSelector)
    };
    const signOutButton = document.querySelector(signOutButtonSelector);

    if (!authService) {
        throw new Error("authService is required.");
    }

    const resolvedNavigate =
        typeof navigate === "function"
            ? navigate
            : (nextRoute) => {
                window.location.href = nextRoute;
            };

    const signOutController = signOutButton
        ? attachSignOutHandler({
            button: signOutButton,
            authService,
            statusElement,
            navigate: resolvedNavigate
        })
        : null;

    const profilePromise = initializeProfileView({
        authService,
        statusElement,
        profileElements
    });

    return {
        signOutController,
        profilePromise
    };
}

const profilePage = {
    normalizeText,
    setTextContent,
    setStatusMessage,
    getRoleLabel,
    getVendorStatusLabel,
    getDisplayName,
    getEmail,
    renderProfile,
    waitForAuthenticatedUser,
    loadCurrentUserProfile,
    signOutCurrentUser,
    initializeProfileView,
    attachSignOutHandler,
    initializeProfilePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = profilePage;
}

if (typeof window !== "undefined") {
    window.profilePage = profilePage;
}