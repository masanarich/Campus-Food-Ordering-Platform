// /public/authentication/reset.js

import { sendReset, currentUser } from "./auth.js";

function mapFirebaseError(code) {
  switch (code) {
    case "auth/missing-email":
      return "Please enter your email address.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/user-not-found":
      // We still keep wording safe (no account enumeration)
      return "If an account exists for this email, you will receive a reset link shortly.";
    case "auth/too-many-requests":
      return "Too many requests. Please wait a moment and try again.";
    case "auth/network-request-failed":
      return "Network error. Please check your connection and try again.";
    default:
      return "Something went wrong while sending the reset link. Please try again.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("reset-form");
  const emailInput = document.getElementById("email");
  const errorBox = document.getElementById("reset-error");
  const messageBox = document.getElementById("reset-message");

  // Prefill email if logged in
  try {
    const user = currentUser && currentUser();
    if (user?.email && emailInput) {
      emailInput.value = user.email;
    }
  } catch {
    // ignore
  }

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }

  function showMessage(msg) {
    if (!messageBox) return;
    messageBox.textContent = msg || "";
    messageBox.hidden = !msg;
  }

  function setLoading(isLoading) {
    const submitBtn = form?.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.disabled = isLoading;
      submitBtn.textContent = isLoading ? "Sending..." : "Send reset link";
    }
    if (emailInput) emailInput.disabled = isLoading;
  }

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    showError("");
    showMessage("");

    const email = (emailInput?.value || "").trim();
    if (!email) {
      showError("Please enter the email linked to your account.");
      return;
    }

    try {
      setLoading(true);
      await sendReset(email);

      showMessage(
        "If an account exists for this email, a password reset link has been sent. Please check your inbox and spam folder."
      );

      try {
        emailInput?.blur();
      } catch { }
    } catch (e) {
      console.error(e);
      showError(mapFirebaseError(e?.code));
    } finally {
      setLoading(false);
    }
  });
});
