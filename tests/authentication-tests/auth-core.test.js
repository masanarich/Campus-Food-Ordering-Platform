const authUtils = require("../../public/authentication/auth-utils.js");
const {
    ensureDependency,
    createAuthService
} = require("../../public/authentication/auth-core.js");

function createMockDependencies() {
    return {
        auth: {
            name: "mock-auth",
            currentUser: null
        },
        db: { name: "mock-db" },
<<<<<<< HEAD
        storage: { name: "mock-storage" },
=======
>>>>>>> 18e586b (fixed something)
        googleProvider: { providerId: "google.com" },
        appleProvider: { providerId: "apple.com" },
        authFns: {
            createUserWithEmailAndPassword: jest.fn(),
            signInWithEmailAndPassword: jest.fn(),
            signInWithPopup: jest.fn(),
            signOut: jest.fn(),
            onAuthStateChanged: jest.fn(),
            updateProfile: jest.fn(),
<<<<<<< HEAD
            sendPasswordResetEmail: jest.fn(),
            updatePassword: jest.fn(),
            deleteUser: jest.fn()
=======
            sendPasswordResetEmail: jest.fn()
>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
            deleteDoc: jest.fn(),
            serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
        },
        storageFns: {
            ref: jest.fn((storage, path) => ({
                storage,
                fullPath: path
            })),
            uploadBytes: jest.fn(),
            getDownloadURL: jest.fn(),
            deleteObject: jest.fn()
        },
        utils: {
            ...authUtils,
            getPostLoginRoute: jest.fn(() => "../customer/index.html")
        }
=======
            serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP")
        },
        utils: authUtils
>>>>>>> 18e586b (fixed something)
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

    test("createAuthService throws when db is missing", () => {
        const deps = createMockDependencies();
        delete deps.db;

        expect(() => createAuthService(deps)).toThrow("db is required.");
    });

    test("createAuthService throws when googleProvider is missing", () => {
        const deps = createMockDependencies();
        delete deps.googleProvider;

        expect(() => createAuthService(deps)).toThrow("googleProvider is required.");
    });

    test("createAuthService throws when appleProvider is missing", () => {
        const deps = createMockDependencies();
        delete deps.appleProvider;

        expect(() => createAuthService(deps)).toThrow("appleProvider is required.");
    });

    test("createAuthService throws when authFns is missing", () => {
        const deps = createMockDependencies();
        delete deps.authFns;

        expect(() => createAuthService(deps)).toThrow("authFns is required.");
    });

    test("createAuthService throws when firestoreFns is missing", () => {
        const deps = createMockDependencies();
        delete deps.firestoreFns;

        expect(() => createAuthService(deps)).toThrow("firestoreFns is required.");
    });

    test("createAuthService throws when utils is missing", () => {
        const deps = createMockDependencies();
        delete deps.utils;

        expect(() => createAuthService(deps)).toThrow("utils is required.");
    });
});

<<<<<<< HEAD
describe("auth-core basic auth methods", () => {
=======
describe("auth-core service", () => {
>>>>>>> 18e586b (fixed something)
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

<<<<<<< HEAD
    test("setDisplayName throws if updateProfile function is missing", async () => {
        const deps = createMockDependencies();
        delete deps.authFns.updateProfile;

        const service = createAuthService(deps);

        await expect(service.setDisplayName({ uid: "u1" }, "Name")).rejects.toThrow(
            "authFns.updateProfile is required."
        );
    });

    test("updateAuthUserProfile updates displayName and http photoURL", async () => {
        const deps = createMockDependencies();
        deps.authFns.updateProfile.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const user = { uid: "u2" };

        const result = await service.updateAuthUserProfile(user, {
            displayName: "Updated Name",
            photoURL: "https://example.com/photo.jpg"
        });

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(user, {
            displayName: "Updated Name",
            photoURL: "https://example.com/photo.jpg"
        });
        expect(result).toBe(true);
    });

    test("updateAuthUserProfile clears photoURL with null when blank", async () => {
        const deps = createMockDependencies();
        deps.authFns.updateProfile.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const user = { uid: "u3" };

        await service.updateAuthUserProfile(user, {
            photoURL: "   "
        });

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(user, {
            photoURL: null
        });
    });

    test("updateAuthUserProfile ignores non-http photoURL for auth update", async () => {
        const deps = createMockDependencies();
        deps.authFns.updateProfile.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const user = { uid: "u4" };

        await service.updateAuthUserProfile(user, {
            displayName: "Updated Name",
            photoURL: "gs://bucket/file.jpg"
        });

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(user, {
            displayName: "Updated Name"
        });
    });

    test("updateAuthUserProfile returns true when there is nothing to update and throws when user is missing", async () => {
        const deps = createMockDependencies();
        deps.authFns.updateProfile.mockResolvedValue(undefined);

        const service = createAuthService(deps);

        await expect(service.updateAuthUserProfile(null, {})).rejects.toThrow(
            "A user is required."
        );

        await expect(service.updateAuthUserProfile({ uid: "u5" }, {})).resolves.toBe(true);
        expect(deps.authFns.updateProfile).not.toHaveBeenCalled();
    });

=======
>>>>>>> 18e586b (fixed something)
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

<<<<<<< HEAD
    test("getCurrentUserOrThrow throws when there is no authenticated user", () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = null;

        const service = createAuthService(deps);

        expect(() => service.getCurrentUserOrThrow()).toThrow(
            "No authenticated user is available."
        );
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

describe("auth-core profile document methods", () => {
=======
>>>>>>> 18e586b (fixed something)
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

<<<<<<< HEAD
    test("getUserProfile returns null when uid is missing", async () => {
        const deps = createMockDependencies();
        const service = createAuthService(deps);

        await expect(service.getUserProfile("")).resolves.toBeNull();
        expect(deps.firestoreFns.getDoc).not.toHaveBeenCalled();
    });

=======
>>>>>>> 18e586b (fixed something)
    test("getUserProfile returns profile data when it exists", async () => {
        const deps = createMockDependencies();
        const profile = {
            uid: "user-3",
<<<<<<< HEAD
            email: "user3@example.com",
            isAdmin: false,
            vendorStatus: "none",
            adminApplicationStatus: "none",
            accountStatus: "active"
=======
            roles: { customer: true, vendor: false, admin: false },
            vendorStatus: "none"
>>>>>>> 18e586b (fixed something)
        };

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => profile
        });

        const service = createAuthService(deps);
        const result = await service.getUserProfile("user-3");

        expect(result).toEqual(profile);
    });

<<<<<<< HEAD
    test("getCurrentUserProfile returns null when there is no target uid", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = null;

        const service = createAuthService(deps);
        const result = await service.getCurrentUserProfile();

        expect(result).toBeNull();
    });

    test("saveUserProfile writes a normalized profile to users collection", async () => {
=======
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
>>>>>>> 18e586b (fixed something)
        const deps = createMockDependencies();
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);

        const profile = {
            uid: "user-4",
            email: "user4@example.com",
            displayName: "User Four",
<<<<<<< HEAD
=======
            roles: { customer: true, vendor: false, admin: false },
>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
            expect.objectContaining({
                uid: "user-4",
                displayName: "User Four",
                email: "user4@example.com",
                phoneNumber: "",
                photoURL: "",
                providerPhotoURL: "",
                uploadedPhotoURL: "",
                uploadedPhotoPath: "",
                isAdmin: false,
                vendorStatus: "none",
                vendorReason: "",
                adminApplicationStatus: "none",
                adminApplicationReason: "",
                accountStatus: "active",
                createdAt: "SERVER_TIMESTAMP",
                updatedAt: "SERVER_TIMESTAMP",
                lastLoginAt: "SERVER_TIMESTAMP"
            })
        );

        expect(result).toEqual(
            expect.objectContaining({
                uid: "user-4",
                displayName: "User Four",
                email: "user4@example.com",
                vendorStatus: "none",
                accountStatus: "active"
            })
        );
    });

    test("saveUserProfile with merge writes merge payload", async () => {
        const deps = createMockDependencies();
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);

        const result = await service.saveUserProfile(
            {
                uid: "user-merge",
                email: "merge@example.com",
                displayName: "Merge User",
                vendorStatus: "approved",
                accountStatus: "active"
            },
            { merge: true }
        );

        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-merge"
            },
            expect.objectContaining({
                uid: "user-merge",
                displayName: "Merge User",
                email: "merge@example.com",
                vendorStatus: "approved",
                accountStatus: "active",
                updatedAt: "SERVER_TIMESTAMP",
                lastLoginAt: "SERVER_TIMESTAMP"
            }),
            { merge: true }
        );

        expect(result).toEqual(
            expect.objectContaining({
                uid: "user-merge",
                displayName: "Merge User",
                email: "merge@example.com"
            })
        );
    });

    test("saveUserProfile throws when uid is missing", async () => {
        const deps = createMockDependencies();
        const service = createAuthService(deps);

        await expect(service.saveUserProfile({ email: "nouid@example.com" })).rejects.toThrow(
            "A valid profile uid is required."
        );
    });

    test("saveUserProfile uses fallback timestamp and profile normalisation when helper methods are missing", async () => {
        const deps = createMockDependencies();
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);
        delete deps.firestoreFns.serverTimestamp;
        delete deps.utils.normaliseUserData;
        delete deps.utils.normalizeUserData;

        const service = createAuthService(deps);
        const result = await service.saveUserProfile({
            uid: "fallback-user",
            displayName: "Fallback User",
            email: "fallback@example.com",
            vendorStatus: "unknown",
            adminApplicationStatus: "unknown",
            accountStatus: "unknown"
        });

        expect(result.uid).toBe("fallback-user");
        expect(result.vendorStatus).toBe("none");
        expect(result.adminApplicationStatus).toBe("none");
        expect(result.accountStatus).toBe("active");
        expect(typeof result.createdAt).toBe("string");
    });

    test("updateUserProfile updates profile fields and canonicalises statuses", async () => {
=======
            {
                ...profile,
                createdAt: "SERVER_TIMESTAMP",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );
        expect(result).toEqual(profile);
    });

    test("updateUserProfile updates profile fields", async () => {
>>>>>>> 18e586b (fixed something)
        const deps = createMockDependencies();
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);

        const result = await service.updateUserProfile("user-5", {
<<<<<<< HEAD
            vendorStatus: "suspended",
            vendorReason: "Policy issue",
            accountStatus: "unknown",
            isAdmin: true
        });

=======
            vendorStatus: "approved"
        });

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledTimes(1);
>>>>>>> 18e586b (fixed something)
        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-5"
            },
            {
<<<<<<< HEAD
                isAdmin: true,
                vendorStatus: "blocked",
                vendorReason: "Policy issue",
                accountStatus: "active",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );

        expect(result).toEqual({
            uid: "user-5",
            isAdmin: true,
            vendorStatus: "blocked",
            vendorReason: "Policy issue",
            accountStatus: "active",
            updatedAt: "SERVER_TIMESTAMP"
        });
    });

    test("updateUserProfile throws when uid is missing", async () => {
        const deps = createMockDependencies();
        const service = createAuthService(deps);

        await expect(service.updateUserProfile("", { displayName: "Name" })).rejects.toThrow(
            "uid is required."
        );
    });

    test("updateUserProfile canonicalises admin application state and uses fallback utility logic", async () => {
        const deps = createMockDependencies();
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        delete deps.utils.getVendorStatus;
        delete deps.utils.getAccountStatus;
        delete deps.utils.getAdminApplicationStatus;

        const service = createAuthService(deps);
        const result = await service.updateUserProfile("user-admin-status", {
            adminApplicationStatus: "suspended",
            adminApplicationReason: "Needs review",
            vendorStatus: "mystery",
            accountStatus: "mystery"
        });

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-admin-status"
            },
            {
                vendorStatus: "none",
                adminApplicationStatus: "blocked",
                adminApplicationReason: "Needs review",
                accountStatus: "active",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );

        expect(result.adminApplicationStatus).toBe("blocked");
    });
});

describe("auth-core current-user profile methods", () => {
    test("updateCurrentUserProfile updates auth profile and firestore profile", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "current-10",
            email: "current10@example.com"
        };
        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "current-10",
                email: "current10@example.com",
                providerPhotoURL: "",
                uploadedPhotoURL: "",
                uploadedPhotoPath: "",
                photoURL: ""
            })
        });

        const service = createAuthService(deps);
        const result = await service.updateCurrentUserProfile({
            displayName: "Current Ten",
            phoneNumber: "0123456789",
            photoURL: "https://example.com/new-photo.jpg",
            vendorStatus: "approved",
            vendorReason: "All good",
            accountStatus: "active"
        });

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(
            deps.auth.currentUser,
            {
                displayName: "Current Ten",
                photoURL: "https://example.com/new-photo.jpg"
            }
        );

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "current-10"
            },
            {
                displayName: "Current Ten",
                phoneNumber: "0123456789",
                photoURL: "https://example.com/new-photo.jpg",
                vendorStatus: "approved",
                vendorReason: "All good",
                accountStatus: "active",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );

        expect(result).toEqual(
            expect.objectContaining({
                uid: "current-10",
                email: "current10@example.com",
                displayName: "Current Ten",
                phoneNumber: "0123456789",
                photoURL: "https://example.com/new-photo.jpg",
                vendorStatus: "approved",
                vendorReason: "All good",
                accountStatus: "active"
            })
        );
    });

    test("setCurrentUserPhotoURL trims the photo URL", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "current-11",
            email: "current11@example.com"
        };
        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "current-11",
                email: "current11@example.com"
            })
        });

        const service = createAuthService(deps);
        await service.setCurrentUserPhotoURL("  https://example.com/photo.jpg  ");

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(
            deps.auth.currentUser,
            { photoURL: "https://example.com/photo.jpg" }
        );
    });

    test("updateCurrentUserProfile persists admin application updates", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "current-admin-1",
            email: "admin@example.com"
        };
        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "current-admin-1",
                email: "admin@example.com"
            })
        });

        const service = createAuthService(deps);
        const result = await service.updateCurrentUserProfile({
            adminApplicationStatus: "pending",
            adminApplicationReason: "Awaiting review"
        });

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "current-admin-1"
            },
            {
                adminApplicationStatus: "pending",
                adminApplicationReason: "Awaiting review",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );
        expect(result.adminApplicationStatus).toBe("pending");
    });
});

describe("auth-core photo storage methods", () => {
    test("getProfilePhotoStoragePath uses file extension from MIME type", () => {
        const deps = createMockDependencies();
        const service = createAuthService(deps);

        expect(
            service.getProfilePhotoStoragePath("abc123", { type: "image/png" })
        ).toBe("profilePhotos/abc123/profile.png");

        expect(
            service.getProfilePhotoStoragePath("abc123", { type: "image/webp" })
        ).toBe("profilePhotos/abc123/profile.webp");

        expect(
            service.getProfilePhotoStoragePath("abc123", { type: "image/gif" })
        ).toBe("profilePhotos/abc123/profile.gif");

        expect(
            service.getProfilePhotoStoragePath("abc123", { type: "image/jpeg" })
        ).toBe("profilePhotos/abc123/profile.jpg");
    });

    test("uploadCurrentUserPhoto uploads image and updates profile fields", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "photo-user-1",
            email: "photo1@example.com",
            photoURL: "https://provider.example.com/original.jpg"
        };

        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        deps.storageFns.uploadBytes.mockResolvedValue(undefined);
        deps.storageFns.getDownloadURL.mockResolvedValue(
            "https://storage.example.com/profile.png"
        );

        deps.firestoreFns.getDoc
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    uid: "photo-user-1",
                    email: "photo1@example.com",
                    providerPhotoURL: "",
                    uploadedPhotoURL: "",
                    uploadedPhotoPath: "",
                    photoURL: ""
                })
            })
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    uid: "photo-user-1",
                    email: "photo1@example.com",
                    providerPhotoURL: "",
                    uploadedPhotoURL: "",
                    uploadedPhotoPath: "",
                    photoURL: ""
                })
            });

        const service = createAuthService(deps);
        const file = {
            name: "profile.png",
            type: "image/png",
            size: 1024
        };

        const result = await service.uploadCurrentUserPhoto(file);

        expect(deps.storageFns.ref).toHaveBeenCalledWith(
            deps.storage,
            "profilePhotos/photo-user-1/profile.png"
        );

        expect(deps.storageFns.uploadBytes).toHaveBeenCalledWith(
            {
                storage: deps.storage,
                fullPath: "profilePhotos/photo-user-1/profile.png"
            },
            file,
            {
                contentType: "image/png",
                cacheControl: "public,max-age=3600"
            }
        );

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(
            deps.auth.currentUser,
            {
                photoURL: "https://storage.example.com/profile.png"
            }
        );

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "photo-user-1"
            },
            {
                photoURL: "https://storage.example.com/profile.png",
                providerPhotoURL: "https://provider.example.com/original.jpg",
                uploadedPhotoURL: "https://storage.example.com/profile.png",
                uploadedPhotoPath: "profilePhotos/photo-user-1/profile.png",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );

        expect(result).toEqual(
            expect.objectContaining({
                uid: "photo-user-1",
                photoURL: "https://storage.example.com/profile.png",
                providerPhotoURL: "https://provider.example.com/original.jpg",
                uploadedPhotoURL: "https://storage.example.com/profile.png",
                uploadedPhotoPath: "profilePhotos/photo-user-1/profile.png"
            })
        );
    });

    test("uploadCurrentUserPhoto rejects invalid files", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = { uid: "photo-user-2" };

        const service = createAuthService(deps);

        await expect(service.uploadCurrentUserPhoto(null)).rejects.toThrow(
            "A valid image file is required."
        );

        await expect(
            service.uploadCurrentUserPhoto({ type: "text/plain", size: 100 })
        ).rejects.toThrow("Please choose a valid image file.");

        await expect(
            service.uploadCurrentUserPhoto({
                type: "image/png",
                size: 6 * 1024 * 1024
            })
        ).rejects.toThrow("Please choose an image smaller than 5 MB.");
    });

    test("uploadCurrentUserPhoto throws when storage is unavailable or methods are missing", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = { uid: "photo-user-no-storage" };

        const noStorageService = createAuthService({
            ...deps,
            storage: null
        });

        await expect(
            noStorageService.uploadCurrentUserPhoto({ type: "image/png", size: 10 })
        ).rejects.toThrow("storage is required.");

        delete deps.storageFns.uploadBytes;
        const missingFnService = createAuthService(deps);

        await expect(
            missingFnService.uploadCurrentUserPhoto({ type: "image/png", size: 10 })
        ).rejects.toThrow("storageFns.uploadBytes is required.");
    });

    test("removeCurrentUserPhoto deletes uploaded image and restores provider photo", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "photo-user-3",
            email: "photo3@example.com"
        };

        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        deps.storageFns.deleteObject.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    uid: "photo-user-3",
                    email: "photo3@example.com",
                    providerPhotoURL: "https://provider.example.com/original.jpg",
                    uploadedPhotoURL: "https://storage.example.com/current.jpg",
                    uploadedPhotoPath: "profilePhotos/photo-user-3/profile.jpg",
                    photoURL: "https://storage.example.com/current.jpg"
                })
            })
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    uid: "photo-user-3",
                    email: "photo3@example.com",
                    providerPhotoURL: "https://provider.example.com/original.jpg",
                    uploadedPhotoURL: "https://storage.example.com/current.jpg",
                    uploadedPhotoPath: "profilePhotos/photo-user-3/profile.jpg",
                    photoURL: "https://storage.example.com/current.jpg"
                })
            });

        const service = createAuthService(deps);
        const result = await service.removeCurrentUserPhoto();

        expect(deps.storageFns.ref).toHaveBeenCalledWith(
            deps.storage,
            "profilePhotos/photo-user-3/profile.jpg"
        );
        expect(deps.storageFns.deleteObject).toHaveBeenCalled();

        expect(deps.authFns.updateProfile).toHaveBeenCalledWith(
            deps.auth.currentUser,
            { photoURL: "https://provider.example.com/original.jpg" }
        );

        expect(deps.firestoreFns.updateDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "photo-user-3"
            },
            {
                photoURL: "https://provider.example.com/original.jpg",
                providerPhotoURL: "https://provider.example.com/original.jpg",
                uploadedPhotoURL: "",
                uploadedPhotoPath: "",
                updatedAt: "SERVER_TIMESTAMP"
            }
        );

        expect(result).toEqual(
            expect.objectContaining({
                uid: "photo-user-3",
                photoURL: "https://provider.example.com/original.jpg",
                uploadedPhotoURL: "",
                uploadedPhotoPath: ""
            })
        );
    });

    test("removeCurrentUserPhoto ignores storage object-not-found", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "photo-user-4",
            email: "photo4@example.com"
        };

        deps.authFns.updateProfile.mockResolvedValue(undefined);
        deps.firestoreFns.updateDoc.mockResolvedValue(undefined);
        deps.storageFns.deleteObject.mockRejectedValue({
            code: "storage/object-not-found"
        });

        deps.firestoreFns.getDoc
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    uid: "photo-user-4",
                    email: "photo4@example.com",
                    providerPhotoURL: "https://provider.example.com/original.jpg",
                    uploadedPhotoURL: "https://storage.example.com/current.jpg",
                    uploadedPhotoPath: "profilePhotos/photo-user-4/profile.jpg",
                    photoURL: "https://storage.example.com/current.jpg"
                })
            })
            .mockResolvedValueOnce({
                exists: () => true,
                data: () => ({
                    uid: "photo-user-4",
                    email: "photo4@example.com",
                    providerPhotoURL: "https://provider.example.com/original.jpg",
                    uploadedPhotoURL: "https://storage.example.com/current.jpg",
                    uploadedPhotoPath: "profilePhotos/photo-user-4/profile.jpg",
                    photoURL: "https://storage.example.com/current.jpg"
                })
            });

        const service = createAuthService(deps);
        await expect(service.removeCurrentUserPhoto()).resolves.toEqual(
            expect.objectContaining({
                uid: "photo-user-4",
                uploadedPhotoURL: "",
                uploadedPhotoPath: ""
            })
        );
    });

    test("removeCurrentUserPhoto rethrows unexpected storage errors", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "photo-user-5",
            email: "photo5@example.com"
        };
        deps.storageFns.deleteObject.mockRejectedValue(new Error("Delete failed"));
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "photo-user-5",
                uploadedPhotoPath: "profilePhotos/photo-user-5/profile.jpg",
                providerPhotoURL: "",
                photoURL: ""
            })
        });

        const service = createAuthService(deps);
        await expect(service.removeCurrentUserPhoto()).rejects.toThrow("Delete failed");
    });
});

describe("auth-core password and account deletion methods", () => {
    test("changeCurrentUserPassword updates password when valid", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "pwd-user-1",
            email: "pwd1@example.com"
        };
        deps.authFns.updatePassword.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.changeCurrentUserPassword("password123");

        expect(deps.authFns.updatePassword).toHaveBeenCalledWith(
            deps.auth.currentUser,
            "password123"
        );
        expect(result).toEqual({ success: true });
    });

    test("changeCurrentUserPassword rejects short passwords", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = { uid: "pwd-user-2" };

        const service = createAuthService(deps);

        await expect(service.changeCurrentUserPassword("short")).rejects.toThrow(
            "A valid new password of at least 8 characters is required."
        );
    });

    test("deleteCurrentUserAccount deletes photo, profile document, and auth user", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "delete-user-1",
            email: "delete1@example.com"
        };

        deps.storageFns.deleteObject.mockResolvedValue(undefined);
        deps.firestoreFns.deleteDoc.mockResolvedValue(undefined);
        deps.authFns.deleteUser.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "delete-user-1",
                uploadedPhotoPath: "profilePhotos/delete-user-1/profile.jpg"
            })
        });

        const service = createAuthService(deps);
        const result = await service.deleteCurrentUserAccount();

        expect(deps.storageFns.ref).toHaveBeenCalledWith(
            deps.storage,
            "profilePhotos/delete-user-1/profile.jpg"
        );
        expect(deps.storageFns.deleteObject).toHaveBeenCalled();
        expect(deps.firestoreFns.deleteDoc).toHaveBeenCalledWith({
            database: deps.db,
            collectionName: "users",
            uid: "delete-user-1"
        });
        expect(deps.authFns.deleteUser).toHaveBeenCalledWith(deps.auth.currentUser);
        expect(result).toEqual({ success: true });
    });

    test("deleteCurrentUserAccount skips profile deletion when deleteProfile is false", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "delete-user-2",
            email: "delete2@example.com"
        };

        deps.authFns.deleteUser.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "delete-user-2",
                uploadedPhotoPath: ""
            })
        });

        const service = createAuthService(deps);
        const result = await service.deleteCurrentUserAccount({
            deleteProfile: false
        });

        expect(deps.firestoreFns.deleteDoc).not.toHaveBeenCalled();
        expect(deps.authFns.deleteUser).toHaveBeenCalledWith(deps.auth.currentUser);
        expect(result).toEqual({ success: true });
    });

    test("deleteCurrentUserAccount ignores missing storage object and rethrows unexpected storage errors", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "delete-user-3",
            email: "delete3@example.com"
        };

        deps.authFns.deleteUser.mockResolvedValue(undefined);
        deps.firestoreFns.deleteDoc.mockResolvedValue(undefined);
        deps.storageFns.deleteObject.mockRejectedValueOnce({
            code: "storage/object-not-found"
        });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "delete-user-3",
                uploadedPhotoPath: "profilePhotos/delete-user-3/profile.jpg"
            })
        });

        const service = createAuthService(deps);
        await expect(service.deleteCurrentUserAccount()).resolves.toEqual({ success: true });

        deps.storageFns.deleteObject.mockRejectedValueOnce(new Error("Storage delete failed"));
        await expect(service.deleteCurrentUserAccount()).rejects.toThrow("Storage delete failed");
    });

    test("deleteCurrentUserAccount throws when deleteDoc function is missing", async () => {
        const deps = createMockDependencies();
        deps.auth.currentUser = {
            uid: "delete-user-4",
            email: "delete4@example.com"
        };
        delete deps.firestoreFns.deleteDoc;
        deps.authFns.deleteUser.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "delete-user-4",
                uploadedPhotoPath: ""
            })
        });

        const service = createAuthService(deps);
        await expect(service.deleteCurrentUserAccount()).rejects.toThrow(
            "firestoreFns.deleteDoc is required."
        );
    });
});

describe("auth-core profile sync and auth flows", () => {
    test("ensureUserProfile syncs an existing profile with a merge save", async () => {
        const deps = createMockDependencies();
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const existingProfile = {
            uid: "user-6",
            displayName: "Old Name",
            email: "old@example.com",
            phoneNumber: "",
            photoURL: "",
            providerPhotoURL: "",
            uploadedPhotoURL: "",
            uploadedPhotoPath: "",
            isAdmin: true,
            vendorStatus: "approved",
            vendorReason: "",
            adminApplicationStatus: "approved",
            adminApplicationReason: "",
            accountStatus: "active"
=======
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
>>>>>>> 18e586b (fixed something)
        };

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => existingProfile
        });

        const service = createAuthService(deps);
<<<<<<< HEAD
        const result = await service.ensureUserProfile(
            {
                uid: "user-6",
                email: "updated@example.com",
                displayName: "Updated Name",
                photoURL: "https://provider.example.com/auth.jpg"
            },
            {
                displayName: "Updated Name",
                email: "updated@example.com",
                phoneNumber: "0123456789",
                photoURL: "https://provider.example.com/auth.jpg",
                providerPhotoURL: "https://provider.example.com/auth.jpg"
            }
        );

        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-6"
            },
            expect.objectContaining({
                uid: "user-6",
                displayName: "Updated Name",
                email: "updated@example.com",
                phoneNumber: "0123456789",
                providerPhotoURL: "https://provider.example.com/auth.jpg",
                isAdmin: true,
                vendorStatus: "approved",
                adminApplicationStatus: "approved",
                adminApplicationReason: "",
                accountStatus: "active",
                updatedAt: "SERVER_TIMESTAMP",
                lastLoginAt: "SERVER_TIMESTAMP"
            }),
            { merge: true }
        );

        expect(result).toEqual(
            expect.objectContaining({
                uid: "user-6",
                displayName: "Updated Name",
                email: "updated@example.com",
                providerPhotoURL: "https://provider.example.com/auth.jpg"
            })
        );
=======
        const result = await service.ensureUserProfile({
            uid: "user-6",
            email: "user6@example.com"
        });

        expect(result).toEqual(existingProfile);
        expect(deps.firestoreFns.setDoc).not.toHaveBeenCalled();
>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
            displayName: "User Seven",
            photoURL: "https://provider.example.com/user7.jpg"
        });

        expect(deps.firestoreFns.setDoc).toHaveBeenCalledTimes(1);
        expect(result).toEqual(
            expect.objectContaining({
                uid: "user-7",
                email: "user7@example.com",
                displayName: "User Seven",
                vendorStatus: "none",
                adminApplicationStatus: "none"
            })
        );
=======
            displayName: "User Seven"
        });

        expect(result.uid).toBe("user-7");
        expect(result.roles.customer).toBe(true);
        expect(result.vendorStatus).toBe("none");
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledTimes(1);
>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
                displayName: "Vendor Two",
                photoURL: "https://provider.example.com/vendor2.jpg"
=======
                displayName: "Vendor Two"
>>>>>>> 18e586b (fixed something)
            },
            {
                accountType: "vendor",
                displayName: "Vendor Two",
<<<<<<< HEAD
                email: "vendor2@example.com",
                phoneNumber: "0712345678",
                businessName: "Campus Bites",
                university: "Wits University",
                location: "Matrix Food Court",
                foodType: "fast-food",
                description: "Fresh campus meals every day for busy students."
            }
        );

        expect(result.uid).toBe("vendor-2");
        expect(result.vendorStatus).toBe("pending");
        expect(result.adminApplicationStatus).toBe("none");
        expect(result.vendorBusinessName).toBe("Campus Bites");
        expect(result.vendorUniversity).toBe("Wits University");
    });

    test("ensureUserProfile creates a pending admin application profile when accountType is admin", async () => {
        const deps = createMockDependencies();

        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.ensureUserProfile(
            {
                uid: "admin-2",
                email: "admin2@example.com",
                displayName: "Admin Two",
                photoURL: "https://provider.example.com/admin2.jpg"
            },
            {
                accountType: "admin",
                displayName: "Admin Two",
                email: "admin2@example.com",
                phoneNumber: "0712345678",
                department: "Student Affairs",
                motivation: "I need admin access to support platform operations."
            }
        );

        expect(result.uid).toBe("admin-2");
        expect(result.vendorStatus).toBe("none");
        expect(result.adminApplicationStatus).toBe("pending");
        expect(result.adminDepartment).toBe("Student Affairs");
        expect(result.adminMotivation).toBe(
            "I need admin access to support platform operations."
        );
    });

    test("ensureUserProfile uses fallback sync logic when merge helper is missing and throws for invalid auth user", async () => {
        const deps = createMockDependencies();
        delete deps.utils.mergeProfileWithAuthData;
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
            data: () => ({
                uid: "fallback-sync",
                displayName: "Old Name",
                email: "old@example.com",
                phoneNumber: "",
                photoURL: "",
                uploadedPhotoURL: "",
                uploadedPhotoPath: "",
                isAdmin: false,
                vendorStatus: "suspended",
                vendorReason: "",
                adminApplicationStatus: "suspended",
                adminApplicationReason: "",
                accountStatus: "unknown"
            })
        });

        const service = createAuthService(deps);
        const result = await service.ensureUserProfile(
            {
                uid: "fallback-sync",
                email: "updated@example.com",
                displayName: "Updated Name",
                photoURL: "https://provider.example.com/new.jpg"
            },
            {
                displayName: "Updated Name",
                email: "updated@example.com",
                phoneNumber: "0123456789",
                photoURL: "https://provider.example.com/new.jpg"
            }
        );

        expect(result.vendorStatus).toBe("blocked");
        expect(result.adminApplicationStatus).toBe("blocked");
        expect(result.accountStatus).toBe("active");

        await expect(service.ensureUserProfile(null)).rejects.toThrow(
            "A valid authenticated user is required."
        );
=======
                email: "vendor2@example.com"
            }
        );

        expect(result.vendorStatus).toBe("pending");
>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
        expect(result.profile).toEqual(
            expect.objectContaining({
                uid: "user-8",
                email: "user8@example.com",
                displayName: "User Eight",
                adminApplicationStatus: "none"
            })
        );
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("registerWithEmail creates a pending admin application for admin sign-ups", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "user-admin-8",
            email: "admin8@example.com",
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
            email: "admin8@example.com",
            password: "password123",
            displayName: "Admin Eight",
            accountType: "admin",
            phoneNumber: "0712345678",
            department: "Student Affairs",
            motivation: "I need access to help manage platform operations and users."
        });

        expect(result.success).toBe(true);
        expect(result.profile).toEqual(
            expect.objectContaining({
                uid: "user-admin-8",
                email: "admin8@example.com",
                displayName: "Admin Eight",
                isAdmin: false,
                adminApplicationStatus: "pending",
                adminDepartment: "Student Affairs"
            })
        );
=======
        expect(result.profile.roles.customer).toBe(true);
>>>>>>> 18e586b (fixed something)
        expect(result.nextRoute).toBe("../customer/index.html");
    });

    test("registerWithEmail succeeds without displayName", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "user-8b",
            email: "user8b@example.com",
            displayName: ""
        };

        deps.authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.registerWithEmail({
            email: "user8b@example.com",
            password: "password123",
            accountType: "customer"
        });

        expect(result.success).toBe(true);
        expect(deps.authFns.updateProfile).not.toHaveBeenCalled();
    });

<<<<<<< HEAD
=======
    test("registerWithEmail returns success with vendor route decision", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "vendor-8",
            email: "vendor8@example.com",
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
            email: "vendor8@example.com",
            password: "password123",
            displayName: "Vendor Eight",
            accountType: "vendor"
        });

        expect(result.success).toBe(true);
        expect(result.profile.vendorStatus).toBe("pending");
        expect(result.nextRoute).toBe("../customer/index.html");
    });

>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
            displayName: "User Nine",
            photoURL: "https://provider.example.com/user9.jpg"
        };

        const existingProfile = {
            uid: "user-9",
            email: "user9@example.com",
            displayName: "User Nine",
            phoneNumber: "",
            photoURL: "",
            providerPhotoURL: "",
            uploadedPhotoURL: "",
            uploadedPhotoPath: "",
            isAdmin: false,
            vendorStatus: "none",
            vendorReason: "",
            adminApplicationStatus: "none",
            adminApplicationReason: "",
            accountStatus: "active"
=======
            displayName: "User Nine"
>>>>>>> 18e586b (fixed something)
        };

        deps.authFns.signInWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => true,
<<<<<<< HEAD
            data: () => existingProfile
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);
=======
            data: () => ({
                uid: "user-9",
                email: "user9@example.com",
                displayName: "User Nine",
                roles: { customer: true, vendor: false, admin: false },
                vendorStatus: "none"
            })
        });
>>>>>>> 18e586b (fixed something)

        const service = createAuthService(deps);
        const result = await service.loginWithEmail({
            email: "user9@example.com",
            password: "password123"
        });

        expect(result.success).toBe(true);
        expect(result.nextRoute).toBe("../customer/index.html");
<<<<<<< HEAD
        expect(deps.firestoreFns.setDoc).toHaveBeenCalledWith(
            {
                database: deps.db,
                collectionName: "users",
                uid: "user-9"
            },
            expect.objectContaining({
                uid: "user-9",
                email: "user9@example.com",
                displayName: "User Nine",
                vendorStatus: "none",
                accountStatus: "active"
            }),
            { merge: true }
        );
=======
>>>>>>> 18e586b (fixed something)
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
<<<<<<< HEAD
            displayName: "Google User",
            photoURL: "https://provider.example.com/google2.jpg"
=======
            displayName: "Google User"
>>>>>>> 18e586b (fixed something)
        };

        deps.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.loginWithGoogle();

        expect(result.success).toBe(true);
<<<<<<< HEAD
        expect(result.profile).toEqual(
            expect.objectContaining({
                uid: "google-2",
                email: "google2@example.com",
                displayName: "Google User"
            })
        );
=======
        expect(result.profile.roles.customer).toBe(true);
>>>>>>> 18e586b (fixed something)
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

    test("loginWithApple creates default customer profile for first-time user", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "apple-2",
            email: "apple2@example.com",
<<<<<<< HEAD
            displayName: "Apple User",
            photoURL: "https://provider.example.com/apple2.jpg"
=======
            displayName: "Apple User"
>>>>>>> 18e586b (fixed something)
        };

        deps.authFns.signInWithPopup.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const result = await service.loginWithApple();

        expect(result.success).toBe(true);
<<<<<<< HEAD
        expect(result.profile).toEqual(
            expect.objectContaining({
                uid: "apple-2",
                email: "apple2@example.com",
                displayName: "Apple User"
            })
        );
=======
        expect(result.profile.roles.customer).toBe(true);
>>>>>>> 18e586b (fixed something)
        expect(result.nextRoute).toBe("../customer/index.html");
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

<<<<<<< HEAD
    test("auth flows fall back to generic next route and generic error message when utils helpers are missing", async () => {
        const deps = createMockDependencies();
        const mockUser = {
            uid: "fallback-auth-flow",
            email: "fallback@example.com",
            displayName: "Fallback User"
        };

        delete deps.utils.getPostLoginRoute;
        delete deps.utils.getDefaultPortalRoute;
        delete deps.utils.mapAuthErrorCode;

        deps.authFns.createUserWithEmailAndPassword.mockResolvedValue({ user: mockUser });
        deps.firestoreFns.getDoc.mockResolvedValue({
            exists: () => false
        });
        deps.firestoreFns.setDoc.mockResolvedValue(undefined);

        const service = createAuthService(deps);
        const successResult = await service.registerWithEmail({
            email: "fallback@example.com",
            password: "password123",
            displayName: "Fallback User",
            accountType: "customer"
        });

        expect(successResult.nextRoute).toBe("../customer/index.html");

        deps.authFns.signInWithEmailAndPassword.mockRejectedValue({});
        const failureResult = await service.loginWithEmail({
            email: "fallback@example.com",
            password: "wrongpass"
        });

        expect(failureResult.success).toBe(false);
        expect(failureResult.message).toBe("Something went wrong. Please try again.");
    });
});
=======
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
>>>>>>> 18e586b (fixed something)
