import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, usersDb } from './config/firebase';
import AppLayout from './components/layout/AppLayout';
import Home from './pages/Home';
import Register from './pages/Register';
import Activate from './pages/Activate';

const LoadingOverlay = ({ message }) => (
  <div className="fixed inset-0 z-[10000] bg-black flex flex-col items-center justify-center text-white">
    <h1 className="text-3xl font-display font-bold tracking-widest mb-6 bg-gradient-to-r from-blue-600 via-teal-400 to-green-500 bg-clip-text text-transparent animate-gradient-move">MANSUKE</h1>
    <p className="font-mono text-sm opacity-70 animate-pulse">{message}</p>
  </div>
);

const App = () => {
  const [user, setUser] = useState(null);
  const [mansukeUser, setMansukeUser] = useState(null);
  const [isRestoring, setIsRestoring] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState("認証情報を確認中...");
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    let token = params.get('token');
    if (token) {
      localStorage.setItem('mansuke_sso_token', token);
      document.cookie = `__session=${token}; path=/; max-age=3600; secure; samesite=lax`;
      const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
      window.history.replaceState({ path: newUrl }, '', newUrl);
    } else {
      token = localStorage.getItem('mansuke_sso_token');
    }

    const checkMansukeAuth = async () => {
      const isLocalhost = window.location.hostname === 'localhost';

      try {
        if (isLocalhost) {
          setLoadingMessage("ローカル環境ゲスト認証中...");
          try {
            const cred = await signInAnonymously(auth);
            setUser(cred.user);
            setMansukeUser({
              uid: cred.user.uid,
              nickname: 'DevUser',
              isAnonymous: true,
              isStaff: true // staff bypass on localhost
            });
            setIsRestoring(false);
            return;
          } catch (err) {
            // silent
          }
        }

        setLoadingMessage("SSOトークンを検証中...");
        const res = await fetch("/api/verifyMansukeToken", {
          method: "GET",
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          credentials: "include"
        });

        if (res.ok) {
          const data = await res.json();

          if (data.customToken) {
            setLoadingMessage("Firebase認証を実行中...");
            const cred = await signInWithCustomToken(auth, data.customToken);
            setUser(cred.user);
          } else {
            setUser({ uid: data.uid });
          }

          setLoadingMessage("権限を確認中...");
          const userDoc = await getDoc(doc(usersDb, 'users', data.uid));
          if (userDoc.exists()) {
            const userData = userDoc.data();
            setMansukeUser(userData);

            if (!userData.isStaff) {
              setAccessDenied(true);
            }
          } else {
            setAccessDenied(true);
          }
        } else if (res.status === 401) {
          setLoadingMessage("ログイン画面へリダイレクト中...");
          const currentUrl = encodeURIComponent(window.location.href);
          window.location.href = `https://my.mansuke.jp/sso?redirect=${currentUrl}`;
        }
      } catch (err) {
        setAccessDenied(true);
      } finally {
        setIsRestoring(false);
      }
    };

    checkMansukeAuth();
  }, []);

  useEffect(() => {
    if (!user?.uid || window.location.hostname === 'localhost') return;
    const unsubscribe = onSnapshot(doc(usersDb, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMansukeUser(prev => ({ ...prev, ...data }));
        if (!data.isStaff) setAccessDenied(true);
      } else {
        setAccessDenied(true);
      }
    });
    return () => unsubscribe();
  }, [user?.uid]);

  if (isRestoring) return <LoadingOverlay message={loadingMessage} />;

  if (accessDenied) {
    return (
      <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl md:text-5xl font-bold mb-6 text-red-500 tracking-wider">ACCESS DENIED</h1>
        <p className="text-gray-400 mb-8 max-w-md">
          このアプリケーション（MANSUKE PREPAID CARD）はスタッフ専用です。実行権限がありません。
        </p>
        <button
          onClick={() => window.location.href = 'https://my.mansuke.jp'}
          className="px-6 py-3 border border-white/20 hover:bg-white hover:text-black transition-colors"
        >
          MyMANSUKEに戻る
        </button>
      </div>
    );
  }

  return (
    <BrowserRouter>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/activate" element={<Activate />} />
          <Route path="/register" element={<Register />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
    </BrowserRouter>
  );
};

export default App;