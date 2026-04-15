/**
 * vendor-application.js
 *
 * Vendor application page logic for the Campus Food Ordering Platform.
 * This file:
 * - validates vendor application form data
 * - submits vendor application details for the signed-in user
 * - updates the user profile through injected authService methods
 * - can be used in the browser through initializeVendorApplicationPage(...)
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function getFormField(form, fieldName) {
    if (!form || !form.elements || typeof form.elements.namedItem !== "function") {
        return null;
    }

    return form.elements.namedItem(fieldName);
}

function extractVendorApplicationValues(form) {
    const businessNameField = getFormField(form, "businessName");
    const contactNumberField = getFormField(form, "contactNumber");
    const descriptionField = getFormField(form, "description");
    const campusLocationField = getFormField(form, "campusLocation");

    return {
        businessName: businessNameField ? businessNameField.value : "",
        contactNumber: contactNumberField ? contactNumberField.value : "",
        description: descriptionField ? descriptionField.value : "",
        campusLocation: campusLocationField ? campusLocationField.value : ""
    };
}

function buildVendorApplicationPayload(rawValues) {
    return {
        businessName: normalizeText(rawValues.businessName),
        contactNumber: normalizeText(rawValues.contactNumber),
        description: normalizeText(rawValues.description),
        campusLocation: normalizeText(rawValues.campusLocation)
    };
}

function validateVendorApplicationPayload(payload, authUtils) {
    const errors = {};

    if (!authUtils || typeof authUtils.isNonEmptyString !== "function") {
        throw new Error("authUtils.isNonEmptyString is required.");
    }

    if (!authUtils.isNonEmptyString(payload.businessName)) {
        errors.businessName = "Business name is required.";
    }

    if (!authUtils.isNonEmptyString(payload.contactNumber)) {
        errors.contactNumber = "Contact number is required.";
    }

    if (!authUtils.isNonEmptyString(payload.description)) {
        errors.description = "Business description is required.";
    }

    if (!authUtils.isNonEmptyString(payload.campusLocation)) {
        errors.campusLocation = "Campus location is required.";
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

function getVendorApplicationUpdates(payload, existingProfile = {}) {
    const existingRoles =
        existingProfile && existingProfile.roles ? existingProfile.roles : {};

    return {
        businessName: payload.businessName,
        contactNumber: payload.contactNumber,
        description: payload.description,
        campusLocation: payload.campusLocation,
        roles: {
            customer: !!existingRoles.customer,
            vendor: true,
            admin: !!existingRoles.admin
        },
        vendorStatus: "pending"
    };
}

function getSuccessMessage() {
    return "Vendor application submitted successfully. Your application is awaiting review.";
}

async function submitVendorApplication(payload, dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    if (!authService || typeof authService.updateUserProfile !== "function") {
        throw new Error("authService.updateUserProfile is required.");
    }

    const user = await authService.getCurrentUser();

    if (!user) {
        return {
            success: false,
            message: "No user is currently signed in."
        };
    }

    const existingProfile = await authService.getCurrentUserProfile(user.uid);
    const updates = getVendorApplicationUpdates(payload, existingProfile || {});

    await authService.updateUserProfile(user.uid, updates);

    return {
        success: true,
        uid: user.uid,
        updates,
        nextRoute: "./pending-vendor.html"
    };
}

function attachVendorApplicationHandler(options) {
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
        throw new Error("A vendor application form is required.");
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
            const rawValues = extractVendorApplicationValues(form);
            const payload = buildVendorApplicationPayload(rawValues);
            const validation = validateVendorApplicationPayload(payload, authUtils);

            if (!validation.isValid) {
                showFieldErrors(form, validation.errors);
                setStatusMessage(statusElement, "Please fix the highlighted fields.", "error");
                setSubmittingState(form, false);

                return {
                    success: false,
                    errors: validation.errors
                };
            }

            const result = await submitVendorApplication(payload, {
                authService
            });

            setSubmittingState(form, false);

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to submit vendor application right now.",
                    "error"
                );

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            setStatusMessage(statusElement, getSuccessMessage(), "success");

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
                    : "Unable to submit vendor application right now.";

            setSubmittingState(form, false);
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

    form.addEventListener("submit", handleSubmit);

    return {
        handleSubmit
    };
}

function initializeVendorApplicationPage(options = {}) {
    const {
        formSelector = "#vendor-application-form",
        statusSelector = "#vendor-application-status",
        authService,
        authUtils,
        navigate
    } = options;

    const form = document.querySelector(formSelector);
    const statusElement = document.querySelector(statusSelector);

    if (!form) {
        throw new Error("Vendor application form not found.");
    }

    const resolvedNavigate =
        typeof navigate === "function"
            ? navigate
            : (nextRoute) => {
                window.location.href = nextRoute;
            };

    return attachVendorApplicationHandler({
        form,
        statusElement,
        authService,
        authUtils,
        navigate: resolvedNavigate
    });
}

const vendorApplicationPage = {
    normalizeText,
    getFormField,
    extractVendorApplicationValues,
    buildVendorApplicationPayload,
    validateVendorApplicationPayload,
    clearFieldErrors,
    showFieldErrors,
    setStatusMessage,
    setSubmittingState,
    getVendorApplicationUpdates,
    getSuccessMessage,
    submitVendorApplication,
    attachVendorApplicationHandler,
    initializeVendorApplicationPage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = vendorApplicationPage;
}

if (typeof window !== "undefined") {
    window.vendorApplicationPage = vendorApplicationPage;
}