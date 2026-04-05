/**
 * reset.js
 *
 * Password reset page logic for the Campus Food Ordering Platform.
 * This file:
 * - validates reset form data
 * - submits password reset requests
 * - uses injected services so it stays easy to test
 * - can be used in the browser through initializeResetPage(...)
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

function extractResetFormValues(form) {
    const emailField = getFormField(form, "email");

    return {
        email: emailField ? emailField.value : ""
    };
}

function buildResetPayload(rawValues) {
    return {
        email: normalizeEmail(rawValues.email)
    };
}

function validateResetPayload(payload, authUtils) {
    const errors = {};

    if (!authUtils.isValidEmail(payload.email)) {
        errors.email = "Please enter a valid email address.";
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

function getSuccessMessage() {
    return "Password reset email sent. Please check your inbox.";
}

async function submitPasswordReset(payload, dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.sendPasswordResetEmail !== "function") {
        throw new Error("authService.sendPasswordResetEmail is required.");
    }

    return authService.sendPasswordResetEmail({
        email: payload.email
    });
}

function attachResetHandler(options) {
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
        throw new Error("A reset form is required.");
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
            const rawValues = extractResetFormValues(form);
            const payload = buildResetPayload(rawValues);
            const validation = validateResetPayload(payload, authUtils);

            if (!validation.isValid) {
                showFieldErrors(form, validation.errors);
                setStatusMessage(statusElement, "Please fix the highlighted fields.", "error");
                setSubmittingState(form, false);

                return {
                    success: false,
                    errors: validation.errors
                };
            }

            const result = await submitPasswordReset(payload, {
                authService
            });

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to send password reset email right now. Please try again.",
                    "error"
                );
                setSubmittingState(form, false);

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            setStatusMessage(statusElement, getSuccessMessage(), "success");
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
                    : "Unable to send password reset email right now. Please try again.";

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

function initializeResetPage(options = {}) {
    const {
        formSelector = "#reset-form",
        statusSelector = "#reset-status",
        authService,
        authUtils,
        navigate
    } = options;

    const form = document.querySelector(formSelector);
    const statusElement = document.querySelector(statusSelector);

    if (!form) {
        throw new Error("Reset form not found.");
    }

    return attachResetHandler({
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

const resetPage = {
    normalizeText,
    normalizeEmail,
    getFormField,
    extractResetFormValues,
    buildResetPayload,
    validateResetPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getSuccessMessage,
    submitPasswordReset,
    attachResetHandler,
    initializeResetPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = resetPage;
}

if (typeof window !== "undefined") {
    window.resetPage = resetPage;
}