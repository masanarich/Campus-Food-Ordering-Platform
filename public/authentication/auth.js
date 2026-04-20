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
  storage,
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
  updatePassword,
  deleteUser,
  sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";

import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";

const authUtils =
  typeof window !== "undefined" ? window.authUtils : undefined;

const authCore =
  typeof window !== "undefined" ? window.authCore : undefined;

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

const authService = authCore.createAuthService({
  auth,
  db,
  storage,
  googleProvider,
  appleProvider,
  authFns: {
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    signOut: firebaseSignOut,
    onAuthStateChanged,
    updateProfile,
    updatePassword,
    deleteUser,
    sendPasswordResetEmail
  },
  firestoreFns: {
    doc,
    getDoc,
    setDoc,
    updateDoc,
    deleteDoc,
    serverTimestamp
  },
  storageFns: {
    ref,
    uploadBytes,
    getDownloadURL,
    deleteObject
  },
  utils: authUtils
});

export { authService };

if (typeof window !== "undefined") {
  window.authService = authService;
}