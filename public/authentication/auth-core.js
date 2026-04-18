/**
 * auth-core.js
 *
 * Testable authentication service logic for the Campus Food Ordering Platform.
 * This file contains no browser CDN imports and no direct DOM work.
 * It is designed to be the real unit-test target for authentication logic.
 *
 * Firestore source of truth:
 * - isAdmin
 * - vendorStatus
 * - vendorReason
 * - adminApplicationStatus
 * - adminApplicationReason
 * - accountStatus
 *
 * Profile photo fields:
 * - photoURL: currently active profile image used by the app
 * - providerPhotoURL: original Google / Apple profile image if available
 * - uploadedPhotoURL: Firebase Storage download URL for the uploaded image
 * - uploadedPhotoPath: Firebase Storage object path for delete / replace actions
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
    const injectedStorage = dependencies.storage || null;

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
    const storageFns = dependencies.storageFns || {};
    const utils = ensureDependency(dependencies.utils, "utils");

    function getSafeServerTimestamp() {
        if (typeof firestoreFns.serverTimestamp === "function") {
            return firestoreFns.serverTimestamp();
        }

        return new Date().toISOString();
    }

    function normalizeUrlLikeValue(value) {
        return typeof value === "string" ? value.trim() : "";
    }

    function isHttpPhotoUrl(value) {
        return /^https?:\/\//i.test(normalizeUrlLikeValue(value));
    }

    function normaliseProfile(profile) {
        if (typeof utils.normaliseUserData === "function") {
            return utils.normaliseUserData(profile);
        }

        if (typeof utils.normalizeUserData === "function") {
            return utils.normalizeUserData(profile);
        }

        return profile || {};
    }

    function getExtendedProfile(profile) {
        const rawProfile = profile && typeof profile === "object" ? profile : {};
        const safeProfile = normaliseProfile(rawProfile);

        return {
            ...safeProfile,
            providerPhotoURL: normalizeUrlLikeValue(rawProfile.providerPhotoURL),
            uploadedPhotoURL: normalizeUrlLikeValue(rawProfile.uploadedPhotoURL),
            uploadedPhotoPath: normalizeUrlLikeValue(rawProfile.uploadedPhotoPath),
            photoURL: normalizeUrlLikeValue(rawProfile.photoURL || safeProfile.photoURL)
        };
    }

    function getSafeNextRoute(profile) {
        if (typeof utils.getPostLoginRoute === "function") {
            return utils.getPostLoginRoute(profile);
        }

        if (typeof utils.getDefaultPortalRoute === "function") {
            return utils.getDefaultPortalRoute(profile);
        }

        return "../customer/index.html";
    }

    function setIfDefined(target, key, value) {
        if (value !== undefined) {
            target[key] = value;
        }
    }

    function requireAuthFunction(name) {
        if (typeof authFns[name] !== "function") {
            throw new Error(`authFns.${name} is required.`);
        }

        return authFns[name];
    }

    function requireFirestoreFunction(name) {
        if (typeof firestoreFns[name] !== "function") {
            throw new Error(`firestoreFns.${name} is required.`);
        }

        return firestoreFns[name];
    }

    function requireStorageFunction(name) {
        if (!injectedStorage) {
            throw new Error("storage is required.");
        }

        if (typeof storageFns[name] !== "function") {
            throw new Error(`storageFns.${name} is required.`);
        }

        return storageFns[name];
    }

    function getCurrentUserOrThrow() {
        const user = getCurrentUser();

        if (!user) {
            throw new Error("No authenticated user is available.");
        }

        return user;
    }

    function getCanonicalVendorStatus(value) {
        if (typeof utils.getVendorStatus === "function") {
            return utils.getVendorStatus({ vendorStatus: value });
        }

        const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

        if (normalizedValue === "suspended") {
            return "blocked";
        }

        if (
            normalizedValue === "none" ||
            normalizedValue === "pending" ||
            normalizedValue === "approved" ||
            normalizedValue === "rejected" ||
            normalizedValue === "blocked"
        ) {
            return normalizedValue;
        }

        return "none";
    }

    function getCanonicalAccountStatus(value) {
        if (typeof utils.getAccountStatus === "function") {
            return utils.getAccountStatus({ accountStatus: value });
        }

        const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

        if (
            normalizedValue === "active" ||
            normalizedValue === "disabled" ||
            normalizedValue === "blocked"
        ) {
            return normalizedValue;
        }

        return "active";
    }

    function getCanonicalAdminApplicationStatus(value, isAdmin = false) {
        if (typeof utils.getAdminApplicationStatus === "function") {
            return utils.getAdminApplicationStatus({
                adminApplicationStatus: value,
                isAdmin
            });
        }

        const normalizedValue = typeof value === "string" ? value.trim().toLowerCase() : "";

        if (normalizedValue === "suspended") {
            return "blocked";
        }

        if (
            normalizedValue === "none" ||
            normalizedValue === "pending" ||
            normalizedValue === "approved" ||
            normalizedValue === "rejected" ||
            normalizedValue === "blocked"
        ) {
            return normalizedValue;
        }

        return isAdmin === true ? "approved" : "none";
    }

    function toPersistedUserProfile(profile) {
        const rawProfile = profile && typeof profile === "object" ? profile : {};
        const safeProfile = normaliseProfile(rawProfile);
        const isAdmin = safeProfile.isAdmin === true;

        return {
            uid: safeProfile.uid || "",
            displayName: safeProfile.displayName || "",
            email: safeProfile.email || "",
            phoneNumber: safeProfile.phoneNumber || "",
            photoURL: normalizeUrlLikeValue(rawProfile.photoURL || safeProfile.photoURL),
            providerPhotoURL: normalizeUrlLikeValue(rawProfile.providerPhotoURL),
            uploadedPhotoURL: normalizeUrlLikeValue(rawProfile.uploadedPhotoURL),
            uploadedPhotoPath: normalizeUrlLikeValue(rawProfile.uploadedPhotoPath),
            isAdmin,
            vendorStatus: getCanonicalVendorStatus(safeProfile.vendorStatus),
            vendorReason: safeProfile.vendorReason || "",
            adminApplicationStatus: getCanonicalAdminApplicationStatus(
                safeProfile.adminApplicationStatus,
                isAdmin
            ),
            adminApplicationReason: safeProfile.adminApplicationReason || "",
            accountStatus: getCanonicalAccountStatus(safeProfile.accountStatus),
            createdAt: safeProfile.createdAt || null,
            updatedAt: safeProfile.updatedAt || null,
            lastLoginAt: safeProfile.lastLoginAt || null
        };
    }

    function buildCreateProfilePayload(profile) {
        const persistedProfile = toPersistedUserProfile(profile);

        return {
            ...persistedProfile,
            createdAt: getSafeServerTimestamp(),
            updatedAt: getSafeServerTimestamp(),
            lastLoginAt: getSafeServerTimestamp()
        };
    }

    function buildMergeProfilePayload(profile) {
        const persistedProfile = toPersistedUserProfile(profile);

        return {
            uid: persistedProfile.uid,
            displayName: persistedProfile.displayName,
            email: persistedProfile.email,
            phoneNumber: persistedProfile.phoneNumber,
            photoURL: persistedProfile.photoURL,
            providerPhotoURL: persistedProfile.providerPhotoURL,
            uploadedPhotoURL: persistedProfile.uploadedPhotoURL,
            uploadedPhotoPath: persistedProfile.uploadedPhotoPath,
            isAdmin: persistedProfile.isAdmin,
            vendorStatus: persistedProfile.vendorStatus,
            vendorReason: persistedProfile.vendorReason,
            adminApplicationStatus: persistedProfile.adminApplicationStatus,
            adminApplicationReason: persistedProfile.adminApplicationReason,
            accountStatus: persistedProfile.accountStatus,
            updatedAt: getSafeServerTimestamp(),
            lastLoginAt: getSafeServerTimestamp()
        };
    }

    function buildUpdateProfilePayload(updates) {
        const safeUpdates = updates && typeof updates === "object" ? updates : {};
        const payload = {};

        setIfDefined(payload, "displayName", safeUpdates.displayName);
        setIfDefined(payload, "email", safeUpdates.email);
        setIfDefined(payload, "phoneNumber", safeUpdates.phoneNumber);
        setIfDefined(payload, "photoURL", safeUpdates.photoURL);
        setIfDefined(payload, "providerPhotoURL", safeUpdates.providerPhotoURL);
        setIfDefined(payload, "uploadedPhotoURL", safeUpdates.uploadedPhotoURL);
        setIfDefined(payload, "uploadedPhotoPath", safeUpdates.uploadedPhotoPath);

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "isAdmin")) {
            payload.isAdmin = safeUpdates.isAdmin === true;
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "vendorStatus")) {
            payload.vendorStatus = getCanonicalVendorStatus(safeUpdates.vendorStatus);
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "vendorReason")) {
            payload.vendorReason = safeUpdates.vendorReason || "";
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "adminApplicationStatus")) {
            payload.adminApplicationStatus = getCanonicalAdminApplicationStatus(
                safeUpdates.adminApplicationStatus,
                payload.isAdmin === true || safeUpdates.isAdmin === true
            );
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "adminApplicationReason")) {
            payload.adminApplicationReason = safeUpdates.adminApplicationReason || "";
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "accountStatus")) {
            payload.accountStatus = getCanonicalAccountStatus(safeUpdates.accountStatus);
        }

        payload.updatedAt = getSafeServerTimestamp();

        return payload;
    }

    function getProviderPhotoCandidate(existingProfile, authUser, explicitPhotoURL = "") {
        const extendedExisting = getExtendedProfile(existingProfile);
        const existingProviderPhotoURL = normalizeUrlLikeValue(extendedExisting.providerPhotoURL);
        const explicitProviderPhotoURL = normalizeUrlLikeValue(explicitPhotoURL);
        const authPhotoURL = normalizeUrlLikeValue(authUser && authUser.photoURL);

        if (existingProviderPhotoURL) {
            return existingProviderPhotoURL;
        }

        if (explicitProviderPhotoURL) {
            return explicitProviderPhotoURL;
        }

        if (authPhotoURL) {
            return authPhotoURL;
        }

        return "";
    }

    function getProfilePhotoStoragePath(uid, file) {
        const safeUid = typeof uid === "string" ? uid.trim() : "";
        const safeFile = file && typeof file === "object" ? file : {};
        const contentType = normalizeUrlLikeValue(safeFile.type).toLowerCase();

        let extension = "jpg";

        if (contentType === "image/png") {
            extension = "png";
        } else if (contentType === "image/webp") {
            extension = "webp";
        } else if (contentType === "image/gif") {
            extension = "gif";
        }

        return `profilePhotos/${safeUid}/profile.${extension}`;
    }

    async function writeProfile(userRef, payload, options = {}) {
        const hasOptions = options && Object.keys(options).length > 0;

        if (hasOptions) {
            await firestoreFns.setDoc(userRef, payload, options);
            return;
        }

        await firestoreFns.setDoc(userRef, payload);
    }

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
        requireAuthFunction("sendPasswordResetEmail");
        await authFns.sendPasswordResetEmail(injectedAuth, email);
        return true;
    }

    async function setDisplayName(user, displayName) {
        if (!user || !displayName) {
            return;
        }

        requireAuthFunction("updateProfile");
        await authFns.updateProfile(user, { displayName });
    }

    async function updateAuthUserProfile(user, updates = {}) {
        if (!user) {
            throw new Error("A user is required.");
        }

        requireAuthFunction("updateProfile");

        const safeUpdates = updates && typeof updates === "object" ? updates : {};
        const authProfileUpdates = {};

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "displayName")) {
            authProfileUpdates.displayName = safeUpdates.displayName || "";
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "photoURL")) {
            const photoURL = normalizeUrlLikeValue(safeUpdates.photoURL);

            if (!photoURL) {
                authProfileUpdates.photoURL = null;
            } else if (isHttpPhotoUrl(photoURL)) {
                authProfileUpdates.photoURL = photoURL;
            }
        }

        if (Object.keys(authProfileUpdates).length === 0) {
            return true;
        }

        await authFns.updateProfile(user, authProfileUpdates);
        return true;
    }

    function getCurrentUser() {
        return injectedAuth.currentUser || null;
    }

    function getUserDocRef(uid) {
        return firestoreFns.doc(injectedDb, "users", uid);
    }

    async function getUserProfile(uid) {
        if (!uid) {
            return null;
        }

        const userRef = getUserDocRef(uid);
        const snapshot = await firestoreFns.getDoc(userRef);

        if (!snapshot.exists()) {
            return null;
        }

        return snapshot.data();
    }

    async function getCurrentUserProfile(uid) {
        const currentUser = getCurrentUser();
        const targetUid = uid || (currentUser && currentUser.uid);

        if (!targetUid) {
            return null;
        }

        return getUserProfile(targetUid);
    }

    async function saveUserProfile(profile, options = {}) {
        const safeProfile = toPersistedUserProfile(profile);

        if (!safeProfile.uid) {
            throw new Error("A valid profile uid is required.");
        }

        const userRef = getUserDocRef(safeProfile.uid);
        const shouldMerge = options.merge === true;

        if (shouldMerge) {
            const payload = buildMergeProfilePayload(safeProfile);
            await writeProfile(userRef, payload, { merge: true });

            return getExtendedProfile({
                ...safeProfile,
                ...payload
            });
        }

        const payload = buildCreateProfilePayload(safeProfile);
        await writeProfile(userRef, payload);

        return getExtendedProfile({
            ...safeProfile,
            ...payload
        });
    }

    async function updateUserProfile(uid, updates) {
        if (!uid) {
            throw new Error("uid is required.");
        }

        const userRef = getUserDocRef(uid);
        const payload = buildUpdateProfilePayload(updates);

        await firestoreFns.updateDoc(userRef, payload);

        return {
            uid,
            ...payload
        };
    }

    async function updateCurrentUserProfile(updates = {}) {
        const user = getCurrentUserOrThrow();
        const safeUpdates = updates && typeof updates === "object" ? updates : {};

        await updateAuthUserProfile(user, safeUpdates);

        const firestoreUpdates = {};
        setIfDefined(firestoreUpdates, "displayName", safeUpdates.displayName);
        setIfDefined(firestoreUpdates, "phoneNumber", safeUpdates.phoneNumber);
        setIfDefined(firestoreUpdates, "photoURL", safeUpdates.photoURL);
        setIfDefined(firestoreUpdates, "providerPhotoURL", safeUpdates.providerPhotoURL);
        setIfDefined(firestoreUpdates, "uploadedPhotoURL", safeUpdates.uploadedPhotoURL);
        setIfDefined(firestoreUpdates, "uploadedPhotoPath", safeUpdates.uploadedPhotoPath);

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "vendorStatus")) {
            firestoreUpdates.vendorStatus = safeUpdates.vendorStatus;
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "vendorReason")) {
            firestoreUpdates.vendorReason = safeUpdates.vendorReason;
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "adminApplicationStatus")) {
            firestoreUpdates.adminApplicationStatus = safeUpdates.adminApplicationStatus;
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "adminApplicationReason")) {
            firestoreUpdates.adminApplicationReason = safeUpdates.adminApplicationReason;
        }

        if (Object.prototype.hasOwnProperty.call(safeUpdates, "accountStatus")) {
            firestoreUpdates.accountStatus = safeUpdates.accountStatus;
        }

        const updatedProfile = await updateUserProfile(user.uid, firestoreUpdates);
        const existingProfile = await getCurrentUserProfile(user.uid);

        return getExtendedProfile({
            ...(existingProfile || {}),
            ...updatedProfile,
            uid: user.uid,
            email: user.email || (existingProfile && existingProfile.email) || ""
        });
    }

    async function setCurrentUserPhotoURL(photoURL) {
        const normalizedPhotoURL =
            typeof photoURL === "string"
                ? photoURL.trim()
                : "";

        return updateCurrentUserProfile({
            photoURL: normalizedPhotoURL
        });
    }

    async function uploadCurrentUserPhoto(file, options = {}) {
        const user = getCurrentUserOrThrow();
        requireStorageFunction("ref");
        requireStorageFunction("uploadBytes");
        requireStorageFunction("getDownloadURL");

        const safeOptions = options && typeof options === "object" ? options : {};
        const maxSizeBytes = Number.isFinite(safeOptions.maxSizeBytes)
            ? safeOptions.maxSizeBytes
            : 5 * 1024 * 1024;

        if (!file || typeof file !== "object") {
            throw new Error("A valid image file is required.");
        }

        if (typeof file.type !== "string" || !file.type.startsWith("image/")) {
            throw new Error("Please choose a valid image file.");
        }

        if (typeof file.size === "number" && file.size > maxSizeBytes) {
            throw new Error("Please choose an image smaller than 5 MB.");
        }

        const existingProfile = getExtendedProfile(await getCurrentUserProfile(user.uid) || {});
        const providerPhotoURL = getProviderPhotoCandidate(
            existingProfile,
            user,
            existingProfile.providerPhotoURL || user.photoURL || ""
        );

        const storagePath = getProfilePhotoStoragePath(user.uid, file);
        const storageRef = storageFns.ref(injectedStorage, storagePath);

        await storageFns.uploadBytes(storageRef, file, {
            contentType: file.type || "application/octet-stream",
            cacheControl: "public,max-age=3600"
        });

        const downloadURL = await storageFns.getDownloadURL(storageRef);

        const updatedProfile = await updateCurrentUserProfile({
            photoURL: downloadURL,
            providerPhotoURL,
            uploadedPhotoURL: downloadURL,
            uploadedPhotoPath: storagePath
        });

        return getExtendedProfile(updatedProfile);
    }

    async function removeCurrentUserPhoto() {
        const user = getCurrentUserOrThrow();
        const existingProfile = getExtendedProfile(await getCurrentUserProfile(user.uid) || {});
        const fallbackPhotoURL = normalizeUrlLikeValue(existingProfile.providerPhotoURL);

        if (existingProfile.uploadedPhotoPath) {
            requireStorageFunction("ref");
            requireStorageFunction("deleteObject");

            try {
                const storageRef = storageFns.ref(injectedStorage, existingProfile.uploadedPhotoPath);
                await storageFns.deleteObject(storageRef);
            } catch (error) {
                const errorCode = normalizeUrlLikeValue(error && error.code);

                if (errorCode !== "storage/object-not-found") {
                    throw error;
                }
            }
        }

        const updatedProfile = await updateCurrentUserProfile({
            photoURL: fallbackPhotoURL,
            providerPhotoURL: existingProfile.providerPhotoURL || "",
            uploadedPhotoURL: "",
            uploadedPhotoPath: ""
        });

        return getExtendedProfile(updatedProfile);
    }

    async function changeCurrentUserPassword(newPassword) {
        const user = getCurrentUserOrThrow();
        requireAuthFunction("updatePassword");

        if (typeof newPassword !== "string" || newPassword.length < 8) {
            throw new Error("A valid new password of at least 8 characters is required.");
        }

        await authFns.updatePassword(user, newPassword);

        return {
            success: true
        };
    }

    async function deleteCurrentUserAccount(options = {}) {
        const user = getCurrentUserOrThrow();
        const safeOptions = options && typeof options === "object" ? options : {};
        const shouldDeleteProfile = safeOptions.deleteProfile !== false;

        requireAuthFunction("deleteUser");

        const existingProfile = getExtendedProfile(await getCurrentUserProfile(user.uid) || {});

        if (existingProfile.uploadedPhotoPath) {
            requireStorageFunction("ref");
            requireStorageFunction("deleteObject");

            try {
                const storageRef = storageFns.ref(injectedStorage, existingProfile.uploadedPhotoPath);
                await storageFns.deleteObject(storageRef);
            } catch (error) {
                const errorCode = normalizeUrlLikeValue(error && error.code);

                if (errorCode !== "storage/object-not-found") {
                    throw error;
                }
            }
        }

        if (shouldDeleteProfile) {
            requireFirestoreFunction("deleteDoc");
            const userRef = getUserDocRef(user.uid);
            await firestoreFns.deleteDoc(userRef);
        }

        await authFns.deleteUser(user);

        return {
            success: true
        };
    }

    async function syncExistingUserProfile(authUser, existingProfile, options = {}) {
        const safeOptions = options && typeof options === "object" ? options : {};
        const extendedExistingProfile = getExtendedProfile(existingProfile || {});
        const incomingPhotoURL = normalizeUrlLikeValue(
            safeOptions.photoURL ||
            (authUser && authUser.photoURL) ||
            ""
        );

        const providerPhotoURL =
            extendedExistingProfile.providerPhotoURL ||
            (!extendedExistingProfile.uploadedPhotoURL ? incomingPhotoURL : "");

        const mergedProfile =
            typeof utils.mergeProfileWithAuthData === "function"
                ? {
                    ...utils.mergeProfileWithAuthData(existingProfile, authUser, safeOptions),
                    providerPhotoURL,
                    uploadedPhotoURL: extendedExistingProfile.uploadedPhotoURL || "",
                    uploadedPhotoPath: extendedExistingProfile.uploadedPhotoPath || "",
                    photoURL:
                        extendedExistingProfile.uploadedPhotoURL ||
                        extendedExistingProfile.photoURL ||
                        providerPhotoURL ||
                        ""
                }
                : {
                    ...existingProfile,
                    uid: authUser.uid,
                    displayName:
                        safeOptions.displayName ||
                        (authUser && authUser.displayName) ||
                        existingProfile.displayName ||
                        "",
                    email:
                        safeOptions.email ||
                        (authUser && authUser.email) ||
                        existingProfile.email ||
                        "",
                    phoneNumber:
                        safeOptions.phoneNumber ||
                        (authUser && authUser.phoneNumber) ||
                        existingProfile.phoneNumber ||
                        "",
                    photoURL:
                        extendedExistingProfile.uploadedPhotoURL ||
                        extendedExistingProfile.photoURL ||
                        providerPhotoURL ||
                        "",
                    providerPhotoURL,
                    uploadedPhotoURL: extendedExistingProfile.uploadedPhotoURL || "",
                    uploadedPhotoPath: extendedExistingProfile.uploadedPhotoPath || "",
                    isAdmin: existingProfile.isAdmin === true,
                    vendorStatus: getCanonicalVendorStatus(existingProfile.vendorStatus),
                    vendorReason: existingProfile.vendorReason || "",
                    adminApplicationStatus: getCanonicalAdminApplicationStatus(
                        existingProfile.adminApplicationStatus,
                        existingProfile.isAdmin === true
                    ),
                    adminApplicationReason: existingProfile.adminApplicationReason || "",
                    accountStatus: getCanonicalAccountStatus(existingProfile.accountStatus)
                };

        return saveUserProfile(mergedProfile, { merge: true });
    }

    async function ensureUserProfile(authUser, options = {}) {
        if (!authUser || !authUser.uid) {
            throw new Error("A valid authenticated user is required.");
        }

        const safeOptions = options && typeof options === "object" ? options : {};
        const accountType = safeOptions.accountType || "customer";
        const displayName =
            safeOptions.displayName ||
            (authUser && authUser.displayName) ||
            "";
        const email =
            safeOptions.email ||
            (authUser && authUser.email) ||
            "";
        const phoneNumber =
            safeOptions.phoneNumber ||
            (authUser && authUser.phoneNumber) ||
            "";
        const providerPhotoURL =
            safeOptions.providerPhotoURL ||
            safeOptions.photoURL ||
            (authUser && authUser.photoURL) ||
            "";

        const existingProfile = await getUserProfile(authUser.uid);

        if (existingProfile) {
            return syncExistingUserProfile(authUser, existingProfile, {
                displayName,
                email,
                phoneNumber,
                photoURL: providerPhotoURL,
                providerPhotoURL
            });
        }

        let profile = utils.createBaseUserProfile(authUser, {
            displayName,
            email,
            phoneNumber,
            photoURL: providerPhotoURL
        });

        profile = {
            ...profile,
            photoURL: providerPhotoURL,
            providerPhotoURL,
            uploadedPhotoURL: "",
            uploadedPhotoPath: ""
        };

        if (
            accountType === "vendor" &&
            typeof utils.applyVendorApplicationToProfile === "function"
        ) {
            profile = {
                ...utils.applyVendorApplicationToProfile(profile),
                providerPhotoURL,
                uploadedPhotoURL: "",
                uploadedPhotoPath: "",
                photoURL: providerPhotoURL
            };
        }

        if (
            accountType === "admin" &&
            typeof utils.applyAdminApplicationToProfile === "function"
        ) {
            profile = {
                ...utils.applyAdminApplicationToProfile(profile),
                providerPhotoURL,
                uploadedPhotoURL: "",
                uploadedPhotoPath: "",
                photoURL: providerPhotoURL
            };
        }

        return saveUserProfile(profile);
    }

    async function resolveAuthResult(user, profile) {
        const safeProfile = getExtendedProfile(profile);

        return {
            success: true,
            user,
            profile: safeProfile,
            nextRoute: getSafeNextRoute(safeProfile)
        };
    }

    function resolveAuthError(error) {
        return {
            success: false,
            error,
            message:
                typeof utils.mapAuthErrorCode === "function"
                    ? utils.mapAuthErrorCode(error && error.code)
                    : "Something went wrong. Please try again."
        };
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

            return resolveAuthResult(user, profile);
        } catch (error) {
            return resolveAuthError(error);
        }
    }

    async function loginWithEmail({ email, password }) {
        try {
            const user = await loginUser(email, password);
            const profile = await ensureUserProfile(user, {
                accountType: "customer",
                displayName: (user && user.displayName) || "",
                email: (user && user.email) || email || "",
                phoneNumber: (user && user.phoneNumber) || "",
                photoURL: (user && user.photoURL) || "",
                providerPhotoURL: (user && user.photoURL) || ""
            });

            return resolveAuthResult(user, profile);
        } catch (error) {
            return resolveAuthError(error);
        }
    }

    async function loginWithGoogle() {
        try {
            const user = await signInWithGoogle();
            const profile = await ensureUserProfile(user, {
                accountType: "customer",
                displayName: (user && user.displayName) || "",
                email: (user && user.email) || "",
                phoneNumber: (user && user.phoneNumber) || "",
                photoURL: (user && user.photoURL) || "",
                providerPhotoURL: (user && user.photoURL) || ""
            });

            return resolveAuthResult(user, profile);
        } catch (error) {
            return resolveAuthError(error);
        }
    }

    async function loginWithApple() {
        try {
            const user = await signInWithApple();
            const profile = await ensureUserProfile(user, {
                accountType: "customer",
                displayName: (user && user.displayName) || "",
                email: (user && user.email) || "",
                phoneNumber: (user && user.phoneNumber) || "",
                photoURL: (user && user.photoURL) || "",
                providerPhotoURL: (user && user.photoURL) || ""
            });

            return resolveAuthResult(user, profile);
        } catch (error) {
            return resolveAuthError(error);
        }
    }

    async function sendPasswordResetEmail({ email }) {
        try {
            await sendPasswordReset(email);

            return {
                success: true
            };
        } catch (error) {
            return resolveAuthError(error);
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
        updateAuthUserProfile,
        getCurrentUser,
        getCurrentUserOrThrow,
        getUserDocRef,
        getUserProfile,
        getCurrentUserProfile,
        getProfilePhotoStoragePath,
        saveUserProfile,
        updateUserProfile,
        updateCurrentUserProfile,
        setCurrentUserPhotoURL,
        uploadCurrentUserPhoto,
        removeCurrentUserPhoto,
        changeCurrentUserPassword,
        deleteCurrentUserAccount,
        syncExistingUserProfile,
        ensureUserProfile,
        registerWithEmail,
        loginWithEmail,
        loginWithGoogle,
        loginWithApple,
        observeAuthState
    };
}

const authCore = {
    ensureDependency,
    createAuthService
};

if (typeof module !== "undefined" && module.exports) {
    module.exports = authCore;
}

if (typeof window !== "undefined") {
    window.authCore = authCore;
}
