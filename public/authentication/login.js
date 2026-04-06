/**
 * login.js
 *
 * Login page logic for the Campus Food Ordering Platform.
 * This file:
 * - validates login form data
 * - handles email/password login
 * - handles Google and Apple login
 * - uses injected services so it stays easy to test
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

function extractLoginFormValues(form) {
    const emailField = getFormField(form, "email");
    const passwordField = getFormField(form, "password");

    return {
        email: emailField ? emailField.value : "",
        password: passwordField ? passwordField.value : ""
    };
}

function buildLoginPayload(rawValues) {
    return {
        email: normalizeEmail(rawValues.email),
        password: typeof rawValues.password === "string" ? rawValues.password : ""
    };
}

function validateLoginPayload(payload, authUtils) {
    const errors = {};

    if (!authUtils || typeof authUtils !== "object") {
        throw new Error("authUtils is required.");
    }

    if (!authUtils.isValidEmail(payload.email)) {
        errors.email = "Please enter a valid email address.";
    }

    if (!authUtils.isNonEmptyString(payload.password)) {
        errors.password = "Password is required.";
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

async function submitEmailLogin(payload, dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.loginWithEmail !== "function") {
        throw new Error("authService.loginWithEmail is required.");
    }

    return authService.loginWithEmail({
        email: payload.email,
        password: payload.password
    });
}

async function submitGoogleLogin(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.loginWithGoogle !== "function") {
        throw new Error("authService.loginWithGoogle is required.");
    }

    return authService.loginWithGoogle();
}

async function submitAppleLogin(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.loginWithApple !== "function") {
        throw new Error("authService.loginWithApple is required.");
    }

    return authService.loginWithApple();
}

function handleAuthSuccess(result, options = {}) {
    const {
        statusElement,
        onSuccess,
        navigate
    } = options;

    setStatusMessage(statusElement, "Login successful.", "success");

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
        onError
    } = options;

    const message =
        result && result.message
            ? result.message
            : "Unable to sign in right now. Please try again.";

    setStatusMessage(statusElement, message, "error");

    if (typeof onError === "function") {
        onError(result);
    }

    return result;
}

function attachLoginHandler(options) {
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
        throw new Error("A login form is required.");
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
            const rawValues = extractLoginFormValues(form);
            const payload = buildLoginPayload(rawValues);
            const validation = validateLoginPayload(payload, authUtils);

            if (!validation.isValid) {
                showFieldErrors(form, validation.errors);
                setStatusMessage(statusElement, "Please fix the highlighted fields.", "error");
                setSubmittingState(form, false);

                return {
                    success: false,
                    errors: validation.errors
                };
            }

            const result = await submitEmailLogin(payload, {
                authService
            });

            setSubmittingState(form, false);

            if (!result.success) {
                return handleAuthFailure(result, {
                    statusElement,
                    onError
                });
            }

            return handleAuthSuccess(result, {
                statusElement,
                onSuccess,
                navigate
            });
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to sign in right now. Please try again.";

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
                    onError
                });
            }

            return handleAuthSuccess(result, {
                statusElement,
                onSuccess,
                navigate
            });
        } catch (error) {
            const message =
                error && error.message
                    ? error.message
                    : "Unable to sign in right now. Please try again.";

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

function initializeLoginPage(options = {}) {
    const {
        formSelector = "#login-form",
        statusSelector = "#login-status",
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
        throw new Error("Login form not found.");
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

    const loginController = attachLoginHandler({
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
            loginMethod: () => submitGoogleLogin({ authService }),
            navigate: resolvedNavigate
        });
    }

    if (appleButton) {
        appleController = attachOAuthHandler({
            button: appleButton,
            statusElement,
            loginMethod: () => submitAppleLogin({ authService }),
            navigate: resolvedNavigate
        });
    }

    return {
        loginController,
        googleController,
        appleController
    };
}

const loginPage = {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractLoginFormValues,
    buildLoginPayload,
    validateLoginPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    submitEmailLogin,
    submitGoogleLogin,
    submitAppleLogin,
    handleAuthSuccess,
    handleAuthFailure,
    attachLoginHandler,
    attachOAuthHandler,
    initializeLoginPage
};

export {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractLoginFormValues,
    buildLoginPayload,
    validateLoginPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    submitEmailLogin,
    submitGoogleLogin,
    submitAppleLogin,
    handleAuthSuccess,
    handleAuthFailure,
    attachLoginHandler,
    attachOAuthHandler,
    initializeLoginPage,
    loginPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = loginPage;
}

if (typeof window !== "undefined") {
    window.loginPage = loginPage;
}