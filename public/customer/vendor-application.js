(function attachVendorApplicationPage(globalScope) {
    "use strict";

    const DEFAULT_STATUS_MESSAGE = "Complete the form below to apply for vendor access.";
    const DEFAULT_PENDING_MESSAGE = "Your vendor application is pending review.";
    const DEFAULT_APPROVED_MESSAGE = "Your vendor access is approved. You can now open the vendor portal.";
    const DEFAULT_BLOCKED_MESSAGE = "Your vendor access is currently blocked. Please contact support or admin.";
    const DEFAULT_REJECTED_MESSAGE = "Your vendor application was not approved. You can review your details and apply again.";
    const DEFAULT_NOT_SIGNED_IN_MESSAGE = "Please sign in to apply for vendor access.";

    function normalizeText(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function normalizeLowerText(value) {
        return normalizeText(value).toLowerCase();
    }

    function getSafeUserProfile(authUtils, profile, fallbackUid) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};

        if (authUtils && typeof authUtils.normaliseUserData === "function") {
            return {
                ...safeProfile,
                ...authUtils.normaliseUserData({
                    ...safeProfile,
                    uid: safeProfile.uid || fallbackUid || ""
                })
            };
        }

        return {
            uid: safeProfile.uid || fallbackUid || "",
            displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
            email: normalizeLowerText(safeProfile.email),
            phoneNumber: normalizeText(safeProfile.phoneNumber),
            vendorStatus: normalizeLowerText(safeProfile.vendorStatus) || "none",
            vendorReason: normalizeText(
                safeProfile.vendorReason ||
                safeProfile.rejectionReason ||
                safeProfile.blockReason
            ),
            accountStatus: normalizeLowerText(safeProfile.accountStatus) || "active",
            isAdmin: safeProfile.isAdmin === true,
            isOwner: safeProfile.isOwner === true,
            vendorBusinessName: normalizeText(safeProfile.vendorBusinessName),
            vendorOwnerName: normalizeText(safeProfile.vendorOwnerName),
            vendorEmail: normalizeLowerText(safeProfile.vendorEmail),
            vendorPhoneNumber: normalizeText(safeProfile.vendorPhoneNumber || safeProfile.phoneNumber),
            vendorUniversity: normalizeText(safeProfile.vendorUniversity),
            vendorLocation: normalizeText(safeProfile.vendorLocation),
            vendorFoodType: normalizeText(safeProfile.vendorFoodType),
            vendorDescription: normalizeText(safeProfile.vendorDescription)
        };
    }

    function getVendorApplicationFields(formValues) {
        const safeValues = formValues && typeof formValues === "object" ? formValues : {};

        return {
            vendorBusinessName: normalizeText(safeValues.businessName),
            vendorOwnerName: normalizeText(safeValues.ownerName),
            vendorEmail: normalizeLowerText(safeValues.email),
            vendorPhoneNumber: normalizeText(safeValues.phoneNumber),
            vendorUniversity: normalizeText(safeValues.university),
            vendorLocation: normalizeText(safeValues.location),
            vendorFoodType: normalizeText(safeValues.foodType),
            vendorDescription: normalizeText(safeValues.description)
        };
    }

    function validatePhoneNumber(phoneNumber) {
        const value = normalizeText(phoneNumber).replace(/\s+/g, "");

        if (!value) {
            return "Please enter a phone number.";
        }

        if (!/^\+?[0-9]{10,15}$/.test(value)) {
            return "Please enter a valid phone number with 10 to 15 digits.";
        }

        return "";
    }

    function validateApplicationForm(formValues, authUtils) {
        const safeValues = formValues && typeof formValues === "object" ? formValues : {};
        const errors = {};

        if (!normalizeText(safeValues.businessName)) {
            errors.businessName = "Please enter the business or restaurant name.";
        }

        if (!normalizeText(safeValues.ownerName)) {
            errors.ownerName = "Please enter the owner or manager name.";
        }

        if (!normalizeText(safeValues.email)) {
            errors.email = "Please enter the business email.";
        } else if (
            authUtils &&
            typeof authUtils.isValidEmail === "function" &&
            !authUtils.isValidEmail(safeValues.email)
        ) {
            errors.email = "Please enter a valid business email.";
        }

        const phoneError = validatePhoneNumber(safeValues.phoneNumber);
        if (phoneError) {
            errors.phoneNumber = phoneError;
        }

        if (!normalizeText(safeValues.university)) {
            errors.university = "Please enter your university or campus.";
        }

        if (!normalizeText(safeValues.location)) {
            errors.location = "Please enter the business location.";
        }

        if (!normalizeText(safeValues.foodType)) {
            errors.foodType = "Please select a food category.";
        }

        if (!normalizeText(safeValues.description)) {
            errors.description = "Please enter a business description.";
        } else if (normalizeText(safeValues.description).length < 20) {
            errors.description = "Please enter a slightly longer business description.";
        }

        if (safeValues.confirmed !== true) {
            errors.confirmed = "Please confirm that the information is correct.";
        }

        return {
            isValid: Object.keys(errors).length === 0,
            errors
        };
    }

    function getStatusViewModel(profile) {
        const safeProfile = profile && typeof profile === "object" ? profile : {};
        const status = normalizeLowerText(safeProfile.vendorStatus) || "none";

        if (status === "approved") {
            return {
                key: "approved",
                message: DEFAULT_APPROVED_MESSAGE,
                canApply: false,
                canOpenVendorPortal: true
            };
        }

        if (status === "pending") {
            return {
                key: "pending",
                message: DEFAULT_PENDING_MESSAGE,
                canApply: false,
                canOpenVendorPortal: false
            };
        }

        if (status === "blocked") {
            return {
                key: "blocked",
                message: DEFAULT_BLOCKED_MESSAGE,
                canApply: false,
                canOpenVendorPortal: false
            };
        }

        if (status === "rejected") {
            return {
                key: "rejected",
                message: DEFAULT_REJECTED_MESSAGE,
                canApply: true,
                canOpenVendorPortal: false
            };
        }

        return {
            key: "none",
            message: DEFAULT_STATUS_MESSAGE,
            canApply: true,
            canOpenVendorPortal: false
        };
    }

    function createVendorApplicationPage(dependencies) {
        const authService = dependencies.authService;
        const authUtils = dependencies.authUtils;
        const db = dependencies.db;
        const firestoreFns = dependencies.firestoreFns || {};

        const state = {
            currentUser: null,
            currentProfile: null,
            isSubmitting: false
        };

        function getElement(id) {
            return document.getElementById(id);
        }

        function setStatus(message, stateName) {
            const statusElement = getElement("vendor-application-status");

            if (!statusElement) {
                return;
            }

            statusElement.textContent = message || "";

            if (stateName) {
                statusElement.setAttribute("data-state", stateName);
            } else {
                statusElement.removeAttribute("data-state");
            }
        }

        function setNote(message) {
            const noteElement = getElement("vendor-application-note");

            if (!noteElement) {
                return;
            }

            noteElement.textContent = message || "";
        }

        function getFormElements() {
            return {
                form: getElement("vendor-application-form"),
                formSection: getElement("vendor-application-form-section"),
                businessNameInput: getElement("vendor-business-name"),
                ownerNameInput: getElement("vendor-owner-name"),
                emailInput: getElement("vendor-email"),
                phoneInput: getElement("vendor-phone"),
                universityInput: getElement("vendor-university"),
                locationInput: getElement("vendor-location"),
                foodTypeInput: getElement("vendor-food-type"),
                descriptionInput: getElement("vendor-description"),
                confirmInput: getElement("vendor-confirm-checkbox"),
                submitButton: getElement("submit-vendor-application-button"),
                resetButton: getElement("reset-vendor-application-button"),
                vendorPortalButton: getElement("go-vendor-portal-button"),
                backButton: getElement("back-button")
            };
        }

        function getFieldMap() {
            const elements = getFormElements();

            return {
                businessName: elements.businessNameInput,
                ownerName: elements.ownerNameInput,
                email: elements.emailInput,
                phoneNumber: elements.phoneInput,
                university: elements.universityInput,
                location: elements.locationInput,
                foodType: elements.foodTypeInput,
                description: elements.descriptionInput,
                confirmed: elements.confirmInput
            };
        }

        function getErrorElement(fieldName) {
            return getElement(`vendor-${fieldName}-error`);
        }

        function setFieldError(fieldName, message) {
            const fieldMap = getFieldMap();
            const field = fieldMap[fieldName];
            const errorElement = getErrorElement(fieldName);

            if (field) {
                if (message) {
                    field.setAttribute("aria-invalid", "true");
                } else {
                    field.removeAttribute("aria-invalid");
                }
            }

            if (errorElement) {
                errorElement.textContent = message || "";
                errorElement.hidden = !message;
            }
        }

        function clearFieldErrors() {
            const fieldNames = [
                "businessName",
                "ownerName",
                "email",
                "phoneNumber",
                "university",
                "location",
                "foodType",
                "description",
                "confirmed"
            ];

            fieldNames.forEach(function clearError(fieldName) {
                setFieldError(fieldName, "");
            });
        }

        function showValidationErrors(errors) {
            clearFieldErrors();

            Object.keys(errors).forEach(function applyError(fieldName) {
                setFieldError(fieldName, errors[fieldName]);
            });
        }

        function collectFormValues() {
            const elements = getFormElements();

            return {
                businessName: elements.businessNameInput ? elements.businessNameInput.value : "",
                ownerName: elements.ownerNameInput ? elements.ownerNameInput.value : "",
                email: elements.emailInput ? elements.emailInput.value : "",
                phoneNumber: elements.phoneInput ? elements.phoneInput.value : "",
                university: elements.universityInput ? elements.universityInput.value : "",
                location: elements.locationInput ? elements.locationInput.value : "",
                foodType: elements.foodTypeInput ? elements.foodTypeInput.value : "",
                description: elements.descriptionInput ? elements.descriptionInput.value : "",
                confirmed: elements.confirmInput ? elements.confirmInput.checked === true : false
            };
        }

        function getSingleFieldError(fieldName, values) {
            const validation = validateApplicationForm(values, authUtils);
            return validation.errors[fieldName] || "";
        }

        function validateSingleField(fieldName) {
            const values = collectFormValues();
            const error = getSingleFieldError(fieldName, values);
            setFieldError(fieldName, error);
            return !error;
        }

        function fillFormFromProfile(profile) {
            const safeProfile = profile && typeof profile === "object" ? profile : {};
            const elements = getFormElements();

            if (elements.businessNameInput) {
                elements.businessNameInput.value = normalizeText(safeProfile.vendorBusinessName);
            }

            if (elements.ownerNameInput) {
                elements.ownerNameInput.value = normalizeText(safeProfile.vendorOwnerName || safeProfile.displayName);
            }

            if (elements.emailInput) {
                elements.emailInput.value =
                    normalizeText(safeProfile.vendorEmail) ||
                    normalizeText(safeProfile.email);
            }

            if (elements.phoneInput) {
                elements.phoneInput.value =
                    normalizeText(safeProfile.vendorPhoneNumber) ||
                    normalizeText(safeProfile.phoneNumber);
            }

            if (elements.universityInput) {
                elements.universityInput.value = normalizeText(safeProfile.vendorUniversity);
            }

            if (elements.locationInput) {
                elements.locationInput.value = normalizeText(safeProfile.vendorLocation);
            }

            if (elements.foodTypeInput) {
                elements.foodTypeInput.value = normalizeText(safeProfile.vendorFoodType);
            }

            if (elements.descriptionInput) {
                elements.descriptionInput.value = normalizeText(safeProfile.vendorDescription);
            }
        }

        function formatFoodType(value) {
            const safeValue = normalizeText(value);

            if (!safeValue) {
                return "-";
            }

            return safeValue
                .split("-")
                .map(function capitalize(word) {
                    return word ? word.charAt(0).toUpperCase() + word.slice(1) : "";
                })
                .join(" ");
        }

        function updateSummary(profile) {
            const safeProfile = profile && typeof profile === "object" ? profile : {};

            const businessNameOutput = getElement("vendor-business-name-output");
            const ownerNameOutput = getElement("vendor-owner-name-output");
            const emailOutput = getElement("vendor-email-output");
            const phoneOutput = getElement("vendor-phone-output");
            const universityOutput = getElement("vendor-university-output");
            const locationOutput = getElement("vendor-location-output");
            const foodTypeOutput = getElement("vendor-food-type-output");
            const descriptionOutput = getElement("vendor-description-output");
            const statusOutput = getElement("vendor-status-output");
            const reasonOutput = getElement("vendor-reason-output");

            if (statusOutput) {
                statusOutput.textContent = normalizeText(safeProfile.vendorStatus) || "none";
            }

            if (businessNameOutput) {
                businessNameOutput.textContent = normalizeText(safeProfile.vendorBusinessName) || "-";
            }

            if (ownerNameOutput) {
                ownerNameOutput.textContent = normalizeText(safeProfile.vendorOwnerName) || "-";
            }

            if (emailOutput) {
                emailOutput.textContent =
                    normalizeText(safeProfile.vendorEmail) ||
                    normalizeText(safeProfile.email) ||
                    "-";
            }

            if (phoneOutput) {
                phoneOutput.textContent =
                    normalizeText(safeProfile.vendorPhoneNumber) ||
                    normalizeText(safeProfile.phoneNumber) ||
                    "-";
            }

            if (universityOutput) {
                universityOutput.textContent = normalizeText(safeProfile.vendorUniversity) || "-";
            }

            if (locationOutput) {
                locationOutput.textContent = normalizeText(safeProfile.vendorLocation) || "-";
            }

            if (foodTypeOutput) {
                foodTypeOutput.textContent = formatFoodType(safeProfile.vendorFoodType);
            }

            if (descriptionOutput) {
                descriptionOutput.textContent = normalizeText(safeProfile.vendorDescription) || "-";
            }

            if (reasonOutput) {
                reasonOutput.textContent = normalizeText(safeProfile.vendorReason) || "-";
            }
        }

        function applyStatusView(profile) {
            const elements = getFormElements();
            const safeProfile = profile && typeof profile === "object" ? profile : {};
            const viewModel = getStatusViewModel(safeProfile);

            if (elements.submitButton) {
                elements.submitButton.disabled = !viewModel.canApply || state.isSubmitting;
                elements.submitButton.textContent = state.isSubmitting
                    ? "Submitting..."
                    : "Submit Vendor Application";
            }

            if (elements.resetButton) {
                elements.resetButton.disabled = !viewModel.canApply || state.isSubmitting;
            }

            if (elements.vendorPortalButton) {
                elements.vendorPortalButton.hidden = !viewModel.canOpenVendorPortal;
                elements.vendorPortalButton.disabled = !viewModel.canOpenVendorPortal;
            }

            if (elements.formSection) {
                elements.formSection.hidden = !viewModel.canApply && !state.isSubmitting;
            }

            if (viewModel.key === "approved") {
                setStatus(viewModel.message, "success");
                setNote("Your vendor account is active. You can now open the vendor portal.");
                return;
            }

            if (viewModel.key === "pending") {
                setStatus(viewModel.message, "info");
                setNote("Your application is under review. You cannot submit another one right now.");
                return;
            }

            if (viewModel.key === "blocked") {
                setStatus(viewModel.message, "error");
                setNote(
                    normalizeText(safeProfile.vendorReason) ||
                    "Your vendor access is blocked. Please contact support or admin."
                );
                return;
            }

            if (viewModel.key === "rejected") {
                setStatus(viewModel.message, "error");
                setNote(
                    normalizeText(safeProfile.vendorReason) ||
                    "You may update your details and submit the application again."
                );
                return;
            }

            setStatus(viewModel.message, "info");
            setNote("Complete the application form below and submit it for review.");
        }

        async function loadCurrentProfile() {
            const currentUser =
                typeof authService.getCurrentUser === "function"
                    ? authService.getCurrentUser()
                    : null;

            if (!currentUser || !currentUser.uid) {
                state.currentUser = null;
                state.currentProfile = null;
                setStatus(DEFAULT_NOT_SIGNED_IN_MESSAGE, "error");
                setNote("Please sign in first.");
                applyStatusView({ vendorStatus: "none" });
                return null;
            }

            state.currentUser = currentUser;

            const profile =
                (typeof authService.getCurrentUserProfile === "function"
                    ? await authService.getCurrentUserProfile(currentUser.uid)
                    : null) ||
                (typeof authService.getUserProfile === "function"
                    ? await authService.getUserProfile(currentUser.uid)
                    : null);

            state.currentProfile = getSafeUserProfile(authUtils, profile || {}, currentUser.uid);

            fillFormFromProfile(state.currentProfile);
            updateSummary(state.currentProfile);
            applyStatusView(state.currentProfile);

            return state.currentProfile;
        }

        async function saveVendorApplicationRecord(updates) {
            if (
                !db ||
                typeof firestoreFns.doc !== "function" ||
                typeof firestoreFns.setDoc !== "function"
            ) {
                return;
            }

            const applicationRef = firestoreFns.doc(
                db,
                "vendorApplications",
                state.currentUser.uid
            );

            const payload = {
                uid: state.currentUser.uid,
                vendorStatus: "pending",
                vendorReason: "",
                ...updates
            };

            if (typeof firestoreFns.serverTimestamp === "function") {
                payload.updatedAt = firestoreFns.serverTimestamp();
                payload.submittedAt = firestoreFns.serverTimestamp();
            } else {
                const now = new Date().toISOString();
                payload.updatedAt = now;
                payload.submittedAt = now;
            }

            await firestoreFns.setDoc(applicationRef, payload, { merge: true });
        }

        async function submitApplication() {
            if (!state.currentUser || !state.currentUser.uid) {
                setStatus(DEFAULT_NOT_SIGNED_IN_MESSAGE, "error");
                setNote("Please sign in first.");
                return {
                    success: false,
                    message: DEFAULT_NOT_SIGNED_IN_MESSAGE
                };
            }

            const values = collectFormValues();
            const validation = validateApplicationForm(values, authUtils);

            if (!validation.isValid) {
                showValidationErrors(validation.errors);

                const firstError = Object.values(validation.errors)[0];
                setStatus(firstError, "error");
                setNote("Please correct the highlighted fields and try again.");

                return {
                    success: false,
                    message: firstError,
                    errors: validation.errors
                };
            }

            clearFieldErrors();

            const applicationFields = getVendorApplicationFields(values);

            const updates = {
                ...applicationFields,
                vendorStatus: "pending",
                vendorReason: ""
            };

            state.isSubmitting = true;
            applyStatusView({
                ...(state.currentProfile || {}),
                vendorStatus: "none"
            });
            setStatus("Submitting your vendor application...", "loading");
            setNote("Please wait while we save your application.");

            try {
                if (typeof authService.updateCurrentUserProfile === "function") {
                    await authService.updateCurrentUserProfile(updates);
                } else if (typeof authService.updateUserProfile === "function") {
                    await authService.updateUserProfile(state.currentUser.uid, updates);
                } else {
                    throw new Error("No supported profile update method was provided.");
                }

                await saveVendorApplicationRecord(updates);

                state.currentProfile = {
                    ...(state.currentProfile || {}),
                    ...updates,
                    uid: state.currentUser.uid
                };

                fillFormFromProfile(state.currentProfile);
                updateSummary(state.currentProfile);

                state.currentProfile.vendorStatus = "pending";
                applyStatusView(state.currentProfile);

                setStatus(DEFAULT_PENDING_MESSAGE, "info");
                setNote("Your vendor application has been submitted and is now pending review.");

                return {
                    success: true,
                    message: DEFAULT_PENDING_MESSAGE,
                    updates
                };
            } finally {
                state.isSubmitting = false;
                applyStatusView(state.currentProfile || { vendorStatus: "none" });
            }
        }

        function goBack() {
            window.location.href = "./index.html";
        }

        function goToVendorPortal() {
            window.location.href = "../vendor/index.html";
        }

        function bindLiveValidation() {
            const fieldMap = getFieldMap();

            Object.keys(fieldMap).forEach(function attachListener(fieldName) {
                const field = fieldMap[fieldName];

                if (!field) {
                    return;
                }

                const eventName =
                    field.type === "checkbox" || field.tagName === "SELECT"
                        ? "change"
                        : "input";

                field.addEventListener(eventName, function handleValidation() {
                    validateSingleField(fieldName);

                    const currentValues = collectFormValues();
                    const currentApplicationFields = getVendorApplicationFields(currentValues);

                    updateSummary({
                        ...(state.currentProfile || {}),
                        ...currentApplicationFields,
                        vendorEmail: normalizeLowerText(currentValues.email),
                        vendorPhoneNumber: normalizeText(currentValues.phoneNumber)
                    });
                });

                if (eventName !== "change") {
                    field.addEventListener("blur", function handleBlurValidation() {
                        validateSingleField(fieldName);
                    });
                }
            });
        }

        function bindEvents() {
            const elements = getFormElements();

            if (elements.form) {
                elements.form.addEventListener("submit", async function handleSubmit(event) {
                    event.preventDefault();

                    try {
                        await submitApplication();
                    } catch (error) {
                        setStatus("Something went wrong while submitting the application.", "error");
                        setNote(
                            normalizeText(error && error.message) ||
                            "Please check your details and try again."
                        );
                    }
                });

                elements.form.addEventListener("reset", function handleReset() {
                    window.setTimeout(function afterReset() {
                        clearFieldErrors();

                        updateSummary({
                            ...(state.currentProfile || {}),
                            vendorBusinessName: "",
                            vendorOwnerName: "",
                            vendorEmail: "",
                            vendorPhoneNumber: "",
                            vendorUniversity: "",
                            vendorLocation: "",
                            vendorFoodType: "",
                            vendorDescription: ""
                        });

                        setStatus(DEFAULT_STATUS_MESSAGE, "info");
                        setNote("The form has been cleared.");
                    }, 0);
                });
            }

            if (elements.backButton) {
                elements.backButton.addEventListener("click", goBack);
            }

            if (elements.vendorPortalButton) {
                elements.vendorPortalButton.addEventListener("click", goToVendorPortal);
            }

            bindLiveValidation();
        }

        async function initializeVendorApplicationPage() {
            bindEvents();

            try {
                await loadCurrentProfile();
            } catch (error) {
                setStatus("Unable to load your vendor application details.", "error");
                setNote("Please refresh the page and try again.");
            }
        }

        return {
            initializeVendorApplicationPage,
            helpers: {
                normalizeText,
                normalizeLowerText,
                getSafeUserProfile,
                getVendorApplicationFields,
                validateApplicationForm,
                getStatusViewModel,
                validatePhoneNumber
            }
        };
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            normalizeText,
            normalizeLowerText,
            getSafeUserProfile,
            getVendorApplicationFields,
            validateApplicationForm,
            getStatusViewModel,
            validatePhoneNumber,
            createVendorApplicationPage
        };
    }

    if (typeof globalScope !== "undefined") {
        globalScope.vendorApplicationPage = {
            initializeVendorApplicationPage: async function initializeVendorApplicationPage(dependencies) {
                const page = createVendorApplicationPage(dependencies);
                globalScope.vendorApplicationPage.instance = page;
                return page.initializeVendorApplicationPage();
            }
        };
    }
})(typeof window !== "undefined" ? window : globalThis);