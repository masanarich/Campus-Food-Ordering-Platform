/**
 * pending-vendor.js
 *
 * Pending vendor page logic for the Campus Food Ordering Platform.
 * This file:
 * - loads the signed-in user's profile
 * - displays vendor application status
 * - supports sign out
 * - can be used in the browser through initializePendingVendorPage(...)
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function setTextContent(element, value) {
    if (!element) {
        return;
    }

    element.textContent = normalizeText(value);
}

function setStatusMessage(statusElement, message, state) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message || "";
    statusElement.dataset.state = state || "";
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

    return "None";
}

function getVendorStatusMessage(profile) {
    const status = getVendorStatusLabel(profile);

    if (status === "Pending") {
        return "Your vendor application is awaiting review.";
    }

    if (status === "Approved") {
        return "Your vendor application has been approved.";
    }

    if (status === "Rejected") {
        return "Your vendor application was not approved.";
    }

    return "No vendor application was found.";
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

function getBusinessName(profile) {
    if (profile && normalizeText(profile.businessName)) {
        return profile.businessName;
    }

    return "";
}

function renderPendingVendorInfo(pageElements, profile, user) {
    const elements = pageElements || {};

    setTextContent(elements.nameElement, getDisplayName(profile, user));
    setTextContent(elements.businessNameElement, getBusinessName(profile));
    setTextContent(elements.vendorStatusElement, getVendorStatusLabel(profile));
    setTextContent(elements.vendorMessageElement, getVendorStatusMessage(profile));
}

async function loadPendingVendorProfile(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    const user = await authService.getCurrentUser();

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

async function initializePendingVendorView(options) {
    const {
        authService,
        statusElement,
        pageElements
    } = options || {};

    setStatusMessage(statusElement, "", "");

    try {
        const result = await loadPendingVendorProfile({
            authService
        });

        if (!result.success) {
            setStatusMessage(statusElement, result.message, "error");
            return result;
        }

        renderPendingVendorInfo(pageElements, result.profile, result.user);
        setStatusMessage(statusElement, "Vendor application status loaded.", "success");

        return result;
    } catch (error) {
        const message =
            error && error.message
                ? error.message
                : "Unable to load vendor application status right now.";

        setStatusMessage(statusElement, message, "error");

        return {
            success: false,
            message
        };
    }
}

function attachPendingVendorSignOutHandler(options) {
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
                    : "Unable to sign out right now.";

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

function initializePendingVendorPage(options = {}) {
    const {
        authService,
        statusSelector = "#pending-vendor-status",
        nameSelector = "#pending-vendor-name",
        businessNameSelector = "#pending-vendor-business-name",
        vendorStatusSelector = "#pending-vendor-role-status",
        vendorMessageSelector = "#pending-vendor-message",
        signOutButtonSelector = "#pending-vendor-signout-button",
        navigate
    } = options;

    const statusElement = document.querySelector(statusSelector);
    const pageElements = {
        nameElement: document.querySelector(nameSelector),
        businessNameElement: document.querySelector(businessNameSelector),
        vendorStatusElement: document.querySelector(vendorStatusSelector),
        vendorMessageElement: document.querySelector(vendorMessageSelector)
    };
    const signOutButton = document.querySelector(signOutButtonSelector);

    const resolvedNavigate =
        typeof navigate === "function"
            ? navigate
            : (nextRoute) => {
                window.location.href = nextRoute;
            };

    const signOutController = signOutButton
        ? attachPendingVendorSignOutHandler({
            button: signOutButton,
            authService,
            statusElement,
            navigate: resolvedNavigate
        })
        : null;

    const pagePromise = initializePendingVendorView({
        authService,
        statusElement,
        pageElements
    });

    return {
        signOutController,
        pagePromise
    };
}

const pendingVendorPage = {
    normalizeText,
    setTextContent,
    setStatusMessage,
    getVendorStatusLabel,
    getVendorStatusMessage,
    getDisplayName,
    getBusinessName,
    renderPendingVendorInfo,
    loadPendingVendorProfile,
    signOutCurrentUser,
    initializePendingVendorView,
    attachPendingVendorSignOutHandler,
    initializePendingVendorPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = pendingVendorPage;
}

if (typeof window !== "undefined") {
    window.pendingVendorPage = pendingVendorPage;
}