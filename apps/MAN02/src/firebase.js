import { initializeApp } from "firebase/app";
import { initializeFirestore } from "firebase/firestore";
import { getFunctions, httpsCallable } from "firebase/functions";
import { getAuth } from "firebase/auth";

// MAN02専用のFirebase設定
const firebaseConfig = {
    apiKey: "AIzaSyDyJG7U0FfhCIxY8AgBETobHvwQlGYhtlE",
    authDomain: "mansuke-app.firebaseapp.com",
    databaseURL: "https://mansuke-app-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "mansuke-app",
    storageBucket: "mansuke-app.firebasestorage.app",
    messagingSenderId: "630381081049",
    appId: "1:630381081049:web:a19bd55dd3b88dbf2e69c8",
    measurementId: "G-BJ84S1BB9E"
};

const app = initializeApp(firebaseConfig);

// Firestore: man02データベース
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'man02');

// Firestore: usersデータベース
export const usersDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'users');

// Cloud Functions（大阪リージョン）
export const functions = getFunctions(app, "asia-northeast2");

// 認証
export const auth = getAuth(app);

// Cloud Functions呼び出しヘルパー
export const callFunction = (name) => httpsCallable(functions, name);

export default app;
