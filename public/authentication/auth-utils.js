/**
 * auth-utils.js
 *
 * Pure helper functions for authentication, role checks,
 * vendor approval flow, validation, and routing.
 *
 * Source of truth:
 * - isAdmin
 * - vendorStatus
 * - adminApplicationStatus
 * - accountStatus
 *
 * Notes:
 * - "roles" is kept only as a derived backward-compatibility field for now.
 * - Once auth-core.js is cleaned up, roles can be removed completely.
 */

const VENDOR_STATUSES = Object.freeze({
    NONE: "none",
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    BLOCKED: "blocked"
});

const ACCOUNT_STATUSES = Object.freeze({
    ACTIVE: "active",
    DISABLED: "disabled",
    BLOCKED: "blocked"
});

const ADMIN_APPLICATION_STATUSES = Object.freeze({
    NONE: "none",
    PENDING: "pending",
    APPROVED: "approved",
    REJECTED: "rejected",
    BLOCKED: "blocked"
});

const PORTAL_ROUTES = Object.freeze({
    customer: "../customer/index.html",
    vendor: "../vendor/index.html",
    admin: "../admin/index.html",
    roleChoice: "../authentication/role-choice.html",
    login: "../authentication/login.html",
    pendingVendor: "../authentication/pending-vendor.html",
    vendorApplication: "../customer/vendor-application.html",
    adminApplication: "../customer/admin-application.html"
});

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email) {
    return normalizeText(email).toLowerCase();
}

function normalizePhoneNumber(phone) {
    return normalizeText(phone).replace(/\s+/g, "");
}

function isNonEmptyString(value) {
    return typeof value === "string" && value.trim().length > 0;
}

function isValidEmail(email) {
    const value = normalizeEmail(email);
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isStrongPassword(password) {
    return typeof password === "string" && password.length >= 8;
}

function isValidPhoneNumber(phone) {
    const value = normalizePhoneNumber(phone);
    return /^\+?[0-9]{10,15}$/.test(value);
}

/**
 * Backward-compatibility helper only.
 * Not a source of truth anymore.
 */
function createEmptyRoles() {
    return {
        customer: false,
        vendor: false,
        admin: false
    };
}

/**
 * Backward-compatibility helper only.
 * Reads old docs safely.
 */
function normalizeRoles(roles) {
    const safeRoles = roles && typeof roles === "object" ? roles : {};

    return {
        customer: safeRoles.customer === true,
        vendor: safeRoles.vendor === true,
        admin: safeRoles.admin === true
    };
}

function hasAuthenticatedIdentity(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};

    return (
        isNonEmptyString(safeUser.uid) ||
        isValidEmail(safeUser.email) ||
        isValidPhoneNumber(safeUser.phoneNumber)
    );
}

function getAccountStatus(userData) {
    const value = normalizeText(userData && userData.accountStatus).toLowerCase();

    if (
        value === ACCOUNT_STATUSES.ACTIVE ||
        value === ACCOUNT_STATUSES.DISABLED ||
        value === ACCOUNT_STATUSES.BLOCKED
    ) {
        return value;
    }

    return ACCOUNT_STATUSES.ACTIVE;
}

function isAccountActive(userData) {
    return getAccountStatus(userData) === ACCOUNT_STATUSES.ACTIVE;
}

function getVendorStatus(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const rawStatus = normalizeText(safeUser.vendorStatus).toLowerCase();

    if (rawStatus === "suspended") {
        return VENDOR_STATUSES.BLOCKED;
    }

    if (
        rawStatus === VENDOR_STATUSES.NONE ||
        rawStatus === VENDOR_STATUSES.PENDING ||
        rawStatus === VENDOR_STATUSES.APPROVED ||
        rawStatus === VENDOR_STATUSES.REJECTED ||
        rawStatus === VENDOR_STATUSES.BLOCKED
    ) {
        return rawStatus;
    }

    // Legacy fallback for older docs
    const legacyRoles = normalizeRoles(safeUser.roles);
    const legacyVendorFlag =
        safeUser.isVendor === true ||
        safeUser.vendor === true ||
        legacyRoles.vendor === true;

    if (legacyVendorFlag) {
        return VENDOR_STATUSES.APPROVED;
    }

    return VENDOR_STATUSES.NONE;
}

function getVendorReason(userData) {
    return normalizeText(
        (userData && (userData.vendorReason || userData.rejectionReason || userData.blockReason)) || ""
    );
}

function getAdminApplicationStatus(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const rawStatus = normalizeText(safeUser.adminApplicationStatus).toLowerCase();

    if (rawStatus === "suspended") {
        return ADMIN_APPLICATION_STATUSES.BLOCKED;
    }

    if (
        rawStatus === ADMIN_APPLICATION_STATUSES.NONE ||
        rawStatus === ADMIN_APPLICATION_STATUSES.PENDING ||
        rawStatus === ADMIN_APPLICATION_STATUSES.APPROVED ||
        rawStatus === ADMIN_APPLICATION_STATUSES.REJECTED ||
        rawStatus === ADMIN_APPLICATION_STATUSES.BLOCKED
    ) {
        return rawStatus;
    }

    return safeUser.isAdmin === true || safeUser.admin === true
        ? ADMIN_APPLICATION_STATUSES.APPROVED
        : ADMIN_APPLICATION_STATUSES.NONE;
}

function getAdminApplicationReason(userData) {
    return normalizeText(
        (userData && (
            userData.adminApplicationReason ||
            userData.adminRejectionReason ||
            userData.adminBlockReason
        )) || ""
    );
}

function getIsAdmin(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const legacyRoles = normalizeRoles(safeUser.roles);

    return (
        safeUser.isAdmin === true ||
        safeUser.admin === true ||
        legacyRoles.admin === true
    );
}

/**
 * Derived compatibility field.
 * Do not treat this as the source of truth.
 */
function getDerivedRoles(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const hasIdentity = hasAuthenticatedIdentity(safeUser);
    const isAdmin = getIsAdmin(safeUser);
    const vendorStatus = getVendorStatus(safeUser);

    return {
        customer: hasIdentity || isAdmin,
        vendor: vendorStatus === VENDOR_STATUSES.APPROVED,
        admin: isAdmin
    };
}

function normaliseUserData(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const derivedRoles = getDerivedRoles(safeUser);

    return {
        uid: normalizeText(safeUser.uid),
        displayName: normalizeText(safeUser.displayName || safeUser.fullName),
        email: normalizeEmail(safeUser.email),
        phoneNumber: normalizePhoneNumber(safeUser.phoneNumber),
        photoURL: normalizeText(safeUser.photoURL),
        isAdmin: getIsAdmin(safeUser),
        vendorStatus: getVendorStatus(safeUser),
        vendorReason: getVendorReason(safeUser),
        adminApplicationStatus: getAdminApplicationStatus(safeUser),
        adminApplicationReason: getAdminApplicationReason(safeUser),
        accountStatus: getAccountStatus(safeUser),
        createdAt: safeUser.createdAt || null,
        updatedAt: safeUser.updatedAt || null,
        lastLoginAt: safeUser.lastLoginAt || null,

        // Derived backward-compatibility field only
        roles: derivedRoles
    };
}

function normalizeUserData(userData) {
    return normaliseUserData(userData);
}

function removeDerivedRoles(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const { roles, ...rest } = safeUser;
    return rest;
}

function hasRole(userData, roleName) {
    const user = normaliseUserData(userData);
    const normalizedRole = normalizeText(roleName).toLowerCase();

    if (normalizedRole === "customer") {
        return isCustomer(user);
    }

    if (normalizedRole === "vendor") {
        return isVendor(user);
    }

    if (normalizedRole === "admin") {
        return isAdmin(user);
    }

    return false;
}

function isAdmin(userData) {
    const user = normaliseUserData(userData);

    return (
        isAccountActive(user) &&
        user.isAdmin === true
    );
}

function isCustomer(userData) {
    const user = normaliseUserData(userData);

    return (
        isAccountActive(user) &&
        (hasAuthenticatedIdentity(user) || user.isAdmin === true)
    );
}

function isVendor(userData) {
    const user = normaliseUserData(userData);

    return (
        isAccountActive(user) &&
        user.vendorStatus === VENDOR_STATUSES.APPROVED
    );
}

function isVendorPending(userData) {
    return getVendorStatus(userData) === VENDOR_STATUSES.PENDING;
}

function isVendorApproved(userData) {
    return getVendorStatus(userData) === VENDOR_STATUSES.APPROVED;
}

function isVendorRejected(userData) {
    return getVendorStatus(userData) === VENDOR_STATUSES.REJECTED;
}

function isVendorBlocked(userData) {
    return getVendorStatus(userData) === VENDOR_STATUSES.BLOCKED;
}

/**
 * Backward-compatible alias
 */
function isVendorSuspended(userData) {
    return isVendorBlocked(userData);
}

function canAccessCustomerPortal(userData) {
    return isCustomer(userData);
}

function canAccessVendorPortal(userData) {
    const user = normaliseUserData(userData);

    if (!isAccountActive(user)) {
        return false;
    }

    return user.vendorStatus === VENDOR_STATUSES.APPROVED;
}

function canAccessAdminPortal(userData) {
    const user = normaliseUserData(userData);

    if (!isAccountActive(user)) {
        return false;
    }

    return user.isAdmin === true;
}

function getAvailablePortals(userData) {
    const user = normaliseUserData(userData);
    const portals = [];

    if (canAccessCustomerPortal(user)) {
        portals.push("customer");
    }

    if (canAccessVendorPortal(user)) {
        portals.push("vendor");
    }

    if (canAccessAdminPortal(user)) {
        portals.push("admin");
    }

    return portals;
}

function shouldGoToRoleChoice(userData) {
    return getAvailablePortals(userData).length > 1;
}

function getPortalRoute(portalName) {
    return PORTAL_ROUTES[portalName] || PORTAL_ROUTES.login;
}

function getRoleChoiceOptions(userData) {
    return getAvailablePortals(userData).map(function mapPortal(portal) {
        return {
            key: portal,
            label:
                portal === "customer"
                    ? "Customer Portal"
                    : portal === "vendor"
                        ? "Vendor Portal"
                        : "Admin Portal",
            route: getPortalRoute(portal)
        };
    });
}

function getDefaultPortalRoute(userData) {
    const availablePortals = getAvailablePortals(userData);

    if (availablePortals.length === 0) {
        return PORTAL_ROUTES.login;
    }

    if (availablePortals.length > 1) {
        return PORTAL_ROUTES.roleChoice;
    }

    return getPortalRoute(availablePortals[0]);
}

function getPostLoginRoute(userData) {
    return getDefaultPortalRoute(userData);
}

function canSubmitVendorApplication(userData) {
    const user = normaliseUserData(userData);

    if (!isAccountActive(user)) {
        return false;
    }

    // Admin should not apply as vendor through the normal flow
    if (user.isAdmin === true) {
        return false;
    }

    return (
        user.vendorStatus === VENDOR_STATUSES.NONE ||
        user.vendorStatus === VENDOR_STATUSES.REJECTED
    );
}

function canSubmitAdminApplication(userData) {
    const user = normaliseUserData(userData);

    if (!isAccountActive(user)) {
        return false;
    }

    if (user.isAdmin === true) {
        return false;
    }

    return (
        user.adminApplicationStatus === ADMIN_APPLICATION_STATUSES.NONE ||
        user.adminApplicationStatus === ADMIN_APPLICATION_STATUSES.REJECTED
    );
}

function shouldShowPendingVendorPage(userData) {
    const user = normaliseUserData(userData);

    return (
        user.vendorStatus === VENDOR_STATUSES.PENDING ||
        user.vendorStatus === VENDOR_STATUSES.REJECTED ||
        user.vendorStatus === VENDOR_STATUSES.BLOCKED
    );
}

function shouldShowPendingAdminPage(userData) {
    const user = normaliseUserData(userData);

    return (
        user.adminApplicationStatus === ADMIN_APPLICATION_STATUSES.PENDING ||
        user.adminApplicationStatus === ADMIN_APPLICATION_STATUSES.REJECTED ||
        user.adminApplicationStatus === ADMIN_APPLICATION_STATUSES.BLOCKED
    );
}

function createBaseUserProfile(authUser, overrides = {}) {
    const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
    const now = new Date().toISOString();

    const profile = {
        uid: normalizeText((authUser && authUser.uid) || safeOverrides.uid),
        displayName: normalizeText(
            safeOverrides.displayName ||
            safeOverrides.fullName ||
            (authUser && authUser.displayName) ||
            ""
        ),
        email: normalizeEmail(
            safeOverrides.email ||
            (authUser && authUser.email) ||
            ""
        ),
        phoneNumber: normalizePhoneNumber(
            safeOverrides.phoneNumber ||
            (authUser && authUser.phoneNumber) ||
            ""
        ),
        photoURL: normalizeText(
            safeOverrides.photoURL ||
            (authUser && authUser.photoURL) ||
            ""
        ),
        isAdmin: false,
        vendorStatus: VENDOR_STATUSES.NONE,
        vendorReason: "",
        adminApplicationStatus: ADMIN_APPLICATION_STATUSES.NONE,
        adminApplicationReason: "",
        accountStatus: ACCOUNT_STATUSES.ACTIVE,
        createdAt: now,
        updatedAt: now,
        lastLoginAt: now
    };

    return {
        ...profile,
        roles: getDerivedRoles(profile)
    };
}

/**
 * Use this for EXISTING users so auth/profile sync does not wipe out
 * manual Firestore access changes like isAdmin, vendorStatus, etc.
 */
function mergeProfileWithAuthData(existingProfile, authUser, overrides = {}) {
    const safeExisting = normaliseUserData(existingProfile);
    const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
    const now = new Date().toISOString();

    const mergedProfile = {
        uid: normalizeText(
            safeExisting.uid ||
            (authUser && authUser.uid) ||
            safeOverrides.uid
        ),
        displayName: normalizeText(
            safeOverrides.displayName ||
            safeOverrides.fullName ||
            safeExisting.displayName ||
            (authUser && authUser.displayName) ||
            ""
        ),
        email: normalizeEmail(
            safeOverrides.email ||
            safeExisting.email ||
            (authUser && authUser.email) ||
            ""
        ),
        phoneNumber: normalizePhoneNumber(
            safeOverrides.phoneNumber ||
            safeExisting.phoneNumber ||
            (authUser && authUser.phoneNumber) ||
            ""
        ),
        photoURL: normalizeText(
            safeOverrides.photoURL ||
            safeExisting.photoURL ||
            (authUser && authUser.photoURL) ||
            ""
        ),
        isAdmin: safeExisting.isAdmin === true,
        vendorStatus: safeExisting.vendorStatus,
        vendorReason: safeExisting.vendorReason,
        adminApplicationStatus: safeExisting.adminApplicationStatus,
        adminApplicationReason: safeExisting.adminApplicationReason,
        accountStatus: safeExisting.accountStatus,
        createdAt: safeExisting.createdAt || now,
        updatedAt: now,
        lastLoginAt: now
    };

    return {
        ...mergedProfile,
        roles: getDerivedRoles(mergedProfile)
    };
}

function applyVendorApplicationToProfile(profile) {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        vendorStatus: VENDOR_STATUSES.PENDING,
        vendorReason: "",
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function approveVendorProfile(profile) {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        vendorStatus: VENDOR_STATUSES.APPROVED,
        vendorReason: "",
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function rejectVendorProfile(profile, reason = "") {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        vendorStatus: VENDOR_STATUSES.REJECTED,
        vendorReason: normalizeText(reason),
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function blockVendorProfile(profile, reason = "") {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        vendorStatus: VENDOR_STATUSES.BLOCKED,
        vendorReason: normalizeText(reason),
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

/**
 * Backward-compatible alias
 */
function suspendVendorProfile(profile, reason = "") {
    return blockVendorProfile(profile, reason);
}

function clearVendorProfile(profile) {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        vendorStatus: VENDOR_STATUSES.NONE,
        vendorReason: "",
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function createVendorApplicationData(authUser, formData = {}) {
    const safeFormData = formData && typeof formData === "object" ? formData : {};
    const now = new Date().toISOString();

    return {
        uid: normalizeText((authUser && authUser.uid) || safeFormData.uid),
        applicantName: normalizeText(
            safeFormData.applicantName ||
            safeFormData.fullName ||
            (authUser && authUser.displayName) ||
            ""
        ),
        email: normalizeEmail(
            safeFormData.email ||
            (authUser && authUser.email) ||
            ""
        ),
        phoneNumber: normalizePhoneNumber(
            safeFormData.phoneNumber ||
            (authUser && authUser.phoneNumber) ||
            ""
        ),
        businessName: normalizeText(safeFormData.businessName),
        businessDescription: normalizeText(
            safeFormData.businessDescription ||
            safeFormData.description
        ),
        status: VENDOR_STATUSES.PENDING,
        reason: "",
        submittedAt: now,
        updatedAt: now
    };
}

function mapAuthErrorCode(code) {
    switch (code) {
        case "auth/invalid-email":
            return "The email address is invalid.";
        case "auth/user-not-found":
            return "No account was found with that email address.";
        case "auth/wrong-password":
        case "auth/invalid-credential":
            return "Incorrect email or password.";
        case "auth/email-already-in-use":
            return "That email address is already in use.";
        case "auth/weak-password":
            return "The password is too weak.";
        case "auth/network-request-failed":
            return "Network error. Please check your connection and try again.";
        case "auth/popup-closed-by-user":
            return "The sign-in popup was closed before completing sign-in.";
        case "auth/popup-blocked":
            return "Your browser blocked the sign-in popup. Please allow popups and try again.";
        case "auth/too-many-requests":
            return "Too many attempts were made. Please wait a bit and try again.";
        default:
            return "Something went wrong. Please try again.";
    }
}

function applyAdminApplicationToProfile(profile) {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        adminApplicationStatus: ADMIN_APPLICATION_STATUSES.PENDING,
        adminApplicationReason: "",
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function approveAdminApplication(profile) {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        isAdmin: true,
        adminApplicationStatus: ADMIN_APPLICATION_STATUSES.APPROVED,
        adminApplicationReason: "",
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function rejectAdminApplication(profile, reason = "") {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        isAdmin: false,
        adminApplicationStatus: ADMIN_APPLICATION_STATUSES.REJECTED,
        adminApplicationReason: normalizeText(reason),
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function blockAdminApplication(profile, reason = "") {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        isAdmin: false,
        adminApplicationStatus: ADMIN_APPLICATION_STATUSES.BLOCKED,
        adminApplicationReason: normalizeText(reason),
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function clearAdminApplication(profile) {
    const safeProfile = removeDerivedRoles(normaliseUserData(profile));

    const updatedProfile = {
        ...safeProfile,
        isAdmin: false,
        adminApplicationStatus: ADMIN_APPLICATION_STATUSES.NONE,
        adminApplicationReason: "",
        updatedAt: new Date().toISOString()
    };

    return {
        ...updatedProfile,
        roles: getDerivedRoles(updatedProfile)
    };
}

function createAdminApplicationData(authUser, formData = {}) {
    const safeFormData = formData && typeof formData === "object" ? formData : {};
    const now = new Date().toISOString();

    return {
        uid: normalizeText((authUser && authUser.uid) || safeFormData.uid),
        applicantName: normalizeText(
            safeFormData.applicantName ||
            safeFormData.fullName ||
            (authUser && authUser.displayName) ||
            ""
        ),
        email: normalizeEmail(
            safeFormData.email ||
            (authUser && authUser.email) ||
            ""
        ),
        phoneNumber: normalizePhoneNumber(
            safeFormData.phoneNumber ||
            (authUser && authUser.phoneNumber) ||
            ""
        ),
        motivation: normalizeText(
            safeFormData.motivation ||
            safeFormData.reason ||
            safeFormData.applicationReason
        ),
        status: ADMIN_APPLICATION_STATUSES.PENDING,
        reason: "",
        submittedAt: now,
        updatedAt: now
    };
}

const authUtils = {
    VENDOR_STATUSES,
    ACCOUNT_STATUSES,
    ADMIN_APPLICATION_STATUSES,
    PORTAL_ROUTES,
    normalizeText,
    normalizeEmail,
    normalizePhoneNumber,
    isNonEmptyString,
    isValidEmail,
    isStrongPassword,
    isValidPhoneNumber,
    createEmptyRoles,
    normalizeRoles,
    hasAuthenticatedIdentity,
    getAccountStatus,
    isAccountActive,
    getVendorStatus,
    getVendorReason,
    getAdminApplicationStatus,
    getAdminApplicationReason,
    getIsAdmin,
    getDerivedRoles,
    normaliseUserData,
    normalizeUserData,
    removeDerivedRoles,
    hasRole,
    isCustomer,
    isVendor,
    isAdmin,
    isVendorPending,
    isVendorApproved,
    isVendorRejected,
    isVendorBlocked,
    isVendorSuspended,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    getAvailablePortals,
    shouldGoToRoleChoice,
    getPortalRoute,
    getRoleChoiceOptions,
    getDefaultPortalRoute,
    getPostLoginRoute,
    canSubmitVendorApplication,
    canSubmitAdminApplication,
    shouldShowPendingVendorPage,
    shouldShowPendingAdminPage,
    createBaseUserProfile,
    mergeProfileWithAuthData,
    applyVendorApplicationToProfile,
    approveVendorProfile,
    rejectVendorProfile,
    blockVendorProfile,
    suspendVendorProfile,
    clearVendorProfile,
    applyAdminApplicationToProfile,
    approveAdminApplication,
    rejectAdminApplication,
    blockAdminApplication,
    clearAdminApplication,
    createVendorApplicationData,
    createAdminApplicationData,
    mapAuthErrorCode
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = authUtils;
}

if (typeof window !== "undefined") {
    window.authUtils = authUtils;
}
