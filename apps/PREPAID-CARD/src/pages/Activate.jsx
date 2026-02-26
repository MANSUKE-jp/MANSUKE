import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrReader } from 'react-qr-reader';
import SignatureCanvas from 'react-signature-canvas';
import { db, functions } from '../config/firebase'; // functionsを追加
import { httpsCallable } from 'firebase/functions'; // Cloud Functions呼び出し用
import { collection, query, where, getDocs, limit } from 'firebase/firestore'; // updateDoc, serverTimestamp, doc を削除
import { AlertTriangle, CheckCircle2, Keyboard, Loader2, ArrowLeft, Camera, Eraser, Check, Zap, PenTool, Banknote, Send, RotateCcw, XCircle, Search, Delete, X, Home, RotateCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import VirtualKeyboard from '../components/keyboard/VirtualKeyboard';

// --- サブコンポーネント ---

// コード入力用のフルキーボード
const FullKeyboard = ({ onKeyPress, onDelete, onEnter }) => {
    const rows = [
        ['1', '2', '3', '4', '5', '6', '7', '8', '9', '0'],
        ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
        ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
        ['Z', 'X', 'C', 'V', 'B', 'N', 'M']
    ];

    return (
        <div className="w-full max-w-5xl mx-auto flex flex-col gap-1 md:gap-2 select-none px-1">
            {rows.map((row, rowIndex) => (
                <div key={rowIndex} className="flex justify-center gap-1">
                    {row.map((key) => (
                        <button
                            key={key}
                            onClick={() => onKeyPress(key)}
                            className="flex-1 w-full max-w-[40px] md:max-w-[64px] h-10 md:h-14 lg:w-16 lg:h-16 bg-[#1a1a1a] border border-white/10 rounded md:rounded-lg text-white font-bold text-sm md:text-xl lg:text-2xl hover:bg-white/10 active:scale-95 transition-all shadow-sm"
                            type="button"
                        >
                            {key}
                        </button>
                    ))}
                </div>
            ))}
            <div className="flex justify-center gap-2 mt-2 px-1">
                <button
                    onClick={onDelete}
                    className="flex-1 max-w-[140px] h-12 md:h-14 bg-[#1a1a1a] border border-red-500/30 rounded-lg text-red-400 font-bold flex items-center justify-center hover:bg-red-500/10 active:scale-95 transition-all gap-2 text-sm md:text-base"
                    type="button"
                >
                    <Delete size={18} className="md:w-5 md:h-5" /> DELETE
                </button>
                <button
                    onClick={onEnter}
                    className="flex-[2] max-w-[400px] h-12 md:h-14 bg-[#d5b263] text-black font-bold rounded-lg flex items-center justify-center hover:bg-white transition-colors active:scale-95 text-base md:text-lg tracking-widest shadow-[0_0_15px_rgba(213,178,99,0.3)]"
                    type="button"
                >
                    ENTER
                </button>
            </div>
        </div>
    );
};

// 画面分割レイアウト
const CustomerSplitView = ({ title, subtitle, stepIndicator, leftContent, rightContent, rotate = true }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.3 }}
        className="w-full h-full flex items-center justify-center bg-black p-2 md:p-8"
    >
        {/* rotateプロパティで回転を制御（モバイルでは回転を無効化し、Flex-colにする） */}
        <div className={`w-full h-full max-w-7xl flex flex-col lg:flex-row ${rotate ? 'lg:rotate-180' : ''} border border-white/10 rounded-2xl md:rounded-3xl overflow-hidden bg-[#0a0a0a]`}>

            {/* 左側 (PC) / 上側 (モバイル) : ガイダンス */}
            <div className="w-full lg:w-[40%] flex flex-col justify-center p-4 md:p-8 border-b lg:border-b-0 lg:border-l border-white/10 bg-white/5 relative shrink-0">
                <div className="mb-4 md:mb-8">
                    {stepIndicator && (
                        <div className="flex gap-2 mb-4 md:mb-6">
                            {[1, 2, 3].map(i => (
                                <div key={i} className={`h-1 w-8 md:w-12 rounded-full ${i === stepIndicator ? 'bg-[#d5b263]' : 'bg-white/20'}`} />
                            ))}
                        </div>
                    )}
                    <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold font-sans text-white mb-2 md:mb-4 leading-tight whitespace-pre-wrap tracking-tight">{title}</h2>
                    {subtitle && <p className="text-gray-400 text-sm md:text-base font-mono leading-relaxed whitespace-pre-wrap">{subtitle}</p>}
                </div>
                <div className="flex-1 flex flex-col justify-center items-center w-full min-h-[100px] lg:pb-20">
                    {leftContent}
                </div>
            </div>

            {/* 右側 (PC) / 下側 (モバイル) : 入力エリア */}
            <div className="w-full lg:w-[60%] flex-1 flex flex-col justify-center items-center p-2 md:p-8 bg-black relative overflow-hidden">
                {rightContent}
            </div>

        </div>
    </motion.div>
);

// エラーモーダルコンポーネント（Web独自UI）
const ErrorModal = ({ message, onClose, isRotated }) => (
    <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-6"
        onClick={onClose}
    >
        <motion.div
            // Framer Motionのアニメーションプロパティで回転を直接制御することで競合を回避
            // モバイルでは回転しないように調整
            initial={{ scale: 0.9, y: 20, rotate: isRotated && window.innerWidth >= 1024 ? 180 : 0 }}
            animate={{ scale: 1, y: 0, rotate: isRotated && window.innerWidth >= 1024 ? 180 : 0 }}
            exit={{ scale: 0.9, y: 20, rotate: isRotated && window.innerWidth >= 1024 ? 180 : 0 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="bg-[#1a1a1a] border border-red-500/30 p-8 rounded-3xl max-w-md w-full text-center shadow-2xl relative"
            onClick={(e) => e.stopPropagation()}
        >
            <button onClick={onClose} className="absolute top-4 right-4 text-white/50 hover:text-white p-2">
                <X size={24} />
            </button>
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={40} className="text-red-500" />
            </div>
            <h3 className="text-2xl font-display font-bold text-white mb-4">ERROR</h3>
            <p className="text-gray-300 mb-8 text-base font-sans leading-relaxed">{message}</p>
            <button
                onClick={onClose}
                className="w-full py-4 bg-white text-black font-display font-bold rounded-full hover:bg-gray-200 transition-colors tracking-widest"
            >
                CLOSE
            </button>
        </motion.div>
    </motion.div>
);

// 反転通知コンポーネント
const RotationNotice = () => (
    <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="absolute bottom-8 left-0 right-0 z-[200] flex justify-center px-4 pointer-events-none hidden lg:flex" // モバイルでは非表示
    >
        <div className="bg-green-600/90 text-white px-8 py-4 rounded-2xl shadow-[0_0_30px_rgba(22,163,74,0.4)] flex flex-col items-center gap-1 border border-green-400/30 backdrop-blur-md max-w-lg w-full">
            <div className="flex items-center gap-3 mb-1">
                <RotateCw size={24} />
                <h3 className="font-bold text-xl font-display tracking-wider">画面が反転しました</h3>
            </div>
            <p className="text-sm font-mono opacity-90 text-center">これより先はお客様への操作をお願いしてください</p>
        </div>
    </motion.div>
);

// --- メインコンポーネント ---

const Activate = () => {
    const navigate = useNavigate();
    const [status, setStatus] = useState('scanning');
    const [isChecking, setIsChecking] = useState(false); // 確認中フラグ
    const [isActivating, setIsActivating] = useState(false); // アクティベート中フラグ

    // データ管理
    const [cardData, setCardData] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [customerSignatureImg, setCustomerSignatureImg] = useState(null);

    // エラー状態管理
    const [errorModal, setErrorModal] = useState({ show: false, message: '' });

    // 反転通知管理
    const [showRotationNotice, setShowRotationNotice] = useState(false);

    // Ref
    const sigPadCustomer = useRef(null);
    const sigPadEmployee = useRef(null);
    const activateTimer = useRef(null);
    const isProcessing = useRef(false);
    const errorModalRef = useRef(false);

    // アクティベート長押し用
    const [pressProgress, setPressProgress] = useState(0);

    // --- 副作用 ---

    useEffect(() => {
        if (status === 'amount') {
            setShowRotationNotice(true);
            const timer = setTimeout(() => setShowRotationNotice(false), 2000);
            return () => clearTimeout(timer);
        }
    }, [status]);

    // --- ヘルパー関数 ---

    const showError = (message) => {
        setErrorModal({ show: true, message });
        errorModalRef.current = true;
    };

    const closeError = () => {
        setErrorModal({ show: false, message: '' });
        errorModalRef.current = false;
        setTimeout(() => {
            isProcessing.current = false;
        }, 500);
    };

    // エラー表示の向き判定
    const isCustomerView = ['amount', 'pin', 'signature', 'complete'].includes(status);

    const getInvertedSignature = () => {
        if (!sigPadCustomer.current) return null;

        const canvas = sigPadCustomer.current.getCanvas();
        const width = canvas.width;
        const height = canvas.height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const ctx = tempCanvas.getContext('2d');

        if (!ctx) return null;

        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'source-in';
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, width, height);
        ctx.globalCompositeOperation = 'destination-over';
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);

        return tempCanvas.toDataURL();
    };

    // --- Firestore操作 ---

    const verifyCode = async (code) => {
        if (!code) return;

        if (isProcessing.current || errorModalRef.current) return;

        isProcessing.current = true;

        setIsChecking(true);

        let shouldKeepLock = false;

        if (code.startsWith('http')) {
            showError('このQRコードはギフトカードの情報を含んでいません。');
            setIsChecking(false);
            return;
        }

        try {
            // Note: 読み取り処理はパフォーマンスのためクライアントサイドに残していますが
            // セキュリティを最大化するなら、ここもCloud Function化できます。
            const q = query(collection(db, 'cards'), where('publicCode', '==', code), limit(1));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                showError('無効なコードです。システムに登録されていません。');
            } else {
                const docSnapshot = querySnapshot.docs[0];
                const data = docSnapshot.data();

                if (data.status === 'inactive') {
                    setCardData({ id: docSnapshot.id, ...data });
                    setStatus('amount'); // 成功時のみ画面遷移
                    shouldKeepLock = true; // 画面遷移時はロックを維持
                } else {
                    showError(`このカードは既に使用されています。(ステータス: ${data.status})`);
                }
            }
        } catch (error) {
            showError('データベースへの接続が拒否されました。再度お試しください。');
        } finally {
            setIsChecking(false);

            if (!shouldKeepLock && !errorModalRef.current) {
                setTimeout(() => {
                    isProcessing.current = false;
                }, 1000);
            }
        }
    };

    const executeActivation = async () => {
        if (!cardData || !customerSignatureImg) {
            showError("エラー：顧客署名データが見つかりません。最初からやり直してください。");
            return;
        }

        setIsActivating(true);

        try {
            const employeeSignature = sigPadEmployee.current ? sigPadEmployee.current.toDataURL() : null;

            // ★ Cloud Functions 呼び出しへの切り替え ★
            // サーバー側の関数名を指定します (例: 'activatePrepaidCard')
            const activatePrepaidCard = httpsCallable(functions, 'activatePrepaidCard');

            // サーバー関数を実行し、必要なデータを全て渡します
            const result = await activatePrepaidCard({
                docId: cardData.id,               // 対象のドキュメントID
                amount: parseInt(amount, 10),     // チャージ金額
                userPin: pin,                     // 設定されたPIN
                customerSignature: customerSignatureImg, // 顧客署名（画像データ）
                employeeSignature: employeeSignature     // 店員署名（画像データ）
            });

            setStatus('complete');

        } catch (error) {
            // エラーメッセージの表示（サーバーからのメッセージがあればそれを表示）
            showError(error.message || '有効化処理に失敗しました。通信環境を確認してください。');
        } finally {
            setIsActivating(false);
        }
    };

    // --- ハンドラー ---

    const handleScan = (result, error) => {
        if (result && status === 'scanning' && !errorModalRef.current) {
            verifyCode(result?.text);
        }
    };

    const resetScan = () => {
        isProcessing.current = false;
        setStatus('scanning');
        setErrorModal({ show: false, message: '' });
        errorModalRef.current = false;
        setManualCode('');
        setAmount('');
        setPin('');
        setCardData(null);
        setCustomerSignatureImg(null);
        setPressProgress(0);
        setIsChecking(false);
        setIsActivating(false);
    };

    const handleKeyPress = (key) => {
        if (status === 'amount') {
            if (amount.length < 5) setAmount(prev => prev + key);
        } else if (status === 'pin') {
            if (pin.length < 4) setPin(prev => prev + key);
        } else if (status === 'manual') {
            // 【修正】最大12文字まで入力可能にする
            if (manualCode.length < 12) {
                setManualCode(prev => prev + key);
            }
        }
    };

    const handleDelete = () => {
        if (status === 'amount') {
            setAmount(prev => prev.slice(0, -1));
        } else if (status === 'pin') {
            setPin(prev => prev.slice(0, -1));
        } else if (status === 'manual') {
            setManualCode(prev => prev.slice(0, -1));
        }
    };

    const handleEnter = () => {
        if (status === 'amount') submitAmount();
        else if (status === 'pin') submitPin();
        else if (status === 'manual') {
            if (manualCode) verifyCode(manualCode);
        }
    };

    const submitAmount = () => {
        const val = parseInt(amount, 10);
        if (val >= 300 && val <= 10000) {
            setStatus('pin');
        } else {
            showError('金額は ¥300 〜 ¥10,000 の範囲で設定してください。');
            setAmount('');
        }
    };

    const submitPin = () => {
        if (pin.length === 4) {
            setStatus('signature');
        }
    };

    const submitSignature = () => {
        if (sigPadCustomer.current && !sigPadCustomer.current.isEmpty()) {
            const invertedImage = getInvertedSignature();
            setCustomerSignatureImg(invertedImage);
            setStatus('payment');
        } else {
            showError("サインをご記入ください。");
        }
    };

    // --- 長押し処理 ---
    const startPress = (e) => {
        if (sigPadEmployee.current && sigPadEmployee.current.isEmpty()) {
            showError("担当者の確認サインを行ってください。");
            return;
        }

        if (activateTimer.current) {
            clearInterval(activateTimer.current);
        }

        setPressProgress(0);

        activateTimer.current = setInterval(() => {
            setPressProgress(prev => {
                const next = prev + 1;
                if (next >= 100) {
                    clearInterval(activateTimer.current);
                    activateTimer.current = null;
                    executeActivation();
                    return 100;
                }
                return next;
            });
        }, 20);
    };

    const endPress = () => {
        if (status !== 'complete' && !isActivating) {
            if (activateTimer.current) {
                clearInterval(activateTimer.current);
                activateTimer.current = null;
            }
            setPressProgress(0);
        }
    };

    return (
        <div className="flex-1 relative flex flex-col items-center justify-center h-full w-full overflow-hidden rounded-2xl md:rounded-3xl bg-black border border-white/10">

            {/* 戻るボタン */}
            {(status === 'scanning' || status === 'manual') && (
                <Link to="/" className="absolute top-4 left-4 md:top-6 md:left-6 z-50 flex items-center gap-2 text-white/50 hover:text-white transition-colors hover-trigger">
                    <ArrowLeft size={18} className="md:w-5 md:h-5" />
                    <span className="font-mono text-xs tracking-widest">メニューに戻る</span>
                </Link>
            )}

            {/* --- 1. スキャン画面 --- */}
            {status === 'scanning' && (
                <CustomerSplitView
                    key="scanning-view"
                    title="コード読み取り"
                    subtitle="ギフトカードに印刷されている二次元コードを読み取ってください。"
                    stepIndicator={null}
                    rotate={false}
                    leftContent={
                        <div className="w-full flex flex-col gap-4 md:gap-6">
                            <div className="p-4 border border-white/10 rounded-2xl bg-white/5">
                                <p className="text-sm text-gray-400 mb-2">スキャンできない場合</p>
                                <button
                                    onClick={() => setStatus('manual')}
                                    className="w-full py-3 md:py-4 bg-white/10 border border-white/20 rounded-xl text-white font-bold flex items-center justify-center gap-3 hover:bg-white hover:text-black transition-all group"
                                >
                                    <Keyboard size={24} className="group-hover:scale-110 transition-transform" />
                                    <span className="font-display tracking-wider">コードを手入力する</span>
                                </button>
                            </div>
                        </div>
                    }
                    rightContent={
                        <div className="w-full h-full max-h-[50vh] lg:max-h-full relative rounded-2xl overflow-hidden border-2 border-white/10">
                            <QrReader
                                onResult={handleScan}
                                constraints={{ facingMode: 'environment' }}
                                className="w-full h-full object-cover"
                                videoContainerStyle={{ height: '100%', paddingTop: 0 }}
                                videoStyle={{ height: '100%', objectFit: 'cover' }}
                            />
                            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                <div className="w-48 h-48 md:w-64 md:h-64 border-2 border-[#d5b263]/80 rounded-2xl relative">
                                    <motion.div
                                        className="absolute w-full h-[2px] bg-[#ccff00] shadow-[0_0_15px_#ccff00]"
                                        animate={{ top: ['0%', '100%', '0%'] }}
                                        transition={{ duration: 2.5, ease: "linear", repeat: Infinity }}
                                    />
                                </div>
                            </div>
                            <div className="absolute bottom-4 left-0 w-full text-center pointer-events-none">
                                <p className="text-xs font-mono text-white/70 bg-black/50 inline-block px-3 py-1 rounded-full backdrop-blur-sm">
                                    SCANNING...
                                </p>
                            </div>
                        </div>
                    }
                />
            )}

            {/* --- 1.5 手入力画面 --- */}
            {status === 'manual' && (
                <CustomerSplitView
                    key="manual-view"
                    title="コード入力"
                    subtitle="二次元コードの下にあるコードを入力してください。"
                    stepIndicator={null}
                    rotate={false}
                    leftContent={
                        <div className="w-full">
                            <div className="relative group mb-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-[#d5b263] transition-colors" size={20} />
                                <input
                                    type="text"
                                    value={manualCode}
                                    readOnly
                                    placeholder="CODE"
                                    className="w-full bg-black border-2 border-white/20 rounded-2xl p-4 md:p-6 pl-12 text-white font-mono text-xl md:text-3xl focus:border-[#d5b263] focus:outline-none focus:shadow-[0_0_20px_rgba(213,178,99,0.2)] transition-all uppercase placeholder:text-white/10 cursor-default"
                                />
                            </div>
                            <p className="text-right text-xs text-gray-500 mt-2 font-mono mb-4 md:mb-8">
                                {manualCode.length} CHARACTERS
                            </p>

                            <button
                                onClick={() => setStatus('scanning')}
                                className="flex items-center gap-2 text-gray-500 hover:text-white transition-colors"
                                type="button"
                            >
                                <Camera size={16} />
                                <span className="text-sm font-mono">カメラに戻る</span>
                            </button>
                        </div>
                    }
                    rightContent={
                        <FullKeyboard
                            onKeyPress={handleKeyPress}
                            onDelete={handleDelete}
                            onEnter={handleEnter}
                        />
                    }
                />
            )}

            {/* --- 2. 金額入力 --- */}
            {status === 'amount' && (
                <CustomerSplitView
                    key="amount-view"
                    title="チャージ金額を入力"
                    subtitle="¥300〜¥10,000まで選択可能です"
                    stepIndicator={1}
                    leftContent={
                        <div className="text-center w-full">
                            <div className="inline-flex items-baseline gap-2 border-b-4 border-[#d5b263] px-4 py-2 md:px-8 md:py-4">
                                <span className="text-2xl md:text-4xl text-[#d5b263] font-bold">¥</span>
                                <span className="text-6xl md:text-8xl font-display font-bold text-white tracking-tighter">
                                    {amount ? parseInt(amount).toLocaleString() : '0'}
                                </span>
                            </div>
                        </div>
                    }
                    rightContent={
                        <div className="w-full max-w-lg">
                            <VirtualKeyboard
                                onKeyPress={handleKeyPress}
                                onDelete={handleDelete}
                                onEnter={handleEnter}
                            />
                        </div>
                    }
                />
            )}

            {/* --- 3. PIN設定 --- */}
            {status === 'pin' && (
                <CustomerSplitView
                    key="pin-view"
                    title="暗証番号を設定"
                    subtitle="4桁の暗証番号を入力してください"
                    stepIndicator={2}
                    leftContent={
                        <div className="flex justify-center gap-4 md:gap-8">
                            {[0, 1, 2, 3].map((i) => (
                                <div
                                    key={i}
                                    className={`w-6 h-6 md:w-8 md:h-8 rounded-full border-4 border-white/30 transition-all duration-300 ${i < pin.length ? 'bg-[#ccff00] border-[#ccff00] scale-125' : 'bg-transparent'
                                        }`}
                                />
                            ))}
                        </div>
                    }
                    rightContent={
                        <div className="w-full max-w-lg">
                            <VirtualKeyboard
                                onKeyPress={handleKeyPress}
                                onDelete={handleDelete}
                                onEnter={handleEnter}
                            />
                        </div>
                    }
                />
            )}

            {/* --- 4. 顧客サイン --- */}
            {status === 'signature' && (
                <div key="signature-view" className="w-full h-full flex flex-col bg-black relative p-4">
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
                        {/* PC版：回転あり / モバイル版：回転なし、縦配置 */}
                        <div className="lg:rotate-180 text-center space-y-2 md:space-y-4 w-full flex flex-col items-center">
                            <div className="flex justify-center gap-2 mb-2">
                                <div className="h-1 w-8 rounded-full bg-white/20" />
                                <div className="h-1 w-8 rounded-full bg-white/20" />
                                <div className="h-1 w-8 rounded-full bg-[#d5b263]" />
                            </div>
                            <h2 className="text-3xl md:text-5xl font-bold font-sans text-white">サインをご記入ください</h2>
                            <p className="text-gray-400 text-sm md:text-base font-mono">枠内に指でサインを書いてください</p>

                            {/* サインエリアのプレースホルダー（スタイルのみ） */}
                            <div className="w-full max-w-[800px] aspect-[16/9] md:h-[350px] border-2 border-dashed border-white/20 rounded-3xl mt-4 md:mt-8 bg-white/5" />
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center z-10 px-4">
                        <div className="w-full max-w-[800px] aspect-[16/9] md:h-[350px] relative">
                            <SignatureCanvas
                                ref={sigPadCustomer}
                                penColor="white"
                                canvasProps={{ className: 'w-full h-full bg-transparent cursor-crosshair' }}
                                backgroundColor="transparent"
                            />
                        </div>
                    </div>

                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-20">
                        <div className="lg:rotate-180 w-full max-w-[800px] aspect-[16/9] md:h-[350px] flex flex-col justify-end pb-4 px-4">
                            <div className="flex gap-4 pointer-events-auto lg:translate-y-28 translate-y-20">
                                <button
                                    onClick={() => sigPadCustomer.current.clear()}
                                    className="flex-1 py-4 md:py-5 bg-white/10 rounded-2xl text-white font-bold flex items-center justify-center gap-2 hover:bg-white/20 transition-colors hover-trigger"
                                    type="button"
                                >
                                    <Eraser size={24} /> クリア
                                </button>
                                <button
                                    onClick={submitSignature}
                                    className="flex-[2] py-4 md:py-5 bg-[#d5b263] rounded-2xl text-black font-bold flex items-center justify-center gap-2 hover:bg-white transition-colors hover-trigger"
                                    type="button"
                                >
                                    <PenTool size={24} /> 決定
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* --- 5. 支払い確認 --- */}
            {status === 'payment' && (
                <motion.div
                    key="payment-view"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className="w-full h-full flex flex-col"
                >
                    {/* 上半分：お客様向け（PCで反転、モバイルで上部） */}
                    <div className="flex-1 lg:h-1/2 bg-[#111] flex flex-col items-center justify-center lg:rotate-180 border-b border-white/10 p-4 md:p-8 relative min-h-[40vh]">
                        <div className="text-center w-full">
                            <h2 className="text-2xl md:text-4xl font-display font-bold text-white mb-4">
                                ¥{parseInt(amount).toLocaleString()} <span className="text-lg md:text-2xl font-sans font-normal text-gray-400 block md:inline">をお支払いください</span>
                            </h2>
                            <div className="bg-white/5 border border-white/10 rounded-xl p-4 md:p-6 max-w-3xl mx-auto w-full">
                                <p className="text-sm md:text-base text-gray-300 leading-relaxed font-sans">
                                    お客様によるお支払い確認後、職員がアクティベート処理を行います。<br className="hidden md:block" />
                                    しばらくお待ちください。
                                </p>
                                <div className="mt-4 flex justify-center">
                                    <Loader2 size={32} className="text-[#d5b263] animate-spin" />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* 下半分：スタッフ操作 */}
                    <div className="flex-1 lg:h-1/2 bg-black flex flex-col p-4 md:p-6 relative overflow-hidden min-h-[50vh]">
                        <div className="flex justify-between items-end mb-4 px-2">
                            <div className="flex items-center gap-4">
                                <h3 className="text-xs md:text-sm font-mono text-gray-500 tracking-widest">STAFF OPERATION</h3>
                                <button
                                    onClick={() => navigate('/')} // 【修正】ホーム画面に戻る
                                    className="flex items-center gap-1 text-xs bg-red-900/30 text-red-400 px-3 py-1 rounded-full hover:bg-red-500 hover:text-white transition-colors border border-red-500/20"
                                    type="button"
                                >
                                    <XCircle size={12} /> 処理を中止
                                </button>
                            </div>

                            <div className="text-right">
                                <span className="text-xs text-gray-500 mr-2 block md:inline">お支払い金額</span>
                                <span className="text-xl md:text-3xl font-display font-bold text-[#ccff00]">¥{parseInt(amount).toLocaleString()}</span>
                            </div>
                        </div>

                        <div className="flex-1 grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 overflow-y-auto pb-4">

                            {/* Step 1 */}
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 md:p-5 flex md:flex-col items-center md:items-stretch gap-4 md:gap-0 justify-between group hover:border-white/30 transition-colors">
                                <div className="flex-1">
                                    <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-0 md:mb-3 text-sm font-bold shrink-0">1</div>
                                    <h4 className="font-bold text-white mb-1 md:mb-2 flex items-center gap-2"><Banknote size={20} /> <span className="hidden md:inline">現金受取</span><span className="md:hidden">現金</span></h4>
                                    <p className="text-xl md:text-3xl font-display font-bold text-[#ccff00] mb-0 md:mb-2">¥{parseInt(amount).toLocaleString()}</p>
                                    <p className="text-xs text-gray-400 leading-relaxed hidden md:block">現金を受け取り、金額を確認してください。</p>
                                </div>
                                <div className="h-full md:h-1 w-1 md:w-full bg-white/5 rounded-full overflow-hidden shrink-0">
                                    <div className="h-full bg-green-500 w-full opacity-50" />
                                </div>
                            </div>

                            {/* Step 2 */}
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 md:p-5 flex flex-col justify-between relative overflow-hidden min-h-[150px]">
                                <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                                <div className="relative z-10 flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="w-8 h-8 rounded-full bg-white/10 flex items-center justify-center mb-2 text-sm font-bold">2</div>
                                            <h4 className="font-bold text-white flex items-center gap-2"><PenTool size={20} /> 確認サイン</h4>
                                        </div>
                                        <button onClick={() => sigPadEmployee.current.clear()} className="text-gray-500 hover:text-white p-2" type="button"><RotateCcw size={16} /></button>
                                    </div>
                                    <p className="text-xs text-gray-400 mb-2 hidden md:block">あなたのサインを行ってください。</p>
                                    <div className="flex-1 bg-white rounded-lg overflow-hidden border border-white/20 min-h-[80px]">
                                        <SignatureCanvas
                                            ref={sigPadEmployee}
                                            penColor="black"
                                            canvasProps={{ className: 'w-full h-full bg-white cursor-crosshair' }}
                                            backgroundColor="white"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Step 3 */}
                            <div className="bg-[#1a1a1a] border border-white/10 rounded-2xl p-4 md:p-5 flex md:flex-col items-center md:items-stretch gap-4 md:gap-0 justify-between">
                                <div className="flex-1">
                                    <div className="w-8 h-8 rounded-full bg-[#d5b263] text-black flex items-center justify-center mb-0 md:mb-3 text-sm font-bold shrink-0">3</div>
                                    <h4 className="font-bold text-white mb-1 md:mb-2 flex items-center gap-2"><Send size={20} /> 送信</h4>
                                    <p className="text-sm text-gray-400 hidden md:block">2秒長押しで送信してください。</p>
                                </div>

                                <button
                                    onMouseDown={startPress}
                                    onMouseUp={endPress}
                                    onMouseLeave={endPress}
                                    onTouchStart={startPress}
                                    onTouchEnd={endPress}
                                    onContextMenu={(e) => e.preventDefault()}
                                    className="relative w-full md:w-auto flex-1 md:flex-none h-14 md:h-16 group mt-0 md:mt-2 select-none"
                                    type="button"
                                >
                                    <div className="absolute inset-0 bg-[#d5b263] rounded-xl blur opacity-20 group-hover:opacity-40 transition-opacity" />
                                    <div className="relative bg-[#0a0a0a] border border-[#d5b263] rounded-xl h-full flex items-center justify-center overflow-hidden">
                                        <motion.div
                                            className="absolute left-0 top-0 h-full bg-[#d5b263]"
                                            style={{ width: `${pressProgress}%` }}
                                        />
                                        <span className="relative z-10 font-bold font-display tracking-widest text-white flex items-center gap-2 mix-blend-difference text-lg">
                                            <Zap size={20} /> <span className="hidden md:inline">ACTIVATE</span><span className="md:hidden">実行</span>
                                        </span>
                                    </div>
                                </button>
                            </div>

                        </div>
                    </div>
                </motion.div>
            )}

            {/* --- 6. 完了画面 --- */}
            {status === 'complete' && (
                <motion.div
                    key="complete-view"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="w-full h-full flex flex-col"
                >
                    {/* 上半分：お客様用（PCで反転） */}
                    <div className="flex-1 lg:h-1/2 bg-[#111] flex flex-col items-center justify-center lg:rotate-180 border-b border-white/10 p-4 md:p-8 relative">
                        <div className="text-center w-full max-w-3xl">
                            <div className="w-16 h-16 md:w-24 md:h-24 bg-[#ccff00] rounded-full flex items-center justify-center mx-auto mb-4 md:mb-6 shadow-[0_0_40px_rgba(204,255,0,0.3)]">
                                <Check size={32} className="text-black md:w-12 md:h-12" />
                            </div>
                            <h2 className="text-2xl md:text-4xl font-display font-bold text-white mb-4 md:mb-6">アクティベートが完了しました！</h2>
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 md:p-8">
                                <p className="text-sm md:text-lg text-gray-200 leading-loose font-sans whitespace-pre-wrap">
                                    ご利用ありがとうございました。<br />
                                    <span className="text-[#ccff00] font-bold">my.mansuke.jp/redeem</span> にアクセスし、<br />
                                    PINコードと暗証番号で残高を追加してください。
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* 下半分：店員用 */}
                    <div className="flex-1 lg:h-1/2 bg-black flex flex-col items-center justify-center p-8 relative overflow-hidden">
                        <button
                            onClick={() => navigate('/')} // 【修正】ホーム画面に戻る
                            className="px-8 md:px-16 py-4 md:py-6 border border-white/20 bg-white/5 rounded-full font-display font-bold text-lg md:text-xl tracking-widest hover:bg-white hover:text-black transition-colors hover-trigger flex items-center gap-3"
                        >
                            <Home size={24} /> ホームに戻る
                        </button>
                    </div>
                </motion.div>
            )}

            {/* --- ローディング (修正：フラグで表示制御) --- */}
            {(isChecking || isActivating) && (
                <div className="absolute inset-0 z-50 bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center">
                    <Loader2 size={64} className="text-[#d5b263] animate-spin mb-4" />
                    <p className="font-mono text-sm tracking-widest text-[#d5b263]">
                        {isChecking ? 'コードを確認中...' : '有効化処理中...'}
                    </p>
                </div>
            )}

            {/* --- エラーモーダル --- */}
            <AnimatePresence>
                {errorModal.show && (
                    <ErrorModal
                        message={errorModal.message}
                        onClose={closeError}
                        isRotated={isCustomerView}
                    />
                )}
            </AnimatePresence>

            {/* --- 反転通知 --- */}
            <AnimatePresence>
                {showRotationNotice && <RotationNotice />}
            </AnimatePresence>

        </div>
    );
};

export default Activate;