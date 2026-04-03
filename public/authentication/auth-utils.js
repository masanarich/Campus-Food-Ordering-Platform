// /public/authentication/auth-utils.js
// Routing, guards and portal helpers for Beauty on Cloud (roles object model)

import { auth, db } from "./config.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.1.0/firebase-firestore.js";

const CUSTOMER_HOME = "../customer/home.html";
const SPECIALIST_HOME = "../specialist/home.html";
const ADMIN_HOME = "../admin/home.html";
const ROLE_CHOICE = "../authentication/role-choice.html";

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

function defaultRoles() {
  return {
    customer: true,
    specialist: false,
    admin: false,
    owner: false,
  };
}

/**
 * Backward compatibility:
 * - new docs: profile.roles exists
 * - old docs: profile.role = "customer" | "specialist" | "admin"
 * - old docs: profile.isOwner = true
 *
 * ✅ Owner implies Admin (always)
 */
function normalizeRoles(profile) {
  const roles = { ...defaultRoles() };

  // New schema
  if (profile?.roles && typeof profile.roles === "object") {
    const merged = { ...roles, ...profile.roles };

    // Fold legacy isOwner into roles.owner
    if (profile?.isOwner === true) merged.owner = true;

    // ✅ Owner implies Admin
    if (merged.owner === true) merged.admin = true;

    return merged;
  }

  // Legacy schema
  const legacyRole = norm(profile?.role);
  if (legacyRole === "admin") roles.admin = true;
  if (legacyRole === "specialist") roles.specialist = true;
  if (legacyRole === "customer") roles.customer = true;

  if (profile?.isOwner === true) roles.owner = true;

  // ✅ Owner implies Admin (legacy too)
  if (roles.owner === true) roles.admin = true;

  return roles;
}

function roleForRouting(profile) {
  const roles = normalizeRoles(profile);
  if (roles.owner || roles.admin) return "admin";
  if (roles.specialist) return "specialist";
  return "customer";
}

function isGuestInternal(profile) {
  return profile?.role === "guest" || profile?.isGuest === true;
}

/**
 * Which portals are available for this profile?
 * Returns array of "customer" | "specialist" | "admin"
 */
function getAvailablePortals(profile) {
  // For guests: only customer browsing
  if (isGuestInternal(profile)) return ["customer"];

  const roles = normalizeRoles(profile);

  const portals = ["customer"]; // everyone signed in can use customer portal
  if (roles.specialist || roles.admin || roles.owner) portals.push("specialist");
  if (roles.admin || roles.owner) portals.push("admin");

  return portals;
}

/**
 * Should we show the role-choice page?
 * - Only for signed-in (non-guest) users
 * - Only if they have more than one portal available
 * - Only if user hasn't picked a valid preference yet
 */
function shouldShowRoleChoice(profile) {
  if (!profile || isGuestInternal(profile)) return false;

  const portals = getAvailablePortals(profile);
  if (portals.length <= 1) return false;

  const pref = norm(localStorage.getItem("boc.defaultPortal"));
  if (pref && portals.includes(pref)) return false;

  return true;
}

function portalToUrl(portal) {
  const p = norm(portal);
  if (p === "admin") return ADMIN_HOME;
  if (p === "specialist") return SPECIALIST_HOME;
  return CUSTOMER_HOME;
}

/**
 * Decide where to send the user after login.
 * Priority:
 *   0) If multi-portal and no valid preference -> ROLE_CHOICE
 *   1) localStorage.boc.defaultPortal (user preference) IF allowed
 *   2) role derived from Firestore profile roles
 *   3) fallback to customer
 */
export function resolveStartPage({ profile = null } = {}) {
  if (profile && shouldShowRoleChoice(profile)) {
    return ROLE_CHOICE;
  }

  const pref = norm(localStorage.getItem("boc.defaultPortal"));
  if (pref) {
    if (!profile) return portalToUrl(pref);

    const allowed = getAvailablePortals(profile);
    if (allowed.includes(pref)) return portalToUrl(pref);
  }

  if (profile) return portalToUrl(roleForRouting(profile));

  const lastRole = norm(localStorage.getItem("boc.lastRole") || "customer");
  return portalToUrl(lastRole);
}

export function goToStartPage(opts = {}) {
  window.location.replace(resolveStartPage(opts));
}

/* --------------------------------------------------------------
   Portal capability helpers
   -------------------------------------------------------------- */

export function isGuest(profile) {
  return isGuestInternal(profile);
}

export function canUseCustomerPortal(profile) {
  if (!profile) return false;
  return true; // guests + signed-in users can use customer portal
}

export function canUseSpecialistPortal(profile) {
  if (!profile || isGuestInternal(profile)) return false;
  const roles = normalizeRoles(profile);
  return !!roles.specialist || !!roles.admin || !!roles.owner;
}

export function canUseAdminPortal(profile) {
  if (!profile || isGuestInternal(profile)) return false;
  const roles = normalizeRoles(profile);
  return !!roles.admin || !!roles.owner;
}

export function isOwner(profile) {
  const roles = normalizeRoles(profile);
  return !!roles.owner;
}

/* --------------------------------------------------------------
   Guards for pages
   -------------------------------------------------------------- */

export function requireAuth({
  guestNotAllowed = false,
  redirectTo = "../authentication/login.html",
} = {}) {
  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        if (guestNotAllowed) {
          window.location.replace(redirectTo);
          return;
        }
        resolve(null);
        return;
      }

      // Guest handling
      if (user.isAnonymous) {
        if (guestNotAllowed) {
          window.location.replace(redirectTo);
          return;
        }
        const guestProfile = { role: "guest", isGuest: true };
        try {
          localStorage.setItem("boc.lastRole", "guest");
        } catch { }
        resolve({ user, profile: guestProfile });
        return;
      }

      // Signed-in user: load profile
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const profileRaw = snap.exists() ? snap.data() : null;

      if (!profileRaw || profileRaw.status === "disabled") {
        window.location.replace(redirectTo);
        return;
      }

      // ✅ normalized roles (owner -> admin)
      const profile = { ...profileRaw, roles: normalizeRoles(profileRaw) };

      try {
        localStorage.setItem("boc.lastRole", roleForRouting(profile));
      } catch { }

      resolve({ user, profile });
    });
  });
}

export function requireRole({
  allowedRoles = ["customer"],
  guestAllowed = false,
  redirectTo = "../authentication/login.html",
} = {}) {
  const allowed = allowedRoles.map((r) => norm(r));

  return new Promise((resolve) => {
    onAuthStateChanged(auth, async (user) => {
      if (!user) {
        window.location.replace(redirectTo);
        return;
      }

      // Guest handling
      if (user.isAnonymous) {
        if (!guestAllowed) {
          window.location.replace(redirectTo);
          return;
        }
        const guestProfile = { role: "guest", isGuest: true };
        try {
          localStorage.setItem("boc.lastRole", "guest");
        } catch { }
        resolve({ user, profile: guestProfile });
        return;
      }

      // Signed-in user profile
      const ref = doc(db, "users", user.uid);
      const snap = await getDoc(ref);
      const profileRaw = snap.exists() ? snap.data() : null;

      if (!profileRaw || profileRaw.status === "disabled") {
        window.location.replace(redirectTo);
        return;
      }

      const profile = { ...profileRaw, roles: normalizeRoles(profileRaw) };
      const roles = profile.roles;

      const ok =
        (allowed.includes("customer") && true) ||
        (allowed.includes("specialist") &&
          (roles.specialist || roles.admin || roles.owner)) ||
        (allowed.includes("admin") && (roles.admin || roles.owner));

      if (!ok) {
        window.location.replace(resolveStartPage({ profile }));
        return;
      }

      try {
        localStorage.setItem("boc.lastRole", roleForRouting(profile));
      } catch { }

      resolve({ user, profile });
    });
  });
}
