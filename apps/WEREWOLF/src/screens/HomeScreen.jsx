import React, { useState, useEffect, useRef } from 'react';
import { Users, Crown, ArrowRight, Key, User, Search, RefreshCw, X, Eye, Settings, Trash2, Power, Construction, PlayCircle, History, FileText, Clock } from 'lucide-react';
import { setDoc, getDoc, getDocs, doc, serverTimestamp, collection, query, where, onSnapshot, updateDoc, arrayUnion } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { db, functions } from '../config/firebase.js';
import { getMillis } from '../utils/helpers.js';

// コンポーネント: ホーム画面
// 役割: 部屋作成、参加、観戦、管理者機能、メンテナンス表示
export const HomeScreen = ({ user, mansukeUser, setRoomCode, setView, setNotification, setMyPlayer, maintenanceMode }) => {
    // ステート: 画面遷移管理
    // initial: 初期画面
    // spectateRoomList: 途中参加（観戦）可能な部屋リスト
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

    // ステート: モーダル・ローディング制御
    const [showManualInputModal, setShowManualInputModal] = useState(false);
    const [showSpectatorConfirmModal, setShowSpectatorConfirmModal] = useState(false); // 観戦参加確認
    const [isValidatingRoom, setIsValidatingRoom] = useState(false);

    // ステート: パッチノートカード表示制御
    const [showPatchNote, setShowPatchNote] = useState(true);
    const [isPressingPatchNote, setIsPressingPatchNote] = useState(false);
    const patchNoteTimerRef = useRef(null);

    // (FetchAdminPassword logic removed as it's handled by Mansuke token)

    // Effect: メンテナンスモード監視
    // 管理者以外は強制的にメンテナンス画面へ遷移
    // 管理者はメンテナンス中も操作可能
    useEffect(() => {
        if (maintenanceMode && !isAdmin && homeStep !== 'maintenance') {
            setHomeStep('maintenance');
        } else if (!maintenanceMode && homeStep === 'maintenance') {
            setHomeStep('initial');
        }
    }, [maintenanceMode, isAdmin, homeStep]);

    // Effect: 部屋リストリアルタイム監視
    // 用途に応じてフィルタリング
    // - 途中参加(spectateRoomList): status='playing'
    // - 通常参加(その他): status='waiting'
    useEffect(() => {
        if (!user) return;

        const q = query(collection(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const allRooms = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

            let filteredRooms = [];
            if (homeStep === 'spectateRoomList') {
                // 進行中の部屋のみ抽出（終了・中断は除外）
                filteredRooms = allRooms.filter(room => room.status === 'playing');
            } else {
                // 待機中の部屋のみ抽出
                filteredRooms = allRooms.filter(room => room.status === 'waiting');
            }

            // 作成日時降順ソート
            filteredRooms.sort((a, b) => getMillis(b.createdAt) - getMillis(a.createdAt));
            setAvailableRooms(filteredRooms);
        }, () => { });
        return () => unsubscribe();
    }, [homeStep, user]);

    // (ValidateAdminPass removed)

    // 関数: メンテナンスモード切り替え (Cloud Functions)
    const handleToggleMaintenance = async () => {
        try {
            const fn = httpsCallable(functions, 'toggleMaintenance');
            await fn({ enabled: !maintenanceMode });
            setNotification({ message: `メンテナンスモードを${!maintenanceMode ? "ON" : "OFF"}にしました`, type: "success" });
        } catch (e) {
            setNotification({ message: "変更エラー: " + e.message, type: "error" });
        }
    };

    // 関数: 部屋コード検証
    // 入力されたコードの部屋が存在するか、参加可能かチェック
    const handleCheckRoom = async (e) => {
        // フォーム送信時のリロード防止
        if (e && e.preventDefault) e.preventDefault();

        // 文字列として確実に処理するためString変換とtrimを行う
        const targetCode = String(roomCodeInput).trim();

        if (targetCode.length !== 4) return;
        setIsValidatingRoom(true);

        try {
            // ドキュメントIDとして直接指定して取得
            const roomRef = doc(db, 'artifacts', 'mansuke-jinro', 'public', 'data', 'rooms', targetCode);
            const roomSnap = await getDoc(roomRef);

            if (roomSnap.exists()) {
                const roomData = roomSnap.data();

                if (roomData.status === 'waiting') {
                    // 待機中 -> そのまま参加処理へ
                    setShowManualInputModal(false);
                    handleJoinRoom(targetCode, isAdmin);
                } else if (roomData.status === 'playing') {
                    // 進行中 -> 観戦確認モーダル表示
                    setShowManualInputModal(false);
                    setShowSpectatorConfirmModal(true);
                } else {
                    // 終了/中断 -> エラー
                    setNotification({ message: "この部屋は既に終了しています", type: "error" });
                }
            } else {
                setNotification({ message: "部屋が見つかりません", type: "error" });
            }
        } catch (e) {
            setNotification({ message: "通信エラーが発生しました", type: "error" });
        } finally {
            setIsValidatingRoom(false);
        }
    };

    // 関数: 観戦モード参加確定
    const confirmJoinSpectator = () => {
        setShowSpectatorConfirmModal(false);
        setHomeMode('spectate');
        // ダイレクトに参加
        handleJoinRoom(roomCodeInput, isAdmin, true);
    };

    // (Long press hidden admin commands removed)

    // 関数: パッチノート長押し開始
    const handlePatchNotePressStart = () => {
        setIsPressingPatchNote(true);
        patchNoteTimerRef.current = setTimeout(() => {
            // window.open ではなく location.href でページ遷移させる
            window.location.href = 'https://mansuke.cerinal.com/werewolf/patch-notes';
            setIsPressingPatchNote(false);
            if (navigator.vibrate) navigator.vibrate(50);
        }, 2000);
    };

    // 関数: パッチノート長押し中断
    const handlePatchNotePressEnd = () => {
        setIsPressingPatchNote(false);
        if (patchNoteTimerRef.current) {
            clearTimeout(patchNoteTimerRef.current);
            patchNoteTimerRef.current = null;
        }
    };

    // 関数: 部屋作成処理
    // isDev: 管理者メニューからの作成時true
    const handleCreateRoom = async (isDev = false) => {
        if (!nickname) return setNotification({ message: "名前を入力", type: "error" });
        try {
            const createRoomFn = httpsCallable(functions, 'createRoom');
            const result = await createRoomFn({ nickname, isDev });
            setRoomCode(result.data.roomCode);
            setView('lobby');
        } catch (e) {
            setNotification({ message: "部屋作成エラー: " + e.message, type: "error" });
        }
    };

    // 関数: 部屋参加処理
    // 観戦参加の場合はCloud Functions経由
    const handleJoinRoom = async (codeToJoin = roomCodeInput, isDev = false, forceSpectate = false) => {
        if (!nickname || codeToJoin.length !== 4) return setNotification({ message: "入力エラー", type: "error" });

        try {
            // 観戦モード処理
            if (homeMode === 'spectate' || forceSpectate) {
                const joinSpectatorFn = httpsCallable(functions, 'joinSpectator');
                await joinSpectatorFn({ roomCode: codeToJoin, nickname: nickname, isDev });
                setRoomCode(codeToJoin);
                setView('game');
                return;
            }

            // 通常参加: Cloud Function経由
            const joinRoomFn = httpsCallable(functions, 'joinRoom');
            await joinRoomFn({ roomCode: codeToJoin, nickname: nickname, isDev });
            setRoomCode(codeToJoin);
            setView('lobby');
        } catch (e) {
            setNotification({ message: "参加エラー: " + e.message, type: "error" });
        }
    };

    // 関数: 部屋リストからの選択処理
    // 選択された部屋IDをセットし検証へ
    const handleRoomSelect = (roomId) => {
        setRoomCodeInput(roomId);
        setIsValidatingRoom(true);
        // リスト上の情報を使って簡易チェック（通信削減）
        const targetRoom = availableRooms.find(r => r.id === roomId);

        if (targetRoom) {
            if (targetRoom.status === 'waiting') {
                // 直接参加
                setIsValidatingRoom(false);
                handleJoinRoom(roomId, isAdmin);
            } else if (targetRoom.status === 'playing') {
                // 進行中 -> 観戦確認へ
                setShowSpectatorConfirmModal(true);
                setIsValidatingRoom(false);
            } else {
                setNotification({ message: "部屋が見つかりません", type: "error" });
                setIsValidatingRoom(false);
            }
        } else {
            // リスト情報のラグ対策でサーバー確認
            handleCheckRoom();
        }
    };

    // レンダリング: メンテナンス画面
    if (homeStep === 'maintenance' && !isAdmin) {
        return (
            <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center p-4 md:p-6 relative overflow-hidden font-sans">
                {/* 背景エフェクト */}
                <div className="absolute inset-0 z-0">
                    <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-amber-900/20 via-black to-black animate-pulse-slow"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[1px] bg-amber-500/50 blur-sm"></div>
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1px] h-[800px] bg-amber-500/50 blur-sm"></div>
                </div>

                <div className="relative z-10 text-center max-w-2xl px-4">
                    <Construction size={60} className="text-amber-500 mx-auto mb-6 md:w-20 md:h-20 md:mb-8" />
                    {/* タイトル (長押しで管理者認証トリガー) */}
                    <h1
                        className="text-4xl md:text-7xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-300 to-amber-700 mb-6 tracking-tight select-none cursor-default active:scale-95 transition-transform"
                    >
                        MAINTENANCE
                    </h1>
                    <p className="text-lg md:text-2xl text-gray-300 font-bold mb-4">
                        メンテナンスモードが有効です
                    </p>
                    <div className="bg-gray-900/80 backdrop-blur border border-amber-500/30 p-6 rounded-2xl">
                        <p className="text-gray-400 leading-relaxed text-sm md:text-base">
                            現在開発者がメンテナンスを行っております。<br />
                            開発者の準備が完了するまで、しばらくお待ちください。
                        </p>
                    </div>
                </div>


            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-gray-100 flex flex-col items-center justify-center p-4 font-sans relative overflow-y-auto pb-40">

            {/* 手動コード入力モーダル */}
            {showManualInputModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-gray-900 border border-gray-700 rounded-3xl p-6 w-full max-w-md shadow-2xl relative">
                        <button onClick={() => setShowManualInputModal(false)} className="absolute top-4 right-4 text-gray-400 hover:text-white"><X size={24} /></button>
                        <h3 className="text-xl font-bold text-white mb-6 flex items-center gap-2"><Search size={20} /> 部屋コードを入力</h3>
                        <form onSubmit={handleCheckRoom} className="space-y-4">
                            <input
                                type="text"
                                inputMode="numeric"
                                pattern="\d*"
                                placeholder="部屋コード (4桁)"
                                className="w-full bg-gray-950/50 border border-gray-600 rounded-xl px-4 py-3 text-white outline-none focus:border-blue-500 transition text-center tracking-widest font-bold text-lg"
                                value={roomCodeInput}
                                onChange={(e) => setRoomCodeInput(e.target.value.slice(0, 4))}
                            />
                            <button
                                type="submit"
                                disabled={roomCodeInput.length !== 4 || isValidatingRoom}
                                className="w-full bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl py-3 font-bold transition flex items-center justify-center gap-2"
                            >
                                {isValidatingRoom ? "確認中..." : <>次へ <ArrowRight size={18} /></>}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* 観戦参加確認モーダル */}
            {showSpectatorConfirmModal && (
                <div className="fixed inset-0 bg-black/90 backdrop-blur-sm z-[250] flex items-center justify-center p-4 animate-fade-in">
                    <div className="bg-gray-900 border border-purple-500/50 rounded-3xl p-6 w-full max-w-sm shadow-2xl relative text-center">
                        <Eye size={48} className="text-purple-400 mx-auto mb-4 animate-pulse" />
                        <h3 className="text-xl font-bold text-white mb-2">この部屋でゲームが進行中です</h3>
                        <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                            観戦者モードとして参加しますか？<br />
                            このゲームは観戦者として霊界に参加し、次回の試合からゲームに参加することができます。
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowSpectatorConfirmModal(false)} className="flex-1 py-3 rounded-xl border border-gray-600 text-gray-400 font-bold hover:bg-gray-800 transition">
                                キャンセル
                            </button>
                            <button onClick={confirmJoinSpectator} className="flex-1 py-3 rounded-xl bg-purple-600 text-white font-bold hover:bg-purple-500 transition shadow-lg shadow-purple-900/20">
                                参加する
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* 管理者認証モーダル (通常画面用) removed */}

            {/* パッチノートカード */}
            {showPatchNote && (
                <div className="fixed bottom-4 right-4 z-[150] w-80 bg-gray-900/90 border border-indigo-500/50 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-md animate-fade-in-up">
                    <div className="relative p-4">
                        <button onClick={() => setShowPatchNote(false)} className="absolute top-2 right-2 text-gray-400 hover:text-white transition p-1 rounded-full hover:bg-white/10 z-20">
                            <X size={16} />
                        </button>

                        <div className="flex items-center gap-2 mb-2">
                            <div className="bg-indigo-600/20 p-1.5 rounded-lg border border-indigo-500/30">
                                <FileText size={16} className="text-indigo-400" />
                            </div>
                            <h3 className="text-sm font-bold text-white">MANSUKE WEREWOLF<br />パッチノート</h3>
                        </div>

                        <p className="text-[11px] text-gray-300 leading-relaxed mb-4">
                            更新情報の確認・バグ報告・新役職や新機能のご提案は、パッチノートをご確認ください。
                        </p>

                        <button
                            className="w-full relative h-10 rounded-xl overflow-hidden bg-indigo-950 border border-indigo-500/30 group select-none"
                            onMouseDown={handlePatchNotePressStart}
                            onMouseUp={handlePatchNotePressEnd}
                            onMouseLeave={handlePatchNotePressEnd}
                            onTouchStart={handlePatchNotePressStart}
                            onTouchEnd={handlePatchNotePressEnd}
                        >
                            {/* プログレスバー背景 */}
                            <div
                                className={`absolute top-0 left-0 h-full bg-indigo-500/40 transition-all ease-linear ${isPressingPatchNote ? "duration-[2000ms] w-full" : "duration-200 w-0"}`}
                            ></div>

                            {/* ボタンテキスト */}
                            <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xs font-bold text-indigo-100 flex items-center gap-2 group-active:scale-95 transition-transform">
                                    <Clock size={12} /> 2秒長押しでアクセス
                                </span>
                            </div>
                        </button>
                    </div>
                </div>
            )}

            {/* メインレイアウト */}
            <div className="z-10 w-full max-w-5xl px-2 h-full flex flex-col justify-center min-h-[500px]">
                {/* ヘッダー・タイトルロゴ */}
                <div className="text-center space-y-4 mb-8 shrink-0">
                    <h1
                        className="text-4xl md:text-8xl font-black text-transparent bg-clip-text bg-gradient-to-r from-blue-400 via-purple-400 to-pink-400 tracking-tighter drop-shadow-2xl py-2 select-none"
                    >
                        MANSUKE<br />WEREWOLF
                    </h1>
                    <p className="text-xs md:text-sm text-gray-500 font-mono">Server Edition Ver 3.5</p>
                </div>

                <div className="bg-gray-900/60 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-6 md:p-8 shadow-2xl relative w-full mx-auto flex flex-col h-auto">

                    {/* 画面: 初期画面 or 途中参加部屋リスト */}
                    {(homeStep === 'initial' || homeStep === 'spectateRoomList') && (
                        <div className="flex flex-col h-full animate-fade-in space-y-4">

                            {/* 戻るボタン (途中参加画面時) */}
                            {homeStep === 'spectateRoomList' && (
                                <button onClick={() => setHomeStep('initial')} className="absolute top-6 left-6 text-gray-500 hover:text-white flex items-center gap-1">
                                    <ArrowRight className="rotate-180" size={14} /> 戻る
                                </button>
                            )}

                            {/* 部屋リスト表示エリア */}
                            <div className="flex flex-col min-h-0">
                                <h2 className="text-lg md:text-xl font-bold text-white flex items-center justify-between gap-2 mb-4 shrink-0 mt-2">
                                    <span className="flex items-center gap-2">
                                        {homeStep === 'spectateRoomList' ? <Eye className="text-purple-400" /> : <Users className="text-blue-400" />}
                                        {homeStep === 'spectateRoomList' ? "途中参加可能な部屋" : "参加可能な部屋"}
                                    </span>
                                    <span className="text-[10px] md:text-xs bg-blue-900/30 text-blue-300 px-2 py-1 rounded border border-blue-500/30 flex items-center gap-1 whitespace-nowrap">
                                        <RefreshCw size={10} className="animate-spin-slow" /> リアルタイム更新中
                                    </span>
                                </h2>

                                {/* 部屋カードリスト */}
                                <div className={`overflow-y-auto custom-scrollbar pr-2 grid grid-cols-1 md:grid-cols-2 gap-3 content-start ${availableRooms.length > 0 ? "max-h-[300px]" : ""}`}>
                                    {availableRooms.length === 0 ? (
                                        <div className="col-span-1 md:col-span-2 flex flex-col items-center justify-center py-12 text-gray-500 border-2 border-dashed border-gray-800 rounded-2xl bg-gray-900/30">
                                            <Search size={48} className="mb-4 opacity-50" />
                                            <p className="font-bold">現在、部屋はありません</p>
                                            <p className="text-xs mt-2">
                                                {homeStep === 'spectateRoomList' ? "進行中のゲームはありません" : "新しい部屋が作成されるのをお待ちください"}
                                            </p>
                                        </div>
                                    ) : (
                                        availableRooms.map(room => (
                                            <button
                                                key={room.id}
                                                onClick={() => handleRoomSelect(room.id)}
                                                className="group relative flex flex-col items-start p-5 rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800/80 to-gray-900/80 hover:from-blue-900/40 hover:to-purple-900/40 hover:border-blue-500/50 transition-all duration-300 shadow-lg hover:shadow-blue-500/20 text-left w-full h-fit"
                                            >
                                                <div className="flex justify-between items-start w-full mb-2">
                                                    <span className="text-xs font-bold text-gray-400 bg-black/40 px-2 py-1 rounded">ROOM: {room.id}</span>
                                                    <div className="flex gap-2">
                                                        {room.status === 'playing' && <span className="text-[10px] font-bold bg-green-900/50 text-green-300 px-2 py-0.5 rounded border border-green-500/30">進行中</span>}
                                                        {room.status === 'finished' && <span className="text-[10px] font-bold bg-purple-900/50 text-purple-300 px-2 py-0.5 rounded border border-purple-500/30">終了</span>}
                                                        {room.status === 'aborted' && <span className="text-[10px] font-bold bg-red-900/50 text-red-300 px-2 py-0.5 rounded border border-red-500/30">中断</span>}
                                                        <ArrowRight size={18} className="text-gray-500 group-hover:text-blue-400 group-hover:translate-x-1 transition-transform" />
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-2 mb-1 w-full">
                                                    <User size={16} className="text-blue-400 shrink-0" />
                                                    <span className="font-bold text-base md:text-lg text-white truncate w-full">{room.hostName || "名無しホスト"} の部屋</span>
                                                </div>
                                                <p className="text-xs text-gray-500">
                                                    作成: {room.createdAt ? new Date(getMillis(room.createdAt)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "--:--"}
                                                </p>
                                            </button>
                                        ))
                                    )}
                                </div>
                            </div>

                            <div className="shrink-0 pt-2 space-y-4">
                                {/* 手動入力トリガー */}
                                <div className="text-center space-y-2">
                                    <button onClick={() => setShowManualInputModal(true)} className="text-sm text-gray-400 hover:text-white underline underline-offset-4 decoration-gray-600 hover:decoration-white transition block mx-auto">
                                        部屋が見つかりませんか？ コードを直接入力する
                                    </button>
                                </div>

                                {/* メインアクションボタン (通常モード) */}
                                {homeStep === 'initial' && (
                                    <div className="space-y-3 mt-4 pt-4 border-t border-gray-800">
                                        <button onClick={() => handleCreateRoom(isAdmin)} className="w-full py-4 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg hover:scale-[1.02] transition transform text-white font-black text-lg flex flex-col items-center justify-center gap-1 group">
                                            <span className="flex items-center gap-2"><Crown size={24} /> 部屋を新しく作成</span>
                                        </button>

                                        <div className="flex flex-col md:flex-row gap-3">
                                            <button onClick={() => setHomeStep('spectateRoomList')} className="flex-1 bg-gray-800/50 hover:bg-gray-800 text-gray-300 font-bold py-4 rounded-xl border border-gray-700 transition flex items-center justify-center gap-2 text-sm group">
                                                <Eye size={18} className="text-blue-400 group-hover:scale-110 transition" /> 途中参加
                                            </button>
                                            <button onClick={() => setView('logs')} className="flex-1 bg-gray-800/50 hover:bg-gray-800 text-gray-300 font-bold py-4 rounded-xl border border-gray-700 transition flex items-center justify-center gap-2 text-sm group">
                                                <History size={18} className="text-green-400 group-hover:rotate-12 transition" /> 過去のゲーム結果
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* 管理者専用メンテナンス表示 (フロントページに統合) */}
                                {homeStep === 'initial' && isAdmin && (
                                    <div className="mt-4 pt-4 border-t border-purple-500/30">
                                        <div className="bg-purple-900/10 border border-purple-500/30 p-5 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
                                            <div className="flex items-center gap-3">
                                                <Construction size={24} className="text-purple-400 shrink-0" />
                                                <div className="flex flex-col text-left">
                                                    <span className="text-sm font-bold text-gray-300">メンテナンスモード</span>
                                                    <p className="text-xs text-gray-500">一般ユーザーのアクセスを制限します</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center gap-1">
                                                <button
                                                    onClick={handleToggleMaintenance}
                                                    className={`relative w-16 h-8 rounded-full transition-colors duration-300 shrink-0 ${maintenanceMode ? "bg-amber-500" : "bg-gray-600"}`}
                                                >
                                                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 shadow-md ${maintenanceMode ? "left-9" : "left-1"}`}></div>
                                                </button>
                                                <span className={`text-[10px] font-bold ${maintenanceMode ? "text-amber-400" : "text-gray-500"}`}>{maintenanceMode ? "ON" : "OFF"}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};