// /public/authentication/profile.js

import {
  saveProfile,
  changeEmail,
  setOrChangePassword,
  uploadAvatarFile,
  deleteAccount,
  reloadCurrentUser,
  getUserProfile,
  logout,
} from "./auth.js";

import {
  requireAuth,
  canUseAdminPortal,
  canUseSpecialistPortal,
} from "./auth-utils.js";

const CUSTOMER_HOME = "../customer/home.html";
const SPECIALIST_HOME = "../specialist/home.html";
const ADMIN_HOME = "../admin/home.html";

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch {}
}

function rolesToBackHref(profile) {
  // Prefer the last portal the user used
  const lastRole = (safeGet("boc.lastRole") || "").toLowerCase();
  if (lastRole === "admin") return ADMIN_HOME;
  if (lastRole === "specialist") return SPECIALIST_HOME;

  // Otherwise decide from capabilities
  if (canUseAdminPortal(profile)) return ADMIN_HOME;
  if (canUseSpecialistPortal(profile)) return SPECIALIST_HOME;
  return CUSTOMER_HOME;
}

document.addEventListener("DOMContentLoaded", async () => {
  const globalError = document.getElementById("profile-global-error");
  const globalSuccess = document.getElementById("profile-global-success");
  const backLink = document.getElementById("back-link");
  const logoutLink = document.getElementById("logout-link");

  const basicForm = document.getElementById("basic-form");
  const emailForm = document.getElementById("email-form");
  const passwordForm = document.getElementById("password-form");
  const portalForm = document.getElementById("portal-form");

  const displayNameInput = document.getElementById("displayName");
  const phoneInput = document.getElementById("phone");
  const emailInput = document.getElementById("email");
  const newEmailInput = document.getElementById("newEmail");

  const newPasswordInput = document.getElementById("newPassword");
  const confirmPasswordInput = document.getElementById("confirmPassword");

  const defaultPortalSelect = document.getElementById("defaultPortal");

  const avatarInput = document.getElementById("avatar-input");
  const avatarPreview = document.getElementById("avatar-preview");
  const avatarRemove = document.getElementById("avatar-remove");

  const deleteButton = document.getElementById("delete-account");

  function showError(msg) {
    if (!globalError) return;
    globalError.textContent = msg || "";
    globalError.hidden = !msg;
    if (msg && globalSuccess) globalSuccess.hidden = true;
  }

  function showSuccess(msg) {
    if (!globalSuccess) return;
    globalSuccess.textContent = msg || "";
    globalSuccess.hidden = !msg;
    if (msg && globalError) globalError.hidden = true;
  }

  function setButtonsDisabled(disabled) {
    document
      .querySelectorAll(".profile-save-btn, #delete-account")
      .forEach((btn) => {
        btn.disabled = disabled;
      });
  }

  // Logout should actually sign out
  if (logoutLink) {
    logoutLink.addEventListener("click", async (e) => {
      e.preventDefault();
      try {
        await logout();
      } finally {
        window.location.replace("./login.html");
      }
    });
  }

  // 1) Require a signed-in (non-guest) user
  let session;
  try {
    session = await requireAuth({ guestNotAllowed: true });
    if (!session) {
      window.location.replace("./login.html");
      return;
    }
  } catch (e) {
    console.error(e);
    showError("Unable to load your profile. Please log in again.");
    return;
  }

  const { user } = session;

  // 2) Load a fresh profile from Firestore (roles included via auth.js helper)
  let p = session.profile || {};
  try {
    const freshProfile = await getUserProfile(user.uid);
    if (freshProfile) p = freshProfile;
  } catch (e) {
    console.warn("Could not load fresh profile:", e);
  }

  // 3) Configure Back link based on ?from= param, else based on lastRole/capabilities
  (() => {
    const params = new URLSearchParams(window.location.search);
    const from = (params.get("from") || "").toLowerCase();

    let href = CUSTOMER_HOME;
    if (from === "specialist") href = SPECIALIST_HOME;
    else if (from === "admin") href = ADMIN_HOME;
    else href = rolesToBackHref(p);

    if (backLink) backLink.href = href;
  })();

  // 4) Pre-fill forms with current data
  try {
    if (displayNameInput) {
      displayNameInput.value = p.displayName || p.name || user.displayName || "";
    }
    if (phoneInput) {
      phoneInput.value = p.phone || user.phoneNumber || "";
    }
    if (emailInput) {
      emailInput.value = user.email || p.email || "";
    }

    // avatar preview
    if (avatarPreview) {
      const src = user.photoURL || p.photoURL || "";
      if (src) {
        avatarPreview.src = src;
      } else {
        avatarPreview.src =
          "https://ui-avatars.com/api/?name=" +
          encodeURIComponent(displayNameInput?.value || "User") +
          "&background=4f46e5&color=ffffff&size=128";
      }
    }

    setupPortalPreference(p);
  } catch (e) {
    console.error(e);
  }

  function setupPortalPreference(profile) {
    if (!defaultPortalSelect) return;

    const options = [];
    options.push({ value: "auto", label: "Automatic (smart based on access)" });
    options.push({ value: "customer", label: "Customer portal" });

    if (canUseSpecialistPortal(profile)) {
      options.push({ value: "specialist", label: "Specialist portal" });
    }
    if (canUseAdminPortal(profile)) {
      options.push({ value: "admin", label: "Admin portal" });
    }

    defaultPortalSelect.innerHTML = "";
    options.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt.value;
      o.textContent = opt.label;
      defaultPortalSelect.appendChild(o);
    });

    let saved = safeGet("boc.defaultPortal") || "auto";
    saved = (saved || "").toLowerCase();

    // If they previously saved something they no longer have access to, reset to auto
    if (!options.find((x) => x.value === saved)) saved = "auto";
    defaultPortalSelect.value = saved;
  }

  // 5) Basic info form
  basicForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    showSuccess("");

    const displayName = (displayNameInput?.value || "").trim();
    const phone = (phoneInput?.value || "").trim();

    if (!displayName) {
      showError("Please enter a name.");
      return;
    }

    try {
      setButtonsDisabled(true);
      await saveProfile({ displayName, phone });
      await reloadCurrentUser();
      showSuccess("Basic details updated.");
    } catch (err) {
      console.error(err);
      showError("Could not update your details. Please try again.");
    } finally {
      setButtonsDisabled(false);
    }
  });

  // Avatar upload
  avatarInput?.addEventListener("change", async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    showError("");
    showSuccess("");

    try {
      setButtonsDisabled(true);
      const url = await uploadAvatarFile(file);
      if (avatarPreview) avatarPreview.src = url;
      showSuccess("Profile photo updated.");
    } catch (err) {
      console.error(err);
      showError(err?.message || "Could not upload profile photo.");
    } finally {
      setButtonsDisabled(false);
      avatarInput.value = "";
    }
  });

  // Avatar remove
  avatarRemove?.addEventListener("click", async () => {
    showError("");
    showSuccess("");

    if (!confirm("Remove your profile photo?")) return;

    try {
      setButtonsDisabled(true);
      await saveProfile({
        photoURL: "",
        displayName: (displayNameInput?.value || "").trim(),
        phone: (phoneInput?.value || "").trim(),
      });
      await reloadCurrentUser();

      if (avatarPreview) {
        avatarPreview.src =
          "https://ui-avatars.com/api/?name=" +
          encodeURIComponent(displayNameInput?.value || "User") +
          "&background=4f46e5&color=ffffff&size=128";
      }
      showSuccess("Profile photo removed.");
    } catch (e) {
      console.error(e);
      showError("Could not remove profile photo.");
    } finally {
      setButtonsDisabled(false);
    }
  });

  // 6) Email update
  emailForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    showSuccess("");

    const newEmail = (newEmailInput?.value || "").trim();
    if (!newEmail) {
      showError("Please enter a new email to update.");
      return;
    }

    try {
      setButtonsDisabled(true);
      await changeEmail(newEmail);
      if (emailInput) emailInput.value = newEmail;
      if (newEmailInput) newEmailInput.value = "";
      showSuccess("Email updated. Please check your inbox for verification.");
    } catch (err) {
      console.error(err);
      let msg = "Could not update your email. Please try again.";
      if (err?.code === "auth/email-already-in-use") msg = "That email is already linked to another account.";
      else if (err?.code === "auth/invalid-email") msg = "Please enter a valid email address.";
      showError(msg);
    } finally {
      setButtonsDisabled(false);
    }
  });

  // 7) Password update
  passwordForm?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    showSuccess("");

    const newPw = newPasswordInput?.value || "";
    const confirmPw = confirmPasswordInput?.value || "";

    if (!newPw || newPw.length < 6) {
      showError("Password must be at least 6 characters long.");
      return;
    }
    if (newPw !== confirmPw) {
      showError("Passwords do not match.");
      return;
    }

    try {
      setButtonsDisabled(true);
      await setOrChangePassword(newPw);
      if (newPasswordInput) newPasswordInput.value = "";
      if (confirmPasswordInput) confirmPasswordInput.value = "";
      showSuccess("Password updated.");
    } catch (err) {
      console.error(err);
      let msg = "Could not update your password. Please try again.";
      if (err?.code === "auth/weak-password") msg = "Password is too weak. Use at least 6 characters.";
      showError(msg);
    } finally {
      setButtonsDisabled(false);
    }
  });

  // 8) Portal preference
  portalForm?.addEventListener("submit", (e) => {
    e.preventDefault();
    showError("");
    showSuccess("");

    if (!defaultPortalSelect) return;
    const val = (defaultPortalSelect.value || "auto").toLowerCase();

    try {
      safeSet("boc.defaultPortal", val);

      // Nice UX: if they pick a concrete portal, also update lastRole hint
      if (val === "admin") safeSet("boc.lastRole", "admin");
      else if (val === "specialist") safeSet("boc.lastRole", "specialist");
      else if (val === "customer") safeSet("boc.lastRole", "customer");

      showSuccess("Portal preference saved.");
    } catch (err) {
      console.error(err);
      showError("Could not save portal preference.");
    }
  });

  // 9) Delete account
  deleteButton?.addEventListener("click", async () => {
    showError("");
    showSuccess("");

    const confirmed = confirm(
      "Are you sure you want to delete your Beauty on Cloud account? This action cannot be undone."
    );
    if (!confirmed) return;

    try {
      setButtonsDisabled(true);
      await deleteAccount();
      alert("Your account has been deleted. Thank you for using Beauty on Cloud.");
      window.location.replace("../index.html");
    } catch (err) {
      console.error(err);
      let msg =
        "Could not delete your account. You may need to sign in again and try once more.";
      if (err?.code === "auth/requires-recent-login") {
        msg = "Please log in again and then retry deleting your account for security reasons.";
      }
      showError(msg);
    } finally {
      setButtonsDisabled(false);
    }
  });
});
