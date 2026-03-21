import { initializeApp } from 'firebase/app';
import {
    getAuth,
    GoogleAuthProvider,
    setPersistence,
    browserLocalPersistence,
} from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getFunctions, httpsCallable, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence);

export const storage = getStorage(app);

// Firestore: "users"データベースIDを使用（"default"ではない）
export const db = getFirestore(app, 'users');

export const functions = getFunctions(app, 'asia-northeast2');

// ローカルでFirebaseエミュレーターを使用する場合はコメントを解除する:
// connectFunctionsEmulator(functions, 'localhost', 5001);

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Callable Cloud Functions呼び出しヘルパー
export const callFunction = (name) => httpsCallable(functions, name);

export default app;