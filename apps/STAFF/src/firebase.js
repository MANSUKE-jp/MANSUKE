import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyDyJG7U0FfhCIxY8AgBETobHvwQlGYhtlE",
    authDomain: "mansuke-app.firebaseapp.com",
    projectId: "mansuke-app",
    storageBucket: "mansuke-app.firebasestorage.app",
    messagingSenderId: "630381081049",
    appId: "1:630381081049:web:44ebc16d3eec7d722e69c8",
    measurementId: "G-KP8GD8L34P"
};

const app = initializeApp(firebaseConfig);

// Firestore: prepaid-card database
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'prepaid-card');

// Firestore: users database
export const usersDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'users');

// Firestore: orders database
export const ordersDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'orders');

// Cloud Functions (osaka region)
export const functions = getFunctions(app, "asia-northeast2");

// Auth
export const auth = getAuth(app);

// Helper to call functions
export const callFunction = (name) => httpsCallable(functions, name);

export default app;
