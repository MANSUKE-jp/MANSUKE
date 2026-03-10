import React, { useState, useEffect, useRef } from 'react';
import { Users, Crown, ArrowRight, Key, User, Search, RefreshCw, X, Eye, Settings, Trash2, Power, Construction, PlayCircle, History, FileText, Clock, Radio, LogIn } from 'lucide-react';
import { getDoc, doc, collection, query, onSnapshot } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase.js';
import { getMillis } from '../utils/helpers.js';
// eslint-disable-next-line no-unused-vars
import { motion } from 'framer-motion';

export const HomeScreen = ({ user, mansukeUser, setRoomCode, setView, setNotification, maintenanceMode }) => {
    // ステート: 画面遷移管理
    // initial: 初期画面
    // join: 参加画面（募集リスト・観戦リスト）
    // maintenance: メンテナンス画面
    const [homeStep, setHomeStep] = useState('initial');

    // ステート: アクションモード (create: 作成, join: 参加, spectate: 観戦)
    const [homeMode, setHomeMode] = useState(null);

    // 権限・ユーザー情報
    const isAdmin = user?.isStaff || mansukeUser?.isStaff || false;
    const nickname = mansukeUser?.nickname || mansukeUser?.displayName || "NaN";

    // ステート: 入力データ・部屋リスト
    const [roomCodeInput, setRoomCodeInput] = useState("");
    const [availableRooms, setAvailableRooms] = useState([]);
    const [waitingRooms, setWaitingRooms] = useState([]);
    const [spectateRooms, setSpectateRooms] = useState([]);

    // ステート: モーダル・ローディング制御
    const [showManualInputModal, setShowManualInputModal] = useState(false);
    const [showSpectatorConfirmModal, setShowSpectatorConfirmModal] = useState(false);
    const [isValidatingRoom, setIsValidatingRoom] = useState(false);

    // ステート: パッチノートカード表示制御
    const [showPatchNote, setShowPatchNote] = useState(true);
    const [isPressingPatchNote, setIsPressingPatchNote] = useState(false);
    const patchNoteTimerRef = useRef(null);

    useEffect(() => {
        if (maintenanceMode && !isAdmin && homeStep !== 'maintenance') {
            setHomeStep('maintenance');
        } else if (!maintenanceMode && homeStep === 'maintenance') {
            setHomeStep('initial');
        }
    }, [maintenanceMode, isAdmin, homeStep]);

    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            const waiting = allRooms.filter(r => r.status === 'waiting');
            const spectating = allRooms.filter(r => r.status === 'playing');

            waiting.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
            spectating.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));

            setAvailableRooms(allRooms);
            setWaitingRooms(waiting);
            setSpectateRooms(spectating);
        }, () => { });
        return () => unsubscribe();
    }, [user]);

    const handleToggleMaintenance = async () => {
        try {
            const fn = httpsCallable(functions, 'toggleMaintenance');
            await fn({ enabled: !maintenanceMode });
            setNotification({ message: `メンテナンスモードを${!maintenanceMode ? "ON" : "OFF"}にしました`, type: "success" });
        } catch (e) {
            setNotification({ message: "変更エラー: " + e.message, type: "error" });
        }
    };

    const handleCheckRoom = async (e) => {
        if (e && e.preventDefault) e.preventDefault();
        const targetCode = String(roomCodeInput).trim();
        if (targetCode.length !== 4) return;
        setIsValidatingRoom(true);

        try {
            const roomRef = doc(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms', targetCode);
            const roomSnap = await getDoc(roomRef);

            if (roomSnap.exists()) {
                const roomData = roomSnap.data();

                if (roomData.status === 'waiting') {
                    setShowManualInputModal(false);
                    handleJoinRoom(targetCode, isAdmin);
                } else if (roomData.status === 'playing') {
                    setShowManualInputModal(false);
                    setShowSpectatorConfirmModal(true);
                } else {
                    setNotification({ message: "この部屋は既に終了しています", type: "error" });
                }
            } else {
                setNotification({ message: "部屋が見つかりません", type: "error" });
            }
        } catch {
            setNotification({ message: "通信エラーが発生しました", type: "error" });
        } finally {
            setIsValidatingRoom(false);
        }
    };

    const confirmJoinSpectator = () => {
        setShowSpectatorConfirmModal(false);
        setHomeMode('spectate');
        handleJoinRoom(roomCodeInput, isAdmin, true);
    };

    const handlePatchNotePressStart = () => {
        setIsPressingPatchNote(true);
        patchNoteTimerRef.current = setTimeout(() => {
            window.location.href = 'https://mansuke.cerinal.com/werewolf/patch-notes';
            setIsPressingPatchNote(false);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 2000);
    };

    const handlePatchNotePressEnd = () => {
        setIsPressingPatchNote(false);
        if (patchNoteTimerRef.current) {
            clearTimeout(patchNoteTimerRef.current);
            patchNoteTimerRef.current = null;
        }
    };

    const handleCreateRoom = async (isDev = false) => {
        if (!nickname || nickname === "NaN") return setNotification({ message: "ログインしてください", type: "error" });
        try {
            const createRoomFn = httpsCallable(functions, 'createRoom');
            const result = await createRoomFn({ nickname, isDev });
            setRoomCode(result.data.roomCode);
            setView('lobby');
        } catch (e) {
            setNotification({ message: "部屋作成エラー: " + e.message, type: "error" });
        }
    };

    const handleJoinRoom = async (codeToJoin = roomCodeInput, isDev = false, forceSpectate = false) => {
        if (!nickname || codeToJoin.length !== 4) return setNotification({ message: "入力エラー", type: "error" });

        try {
            if (homeMode === 'spectate' || forceSpectate) {
                const joinSpectatorFn = httpsCallable(functions, 'joinSpectator');
                await joinSpectatorFn({ roomCode: codeToJoin, nickname: nickname, isDev });
                setRoomCode(codeToJoin);
                setView('game');
                return;
            }

            const joinRoomFn = httpsCallable(functions, 'joinRoom');
            await joinRoomFn({ roomCode: codeToJoin, nickname: nickname, isDev });
            setRoomCode(codeToJoin);
            setView('lobby');
        } catch (e) {
            setNotification({ message: "参加エラー: " + e.message, type: "error" });
        }
    };

    const handleRoomSelect = (roomId) => {
        setRoomCodeInput(roomId);
        setIsValidatingRoom(true);
        const targetRoom = availableRooms.find(r => r.id === roomId);

        if (targetRoom) {
            if (targetRoom.status === 'waiting') {
                setIsValidatingRoom(false);
                handleJoinRoom(roomId, isAdmin);
            } else if (targetRoom.status === 'playing') {
                setShowSpectatorConfirmModal(true);
                setIsValidatingRoom(false);
            } else {
                setNotification({ message: "部屋が見つかりません", type: "error" });
                setIsValidatingRoom(false);
            }
        } else {
            handleCheckRoom();
        }
    };

    if (homeStep === 'maintenance' && !isAdmin) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
                <div className="relative z-10 text-center max-w-2xl px-4">
                    <Construction size={60} className="text-amber-500 mx-auto mb-6 md:w-20 md:h-20 md:mb-8" />
                    <h1 className="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-400 to-amber-600 mb-6 tracking-tight select-none cursor-default active:scale-95 transition-transform">
                        MAINTENANCE
                    </h1>
                    <p className="text-lg md:text-2xl text-gray-200 font-bold mb-4">
                        メンテナンスモードが有効です
                    </p>
                    <div className="bg-gray-800/80 border border-amber-500/30 p-6 rounded-2xl shadow-sm">
                        <p className="text-gray-300 leading-relaxed text-sm md:text-base">
                            現在開発者がメンテナンスを行っております。<br />
                            開発者の準備が完了するまで、しばらくお待ちください。
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    const features = [
        {
            id: 'create',
            title: '部屋を作成する',
            icon: <Crown size={48} />,
            color: 'bg-gray-800/80 text-red-400 border-gray-700 hover:border-red-500/50 shadow-sm hover:shadow-xl hover:shadow-red-500/10',
            delay: 0.1,
            action: () => handleCreateRoom(isAdmin)
        },
        {
            id: 'join',
            title: '部屋に参加する',
            icon: <LogIn size={48} />,
            color: 'bg-gray-800/80 text-orange-400 border-gray-700 hover:border-orange-500/50 shadow-sm hover:shadow-xl hover:shadow-orange-500/10',
            delay: 0.2,
            action: () => setHomeStep('join')
        },
        {
            id: 'logs',
            title: 'ゲームログを見る',
            icon: <History size={48} />,
            color: 'bg-gray-800/80 text-amber-400 border-gray-700 hover:border-amber-500/50 shadow-sm hover:shadow-xl hover:shadow-amber-500/10',
            delay: 0.3,
            action: () => setView('logs')
        }
    ];

    const RoomCardList = ({ rooms, emptyMessage, emptySubMessage }) => (
        <div className={`overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 gap-3 content-start ${rooms.length > 0 ? "max-h-[300px]" : ""}`}>
            {rooms.length === 0 ? (
                <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-12 text-gray-300 border-2 border-dashed border-gray-700 rounded-2xl bg-gray-900/50">
                    <Search size={48} className="mb-4 opacity-50" />
                    <p className="font-bold text-gray-300">{emptyMessage}</p>
                    <p className="text-xs mt-2">{emptySubMessage}</p>
                </div>
            ) : (
                rooms.map(room => (
                    <button
                        key={room.id}
                        onClick={() => handleRoomSelect(room.id)}
                        className="group relative flex flex-col items-start p-5 rounded-2xl border border-gray-700 bg-gray-800/80 hover:border-red-500/50 hover:bg-gray-800 transition-all duration-300 shadow-sm hover:shadow-md text-left w-full h-fit"
                    >
                        <div className="flex justify-between items-start w-full mb-2">
                            <span className="text-xs font-bold text-gray-300 bg-gray-700 px-2 py-1 rounded">ROOM: {room.id}</span>
                            <div className="flex gap-2">
                                {room.status === 'playing' && <span className="text-[10px] font-bold bg-green-900/50 text-green-400 px-2 py-0.5 rounded border border-green-700">進行中</span>}
                                {room.status === 'waiting' && <span className="text-[10px] font-bold bg-red-900/50 text-red-400 px-2 py-0.5 rounded border border-red-700">募集中</span>}
                                <ArrowRight size={18} className="text-gray-300 group-hover:text-red-400 group-hover:translate-x-1 transition-transform" />
                            </div>
                        </div>
                        <div className="flex items-center gap-2 mb-1 w-full">
                            <User size={16} className="text-red-400 shrink-0" />
                            <span className="font-bold text-base md:text-lg text-gray-200 truncate w-full">{room.hostName || "名無しホスト"} の部屋</span>
                        </div>
                        <p className="text-xs text-gray-300">
                            作成: {room.createdAt ? new Date(getMillis(room.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                        </p>
                    </button>
                ))
            )}
        </div>
    );

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-y-auto pb-40">
            {/* 背景装飾 */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-red-950/30 rounded-full blur-3xl -z-10 opacity-60 pointer-events-none" />

            {/* モーダル群 (手動コード、観戦確認) */}
            {showManualInputModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-gray-800 border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-xl relative">
                        <button onClick={() => setShowManualInputModal(false)} className="absolute top-4 right-4 text-gray-300 hover:text-gray-300"><X size={24} /></button>
                        <h3 className="text-xl font-bold text-gray-100 mb-6 flex items-center gap-2"><Search size={20} className="text-red-400" /> 部屋コードを入力</h3>
                        <form onSubmit={handleCheckRoom} className="space-y-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                placeholder="部屋コード (4桁)"
                                className="w-full bg-gray-900 border border-gray-600 rounded-xl px-4 py-3 text-gray-100 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition text-center tracking-widest font-bold text-lg placeholder-gray-500"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value.slice(0, 4))}
                            />
                            <button
                                type="submit"
                                disabled={roomCodeInput.length !== 4 || isValidatingRoom}
                                className="w-full bg-red-600 hover:bg-red-900/20 disabled:opacity-50 text-white rounded-xl py-3 font-bold transition flex items-center justify-center gap-2 shadow-sm"
                            >
                                {isValidatingRoom ? "確認中..." : <>次へ <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {showSpectatorConfirmModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-gray-800 border border-purple-500/30 rounded-3xl p-6 w-full max-w-sm shadow-xl relative text-center">
                        <Eye size={48} className="text-purple-400 mx-auto mb-4 animate-pulse" />
                        <h3 className="text-xl font-bold text-gray-100 mb-2">この部屋でゲームが進行中です</h3>
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                            観戦者モードとして参加しますか？<br />
                            このゲームは観戦者として霊界に参加し、次回の試合からゲームに参加することができます。
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSpectatorConfirmModal(false)} className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-300 font-bold hover:bg-gray-700 transition shadow-sm">
                                キャンセル
                            </button>
                            <button onClick={confirmJoinSpectator} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-900/200 transition shadow-sm">
                                参加する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showPatchNote && (
                <div className="fixed bottom-4 right-4 z-[150] w-80 bg-gray-800 border border-red-500/30 rounded-2xl shadow-xl overflow-hidden animate-fade-in-up">
                    <div className="relative p-4">
                        <button onClick={() => setShowPatchNote(false)} className="absolute top-2 right-2 text-gray-300 hover:text-gray-300 transition p-1 rounded-full hover:bg-gray-700 z-20">
                            <X size={16} />
                        </button>
                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-red-900/30 p-1.5 rounded-lg border border-red-500/30">
                                <FileText size={16} className="text-red-400" />
                            </div>
                            <h3 className="text-sm font-bold text-gray-100">MANSUKE WEREWOLF<br />パッチノート</h3>
                        </div>
                        <p className="text-[11px] text-gray-300 leading-relaxed mb-4">
                            更新情報の確認・バグ報告・新役職や新機能のご提案は、パッチノートをご確認ください。
                        </p>
                        <button
                            className="w-full relative h-10 rounded-xl overflow-hidden bg-gray-900 border border-gray-700 group select-none"
                            onMouseDown={handlePatchNotePressStart}
                            onMouseUp={handlePatchNotePressEnd}
                            onMouseLeave={handlePatchNotePressEnd}
                            onTouchStart={handlePatchNotePressStart}
                            onTouchEnd={handlePatchNotePressEnd}
                        >
                            <div className={`absolute top-0 left-0 h-full bg-red-900/40 transition-all ease-linear ${isPressingPatchNote ? "duration-[2000ms] w-full" : "duration-200 w-0"}`}></div>
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-gray-300 flex items-center gap-2 group-active:scale-95 transition-transform">
                                    <Clock size={12} className="text-gray-300" /> 2秒長押しでアクセス
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {homeStep === 'initial' && (
                <div className="flex flex-col items-center justify-center w-full max-w-6xl mx-auto px-4 z-10 animate-fade-in">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.7, type: "spring" }}
                        className="text-center mb-16 relative z-10"
                    >
                        <h1 className="text-5xl md:text-8xl font-black tracking-tighter leading-none filter drop-shadow-sm py-2 px-4">
                            <span className="text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-rose-600 to-orange-500">
                                MANSUKE<br />WEREWOLF
                            </span>
                        </h1>
                        <motion.p
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.5 }}
                            className="mt-6 text-sm md:text-base text-gray-300 font-bold bg-gray-800/80 backdrop-blur-sm py-2 px-6 rounded-full inline-block shadow-sm border border-gray-700"
                        >
                            Ver3.0 [2026/03/06公開]
                        </motion.p>
                    </motion.div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-5xl">
                        {features.map((feature) => (
                            <motion.button
                                key={feature.id}
                                onClick={feature.action}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: feature.delay, duration: 0.5 }}
                                whileHover={{ y: -8, scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                className={`
                                    relative group flex flex-col items-center justify-center 
                                    p-8 h-64 md:h-72 rounded-3xl border transition-all duration-300
                                    ${feature.color}
                                `}
                            >
                                <div className="mb-6 p-6 bg-gray-900/80 rounded-full shadow-inner group-hover:scale-110 group-hover:rotate-6 transition-all duration-300">
                                    {feature.icon}
                                </div>
                                <h3 className="text-xl font-bold text-center leading-relaxed whitespace-pre-wrap text-gray-200">
                                    {feature.title}
                                </h3>
                            </motion.button>
                        ))}
                    </div>

                    {isAdmin && (
                        <motion.div 
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.6 }}
                            className="mt-12 w-full max-w-md"
                        >
                            <div className="bg-gray-800/80 border border-gray-700 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <Construction size={24} className="text-amber-500 shrink-0" />
                                    <div className="flex flex-col text-left">
                                        <span className="text-sm font-bold text-gray-200">メンテナンスモード</span>
                                        <p className="text-xs text-gray-300">一般ユーザーのアクセスを制限します</p>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-1">
                                    <button
                                        onClick={handleToggleMaintenance}
                                        className={`relative w-14 h-7 rounded-full transition-colors duration-300 shrink-0 ${maintenanceMode ? "bg-amber-900/200" : "bg-gray-600"}`}
                                    >
                                        <div className={`absolute top-1 w-5 h-5 rounded-full bg-white transition-all duration-300 shadow-sm ${maintenanceMode ? "left-8" : "left-1"}`}></div>
                                    </button>
                                    <span className={`text-[10px] font-bold ${maintenanceMode ? "text-amber-400" : "text-gray-300"}`}>{maintenanceMode ? "ON" : "OFF"}</span>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </div>
            )}

            {homeStep === 'join' && (
                <div className="w-full max-w-4xl flex flex-col mx-auto px-4 z-10 animate-fade-in space-y-8">
                    <button onClick={() => setHomeStep('initial')} className="self-start text-gray-300 hover:text-gray-200 flex items-center gap-2 font-bold mb-4 bg-gray-800 px-4 py-2 rounded-xl shadow-sm border border-gray-700 transition">
                        <ArrowRight className="rotate-180" size={16} /> 最初に戻る
                    </button>

                    <div className="space-y-6">
                        <div>
                            <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2 mb-4 shrink-0">
                                <Users className="text-red-400" />
                                現在募集中の部屋
                            </h2>
                            <RoomCardList 
                                rooms={waitingRooms} 
                                emptyMessage="現在募集中の部屋はありません" 
                                emptySubMessage="新しい部屋が作成されるのをお待ちください" 
                            />
                        </div>

                        <div>
                            <h2 className="text-xl font-bold text-gray-200 flex items-center gap-2 mb-4 shrink-0">
                                <Eye className="text-purple-400" />
                                観戦可能な部屋
                            </h2>
                            <RoomCardList 
                                rooms={spectateRooms} 
                                emptyMessage="進行中のゲームはありません" 
                                emptySubMessage="ー" 
                            />
                        </div>

                        <div className="text-center pt-8 border-t border-gray-700">
                            <button onClick={() => setShowManualInputModal(true)} className="text-sm text-red-400 hover:text-red-300 font-bold underline underline-offset-4 decoration-red-500/30 hover:decoration-red-400 transition">
                                部屋が見つかりませんか？ コードを直接入力する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};