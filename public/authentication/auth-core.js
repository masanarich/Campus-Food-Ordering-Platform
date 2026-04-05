/**
 * auth-core.js
 *
 * Testable authentication service logic for the Campus Food Ordering Platform.
 * This file contains no browser CDN imports and no direct DOM work.
 * It is designed to be the real unit-test target for authentication logic.
 */

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

    const authFns = ensureDependency(dependencies.authFns, "authFns");
    const firestoreFns = ensureDependency(dependencies.firestoreFns, "firestoreFns");
    const utils = ensureDependency(dependencies.utils, "utils");

    async function createUser(email, password) {
        const result = await authFns.createUserWithEmailAndPassword(
            injectedAuth,
            email,
            password
        );

        return result.user;
    }

    async function loginUser(email, password) {
        const result = await authFns.signInWithEmailAndPassword(
            injectedAuth,
            email,
            password
        );

        return result.user;
    }

    async function signInWithGoogle() {
        const result = await authFns.signInWithPopup(
            injectedAuth,
            injectedGoogleProvider
        );

        return result.user;
    }

    async function signInWithApple() {
        const result = await authFns.signInWithPopup(
            injectedAuth,
            injectedAppleProvider
        );

        return result.user;
    }

    async function signOutUser() {
        await authFns.signOut(injectedAuth);
        return true;
    }

    async function sendPasswordReset(email) {
        if (typeof authFns.sendPasswordResetEmail !== "function") {
            throw new Error("authFns.sendPasswordResetEmail is required.");
        }

        await authFns.sendPasswordResetEmail(injectedAuth, email);
        return true;
    }

    async function setDisplayName(user, displayName) {
        if (!user || !displayName) {
            return;
        }

        await authFns.updateProfile(user, {
            displayName
        });
    }

    function getUserDocRef(uid) {
        return firestoreFns.doc(injectedDb, "users", uid);
    }

    async function getUserProfile(uid) {
        const userRef = getUserDocRef(uid);
        const snapshot = await firestoreFns.getDoc(userRef);

        if (!snapshot.exists()) {
            return null;
        }

        return snapshot.data();
    }

    async function saveUserProfile(profile) {
        const userRef = getUserDocRef(profile.uid);

        await firestoreFns.setDoc(userRef, {
            ...profile,
            createdAt: firestoreFns.serverTimestamp(),
            updatedAt: firestoreFns.serverTimestamp()
        });

        return profile;
    }

    async function updateUserProfile(uid, updates) {
        const userRef = getUserDocRef(uid);

        await firestoreFns.updateDoc(userRef, {
            ...updates,
            updatedAt: firestoreFns.serverTimestamp()
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

    async function registerWithEmail({
        email,
        password,
        displayName,
        accountType = "customer"
    }) {
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

    async function sendPasswordResetEmail({ email }) {
        try {
            await sendPasswordReset(email);

            return {
                success: true
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
        return authFns.onAuthStateChanged(injectedAuth, callback);
    }

    return {
        createUser,
        loginUser,
        signInWithGoogle,
        signInWithApple,
        signOutUser,
        sendPasswordReset,
        sendPasswordResetEmail,
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

if (typeof module !== "undefined" && module.exports) {
    module.exports = {
        ensureDependency,
        createAuthService
    };
}

if (typeof window !== "undefined") {
    window.authCore = {
        ensureDependency,
        createAuthService
    };
}