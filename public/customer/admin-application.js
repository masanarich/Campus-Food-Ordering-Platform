(function attachAdminApplicationPage(globalScope) {
    "use strict";

    const DEFAULT_STATUS_MESSAGE = "Complete the form below to apply for admin access.";
    const DEFAULT_PENDING_MESSAGE = "Your admin application is pending review.";
    const DEFAULT_APPROVED_MESSAGE = "Your admin access is approved. You can now open the admin portal.";
    const DEFAULT_BLOCKED_MESSAGE = "Your admin access is currently blocked. Please contact support or admin.";
    const DEFAULT_REJECTED_MESSAGE = "Your admin application was not approved. You can review your details and apply again.";
    const DEFAULT_NOT_SIGNED_IN_MESSAGE = "Please sign in to apply for admin access.";

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
                }),
                adminDepartment: normalizeText(safeProfile.adminDepartment),
                adminMotivation: normalizeText(safeProfile.adminMotivation)
            };
        }

        const isAdmin = safeProfile.isAdmin === true;

        return {
            uid: safeProfile.uid || fallbackUid || "",
            displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
            email: normalizeLowerText(safeProfile.email),
            phoneNumber: normalizeText(safeProfile.phoneNumber),
            accountStatus: normalizeLowerText(safeProfile.accountStatus) || "active",
            isAdmin,
            adminApplicationStatus: isAdmin
                ? "approved"
                : (normalizeLowerText(safeProfile.adminApplicationStatus) || "none"),
            adminApplicationReason: normalizeText(
                safeProfile.adminApplicationReason ||
                safeProfile.adminRejectionReason ||
                safeProfile.adminBlockReason
            ),
            adminDepartment: normalizeText(safeProfile.adminDepartment),
            adminMotivation: normalizeText(safeProfile.adminMotivation)
        };
    }

    function getAdminApplicationFields(formValues) {
        const safeValues = formValues && typeof formValues === "object" ? formValues : {};

        return {
            adminDepartment: normalizeText(safeValues.department),
            adminMotivation: normalizeText(safeValues.motivation)
        };
    }

    function validateApplicationForm(formValues, authUtils) {
        const safeValues = formValues && typeof formValues === "object" ? formValues : {};
        const errors = {};

        if (!normalizeText(safeValues.department)) {
            errors.department = "Please enter your department, faculty, or admin area.";
        }

        if (!normalizeText(safeValues.email)) {
            errors.email = "Please enter your admin contact email.";
        } else if (
            authUtils &&
            typeof authUtils.isValidEmail === "function" &&
            !authUtils.isValidEmail(safeValues.email)
        ) {
            errors.email = "Please enter a valid admin contact email.";
        }

        if (!normalizeText(safeValues.motivation)) {
            errors.motivation = "Please explain why you need admin access.";
        } else if (normalizeText(safeValues.motivation).length < 30) {
            errors.motivation = "Please provide a fuller motivation for admin access.";
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
        const status = safeProfile.isAdmin === true
            ? "approved"
            : (normalizeLowerText(safeProfile.adminApplicationStatus) || "none");

        if (status === "approved") {
            return {
                key: "approved",
                message: DEFAULT_APPROVED_MESSAGE,
                canApply: false,
                canOpenAdminPortal: true
            };
        }

        if (status === "pending") {
            return {
                key: "pending",
                message: DEFAULT_PENDING_MESSAGE,
                canApply: false,
                canOpenAdminPortal: false
            };
        }

        if (status === "blocked") {
            return {
                key: "blocked",
                message: DEFAULT_BLOCKED_MESSAGE,
                canApply: false,
                canOpenAdminPortal: false
            };
        }

        if (status === "rejected") {
            return {
                key: "rejected",
                message: DEFAULT_REJECTED_MESSAGE,
                canApply: true,
                canOpenAdminPortal: false
            };
        }

        return {
            key: "none",
            message: DEFAULT_STATUS_MESSAGE,
            canApply: true,
            canOpenAdminPortal: false
        };
    }

    function createAdminApplicationPage(dependencies) {
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
            const statusElement = getElement("admin-application-status");

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
            const noteElement = getElement("admin-application-note");

            if (!noteElement) {
                return;
            }

            noteElement.textContent = message || "";
        }

        function getFormElements() {
            return {
                form: getElement("admin-application-form"),
                formSection: getElement("admin-application-form-section"),
                departmentInput: getElement("admin-department"),
                emailInput: getElement("admin-email"),
                motivationInput: getElement("admin-motivation"),
                confirmInput: getElement("admin-confirm-checkbox"),
                submitButton: getElement("submit-admin-application-button"),
                resetButton: getElement("reset-admin-application-button"),
                adminPortalButton: getElement("go-admin-portal-button"),
                backButton: getElement("back-button")
            };
        }

        function getFieldMap() {
            const elements = getFormElements();

            return {
                department: elements.departmentInput,
                email: elements.emailInput,
                motivation: elements.motivationInput,
                confirmed: elements.confirmInput
            };
        }

        function getErrorElement(fieldName) {
            return getElement(`admin-${fieldName}-error`);
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
            ["department", "email", "motivation", "confirmed"].forEach(function clearError(fieldName) {
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
                department: elements.departmentInput ? elements.departmentInput.value : "",
                email: elements.emailInput ? elements.emailInput.value : "",
                motivation: elements.motivationInput ? elements.motivationInput.value : "",
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

            if (elements.departmentInput) {
                elements.departmentInput.value = normalizeText(safeProfile.adminDepartment);
            }

            if (elements.emailInput) {
                elements.emailInput.value = normalizeText(safeProfile.email);
            }

            if (elements.motivationInput) {
                elements.motivationInput.value = normalizeText(safeProfile.adminMotivation);
            }
        }

        function updateSummary(profile) {
            const safeProfile = profile && typeof profile === "object" ? profile : {};

            const statusOutput = getElement("admin-status-output");
            const departmentOutput = getElement("admin-department-output");
            const emailOutput = getElement("admin-email-output");
            const motivationOutput = getElement("admin-motivation-output");
            const reasonOutput = getElement("admin-reason-output");

            if (statusOutput) {
                statusOutput.textContent = safeProfile.isAdmin === true
                    ? "approved"
                    : (normalizeText(safeProfile.adminApplicationStatus) || "none");
            }

            if (departmentOutput) {
                departmentOutput.textContent = normalizeText(safeProfile.adminDepartment) || "-";
            }

            if (emailOutput) {
                emailOutput.textContent = normalizeText(safeProfile.email) || "-";
            }

            if (motivationOutput) {
                motivationOutput.textContent = normalizeText(safeProfile.adminMotivation) || "-";
            }

            if (reasonOutput) {
                reasonOutput.textContent = normalizeText(safeProfile.adminApplicationReason) || "-";
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
                    : "Submit Admin Application";
            }

            if (elements.resetButton) {
                elements.resetButton.disabled = !viewModel.canApply || state.isSubmitting;
            }

            if (elements.adminPortalButton) {
                elements.adminPortalButton.hidden = !viewModel.canOpenAdminPortal;
                elements.adminPortalButton.disabled = !viewModel.canOpenAdminPortal;
            }

            if (elements.formSection) {
                elements.formSection.hidden = !viewModel.canApply && !state.isSubmitting;
            }

            if (viewModel.key === "approved") {
                setStatus(viewModel.message, "success");
                setNote("Your admin account is active. You can now open the admin portal.");
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
                    normalizeText(safeProfile.adminApplicationReason) ||
                    "Your admin access is blocked. Please contact support or admin."
                );
                return;
            }

            if (viewModel.key === "rejected") {
                setStatus(viewModel.message, "error");
                setNote(
                    normalizeText(safeProfile.adminApplicationReason) ||
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
                applyStatusView({ adminApplicationStatus: "none", isAdmin: false });
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

        async function saveAdminApplicationRecord(updates) {
            if (
                !db ||
                typeof firestoreFns.doc !== "function" ||
                typeof firestoreFns.setDoc !== "function"
            ) {
                return;
            }

            const applicationRef = firestoreFns.doc(
                db,
                "adminApplications",
                state.currentUser.uid
            );

            const payload = {
                uid: state.currentUser.uid,
                email: normalizeLowerText(state.currentProfile && state.currentProfile.email),
                isAdmin: false,
                adminApplicationStatus: "pending",
                adminApplicationReason: "",
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

            const applicationFields = getAdminApplicationFields(values);
            const updates = {
                email: normalizeLowerText(values.email),
                ...applicationFields,
                isAdmin: false,
                adminApplicationStatus: "pending",
                adminApplicationReason: ""
            };

            state.isSubmitting = true;
            applyStatusView({
                ...(state.currentProfile || {}),
                adminApplicationStatus: "none",
                isAdmin: false
            });
            setStatus("Submitting your admin application...", "loading");
            setNote("Please wait while we save your application.");

            try {
                if (typeof authService.updateCurrentUserProfile === "function") {
                    await authService.updateCurrentUserProfile(updates);
                } else if (typeof authService.updateUserProfile === "function") {
                    await authService.updateUserProfile(state.currentUser.uid, updates);
                } else {
                    throw new Error("No supported profile update method was provided.");
                }

                await saveAdminApplicationRecord(updates);

                state.currentProfile = {
                    ...(state.currentProfile || {}),
                    ...updates,
                    uid: state.currentUser.uid
                };

                fillFormFromProfile(state.currentProfile);
                updateSummary(state.currentProfile);

                state.currentProfile.isAdmin = false;
                state.currentProfile.adminApplicationStatus = "pending";
                applyStatusView(state.currentProfile);

                setStatus(DEFAULT_PENDING_MESSAGE, "info");
                setNote("Your admin application has been submitted and is now pending review.");

                return {
                    success: true,
                    message: DEFAULT_PENDING_MESSAGE,
                    updates
                };
            } finally {
                state.isSubmitting = false;
                applyStatusView(state.currentProfile || { adminApplicationStatus: "none", isAdmin: false });
            }
        }

        function goBack() {
            window.location.href = "./index.html";
        }

        function goToAdminPortal() {
            window.location.href = "../admin/index.html";
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
                    const currentApplicationFields = getAdminApplicationFields(currentValues);

                    updateSummary({
                        ...(state.currentProfile || {}),
                        ...currentApplicationFields,
                        email: normalizeLowerText(currentValues.email)
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
                            adminDepartment: "",
                            adminMotivation: "",
                            email: ""
                        });

                        setStatus(DEFAULT_STATUS_MESSAGE, "info");
                        setNote("The form has been cleared.");
                    }, 0);
                });
            }

            if (elements.backButton) {
                elements.backButton.addEventListener("click", goBack);
            }

            if (elements.adminPortalButton) {
                elements.adminPortalButton.addEventListener("click", goToAdminPortal);
            }

            bindLiveValidation();
        }

        async function initializeAdminApplicationPage() {
            bindEvents();

            try {
                await loadCurrentProfile();
            } catch (error) {
                setStatus("Unable to load your admin application details.", "error");
                setNote("Please refresh the page and try again.");
            }
        }

        return {
            initializeAdminApplicationPage,
            helpers: {
                normalizeText,
                normalizeLowerText,
                getSafeUserProfile,
                getAdminApplicationFields,
                validateApplicationForm,
                getStatusViewModel
            }
        };
    }

    if (typeof module !== "undefined" && module.exports) {
        module.exports = {
            normalizeText,
            normalizeLowerText,
            getSafeUserProfile,
            getAdminApplicationFields,
            validateApplicationForm,
            getStatusViewModel,
            createAdminApplicationPage
        };
    }

    if (typeof globalScope !== "undefined") {
        globalScope.adminApplicationPage = {
            initializeAdminApplicationPage: async function initializeAdminApplicationPage(dependencies) {
                const page = createAdminApplicationPage(dependencies);
                globalScope.adminApplicationPage.instance = page;
                return page.initializeAdminApplicationPage();
            }
        };
    }
})(typeof window !== "undefined" ? window : globalThis);
