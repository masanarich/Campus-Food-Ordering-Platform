/**
 * register.js
 *
 * Registration page logic for the Campus Food Ordering Platform.
 * This file:
 * - validates registration form data
 * - supports customer and vendor registration entry points
 * - uses injected services so it stays easy to test
 * - can be used in the browser through initializeRegisterPage(...)
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email) {
    return normalizeText(email).toLowerCase();
}

function extractRegisterFormValues(form) {
    return {
        fullName: form.fullName ? form.fullName.value : "",
        email: form.email ? form.email.value : "",
        password: form.password ? form.password.value : "",
        confirmPassword: form.confirmPassword ? form.confirmPassword.value : "",
        accountType: form.accountType ? form.accountType.value : "customer"
    };
}

function buildRegisterPayload(rawValues) {
    return {
        fullName: normalizeText(rawValues.fullName),
        email: normalizeEmail(rawValues.email),
        password: typeof rawValues.password === "string" ? rawValues.password : "",
        confirmPassword:
            typeof rawValues.confirmPassword === "string"
                ? rawValues.confirmPassword
                : "",
        accountType: normalizeText(rawValues.accountType).toLowerCase() || "customer"
    };
}

function isValidAccountType(accountType) {
    return accountType === "customer" || accountType === "vendor";
}

function validateRegisterPayload(payload, authUtils) {
    const errors = {};

    if (!authUtils.isNonEmptyString(payload.fullName)) {
        errors.fullName = "Full name is required.";
    }

    if (!authUtils.isValidEmail(payload.email)) {
        errors.email = "Please enter a valid email address.";
    }

    if (!authUtils.isStrongPassword(payload.password)) {
        errors.password = "Password must be at least 8 characters long.";
    }

    if (payload.password !== payload.confirmPassword) {
        errors.confirmPassword = "Passwords do not match.";
    }

    if (!isValidAccountType(payload.accountType)) {
        errors.accountType = "Please choose a valid account type.";
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

function clearFieldErrors(form) {
    const errorElements = form.querySelectorAll("[data-error-for]");
    errorElements.forEach((element) => {
        element.textContent = "";
    });
}

function showFieldErrors(form, errors) {
    Object.keys(errors).forEach((fieldName) => {
        const errorElement = form.querySelector(`[data-error-for="${fieldName}"]`);
        if (errorElement) {
            errorElement.textContent = errors[fieldName];
        }
    });
}

function setStatusMessage(statusElement, message, state) {
    if (!statusElement) {
        return;
    }

    statusElement.textContent = message || "";
    statusElement.dataset.state = state || "";
}

function setSubmittingState(form, isSubmitting) {
    if (!form) {
        return;
    }

    const submitButton = form.querySelector('button[type="submit"], input[type="submit"]');

    if (submitButton) {
        submitButton.disabled = !!isSubmitting;
    }

    form.dataset.submitting = isSubmitting ? "true" : "false";
}

function getSuccessMessage(accountType) {
    if (accountType === "vendor") {
        return "Registration successful. Your vendor application is awaiting approval.";
    }

    return "Registration successful.";
}

async function submitRegistration(payload, dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.registerWithEmail !== "function") {
        throw new Error("authService.registerWithEmail is required.");
    }

    return authService.registerWithEmail({
        email: payload.email,
        password: payload.password,
        displayName: payload.fullName,
        accountType: payload.accountType
    });
}

function attachRegisterHandler(options) {
    const {
        form,
        statusElement,
        authService,
        authUtils,
        onSuccess,
        onError,
        navigate
    } = options || {};

    if (!form) {
        throw new Error("A registration form is required.");
    }

    if (!authUtils) {
        throw new Error("authUtils is required.");
    }

    async function handleSubmit(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        clearFieldErrors(form);
        setStatusMessage(statusElement, "", "");
        setSubmittingState(form, true);

        try {
            const rawValues = extractRegisterFormValues(form);
            const payload = buildRegisterPayload(rawValues);
            const validation = validateRegisterPayload(payload, authUtils);

            if (!validation.isValid) {
                showFieldErrors(form, validation.errors);
                setStatusMessage(statusElement, "Please fix the highlighted fields.", "error");
                setSubmittingState(form, false);

                return {
                    success: false,
                    errors: validation.errors
                };
            }

            const result = await submitRegistration(payload, {
                authService
            });

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to register right now. Please try again.",
                    "error"
                );
                setSubmittingState(form, false);

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            setStatusMessage(statusElement, getSuccessMessage(payload.accountType), "success");
            setSubmittingState(form, false);

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
                    : "Unable to register right now. Please try again.";

            setStatusMessage(statusElement, message, "error");
            setSubmittingState(form, false);

            if (typeof onError === "function") {
                onError(error);
            }

            return {
                success: false,
                message
            };
        }
    }

    form.addEventListener("submit", handleSubmit);

    return {
        handleSubmit
    };
}

function initializeRegisterPage(options = {}) {
    const {
        formSelector = "#register-form",
        statusSelector = "#register-status",
        authService,
        authUtils,
        navigate
    } = options;

    const form = document.querySelector(formSelector);
    const statusElement = document.querySelector(statusSelector);

    if (!form) {
        throw new Error("Register form not found.");
    }

    return attachRegisterHandler({
        form,
        statusElement,
        authService,
        authUtils,
        navigate: typeof navigate === "function"
            ? navigate
            : (nextRoute) => {
                window.location.href = nextRoute;
            }
    });
}

const registerPage = {
    normalizeText,
    normalizeEmail,
    extractRegisterFormValues,
    buildRegisterPayload,
    isValidAccountType,
    validateRegisterPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getSuccessMessage,
    submitRegistration,
    attachRegisterHandler,
    initializeRegisterPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = registerPage;
}

if (typeof window !== "undefined") {
    window.registerPage = registerPage;
}