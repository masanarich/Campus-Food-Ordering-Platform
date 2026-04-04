const {
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
} = require("../../public/authentication/auth-utils.js");

describe("auth-utils validation helpers", () => {
    test("normalizeText trims text", () => {
        expect(normalizeText("  hello world  ")).toBe("hello world");
    });

    test("normalizeText returns empty string for invalid input", () => {
        expect(normalizeText(null)).toBe("");
        expect(normalizeText(undefined)).toBe("");
        expect(normalizeText(123)).toBe("");
    });

    test("normalizeEmail trims and lowercases email", () => {
        expect(normalizeEmail("  USER@Example.COM  ")).toBe("user@example.com");
    });

    test("isNonEmptyString returns true for non-empty text", () => {
        expect(isNonEmptyString("Campus Food")).toBe(true);
    });

    test("isNonEmptyString returns false for blank text", () => {
        expect(isNonEmptyString("   ")).toBe(false);
    });

    test("isValidEmail returns true for a valid email", () => {
        expect(isValidEmail("user@example.com")).toBe(true);
    });

    test("isValidEmail returns false for an invalid email", () => {
        expect(isValidEmail("userexample.com")).toBe(false);
    });

    test("isStrongPassword returns true for password length >= 8", () => {
        expect(isStrongPassword("password123")).toBe(true);
    });

    test("isStrongPassword returns false for password length < 8", () => {
        expect(isStrongPassword("pass12")).toBe(false);
    });

    test("isValidPhoneNumber accepts standard local-style digits", () => {
        expect(isValidPhoneNumber("0712345678")).toBe(true);
    });

    test("isValidPhoneNumber accepts international format", () => {
        expect(isValidPhoneNumber("+27712345678")).toBe(true);
    });

    test("isValidPhoneNumber rejects bad phone numbers", () => {
        expect(isValidPhoneNumber("07-123")).toBe(false);
        expect(isValidPhoneNumber("abc123")).toBe(false);
    });
});

describe("auth-utils role helpers", () => {
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

    test("normalizeRoles preserves true boolean values", () => {
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

    test("normaliseUserData returns safe defaults", () => {
        const result = normaliseUserData(undefined);

        expect(result.uid).toBe("");
        expect(result.displayName).toBe("");
        expect(result.email).toBe("");
        expect(result.roles).toEqual({
            customer: false,
            vendor: false,
            admin: false
        });
        expect(result.vendorStatus).toBe("none");
        expect(result.accountStatus).toBe("active");
        expect(result.isOwner).toBe(false);
    });

    test("hasRole detects customer role", () => {
        expect(
            hasRole(
                {
                    roles: { customer: true, vendor: false, admin: false }
                },
                "customer"
            )
        ).toBe(true);
    });

    test("isCustomer returns true for customer", () => {
        expect(
            isCustomer({
                roles: { customer: true, vendor: false, admin: false }
            })
        ).toBe(true);
    });

    test("isVendor returns true for vendor", () => {
        expect(
            isVendor({
                roles: { customer: true, vendor: true, admin: false }
            })
        ).toBe(true);
    });

    test("isAdmin returns true for admin", () => {
        expect(
            isAdmin({
                roles: { customer: true, vendor: true, admin: true }
            })
        ).toBe(true);
    });
});

describe("auth-utils vendor status helpers", () => {
    test("getVendorStatus returns none by default", () => {
        expect(getVendorStatus({})).toBe("none");
    });

    test("getVendorStatus returns pending correctly", () => {
        expect(getVendorStatus({ vendorStatus: "pending" })).toBe("pending");
    });

    test("getVendorStatus returns approved correctly", () => {
        expect(getVendorStatus({ vendorStatus: "approved" })).toBe("approved");
    });

    test("getVendorStatus returns suspended correctly", () => {
        expect(getVendorStatus({ vendorStatus: "suspended" })).toBe("suspended");
    });

    test("getVendorStatus returns rejected correctly", () => {
        expect(getVendorStatus({ vendorStatus: "rejected" })).toBe("rejected");
    });

    test("isVendorPending works correctly", () => {
        expect(isVendorPending({ vendorStatus: "pending" })).toBe(true);
    });

    test("isVendorApproved works correctly", () => {
        expect(isVendorApproved({ vendorStatus: "approved" })).toBe(true);
    });

    test("isVendorSuspended works correctly", () => {
        expect(isVendorSuspended({ vendorStatus: "suspended" })).toBe(true);
    });

    test("isVendorRejected works correctly", () => {
        expect(isVendorRejected({ vendorStatus: "rejected" })).toBe(true);
    });
});

describe("auth-utils portal access and routing", () => {
    test("customer can access customer portal", () => {
        expect(
            canAccessCustomerPortal({
                roles: { customer: true, vendor: false, admin: false }
            })
        ).toBe(true);
    });

    test("approved vendor can access vendor portal", () => {
        expect(
            canAccessVendorPortal({
                roles: { customer: true, vendor: true, admin: false },
                vendorStatus: "approved"
            })
        ).toBe(true);
    });

    test("pending vendor cannot access vendor portal yet", () => {
        expect(
            canAccessVendorPortal({
                roles: { customer: true, vendor: true, admin: false },
                vendorStatus: "pending"
            })
        ).toBe(false);
    });

    test("admin can access vendor portal", () => {
        expect(
            canAccessVendorPortal({
                roles: { customer: true, vendor: false, admin: true },
                vendorStatus: "none"
            })
        ).toBe(true);
    });

    test("admin can access admin portal", () => {
        expect(
            canAccessAdminPortal({
                roles: { customer: true, vendor: false, admin: true }
            })
        ).toBe(true);
    });

    test("admin should go to role choice", () => {
        expect(
            shouldGoToRoleChoice({
                roles: { customer: true, vendor: true, admin: true }
            })
        ).toBe(true);
    });

    test("getAvailablePortals returns customer only for basic customer", () => {
        expect(
            getAvailablePortals({
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
        ).toEqual(["customer"]);
    });

    test("getAvailablePortals returns customer and vendor for approved vendor", () => {
        expect(
            getAvailablePortals({
                roles: { customer: true, vendor: true, admin: false },
                vendorStatus: "approved"
            })
        ).toEqual(["customer", "vendor"]);
    });

    test("getAvailablePortals returns all portals for admin", () => {
        expect(
            getAvailablePortals({
                roles: { customer: true, vendor: true, admin: true },
                vendorStatus: "approved"
            })
        ).toEqual(["customer", "vendor", "admin"]);
    });

    test("getDefaultPortalRoute returns role-choice for admin", () => {
        expect(
            getDefaultPortalRoute({
                roles: { customer: true, vendor: true, admin: true },
                vendorStatus: "approved"
            })
        ).toBe("../authentication/role-choice.html");
    });

    test("getDefaultPortalRoute returns vendor route for approved vendor", () => {
        expect(
            getDefaultPortalRoute({
                roles: { customer: true, vendor: true, admin: false },
                vendorStatus: "approved"
            })
        ).toBe("../vendor/index.html");
    });

    test("getDefaultPortalRoute returns customer route for customer", () => {
        expect(
            getDefaultPortalRoute({
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
        ).toBe("../customer/index.html");
    });

    test("getDefaultPortalRoute returns login route for unknown user", () => {
        expect(getDefaultPortalRoute({})).toBe("../authentication/login.html");
    });
});

describe("auth-utils profile shaping", () => {
    test("createBaseUserProfile creates a base customer profile", () => {
        const result = createBaseUserProfile(
            { uid: "abc123", email: "user@example.com" },
            { displayName: "Faranani Maduwa" }
        );

        expect(result.uid).toBe("abc123");
        expect(result.email).toBe("user@example.com");
        expect(result.displayName).toBe("Faranani Maduwa");
        expect(result.roles).toEqual({
            customer: true,
            vendor: false,
            admin: false
        });
        expect(result.vendorStatus).toBe("none");
        expect(result.accountStatus).toBe("active");
    });

    test("applyVendorApplicationToProfile sets vendor status to pending", () => {
        const result = applyVendorApplicationToProfile({
            uid: "abc123",
            displayName: "Vendor User",
            email: "vendor@example.com",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none",
            accountStatus: "active"
        });

        expect(result.roles.customer).toBe(true);
        expect(result.roles.vendor).toBe(false);
        expect(result.vendorStatus).toBe("pending");
    });

    test("approveVendorProfile approves vendor access", () => {
        const result = approveVendorProfile({
            uid: "abc123",
            displayName: "Vendor User",
            email: "vendor@example.com",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "pending",
            accountStatus: "active"
        });

        expect(result.roles.vendor).toBe(true);
        expect(result.vendorStatus).toBe("approved");
    });

    test("suspendVendorProfile suspends vendor", () => {
        const result = suspendVendorProfile({
            uid: "abc123",
            displayName: "Vendor User",
            email: "vendor@example.com",
            roles: { customer: true, vendor: true, admin: false },
            vendorStatus: "approved",
            accountStatus: "active"
        });

        expect(result.vendorStatus).toBe("suspended");
    });

    test("rejectVendorProfile rejects vendor application", () => {
        const result = rejectVendorProfile({
            uid: "abc123",
            displayName: "Vendor User",
            email: "vendor@example.com",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "pending",
            accountStatus: "active"
        });

        expect(result.vendorStatus).toBe("rejected");
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

    test("maps invalid credential error", () => {
        expect(mapAuthErrorCode("auth/invalid-credential")).toBe(
            "Incorrect email or password."
        );
    });

    test("maps unknown errors to fallback message", () => {
        expect(mapAuthErrorCode("some-random-error")).toBe(
            "Something went wrong. Please try again."
        );
    });
});