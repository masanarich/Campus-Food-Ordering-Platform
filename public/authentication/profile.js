/**
 * profile.js
 *
 * Signed-in profile page logic for the Campus Food Ordering Platform.
 * This file:
 * - loads the authenticated user's profile
 * - renders account, access, and application information
 * - supports back navigation and sign out
 * - supports profile photo preview, upload, and removal
 * - supports account deletion with explicit confirmation
 *
 * Canonical access fields:
 * - isAdmin
 * - vendorStatus
 * - adminApplicationStatus
 * - accountStatus
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeVendorStatus(status) {
    const value = normalizeText(status).toLowerCase();

    if (value === "suspended") {
        return "blocked";
    }

    if (
        value === "none" ||
        value === "pending" ||
        value === "approved" ||
        value === "rejected" ||
        value === "blocked"
    ) {
        return value;
    }

    return "none";
}

function normalizeAdminApplicationStatus(status, isAdmin = false) {
    const value = normalizeText(status).toLowerCase();

    if (isAdmin === true) {
        return "approved";
    }

    if (value === "suspended") {
        return "blocked";
    }

    if (
        value === "none" ||
        value === "pending" ||
        value === "approved" ||
        value === "rejected" ||
        value === "blocked"
    ) {
        return value;
    }

    return "none";
}

function normalizeAccountStatus(status) {
    const value = normalizeText(status).toLowerCase();

    if (value === "disabled" || value === "blocked") {
        return value;
    }

    return "active";
}

function resolveAuthUtils(explicitUtils) {
    if (explicitUtils) {
        return explicitUtils;
    }

    if (typeof window !== "undefined" && window.authUtils) {
        return window.authUtils;
    }

    return null;
}

function normalizeUserProfile(profile, authUtils) {
    if (authUtils && typeof authUtils.normaliseUserData === "function") {
        return authUtils.normaliseUserData(profile);
    }

    if (authUtils && typeof authUtils.normalizeUserData === "function") {
        return authUtils.normalizeUserData(profile);
    }

    const safeProfile = profile && typeof profile === "object" ? profile : {};
    const isAdmin = safeProfile.isAdmin === true || safeProfile.admin === true;

    return {
        uid: normalizeText(safeProfile.uid),
        displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
        email: normalizeText(safeProfile.email).toLowerCase(),
        phoneNumber: normalizeText(safeProfile.phoneNumber),
        photoURL: normalizeText(safeProfile.photoURL),
        isAdmin,
        vendorStatus: normalizeVendorStatus(safeProfile.vendorStatus),
        vendorReason: normalizeText(
            safeProfile.vendorReason ||
            safeProfile.rejectionReason ||
            safeProfile.blockReason
        ),
        adminApplicationStatus: normalizeAdminApplicationStatus(
            safeProfile.adminApplicationStatus,
            isAdmin
        ),
        adminApplicationReason: normalizeText(
            safeProfile.adminApplicationReason ||
            safeProfile.adminRejectionReason ||
            safeProfile.adminBlockReason
        ),
        accountStatus: normalizeAccountStatus(safeProfile.accountStatus)
    };
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

function clearStatusMessage(statusElement) {
    setStatusMessage(statusElement, "", "");
}

function setButtonState(button, isDisabled) {
    if (!button) {
        return;
    }

    button.disabled = !!isDisabled;
}

function setElementHidden(element, isHidden) {
    if (!element) {
        return;
    }

    element.hidden = !!isHidden;
    element.setAttribute("aria-hidden", isHidden ? "true" : "false");
}

function setImageSource(imageElement, src, fallbackAlt = "Profile picture") {
    if (!imageElement) {
        return;
    }

    const normalizedSource = normalizeText(src);
    imageElement.alt = fallbackAlt;

    if (normalizedSource) {
        imageElement.src = normalizedSource;
        imageElement.hidden = false;
        return;
    }

    imageElement.removeAttribute("src");
    imageElement.hidden = true;
}

function clearFileInput(fileInput) {
    if (!fileInput) {
        return;
    }

    fileInput.value = "";
}

function hasAuthenticatedIdentity(profile) {
    const safeProfile = profile && typeof profile === "object" ? profile : {};

    return (
        normalizeText(safeProfile.uid).length > 0 ||
        normalizeText(safeProfile.email).length > 0 ||
        normalizeText(safeProfile.phoneNumber).length > 0
    );
}

function getRoleLabel(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (safeProfile.isAdmin === true && safeProfile.vendorStatus === "approved") {
        return "Admin and Vendor";
    }

    if (safeProfile.isAdmin === true) {
        return "Admin";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Vendor";
    }

    return "Customer";
}

function getVendorStatusLabel(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "pending") {
        return "Pending";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Approved";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return "Rejected";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return "Blocked";
    }

    return "Not Applied";
}

function getAdminStatusLabel(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (safeProfile.isAdmin === true) {
        return "Approved";
    }

    if (safeProfile.adminApplicationStatus === "pending") {
        return "Pending";
    }

    if (safeProfile.adminApplicationStatus === "rejected") {
        return "Rejected";
    }

    if (safeProfile.adminApplicationStatus === "blocked") {
        return "Blocked";
    }

    return "Not Applied";
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

function getPhoneNumber(profile, user) {
    if (profile && normalizeText(profile.phoneNumber)) {
        return profile.phoneNumber;
    }

    if (user && normalizeText(user.phoneNumber)) {
        return user.phoneNumber;
    }

    return "";
}

function getPhotoURL(profile, user) {
    if (profile && normalizeText(profile.photoURL)) {
        return profile.photoURL;
    }

    if (user && normalizeText(user.photoURL)) {
        return user.photoURL;
    }

    return "";
}

function getAvailablePortals(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (authUtils && typeof authUtils.getAvailablePortals === "function") {
        return authUtils.getAvailablePortals(safeProfile);
    }

    const portals = [];

    if (safeProfile.accountStatus === "active" && hasAuthenticatedIdentity(safeProfile)) {
        portals.push("customer");
    }

    if (safeProfile.accountStatus === "active" && safeProfile.vendorStatus === "approved") {
        portals.push("vendor");
    }

    if (safeProfile.accountStatus === "active" && safeProfile.isAdmin === true) {
        portals.push("admin");
    }

    return portals;
}

function capitalize(value) {
    const text = normalizeText(value);

    if (!text) {
        return "";
    }

    return text.charAt(0).toUpperCase() + text.slice(1);
}

function getPortalAccessLabel(profile, authUtils) {
    const portals = getAvailablePortals(profile, authUtils);

    if (portals.length === 3) {
        return "Customer, Vendor, and Admin";
    }

    if (portals.length === 2) {
        return `${capitalize(portals[0])} and ${capitalize(portals[1])}`;
    }

    if (portals.length === 1) {
        return capitalize(portals[0]);
    }

    return "None";
}

function getVendorStatusNote(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (safeProfile.vendorStatus === "pending") {
        return "Your vendor application is pending review.";
    }

    if (safeProfile.vendorStatus === "approved") {
        return "Your vendor access is active.";
    }

    if (safeProfile.vendorStatus === "rejected") {
        return safeProfile.vendorReason
            ? `Vendor application rejected: ${safeProfile.vendorReason}`
            : "Vendor application rejected.";
    }

    if (safeProfile.vendorStatus === "blocked") {
        return safeProfile.vendorReason
            ? `Vendor access blocked: ${safeProfile.vendorReason}`
            : "Vendor access is blocked.";
    }

    return "You have not applied for vendor access yet.";
}

function getAdminStatusNote(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (safeProfile.isAdmin === true) {
        return "Your admin access is active.";
    }

    if (safeProfile.adminApplicationStatus === "pending") {
        return "Your admin application is pending review.";
    }

    if (safeProfile.adminApplicationStatus === "rejected") {
        return safeProfile.adminApplicationReason
            ? `Admin application rejected: ${safeProfile.adminApplicationReason}`
            : "Admin application rejected.";
    }

    if (safeProfile.adminApplicationStatus === "blocked") {
        return safeProfile.adminApplicationReason
            ? `Admin application blocked: ${safeProfile.adminApplicationReason}`
            : "Admin application is blocked.";
    }

    return "You have not applied for admin access yet.";
}

function canRemovePhoto(profile, user) {
    return normalizeText(getPhotoURL(profile, user)).length > 0;
}

function getProfileFormValues(formElements = {}) {
    return {
        displayName: normalizeText(
            formElements.displayNameInput && formElements.displayNameInput.value
        ),
        phoneNumber: normalizeText(
            formElements.phoneInput && formElements.phoneInput.value
        )
    };
}

function validatePhoneNumber(phoneNumber, authUtils) {
    const normalizedPhoneNumber = normalizeText(phoneNumber).replace(/\s+/g, "");

    if (!normalizedPhoneNumber) {
        return "";
    }

    if (
        authUtils &&
        typeof authUtils.isValidPhoneNumber === "function" &&
        !authUtils.isValidPhoneNumber(normalizedPhoneNumber)
    ) {
        return "Please enter a valid phone number.";
    }

    if (!/^\+?[0-9]{10,15}$/.test(normalizedPhoneNumber)) {
        return "Please enter a valid phone number.";
    }

    return "";
}

function validateProfileForm(values, authUtils) {
    const safeValues = values && typeof values === "object" ? values : {};
    const errors = {};

    if (!normalizeText(safeValues.displayName)) {
        errors.displayName = "Please enter your name.";
    }

    const phoneError = validatePhoneNumber(safeValues.phoneNumber, authUtils);
    if (phoneError) {
        errors.phoneNumber = phoneError;
    }

    return {
        isValid: Object.keys(errors).length === 0,
        errors
    };
}

function setFieldError(field, errorElement, message) {
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

function clearProfileFormErrors(formElements = {}) {
    setFieldError(
        formElements.displayNameInput,
        formElements.displayNameErrorElement,
        ""
    );
    setFieldError(
        formElements.phoneInput,
        formElements.phoneErrorElement,
        ""
    );
}

function showProfileFormErrors(formElements = {}, errors = {}) {
    clearProfileFormErrors(formElements);
    setFieldError(
        formElements.displayNameInput,
        formElements.displayNameErrorElement,
        errors.displayName || ""
    );
    setFieldError(
        formElements.phoneInput,
        formElements.phoneErrorElement,
        errors.phoneNumber || ""
    );
}

function populateProfileForm(formElements = {}, profile = {}, user = null) {
    if (formElements.displayNameInput) {
        formElements.displayNameInput.value = getDisplayName(profile, user);
    }

    if (formElements.phoneInput) {
        formElements.phoneInput.value = getPhoneNumber(profile, user);
    }
}

function renderProfile(profileElements, profile, user, authUtils) {
    const elements = profileElements || {};
    const safeProfile = normalizeUserProfile(profile, authUtils);
    const displayName = getDisplayName(safeProfile, user);

    setTextContent(elements.nameElement, displayName);
    setTextContent(elements.emailElement, getEmail(safeProfile, user));
    setTextContent(elements.phoneElement, getPhoneNumber(safeProfile, user), "Not provided");
    setTextContent(elements.roleElement, getRoleLabel(safeProfile, authUtils));
    setTextContent(elements.accessElement, getPortalAccessLabel(safeProfile, authUtils));
    setTextContent(elements.accountStatusElement, capitalize(safeProfile.accountStatus));
    setTextContent(elements.vendorStatusElement, getVendorStatusLabel(safeProfile, authUtils));
    setTextContent(elements.adminStatusElement, getAdminStatusLabel(safeProfile, authUtils));
    setTextContent(elements.vendorNoteElement, getVendorStatusNote(safeProfile, authUtils), "None");
    setTextContent(elements.adminNoteElement, getAdminStatusNote(safeProfile, authUtils), "None");

    setImageSource(
        elements.photoElement,
        getPhotoURL(safeProfile, user),
        `${displayName || "User"} profile picture`
    );

    if (elements.photoCaptionElement) {
        setTextContent(
            elements.photoCaptionElement,
            canRemovePhoto(safeProfile, user)
                ? "Your current profile picture is shown here."
                : "No profile picture has been uploaded yet."
        );
    }

    if (elements.removePhotoButton) {
        setElementHidden(elements.removePhotoButton, !canRemovePhoto(safeProfile, user));
    }
}

async function saveCurrentUserProfile(dependencies = {}) {
    const authService = dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies.authUtils);
    const profileUpdates = dependencies.profileUpdates || {};

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    const user = await waitForAuthenticatedUser(authService);

    if (!user || !user.uid) {
        return {
            success: false,
            message: "No user is currently signed in."
        };
    }

    const safeUpdates = {
        displayName: normalizeText(profileUpdates.displayName),
        phoneNumber: normalizeText(profileUpdates.phoneNumber)
    };

    const validation = validateProfileForm(safeUpdates, authUtils);
    if (!validation.isValid) {
        const firstError = Object.values(validation.errors)[0] || "Please correct the highlighted fields.";
        return {
            success: false,
            message: firstError,
            errors: validation.errors
        };
    }

    if (typeof authService.updateCurrentUserProfile === "function") {
        const profile = await authService.updateCurrentUserProfile(safeUpdates);
        return {
            success: true,
            message: "Profile details updated.",
            profile
        };
    }

    if (typeof authService.updateUserProfile === "function") {
        await authService.updateUserProfile(user.uid, safeUpdates);
        return {
            success: true,
            message: "Profile details updated.",
            profile: {
                uid: user.uid,
                ...safeUpdates
            }
        };
    }

    throw new Error("A supported profile update method is required.");
}

function getFallbackRoutes(authUtils) {
    if (authUtils && authUtils.PORTAL_ROUTES) {
        return {
            customer: authUtils.PORTAL_ROUTES.customer || "../customer/index.html",
            vendor: authUtils.PORTAL_ROUTES.vendor || "../vendor/index.html",
            admin: authUtils.PORTAL_ROUTES.admin || "../admin/index.html",
            roleChoice: authUtils.PORTAL_ROUTES.roleChoice || "../authentication/role-choice.html",
            login: authUtils.PORTAL_ROUTES.login || "../authentication/login.html"
        };
    }

    return {
        customer: "../customer/index.html",
        vendor: "../vendor/index.html",
        admin: "../admin/index.html",
        roleChoice: "../authentication/role-choice.html",
        login: "../authentication/login.html"
    };
}

function mapBackTargetToRoute(target, authUtils) {
    const value = normalizeText(target).toLowerCase();
    const routes = getFallbackRoutes(authUtils);

    if (!value) {
        return "";
    }

    if (value === "customer" || value === routes.customer.toLowerCase()) {
        return routes.customer;
    }

    if (value === "vendor" || value === routes.vendor.toLowerCase()) {
        return routes.vendor;
    }

    if (value === "admin" || value === routes.admin.toLowerCase()) {
        return routes.admin;
    }

    if (
        value === "role-choice" ||
        value === "rolechoice" ||
        value === routes.roleChoice.toLowerCase()
    ) {
        return routes.roleChoice;
    }

    if (value === "login" || value === routes.login.toLowerCase()) {
        return routes.login;
    }

    return "";
}

function getBackRouteFromQuery(authUtils) {
    if (typeof window === "undefined" || !window.location || !window.location.search) {
        return "";
    }

    const params = new URLSearchParams(window.location.search);
    const candidate =
        params.get("backTo") ||
        params.get("back") ||
        params.get("from");

    return mapBackTargetToRoute(candidate, authUtils);
}

function getBackRouteFromReferrer(authUtils) {
    if (typeof document === "undefined") {
        return "";
    }

    const referrer = normalizeText(document.referrer);

    if (!referrer) {
        return "";
    }

    try {
        const referrerUrl = new URL(referrer);
        const currentOrigin =
            typeof window !== "undefined" && window.location
                ? window.location.origin
                : "";

        if (currentOrigin && referrerUrl.origin !== currentOrigin) {
            return "";
        }

        const path = referrerUrl.pathname.toLowerCase();
        const routes = getFallbackRoutes(authUtils);

        if (path.endsWith("/customer/index.html") || path.endsWith("/customer/")) {
            return routes.customer;
        }

        if (path.endsWith("/vendor/index.html") || path.endsWith("/vendor/")) {
            return routes.vendor;
        }

        if (path.endsWith("/admin/index.html") || path.endsWith("/admin/")) {
            return routes.admin;
        }

        if (path.endsWith("/authentication/role-choice.html")) {
            return routes.roleChoice;
        }

        if (path.endsWith("/authentication/login.html")) {
            return routes.login;
        }
    } catch (error) {
        return "";
    }

    return "";
}

function getDefaultBackRoute(profile, authUtils) {
    const routes = getFallbackRoutes(authUtils);
    const portals = getAvailablePortals(profile, authUtils);

    if (portals.length > 1) {
        return routes.roleChoice;
    }

    if (portals.length === 1) {
        return mapBackTargetToRoute(portals[0], authUtils) || routes.customer;
    }

    return routes.login;
}

function getBackRoute(profile, authUtils, explicitBackRoute = "") {
    const explicitRoute = mapBackTargetToRoute(explicitBackRoute, authUtils);

    if (explicitRoute) {
        return explicitRoute;
    }

    const queryRoute = getBackRouteFromQuery(authUtils);
    if (queryRoute) {
        return queryRoute;
    }

    const referrerRoute = getBackRouteFromReferrer(authUtils);
    if (referrerRoute) {
        return referrerRoute;
    }

    return getDefaultBackRoute(profile, authUtils);
}

function getFriendlyErrorMessage(error, authUtils, fallbackMessage) {
    const fallback = fallbackMessage || "Something went wrong. Please try again.";

    if (!error) {
        return fallback;
    }

    const code = normalizeText(error.code);

    if (code === "auth/requires-recent-login") {
        return "Please sign in again before performing this sensitive action.";
    }

    if (authUtils && typeof authUtils.mapAuthErrorCode === "function" && code) {
        return authUtils.mapAuthErrorCode(code);
    }

    return normalizeText(error.message) || fallback;
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
        let unsubscribe = null;

        unsubscribe = authService.observeAuthState((user) => {
            if (typeof unsubscribe === "function") {
                unsubscribe();
            }

            resolve(user || null);
        });
    });
}

async function loadCurrentUserProfile(dependencies) {
    const authService = dependencies && dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies && dependencies.authUtils);

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
    const normalizedProfile = normalizeUserProfile(profile || {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        photoURL: user.photoURL || ""
    }, authUtils);

    return {
        success: true,
        user,
        profile: normalizedProfile
    };
}

async function signOutCurrentUser(dependencies) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.signOutUser !== "function") {
        throw new Error("authService.signOutUser is required.");
    }

    await authService.signOutUser();

    return {
        success: true,
        message: "You have been signed out."
    };
}

function isImageFile(file) {
    return !!(file && typeof file.type === "string" && file.type.startsWith("image/"));
}

function readFileAsDataURL(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();

        reader.onload = function handleLoad() {
            resolve(typeof reader.result === "string" ? reader.result : "");
        };

        reader.onerror = function handleError() {
            reject(new Error("Unable to read the selected file."));
        };

        reader.readAsDataURL(file);
    });
}

function getSelectedPhotoFile(fileInput) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return null;
    }

    return fileInput.files[0] || null;
}

async function previewSelectedPhoto(options = {}) {
    const fileInput = options.fileInput;
    const profileElements = options.profileElements || {};
    const photoMessageElement = options.photoMessageElement || null;
    const file = getSelectedPhotoFile(fileInput);

    if (!file) {
        const message = "Choose a photo first.";
        setStatusMessage(photoMessageElement, message, "error");
        return {
            success: false,
            message
        };
    }

    if (!isImageFile(file)) {
        const message = "Please choose a valid image file.";
        setStatusMessage(photoMessageElement, message, "error");
        return {
            success: false,
            message
        };
    }

    const dataUrl = await readFileAsDataURL(file);

    setImageSource(profileElements.photoElement, dataUrl, "Profile picture preview");

    if (profileElements.photoCaptionElement) {
        setTextContent(profileElements.photoCaptionElement, "This is a preview of the photo you selected.");
    }

    setStatusMessage(photoMessageElement, "Photo preview updated.", "success");

    return {
        success: true,
        dataUrl
    };
}

async function uploadSelectedPhoto(options = {}) {
    const authService = options.authService;
    const fileInput = options.fileInput;

    if (!authService) {
        throw new Error("authService is required.");
    }

    const file = getSelectedPhotoFile(fileInput);

    if (!file) {
        return {
            success: false,
            message: "Choose a photo first."
        };
    }

    if (!isImageFile(file)) {
        return {
            success: false,
            message: "Please choose a valid image file."
        };
    }

    if (typeof authService.uploadCurrentUserPhoto === "function") {
        const profile = await authService.uploadCurrentUserPhoto(file);
        return {
            success: true,
            message: "Profile photo updated.",
            profile
        };
    }

    if (typeof authService.setCurrentUserPhotoURL === "function") {
        const dataUrl = await readFileAsDataURL(file);
        const profile = await authService.setCurrentUserPhotoURL(dataUrl);

        return {
            success: true,
            message: "Profile photo updated.",
            profile
        };
    }

    throw new Error("A supported photo upload method is required.");
}

async function removeCurrentUserPhotoAction(options = {}) {
    const authService = options.authService;

    if (!authService || typeof authService.removeCurrentUserPhoto !== "function") {
        throw new Error("authService.removeCurrentUserPhoto is required.");
    }

    const profile = await authService.removeCurrentUserPhoto();

    return {
        success: true,
        message: "Profile photo removed.",
        profile
    };
}

async function deleteCurrentUserAccountAction(options = {}) {
    const authService = options.authService;

    if (!authService || typeof authService.deleteCurrentUserAccount !== "function") {
        throw new Error("authService.deleteCurrentUserAccount is required.");
    }

    await authService.deleteCurrentUserAccount();

    return {
        success: true,
        message: "Your account has been deleted."
    };
}

async function initializeProfileView(options = {}) {
    const authService = options.authService;
    const authUtils = resolveAuthUtils(options.authUtils);
    const statusElement = options.statusElement;
    const profileElements = options.profileElements || {};
    const formElements = options.formElements || {};

    setStatusMessage(statusElement, "Loading profile...", "loading");

    try {
        const result = await loadCurrentUserProfile({
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(statusElement, result.message || "Unable to load profile.", "error");
            return result;
        }

        renderProfile(profileElements, result.profile, result.user, authUtils);
        populateProfileForm(formElements, result.profile, result.user);
        setStatusMessage(statusElement, "Profile loaded.", "success");

        return result;
    } catch (error) {
        const message = getFriendlyErrorMessage(
            error,
            authUtils,
            "Unable to load profile."
        );

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

        setButtonState(button, true);
        setStatusMessage(statusElement, "Signing you out...", "loading");

        try {
            const result = await signOutCurrentUser({
                authService
            });

            setButtonState(button, false);
            setStatusMessage(statusElement, result.message || "You have been signed out.", "success");

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            if (typeof navigate === "function") {
                navigate("../authentication/login.html");
            }

            return result;
        } catch (error) {
            setButtonState(button, false);
            const message = normalizeText(error && error.message) || "Unable to sign out right now.";
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

function attachSaveProfileHandler(options) {
    const {
        button,
        authService,
        authUtils,
        statusElement,
        formElements,
        refreshProfile,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        return null;
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        const values = getProfileFormValues(formElements);
        const validation = validateProfileForm(values, authUtils);

        if (!validation.isValid) {
            showProfileFormErrors(formElements, validation.errors);
            const message = Object.values(validation.errors)[0] || "Please correct the highlighted fields.";
            setStatusMessage(statusElement, message, "error");

            if (typeof onError === "function") {
                onError({
                    success: false,
                    message,
                    errors: validation.errors
                });
            }

            return {
                success: false,
                message,
                errors: validation.errors
            };
        }

        clearProfileFormErrors(formElements);
        setButtonState(button, true);
        setStatusMessage(statusElement, "Saving profile details...", "loading");

        try {
            const result = await saveCurrentUserProfile({
                authService,
                authUtils,
                profileUpdates: values
            });

            setButtonState(button, false);

            if (!result.success) {
                if (result.errors) {
                    showProfileFormErrors(formElements, result.errors);
                }

                setStatusMessage(statusElement, result.message || "Unable to save profile details.", "error");

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            if (typeof refreshProfile === "function") {
                await refreshProfile();
            }

            setStatusMessage(statusElement, result.message || "Profile details updated.", "success");

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            return result;
        } catch (error) {
            const message = getFriendlyErrorMessage(
                error,
                authUtils,
                "Unable to save profile details."
            );

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

function attachBackHandler(options) {
    const {
        button,
        statusElement,
        navigate,
        resolveBackRoute,
        onSuccess
    } = options || {};

    if (!button) {
        throw new Error("A back button is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setStatusMessage(statusElement, "Going back...", "info");
        const nextRoute =
            typeof resolveBackRoute === "function"
                ? await resolveBackRoute()
                : "../customer/index.html";

        if (typeof onSuccess === "function") {
            onSuccess(nextRoute);
        }

        if (typeof navigate === "function") {
            navigate(nextRoute);
        }

        return {
            success: true,
            nextRoute
        };
    }

    button.addEventListener("click", handleClick);

    return {
        handleClick
    };
}

function attachPhotoInputPreviewHandler(options) {
    const {
        fileInput,
        profileElements,
        photoMessageElement,
        onSuccess,
        onError
    } = options || {};

    if (!fileInput) {
        return null;
    }

    async function handleChange() {
        try {
            const result = await previewSelectedPhoto({
                fileInput,
                profileElements,
                photoMessageElement
            });

            if (!result.success && typeof onError === "function") {
                onError(result);
            }

            if (result.success && typeof onSuccess === "function") {
                onSuccess(result);
            }

            return result;
        } catch (error) {
            const message = normalizeText(error && error.message) ||
                "Unable to preview the selected image.";
            setStatusMessage(photoMessageElement, message, "error");

            if (typeof onError === "function") {
                onError(error);
            }

            return {
                success: false,
                message
            };
        }
    }

    fileInput.addEventListener("change", handleChange);

    return {
        handleChange
    };
}

function attachUploadPhotoHandler(options) {
    const {
        button,
        fileInput,
        authService,
        authUtils,
        photoMessageElement,
        profileElements,
        refreshProfile,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        return null;
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setButtonState(button, true);
        clearStatusMessage(photoMessageElement);

        try {
            const result = await uploadSelectedPhoto({
                authService,
                fileInput
            });

            setButtonState(button, false);

            if (!result.success) {
                setStatusMessage(
                    photoMessageElement,
                    result.message || "Unable to upload the selected photo.",
                    "error"
                );

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            clearFileInput(fileInput);

            if (typeof refreshProfile === "function") {
                await refreshProfile();
            } else {
                renderProfile(profileElements, result.profile || {}, null, authUtils);
            }

            setStatusMessage(
                photoMessageElement,
                result.message || "Profile photo updated.",
                "success"
            );

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            return result;
        } catch (error) {
            const message = getFriendlyErrorMessage(
                error,
                authUtils,
                "Unable to upload the selected photo."
            );

            setButtonState(button, false);
            setStatusMessage(photoMessageElement, message, "error");

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

function attachRemovePhotoHandler(options) {
    const {
        button,
        authService,
        authUtils,
        photoMessageElement,
        profileElements,
        fileInput,
        refreshProfile,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        return null;
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setButtonState(button, true);
        clearStatusMessage(photoMessageElement);

        try {
            const result = await removeCurrentUserPhotoAction({
                authService
            });

            setButtonState(button, false);
            clearFileInput(fileInput);

            if (typeof refreshProfile === "function") {
                await refreshProfile();
            } else {
                renderProfile(profileElements, result.profile || {}, null, authUtils);
            }

            setStatusMessage(
                photoMessageElement,
                result.message || "Profile photo removed.",
                "success"
            );

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            return result;
        } catch (error) {
            const message = getFriendlyErrorMessage(
                error,
                authUtils,
                "Unable to remove the profile photo."
            );

            setButtonState(button, false);
            setStatusMessage(photoMessageElement, message, "error");

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

function attachDeleteAccountHandler(options) {
    const {
        button,
        authService,
        authUtils,
        accountMessageElement,
        confirmationCheckbox,
        navigate,
        confirmAction,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        return null;
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    const resolvedConfirm =
        typeof confirmAction === "function"
            ? confirmAction
            : function confirmDelete(message) {
                return typeof window !== "undefined" ? window.confirm(message) : true;
            };

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        if (confirmationCheckbox && confirmationCheckbox.checked !== true) {
            const message = "Please confirm that you understand account deletion is permanent.";
            setStatusMessage(accountMessageElement, message, "error");
            return {
                success: false,
                message
            };
        }

        const confirmed = await resolvedConfirm(
            "Delete your account permanently? This action cannot be undone."
        );

        if (!confirmed) {
            return {
                success: false,
                message: "Account deletion was cancelled."
            };
        }

        setButtonState(button, true);
        clearStatusMessage(accountMessageElement);

        try {
            const result = await deleteCurrentUserAccountAction({
                authService
            });

            setButtonState(button, false);
            setStatusMessage(
                accountMessageElement,
                result.message || "Your account has been deleted.",
                "success"
            );

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            if (typeof navigate === "function") {
                navigate("../index.html");
            }

            return result;
        } catch (error) {
            const message = getFriendlyErrorMessage(
                error,
                authUtils,
                "Unable to delete the account right now."
            );

            setButtonState(button, false);
            setStatusMessage(accountMessageElement, message, "error");

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

function attachDeleteConfirmationToggle(options = {}) {
    const checkbox = options.checkbox;
    const button = options.button;

    if (!checkbox || !button) {
        return null;
    }

    function syncButtonState() {
        setButtonState(button, checkbox.checked !== true);
        return checkbox.checked === true;
    }

    checkbox.addEventListener("change", syncButtonState);
    syncButtonState();

    return {
        syncButtonState
    };
}

function initializeProfilePage(options = {}) {
    const authService =
        options.authService ||
        (typeof window !== "undefined" ? window.authService : undefined);

    const authUtils = resolveAuthUtils(options.authUtils);

    const {
        statusSelector = "#profile-status",
        nameSelector = "#profile-name",
        emailSelector = "#profile-email",
        phoneSelector = "#profile-phone",
        roleSelector = "#profile-role",
        accessSelector = "#profile-access",
        accountStatusSelector = "#profile-account-status",
        vendorStatusSelector = "#profile-vendor-status",
        adminStatusSelector = "#profile-admin-status",
        vendorNoteSelector = "#profile-vendor-note",
        adminNoteSelector = "#profile-admin-note",
        photoSelector = "#profile-photo",
        photoCaptionSelector = "#profile-photo-caption",
        profileEditFormSelector = "#profile-edit-form",
        displayNameInputSelector = "#profile-display-name-input",
        displayNameErrorSelector = "#profile-display-name-error",
        phoneInputSelector = "#profile-phone-input",
        phoneErrorSelector = "#profile-phone-error",
        saveProfileButtonSelector = "#save-profile-button",
        photoInputSelector = "#profile-photo-input",
        photoMessageSelector = "#profile-photo-message",
        accountMessageSelector = "#profile-account-message",
        signOutButtonSelector = "#signout-button",
        backButtonSelector = "#profile-back-button, #back-button, [data-profile-back]",
        uploadPhotoButtonSelector = "#upload-photo-button, [data-profile-upload-photo]",
        removePhotoButtonSelector = "#remove-photo-button, [data-profile-remove-photo]",
        deleteAccountButtonSelector = "#delete-account-button, [data-profile-delete-account]",
        deleteConfirmationCheckboxSelector = "#delete-account-confirm-checkbox",
        backRoute = "",
        navigate,
        confirmAction
    } = options;

    if (!authService) {
        throw new Error("authService is required.");
    }

    const statusElement = document.querySelector(statusSelector);
    const photoMessageElement = document.querySelector(photoMessageSelector);
    const accountMessageElement = document.querySelector(accountMessageSelector);
    const deleteConfirmationCheckbox = document.querySelector(deleteConfirmationCheckboxSelector);

    const profileElements = {
        nameElement: document.querySelector(nameSelector),
        emailElement: document.querySelector(emailSelector),
        phoneElement: document.querySelector(phoneSelector),
        roleElement: document.querySelector(roleSelector),
        accessElement: document.querySelector(accessSelector),
        accountStatusElement: document.querySelector(accountStatusSelector),
        vendorStatusElement: document.querySelector(vendorStatusSelector),
        adminStatusElement: document.querySelector(adminStatusSelector),
        vendorNoteElement: document.querySelector(vendorNoteSelector),
        adminNoteElement: document.querySelector(adminNoteSelector),
        photoElement: document.querySelector(photoSelector),
        photoCaptionElement: document.querySelector(photoCaptionSelector),
        removePhotoButton: document.querySelector(removePhotoButtonSelector)
    };

    const formElements = {
        form: document.querySelector(profileEditFormSelector),
        displayNameInput: document.querySelector(displayNameInputSelector),
        displayNameErrorElement: document.querySelector(displayNameErrorSelector),
        phoneInput: document.querySelector(phoneInputSelector),
        phoneErrorElement: document.querySelector(phoneErrorSelector)
    };

    const photoInput = document.querySelector(photoInputSelector);
    const saveProfileButton = document.querySelector(saveProfileButtonSelector);
    const signOutButton = document.querySelector(signOutButtonSelector);
    const backButton = document.querySelector(backButtonSelector);
    const uploadPhotoButton = document.querySelector(uploadPhotoButtonSelector);
    const removePhotoButton = profileElements.removePhotoButton;
    const deleteAccountButton = document.querySelector(deleteAccountButtonSelector);

    const resolvedNavigate =
        typeof navigate === "function"
            ? navigate
            : function goToRoute(nextRoute) {
                window.location.href = nextRoute;
            };

    let latestProfileResult = null;

    async function refreshProfile() {
        const result = await initializeProfileView({
            authService,
            authUtils,
            statusElement,
            profileElements,
            formElements
        });

        latestProfileResult = result;
        return result;
    }

    const profilePromise = refreshProfile();

    const saveProfileController = saveProfileButton
        ? attachSaveProfileHandler({
            button: saveProfileButton,
            authService,
            authUtils,
            statusElement,
            formElements,
            refreshProfile
        })
        : null;

    const signOutController = signOutButton
        ? attachSignOutHandler({
            button: signOutButton,
            authService,
            statusElement,
            navigate: resolvedNavigate
        })
        : null;

    const backController = backButton
        ? attachBackHandler({
            button: backButton,
            statusElement,
            navigate: resolvedNavigate,
            resolveBackRoute: async function resolveProfileBackRoute() {
                const result = latestProfileResult || await profilePromise;
                const profile = result && result.success ? result.profile : null;

                return getBackRoute(profile || {}, authUtils, backRoute);
            }
        })
        : null;

    const photoPreviewController = photoInput
        ? attachPhotoInputPreviewHandler({
            fileInput: photoInput,
            profileElements,
            photoMessageElement
        })
        : null;

    const uploadPhotoController = uploadPhotoButton
        ? attachUploadPhotoHandler({
            button: uploadPhotoButton,
            fileInput: photoInput,
            authService,
            authUtils,
            photoMessageElement,
            profileElements,
            refreshProfile
        })
        : null;

    const removePhotoController = removePhotoButton
        ? attachRemovePhotoHandler({
            button: removePhotoButton,
            authService,
            authUtils,
            photoMessageElement,
            profileElements,
            fileInput: photoInput,
            refreshProfile
        })
        : null;

    const deleteConfirmationController = deleteAccountButton
        ? attachDeleteConfirmationToggle({
            checkbox: deleteConfirmationCheckbox,
            button: deleteAccountButton
        })
        : null;

    const deleteAccountController = deleteAccountButton
        ? attachDeleteAccountHandler({
            button: deleteAccountButton,
            authService,
            authUtils,
            accountMessageElement,
            confirmationCheckbox: deleteConfirmationCheckbox,
            navigate: resolvedNavigate,
            confirmAction
        })
        : null;

    return {
        saveProfileController,
        signOutController,
        backController,
        photoPreviewController,
        uploadPhotoController,
        removePhotoController,
        deleteConfirmationController,
        deleteAccountController,
        profilePromise,
        refreshProfile
    };
}

const profilePage = {
    normalizeText,
    normalizeVendorStatus,
    normalizeAdminApplicationStatus,
    normalizeAccountStatus,
    resolveAuthUtils,
    normalizeUserProfile,
    setTextContent,
    setStatusMessage,
    clearStatusMessage,
    setButtonState,
    setElementHidden,
    setImageSource,
    clearFileInput,
    hasAuthenticatedIdentity,
    getRoleLabel,
    getVendorStatusLabel,
    getAdminStatusLabel,
    getDisplayName,
    getEmail,
    getPhoneNumber,
    getPhotoURL,
    getAvailablePortals,
    capitalize,
    getPortalAccessLabel,
    getVendorStatusNote,
    getAdminStatusNote,
    canRemovePhoto,
    getProfileFormValues,
    validatePhoneNumber,
    validateProfileForm,
    setFieldError,
    clearProfileFormErrors,
    showProfileFormErrors,
    populateProfileForm,
    renderProfile,
    getFallbackRoutes,
    mapBackTargetToRoute,
    getBackRouteFromQuery,
    getBackRouteFromReferrer,
    getDefaultBackRoute,
    getBackRoute,
    getFriendlyErrorMessage,
    waitForAuthenticatedUser,
    loadCurrentUserProfile,
    signOutCurrentUser,
    saveCurrentUserProfile,
    isImageFile,
    readFileAsDataURL,
    getSelectedPhotoFile,
    previewSelectedPhoto,
    uploadSelectedPhoto,
    removeCurrentUserPhotoAction,
    deleteCurrentUserAccountAction,
    initializeProfileView,
    attachSaveProfileHandler,
    attachSignOutHandler,
    attachBackHandler,
    attachPhotoInputPreviewHandler,
    attachUploadPhotoHandler,
    attachRemovePhotoHandler,
    attachDeleteConfirmationToggle,
    attachDeleteAccountHandler,
    initializeProfilePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = profilePage;
}

if (typeof window !== "undefined") {
    window.profilePage = profilePage;
}
