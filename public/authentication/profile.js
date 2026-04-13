/**
 * profile.js
 *
 * Profile page logic for the Campus Food Ordering Platform.
 * This file:
 * - loads the signed-in user's profile
 * - renders profile details into the page
 * - supports back navigation based on where the user came from
 * - supports sign out
 * - supports password reset email for the signed-in user
 * - supports leaving vendor status
 * - supports profile photo preview, upload fallback, and removal
 * - supports deleting the current account
 * - uses injected services so it stays easy to test
 * - can be used in the browser through initializeProfilePage(...)
 *
 * Canonical profile fields:
 * - isOwner
 * - isAdmin
 * - vendorStatus
 * - accountStatus
 *
 * Note:
 * - This version supports a browser-side image upload fallback by converting
 *   the chosen file into a compressed data URL and saving it as photoURL.
 * - That is okay for a small student project/demo, but Firebase Storage
 *   would be the better production approach later.
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
    const isOwner = safeProfile.isOwner === true || safeProfile.owner === true;
    const isAdmin =
        safeProfile.isAdmin === true ||
        safeProfile.admin === true ||
        isOwner === true;

    return {
        uid: normalizeText(safeProfile.uid),
        displayName: normalizeText(safeProfile.displayName || safeProfile.fullName),
        email: normalizeText(safeProfile.email).toLowerCase(),
        phoneNumber: normalizeText(safeProfile.phoneNumber),
        photoURL: normalizeText(safeProfile.photoURL),
        isOwner,
        isAdmin,
        vendorStatus: normalizeVendorStatus(safeProfile.vendorStatus),
        vendorReason: normalizeText(
            safeProfile.vendorReason ||
            safeProfile.rejectionReason ||
            safeProfile.blockReason
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

    if (safeProfile.isOwner === true) {
        return "Owner";
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
    const status = safeProfile.vendorStatus;

    if (status === "pending") {
        return "Pending";
    }

    if (status === "approved") {
        return "Approved";
    }

    if (status === "rejected") {
        return "Rejected";
    }

    if (status === "blocked") {
        return "Blocked";
    }

    return "None";
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

    if (
        safeProfile.accountStatus === "active" &&
        (hasAuthenticatedIdentity(safeProfile) || safeProfile.isAdmin || safeProfile.isOwner)
    ) {
        portals.push("customer");
    }

    if (
        safeProfile.accountStatus === "active" &&
        (safeProfile.isOwner === true || safeProfile.vendorStatus === "approved")
    ) {
        portals.push("vendor");
    }

    if (
        safeProfile.accountStatus === "active" &&
        (safeProfile.isOwner === true || safeProfile.isAdmin === true)
    ) {
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

function canLeaveVendor(profile, authUtils) {
    const safeProfile = normalizeUserProfile(profile, authUtils);

    if (safeProfile.isOwner === true) {
        return false;
    }

    return safeProfile.vendorStatus !== "none";
}

function canRemovePhoto(profile, user) {
    return normalizeText(getPhotoURL(profile, user)).length > 0;
}

function renderProfile(profileElements, profile, user, authUtils) {
    const elements = profileElements || {};
    const safeProfile = normalizeUserProfile(profile, authUtils);

    setTextContent(elements.nameElement, getDisplayName(safeProfile, user));
    setTextContent(elements.emailElement, getEmail(safeProfile, user));
    setTextContent(elements.roleElement, getRoleLabel(safeProfile, authUtils));
    setTextContent(elements.vendorStatusElement, getVendorStatusLabel(safeProfile, authUtils));
    setTextContent(elements.accessElement, getPortalAccessLabel(safeProfile, authUtils));
    setTextContent(elements.vendorReasonElement, safeProfile.vendorReason, "None");

    setImageSource(
        elements.photoElement,
        getPhotoURL(safeProfile, user),
        `${getDisplayName(safeProfile, user) || "User"} profile picture`
    );

    if (elements.leaveVendorButton) {
        setElementHidden(elements.leaveVendorButton, !canLeaveVendor(safeProfile, authUtils));
    }

    if (elements.removePhotoButton) {
        setElementHidden(elements.removePhotoButton, !canRemovePhoto(safeProfile, user));
    }
}

function getFallbackRoutes(authUtils) {
    if (authUtils && authUtils.PORTAL_ROUTES) {
        return authUtils.PORTAL_ROUTES;
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
    const safeProfile = normalizeUserProfile(profile, authUtils);
    const routes = getFallbackRoutes(authUtils);
    const portals = getAvailablePortals(safeProfile, authUtils);

    if (portals.length > 1) {
        return routes.roleChoice;
    }

    if (portals.length === 1) {
        const onlyPortal = portals[0];
        return mapBackTargetToRoute(onlyPortal, authUtils) || routes.customer;
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
        const unsubscribe = authService.observeAuthState((user) => {
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
        success: true
    };
}

async function sendSelfPasswordReset(dependencies) {
    const authService = dependencies && dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies && dependencies.authUtils);

    if (!authService || typeof authService.sendPasswordResetEmail !== "function") {
        throw new Error("authService.sendPasswordResetEmail is required.");
    }

    const result = await loadCurrentUserProfile({
        authService,
        authUtils
    });

    if (!result.success) {
        return result;
    }

    const email = getEmail(result.profile, result.user);

    if (!normalizeText(email)) {
        return {
            success: false,
            message: "No email address is available for this account."
        };
    }

    await authService.sendPasswordResetEmail({ email });

    return {
        success: true,
        message: "Password reset email sent."
    };
}

async function leaveVendorAccess(dependencies) {
    const authService = dependencies && dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies && dependencies.authUtils);

    if (!authService || typeof authService.getCurrentUser !== "function") {
        throw new Error("authService.getCurrentUser is required.");
    }

    if (!authService || typeof authService.getCurrentUserProfile !== "function") {
        throw new Error("authService.getCurrentUserProfile is required.");
    }

    if (!authService || typeof authService.updateUserProfile !== "function") {
        throw new Error("authService.updateUserProfile is required.");
    }

    const user = await waitForAuthenticatedUser(authService);

    if (!user || !user.uid) {
        return {
            success: false,
            message: "No user is currently signed in."
        };
    }

    const existingProfile = await authService.getCurrentUserProfile(user.uid);
    const safeProfile = normalizeUserProfile(existingProfile || {
        uid: user.uid,
        displayName: user.displayName || "",
        email: user.email || "",
        phoneNumber: user.phoneNumber || "",
        photoURL: user.photoURL || ""
    }, authUtils);

    if (safeProfile.isOwner === true) {
        return {
            success: false,
            message: "Owner access cannot be removed from the profile page."
        };
    }

    if (safeProfile.vendorStatus === "none") {
        return {
            success: false,
            message: "You are not currently marked as a vendor."
        };
    }

    await authService.updateUserProfile(user.uid, {
        vendorStatus: "none",
        vendorReason: ""
    });

    const updatedProfile = normalizeUserProfile({
        ...safeProfile,
        vendorStatus: "none",
        vendorReason: ""
    }, authUtils);

    return {
        success: true,
        message: "Vendor access removed.",
        profile: updatedProfile
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

function loadImageFromSource(src) {
    return new Promise((resolve, reject) => {
        const image = new Image();

        image.onload = function handleLoad() {
            resolve(image);
        };

        image.onerror = function handleError() {
            reject(new Error("Unable to process the selected image."));
        };

        image.src = src;
    });
}

async function fileToOptimizedDataURL(file, options = {}) {
    const safeOptions = options && typeof options === "object" ? options : {};
    const maxWidth = Number.isFinite(safeOptions.maxWidth) ? safeOptions.maxWidth : 512;
    const maxHeight = Number.isFinite(safeOptions.maxHeight) ? safeOptions.maxHeight : 512;
    const quality = Number.isFinite(safeOptions.quality) ? safeOptions.quality : 0.82;

    const originalDataUrl = await readFileAsDataURL(file);
    const image = await loadImageFromSource(originalDataUrl);

    const originalWidth = image.naturalWidth || image.width || maxWidth;
    const originalHeight = image.naturalHeight || image.height || maxHeight;

    let targetWidth = originalWidth;
    let targetHeight = originalHeight;

    const widthRatio = maxWidth / targetWidth;
    const heightRatio = maxHeight / targetHeight;
    const ratio = Math.min(widthRatio, heightRatio, 1);

    targetWidth = Math.max(1, Math.round(targetWidth * ratio));
    targetHeight = Math.max(1, Math.round(targetHeight * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = targetWidth;
    canvas.height = targetHeight;

    const context = canvas.getContext("2d");

    if (!context) {
        return originalDataUrl;
    }

    context.drawImage(image, 0, 0, targetWidth, targetHeight);

    const targetType =
        file.type === "image/png" || file.type === "image/webp"
            ? file.type
            : "image/jpeg";

    return canvas.toDataURL(targetType, quality);
}

function getSelectedPhotoFile(fileInput) {
    if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
        return null;
    }

    return fileInput.files[0];
}

async function previewSelectedPhoto(options = {}) {
    const {
        fileInput,
        profileElements,
        photoMessageElement
    } = options;

    const file = getSelectedPhotoFile(fileInput);

    if (!file) {
        setStatusMessage(photoMessageElement, "Choose a photo first.", "error");
        return {
            success: false,
            message: "Choose a photo first."
        };
    }

    if (!isImageFile(file)) {
        setStatusMessage(photoMessageElement, "Please choose an image file.", "error");
        return {
            success: false,
            message: "Please choose an image file."
        };
    }

    const previewDataUrl = await fileToOptimizedDataURL(file);

    setImageSource(
        profileElements && profileElements.photoElement,
        previewDataUrl,
        "Selected profile picture preview"
    );

    setStatusMessage(photoMessageElement, "Photo preview ready. Click Upload Photo to save it.", "info");

    return {
        success: true,
        previewDataUrl
    };
}

async function uploadSelectedPhoto(dependencies = {}) {
    const authService = dependencies && dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies && dependencies.authUtils);
    const fileInput = dependencies && dependencies.fileInput;

    if (!authService || typeof authService.setCurrentUserPhotoURL !== "function") {
        throw new Error("authService.setCurrentUserPhotoURL is required.");
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
            message: "Please choose an image file."
        };
    }

    if (file.size > 5 * 1024 * 1024) {
        return {
            success: false,
            message: "Please choose an image smaller than 5 MB."
        };
    }

    const photoDataUrl = await fileToOptimizedDataURL(file, {
        maxWidth: 512,
        maxHeight: 512,
        quality: 0.82
    });

    const updatedProfile = await authService.setCurrentUserPhotoURL(photoDataUrl);

    return {
        success: true,
        message: "Profile photo updated.",
        profile: normalizeUserProfile(updatedProfile, authUtils)
    };
}

async function removeCurrentUserPhotoAction(dependencies = {}) {
    const authService = dependencies && dependencies.authService;
    const authUtils = resolveAuthUtils(dependencies && dependencies.authUtils);

    if (!authService || typeof authService.removeCurrentUserPhoto !== "function") {
        throw new Error("authService.removeCurrentUserPhoto is required.");
    }

    const updatedProfile = await authService.removeCurrentUserPhoto();

    return {
        success: true,
        message: "Profile photo removed.",
        profile: normalizeUserProfile(updatedProfile, authUtils)
    };
}

async function deleteCurrentUserAccountAction(dependencies = {}) {
    const authService = dependencies && dependencies.authService;

    if (!authService || typeof authService.deleteCurrentUserAccount !== "function") {
        throw new Error("authService.deleteCurrentUserAccount is required.");
    }

    await authService.deleteCurrentUserAccount({
        deleteProfile: true
    });

    return {
        success: true,
        message: "Your account has been deleted."
    };
}

async function initializeProfileView(options) {
    const {
        authService,
        authUtils,
        statusElement,
        profileElements
    } = options || {};

    setStatusMessage(statusElement, "Loading profile...", "loading");

    try {
        const result = await loadCurrentUserProfile({
            authService,
            authUtils
        });

        if (!result.success) {
            setStatusMessage(statusElement, result.message, "error");
            return result;
        }

        renderProfile(profileElements, result.profile, result.user, authUtils);
        setStatusMessage(statusElement, "Profile loaded.", "success");

        return result;
    } catch (error) {
        const message = getFriendlyErrorMessage(
            error,
            authUtils,
            "Unable to load profile right now. Please try again."
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
        clearStatusMessage(statusElement);

        try {
            const result = await signOutCurrentUser({
                authService
            });

            setStatusMessage(statusElement, "Signed out successfully.", "success");
            setButtonState(button, false);

            if (typeof onSuccess === "function") {
                onSuccess(result);
            }

            if (typeof navigate === "function") {
                navigate("../index.html");
            }

            return result;
        } catch (error) {
            const message = normalizeText(error && error.message) ||
                "Unable to sign out right now. Please try again.";

            setStatusMessage(statusElement, message, "error");
            setButtonState(button, false);

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
        onError
    } = options || {};

    if (!button) {
        throw new Error("A back button is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setButtonState(button, true);

        try {
            const nextRoute =
                typeof resolveBackRoute === "function"
                    ? await resolveBackRoute()
                    : "../authentication/role-choice.html";

            setButtonState(button, false);

            if (typeof navigate === "function") {
                navigate(nextRoute || "../authentication/role-choice.html");
            }

            return {
                success: true,
                nextRoute
            };
        } catch (error) {
            const message = normalizeText(error && error.message) ||
                "Unable to go back right now.";

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

function attachResetPasswordHandler(options) {
    const {
        button,
        authService,
        authUtils,
        statusElement,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        throw new Error("A reset password button is required.");
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setButtonState(button, true);
        clearStatusMessage(statusElement);

        try {
            const result = await sendSelfPasswordReset({
                authService,
                authUtils
            });

            setButtonState(button, false);

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to send password reset email.",
                    "error"
                );

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            setStatusMessage(
                statusElement,
                result.message || "Password reset email sent.",
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
                "Unable to send password reset email."
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

function attachLeaveVendorHandler(options) {
    const {
        button,
        authService,
        authUtils,
        statusElement,
        profileElements,
        refreshProfile,
        onSuccess,
        onError
    } = options || {};

    if (!button) {
        throw new Error("A leave vendor button is required.");
    }

    if (!authService) {
        throw new Error("authService is required.");
    }

    async function handleClick(event) {
        if (event && typeof event.preventDefault === "function") {
            event.preventDefault();
        }

        setButtonState(button, true);
        clearStatusMessage(statusElement);

        try {
            const result = await leaveVendorAccess({
                authService,
                authUtils
            });

            setButtonState(button, false);

            if (!result.success) {
                setStatusMessage(
                    statusElement,
                    result.message || "Unable to update vendor access.",
                    "error"
                );

                if (typeof onError === "function") {
                    onError(result);
                }

                return result;
            }

            if (typeof refreshProfile === "function") {
                await refreshProfile();
            } else {
                renderProfile(profileElements, result.profile || {}, null, authUtils);
            }

            setStatusMessage(
                statusElement,
                result.message || "Vendor access removed.",
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
                "Unable to update vendor access."
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
                authUtils,
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
                authService,
                authUtils
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

        const confirmed = await resolvedConfirm(
            "Are you sure you want to delete your account? This action cannot be undone."
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
                authService,
                authUtils
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

function initializeProfilePage(options = {}) {
    const authService =
        options.authService ||
        (typeof window !== "undefined" ? window.authService : undefined);

    const authUtils = resolveAuthUtils(options.authUtils);

    const {
        statusSelector = "#profile-status",
        nameSelector = "#profile-name",
        emailSelector = "#profile-email",
        roleSelector = "#profile-role",
        vendorStatusSelector = "#profile-vendor-status",
        accessSelector = "#profile-access",
        vendorReasonSelector = "#profile-vendor-reason",
        photoSelector = "#profile-photo",
        photoInputSelector = "#profile-photo-input",
        photoMessageSelector = "#profile-photo-message",
        accountMessageSelector = "#profile-account-message",
        signOutButtonSelector = "#signout-button",
        backButtonSelector = "#profile-back-button, #back-button, [data-profile-back]",
        resetPasswordButtonSelector = "#reset-password-button, [data-profile-reset-password]",
        leaveVendorButtonSelector = "#leave-vendor-button, [data-profile-leave-vendor]",
        uploadPhotoButtonSelector = "#upload-photo-button, [data-profile-upload-photo]",
        removePhotoButtonSelector = "#remove-photo-button, [data-profile-remove-photo]",
        deleteAccountButtonSelector = "#delete-account-button, [data-profile-delete-account]",
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

    const profileElements = {
        nameElement: document.querySelector(nameSelector),
        emailElement: document.querySelector(emailSelector),
        roleElement: document.querySelector(roleSelector),
        vendorStatusElement: document.querySelector(vendorStatusSelector),
        accessElement: document.querySelector(accessSelector),
        vendorReasonElement: document.querySelector(vendorReasonSelector),
        photoElement: document.querySelector(photoSelector),
        leaveVendorButton: document.querySelector(leaveVendorButtonSelector),
        removePhotoButton: document.querySelector(removePhotoButtonSelector)
    };

    const photoInput = document.querySelector(photoInputSelector);
    const signOutButton = document.querySelector(signOutButtonSelector);
    const backButton = document.querySelector(backButtonSelector);
    const resetPasswordButton = document.querySelector(resetPasswordButtonSelector);
    const leaveVendorButton = profileElements.leaveVendorButton;
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
            profileElements
        });

        latestProfileResult = result;
        return result;
    }

    const profilePromise = refreshProfile();

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

    const resetPasswordController = resetPasswordButton
        ? attachResetPasswordHandler({
            button: resetPasswordButton,
            authService,
            authUtils,
            statusElement
        })
        : null;

    const leaveVendorController = leaveVendorButton
        ? attachLeaveVendorHandler({
            button: leaveVendorButton,
            authService,
            authUtils,
            statusElement,
            profileElements,
            refreshProfile
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

    const deleteAccountController = deleteAccountButton
        ? attachDeleteAccountHandler({
            button: deleteAccountButton,
            authService,
            authUtils,
            accountMessageElement,
            navigate: resolvedNavigate,
            confirmAction
        })
        : null;

    return {
        signOutController,
        backController,
        resetPasswordController,
        leaveVendorController,
        photoPreviewController,
        uploadPhotoController,
        removePhotoController,
        deleteAccountController,
        profilePromise,
        refreshProfile
    };
}

const profilePage = {
    normalizeText,
    normalizeVendorStatus,
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
    getDisplayName,
    getEmail,
    getPhotoURL,
    getAvailablePortals,
    capitalize,
    getPortalAccessLabel,
    canLeaveVendor,
    canRemovePhoto,
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
    sendSelfPasswordReset,
    leaveVendorAccess,
    isImageFile,
    readFileAsDataURL,
    loadImageFromSource,
    fileToOptimizedDataURL,
    getSelectedPhotoFile,
    previewSelectedPhoto,
    uploadSelectedPhoto,
    removeCurrentUserPhotoAction,
    deleteCurrentUserAccountAction,
    initializeProfileView,
    attachSignOutHandler,
    attachBackHandler,
    attachResetPasswordHandler,
    attachLeaveVendorHandler,
    attachPhotoInputPreviewHandler,
    attachUploadPhotoHandler,
    attachRemovePhotoHandler,
    attachDeleteAccountHandler,
    initializeProfilePage
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = profilePage;
}

if (typeof window !== "undefined") {
    window.profilePage = profilePage;
}