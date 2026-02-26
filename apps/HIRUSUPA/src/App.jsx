import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
// Firebase Auth関連を追加
import { signInAnonymously, onAuthStateChanged } from "firebase/auth";
import { auth, functions } from './config/firebase';
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore"; // もし直接読み取る場合に備えて（基本はFunction使用）

// コンポーネントのインポート
import WelcomeScreen from './screens/WelcomeScreen';
import FormScreen from './screens/FormScreen';
import ProcessingScreen from './screens/ProcessingScreen';
import FinishScreen from './screens/FinishScreen';
import SearchScreen from './screens/SearchScreen';
import AccountDisplay from './components/AccountDisplay';
import './App.css';

function App() {
  // 画面遷移の状態管理
  const [currentScreen, setCurrentScreen] = useState('welcome');

  // フォームから受け取ったデータを保存するstate
  const [submissionData, setSubmissionData] = useState(null);

  // 実行結果（送信回数など）を保存するstate
  const [resultCount, setResultCount] = useState(0);
  const [geminiCallCount, setGeminiCallCount] = useState(0);

  // 認証状態（デバッグ用・Firebase匿名）
  const [user, setUser] = useState(null);

  // MANSUKE認証状態
  const [mansukeUser, setMansukeUser] = useState(null);
  const [isBalanceLoading, setIsBalanceLoading] = useState(false);

  // 残高を最新化する共通関数
  const refreshBalance = async () => {
    try {
      if (!mansukeUser?.uid) return;
      setIsBalanceLoading(true);
      const getUserBalanceFn = httpsCallable(functions, 'getUserBalance');
      const result = await getUserBalanceFn({
        token: localStorage.getItem('mansuke_sso_token')
      });
      if (result.data && typeof result.data.balance !== 'undefined') {
        setMansukeUser(prev => prev ? ({
          ...prev,
          balance: result.data.balance || 0
        }) : null);
      }
    } catch (e) {
      // silent
    } finally {
      setIsBalanceLoading(false);
    }
  };

  // --- アプリ起動時の自動ログイン処理 ---
  useEffect(() => {
    const login = async () => {
      // localhostの場合のみ匿名ログインを試行
      if (window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
        return;
      }

      try {
        // 匿名ログインを実行
        await signInAnonymously(auth);
      } catch (error) {
        // silent
      }
    };

    // ログイン状態を監視
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      if (currentUser) {
        setUser(currentUser);
      } else {
        setUser(null);
      }
    });

    login();

    // MANSUKEログイン状態を確認
    const checkMansukeAuth = async () => {
      // Intercept SSO tokens from MyMANSUKE
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

      try {
        const res = await fetch('https://my.mansuke.jp/api/verifyMansukeToken', {
          method: 'GET',
          headers: {
            ...(token ? { "Authorization": `Bearer ${token}` } : {})
          },
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          setMansukeUser(data);

          // 残高を初回取得
          refreshBalance();
        } else if (res.status === 401) {
          // 未ログインの場合は MyMANSUKE の /sso ページへリダイレクト (クロスドメイン認証用)
          const currentUrl = encodeURIComponent(window.location.href);
          window.location.href = `https://my.mansuke.jp/sso?redirect=${currentUrl}`;
        }
      } catch (err) {
        // silent
      }
    };
    checkMansukeAuth();

    return () => unsubscribe();
  }, []);
  // ------------------------------------

  // 画面遷移ハンドラー
  const handleNavigate = (screenId) => {
    setCurrentScreen(screenId);
  };

  // フォーム送信ハンドラー（次のステップへ）
  const handleFormSubmit = (data) => {
    setSubmissionData(data);
    setCurrentScreen('processing');
  };

  // 処理停止ハンドラー（終了画面へ）
  const handleStop = (count, geminiCalls = 0) => {
    setResultCount(count);
    setGeminiCallCount(geminiCalls);
    setCurrentScreen('finish');
  };

  // 現在の画面に応じたコンポーネントを返す
  const renderScreen = () => {
    switch (currentScreen) {
      case 'welcome':
        return <WelcomeScreen onNavigate={handleNavigate} />;

      case 'formScreen':
        return (
          <FormScreen
            onBack={() => setCurrentScreen('welcome')}
            onSubmit={handleFormSubmit}
            user={mansukeUser}
            refreshBalance={refreshBalance}
            isBalanceLoading={isBalanceLoading}
          />
        );

      case 'processing':
        return (
          <ProcessingScreen
            formData={submissionData}
            onStop={handleStop}
            user={mansukeUser}
          />
        );

      case 'finish':
        return (
          <FinishScreen
            count={resultCount}
            geminiCalls={geminiCallCount}
            onReset={() => setCurrentScreen('welcome')}
          />
        );

      case 'search':
        return (
          <SearchScreen
            onBack={() => setCurrentScreen('welcome')}
          />
        );

      default:
        return <WelcomeScreen onNavigate={handleNavigate} />;
    }
  };

  return (
    // 背景色を slate-50 から slate-200 に変更し、全体的にしっかりとしたグレーにします
    <div className="min-h-screen bg-slate-200 text-slate-800 font-sans selection:bg-blue-200">
      {/* 背景装飾 */}
      <div className="fixed inset-0 z-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-slate-100/40 via-transparent to-transparent opacity-60"></div>

      {/* メインコンテンツ */}
      <main className="relative z-10 min-h-screen">
        <AnimatePresence mode="wait">
          <motion.div
            key={currentScreen}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            className="w-full"
          >
            {renderScreen()}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* アカウント表示 (ログイン時のみ) */}
      <AccountDisplay user={mansukeUser} />
    </div>
  );
}

export default App;