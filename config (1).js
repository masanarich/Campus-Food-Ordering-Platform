// public/authentication/config.js

import { initializeApp, getApps, getApp } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-app.js";
import {
    getAuth,
    GoogleAuthProvider,
    OAuthProvider,
    browserLocalPersistence,
    setPersistence
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-storage.js";
import { getFunctions } from "https://www.gstatic.com/firebasejs/11.0.0/firebase-functions.js";
import {
    getAnalytics,
    isSupported as analyticsIsSupported
} from "https://www.gstatic.com/firebasejs/11.0.0/firebase-analytics.js";

const firebaseConfig = {
    apiKey: "AIzaSyCoKYtzrL8ib4VDfd0Wr0cMjVPfgUkPtVA",
    authDomain: "campus-food-ordering-platform.firebaseapp.com",
    projectId: "campus-food-ordering-platform",
    storageBucket: "campus-food-ordering-platform.firebasestorage.app",
    messagingSenderId: "808109232496",
    appId: "1:808109232496:web:0c1bcd968c1493e3bbffb5",
    measurementId: "G-8696Y3GMFE"
};

// Prevent re-initializing Firebase if this file is imported in multiple places
const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Core services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "africa-south1");

// Providers
const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

// Optional provider settings
googleProvider.setCustomParameters({
    prompt: "select_account"
});

appleProvider.setCustomParameters({
    locale: "en"
});

// Analytics - only initialize when supported
let analytics = null;

async function initAnalytics() {
    if (await analyticsIsSupported()) {
        analytics = getAnalytics(app);
    }
    return analytics;
}

// Keep auth session on the device/browser
await setPersistence(auth, browserLocalPersistence);

export {
    app,
    auth,
    db,
    storage,
    functions,
    analytics,
    initAnalytics,
    googleProvider,
    appleProvider
};