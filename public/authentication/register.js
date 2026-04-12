/**
 * register.js
 *
 * Registration page logic for the Campus Food Ordering Platform.
 * This file:
 * - validates registration form data
 * - supports customer and vendor registration entry points
 * - supports Google and Apple sign-up/sign-in entry points
 * - uses injected services so it stays easy to test
 * - can be used in the browser through initializeRegisterPage(...)
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email) {
    return normalizeText(email).toLowerCase();
}

function getFormField(form, fieldName) {
    if (!form || !form.elements || typeof form.elements.namedItem !== "function") {
        return null;
    }

    return form.elements.namedItem(fieldName);
}

function extractRegisterFormValues(form) {
    const fullNameField = getFormField(form, "fullName");
    const emailField = getFormField(form, "email");
    const passwordField = getFormField(form, "password");
    const confirmPasswordField = getFormField(form, "confirmPassword");
    const accountTypeField = getFormField(form, "accountType");

    return {
        fullName: fullNameField ? fullNameField.value : "",
        email: emailField ? emailField.value : "",
        password: passwordField ? passwordField.value : "",
        confirmPassword: confirmPasswordField ? confirmPasswordField.value : "",
        accountType: accountTypeField ? accountTypeField.value : "customer"
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

    if (!authUtils || typeof authUtils !== "object") {
        throw new Error("authUtils is required.");
    }

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
    if (!form) {
        return;
    }

    const errorElements = form.querySelectorAll("[data-error-for]");
    errorElements.forEach((element) => {
        element.textContent = "";
    });
}

function showFieldErrors(form, errors) {
    if (!form || !errors) {
        return;
    }

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

async function submitGoogleRegistration(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.loginWithGoogle !== "function") {
        throw new Error("authService.loginWithGoogle is required.");
    }

    return authService.loginWithGoogle();
}

async function submitAppleRegistration(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.loginWithApple !== "function") {
        throw new Error("authService.loginWithApple is required.");
    }

    return authService.loginWithApple();
}

function handleAuthSuccess(result, options = {}) {
    const {
        statusElement,
        successMessage = "Registration successful.",
        onSuccess,
        navigate
    } = options;

    setStatusMessage(statusElement, successMessage, "success");

    if (typeof onSuccess === "function") {
        onSuccess(result);
    }

    if (typeof navigate === "function" && result && result.nextRoute) {
        navigate(result.nextRoute);
    }

    return result;
}

function handleAuthFailure(result, options = {}) {
    const {
        statusElement,
        fallbackMessage = "Unable to complete registration right now. Please try again.",
        onError
    } = options;

    const message =
        result && result.message
            ? result.message
            : fallbackMessage;

    setStatusMessage(statusElement, message, "error");

    if (typeof onError === "function") {
        onError(result);
    }

    return result;
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

            setSubmittingState(form, false);

            if (!result.success) {
                return handleAuthFailure(result, {
                    statusElement,
                    fallbackMessage: "Unable to register right now. Please try again.",
                    onError
                });
            }

            return handleAuthSuccess(result, {
                statusElement,
                successMessage: getSuccessMessage(payload.accountType),
                onSuccess,
                navigate
            });
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

function attachOAuthHandler(options) {
    const {
        button,
        statusElement,
        loginMethod,
        onSuccess,
        onError,
        navigate
    } = options || {};

    if (!button) {
        throw new Error("An OAuth button is required.");
    }

    if (typeof loginMethod !== "function") {
        throw new Error("A loginMethod function is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        button.disabled = true;
        setStatusMessage(statusElement, "", "");

        try {
            const result = await loginMethod();

            button.disabled = false;

            if (!result.success) {
                return handleAuthFailure(result, {
                    statusElement,
                    fallbackMessage: "Unable to complete registration right now. Please try again.",
                    onError
                });
            }

            return handleAuthSuccess(result, {
                statusElement,
                successMessage: "Registration successful.",
                onSuccess,
                navigate
            });
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to complete registration right now. Please try again.";

            button.disabled = false;
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

function initializeRegisterPage(options = {}) {
    const {
        formSelector = "#register-form",
        statusSelector = "#register-status",
        googleButtonSelector = "#google-signin",
        appleButtonSelector = "#apple-signin",
        authService = typeof window !== "undefined" ? window.authService : undefined,
        authUtils = typeof window !== "undefined" ? window.authUtils : undefined,
        navigate
    } = options;

    const form = document.querySelector(formSelector);
    const statusElement = document.querySelector(statusSelector);
    const googleButton = document.querySelector(googleButtonSelector);
    const appleButton = document.querySelector(appleButtonSelector);

    if (!form) {
        throw new Error("Register form not found.");
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    if (!authUtils) {
        throw new Error("authUtils is required.");
    }

    const resolvedNavigate =
        typeof navigate === "function"
            ? navigate
            : (nextRoute) => {
                window.location.href = nextRoute;
            };

    const registerController = attachRegisterHandler({
        form,
        statusElement,
        authService,
        authUtils,
        navigate: resolvedNavigate
    });

    let googleController = null;
    let appleController = null;

    if (googleButton) {
        googleController = attachOAuthHandler({
            button: googleButton,
            statusElement,
            loginMethod: () => submitGoogleRegistration({ authService }),
            navigate: resolvedNavigate
        });
    }

    if (appleButton) {
        appleController = attachOAuthHandler({
            button: appleButton,
            statusElement,
            loginMethod: () => submitAppleRegistration({ authService }),
            navigate: resolvedNavigate
        });
    }

    return {
        registerController,
        googleController,
        appleController
    };
}

const registerPage = {
    normalizeText,
    normalizeEmail,
    getFormField,
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
    submitGoogleRegistration,
    submitAppleRegistration,
    handleAuthSuccess,
    handleAuthFailure,
    attachRegisterHandler,
    attachOAuthHandler,
    initializeRegisterPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = registerPage;
}

if (typeof window !== "undefined") {
    window.registerPage = registerPage;
}