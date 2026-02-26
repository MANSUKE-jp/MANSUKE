import { initializeApp } from "firebase/app";
import { getFirestore, initializeFirestore } from "firebase/firestore";
import { getFunctions } from "firebase/functions";
import { getAuth } from "firebase/auth";

// ご提供いただいた設定情報
const firebaseConfig = {
    apiKey: "AIzaSyDyJG7U0FfhCIxY8AgBETobHvwQlGYhtlE",
    authDomain: "mansuke-app.firebaseapp.com",
    projectId: "mansuke-app",
    storageBucket: "mansuke-app.firebasestorage.app",
    messagingSenderId: "630381081049",
    appId: "1:630381081049:web:44ebc16d3eec7d722e69c8",
    measurementId: "G-KP8GD8L34P"
};

// Firebase初期化
const app = initializeApp(firebaseConfig);

// Firestoreの初期化 (prepaid-card)
export const db = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'prepaid-card');

// Firestoreの初期化 (code-hub) - 追加
// 2つ目のデータベースインスタンスを作成します
export const codeHubDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'code-hub');

// Cloud Functionsの初期化 (第2引数で大阪リージョンを指定)
export const functions = getFunctions(app, "asia-northeast2");

// ユーザー情報用データベース
export const usersDb = initializeFirestore(app, {
    experimentalForceLongPolling: true,
}, 'users');

// Authインスタンスのエクスポート
export const auth = getAuth(app);

export default app;