import React, { useState, useEffect } from 'react';

import { signInAnonymously, signInWithCustomToken } from 'firebase/auth';
import { doc, onSnapshot, getDoc, collection, query } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { HomeScreen } from './screens/HomeScreen.jsx';
import { LobbyScreen } from './screens/LobbyScreen.jsx';
import { GameScreen } from './screens/GameScreen.jsx';
import { ResultScreen } from './screens/ResultScreen.jsx';
import { LogViewerScreen } from './screens/LogViewerScreen.jsx';
import { Notification } from './components/ui/Notification.jsx';
import AccountDisplay from '../../../shared/components/AccountDisplay.jsx';
import { db, auth, usersDb, functions } from './config/firebase.js';
import LoadingScreen from './components/ui/LoadingScreen.jsx';
import { HEARTBEAT_INTERVAL_MS } from './constants/gameData.js';
import { LogIn, XCircle, MonitorX, ExternalLink, Copy, Check } from 'lucide-react';

// アプリケーションルートコンポーネント
// 全体的な状態管理、ルーティング（画面切替）、Firebase初期化、セッション管理を担当
export default function App() {
    // ステート: 認証・ユーザー
    const [user, setUser] = useState(null);
    const [mansukeUser, setMansukeUser] = useState(null); // MANSUKEアカウント情報
    const [loadingMessage, setLoadingMessage] = useState("CONNECTING..."); // 読み込みメッセージ

    // ステート: 画面遷移管理 ('home' | 'lobby' | 'game' | 'result' | 'logs')
    const [view, setView] = useState('home');

    // ステート: ゲームデータ
    const [roomCode, setRoomCode] = useState("");
    const [room, setRoom] = useState(null);
    const [players, setPlayers] = useState([]);
    const [myPlayer, setMyPlayer] = useState(null);

    // ステート: システム・UI
    const [notification, setNotification] = useState(null);
    const [maintenanceMode, setMaintenanceMode] = useState(false);

    // ステート: セッション復帰機能
    const [restoreRoomId, setRestoreRoomId] = useState(null);
    const [isRestoring, setIsRestoring] = useState(true); // 初期ロードフラグ
    const [showRestoreModal, setShowRestoreModal] = useState(false);

    // ステート: 環境判定
    const [isMobileView, setIsMobileView] = useState(false); // スマホ/縦画面判定
    const [isInAppBrowser, setIsInAppBrowser] = useState(false); // アプリ内ブラウザ判定
    const [isUrlCopied, setIsUrlCopied] = useState(false);

    // Effect: 画面サイズ・閲覧環境チェック
    // スマホやアプリ内ブラウザでの閲覧を制限するための判定ロジック
    useEffect(() => {
        const checkScreen = () => {
            const isSmall = window.innerWidth < 768; // 幅768px未満
            const isPortrait = window.innerHeight > window.innerWidth; // 縦長
            // どちらかに該当すればモバイルビューとみなす
            setIsMobileView(isSmall || isPortrait);
        };

        // アプリ内ブラウザ判定 (UA文字列チェック)
        const checkInAppBrowser = () => {
            const ua = window.navigator.userAgent.toLowerCase();

            // 判定対象キーワード
            const inAppKeywords = [
                'slack', 'line', 'instagram', 'fban', 'fbav', 'fb_iab',
                'twitter', 'micromessenger', 'tiktok', 'pinterest',
                'snapchat', 'yjapp', 'yjm', 'googlesearchapp', 'wv'
            ];

            const isBlacklisted = inAppKeywords.some(keyword => ua.includes(keyword));
            setIsInAppBrowser(isBlacklisted);
        };

        checkScreen();
        checkInAppBrowser();
        window.addEventListener('resize', checkScreen);
        return () => window.removeEventListener('resize', checkScreen);
    }, []);

    // Effect: MANSUKE認証トークン検証 (Cookie / URL Parameter) 
    useEffect(() => {
        // Intercept SSO tokens from MyMANSUKE
        const params = new URLSearchParams(window.location.search);
        let token = params.get('token');
        if (token) {
            // Write to local storage as backup for Safari Cross-Origin tracking prevention
            localStorage.setItem('mansuke_sso_token', token);
            // Write to cookie manually. SameSite=Lax since it's First-Party context now.
            document.cookie = `__session=${token}; path=/; max-age=3600; secure; samesite=lax`;
            // Remove token from URL for security
            const newUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
            window.history.replaceState({ path: newUrl }, '', newUrl);
        } else {
            token = localStorage.getItem('mansuke_sso_token');
        }

        const checkMansukeAuth = async () => {
            const isLocalhost = window.location.hostname === 'localhost';

            try {
                // If on localhost, bypass MyMANSUKE SSO and use anonymous auth
                if (isLocalhost) {
                    setLoadingMessage("ゲストとして認証中...");
                    try {
                        const cred = await signInAnonymously(auth);
                        setUser(cred.user);

                        const randomId = Math.floor(10000 + Math.random() * 90000);
                        const guestNickname = `GUEST${randomId}`;

                        setMansukeUser({
                            uid: cred.user.uid,
                            nickname: guestNickname,
                            displayName: guestNickname,
                            isAnonymous: true,
                            balance: 0
                        });
                        // Try to fetch real balance from usersDb even for anonymous guest (if they returned)
                        const userDoc = await getDoc(doc(usersDb, 'users', cred.user.uid));
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            setMansukeUser(prev => ({ ...prev, balance: userData.balance || 0, nickname: userData.nickname || guestNickname }));
                        }

                        setLoadingMessage("準備完了");
                        setIsRestoring(false);
                        return;
                    } catch {
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
                    setLoadingMessage("プレイヤー情報を読み込み中...");

                    if (data.customToken) {
                        try {
                            setLoadingMessage("Firebase認証を実行中...");
                            const cred = await signInWithCustomToken(auth, data.customToken);
                            setUser(cred.user);
                        } catch {
                            setUser({ uid: data.uid });
                        }
                    } else {
                        setUser({ uid: data.uid });
                    }

                    setMansukeUser(data);
                    setLoadingMessage("ログイン成功");
                } else if (res.status === 401) {
                    setLoadingMessage("MyMANSUKEへリダイレクト中...");
                    const currentUrl = encodeURIComponent(window.location.href);
                    window.location.href = `https://my.mansuke.jp/sso?redirect=${currentUrl}`;
                }
            } catch {
                setLoadingMessage("エラーが発生しました");
            } finally {
                setTimeout(() => setIsRestoring(false), 500);
            }
        };

        checkMansukeAuth();
    }, []);

    // Effect: MANSUKE User Data Real-time Listener
    useEffect(() => {
        if (!user || !user.uid || (window.location.hostname === 'localhost')) {
            return;
        }

        const userRef = doc(usersDb, 'users', user.uid);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                setMansukeUser(prev => ({ ...prev, ...data }));
            }
        }, () => { });

        return () => unsubscribe();
    }, [user, user?.uid]);

    // セッション復帰ロジック (user が確定した後に実行)
    useEffect(() => {
        if (user) {
            // ローカルストレージから前回の部屋コード取得
            const savedRoomCode = localStorage.getItem('mansuke_last_room');

            // 未入室かつ保存コードありの場合、復帰可能性をチェック
            if (savedRoomCode && !roomCode) {
                (async () => {
                    try {
                        // プレイヤーデータが存在し、かつ追放(vanished)されていないか確認
                        const playerRef = doc(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms', savedRoomCode, 'players', user.uid);
                        const playerSnap = await getDoc(playerRef);

                        if (playerSnap.exists() && playerSnap.data().status !== 'vanished') {
                            setRestoreRoomId(savedRoomCode);
                            setShowRestoreModal(true); // 復帰確認モーダル表示
                        } else {
                            localStorage.removeItem('mansuke_last_room'); // 無効なデータは削除
                        }
                    } catch {
                        localStorage.removeItem('mansuke_last_room');
                    }
                })();
            }
        }
    }, [user, roomCode]);

    // Effect: 部屋コード永続化管理
    // 入室時に保存、退室時に削除
    useEffect(() => {
        if (roomCode) {
            localStorage.setItem('mansuke_last_room', roomCode);
        } else if (!isRestoring && !showRestoreModal) {
            // 意図的な退室（復元処理中でない）ならストレージクリア
            localStorage.removeItem('mansuke_last_room');
        }
    }, [roomCode, isRestoring, showRestoreModal]);

    // Effect: メンテナンスモード監視
    // Firestoreのsystem/settingsを監視
    useEffect(() => {
        if (!user) return;
        const unsub = onSnapshot(doc(db, 'system', 'settings'), (doc) => {
            if (doc.exists()) setMaintenanceMode(doc.data().maintenanceMode || false);
        }, () => { });
        return () => unsub();
    }, [user]);

    // Effect: メインゲームループ監視 (部屋・プレイヤー情報)
    // roomCodeがセットされた時点で起動し、リアルタイム更新と画面遷移を制御
    useEffect(() => {
        // 未認証または未入室ならリセットして終了
        if (!user || !roomCode) {
            setRoom(null);
            setPlayers([]);
            setMyPlayer(null);
            return;
        }

        const roomRef = doc(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms', roomCode);

        // 部屋情報監視リスナー
        const roomUnsub = onSnapshot(roomRef, (docSnap) => {
            if (docSnap.exists()) {
                const rData = { id: docSnap.id, ...docSnap.data() };
                setRoom(rData);

                // 解散検知: status='closed'なら強制ホーム遷移
                if (rData.status === 'closed') {
                    setRoomCode("");
                    setView('home');
                    setNotification({ message: "部屋が解散されました", type: "info" });
                    return;
                }

                // 自動画面遷移ロジック
                // 現在の画面(view)と部屋のステータス(rData.status)に応じて遷移先を決定
                if (view === 'home') {
                    // ホームからの遷移（復帰時など）
                    if (rData.status === 'waiting') setView('lobby');
                    else if (rData.status === 'playing') setView('game');
                    else if (rData.status === 'finished' || rData.status === 'aborted') setView('result');
                } else if (view === 'lobby' && rData.status === 'playing') {
                    // ロビー -> ゲーム開始
                    setView('game');
                } else if (view === 'game' && (rData.status === 'finished' || rData.status === 'aborted')) {
                    // ゲーム中 -> 終了/中断
                    setView('result');
                } else if (view === 'result' && rData.status === 'waiting') {
                    // 結果画面 -> 再戦（ロビーへ）
                    setView('lobby');
                }

            } else {
                // ドキュメント消失時の処理
                setRoomCode("");
                setView('home');
                setNotification({ message: "部屋が見つかりません（解散された可能性があります）", type: "info" });
            }
        }, () => {
            // エラー時は安全のためホームへ
            setRoomCode("");
            setView('home');
            setNotification({ message: "部屋への接続が切れました", type: "error" });
        });

        // プレイヤーリスト監視リスナー
        const q = query(collection(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms', roomCode, 'players'));
        const playersUnsub = onSnapshot(q, (snapshot) => {
            const pList = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            setPlayers(pList);

            const me = pList.find(p => p.id === user.uid);
            if (me) {
                setMyPlayer(me);
                // 追放検知
                if (me.status === 'vanished') {
                    setRoomCode("");
                    setView('home');
                    setNotification({ message: "部屋から退出しました", type: "info" });
                }
            } else if (pList.length > 0) {
                // リストはあるのに自分がいない場合（削除された）
                setRoomCode("");
                setView('home');
            }
        }, () => { });

        return () => { roomUnsub(); playersUnsub(); };
    }, [user, roomCode, view]);

    // Effect: 生存確認 (Heartbeat)
    // 定期的にlastSeenを更新し、オフライン判定を防ぐ
    useEffect(() => {
        if (!user || !roomCode) return;

        const interval = setInterval(() => {
            const fn = httpsCallable(functions, 'heartbeat');
            fn({ roomCode }).catch(() => { });
        }, HEARTBEAT_INTERVAL_MS);

        return () => clearInterval(interval);
    }, [user, roomCode]);

    // ハンドラ: 復帰モーダル「再参加」
    const handleConfirmRestore = () => {
        if (restoreRoomId) {
            setRoomCode(restoreRoomId); // roomCode更新によりメイン監視Effectが発火
            setRestoreRoomId(null);
            setShowRestoreModal(false);
            setNotification({ message: "セッションを復元しました", type: "success" });
        }
    };

    // ハンドラ: 復帰モーダル「キャンセル」
    const handleCancelRestore = () => {
        localStorage.removeItem('mansuke_last_room');
        setRestoreRoomId(null);
        setShowRestoreModal(false);
    };

    // ハンドラ: URLコピー
    const handleCopyUrl = () => {
        const url = window.location.href;
        navigator.clipboard.writeText(url).then(() => {
            setIsUrlCopied(true);
            setTimeout(() => setIsUrlCopied(false), 2000);
        });
    };

    // 表示分岐: アプリ内ブラウザ警告 (最優先)
    if (isInAppBrowser) {
        return (
            <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-gray-200 overflow-hidden font-sans">
                <div className="max-w-md w-full flex flex-col items-center gap-6 animate-fade-in-up">
                    <div className="p-6 bg-yellow-100 rounded-full border border-yellow-500/30 shadow-sm">
                        <ExternalLink size={64} className="text-yellow-600" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-black leading-tight text-gray-200">
                        MANSUKE WEREWOLFは<br />アプリ内ブラウザでは<br />ご利用いただけません
                    </h1>
                    <div className="bg-gray-800/80 border border-gray-700 p-6 rounded-2xl text-sm text-gray-300 leading-relaxed text-left shadow-sm">
                        Slackなどで直接リンクを開いた可能性があります。<br />
                        Safariなどのブラウザアプリから直接開いてください。
                    </div>

                    <div className="w-full space-y-3">
                        <p className="text-xs text-gray-300 font-bold uppercase tracking-widest">PAGE URL</p>
                        <button
                            onClick={handleCopyUrl}
                            className="w-full bg-gray-800/80 border border-gray-700 hover:bg-gray-950 hover:border-gray-600 text-gray-200 rounded-xl py-4 px-4 flex items-center justify-between transition group relative overflow-hidden shadow-sm"
                        >
                            <span className="font-mono text-sm truncate mr-4 text-gray-300 group-hover:text-gray-200 transition">
                                {window.location.href}
                            </span>
                            <div className={`flex items-center gap-2 text-xs font-bold px-3 py-1.5 rounded-lg transition-all ${isUrlCopied ? "bg-green-900/30 text-green-400" : "bg-gray-800 text-gray-300 group-hover:text-gray-300"}`}>
                                {isUrlCopied ? <Check size={14} /> : <Copy size={14} />}
                                {isUrlCopied ? "COPIED" : "COPY"}
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    // 表示分岐: 画面サイズ警告 (PC/タブレット推奨)
    if (isMobileView) {
        return (
            <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-gray-200 overflow-hidden">
                <div className="max-w-md w-full flex flex-col items-center gap-6 animate-fade-in-up">
                    <div className="p-6 bg-red-900/20 rounded-full border border-red-100">
                        <MonitorX size={64} className="text-red-500" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-black leading-tight text-gray-200">
                        MANSUKE WEREWOLFは<br />スマートフォンまたは縦画面には<br />対応していません
                    </h1>
                    <div className="bg-gray-800/80 border border-gray-700 p-6 rounded-2xl text-sm text-gray-300 leading-relaxed text-left shadow-sm">
                        レスポンシブデザインに対応しようと頑張ったのですが、必要な情報量やゲーム体験を考慮した結果、タブレットやPCなどの大画面でのみ対応することとなりました。今後の対応予定はありません。<br /><br />
                        ご迷惑をおかけしますが、タブレットやPCから <span className="text-red-400 font-mono font-bold select-all">https://mansuke.cerinal.com/werewolf</span> にアクセスするか、以下のQRコードを読み取ってください。
                    </div>
                    <div className="bg-gray-800/80 p-4 rounded-xl shadow-sm border border-gray-700">
                        <img
                            src="https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=https://mansuke.cerinal.com/werewolf"
                            alt="QR Code"
                            className="w-32 h-32"
                        />
                    </div>
                </div>
            </div>
        );
    }

    if (isRestoring) {
        return <LoadingScreen message={loadingMessage} />;
    }

    // 表示分岐: メインアプリケーション
    return (
        <>
            {/* グローバル通知 */}
            {notification && <Notification {...notification} onClose={() => setNotification(null)} />}

            {/* 復帰確認モーダル */}
            {showRestoreModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[999] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-gray-800/80 border border-gray-700 rounded-3xl p-6 md:p-8 w-full max-w-md shadow-xl relative text-center">
                        <div className="mx-auto w-16 h-16 bg-red-950/30 rounded-full flex items-center justify-center mb-6 animate-pulse">
                            <LogIn size={32} className="text-red-400" />
                        </div>

                        <h2 className="text-xl md:text-2xl font-black text-gray-200 mb-2 tracking-wide">WELCOME BACK</h2>
                        <p className="text-gray-300 text-xs md:text-sm mb-8 leading-relaxed">
                            中断されたゲームセッションが見つかりました。<br />
                            部屋 <span className="font-mono text-red-400 font-bold text-lg mx-1">{restoreRoomId}</span> に再接続しますか？
                        </p>

                        <div className="flex flex-col gap-3">
                            <button
                                onClick={handleConfirmRestore}
                                className="w-full py-4 bg-red-600 hover:bg-red-700 text-white font-bold rounded-xl shadow-sm transition transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <LogIn size={20} /> 再参加する
                            </button>
                            <button
                                onClick={handleCancelRestore}
                                className="w-full py-4 bg-gray-800/80 hover:bg-gray-950 text-gray-300 font-bold rounded-xl border border-gray-700 transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                <XCircle size={20} /> 拒否してホームへ
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* MANSUKE Account Widget */}
            {view === 'home' && <AccountDisplay user={mansukeUser} appName="WEREWOLF" />}

            {/* 画面ルーティング */}
            {view === 'home' && <HomeScreen user={user} mansukeUser={mansukeUser} setRoomCode={setRoomCode} setView={setView} setNotification={setNotification} setMyPlayer={setMyPlayer} maintenanceMode={maintenanceMode} />}
            {view === 'logs' && <LogViewerScreen setView={setView} />}
            {view === 'lobby' && <LobbyScreen user={user} room={room} roomCode={roomCode} players={players} setNotification={setNotification} setView={setView} setRoomCode={setRoomCode} />}
            {view === 'game' && <GameScreen user={user} mansukeUser={mansukeUser} room={room} roomCode={roomCode} players={players} myPlayer={myPlayer} setView={setView} setRoomCode={setRoomCode} maintenanceMode={maintenanceMode} setNotification={setNotification} />}
            {view === 'result' && <ResultScreen user={user} room={room} roomCode={roomCode} players={players} myPlayer={myPlayer} setView={setView} setRoomCode={setRoomCode} maintenanceMode={maintenanceMode} setNotification={setNotification} />}
        </>
    );
}