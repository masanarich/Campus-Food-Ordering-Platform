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

import {
  createBaseUserProfile,
  applyVendorApplicationToProfile,
  getDefaultPortalRoute,
  mapAuthErrorCode
} from "./auth-utils.js";

import { createAuthService } from "./auth-core.js";

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

export {
  authService
};