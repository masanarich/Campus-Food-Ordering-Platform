const {
    VENDOR_STATUSES,
    ACCOUNT_STATUSES,
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
    getIsOwner,
    getIsAdmin,
    getDerivedRoles,
    normaliseUserData,
    normalizeUserData,
    hasRole,
    isOwner,
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
    shouldShowPendingVendorPage,
    createBaseUserProfile,
    mergeProfileWithAuthData,
    applyVendorApplicationToProfile,
    approveVendorProfile,
    rejectVendorProfile,
    blockVendorProfile,
    suspendVendorProfile,
    clearVendorProfile,
    createVendorApplicationData,
    mapAuthErrorCode
} = require("../../public/authentication/auth-utils.js");

function expectIsoString(value) {
    expect(typeof value).toBe("string");
    expect(Number.isNaN(Date.parse(value))).toBe(false);
}

describe("auth-utils constants", () => {
    test("exports vendor statuses", () => {
        expect(VENDOR_STATUSES).toEqual({
            NONE: "none",
            PENDING: "pending",
            APPROVED: "approved",
            REJECTED: "rejected",
            BLOCKED: "blocked"
        });
    });

    test("exports account statuses", () => {
        expect(ACCOUNT_STATUSES).toEqual({
            ACTIVE: "active",
            DISABLED: "disabled",
            BLOCKED: "blocked"
        });
    });

    test("exports portal routes", () => {
        expect(PORTAL_ROUTES).toEqual({
            customer: "../customer/index.html",
            vendor: "../vendor/index.html",
            admin: "../admin/index.html",
            roleChoice: "../authentication/role-choice.html",
            login: "../authentication/login.html",
            pendingVendor: "../authentication/pending-vendor.html",
            vendorApplication: "../authentication/vendor-application.html"
        });
    });
});

describe("auth-utils validation helpers", () => {
    test("normalizeText trims text", () => {
        expect(normalizeText("  hello world  ")).toBe("hello world");
    });

    test("normalizeText returns empty string for invalid input", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(123)).toBe("");
        expect(normalizeText({})).toBe("");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("normalizePhoneNumber trims and removes spaces", () => {
        expect(normalizePhoneNumber("  +27 71 234 5678  ")).toBe("+27712345678");
    });

    test("isNonEmptyString returns true for non-empty text", () => {
        expect(isNonEmptyString("Campus Food")).toBe(true);
    });

    test("isNonEmptyString returns false for blank or invalid text", () => {
        expect(isNonEmptyString("   ")).toBe(false);
        expect(isNonEmptyString(null)).toBe(false);
        expect(isNonEmptyString(123)).toBe(false);
    });

    test("isValidEmail returns true for a valid email", () => {
        expect(isValidEmail("user@example.com")).toBe(true);
    });

    test("isValidEmail returns false for an invalid email", () => {
        expect(isValidEmail("userexample.com")).toBe(false);
        expect(isValidEmail("user@")).toBe(false);
        expect(isValidEmail("")).toBe(false);
    });

    test("isStrongPassword returns true for password length >= 8", () => {
        expect(isStrongPassword("password123")).toBe(true);
    });

    test("isStrongPassword returns false for password length < 8 or invalid", () => {
        expect(isStrongPassword("pass12")).toBe(false);
        expect(isStrongPassword(null)).toBe(false);
    });

    test("isValidPhoneNumber accepts local digits", () => {
        expect(isValidPhoneNumber("0712345678")).toBe(true);
    });

    test("isValidPhoneNumber accepts international format", () => {
        expect(isValidPhoneNumber("+27712345678")).toBe(true);
    });

    test("isValidPhoneNumber accepts numbers with spaces", () => {
        expect(isValidPhoneNumber("071 234 5678")).toBe(true);
    });

    test("isValidPhoneNumber rejects bad phone numbers", () => {
        expect(isValidPhoneNumber("07-123")).toBe(false);
        expect(isValidPhoneNumber("abc123")).toBe(false);
        expect(isValidPhoneNumber(null)).toBe(false);
    });
});

describe("auth-utils role and identity helpers", () => {
    test("createEmptyRoles returns all roles as false", () => {
        expect(createEmptyRoles()).toEqual({
            customer: false,
            vendor: false,
            admin: false
        });
    });

    test("normalizeRoles safely normalizes missing roles", () => {
        expect(normalizeRoles(undefined)).toEqual({
            customer: false,
            vendor: false,
            admin: false
        });
    });

    test("normalizeRoles preserves strict true boolean values", () => {
        expect(
            normalizeRoles({
                customer: true,
                vendor: true,
                admin: false
            })
        ).toEqual({
            customer: true,
            vendor: true,
            admin: false
        });
    });

    test("normalizeRoles only accepts strict true", () => {
        expect(
            normalizeRoles({
                customer: 1,
                vendor: "true",
                admin: true
            })
        ).toEqual({
            customer: false,
            vendor: false,
            admin: true
        });
    });

    test("hasAuthenticatedIdentity returns true for uid", () => {
        expect(hasAuthenticatedIdentity({ uid: "abc123" })).toBe(true);
    });

    test("hasAuthenticatedIdentity returns true for valid email", () => {
        expect(hasAuthenticatedIdentity({ email: "user@example.com" })).toBe(true);
    });

    test("hasAuthenticatedIdentity returns true for valid phone number", () => {
        expect(hasAuthenticatedIdentity({ phoneNumber: "+27712345678" })).toBe(true);
    });

    test("hasAuthenticatedIdentity returns false with no valid identity", () => {
        expect(hasAuthenticatedIdentity({})).toBe(false);
        expect(hasAuthenticatedIdentity({ email: "bad-email" })).toBe(false);
    });

    test("getAccountStatus returns active by default", () => {
        expect(getAccountStatus({})).toBe("active");
    });

    test("getAccountStatus accepts valid statuses", () => {
        expect(getAccountStatus({ accountStatus: "active" })).toBe("active");
        expect(getAccountStatus({ accountStatus: "disabled" })).toBe("disabled");
        expect(getAccountStatus({ accountStatus: "blocked" })).toBe("blocked");
    });

    test("getAccountStatus normalizes invalid statuses to active", () => {
        expect(getAccountStatus({ accountStatus: "inactive" })).toBe("active");
        expect(getAccountStatus({ accountStatus: "   " })).toBe("active");
    });

    test("isAccountActive only returns true for active accounts", () => {
        expect(isAccountActive({ accountStatus: "active" })).toBe(true);
        expect(isAccountActive({ accountStatus: "disabled" })).toBe(false);
        expect(isAccountActive({ accountStatus: "blocked" })).toBe(false);
    });

    test("getVendorStatus returns none by default", () => {
        expect(getVendorStatus({})).toBe("none");
    });

    test("getVendorStatus returns normalized supported values", () => {
        expect(getVendorStatus({ vendorStatus: "pending" })).toBe("pending");
        expect(getVendorStatus({ vendorStatus: "approved" })).toBe("approved");
        expect(getVendorStatus({ vendorStatus: "rejected" })).toBe("rejected");
        expect(getVendorStatus({ vendorStatus: "blocked" })).toBe("blocked");
    });

    test("getVendorStatus maps legacy suspended to blocked", () => {
        expect(getVendorStatus({ vendorStatus: "suspended" })).toBe("blocked");
    });

    test("getVendorStatus uses legacy vendor flags as approved fallback", () => {
        expect(getVendorStatus({ isVendor: true })).toBe("approved");
        expect(getVendorStatus({ vendor: true })).toBe("approved");
        expect(getVendorStatus({ roles: { vendor: true } })).toBe("approved");
    });

    test("getVendorStatus returns none for unknown status with no legacy vendor flag", () => {
        expect(getVendorStatus({ vendorStatus: "unknown-status" })).toBe("none");
    });

    test("getVendorReason prefers vendorReason", () => {
        expect(
            getVendorReason({
                vendorReason: "  Main reason  ",
                rejectionReason: "Other reason"
            })
        ).toBe("Main reason");
    });

    test("getVendorReason falls back to rejectionReason or blockReason", () => {
        expect(getVendorReason({ rejectionReason: "Rejected for missing docs" })).toBe(
            "Rejected for missing docs"
        );
        expect(getVendorReason({ blockReason: "Blocked by admin" })).toBe(
            "Blocked by admin"
        );
    });

    test("getIsOwner returns true for isOwner or owner", () => {
        expect(getIsOwner({ isOwner: true })).toBe(true);
        expect(getIsOwner({ owner: true })).toBe(true);
        expect(getIsOwner({})).toBe(false);
    });

    test("getIsAdmin returns true for admin flags, legacy admin role, or owner", () => {
        expect(getIsAdmin({ isAdmin: true })).toBe(true);
        expect(getIsAdmin({ admin: true })).toBe(true);
        expect(getIsAdmin({ roles: { admin: true } })).toBe(true);
        expect(getIsAdmin({ isOwner: true })).toBe(true);
        expect(getIsAdmin({})).toBe(false);
    });

    test("getDerivedRoles returns expected roles for approved vendor", () => {
        expect(
            getDerivedRoles({
                uid: "abc123",
                vendorStatus: "approved"
            })
        ).toEqual({
            customer: true,
            vendor: true,
            admin: false
        });
    });

    test("getDerivedRoles returns customer and admin for owner", () => {
        expect(
            getDerivedRoles({
                isOwner: true
            })
        ).toEqual({
            customer: true,
            vendor: false,
            admin: true
        });
    });
});

describe("auth-utils user normalization", () => {
    test("normaliseUserData returns safe defaults", () => {
        const result = normaliseUserData(undefined);

        expect(result).toEqual({
            uid: "",
            displayName: "",
            email: "",
            phoneNumber: "",
            photoURL: "",
            isAdmin: false,
            isOwner: false,
            vendorStatus: "none",
            vendorReason: "",
            accountStatus: "active",
            createdAt: null,
            updatedAt: null,
            lastLoginAt: null,
            roles: {
                customer: false,
                vendor: false,
                admin: false
            }
        });
    });

    test("normaliseUserData normalizes and derives values", () => {
        const result = normaliseUserData({
            uid: "abc123",
            fullName: "  Faranani Maduwa  ",
            email: "  USER@example.com  ",
            phoneNumber: "  +27 71 234 5678  ",
            photoURL: "  https://example.com/photo.jpg  ",
            roles: { admin: true },
            vendorStatus: "approved",
            accountStatus: "inactive",
            isOwner: true,
            rejectionReason: "  Missing docs  ",
            createdAt: "yesterday",
            updatedAt: "today",
            lastLoginAt: "just now"
        });

        expect(result).toEqual({
            uid: "abc123",
            displayName: "Faranani Maduwa",
            email: "user@example.com",
            phoneNumber: "+27712345678",
            photoURL: "https://example.com/photo.jpg",
            isAdmin: true,
            isOwner: true,
            vendorStatus: "approved",
            vendorReason: "Missing docs",
            accountStatus: "active",
            createdAt: "yesterday",
            updatedAt: "today",
            lastLoginAt: "just now",
            roles: {
                customer: true,
                vendor: true,
                admin: true
            }
        });
    });

    test("normalizeUserData is an alias of normaliseUserData", () => {
        const input = { email: " USER@example.com " };
        expect(normalizeUserData(input)).toEqual(normaliseUserData(input));
    });

    test("hasRole supports customer, vendor, admin, owner and rejects unknown roles", () => {
        const user = {
            uid: "abc123",
            isOwner: true,
            vendorStatus: "approved"
        };

        expect(hasRole(user, "customer")).toBe(true);
        expect(hasRole(user, "vendor")).toBe(true);
        expect(hasRole(user, "admin")).toBe(true);
        expect(hasRole(user, "owner")).toBe(true);
        expect(hasRole(user, "unknown-role")).toBe(false);
    });

    test("isOwner returns true only for owners", () => {
        expect(isOwner({ isOwner: true })).toBe(true);
        expect(isOwner({})).toBe(false);
    });

    test("isCustomer returns true for authenticated active user", () => {
        expect(isCustomer({ uid: "abc123", accountStatus: "active" })).toBe(true);
    });

    test("isCustomer returns true for admin even without direct identity", () => {
        expect(isCustomer({ isAdmin: true, accountStatus: "active" })).toBe(true);
    });

    test("isCustomer returns false for inactive user", () => {
        expect(isCustomer({ uid: "abc123", accountStatus: "blocked" })).toBe(false);
    });

    test("isVendor returns true only for approved active vendor", () => {
        expect(isVendor({ uid: "abc123", vendorStatus: "approved" })).toBe(true);
        expect(isVendor({ uid: "abc123", vendorStatus: "pending" })).toBe(false);
        expect(isVendor({ uid: "abc123", vendorStatus: "approved", accountStatus: "disabled" })).toBe(false);
    });

    test("isAdmin returns true only for active admin or owner", () => {
        expect(isAdmin({ isAdmin: true, accountStatus: "active" })).toBe(true);
        expect(isAdmin({ isOwner: true, accountStatus: "active" })).toBe(true);
        expect(isAdmin({ isAdmin: true, accountStatus: "blocked" })).toBe(false);
    });

    test("vendor status shortcut helpers work correctly", () => {
        expect(isVendorPending({ vendorStatus: "pending" })).toBe(true);
        expect(isVendorApproved({ vendorStatus: "approved" })).toBe(true);
        expect(isVendorRejected({ vendorStatus: "rejected" })).toBe(true);
        expect(isVendorBlocked({ vendorStatus: "blocked" })).toBe(true);
        expect(isVendorSuspended({ vendorStatus: "suspended" })).toBe(true);
    });
});

describe("auth-utils portal access and routing", () => {
    test("customer can access customer portal", () => {
        expect(
            canAccessCustomerPortal({
                uid: "abc123"
            })
        ).toBe(true);
    });

    test("user with no identity and no privileges cannot access customer portal", () => {
        expect(canAccessCustomerPortal({})).toBe(false);
    });

    test("approved vendor can access vendor portal", () => {
        expect(
            canAccessVendorPortal({
                uid: "abc123",
                vendorStatus: "approved"
            })
        ).toBe(true);
    });

    test("pending vendor cannot access vendor portal", () => {
        expect(
            canAccessVendorPortal({
                uid: "abc123",
                vendorStatus: "pending"
            })
        ).toBe(false);
    });

    test("owner can access vendor portal", () => {
        expect(
            canAccessVendorPortal({
                isOwner: true
            })
        ).toBe(true);
    });

    test("plain admin cannot access vendor portal unless owner", () => {
        expect(
            canAccessVendorPortal({
                isAdmin: true,
                uid: "abc123",
                vendorStatus: "none"
            })
        ).toBe(false);
    });

    test("admin can access admin portal", () => {
        expect(
            canAccessAdminPortal({
                isAdmin: true
            })
        ).toBe(true);
    });

    test("owner can access admin portal", () => {
        expect(
            canAccessAdminPortal({
                isOwner: true
            })
        ).toBe(true);
    });

    test("inactive admin cannot access admin portal", () => {
        expect(
            canAccessAdminPortal({
                isAdmin: true,
                accountStatus: "disabled"
            })
        ).toBe(false);
    });

    test("getAvailablePortals returns customer only for basic customer", () => {
        expect(
            getAvailablePortals({
                uid: "abc123",
                vendorStatus: "none"
            })
        ).toEqual(["customer"]);
    });

    test("getAvailablePortals returns customer and vendor for approved vendor", () => {
        expect(
            getAvailablePortals({
                uid: "abc123",
                vendorStatus: "approved"
            })
        ).toEqual(["customer", "vendor"]);
    });

    test("getAvailablePortals returns customer and admin for admin", () => {
        expect(
            getAvailablePortals({
                isAdmin: true
            })
        ).toEqual(["customer", "admin"]);
    });

    test("getAvailablePortals returns all portals for owner with approved vendor status", () => {
        expect(
            getAvailablePortals({
                isOwner: true,
                vendorStatus: "approved"
            })
        ).toEqual(["customer", "vendor", "admin"]);
    });

    test("getAvailablePortals returns empty array for unknown user", () => {
        expect(getAvailablePortals({})).toEqual([]);
    });

    test("shouldGoToRoleChoice returns true when more than one portal is available", () => {
        expect(
            shouldGoToRoleChoice({
                uid: "abc123",
                vendorStatus: "approved"
            })
        ).toBe(true);
    });

    test("shouldGoToRoleChoice returns false when only one portal is available", () => {
        expect(
            shouldGoToRoleChoice({
                uid: "abc123",
                vendorStatus: "none"
            })
        ).toBe(false);
    });

    test("getPortalRoute returns matching route or login fallback", () => {
        expect(getPortalRoute("customer")).toBe(PORTAL_ROUTES.customer);
        expect(getPortalRoute("vendor")).toBe(PORTAL_ROUTES.vendor);
        expect(getPortalRoute("admin")).toBe(PORTAL_ROUTES.admin);
        expect(getPortalRoute("unknown")).toBe(PORTAL_ROUTES.login);
    });

    test("getRoleChoiceOptions builds portal choice objects", () => {
        expect(
            getRoleChoiceOptions({
                uid: "abc123",
                vendorStatus: "approved"
            })
        ).toEqual([
            {
                key: "customer",
                label: "Customer Portal",
                route: "../customer/index.html"
            },
            {
                key: "vendor",
                label: "Vendor Portal",
                route: "../vendor/index.html"
            }
        ]);
    });

    test("getDefaultPortalRoute returns login route for unknown user", () => {
        expect(getDefaultPortalRoute({})).toBe(PORTAL_ROUTES.login);
    });

    test("getDefaultPortalRoute returns customer route for single-portal customer", () => {
        expect(
            getDefaultPortalRoute({
                uid: "abc123",
                vendorStatus: "none"
            })
        ).toBe(PORTAL_ROUTES.customer);
    });

    test("getDefaultPortalRoute returns role-choice for multi-portal approved vendor", () => {
        expect(
            getDefaultPortalRoute({
                uid: "abc123",
                vendorStatus: "approved"
            })
        ).toBe(PORTAL_ROUTES.roleChoice);
    });

    test("getPostLoginRoute mirrors getDefaultPortalRoute", () => {
        const user = { isAdmin: true };
        expect(getPostLoginRoute(user)).toBe(getDefaultPortalRoute(user));
    });

    test("canSubmitVendorApplication allows active users with none or rejected status", () => {
        expect(
            canSubmitVendorApplication({
                uid: "abc123",
                vendorStatus: "none",
                accountStatus: "active"
            })
        ).toBe(true);

        expect(
            canSubmitVendorApplication({
                uid: "abc123",
                vendorStatus: "rejected",
                accountStatus: "active"
            })
        ).toBe(true);
    });

    test("canSubmitVendorApplication blocks owners, admins, inactive accounts, pending, approved and blocked vendors", () => {
        expect(canSubmitVendorApplication({ isOwner: true })).toBe(false);
        expect(canSubmitVendorApplication({ isAdmin: true })).toBe(false);
        expect(canSubmitVendorApplication({ uid: "abc123", accountStatus: "blocked" })).toBe(false);
        expect(canSubmitVendorApplication({ uid: "abc123", vendorStatus: "pending" })).toBe(false);
        expect(canSubmitVendorApplication({ uid: "abc123", vendorStatus: "approved" })).toBe(false);
        expect(canSubmitVendorApplication({ uid: "abc123", vendorStatus: "blocked" })).toBe(false);
    });

    test("shouldShowPendingVendorPage is true for pending, rejected and blocked", () => {
        expect(shouldShowPendingVendorPage({ vendorStatus: "pending" })).toBe(true);
        expect(shouldShowPendingVendorPage({ vendorStatus: "rejected" })).toBe(true);
        expect(shouldShowPendingVendorPage({ vendorStatus: "blocked" })).toBe(true);
        expect(shouldShowPendingVendorPage({ vendorStatus: "approved" })).toBe(false);
        expect(shouldShowPendingVendorPage({ vendorStatus: "none" })).toBe(false);
    });
});

describe("auth-utils profile shaping", () => {
    test("createBaseUserProfile creates a base profile from auth user and overrides", () => {
        const result = createBaseUserProfile(
            {
                uid: "abc123",
                email: "auth@example.com",
                displayName: "Auth Name",
                phoneNumber: "+27712345678",
                photoURL: "https://example.com/auth.jpg"
            },
            {
                displayName: "Override Name",
                photoURL: "https://example.com/override.jpg"
            }
        );

        expect(result.uid).toBe("abc123");
        expect(result.displayName).toBe("Override Name");
        expect(result.email).toBe("auth@example.com");
        expect(result.phoneNumber).toBe("+27712345678");
        expect(result.photoURL).toBe("https://example.com/override.jpg");
        expect(result.isAdmin).toBe(false);
        expect(result.isOwner).toBe(false);
        expect(result.vendorStatus).toBe("none");
        expect(result.vendorReason).toBe("");
        expect(result.accountStatus).toBe("active");
        expect(result.roles).toEqual({
            customer: true,
            vendor: false,
            admin: false
        });
        expectIsoString(result.createdAt);
        expectIsoString(result.updatedAt);
        expectIsoString(result.lastLoginAt);
    });

    test("createBaseUserProfile handles missing authUser and missing overrides", () => {
        const result = createBaseUserProfile(null, null);

        expect(result.uid).toBe("");
        expect(result.displayName).toBe("");
        expect(result.email).toBe("");
        expect(result.phoneNumber).toBe("");
        expect(result.photoURL).toBe("");
        expect(result.roles).toEqual({
            customer: false,
            vendor: false,
            admin: false
        });
    });

    test("mergeProfileWithAuthData preserves privileged fields from existing profile", () => {
        const result = mergeProfileWithAuthData(
            {
                uid: "existing-uid",
                displayName: "Existing Name",
                email: "existing@example.com",
                phoneNumber: "+27710000000",
                photoURL: "https://example.com/existing.jpg",
                isAdmin: true,
                isOwner: false,
                vendorStatus: "approved",
                vendorReason: "Already approved",
                accountStatus: "blocked",
                createdAt: "2026-01-01T10:00:00.000Z"
            },
            {
                uid: "auth-uid",
                displayName: "Auth Name",
                email: "auth@example.com",
                phoneNumber: "+27719999999",
                photoURL: "https://example.com/auth.jpg"
            },
            {
                displayName: "Override Name"
            }
        );

        expect(result.uid).toBe("existing-uid");
        expect(result.displayName).toBe("Override Name");
        expect(result.email).toBe("existing@example.com");
        expect(result.phoneNumber).toBe("+27710000000");
        expect(result.photoURL).toBe("https://example.com/existing.jpg");
        expect(result.isAdmin).toBe(true);
        expect(result.isOwner).toBe(false);
        expect(result.vendorStatus).toBe("approved");
        expect(result.vendorReason).toBe("Already approved");
        expect(result.accountStatus).toBe("blocked");
        expect(result.createdAt).toBe("2026-01-01T10:00:00.000Z");
        expectIsoString(result.updatedAt);
        expectIsoString(result.lastLoginAt);
        expect(result.roles).toEqual({
            customer: true,
            vendor: true,
            admin: true
        });
    });

    test("applyVendorApplicationToProfile sets vendor status to pending", () => {
        const result = applyVendorApplicationToProfile({
            uid: "abc123",
            email: "vendor@example.com",
            vendorStatus: "none",
            accountStatus: "active"
        });

        expect(result.vendorStatus).toBe("pending");
        expect(result.vendorReason).toBe("");
        expect(result.roles.vendor).toBe(false);
        expectIsoString(result.updatedAt);
    });

    test("approveVendorProfile approves vendor", () => {
        const result = approveVendorProfile({
            uid: "abc123",
            email: "vendor@example.com",
            vendorStatus: "pending"
        });

        expect(result.vendorStatus).toBe("approved");
        expect(result.vendorReason).toBe("");
        expect(result.roles.vendor).toBe(true);
        expectIsoString(result.updatedAt);
    });

    test("rejectVendorProfile rejects vendor and stores reason", () => {
        const result = rejectVendorProfile(
            {
                uid: "abc123",
                email: "vendor@example.com",
                vendorStatus: "pending"
            },
            " Missing tax number "
        );

        expect(result.vendorStatus).toBe("rejected");
        expect(result.vendorReason).toBe("Missing tax number");
        expect(result.roles.vendor).toBe(false);
        expectIsoString(result.updatedAt);
    });

    test("blockVendorProfile blocks vendor and stores reason", () => {
        const result = blockVendorProfile(
            {
                uid: "abc123",
                email: "vendor@example.com",
                vendorStatus: "approved"
            },
            " Policy violation "
        );

        expect(result.vendorStatus).toBe("blocked");
        expect(result.vendorReason).toBe("Policy violation");
        expect(result.roles.vendor).toBe(false);
        expectIsoString(result.updatedAt);
    });

    test("suspendVendorProfile is a backward-compatible alias for blockVendorProfile", () => {
        const result = suspendVendorProfile(
            {
                uid: "abc123",
                email: "vendor@example.com",
                vendorStatus: "approved"
            },
            " Suspended by admin "
        );

        expect(result.vendorStatus).toBe("blocked");
        expect(result.vendorReason).toBe("Suspended by admin");
        expect(result.roles.vendor).toBe(false);
        expectIsoString(result.updatedAt);
    });

    test("clearVendorProfile resets vendor state", () => {
        const result = clearVendorProfile({
            uid: "abc123",
            email: "vendor@example.com",
            vendorStatus: "blocked",
            vendorReason: "Old reason"
        });

        expect(result.vendorStatus).toBe("none");
        expect(result.vendorReason).toBe("");
        expect(result.roles.vendor).toBe(false);
        expectIsoString(result.updatedAt);
    });

    test("createVendorApplicationData builds pending application data", () => {
        const result = createVendorApplicationData(
            {
                uid: "abc123",
                displayName: "Auth User",
                email: "auth@example.com",
                phoneNumber: "+27712345678"
            },
            {
                businessName: "  Campus Kitchen  ",
                description: "  Fresh meals daily  "
            }
        );

        expect(result).toMatchObject({
            uid: "abc123",
            applicantName: "Auth User",
            email: "auth@example.com",
            phoneNumber: "+27712345678",
            businessName: "Campus Kitchen",
            businessDescription: "Fresh meals daily",
            status: "pending",
            reason: ""
        });
        expectIsoString(result.submittedAt);
        expectIsoString(result.updatedAt);
    });

    test("createVendorApplicationData prefers form overrides", () => {
        const result = createVendorApplicationData(
            {
                uid: "abc123",
                displayName: "Auth User",
                email: "auth@example.com",
                phoneNumber: "+27712345678"
            },
            {
                applicantName: "Form User",
                email: "form@example.com",
                phoneNumber: "071 234 5678",
                businessName: "Vendor Shop",
                businessDescription: "Snacks"
            }
        );

        expect(result.applicantName).toBe("Form User");
        expect(result.email).toBe("form@example.com");
        expect(result.phoneNumber).toBe("0712345678");
        expect(result.businessName).toBe("Vendor Shop");
        expect(result.businessDescription).toBe("Snacks");
    });
});

describe("auth-utils auth error mapping", () => {
    test("maps invalid email error", () => {
        expect(mapAuthErrorCode("auth/invalid-email")).toBe("The email address is invalid.");
    });

    test("maps user not found error", () => {
        expect(mapAuthErrorCode("auth/user-not-found")).toBe(
            "No account was found with that email address."
        );
    });

    test("maps wrong password and invalid credential errors", () => {
        expect(mapAuthErrorCode("auth/wrong-password")).toBe(
            "Incorrect email or password."
        );
        expect(mapAuthErrorCode("auth/invalid-credential")).toBe(
            "Incorrect email or password."
        );
    });

    test("maps email already in use error", () => {
        expect(mapAuthErrorCode("auth/email-already-in-use")).toBe(
            "That email address is already in use."
        );
    });

    test("maps weak password error", () => {
        expect(mapAuthErrorCode("auth/weak-password")).toBe(
            "The password is too weak."
        );
    });

    test("maps network error", () => {
        expect(mapAuthErrorCode("auth/network-request-failed")).toBe(
            "Network error. Please check your connection and try again."
        );
    });

    test("maps popup closed and popup blocked errors", () => {
        expect(mapAuthErrorCode("auth/popup-closed-by-user")).toBe(
            "The sign-in popup was closed before completing sign-in."
        );
        expect(mapAuthErrorCode("auth/popup-blocked")).toBe(
            "Your browser blocked the sign-in popup. Please allow popups and try again."
        );
    });

    test("maps too many requests error", () => {
        expect(mapAuthErrorCode("auth/too-many-requests")).toBe(
            "Too many attempts were made. Please wait a bit and try again."
        );
    });

    test("maps unknown errors to fallback message", () => {
        expect(mapAuthErrorCode("some-random-error")).toBe(
            "Something went wrong. Please try again."
        );
    });
});