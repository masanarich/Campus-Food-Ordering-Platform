/**
 * auth.js
 *
 * Firebase wiring layer for the Campus Food Ordering Platform.
 * This file connects real Firebase services and SDK functions
 * to the testable auth-core service.
 */

import {
  auth,
  db, 
  googleProvider,
  appleProvider
} from "./config.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

const authUtils = typeof window !== "undefined" ? window.authUtils : undefined;
const authCore = typeof window !== "undefined" ? window.authCore : undefined;

if (!authUtils) {
  throw new Error(
    "window.authUtils is required. Make sure auth-utils.js is loaded before auth.js."
  );
}

if (!authCore || typeof authCore.createAuthService !== "function") {
  throw new Error(
    "window.authCore.createAuthService is required. Make sure auth-core.js is loaded before auth.js."
  );
}

const {
  createBaseUserProfile,
  applyVendorApplicationToProfile,
  getDefaultPortalRoute,
  mapAuthErrorCode
} = authUtils;

const { createAuthService } = authCore;

const authService = createAuthService({
  auth,
  db,
  googleProvider,
  appleProvider,
  authFns: {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut: firebaseSignOut,
    onAuthStateChanged,
    updateProfile,
    sendPasswordResetEmail
  },
  firestoreFns: {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    serverTimestamp
  },
  utils: {
    createBaseUserProfile,
    applyVendorApplicationToProfile,
    getDefaultPortalRoute,
    mapAuthErrorCode
  }
});

export { authService };

if (typeof window !== "undefined") {
  window.authService = authService;
}