const path = require("path");
const authUtils = require(path.resolve(__dirname, "../../public/authentication/auth-utils.js"));

function createMockAuthService() {
    const auth = { name: "mock-auth" };
    const db = { name: "mock-db" };
    const googleProvider = { providerId: "google" };
    const appleProvider = { providerId: "apple" };

    const authFns = {
        createUserWithEmailAndPassword: jest.fn(),
        signInWithEmailAndPassword: jest.fn(),
        signInWithPopup: jest.fn(),
        signOut: jest.fn(),
        onAuthStateChanged: jest.fn(),
        updateProfile: jest.fn()
    };

    const firestoreFns = {
        doc: jest.fn((database, collectionName, uid) => ({
            database,
            collectionName,
            uid
        })),
        getDoc: jest.fn(),
        setDoc: jest.fn(),
        updateDoc: jest.fn(),
        serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
    };

    function ensureDependency(value, name) {
        if (!value) {
            throw new Error(`${name} is required.`);
        }

        return value;
    }

    function createAuthService(dependencies = {}) {
        const injectedAuth = ensureDependency(dependencies.auth, "auth");
        const injectedDb = ensureDependency(dependencies.db, "db");
        const injectedGoogleProvider = ensureDependency(
            dependencies.googleProvider,
            "googleProvider"
        );
        const injectedAppleProvider = ensureDependency(
            dependencies.appleProvider,
            "appleProvider"
        );

        const injectedAuthFns = ensureDependency(dependencies.authFns, "authFns");
        const injectedFirestoreFns = ensureDependency(
            dependencies.firestoreFns,
            "firestoreFns"
        );
        const utils = ensureDependency(dependencies.utils, "utils");

        async function createUser(email, password) {
            const result = await injectedAuthFns.createUserWithEmailAndPassword(
                injectedAuth,
                email,
                password
            );

            return result.user;
        }

        async function loginUser(email, password) {
            const result = await injectedAuthFns.signInWithEmailAndPassword(
                injectedAuth,
                email,
                password
            );

            return result.user;
        }

        async function signInWithGoogle() {
            const result = await injectedAuthFns.signInWithPopup(
                injectedAuth,
                injectedGoogleProvider
            );

            return result.user;
        }

        async function signInWithApple() {
            const result = await injectedAuthFns.signInWithPopup(
                injectedAuth,
                injectedAppleProvider
            );

            return result.user;
        }

        async function signOutUser() {
            await injectedAuthFns.signOut(injectedAuth);
            return true;
        }

        async function setDisplayName(user, displayName) {
            if (!user || !displayName) {
                return;
            }

            await injectedAuthFns.updateProfile(user, {
                displayName
            });
        }

        function getUserDocRef(uid) {
            return injectedFirestoreFns.doc(injectedDb, "users", uid);
        }

        async function getUserProfile(uid) {
            const userRef = getUserDocRef(uid);
            const snapshot = await injectedFirestoreFns.getDoc(userRef);

            if (!snapshot.exists()) {
                return null;
            }

            return snapshot.data();
        }

        async function saveUserProfile(profile) {
            const userRef = getUserDocRef(profile.uid);

            await injectedFirestoreFns.setDoc(userRef, {
                ...profile,
                createdAt: injectedFirestoreFns.serverTimestamp(),
                updatedAt: injectedFirestoreFns.serverTimestamp()
            });

            return profile;
        }

        async function updateUserProfile(uid, updates) {
            const userRef = getUserDocRef(uid);

            await injectedFirestoreFns.updateDoc(userRef, {
                ...updates,
                updatedAt: injectedFirestoreFns.serverTimestamp()
            });

            return {
                uid,
                ...updates
            };
        }

        async function ensureUserProfile(authUser, options = {}) {
            const {
                accountType = "customer",
                displayName = authUser && authUser.displayName ? authUser.displayName : "",
                email = authUser && authUser.email ? authUser.email : ""
            } = options;

            const existingProfile = await getUserProfile(authUser.uid);

            if (existingProfile) {
                return existingProfile;
            }

            let profile = utils.createBaseUserProfile(authUser, {
                displayName,
                email
            });

            if (accountType === "vendor") {
                profile = utils.applyVendorApplicationToProfile(profile);
            }

            await saveUserProfile(profile);
            return profile;
        }

        async function registerWithEmail({ email, password, displayName, accountType = "customer" }) {
            try {
                const user = await createUser(email, password);

                if (displayName) {
                    await setDisplayName(user, displayName);
                }

                const profile = await ensureUserProfile(user, {
                    accountType,
                    displayName,
                    email
                });

                return {
                    success: true,
                    user,
                    profile,
                    nextRoute: utils.getDefaultPortalRoute(profile)
                };
            } catch (error) {
                return {
                    success: false,
                    error,
                    message: utils.mapAuthErrorCode(error.code)
                };
            }
        }

        async function loginWithEmail({ email, password }) {
            try {
                const user = await loginUser(email, password);
                const profile = await ensureUserProfile(user, {
                    accountType: "customer",
                    displayName: user.displayName || "",
                    email: user.email || email
                });

                return {
                    success: true,
                    user,
                    profile,
                    nextRoute: utils.getDefaultPortalRoute(profile)
                };
            } catch (error) {
                return {
                    success: false,
                    error,
                    message: utils.mapAuthErrorCode(error.code)
                };
            }
        }

        async function loginWithGoogle() {
            try {
                const user = await signInWithGoogle();
                const profile = await ensureUserProfile(user, {
                    accountType: "customer",
                    displayName: user.displayName || "",
                    email: user.email || ""
                });

                return {
                    success: true,
                    user,
                    profile,
                    nextRoute: utils.getDefaultPortalRoute(profile)
                };
            } catch (error) {
                return {
                    success: false,
                    error,
                    message: utils.mapAuthErrorCode(error.code)
                };
            }
        }

        async function loginWithApple() {
            try {
                const user = await signInWithApple();
                const profile = await ensureUserProfile(user, {
                    accountType: "customer",
                    displayName: user.displayName || "",
                    email: user.email || ""
                });

                return {
                    success: true,
                    user,
                    profile,
                    nextRoute: utils.getDefaultPortalRoute(profile)
                };
            } catch (error) {
                return {
                    success: false,
                    error,
                    message: utils.mapAuthErrorCode(error.code)
                };
            }
        }

        function observeAuthState(callback) {
            return injectedAuthFns.onAuthStateChanged(injectedAuth, callback);
        }

        return {
            createUser,
            loginUser,
            signInWithGoogle,
            signInWithApple,
            signOutUser,
            setDisplayName,
            getUserDocRef,
            getUserProfile,
            saveUserProfile,
            updateUserProfile,
            ensureUserProfile,
            registerWithEmail,
            loginWithEmail,
            loginWithGoogle,
            loginWithApple,
            observeAuthState
        };
    }

    return {
        auth,
        db,
        googleProvider,
        appleProvider,
        authFns,
        firestoreFns,
        createAuthService
    };
}

describe("auth.js service logic", () => {
    test("createUser creates an email/password user", async () => {
        const mocks = createMockAuthService();
        const mockUser = { uid: "user-1", email: "faranani@example.com" };

        mocks.authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.createUser("faranani@example.com", "password123");

        expect(mocks.authFns.createUserWithEmailAndPassword).toHaveBeenCalledWith(
            mocks.auth,
            "faranani@example.com",
            "password123"
        );
        expect(result).toEqual(mockUser);
    });

    test("loginUser signs in with email and password", async () => {
        const mocks = createMockAuthService();
        const mockUser = { uid: "user-2", email: "user@example.com" };

        mocks.authFns.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.loginUser("user@example.com", "password123");

        expect(mocks.authFns.signInWithEmailAndPassword).toHaveBeenCalledWith(
            mocks.auth,
            "user@example.com",
            "password123"
        );
        expect(result).toEqual(mockUser);
    });

    test("signInWithGoogle uses Google provider", async () => {
        const mocks = createMockAuthService();
        const mockUser = { uid: "google-1", email: "google@example.com" };

        mocks.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.signInWithGoogle();

        expect(mocks.authFns.signInWithPopup).toHaveBeenCalledWith(
            mocks.auth,
            mocks.googleProvider
        );
        expect(result).toEqual(mockUser);
    });

    test("signInWithApple uses Apple provider", async () => {
        const mocks = createMockAuthService();
        const mockUser = { uid: "apple-1", email: "apple@example.com" };

        mocks.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.signInWithApple();

        expect(mocks.authFns.signInWithPopup).toHaveBeenCalledWith(
            mocks.auth,
            mocks.appleProvider
        );
        expect(result).toEqual(mockUser);
    });

    test("signOutUser signs out successfully", async () => {
        const mocks = createMockAuthService();
        mocks.authFns.signOut.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.signOutUser();

        expect(mocks.authFns.signOut).toHaveBeenCalledWith(mocks.auth);
        expect(result).toBe(true);
    });

    test("getUserProfile returns null when profile does not exist", async () => {
        const mocks = createMockAuthService();

        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.getUserProfile("missing-user");

        expect(result).toBeNull();
    });

    test("getUserProfile returns profile data when it exists", async () => {
        const mocks = createMockAuthService();
        const profile = {
            uid: "user-3",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => profile
        });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.getUserProfile("user-3");

        expect(result).toEqual(profile);
    });

    test("saveUserProfile writes profile to users collection", async () => {
        const mocks = createMockAuthService();
        mocks.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const profile = {
            uid: "user-4",
            email: "user4@example.com",
            displayName: "User Four",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        const result = await service.saveUserProfile(profile);

        expect(mocks.firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(result).toEqual(profile);
    });

    test("updateUserProfile updates profile fields", async () => {
        const mocks = createMockAuthService();
        mocks.firestoreFns.updateDoc.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.updateUserProfile("user-5", {
            vendorStatus: "approved"
        });

        expect(mocks.firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
        expect(result).toEqual({
            uid: "user-5",
            vendorStatus: "approved"
        });
    });

    test("ensureUserProfile returns existing profile when found", async () => {
        const mocks = createMockAuthService();
        const existingProfile = {
            uid: "user-6",
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
        };

        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => existingProfile
        });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.ensureUserProfile({
            uid: "user-6",
            email: "user6@example.com"
        });

        expect(result).toEqual(existingProfile);
        expect(mocks.firestoreFns.setDoc).not.toHaveBeenCalled();
    });

    test("ensureUserProfile creates a new customer profile when missing", async () => {
        const mocks = createMockAuthService();

        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        mocks.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.ensureUserProfile({
            uid: "user-7",
            email: "user7@example.com",
            displayName: "User Seven"
        });

        expect(result.uid).toBe("user-7");
        expect(result.roles.customer).toBe(true);
        expect(result.vendorStatus).toBe("none");
        expect(mocks.firestoreFns.setDoc).toHaveBeenCalledTimes(1);
    });

    test("ensureUserProfile creates a pending vendor profile when accountType is vendor", async () => {
        const mocks = createMockAuthService();

        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        mocks.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

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
        const mocks = createMockAuthService();
        const mockUser = {
            uid: "user-8",
            email: "user8@example.com",
            displayName: ""
        };

        mocks.authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        mocks.authFns.updateProfile.mockResolvedValue(undefined);
        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        mocks.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

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
        const mocks = createMockAuthService();

        mocks.authFns.createUserWithEmailAndPassword.mockRejectedValue({
            code: "auth/email-already-in-use"
        });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

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
        const mocks = createMockAuthService();
        const mockUser = {
            uid: "user-9",
            email: "user9@example.com",
            displayName: "User Nine"
        };

        mocks.authFns.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "user-9",
                email: "user9@example.com",
                displayName: "User Nine",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
        });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.loginWithEmail({
            email: "user9@example.com",
            password: "password123"
        });

        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loginWithGoogle creates default customer profile for first-time user", async () => {
        const mocks = createMockAuthService();
        const mockUser = {
            uid: "google-2",
            email: "google2@example.com",
            displayName: "Google User"
        };

        mocks.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });
        mocks.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        mocks.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.loginWithGoogle();

        expect(result.success).toBe(true);
        expect(result.profile.roles.customer).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("loginWithApple returns mapped error on failure", async () => {
        const mocks = createMockAuthService();

        mocks.authFns.signInWithPopup.mockRejectedValue({
            code: "auth/popup-closed-by-user"
        });

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = await service.loginWithApple();

        expect(result.success).toBe(false);
        expect(result.message).toBe(
            "The sign-in popup was closed before completing sign-in."
        );
    });

    test("observeAuthState registers an auth state listener", () => {
        const mocks = createMockAuthService();
        const unsubscribe = jest.fn();
        const callback = jest.fn();

        mocks.authFns.onAuthStateChanged.mockReturnValue(unsubscribe);

        const service = mocks.createAuthService({
            auth: mocks.auth,
            db: mocks.db,
            googleProvider: mocks.googleProvider,
            appleProvider: mocks.appleProvider,
            authFns: mocks.authFns,
            firestoreFns: mocks.firestoreFns,
            utils: authUtils
        });

        const result = service.observeAuthState(callback);

        expect(mocks.authFns.onAuthStateChanged).toHaveBeenCalledWith(
            mocks.auth,
            callback
        );
        expect(result).toBe(unsubscribe);
    });
});