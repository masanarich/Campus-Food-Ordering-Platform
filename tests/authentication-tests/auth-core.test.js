const path = require("path");
const authUtils = require(path.resolve(__dirname, "../../public/authentication/auth-utils.js"));
const {
    ensureDependency,
    createAuthService
} = require(path.resolve(__dirname, "../../public/authentication/auth-core.js"));

function createMockDependencies() {
    return {
        auth: {
            name: "mock-auth",
            currentUser: null
        },
        db: { name: "mock-db" },
        googleProvider: { providerId: "google.com" },
        appleProvider: { providerId: "apple.com" },
        authFns: {
            createUserWithEmailAndPassword: jest.fn(),
            signInWithEmailAndPassword: jest.fn(),
            signInWithPopup: jest.fn(),
            signOut: jest.fn(),
            onAuthStateChanged: jest.fn(),
            updateProfile: jest.fn(),
            sendPasswordResetEmail: jest.fn()
        },
        firestoreFns: {
            doc: jest.fn((database, collectionName, uid) => ({
                database,
                collectionName,
                uid
            })),
            getDoc: jest.fn(),
            setDoc: jest.fn(),
            updateDoc: jest.fn(),
            serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
        },
        utils: authUtils
    };
}

describe("auth-core dependency checks", () => {
    test("ensureDependency returns value when present", () => {
        expect(ensureDependency("value", "testDep")).toBe("value");
    });

    test("ensureDependency throws when dependency is missing", () => {
        expect(() => ensureDependency(null, "auth")).toThrow("auth is required.");
    });

    test("createAuthService throws when auth is missing", () => {
        const deps = createMockDependencies();
        delete deps.auth;

        expect(() => createAuthService(deps)).toThrow("auth is required.");
    });

    test("createAuthService throws when firestoreFns is missing", () => {
        const deps = createMockDependencies();
        delete deps.firestoreFns;

        expect(() => createAuthService(deps)).toThrow("firestoreFns is required.");
    });
});

describe("auth-core service", () => {
    test("createUser creates an email/password user", async () => {
        const deps = createMockDependencies();
        const mockUser = { uid: "user-1", email: "faranani@example.com" };

        deps.authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

        const service = createAuthService(deps);
        const result = await service.createUser("faranani@example.com", "password123");

        expect(deps.authFns.createUserWithEmailAndPassword).toHaveBeenCalledWith(
            deps.auth,
            "faranani@example.com",
            "password123"
        );
        expect(result).toEqual(mockUser);
    });

    test("loginUser signs in with email and password", async () => {
        const deps = createMockDependencies();
        const mockUser = { uid: "user-2", email: "user@example.com" };

        deps.authFns.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

        const service = createAuthService(deps);
        const result = await service.loginUser("user@example.com", "password123");

        expect(deps.authFns.signInWithEmailAndPassword).toHaveBeenCalledWith(
            deps.auth,
            "user@example.com",
            "password123"
        );
        expect(result).toEqual(mockUser);
    });

    test("signInWithGoogle uses Google provider", async () => {
        const deps = createMockDependencies();
        const mockUser = { uid: "google-1", email: "google@example.com" };

        deps.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });

        const service = createAuthService(deps);
        const result = await service.signInWithGoogle();

        expect(deps.authFns.signInWithPopup).toHaveBeenCalledWith(
            deps.auth,
            deps.googleProvider
        );
        expect(result).toEqual(mockUser);
    });

    test("signInWithApple uses Apple provider", async () => {
        const deps = createMockDependencies();
        const mockUser = { uid: "apple-1", email: "apple@example.com" };

        deps.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });

        const service = createAuthService(deps);
        const result = await service.signInWithApple();

        expect(deps.authFns.signInWithPopup).toHaveBeenCalledWith(
            deps.auth,
            deps.appleProvider
        );
        expect(result).toEqual(mockUser);
    });

    test("signOutUser signs out successfully", async () => {
        const deps = createMockDependencies();
        deps.authFns.signOut.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.signOutUser();

        expect(deps.authFns.signOut).toHaveBeenCalledWith(deps.auth);
        expect(result).toBe(true);
    });

    test("sendPasswordReset calls Firebase reset function", async () => {
        const deps = createMockDependencies();
        deps.authFns.sendPasswordResetEmail.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.sendPasswordReset("user@example.com");

        expect(deps.authFns.sendPasswordResetEmail).toHaveBeenCalledWith(
            deps.auth,
            "user@example.com"
        );
        expect(result).toBe(true);
    });

    test("sendPasswordReset throws if reset function is missing", async () => {
        const deps = createMockDependencies();
        delete deps.authFns.sendPasswordResetEmail;

        const service = createAuthService(deps);

        await expect(service.sendPasswordReset("user@example.com")).rejects.toThrow(
            "authFns.sendPasswordResetEmail is required."
        );
    });

    test("setDisplayName updates profile when data is present", async () => {
        const deps = createMockDependencies();
        deps.authFns.updateProfile.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const user = { uid: "u1" };

        await service.setDisplayName(user, "Faranani Maduwa");

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(user, {
            displayName: "Faranani Maduwa"
        });
    });

    test("setDisplayName does nothing if user is missing", async () => {
        const deps = createMockDependencies();

        const service = createAuthService(deps);
        await service.setDisplayName(null, "Name");

        expect(deps.authFns.updateProfile).not.toHaveBeenCalled();
    });

    test("setDisplayName does nothing if displayName is missing", async () => {
        const deps = createMockDependencies();

        const service = createAuthService(deps);
        await service.setDisplayName({ uid: "u1" }, "");

        expect(deps.authFns.updateProfile).not.toHaveBeenCalled();
    });

    test("getCurrentUser returns the current signed-in user", () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "current-1",
            email: "current@example.com"
        };

        const service = createAuthService(deps);
        const result = service.getCurrentUser();

        expect(result).toEqual({
            uid: "current-1",
            email: "current@example.com"
        });
    });

    test("getCurrentUser returns null when no user is signed in", () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = null;

        const service = createAuthService(deps);
        const result = service.getCurrentUser();

        expect(result).toBeNull();
    });

    test("getUserDocRef creates reference in users collection", () => {
        const deps = createMockDependencies();
        const service = createAuthService(deps);

        const result = service.getUserDocRef("abc123");

        expect(deps.firestoreFns.doc).toHaveBeenCalledWith(deps.db, "users", "abc123");
        expect(result).toEqual({
            database: deps.db,
            collectionName: "users",
            uid: "abc123"
        });
    });

    test("getUserProfile returns null when profile does not exist", async () => {
        const deps = createMockDependencies();

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });

        const service = createAuthService(deps);
        const result = await service.getUserProfile("missing-user");

        expect(result).toBeNull();
    });

    test("getUserProfile returns profile data when it exists", async () => {
        const deps = createMockDependencies();
        const profile = {
            uid: "user-3",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => profile
        });

        const service = createAuthService(deps);
        const result = await service.getUserProfile("user-3");

        expect(result).toEqual(profile);
    });

    test("getCurrentUserProfile returns profile data for the supplied uid", async () => {
        const deps = createMockDependencies();
        const profile = {
            uid: "user-3",
            email: "user3@example.com",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => profile
        });

        const service = createAuthService(deps);
        const result = await service.getCurrentUserProfile("user-3");

        expect(result).toEqual(profile);
        expect(deps.firestoreFns.doc).toHaveBeenCalledWith(deps.db, "users", "user-3");
    });

    test("saveUserProfile writes profile to users collection", async () => {
        const deps = createMockDependencies();
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);

        const profile = {
            uid: "user-4",
            email: "user4@example.com",
            displayName: "User Four",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        const result = await service.saveUserProfile(profile);

        expect(deps.firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-4"
            },
            {
                ...profile,
                createdAt: "SERVER_TIMESTAMP",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );
        expect(result).toEqual(profile);
    });

    test("updateUserProfile updates profile fields", async () => {
        const deps = createMockDependencies();
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);

        const result = await service.updateUserProfile("user-5", {
            vendorStatus: "approved"
        });

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-5"
            },
            {
                vendorStatus: "approved",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );
        expect(result).toEqual({
            uid: "user-5",
            vendorStatus: "approved"
        });
    });

    test("ensureUserProfile returns existing profile when found", async () => {
        const deps = createMockDependencies();
        const existingProfile = {
            uid: "user-6",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => existingProfile
        });

        const service = createAuthService(deps);
        const result = await service.ensureUserProfile({
            uid: "user-6",
            email: "user6@example.com"
        });

        expect(result).toEqual(existingProfile);
        expect(deps.firestoreFns.setDoc).not.toHaveBeenCalled();
    });

    test("ensureUserProfile creates a new customer profile when missing", async () => {
        const deps = createMockDependencies();

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.ensureUserProfile({
            uid: "user-7",
            email: "user7@example.com",
            displayName: "User Seven"
        });

        expect(result.uid).toBe("user-7");
        expect(result.roles.customer).toBe(true);
        expect(result.vendorStatus).toBe("none");
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledTimes(1);
    });

    test("ensureUserProfile creates a pending vendor profile when accountType is vendor", async () => {
        const deps = createMockDependencies();

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.ensureUserProfile(
            {
                uid: "vendor-2",
                email: "vendor2@example.com",
                displayName: "Vendor Two"
            },
            {
                accountType: "vendor",
                displayName: "Vendor Two",
                email: "vendor2@example.com"
            }
        );

        expect(result.vendorStatus).toBe("pending");
    });

    test("registerWithEmail returns success with next route", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "user-8",
            email: "user8@example.com",
            displayName: ""
        };

        deps.authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.registerWithEmail({
            email: "user8@example.com",
            password: "password123",
            displayName: "User Eight",
            accountType: "customer"
        });

        expect(result.success).toBe(true);
        expect(result.profile.roles.customer).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("registerWithEmail returns mapped error on failure", async () => {
        const deps = createMockDependencies();

        deps.authFns.createUserWithEmailAndPassword.mockRejectedValue({
            code: "auth/email-already-in-use"
        });

        const service = createAuthService(deps);
        const result = await service.registerWithEmail({
            email: "taken@example.com",
            password: "password123",
            displayName: "Taken User",
            accountType: "customer"
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("That email address is already in use.");
    });

    test("loginWithEmail returns success and route", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "user-9",
            email: "user9@example.com",
            displayName: "User Nine"
        };

        deps.authFns.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "user-9",
                email: "user9@example.com",
                displayName: "User Nine",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
        });

        const service = createAuthService(deps);
        const result = await service.loginWithEmail({
            email: "user9@example.com",
            password: "password123"
        });

        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loginWithEmail returns mapped error on failure", async () => {
        const deps = createMockDependencies();

        deps.authFns.signInWithEmailAndPassword.mockRejectedValue({
            code: "auth/invalid-credential"
        });

        const service = createAuthService(deps);
        const result = await service.loginWithEmail({
            email: "user@example.com",
            password: "wrongpass"
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("Incorrect email or password.");
    });

    test("loginWithGoogle creates default customer profile for first-time user", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "google-2",
            email: "google2@example.com",
            displayName: "Google User"
        };

        deps.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.loginWithGoogle();

        expect(result.success).toBe(true);
        expect(result.profile.roles.customer).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loginWithGoogle returns mapped error on failure", async () => {
        const deps = createMockDependencies();

        deps.authFns.signInWithPopup.mockRejectedValue({
            code: "auth/popup-closed-by-user"
        });

        const service = createAuthService(deps);
        const result = await service.loginWithGoogle();

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            "The sign-in popup was closed before completing sign-in."
        );
    });

    test("loginWithApple returns mapped error on failure", async () => {
        const deps = createMockDependencies();

        deps.authFns.signInWithPopup.mockRejectedValue({
            code: "auth/popup-closed-by-user"
        });

        const service = createAuthService(deps);
        const result = await service.loginWithApple();

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            "The sign-in popup was closed before completing sign-in."
        );
    });

    test("sendPasswordResetEmail returns success", async () => {
        const deps = createMockDependencies();
        deps.authFns.sendPasswordResetEmail.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.sendPasswordResetEmail({
            email: "user@example.com"
        });

        expect(result).toEqual({
            success: true
        });
    });

    test("sendPasswordResetEmail returns mapped error on failure", async () => {
        const deps = createMockDependencies();

        deps.authFns.sendPasswordResetEmail.mockRejectedValue({
            code: "auth/user-not-found"
        });

        const service = createAuthService(deps);
        const result = await service.sendPasswordResetEmail({
            email: "missing@example.com"
        });

        expect(result.success).toBe(false);
        expect(result.message).toBe("No account was found with that email address.");
    });

    test("observeAuthState registers an auth state listener", () => {
        const deps = createMockDependencies();
        const unsubscribe = jest.fn();
        const callback = jest.fn();

        deps.authFns.onAuthStateChanged.mockReturnValue(unsubscribe);

        const service = createAuthService(deps);
        const result = service.observeAuthState(callback);

        expect(deps.authFns.onAuthStateChanged).toHaveBeenCalledWith(
            deps.auth,
            callback
        );
        expect(result).toBe(unsubscribe);
    });
});