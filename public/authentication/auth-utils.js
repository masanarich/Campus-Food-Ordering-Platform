/**
 * auth-utils.js
 *
 * Pure helper functions for authentication, role checks,
 * vendor approval flow, validation, and routing.
 *
 * This file avoids direct DOM access and avoids direct Firebase calls
 * so that it stays easy to test with Jest.
 */

function normalizeText(value) {
    return typeof value === "string" ? value.trim() : "";
}

function normalizeEmail(email) {
    return normalizeText(email).toLowerCase();
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
    const value = normalizeText(phone).replace(/\s+/g, "");
    return /^\+?[0-9]{10,15}$/.test(value);
}

function createEmptyRoles() {
    return {
        customer: false,
        vendor: false,
        admin: false
    };
}

function normalizeRoles(roles) {
    const safeRoles = roles && typeof roles === "object" ? roles : {};

    return {
        customer: safeRoles.customer === true,
        vendor: safeRoles.vendor === true,
        admin: safeRoles.admin === true
    };
}

function getVendorStatus(userData) {
    const allowedStatuses = ["none", "pending", "approved", "suspended", "rejected"];
    const status = normalizeText(userData && userData.vendorStatus).toLowerCase();

    if (allowedStatuses.includes(status)) {
        return status;
    }

    return "none";
}

function normaliseUserData(userData) {
    const safeUser = userData && typeof userData === "object" ? userData : {};
    const roles = normalizeRoles(safeUser.roles);

    return {
        uid: safeUser.uid || "",
        displayName: normalizeText(safeUser.displayName),
        email: normalizeEmail(safeUser.email),
        roles,
        vendorStatus: getVendorStatus(safeUser),
        accountStatus: normalizeText(safeUser.accountStatus) || "active",
        isOwner: safeUser.isOwner === true,
        createdAt: safeUser.createdAt || null,
        updatedAt: safeUser.updatedAt || null
    };
}

function hasRole(userData, roleName) {
    const user = normaliseUserData(userData);
    return user.roles[roleName] === true;
}

function isCustomer(userData) {
    return hasRole(userData, "customer");
}

function isVendor(userData) {
    return hasRole(userData, "vendor");
}

function isAdmin(userData) {
    return hasRole(userData, "admin");
}

function isVendorPending(userData) {
    return getVendorStatus(userData) === "pending";
}

function isVendorApproved(userData) {
    return getVendorStatus(userData) === "approved";
}

function isVendorSuspended(userData) {
    return getVendorStatus(userData) === "suspended";
}

function isVendorRejected(userData) {
    return getVendorStatus(userData) === "rejected";
}

function canAccessCustomerPortal(userData) {
    return isCustomer(userData) || isVendor(userData) || isAdmin(userData);
}

function canAccessVendorPortal(userData) {
    const approvedVendor = isVendor(userData) && isVendorApproved(userData);
    return approvedVendor || isAdmin(userData);
}

function canAccessAdminPortal(userData) {
    return isAdmin(userData);
}

function shouldGoToRoleChoice(userData) {
    return isAdmin(userData);
}

function getAvailablePortals(userData) {
    const portals = [];
    const user = normaliseUserData(userData);

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

function getDefaultPortalRoute(userData) {
    const user = normaliseUserData(userData);

    if (shouldGoToRoleChoice(user)) {
        return "../authentication/role-choice.html";
    }

    if (canAccessVendorPortal(user)) {
        return "../vendor/index.html";
    }

    if (canAccessCustomerPortal(user)) {
        return "../customer/index.html";
    }

    return "../authentication/login.html";
}

function createBaseUserProfile(authUser, overrides = {}) {
    const safeOverrides = overrides && typeof overrides === "object" ? overrides : {};
    const now = new Date().toISOString();

    return {
        uid: authUser && authUser.uid ? authUser.uid : "",
        displayName: normalizeText(safeOverrides.displayName || safeOverrides.fullName || ""),
        email: normalizeEmail(
            safeOverrides.email || (authUser && authUser.email ? authUser.email : "")
        ),
        roles: {
            customer: true,
            vendor: false,
            admin: false
        },
        vendorStatus: "none",
        accountStatus: "active",
        isOwner: false,
        createdAt: now,
        updatedAt: now
    };
}

function applyVendorApplicationToProfile(profile) {
    const safeProfile = normaliseUserData(profile);

    return {
        ...safeProfile,
        roles: {
            ...safeProfile.roles,
            customer: true,
            vendor: false,
            admin: safeProfile.roles.admin
        },
        vendorStatus: "pending",
        updatedAt: new Date().toISOString()
    };
}

function approveVendorProfile(profile) {
    const safeProfile = normaliseUserData(profile);

    return {
        ...safeProfile,
        roles: {
            ...safeProfile.roles,
            customer: true,
            vendor: true,
            admin: safeProfile.roles.admin
        },
        vendorStatus: "approved",
        updatedAt: new Date().toISOString()
    };
}

function suspendVendorProfile(profile) {
    const safeProfile = normaliseUserData(profile);

    return {
        ...safeProfile,
        vendorStatus: "suspended",
        updatedAt: new Date().toISOString()
    };
}

function rejectVendorProfile(profile) {
    const safeProfile = normaliseUserData(profile);

    return {
        ...safeProfile,
        vendorStatus: "rejected",
        updatedAt: new Date().toISOString()
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
        default:
            return "Something went wrong. Please try again.";
    }
}

const authUtils = {
    normalizeText,
    normalizeEmail,
    isNonEmptyString,
    isValidEmail,
    isStrongPassword,
    isValidPhoneNumber,
    createEmptyRoles,
    normalizeRoles,
    normaliseUserData,
    hasRole,
    isCustomer,
    isVendor,
    isAdmin,
    getVendorStatus,
    isVendorPending,
    isVendorApproved,
    isVendorSuspended,
    isVendorRejected,
    canAccessCustomerPortal,
    canAccessVendorPortal,
    canAccessAdminPortal,
    shouldGoToRoleChoice,
    getAvailablePortals,
    getDefaultPortalRoute,
    createBaseUserProfile,
    applyVendorApplicationToProfile,
    approveVendorProfile,
    suspendVendorProfile,
    rejectVendorProfile,
    mapAuthErrorCode
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = authUtils;
}

if (typeof window !== "undefined") {
    window.authUtils = authUtils;
}
