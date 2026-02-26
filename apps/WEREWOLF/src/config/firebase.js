import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getFunctions } from 'firebase/functions';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

// アプリ初期化ロジック
// シングルトンパターン採用
// HMR(ホットリロード)時の重複初期化エラー回避のため getApps().length で判定
// 初期化済みなら getApp() で既存インスタンス取得
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Firestoreインスタンスのエクスポート (werewolf データベースを指定)
export const db = getFirestore(app, "werewolf");

// ユーザー情報用データベース
export const usersDb = getFirestore(app, "users");

// Authインスタンスのエクスポート
export const auth = getAuth(app);

// Cloud Functionsインスタンスのエクスポート
// 第2引数: リージョン指定 'asia-northeast2' (大阪)
// デプロイ先リージョンと一致させる必要あり
export const functions = getFunctions(app, 'asia-northeast2');