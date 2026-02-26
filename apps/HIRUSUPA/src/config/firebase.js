import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getFunctions } from "firebase/functions"; // Functionsを追加

// 環境変数を読み込み
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  // Realtime DatabaseのURLを追加 (必須)
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "mansuke-app",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// アプリの初期化
const app = initializeApp(firebaseConfig);

export const db = getFirestore(app, "hirusupa");
export const usersDb = getFirestore(app, "users");
export const auth = getAuth(app);
export const rtdb = getDatabase(app);
export const functions = getFunctions(app, "asia-northeast2");

export default app;