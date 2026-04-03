// /public/authentication/login.js

import {
  emailLogin,
  googleLogin,
  appleLogin,
  guestBrowse,
  getUserProfile,
} from "./auth.js";

import { goToStartPage } from "./auth-utils.js";

function mapFirebaseError(code) {
  switch (code) {
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Incorrect email or password. Please try again.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before completing. Please try again.";
    case "auth/popup-blocked":
      return "Popup blocked by your browser. Please allow popups and try again.";
    default:
      return "Something went wrong while signing you in. Please try again.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("login-form");
  const errorBox = document.getElementById("login-error");

  const googleBtn = document.getElementById("google-login");
  const appleBtn = document.getElementById("apple-login");
  const guestBtn = document.getElementById("guest-browse");

  function showError(message) {
    if (!errorBox) return;
    errorBox.textContent = message || "";
    errorBox.hidden = !message;
  }

  function setLoading(isLoading) {
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? "Signing you in..." : "Log in";
    }

    [googleBtn, appleBtn, guestBtn].forEach((btn) => {
      if (btn) btn.disabled = isLoading;
    });
  }

  async function routeAfterLogin(user) {
    // Guest: no Firestore profile, but the app supports browsing
    if (user?.isAnonymous) {
      try {
        localStorage.setItem("boc.lastRole", "guest");
      } catch { }
      goToStartPage({ profile: { role: "guest", isGuest: true } });
      return;
    }

    // Signed-in user: load profile and route based on roles
    try {
      const profile = await getUserProfile(user.uid);
      goToStartPage({ profile: profile || null });
    } catch (e) {
      console.warn("Could not load profile; routing to default:", e);
      goToStartPage(); // fallback
    }
  }

  // Email/password login
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    const email = (form.email?.value || "").trim();
    const password = form.password?.value || "";

    if (!email || !password) {
      showError("Please enter your email and password.");
      return;
    }

    try {
      setLoading(true);

      const user = await emailLogin(email, password);

      // Optional: store remember flag (UI/UX preference)
      if (form.rememberMe?.checked) {
        try {
          localStorage.setItem("boc.rememberMe", "1");
        } catch { }
      } else {
        try {
          localStorage.removeItem("boc.rememberMe");
        } catch { }
      }

      await routeAfterLogin(user);
    } catch (e) {
      console.error(e);
      showError(mapFirebaseError(e?.code));
    } finally {
      setLoading(false);
    }
  });

  // Google login
  googleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      setLoading(true);
      const user = await googleLogin();
      await routeAfterLogin(user);
    } catch (e) {
      console.error(e);
      showError(mapFirebaseError(e?.code));
    } finally {
      setLoading(false);
    }
  });

  // Apple login
  appleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      setLoading(true);
      const user = await appleLogin();
      await routeAfterLogin(user);
    } catch (e) {
      console.error(e);
      showError(mapFirebaseError(e?.code));
    } finally {
      setLoading(false);
    }
  });

  // Guest browse (anonymous)
  guestBtn?.addEventListener("click", async () => {
    showError("");
    try {
      setLoading(true);
      const cred = await guestBrowse(); // returns UserCredential
      await routeAfterLogin(cred.user);
    } catch (e) {
      console.error(e);
      showError("Could not start guest session. Please try again.");
    } finally {
      setLoading(false);
    }
  });
});
