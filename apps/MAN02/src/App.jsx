import React, { useState, useEffect } from 'react';
import { signInAnonymously, signInWithCustomToken, signOut } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db, usersDb } from './firebase';
import MapPage from './pages/MapPage';

// ローディングオーバーレイ
const LoadingOverlay = ({ message }) => (
    <div className="loading-overlay">
        <h1 className="loading-logo">MANSUKE</h1>
        <p className="loading-message">{message}</p>
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
                            isStaff: true
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

                    // usersデータベースからユーザー情報を取得
                    const userDoc = await getDoc(doc(usersDb, 'users', data.uid));
                    let userData = null;
                    if (userDoc.exists()) {
                        userData = userDoc.data();
                        setMansukeUser(userData);
                    }

                    // man02データベースからアクセス権限を確認
                    const isStaff = userData?.isStaff === true;
                    if (!isStaff) {
                        try {
                            const accessDoc = await getDoc(doc(db, 'config', 'access'));
                            if (accessDoc.exists()) {
                                const allowedUids = accessDoc.data().allowedUids || [];
                                if (!allowedUids.includes(data.uid)) {
                                    setAccessDenied(true);
                                }
                            } else {
                                // config/accessドキュメントが存在しない場合はアクセス拒否
                                setAccessDenied(true);
                            }
                        } catch (err) {
                            console.error("アクセス権限の確認に失敗:", err);
                            setAccessDenied(true);
                        }
                    }

                    if (!userData) {
                        setAccessDenied(true);
                    }
                } else if (res.status === 401) {
                    setLoadingMessage("ログイン画面へリダイレクト中...");
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `https://my.mansuke.jp/sso?redirect=${currentUrl}`;
                }
            } catch (err) {
                console.error("認証エラー:", err);
                setAccessDenied(true);
            } finally {
                setIsRestoring(false);
            }
        };

        checkMansukeAuth();
    }, []);

    // ユーザー情報のリアルタイム監視
    useEffect(() => {
        if (!user?.uid || window.location.hostname === 'localhost') return;
        const unsubscribe = onSnapshot(doc(usersDb, 'users', user.uid), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMansukeUser(prev => ({ ...prev, ...data }));
                // isStaffが無効化された場合は再チェック
                if (!data.isStaff) {
                    // ホワイトリストを再確認
                    getDoc(doc(db, 'config', 'access')).then(accessDoc => {
                        if (accessDoc.exists()) {
                            const allowedUids = accessDoc.data().allowedUids || [];
                            if (!allowedUids.includes(user.uid)) {
                                setAccessDenied(true);
                            }
                        } else {
                            setAccessDenied(true);
                        }
                    }).catch(() => setAccessDenied(true));
                }
            } else {
                setAccessDenied(true);
            }
        });
        return () => unsubscribe();
    }, [user?.uid]);

    const handleLogout = async () => {
        try {
            await signOut(auth);
        } catch (e) { /* ignore */ }
        localStorage.removeItem('mansuke_sso_token');
        const domains = ['.mansuke.jp', 'mansuke.jp', window.location.hostname, ''];
        domains.forEach(d => {
            const domainStr = d ? `domain=${d};` : '';
            document.cookie = `__session=; ${domainStr} path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
            document.cookie = `__session=; ${domainStr} path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
        });
        window.location.href = 'https://my.mansuke.jp';
    };

    if (isRestoring) return <LoadingOverlay message={loadingMessage} />;

    if (accessDenied) {
        return (
            <div className="access-denied-page">
                <div className="access-denied-card">
                    <div className="access-denied-icon">🔒</div>
                    <h1 className="access-denied-title">ACCESS DENIED</h1>
                    <p className="access-denied-text">
                        このアプリケーション（MANSUKE MAN02）へのアクセス権限がありません。<br />
                        管理者にお問い合わせください。
                    </p>
                    <button onClick={handleLogout} className="btn btn-secondary" style={{ marginTop: 24 }}>
                        ログアウトしてMyMANSUKEに戻る
                    </button>
                </div>
            </div>
        );
    }

    return <MapPage user={user} mansukeUser={mansukeUser} onLogout={handleLogout} />;
};

export default App;
