import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Users, Crown, Settings, Mic, Play, Loader, Info, AlertTriangle, LogOut, Trash2, Shield, Moon, Sun, Ghost, Swords, Eye, Skull, Search, User, Crosshair, Smile, Check, Maximize2, Clock, X, BadgeCheck, Globe, MessageSquare, Send, Calendar } from 'lucide-react';
import { collection, query, where, orderBy, onSnapshot, limit } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase';
import { isPlayerOnline } from '../utils/helpers';
import { ROLE_DEFINITIONS, ROLE_GROUPS } from '../constants/gameData'; // ROLE_GROUPSをインポート
import { ConfirmationModal } from '../components/ui/ConfirmationModal';
import { InfoModal } from '../components/ui/InfoModal';
import LoadingScreen from '../components/ui/LoadingScreen';

// 設定パネル用タブ定義
const TABS = [
    { id: 'chat', label: 'ロビーチャット', icon: MessageSquare, color: 'text-green-400', border: 'border-green-500/50', bg: 'bg-green-900/20' },
    { id: 'roles', label: '役職指定', icon: Shield, color: 'text-red-400', border: 'border-red-500/50', bg: 'bg-red-900/20' },
    { id: 'rules', label: 'ルール設定', icon: Settings, color: 'text-gray-300', border: 'border-gray-500/50', bg: 'bg-gray-950/40' },
];

// コンポーネント: 待機ロビー画面
export const LobbyScreen = ({ user, room, roomCode, players, setNotification, setView, setRoomCode }) => {
    // 1. フックの宣言を最上部に移動

    // ブラウザ互換性チェックステート
    const [isBrowserSupported, setIsBrowserSupported] = useState(true);

    // ローカル設定ステート
    const [roleSettings, setRoleSettings] = useState(room?.roleSettings || {});
    const [anonymousVoting, setAnonymousVoting] = useState(room?.anonymousVoting !== undefined ? room.anonymousVoting : true);
    const [inPersonMode, setInPersonMode] = useState(room?.inPersonMode !== undefined ? room.inPersonMode : false);
    const [discussionTime, setDiscussionTime] = useState(room?.discussionTime !== undefined ? room.discussionTime : 240);
    const [loading, setLoading] = useState(false);
    const [activeTab, setActiveTab] = useState('chat');

    // チャット用State
    const [messages, setMessages] = useState([]);
    const [newMessage, setNewMessage] = useState('');
    const messagesEndRef = useRef(null);

    // モーダル制御
    const [modalConfig, setModalConfig] = useState(null);
    const [showCodeModal, setShowCodeModal] = useState(false);
    const [showDevActionModal, setShowDevActionModal] = useState(false);

    // Memo: 開発者バッジ表示用フラグ
    const hasDevPlayer = useMemo(() => players.some(p => p.isDev), [players]);

    // Memo: プレイヤー人数計算（観戦者除外）
    const validPlayers = useMemo(() => players.filter(p => !p.isSpectator), [players]);
    const validPlayerCount = validPlayers.length;

    // 配役合計数計算
    // 画面に表示されていなくても、設定値として残っている場合はカウントに含める（矛盾を防ぐため）
    const totalAssigned = Object.values(roleSettings).reduce((a, b) => a + b, 0);

    // Memo: ゲーム開始条件バリデーション
    const validationError = useMemo(() => {
        if (validPlayerCount < 4) return "開始には最低4人のプレイヤーが必要です";
        if (totalAssigned !== validPlayerCount) return "配役の合計が人数と一致していません";

        let wolfCount = 0;
        let humanCount = 0;
        Object.entries(roleSettings).forEach(([r, c]) => {
            if (['werewolf', 'greatwolf', 'wise_wolf'].includes(r)) wolfCount += c;
            else humanCount += c;
        });

        if (wolfCount === 0) return "人狼がいません";
        if (wolfCount >= humanCount) return "人狼が過半数を占めているため、開始できません";

        return null;
    }, [validPlayerCount, totalAssigned, roleSettings]);

    // Effect
    useEffect(() => {
        const checkBrowser = () => {
            const ua = window.navigator.userAgent.toLowerCase();
            let supported = false;

            if (ua.includes('opr') || ua.includes('opera')) {
                supported = false;
            } else if (ua.includes('firefox')) {
                supported = true;
            } else if (ua.includes('edg')) {
                supported = true;
            } else if (ua.includes('chrome')) {
                supported = true;
            } else if (ua.includes('safari')) {
                supported = true;
            }

            setIsBrowserSupported(supported);
        };
        checkBrowser();
    }, []);

    // Effect: サーバーからの設定更新を同期
    useEffect(() => {
        if (room) {
            setRoleSettings(room.roleSettings || {});
            setAnonymousVoting(room.anonymousVoting !== undefined ? room.anonymousVoting : true);
            setInPersonMode(room.inPersonMode !== undefined ? room.inPersonMode : false);
            setDiscussionTime(room.discussionTime !== undefined ? room.discussionTime : 240);
        }
    }, [room]);

    // Effect: ロビーチャットの購読
    useEffect(() => {
        if (!roomCode) return;

        const q = query(
            collection(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms', roomCode, 'messages'),
            where('channel', '==', 'lobby'),
            orderBy('createdAt', 'asc'),
            limit(100)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setMessages(msgs);
        }, () => {
            // silent
        });

        return () => unsubscribe();
    }, [roomCode]);

    // Effect: メッセージ受信時にスクロール
    useEffect(() => {
        if (activeTab === 'chat') {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, activeTab]);

    // --------------------------------------------------------------------------------
    // 2. 変数定義
    // --------------------------------------------------------------------------------

    const myPlayer = players.find(p => p.id === user?.uid);
    const isDev = myPlayer?.isDev === true;
    const isHostUser = room?.hostId === user?.uid;
    const hasControl = isHostUser || isDev;

    // 関数群定義
    const handleStartGame = async () => {
        if (validationError) return setNotification({ message: validationError, type: "error" });
        setLoading(true);
        try {
            // 設定をCloud Function経由で保存（直接updateDocするとPermissions Errorになるため）
            const updateFn = httpsCallable(functions, 'updateRoomSettings');
            await updateFn({ roomCode, updateData: { roleSettings, anonymousVoting, inPersonMode, discussionTime } });
            const fn = httpsCallable(functions, 'startGame');
            await fn({ roomCode });
        } catch (e) { setNotification({ message: e.message || "開始エラー", type: "error" }); }
        finally { setLoading(false); }
    };

    const confirmForceClose = () => {
        setModalConfig({
            title: "部屋の解散",
            message: "本当にこの部屋を解散しますか？\n参加中のプレイヤーは全員ホームに戻されます。",
            isDanger: true,
            onConfirm: async () => {
                setModalConfig(null);
                try {
                    const fn = httpsCallable(functions, 'deleteRoom');
                    await fn({ roomCode });
                } catch {
                    // deleteRoom失敗時はエラーメッセージのみ
                    setNotification({ message: "部屋の解散に失敗しました。再試行してください。", type: "error" });
                }
            },
            onCancel: () => setModalConfig(null)
        });
    };

    const confirmLeaveRoom = () => {
        setModalConfig({
            title: "部屋からの退出",
            message: "本当に退出しますか？",
            isDanger: false,
            onConfirm: async () => {
                setModalConfig(null);
                try {
                    const fn = httpsCallable(functions, 'leaveRoom');
                    await fn({ roomCode });
                    setView('home');
                    setRoomCode("");
                    setNotification({ message: "退出しました", type: "success" });
                } catch (e) {
                    setNotification({ message: "退出エラー: " + e.message, type: "error" });
                }
            },
            onCancel: () => setModalConfig(null)
        });
    };

    const confirmKickPlayer = (playerId, playerName, isTargetDev) => {
        if (isHostUser && isTargetDev) {
            setNotification({ message: "開発者を追放することはできません", type: "error" });
            return;
        }

        setModalConfig({
            title: "プレイヤーの追放",
            message: `${playerName} さんを部屋から追放しますか？`,
            isDanger: true,
            confirmText: "追放する",
            onConfirm: async () => {
                setModalConfig(null);
                try {
                    const fn = httpsCallable(functions, 'kickPlayer');
                    await fn({ roomCode, playerId });
                    setNotification({ message: `${playerName} さんを退出させました`, type: "success" });
                } catch (e) {
                    setNotification({ message: "操作エラー: " + e.message, type: "error" });
                }
            },
            onCancel: () => setModalConfig(null)
        });
    };

    const handleUpdateSettings = (key, val) => {
        const newSettings = { ...roleSettings, [key]: val };
        setRoleSettings(newSettings);
        if (hasControl) {
            const fn = httpsCallable(functions, 'updateRoomSettings');
            fn({ roomCode, updateData: { roleSettings: newSettings } });
        }
    };

    const handleUpdateAnonymous = (val) => {
        setAnonymousVoting(val);
        if (hasControl) {
            const fn = httpsCallable(functions, 'updateRoomSettings');
            fn({ roomCode, updateData: { anonymousVoting: val } });
        }
    };

    const handleUpdateInPersonMode = (val) => {
        setInPersonMode(val);
        if (hasControl) {
            const fn = httpsCallable(functions, 'updateRoomSettings');
            fn({ roomCode, updateData: { inPersonMode: val } });
        }
    };

    const handleUpdateDiscussionTime = (val) => {
        setDiscussionTime(val);
        if (hasControl) {
            const fn = httpsCallable(functions, 'updateRoomSettings');
            fn({ roomCode, updateData: { discussionTime: val } });
        }
    };

    // チャット送信処理
    const handleSendMessage = async (e) => {
        e.preventDefault();
        if (!newMessage.trim() || !user) return;

        try {
            const fn = httpsCallable(functions, 'sendChatMessage');
            await fn({
                roomCode,
                collectionName: 'messages',
                messageData: {
                    text: newMessage,
                    senderName: myPlayer?.name || '名無し',
                    channel: 'lobby'
                }
            });
            setNewMessage('');
        } catch {
            setNotification({ message: "メッセージの送信に失敗しました", type: "error" });
        }
    };

    // --------------------------------------------------------------------------------
    // 3. 早期リターン (フック宣言後に行うこと！)
    // --------------------------------------------------------------------------------

    // 非推奨ブラウザ時の警告表示
    if (!isBrowserSupported) {
        return (
            <div className="fixed inset-0 z-[9999] bg-gray-950 flex flex-col items-center justify-center p-6 text-center text-gray-200 overflow-hidden font-sans">
                <div className="max-w-md w-full flex flex-col items-center gap-6 animate-fade-in-up">
                    <div className="p-6 bg-red-900/20 rounded-full border border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                        <Globe size={64} className="text-red-500" />
                    </div>
                    <h1 className="text-xl md:text-2xl font-black leading-tight">
                        お使いのブラウザは<br />推奨されていません
                    </h1>
                    <div className="bg-gray-800/80 border border-gray-700 p-6 rounded-2xl text-sm text-gray-300 leading-relaxed text-left shadow-xl w-full">
                        <p className="mb-4">
                            MANSUKE WEREWOLFを快適にプレイいただくため、以下のブラウザでのアクセスをお願いしています。
                        </p>
                        <ul className="space-y-2 font-bold text-gray-200">
                            <li className="flex items-center gap-2"><Check size={16} className="text-green-400" /> Google Chrome</li>
                            <li className="flex items-center gap-2"><Check size={16} className="text-green-400" /> Safari</li>
                            <li className="flex items-center gap-2"><Check size={16} className="text-green-400" /> Microsoft Edge</li>
                            <li className="flex items-center gap-2"><Check size={16} className="text-green-400" /> Mozilla Firefox</li>
                        </ul>
                        <p className="mt-4 text-xs text-gray-300">
                            ※これら以外のブラウザでは、正常に動作しない可能性があります。
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // データロード待機
    if (!room) return <LoadingScreen message="部屋情報を同期しています..." />;

    // ローディング画面
    if (loading) return <LoadingScreen message="ゲームを開始しています..." />;

    // --------------------------------------------------------------------------------
    // 4. メインレンダリング
    // --------------------------------------------------------------------------------
    return (
        // レイアウト: 2カラム (左:情報 / 右:設定)
        // SP対応: 横スクロール抑制 overflow-x-hidden
        <div className="h-screen w-full bg-gray-950 text-gray-200 font-sans relative overflow-hidden flex flex-col">
            {modalConfig && <ConfirmationModal {...modalConfig} />}

            {/* モーダル: 開発者用アクションメニュー */}
            {showDevActionModal && (
                <InfoModal title="開発者メニュー" onClose={() => setShowDevActionModal(false)}>
                    <div className="flex flex-col gap-3 p-2">
                        <p className="text-sm text-gray-300 mb-2">この部屋に対する操作を選択してください。</p>
                        <button
                            onClick={() => { setShowDevActionModal(false); confirmForceClose(); }}
                            className="w-full py-4 bg-red-900/50 border border-red-500 text-red-200 rounded-xl font-bold hover:bg-red-800 transition flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} /> 部屋を解散する (全員強制退出)
                        </button>
                        <button
                            onClick={() => { setShowDevActionModal(false); confirmLeaveRoom(); }}
                            className="w-full py-4 bg-gray-950 border border-gray-600 text-gray-300 rounded-xl font-bold hover:bg-gray-800 transition flex items-center justify-center gap-2"
                        >
                            <LogOut size={18} /> 部屋から退出する (自分のみ)
                        </button>
                    </div>
                </InfoModal>
            )}

            {/* モーダル: 部屋コード拡大表示 */}
            {showCodeModal && (
                <div className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in" onClick={() => setShowCodeModal(false)}>
                    <button className="absolute top-6 right-6 text-gray-300 hover:text-gray-200 transition"><X size={32} /></button>
                    <p className="text-gray-300 text-lg font-bold tracking-widest mb-4 uppercase">Room Code</p>
                    <div className="text-[20vw] font-black text-gray-200 leading-none tracking-tighter font-mono select-none pointer-events-none drop-shadow-[0_0_50px_rgba(59,130,246,0.5)]">
                        {roomCode}
                    </div>
                    <p className="text-gray-300 mt-8 text-sm">クリックして閉じる</p>
                </div>
            )}

            {/* 背景装飾 */}
            <div className="fixed inset-0 z-0 pointer-events-none">
                <div className="absolute -top-20 -right-20 w-[600px] h-[600px] bg-red-900/20 rounded-full blur-[100px]"></div>
                <div className="absolute -bottom-20 -left-20 w-[600px] h-[600px] bg-purple-900/10 rounded-full blur-[100px]"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-5"></div>
            </div>

            {/* メインエリア */}
            <div className="flex-1 w-full max-w-7xl mx-auto p-4 md:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 relative z-10 min-h-0 overflow-hidden">

                {/* 左カラム: 部屋情報 / プレイヤーリスト */}
                <div className="lg:col-span-4 flex flex-col gap-4 lg:h-full min-h-0 overflow-y-auto lg:overflow-y-auto custom-scrollbar">
                    {/* 上部カード: コード表示 & 退室ボタン */}
                    <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl p-6 shadow-xl border border-gray-700/50 shrink-0">
                        <div className="flex justify-between items-start mb-2">
                            <div>
                                <p className="text-gray-300 text-[10px] font-bold tracking-[0.2em] uppercase mb-1">Room Code</p>
                                <div className="flex items-center gap-3 group cursor-pointer" onClick={() => setShowCodeModal(true)}>
                                    <span className="text-5xl font-black text-gray-200 tracking-widest font-mono group-hover:text-red-400 transition">{roomCode}</span>
                                    <div className="bg-gray-950 p-2 rounded-lg group-hover:bg-red-900/20 transition"><Maximize2 size={16} className="text-gray-300 group-hover:text-red-400" /></div>
                                </div>
                            </div>
                            {hasControl ? (
                                (isDev && !isHostUser) ? (
                                    <button onClick={() => setShowDevActionModal(true)} className="p-2 text-red-300 hover:bg-red-900/20 rounded-lg transition" title="操作を選択"><Settings size={18} /></button>
                                ) : (
                                    <button onClick={confirmForceClose} className="p-2 text-red-400 hover:bg-red-900/20 rounded-lg transition" title="部屋を解散"><LogOut size={18} /></button>
                                )
                            ) : (
                                <button onClick={confirmLeaveRoom} className="p-2 text-gray-300 hover:bg-gray-950 rounded-lg transition" title="退出"><LogOut size={18} /></button>
                            )}
                        </div>

                        {/* ステータスカウンター: 人数 / 配役数 */}
                        <div className="mt-4 grid grid-cols-2 gap-3">
                            {/* 参加人数 */}
                            <div className="bg-gray-950/40 border border-gray-700/50 rounded-2xl p-3 flex flex-col items-center relative overflow-hidden group">
                                <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition"><Users size={40} /></div>
                                <span className="text-xs text-gray-300 font-bold mb-1 flex items-center gap-1"><Users size={12} /> 参加者</span>
                                <span className="text-3xl font-black text-gray-200 font-mono">{validPlayerCount}<span className="text-xs ml-1 text-gray-300 font-sans font-bold">名</span></span>
                            </div>

                            {/* 配役数 (一致判定で色変化) */}
                            <div className={`border rounded-2xl p-3 flex flex-col items-center relative overflow-hidden group transition-all ${totalAssigned === validPlayerCount
                                ? "bg-green-900/20 border-green-500/30 shadow-[0_0_15px_rgba(34,197,94,0.1)]"
                                : "bg-red-900/20 border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                                }`}>
                                <div className={`absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition ${totalAssigned === validPlayerCount ? "text-green-400" : "text-red-400"
                                    }`}><Settings size={40} /></div>
                                <span className={`text-xs font-bold mb-1 flex items-center gap-1 ${totalAssigned === validPlayerCount ? "text-green-400" : "text-red-400"
                                    }`}>
                                    {totalAssigned === validPlayerCount ? <Check size={12} /> : <AlertTriangle size={12} />} 配役
                                </span>
                                <span className={`text-3xl font-black font-mono ${totalAssigned === validPlayerCount ? "text-green-400" : "text-red-400"
                                    }`}>{totalAssigned}<span className={`text-xs ml-1 font-sans font-bold ${totalAssigned === validPlayerCount ? "text-green-600" : "text-red-600"
                                        }`}>名</span></span>
                            </div>
                        </div>
                    </div>

                    {/* Info: 開発者参加通知 */}
                    {hasDevPlayer && (
                        <div className="bg-red-900/30 border border-red-500/30 rounded-2xl p-4 flex flex-col gap-2 shrink-0 animate-fade-in shadow-lg">
                            <div className="flex items-center gap-2">
                                <div className="bg-red-900/20 p-2 rounded-full">
                                    <BadgeCheck size={20} className="text-red-300" />
                                </div>
                                <h3 className="font-bold text-red-100 text-sm md:text-base">MANSUKEの職員がこの部屋に参加しています！</h3>
                            </div>
                            <div className="pl-11">
                                <p className="text-xs text-red-200 leading-relaxed mb-2">
                                    「MANSUKE」バッジがついているプレイヤーは、MANSUKEの職員です。
                                </p>
                                <ul className="list-disc list-outside text-[10px] md:text-xs text-red-300/80 space-y-1 ml-4">
                                    <li>職員も参加者の1人として、通常通りプレイします。</li>
                                    <li>頑張って開発したので、拍手してくれると嬉しいです！</li>
                                    <li>ホストは、職員を追放することはできません。</li>
                                </ul>
                            </div>
                        </div>
                    )}

                    {/* プレイヤーリスト表示 */}
                    <div className="bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 flex flex-col lg:flex-1 min-h-[300px] lg:min-h-0 overflow-hidden shadow-xl">
                        <div className="p-4 border-b border-gray-700 flex justify-between items-center bg-gray-950/30">
                            <h3 className="font-bold text-gray-300 flex items-center gap-2"><Users size={18} className="text-red-400" /> 参加者リスト</h3>
                            <span className="text-xs bg-gray-950 px-2 py-1 rounded text-gray-300">{players.length}人</span>
                        </div>
                        <div className="flex-1 overflow-y-auto p-2 space-y-1 custom-scrollbar">
                            {players.map(p => (
                                <div key={p.id} className="flex items-center justify-between bg-gray-950/30 hover:bg-gray-800/30 p-3 rounded-xl border border-transparent hover:border-gray-700 transition group">
                                    <div className="flex items-center gap-3 overflow-hidden">
                                        {/* オンライン状態インジケータ */}
                                        <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${isPlayerOnline(p) ? "bg-green-500 shadow-[0_0_8px_#22c55e]" : "bg-gray-600"}`}></div>
                                        <div className="flex flex-col min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className={`font-bold text-sm truncate ${isPlayerOnline(p) ? "text-gray-300" : "text-gray-300"}`}>{p.name}</span>
                                                {p.isDev && <span className="text-[10px] bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded border border-red-500/30 flex items-center gap-0.5 shrink-0"><BadgeCheck size={10} /> MANSUKE</span>}
                                            </div>
                                            {p.isSpectator && <span className="text-[9px] text-purple-400">観戦者</span>}
                                        </div>
                                    </div>
                                    {/* アクション: ホストアイコン / 追放ボタン */}
                                    <div className="flex items-center gap-1">
                                        {room.hostId === p.id && <Crown size={14} className="text-yellow-500" />}
                                        {hasControl && p.id !== user.uid && (
                                            <button onClick={() => confirmKickPlayer(p.id, p.name, p.isDev)} className="p-1.5 text-gray-300 hover:text-red-400 hover:bg-red-900/20 rounded transition" title="追放">
                                                <Trash2 size={14} />
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* 右カラム: ゲーム設定パネル */}
                <div className="lg:col-span-8 flex flex-col h-[600px] lg:h-full min-h-0 bg-gray-800/80 backdrop-blur-xl rounded-3xl border border-gray-700/50 shadow-2xl overflow-hidden relative">

                    {/* 設定タブナビゲーション */}
                    <div className="flex items-center p-2 gap-2 overflow-x-auto custom-scrollbar border-b border-gray-700 bg-gray-950/50 shrink-0">
                        {TABS.map(tab => {
                            const isActive = activeTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex-1 min-w-[100px] flex items-center justify-center gap-2 py-3 px-4 rounded-xl text-xs md:text-sm font-bold transition-all relative overflow-hidden whitespace-nowrap ${isActive
                                        ? `${tab.bg} ${tab.color} border ${tab.border} shadow-lg`
                                        : "text-gray-300 hover:text-gray-300 hover:bg-gray-800/5"
                                        }`}
                                >
                                    <tab.icon size={16} />
                                    {tab.label}
                                    {tab.id === 'roles' && (
                                        <span className="ml-1 text-[10px] opacity-60 bg-black/30 px-1.5 rounded-full">
                                            {Object.values(roleSettings).reduce((a, b) => a + b, 0)}
                                        </span>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* 設定コンテンツエリア */}
                    <div className="flex-1 overflow-y-auto p-4 md:p-6 custom-scrollbar relative">

                        {/* ロビーチャットタブ */}
                        {activeTab === 'chat' && (
                            <div className="flex flex-col h-full animate-fade-in">
                                {/* チャットログエリア */}
                                <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-2 custom-scrollbar min-h-0">
                                    {messages.length === 0 ? (
                                        <div className="flex flex-col items-center justify-center h-full text-gray-300">
                                            <MessageSquare size={48} className="mb-4 opacity-20" />
                                            <p className="text-sm">まだメッセージはありません</p>
                                            <p className="text-xs mt-1">挨拶してみましょう！</p>
                                        </div>
                                    ) : (
                                        messages.map(msg => {
                                            const isMe = msg.senderId === user.uid;
                                            return (
                                                <div key={msg.id} className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}>
                                                    <div className={`flex items-baseline gap-2 mb-1 ${isMe ? "flex-row-reverse" : ""}`}>
                                                        <span className="text-xs font-bold text-gray-300">{msg.senderName}</span>
                                                        <span className="text-[10px] text-gray-300">
                                                            {msg.createdAt?.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                        </span>
                                                    </div>
                                                    <div className={`px-4 py-2 rounded-2xl text-sm max-w-[85%] break-words ${isMe
                                                        ? "bg-green-600 text-gray-200 rounded-tr-none"
                                                        : "bg-gray-950 text-gray-300 rounded-tl-none border border-gray-700"
                                                        }`}>
                                                        {msg.text}
                                                    </div>
                                                </div>
                                            );
                                        })
                                    )}
                                    <div ref={messagesEndRef} />
                                </div>

                                {/* 入力フォーム */}
                                <form onSubmit={handleSendMessage} className="flex items-center gap-2 shrink-0 pt-2 border-t border-gray-700">
                                    <input
                                        type="text"
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        placeholder="メッセージを入力..."
                                        className="flex-1 bg-gray-950/50 border border-gray-700 text-gray-200 px-4 py-3 rounded-xl focus:outline-none focus:border-green-500/50 focus:bg-gray-950 transition placeholder-gray-500"
                                    />
                                    <button
                                        type="submit"
                                        disabled={!newMessage.trim()}
                                        className="flex items-center justify-center bg-green-600 hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed text-gray-200 p-3 rounded-xl transition-colors shadow-lg shadow-green-900/20"
                                    >
                                        <Send size={20} />
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* 役職指定 (市民・人狼・第三陣営) */}
                        {activeTab === 'roles' && (
                            <div className="space-y-6 animate-fade-in pb-10">
                                {[
                                    { id: 'citizen', name: '市民陣営', color: 'text-blue-700', accentBg: 'bg-blue-100', accentBorder: 'border-blue-300', iconBg: 'bg-blue-50', iconColor: 'text-blue-600', barColor: 'bg-blue-500', countActiveBg: 'bg-blue-50 text-blue-700 border-blue-200' },
                                    { id: 'werewolf', name: '人狼陣営', color: 'text-red-700', accentBg: 'bg-red-100', accentBorder: 'border-red-300', iconBg: 'bg-red-50', iconColor: 'text-red-600', barColor: 'bg-red-500', countActiveBg: 'bg-red-50 text-red-700 border-red-200' },
                                    { id: 'third', name: '第三陣営', color: 'text-amber-700', accentBg: 'bg-amber-100', accentBorder: 'border-amber-300', iconBg: 'bg-amber-50', iconColor: 'text-amber-600', barColor: 'bg-amber-500', countActiveBg: 'bg-amber-50 text-amber-700 border-amber-200' }
                                ].map(group => (
                                    <div key={group.id} className="space-y-3">
                                        {/* 陣営ヘッダー */}
                                        <div className={`flex items-center gap-3 px-4 py-2.5 rounded-xl ${group.accentBg} border ${group.accentBorder}`}>
                                            <div className={`w-1 h-6 rounded-full ${group.barColor}`}></div>
                                            <h3 className={`font-black text-sm tracking-wider ${group.color}`}>{group.name}</h3>
                                            <span className={`text-xs font-bold ml-auto px-2.5 py-0.5 rounded-full border ${group.countActiveBg}`}>
                                                {ROLE_GROUPS[group.id].reduce((acc, key) => acc + (roleSettings[key] || 0), 0)} 名
                                            </span>
                                        </div>

                                        {/* 役職カードグリッド */}
                                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2.5">
                                            {ROLE_GROUPS[group.id].map(key => {
                                                const def = ROLE_DEFINITIONS[key];
                                                if (!def) return null;
                                                const count = roleSettings[key] || 0;

                                                if (def.isVisible === false) return null;

                                                return (
                                                    <div key={key} className={`relative flex flex-col h-full p-3 rounded-xl border transition-all ${count > 0 ? "bg-white border-gray-300 shadow-md" : "bg-gray-50 border-gray-200 opacity-60 hover:opacity-100"}`}>
                                                        {def.badge && (
                                                            <div className={`absolute -top-2 -right-2 px-2 py-0.5 rounded-full text-[10px] font-bold shadow-sm z-10 flex items-center gap-1 ${def.badge.color || "bg-yellow-400 text-yellow-900"}`}>
                                                                <Calendar size={10} />
                                                                {def.badge.label}
                                                            </div>
                                                        )}

                                                        <div className={`mb-2 p-2 rounded-lg w-fit shrink-0 ${count > 0 ? `${group.iconBg} ${group.iconColor}` : "bg-gray-100 text-gray-400"}`}>
                                                            {React.createElement(def.icon, { size: 20 })}
                                                        </div>
                                                        <span className={`text-sm font-bold truncate shrink-0 ${count > 0 ? 'text-gray-800' : 'text-gray-500'}`}>{def.name}</span>

                                                        <p className="text-[10px] text-gray-500 leading-tight mt-1 mb-3 flex-grow whitespace-pre-wrap break-words">
                                                            {def.desc}
                                                        </p>

                                                        <div className={`mt-auto flex items-center justify-between rounded-lg p-1 shrink-0 ${count > 0 ? 'bg-gray-100' : 'bg-gray-100/50'}`}>
                                                            {hasControl && <button onClick={() => handleUpdateSettings(key, Math.max(0, count - 1))} className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition border border-gray-200 font-bold">-</button>}
                                                            <div className={`w-8 text-center font-black ${count > 0 ? 'text-gray-800' : 'text-gray-400'}`}>{count}</div>
                                                            {hasControl && <button onClick={() => handleUpdateSettings(key, count + 1)} className="w-7 h-7 flex items-center justify-center rounded bg-white hover:bg-gray-200 text-gray-600 hover:text-gray-800 transition border border-gray-200 font-bold">+</button>}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* ルール設定タブ */}
                        {activeTab === 'rules' && (
                            <div className="space-y-4 animate-fade-in max-w-2xl mx-auto">

                                {/* 議論時間設定 */}
                                <div className="bg-gray-950/40 p-5 rounded-2xl border border-gray-700 hover:border-gray-600 transition flex items-center justify-between">
                                    <div>
                                        <h4 className="font-bold text-gray-200 flex items-center gap-2 text-sm md:text-base"><Clock size={18} className="text-yellow-400" /> 議論時間（昼）</h4>
                                        <p className="text-xs text-gray-300 mt-1">昼フェーズの議論時間を設定します</p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {hasControl && (
                                            <>
                                                <button onClick={() => handleUpdateDiscussionTime(Math.max(60, discussionTime - 10))} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition">-</button>
                                                <div className="flex-1 text-center font-bold text-gray-200">{discussionTime}秒</div>
                                                <button onClick={() => handleUpdateDiscussionTime(discussionTime + 10)} className="w-8 h-8 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 flex items-center justify-center transition">+</button>
                                            </>
                                        )}
                                    </div>
                                </div>

                                {/* 匿名投票モード切替 */}
                                <div className="bg-gray-950/40 p-5 rounded-2xl border border-gray-700 hover:border-gray-600 transition flex items-center justify-between">
                                    <div className="pr-4">
                                        <h4 className="font-bold text-gray-200 flex items-center gap-2 text-sm md:text-base"><Settings size={18} /> 匿名投票モード</h4>
                                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">昼の投票において、誰が誰に投票したかを伏せて開票します。</p>
                                    </div>
                                    {hasControl ? (
                                        <button onClick={() => handleUpdateAnonymous(!anonymousVoting)} className={`w-14 h-7 rounded-full transition-colors relative shrink-0 border ${anonymousVoting ? "bg-green-600 border-green-500" : "bg-gray-700 border-gray-600"}`}>
                                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${anonymousVoting ? "left-8" : "left-1"}`}></div>
                                        </button>
                                    ) : (
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${anonymousVoting ? "bg-green-900/20 text-green-400" : "bg-gray-800 text-gray-300"}`}>{anonymousVoting ? "ON" : "OFF"}</span>
                                    )}
                                </div>

                                {/* 対面モード切替 */}
                                <div className="bg-gray-950/40 p-5 rounded-2xl border border-gray-700 hover:border-gray-600 transition flex items-center justify-between">
                                    <div className="pr-4">
                                        <h4 className="font-bold text-gray-200 flex items-center gap-2 text-sm md:text-base"><Mic size={18} /> 対面モード</h4>
                                        <p className="text-xs text-gray-300 mt-1 leading-relaxed">
                                            生存者チャットを無効化し、対面での議論を促します。<br />
                                            役職チャット・霊界チャットはそのまま利用できます。
                                        </p>
                                    </div>
                                    {hasControl ? (
                                        <button onClick={() => handleUpdateInPersonMode(!inPersonMode)} className={`w-14 h-7 rounded-full transition-colors relative shrink-0 border ${inPersonMode ? "bg-green-600 border-green-500" : "bg-gray-700 border-gray-600"}`}>
                                            <div className={`absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all ${inPersonMode ? "left-8" : "left-1"}`}></div>
                                        </button>
                                    ) : (
                                        <span className={`text-xs font-bold px-3 py-1 rounded-full shrink-0 ${inPersonMode ? "bg-green-900/20 text-green-400" : "bg-gray-800 text-gray-300"}`}>{inPersonMode ? "ON" : "OFF"}</span>
                                    )}
                                </div>

                                <div className="p-4 bg-red-900/20 border border-red-500/20 rounded-xl text-xs text-red-300 leading-relaxed">
                                    <Info size={16} className="inline mr-1 mb-0.5" />
                                    役職の人数設定は、各陣営タブから行ってください。<br />
                                    参加人数と役職の合計数が一致しないとゲームを開始できません。
                                </div>
                            </div>
                        )}
                    </div>

                    {/* フッターアクション (ゲーム開始ボタン等) */}
                    <div className="p-4 border-t border-gray-700 bg-gray-800/50 backdrop-blur shrink-0">
                        {hasControl ? (
                            <div className="flex flex-col gap-2">
                                {validationError && (
                                    <div className="flex items-center justify-center gap-2 text-red-400 text-xs font-bold bg-red-900/20 py-2 rounded-lg mb-2">
                                        <AlertTriangle size={14} /> {validationError}
                                    </div>
                                )}
                                <button
                                    onClick={handleStartGame}
                                    disabled={!!validationError}
                                    className="w-full py-4 rounded-xl font-black text-lg bg-gradient-to-r from-red-600 via-rose-600 to-orange-600 hover:scale-[1.02] active:scale-[0.98] transition shadow-lg shadow-red-500/20 text-gray-200 disabled:opacity-50 disabled:scale-100 disabled:shadow-none flex items-center justify-center gap-2"
                                >
                                    <Play fill="currentColor" size={20} /> ゲームを開始する
                                </button>
                            </div>
                        ) : (
                            <div className="text-center py-3 bg-gray-950/50 rounded-xl border border-gray-700 border-dashed text-gray-300 text-sm animate-pulse">
                                ホストが設定中です...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};