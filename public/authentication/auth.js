// /public/authentication/auth.js
// Core authentication + profile logic for Beauty on Cloud (single account model)
// ✅ Free-plan admin actions: roles/status/soft delete + Firestore cleanup (NO Auth user deletion)

import { auth, db, storage } from "./config.js";

import {
  onAuthStateChanged,
  signOut,
  signInAnonymously,
  deleteUser,
  GoogleAuthProvider,
  OAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updateEmail,
  updatePassword,
  fetchSignInMethodsForEmail,
  EmailAuthProvider,
  linkWithCredential,
  updateProfile,
  reload as reloadUserAuth,
  reauthenticateWithCredential,
  reauthenticateWithPopup,
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  updateDoc,
  collection,
  getDocs,
  serverTimestamp,
  writeBatch,
} from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

import { ref, uploadBytes, getDownloadURL } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-storage.js";

/* --------------------------------------------------------------
   Helpers: default profile + safe updates
   -------------------------------------------------------------- */

function _safeSetLocal(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch { }
}

function _defaultDisplayName(user) {
  if (!user) return "User";
  if (user.displayName) return user.displayName;
  if (user.email) return user.email.split("@")[0];
  return "User";
}

function _defaultRoles() {
  return {
    customer: true,
    specialist: false,
    admin: false,
    owner: false,
  };
}

/**
 * Normalize roles across:
 * - new schema: roles map
 * - legacy schema: role string + isOwner boolean
 *
 * ✅ Owner implies Admin (always)
 */
function _normalizeProfileRoles(profile) {
  const roles = { ..._defaultRoles() };

  // New schema
  if (profile?.roles && typeof profile.roles === "object") {
    const merged = { ...roles, ...profile.roles };

    // legacy flag folded in
    if (profile?.isOwner === true) merged.owner = true;

    // ✅ owner -> admin
    if (merged.owner === true) merged.admin = true;

    return merged;
  }

  // Legacy schema
  const legacyRole = profile?.role;
  if (legacyRole === "admin") roles.admin = true;
  if (legacyRole === "specialist") roles.specialist = true;
  if (legacyRole === "customer") roles.customer = true;

  if (profile?.isOwner === true) roles.owner = true;

  // ✅ owner -> admin (legacy too)
  if (roles.owner === true) roles.admin = true;

  return roles;
}

function _rolesEqual(a, b) {
  const ra = _normalizeProfileRoles({ roles: a });
  const rb = _normalizeProfileRoles({ roles: b });
  return (
    !!ra.customer === !!rb.customer &&
    !!ra.specialist === !!rb.specialist &&
    !!ra.admin === !!rb.admin &&
    !!ra.owner === !!rb.owner
  );
}

/**
 * If user doc is missing, create it.
 * If doc exists, migrate legacy roles -> roles map.
 *
 * Important free-plan behavior:
 * - If an admin "hard deletes" a user doc, the user can sign in again
 *   (Auth user still exists) and this function will re-create a default profile.
 */
async function _ensureProfileExists(user) {
  if (!user || user.isAnonymous) return null;

  const profileRef = doc(db, "users", user.uid);
  const snap = await getDoc(profileRef);

  if (!snap.exists()) {
    const data = {
      email: user.email || null,
      name: _defaultDisplayName(user),
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      phone: user.phoneNumber || null,

      // New model
      roles: _defaultRoles(),

      // Common state
      status: "active", // "active" | "disabled"
      deleted: false,   // soft-delete marker
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    await setDoc(profileRef, data);
    return data;
  }

  // Exists: ensure roles are present & normalized (migrate-in-place)
  const existing = snap.data();
  const roles = _normalizeProfileRoles(existing);

  const hasLegacyRoleString = typeof existing?.role === "string";
  const rolesMissingOrInvalid = !existing?.roles || typeof existing.roles !== "object";
  const rolesDiffer = !_rolesEqual(existing?.roles, roles);

  const needsMigration = rolesMissingOrInvalid || hasLegacyRoleString || rolesDiffer;

  if (needsMigration) {
    const patch = {
      roles,
      updatedAt: serverTimestamp(),
    };

    await updateDoc(profileRef, patch);
    return { ...existing, ...patch, roles };
  }

  return existing;
}

async function _syncProfileBasics(user) {
  if (!user || user.isAnonymous) return;
  try {
    await updateDoc(doc(db, "users", user.uid), {
      email: user.email || null,
      name: _defaultDisplayName(user),
      displayName: user.displayName || null,
      photoURL: user.photoURL || null,
      phone: user.phoneNumber || null,
      updatedAt: serverTimestamp(),
    });
  } catch {
    // ignore if profile not created yet
  }
}

async function _withRecentLogin(fn) {
  try {
    return await fn();
  } catch (e) {
    if (e?.code !== "auth/requires-recent-login") throw e;

    const u = auth.currentUser;
    if (!u) throw e;

    const methods = u.email ? await fetchSignInMethodsForEmail(auth, u.email) : [];
    const linked = (u.providerData || []).map((p) => p.providerId);
    const hasPassword = methods.includes("password");
    const hasGoogle = linked.includes("google.com") || methods.includes("google.com");

    if (hasPassword) {
      const pw = prompt("Re-enter your password to continue:");
      if (!pw) throw e;
      const cred = EmailAuthProvider.credential(u.email, pw);
      await reauthenticateWithCredential(u, cred);
    } else if (hasGoogle) {
      await reauthenticateWithPopup(u, new GoogleAuthProvider());
    } else {
      throw new Error("Please sign in again from the login page to continue.");
    }

    return await fn();
  }
}

function _lastRoleForRouting(profile) {
  const roles = _normalizeProfileRoles(profile);
  if (roles.owner || roles.admin) return "admin";
  if (roles.specialist) return "specialist";
  if (roles.customer) return "customer";
  return "customer";
}

/**
 * ✅ If a user has roles.specialist=true, ensure they also have a specialists/{uid} doc.
 */
async function _ensureSpecialistDocIfNeeded(user, profile) {
  try {
    if (!user || user.isAnonymous) return;

    const roles = _normalizeProfileRoles(profile);
    if (!roles.specialist) return;

    const specialistRef = doc(db, "specialists", user.uid);
    const spSnap = await getDoc(specialistRef);

    if (!spSnap.exists()) {
      const baseProfile = {
        uid: user.uid,
        name: profile?.name || _defaultDisplayName(user),
        photoURL: user.photoURL || profile?.photoURL || null,
        bio: profile?.bio || "",
        phone: profile?.phone || user.phoneNumber || null,
        email: user.email || profile?.email || null,

        location: profile?.location || { city: "", area: "" },
        services: Array.isArray(profile?.services) ? profile.services : [],
        images: Array.isArray(profile?.images) ? profile.images : [],

        isActive: true,

        ratingAvg: 0,
        ratingCount: 0,

        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await setDoc(specialistRef, baseProfile, { merge: true });
      return;
    }

    const sp = spSnap.data() || {};
    if (!("isActive" in sp) || sp.isActive !== true) {
      await setDoc(
        specialistRef,
        { isActive: true, updatedAt: serverTimestamp() },
        { merge: true }
      );
    }
  } catch (err) {
    console.warn("ensureSpecialistDocIfNeeded skipped:", err);
  }
}

/* --------------------------------------------------------------
   1) Auth state listener
   -------------------------------------------------------------- */

export function initAuthListener(onChange) {
  onAuthStateChanged(auth, async (user) => {
    if (!user) {
      try {
        localStorage.removeItem("boc.lastRole");
      } catch { }
      onChange(null);
      return;
    }

    // Anonymous guest
    if (user.isAnonymous) {
      const guestProfile = { role: "guest", isGuest: true, roles: null };
      _safeSetLocal("boc.lastRole", "guest");
      onChange({ user, profile: guestProfile });
      return;
    }

    // Ensure + sync profile
    let profile = await _ensureProfileExists(user);
    await _syncProfileBasics(user);

    if (!profile) {
      const snap = await getDoc(doc(db, "users", user.uid));
      profile = snap.exists() ? snap.data() : null;
    }

    // Disabled OR soft-deleted: block access
    if (profile?.status === "disabled" || profile?.deleted === true) {
      await signOut(auth);
      alert("Your Beauty on Cloud account has been disabled. Please contact support.");
      onChange(null);
      return;
    }

    // Normalize roles and keep app consistent
    const normalizedProfile = {
      ...profile,
      roles: _normalizeProfileRoles(profile),
    };

    // If they are a specialist, ensure they have a specialist listing doc
    await _ensureSpecialistDocIfNeeded(user, normalizedProfile);

    const lastRole = _lastRoleForRouting(normalizedProfile);
    _safeSetLocal("boc.lastRole", lastRole);

    onChange({ user, profile: normalizedProfile });
  });
}

/* --------------------------------------------------------------
   2) Sign-in methods
   -------------------------------------------------------------- */

export async function googleLogin() {
  const cred = await signInWithPopup(auth, new GoogleAuthProvider());
  await _ensureProfileExists(cred.user);
  await _syncProfileBasics(cred.user);
  return cred.user;
}

export async function appleLogin() {
  const provider = new OAuthProvider("apple.com");
  const cred = await signInWithPopup(auth, provider);
  await _ensureProfileExists(cred.user);
  await _syncProfileBasics(cred.user);
  return cred.user;
}

export function guestBrowse() {
  return signInAnonymously(auth);
}

export function logout() {
  return signOut(auth);
}

export async function emailLogin(email, password) {
  const cred = await signInWithEmailAndPassword(auth, email, password);
  await _ensureProfileExists(cred.user);
  await _syncProfileBasics(cred.user);
  return cred.user;
}

export async function registerWithEmail({ name, email, password }) {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  if (name && name.trim()) {
    await updateProfile(cred.user, { displayName: name.trim() });
  }

  await _ensureProfileExists(cred.user);
  await _syncProfileBasics(cred.user);
  return cred.user;
}

/* --------------------------------------------------------------
   3) Account & profile management
   -------------------------------------------------------------- */

export async function saveProfile({ displayName, photoURL, phone }) {
  const u = auth.currentUser;
  if (!u) throw new Error("No user is signed in.");

  await _withRecentLogin(() =>
    updateProfile(u, {
      displayName: (displayName ?? "").trim() || null,
      photoURL: (photoURL ?? "").trim() || null,
    })
  );

  if (phone !== undefined) {
    try {
      await updateDoc(doc(db, "users", u.uid), {
        phone: (phone ?? "").trim() || null,
        updatedAt: serverTimestamp(),
      });
    } catch { }
  }

  await _syncProfileBasics(auth.currentUser);
}

export async function changeEmail(newEmail) {
  const u = auth.currentUser;
  if (!u) throw new Error("No user is signed in.");
  const email = (newEmail || "").trim();
  if (!email) throw new Error("Email cannot be empty.");

  await _withRecentLogin(() => updateEmail(u, email));

  try {
    const { sendEmailVerification } = await import(
      "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js"
    );
    await sendEmailVerification(auth.currentUser);
  } catch { }

  await _syncProfileBasics(auth.currentUser);
}

export async function setOrChangePassword(newPassword) {
  const u = auth.currentUser;
  if (!u) throw new Error("No user is signed in.");
  const methods = u.email ? await fetchSignInMethodsForEmail(auth, u.email) : [];
  if (methods.includes("password")) {
    await _withRecentLogin(() => updatePassword(u, newPassword));
  } else {
    const cred = EmailAuthProvider.credential(u.email, newPassword);
    await _withRecentLogin(() => linkWithCredential(u, cred));
  }
}

export function sendReset(email) {
  const addr = email || auth.currentUser?.email;
  if (!addr) throw new Error("No email available for password reset.");
  return sendPasswordResetEmail(auth, addr);
}

export async function uploadAvatarFile(file) {
  const u = auth.currentUser;
  if (!u) throw new Error("No user is signed in.");
  if (!file) throw new Error("No file selected.");
  if (!file.type?.startsWith?.("image/")) throw new Error("Please select an image file.");

  const maxBytes = 5 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("Image is too large (max 5 MB).");

  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const safeExt = ["jpg", "jpeg", "png", "webp"].includes(ext) ? ext : "jpg";
  const objectRef = ref(storage, `users/${u.uid}/avatar.${safeExt}`);

  await uploadBytes(objectRef, file, { contentType: file.type || "image/jpeg" });
  const downloadURL = await getDownloadURL(objectRef);

  await _withRecentLogin(() => updateProfile(u, { photoURL: downloadURL }));
  await _syncProfileBasics(auth.currentUser);
  return downloadURL;
}

/* --------------------------------------------------------------
   3.1) Specialist upgrade flow
   -------------------------------------------------------------- */

export async function becomeSpecialist(specialistProfile = {}) {
  const u = auth.currentUser;
  if (!u || u.isAnonymous) throw new Error("Please sign in to become a specialist.");

  const userRef = doc(db, "users", u.uid);
  await _ensureProfileExists(u);

  const userSnap = await getDoc(userRef);
  const current = userSnap.exists() ? userSnap.data() : {};
  const roles = _normalizeProfileRoles(current);

  const specialistRef = doc(db, "specialists", u.uid);

  const baseProfile = {
    uid: u.uid,
    name: specialistProfile.name || current?.name || _defaultDisplayName(u),
    photoURL: specialistProfile.photoURL || u.photoURL || current?.photoURL || null,
    bio: specialistProfile.bio || "",
    phone: specialistProfile.phone || current?.phone || u.phoneNumber || null,
    email: u.email || current?.email || null,

    location: specialistProfile.location || { city: "", area: "" },
    services: Array.isArray(specialistProfile.services) ? specialistProfile.services : [],
    images: Array.isArray(specialistProfile.images) ? specialistProfile.images : [],

    isActive: true,

    ratingAvg: specialistProfile.ratingAvg ?? 0,
    ratingCount: specialistProfile.ratingCount ?? 0,

    updatedAt: serverTimestamp(),
  };

  const spSnap = await getDoc(specialistRef);
  if (!spSnap.exists()) baseProfile.createdAt = serverTimestamp();

  await setDoc(specialistRef, baseProfile, { merge: true });

  roles.specialist = true;
  if (roles.owner === true) roles.admin = true;

  await updateDoc(userRef, { roles, updatedAt: serverTimestamp() });

  _safeSetLocal("boc.lastRole", "specialist");
  return { roles, specialistProfile: baseProfile };
}

export async function revokeSpecialist() {
  const u = auth.currentUser;
  if (!u || u.isAnonymous) throw new Error("Please sign in first.");

  const userRef = doc(db, "users", u.uid);
  await _ensureProfileExists(u);

  const snap = await getDoc(userRef);
  const current = snap.exists() ? snap.data() : {};
  const roles = _normalizeProfileRoles(current);

  const specialistRef = doc(db, "specialists", u.uid);
  await setDoc(
    specialistRef,
    { isActive: false, updatedAt: serverTimestamp() },
    { merge: true }
  );

  roles.specialist = false;

  await updateDoc(userRef, { roles, updatedAt: serverTimestamp() });

  _safeSetLocal("boc.lastRole", "customer");
  return roles;
}

/**
 * Self delete (only deletes CURRENT signed-in auth user).
 * This is separate from admin deletes.
 */
export async function deleteAccount() {
  const u = auth.currentUser;
  if (!u) throw new Error("No user is signed in.");

  await _withRecentLogin(async () => {
    try {
      await setDoc(
        doc(db, "specialists", u.uid),
        { isActive: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch { }

    await deleteDoc(doc(db, "users", u.uid));
    await deleteUser(u);
  });
}

/* --------------------------------------------------------------
   4) Admin / owner helpers (FREE PLAN: Firestore-based)
   -------------------------------------------------------------- */

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  return snap.exists()
    ? { uid: snap.id, ...snap.data(), roles: _normalizeProfileRoles(snap.data()) }
    : null;
}

export async function getAllUsers() {
  const snap = await getDocs(collection(db, "users"));
  return snap.docs.map((d) => {
    const data = d.data();
    return { uid: d.id, ...data, roles: _normalizeProfileRoles(data) };
  });
}

async function _requireAdminOrOwner() {
  const u = auth.currentUser;
  if (!u || u.isAnonymous) throw new Error("Not signed in.");

  const snap = await getDoc(doc(db, "users", u.uid));
  if (!snap.exists()) throw new Error("Profile not found.");

  const roles = _normalizeProfileRoles(snap.data());
  if (!roles.admin && !roles.owner) throw new Error("Not allowed. Admin/Owner only.");
  return { uid: u.uid, roles };
}

function _assertUid(uid) {
  if (!uid || typeof uid !== "string") throw new Error("uid is required.");
}

function _assertCanTouch({ callerRoles, targetRoles, actionLabel }) {
  const callerIsOwner = callerRoles.owner === true;
  const targetIsOwner = targetRoles.owner === true;

  if (targetIsOwner && !callerIsOwner) {
    throw new Error(`Admins cannot ${actionLabel} owners.`);
  }
}

/**
 * ✅ Update user roles (Firestore).
 * - Admins can update customer/specialist/admin for non-owners
 * - Owners can update anyone (including owners if you choose later)
 */
export async function adminSetUserRoles(uid, rolesPatch) {
  const session = await _requireAdminOrOwner();
  _assertUid(uid);

  const target = await getUserProfile(uid);
  const targetRoles = _normalizeProfileRoles(target || {});

  _assertCanTouch({
    callerRoles: session.roles,
    targetRoles,
    actionLabel: "edit",
  });

  if (!rolesPatch || typeof rolesPatch !== "object") {
    throw new Error("rolesPatch must be an object.");
  }

  // Only allow these role fields (we keep owner unchanged in free-plan admin)
  const nextRoles = {
    ...targetRoles,
    customer: rolesPatch.customer === true,
    specialist: rolesPatch.specialist === true,
    admin: rolesPatch.admin === true,
    owner: targetRoles.owner === true, // unchanged unless owner feature later
  };

  // owner implies admin always
  if (nextRoles.owner === true) nextRoles.admin = true;

  await setDoc(
    doc(db, "users", uid),
    {
      roles: nextRoles,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // If specialist is being turned ON, ensure listing exists
  if (nextRoles.specialist === true) {
    try {
      const spRef = doc(db, "specialists", uid);
      const spSnap = await getDoc(spRef);
      if (!spSnap.exists()) {
        await setDoc(
          spRef,
          {
            uid,
            isActive: true,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          },
          { merge: true }
        );
      } else {
        await setDoc(spRef, { isActive: true, updatedAt: serverTimestamp() }, { merge: true });
      }
    } catch { }
  }

  // If specialist is turned OFF, deactivate listing
  if (nextRoles.specialist !== true) {
    try {
      await setDoc(
        doc(db, "specialists", uid),
        { isActive: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch { }
  }

  return { ok: true, roles: nextRoles };
}

/**
 * ✅ Block / Unblock (Firestore).
 * status: "disabled" blocks login (your auth listener enforces it)
 */
export async function adminSetUserStatus(uid, status) {
  const session = await _requireAdminOrOwner();
  _assertUid(uid);

  const target = await getUserProfile(uid);
  const targetRoles = _normalizeProfileRoles(target || {});

  _assertCanTouch({
    callerRoles: session.roles,
    targetRoles,
    actionLabel: "disable",
  });

  const s = (status || "").toString().trim().toLowerCase();
  if (s !== "active" && s !== "disabled") {
    throw new Error('status must be "active" or "disabled".');
  }

  await setDoc(
    doc(db, "users", uid),
    {
      status: s,
      deleted: false,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  // If disabling, also deactivate specialist listing (optional but practical)
  if (s === "disabled") {
    try {
      await setDoc(
        doc(db, "specialists", uid),
        { isActive: false, updatedAt: serverTimestamp() },
        { merge: true }
      );
    } catch { }
  }

  return { ok: true };
}

/**
 * ✅ Soft delete (Firestore):
 * - marks deleted=true
 * - status="disabled"
 * - strips roles (keeps customer false or true? We'll keep customer true but blocked anyway)
 * - deactivates specialist listing
 *
 * Result: they are blocked and hidden, but Auth account still exists.
 */
export async function adminSoftDeleteUser(uid, reason = "") {
  const session = await _requireAdminOrOwner();
  _assertUid(uid);

  const target = await getUserProfile(uid);
  const targetRoles = _normalizeProfileRoles(target || {});

  _assertCanTouch({
    callerRoles: session.roles,
    targetRoles,
    actionLabel: "delete",
  });

  const patchRoles = {
    customer: true,
    specialist: false,
    admin: false,
    owner: targetRoles.owner === true, // only owners can delete owners anyway
  };

  if (patchRoles.owner === true) patchRoles.admin = true;

  await setDoc(
    doc(db, "users", uid),
    {
      deleted: true,
      deletedAt: serverTimestamp(),
      deletedBy: session.uid,
      deleteReason: (reason || "").toString().slice(0, 300),
      status: "disabled",
      roles: patchRoles,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  try {
    await setDoc(
      doc(db, "specialists", uid),
      { isActive: false, updatedAt: serverTimestamp() },
      { merge: true }
    );
  } catch { }

  return { ok: true };
}

/**
 * ✅ Hard delete Firestore data (FREE PLAN):
 * - deletes users/{uid}
 * - deletes specialists/{uid}
 *
 * ⚠️ Auth user is NOT deleted.
 * If they sign in again later, _ensureProfileExists will recreate a new default profile.
 */
export async function adminHardDeleteUserData(uid) {
  const session = await _requireAdminOrOwner();
  _assertUid(uid);

  const target = await getUserProfile(uid);
  const targetRoles = _normalizeProfileRoles(target || {});

  _assertCanTouch({
    callerRoles: session.roles,
    targetRoles,
    actionLabel: "delete",
  });

  // Prevent deleting yourself through admin panel (safer)
  if (uid === session.uid) {
    throw new Error("You cannot hard-delete your own profile data here.");
  }

  const batch = writeBatch(db);
  batch.delete(doc(db, "users", uid));
  batch.delete(doc(db, "specialists", uid));

  // Later you can expand:
  // - bookings where customerId==uid
  // - bookings where specialistId==uid
  // - ratings authored by uid
  // (requires querying + batching in chunks)

  await batch.commit();
  return { ok: true };
}

/* --------------------------------------------------------------
   5) Tiny helpers
   -------------------------------------------------------------- */

export function currentUser() {
  return auth.currentUser;
}

export async function reloadCurrentUser() {
  if (!auth.currentUser) return null;
  await reloadUserAuth(auth.currentUser);
  return auth.currentUser;
}
