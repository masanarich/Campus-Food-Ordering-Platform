// /public/authentication/role-choice.js

import { requireAuth } from "./auth-utils.js";
import { logout } from "./auth.js";

const CUSTOMER_HOME = "../customer/home.html";
const SPECIALIST_HOME = "../specialist/home.html";
const ADMIN_HOME = "../admin/home.html";

function norm(s) {
  return (s || "").toString().trim().toLowerCase();
}

function safeSet(key, val) {
  try {
    localStorage.setItem(key, val);
  } catch { }
}

function safeGet(key) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

document.addEventListener("DOMContentLoaded", async () => {
  const portalContainer = document.getElementById("portal-buttons");
  const errorBox = document.getElementById("role-error");
  const logoutLink = document.getElementById("logout-link");

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

  function showError(msg) {
    if (!errorBox) return;
    errorBox.textContent = msg || "";
    errorBox.hidden = !msg;
  }

  function clearButtons() {
    if (portalContainer) portalContainer.innerHTML = "";
  }

  function addButton(label, key, url) {
    const btn = document.createElement("button");
    btn.className = "btn btn-primary portal-button";
    btn.textContent = label;

    btn.addEventListener("click", () => {
      // Remember user preference for next time
      safeSet("boc.defaultPortal", key);

      // Also keep lastRole updated for simple routing elsewhere
      if (key === "admin") safeSet("boc.lastRole", "admin");
      else if (key === "specialist") safeSet("boc.lastRole", "specialist");
      else safeSet("boc.lastRole", "customer");

      window.location.replace(url);
    });

    portalContainer.appendChild(btn);
  }

  try {
    const session = await requireAuth({ guestNotAllowed: true });
    if (!session) {
      window.location.replace("./login.html");
      return;
    }

    const { user, profile } = session;

    // Guests should never be here
    if (user?.isAnonymous || profile?.isGuest || profile?.role === "guest") {
      window.location.replace(CUSTOMER_HOME);
      return;
    }

    // Roles object model (auth.js/auth-utils.js should already normalize it)
    const roles = profile?.roles || {};

    const canCustomer = true; // any signed-in user
    const canSpecialist = !!roles.specialist || !!roles.admin || !!roles.owner;
    const canAdmin = !!roles.admin || !!roles.owner;

    // Build available portals list
    const portals = [];
    if (canCustomer) portals.push({ key: "customer", label: "Customer Portal", url: CUSTOMER_HOME });
    if (canSpecialist) portals.push({ key: "specialist", label: "Specialist Portal", url: SPECIALIST_HOME });
    if (canAdmin) portals.push({ key: "admin", label: "Admin Portal", url: ADMIN_HOME });

    // If only one portal, skip this page
    if (portals.length <= 1) {
      window.location.replace(portals[0]?.url || CUSTOMER_HOME);
      return;
    }

    // If user has a preferred portal and it's allowed, auto-send them there
    const pref = norm(safeGet("boc.defaultPortal"));
    const preferred = portals.find((p) => p.key === pref);
    if (preferred) {
      window.location.replace(preferred.url);
      return;
    }

    // Otherwise show buttons
    clearButtons();
    portals.forEach((p) => addButton(p.label, p.key, p.url));

    // Add a logout button at the bottom
    const logoutBtn = document.createElement("button");
    logoutBtn.className = "btn auth-provider ghost portal-button";
    logoutBtn.textContent = "Log out";
    logoutBtn.addEventListener("click", async () => {
      try {
        await logout();
      } finally {
        window.location.replace("./login.html");
      }
    });
    portalContainer.appendChild(logoutBtn);

  } catch (err) {
    console.error(err);
    showError("Unable to load your account. Please log in again.");
  }
});
