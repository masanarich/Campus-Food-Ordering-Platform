// Copy this file to public/authentication/config.js and replace the
// placeholder values with your Firebase project's web app configuration.

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
    apiKey: "YOUR_FIREBASE_WEB_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_FIREBASE_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app, "africa-south1");

const googleProvider = new GoogleAuthProvider();
const appleProvider = new OAuthProvider("apple.com");

googleProvider.setCustomParameters({
    prompt: "select_account"
});

appleProvider.setCustomParameters({
    locale: "en"
});

let analytics = null;

async function initAnalytics() {
    if (await analyticsIsSupported()) {
        analytics = getAnalytics(app);
    }
    return analytics;
}

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
