/**
 * role-choice.js
 *
 * Role selection page logic for the Campus Food Ordering Platform.
 * This file:
 * - lets a signed-in user choose customer or vendor
 * - updates the user's profile role in Firestore
 * - uses injected services so it stays easy to test
 * - can be used in the browser through initializeRoleChoicePage(...)
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeRole(role) {
    return normalizeText(role).toLowerCase();
}

function isValidRole(role) {
    const normalizedRole = normalizeRole(role);
    return normalizedRole === "customer" || normalizedRole === "vendor";
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

function getNextRouteForRole(role) {
    const normalizedRole = normalizeRole(role);

    if (normalizedRole === "vendor") {
        return "./pending-vendor.html";
    }

    return "../customer/index.html";
}

function buildRoleUpdates(role, existingProfile = {}) {
    const normalizedRole = normalizeRole(role);
    const existingRoles =
        existingProfile && existingProfile.roles ? existingProfile.roles : {};

    return {
        roles: {
            customer: normalizedRole === "customer",
            vendor: normalizedRole === "vendor",
            admin: !!existingRoles.admin
        },
        vendorStatus: normalizedRole === "vendor" ? "pending" : "none"
    };
}

async function submitRoleChoice(role, dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.updateUserProfile !== "function") {
        throw new Error("authService.updateUserProfile is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    if (!isValidRole(role)) {
        return {
            success: false,
            message: "Please choose a valid role."
        };
    }

    const user = authService.getCurrentUser();

    if (!user) {
        return {
            success: false,
            message: "No user is currently signed in."
        };
    }

    const existingProfile = await authService.getCurrentUserProfile(user.uid);
    const updates = buildRoleUpdates(role, existingProfile || {});
    await authService.updateUserProfile(user.uid, updates);

    return {
        success: true,
        role: normalizeRole(role),
        updates,
        nextRoute: getNextRouteForRole(role)
    };
}

function attachRoleChoiceHandler(options) {
    const {
        button,
        role,
        authService,
        statusElement,
        navigate,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        throw new Error("A role choice button is required.");
    }

    if (!isValidRole(role)) {
        throw new Error("A valid role is required.");
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
            const result = await submitRoleChoice(role, {
                authService
            });

            setButtonState(button, false);

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to save your role choice right now.",
                    "error"
                );

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            setStatusMessage(statusElement, "Role selected successfully.", "success");

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
                    : "Unable to save your role choice right now.";

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

function initializeRoleChoicePage(options = {}) {
    const {
        authService = typeof window !== "undefined" ? window.authService : undefined,
        statusSelector = "#role-choice-status",
        customerButtonSelector = "#choose-customer",
        vendorButtonSelector = "#choose-vendor",
        navigate
    } = options;

    const statusElement = document.querySelector(statusSelector);
    const customerButton = document.querySelector(customerButtonSelector);
    const vendorButton = document.querySelector(vendorButtonSelector);

    if (!authService) {
        throw new Error("authService is required.");
    }

    const resolvedNavigate =
        typeof navigate === "function"
            ? navigate
            : (nextRoute) => {
                window.location.href = nextRoute;
            };

    const customerController = customerButton
        ? attachRoleChoiceHandler({
            button: customerButton,
            role: "customer",
            authService,
            statusElement,
            navigate: resolvedNavigate
        })
        : null;

    const vendorController = vendorButton
        ? attachRoleChoiceHandler({
            button: vendorButton,
            role: "vendor",
            authService,
            statusElement,
            navigate: resolvedNavigate
        })
        : null;

    return {
        customerController,
        vendorController
    };
}

const roleChoicePage = {
    normalizeText,
    normalizeRole,
    isValidRole,
    setStatusMessage,
    setButtonState,
    getNextRouteForRole,
    buildRoleUpdates,
    submitRoleChoice,
    attachRoleChoiceHandler,
    initializeRoleChoicePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = roleChoicePage;
}

if (typeof window !== "undefined") {
    window.roleChoicePage = roleChoicePage;
}
