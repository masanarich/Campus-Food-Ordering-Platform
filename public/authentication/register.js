// /public/authentication/register.js

import {
  registerWithEmail,
  googleLogin,
  appleLogin,
  guestBrowse,
  getUserProfile,
} from "./auth.js";

import { goToStartPage } from "./auth-utils.js";

function mapFirebaseError(code) {
  switch (code) {
    case "auth/email-already-in-use":
      return "An account with this email already exists. Try logging in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Your password is too weak. Try at least 6 characters.";
    case "auth/popup-closed-by-user":
      return "The sign-in window was closed before completing. Please try again.";
    case "auth/popup-blocked":
      return "Popup blocked by your browser. Please allow popups and try again.";
    default:
      return "Something went wrong while creating your account. Please try again.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("register-form");
  const errorBox = document.getElementById("register-error");

  const googleBtn = document.getElementById("google-signup");
  const appleBtn = document.getElementById("apple-signup");
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
      submitBtn.textContent = isLoading ? "Creating account..." : "Create account";
    }
    [googleBtn, appleBtn, guestBtn].forEach((btn) => {
      if (btn) btn.disabled = isLoading;
    });
  }

  async function routeAfterAuth(user) {
    // Guest
    if (user?.isAnonymous) {
      try {
        localStorage.setItem("boc.lastRole", "guest");
      } catch { }
      goToStartPage({ profile: { role: "guest", isGuest: true } });
      return;
    }

    // Signed-in user
    try {
      const profile = await getUserProfile(user.uid);
      goToStartPage({ profile: profile || null });
    } catch (e) {
      console.warn("Could not load profile; routing to default:", e);
      goToStartPage();
    }
  }

  // Email/password registration (everyone starts as customer)
  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");

    const displayName = (form.displayName?.value || "").trim();
    const email = (form.email?.value || "").trim();
    const password = form.password?.value || "";
    const confirmPassword = form.confirmPassword?.value || "";
    const acceptTerms = !!form.acceptTerms?.checked;

    if (!acceptTerms) {
      showError("Please accept the Terms, Privacy and Cookies policies to continue.");
      return;
    }

    if (!displayName) {
      showError("Please enter your full name.");
      return;
    }

    if (password !== confirmPassword) {
      showError("Passwords do not match. Please try again.");
      return;
    }

    try {
      setLoading(true);
      const user = await registerWithEmail({
        name: displayName,
        email,
        password,
      });

      await routeAfterAuth(user);
    } catch (e) {
      console.error(e);
      showError(mapFirebaseError(e?.code));
    } finally {
      setLoading(false);
    }
  });

  // Google signup
  googleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      setLoading(true);
      const user = await googleLogin(); // auth.js ensures profile exists
      await routeAfterAuth(user);
    } catch (e) {
      console.error(e);
      showError(mapFirebaseError(e?.code));
    } finally {
      setLoading(false);
    }
  });

  // Apple signup
  appleBtn?.addEventListener("click", async () => {
    showError("");
    try {
      setLoading(true);
      const user = await appleLogin(); // auth.js ensures profile exists
      await routeAfterAuth(user);
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
      const cred = await guestBrowse();
      await routeAfterAuth(cred.user);
    } catch (e) {
      console.error(e);
      showError("Could not start guest session. Please try again.");
    } finally {
      setLoading(false);
    }
  });
});
