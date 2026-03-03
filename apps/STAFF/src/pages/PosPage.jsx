import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { QrReader } from 'react-qr-reader';
import SignatureCanvas from 'react-signature-canvas';
import { db, functions, callFunction } from '../firebase';
import { httpsCallable } from 'firebase/functions';
import {
    AlertTriangle, Keyboard, Loader2, Camera, Eraser, Check,
    Zap, PenTool, Banknote, Send, RotateCcw, XCircle, Search, Delete, X, RotateCw, Home, CreditCard,
} from 'lucide-react';
import VirtualKeyboard from '../components/keyboard/VirtualKeyboard';

/* ── Full Keyboard for manual code entry ─────────────────── */
const FullKeyboard = ({ onKeyPress, onDelete, onEnter }) => {
    const rows = [
        ['1','2','3','4','5','6','7','8','9','0'],
        ['Q','W','E','R','T','Y','U','I','O','P'],
        ['A','S','D','F','G','H','J','K','L'],
        ['Z','X','C','V','B','N','M']
    ];
    return (
        <div style={{ width: '100%', maxWidth: 660, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            {rows.map((row, ri) => (
                <div key={ri} style={{ display: 'flex', justifyContent: 'center', gap: 4 }}>
                    {row.map(key => (
                        <button key={key} onClick={() => onKeyPress(key)} type="button" style={{
                            flex: '1', maxWidth: 56, height: 48, background: 'var(--surface)',
                            border: '1.5px solid var(--border)', borderRadius: 10,
                            color: 'var(--ink)', fontWeight: 700, fontSize: 16, cursor: 'pointer',
                            transition: 'all 0.15s', fontFamily: 'var(--font-d)', userSelect: 'none',
                        }}
                        onMouseEnter={e => { e.currentTarget.style.background = 'var(--surface-2)'; e.currentTarget.style.borderColor = 'var(--gold)'; }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'var(--surface)'; e.currentTarget.style.borderColor = 'var(--border)'; }}
                        >{key}</button>
                    ))}
                </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginTop: 8 }}>
                <button onClick={onDelete} type="button" style={{
                    flex: 1, maxWidth: 140, height: 48, background: 'var(--red-bg)',
                    border: '1.5px solid var(--red-border)', borderRadius: 10,
                    color: 'var(--red)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                    cursor: 'pointer', fontFamily: 'var(--font-d)',
                }}><Delete size={16} /> DELETE</button>
                <button onClick={onEnter} type="button" style={{
                    flex: 2, maxWidth: 400, height: 48, background: 'var(--gold)',
                    border: 'none', borderRadius: 10,
                    color: '#fff', fontSize: 16, fontWeight: 700, letterSpacing: '0.1em',
                    cursor: 'pointer', fontFamily: 'var(--font-d)',
                }}>ENTER</button>
            </div>
        </div>
    );
};

/* ── Light-theme split view (staff-facing) ──────────────── */
const StaffSplitView = ({ title, subtitle, leftContent, rightContent }) => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
        style={{ width: '100%', height: '100%', display: 'flex', background: 'var(--bg)', borderRadius: 20, overflow: 'hidden', border: '1px solid var(--border)' }}>
        <div style={{ width: '40%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 40, borderRight: '1px solid var(--border)', background: 'var(--surface)' }}>
            <div style={{ marginBottom: 32 }}>
                <h2 style={{ fontSize: 28, fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--ink)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12, lineHeight: 1.2 }}>{title}</h2>
                {subtitle && <p style={{ color: 'var(--text-2)', fontSize: 'var(--sm)', lineHeight: 1.8 }}>{subtitle}</p>}
            </div>
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: 80 }}>
                {leftContent}
            </div>
        </div>
        <div style={{ width: '60%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, background: 'var(--bg)' }}>
            {rightContent}
        </div>
    </motion.div>
);

/* ── Dark customer-facing split view (rotated) ──────────── */
const CustomerSplitView = ({ title, subtitle, stepIndicator, leftContent, rightContent }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#000', padding: 16 }}>
        <div style={{
            width: '100%', height: '100%', maxWidth: 1400, display: 'flex', flexDirection: 'row',
            transform: 'rotate(180deg)',
            border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, overflow: 'hidden', background: '#0a0a0a'
        }}>
            <div style={{ width: '40%', display: 'flex', flexDirection: 'column', justifyContent: 'center', padding: 32, borderLeft: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ marginBottom: 32 }}>
                    {stepIndicator && (
                        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
                            {[1,2,3].map(i => (
                                <div key={i} style={{ height: 4, width: 48, borderRadius: 4, background: i === stepIndicator ? '#d4af37' : 'rgba(255,255,255,0.2)' }} />
                            ))}
                        </div>
                    )}
                    <h2 style={{ fontSize: 40, fontWeight: 700, fontFamily: "'Inter', sans-serif", color: 'white', marginBottom: 16, lineHeight: 1.1 }}>{title}</h2>
                    {subtitle && <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: 'monospace', lineHeight: 1.6 }}>{subtitle}</p>}
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', width: '100%', minHeight: 100 }}>
                    {leftContent}
                </div>
            </div>
            <div style={{ width: '60%', flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', padding: 32, background: '#000' }}>
                {rightContent}
            </div>
        </div>
    </motion.div>
);

/* ── Error modal ─────────────────────────────────────────── */
const ErrorModal = ({ message, onClose, isCustomerView }) => (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        style={{ position: 'absolute', inset: 0, zIndex: 100, background: isCustomerView ? 'rgba(0,0,0,0.8)' : 'rgba(15,23,42,0.5)', backdropFilter: 'blur(8px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}
        onClick={onClose}>
        <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }}
            style={{
                background: isCustomerView ? '#1a1a1a' : 'var(--surface)',
                border: isCustomerView ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--red-border)',
                padding: 32, borderRadius: 24, maxWidth: 420, width: '100%', textAlign: 'center', position: 'relative',
                boxShadow: 'var(--shadow-lg)',
            }}
            onClick={e => e.stopPropagation()}>
            <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer' }}><X size={24} /></button>
            <div style={{ width: 72, height: 72, background: 'var(--red-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                <AlertTriangle size={36} color="var(--red)" />
            </div>
            <h3 style={{ fontSize: 'var(--lg)', fontFamily: 'var(--font-d)', fontWeight: 800, color: isCustomerView ? 'white' : 'var(--ink)', marginBottom: 12, textTransform: 'uppercase' }}>エラー</h3>
            <p style={{ color: isCustomerView ? '#d1d5db' : 'var(--text-2)', marginBottom: 28, fontSize: 'var(--base)', lineHeight: 1.6 }}>{message}</p>
            <button onClick={onClose} style={{
                width: '100%', padding: 14, background: 'var(--ink)', color: '#fff',
                fontFamily: 'var(--font-d)', fontWeight: 700, borderRadius: 12, border: 'none', cursor: 'pointer', letterSpacing: '0.1em', fontSize: 'var(--sm)', textTransform: 'uppercase',
            }}>閉じる</button>
        </motion.div>
    </motion.div>
);

/* ═════════════════════════════════════════════════════════════
   MAIN POS PAGE
   ═════════════════════════════════════════════════════════════ */
const PosPage = () => {
    const [status, setStatus] = useState('ready');
    const [isChecking, setIsChecking] = useState(false);
    const [isActivating, setIsActivating] = useState(false);
    const [cardData, setCardData] = useState(null);
    const [manualCode, setManualCode] = useState('');
    const [amount, setAmount] = useState('');
    const [pin, setPin] = useState('');
    const [customerSignatureImg, setCustomerSignatureImg] = useState(null);
    const [errorModal, setErrorModal] = useState({ show: false, message: '' });
    const [showRotationNotice, setShowRotationNotice] = useState(false);
    const sigPadCustomer = useRef(null);
    const sigPadEmployee = useRef(null);
    const activateTimer = useRef(null);
    const isProcessing = useRef(false);
    const errorModalRef = useRef(false);
    const [pressProgress, setPressProgress] = useState(0);

    useEffect(() => {
        if (status === 'amount') {
            setShowRotationNotice(true);
            const timer = setTimeout(() => setShowRotationNotice(false), 2500);
            return () => clearTimeout(timer);
        }
    }, [status]);

    const showError = (msg) => { setErrorModal({ show: true, message: msg }); errorModalRef.current = true; };
    const closeError = () => { setErrorModal({ show: false, message: '' }); errorModalRef.current = false; setTimeout(() => { isProcessing.current = false; }, 500); };
    const isCustomerView = ['amount', 'confirm_amount', 'pin', 'signature', 'complete'].includes(status);
    const isCameraActive = status === 'scanning';

    const getInvertedSignature = () => {
        if (!sigPadCustomer.current) return null;
        const canvas = sigPadCustomer.current.getCanvas();
        const temp = document.createElement('canvas');
        temp.width = canvas.width; temp.height = canvas.height;
        const ctx = temp.getContext('2d');
        if (!ctx) return null;
        ctx.drawImage(canvas, 0, 0);
        ctx.globalCompositeOperation = 'source-in'; ctx.fillStyle = '#000'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
        return temp.toDataURL();
    };

    const verifyCode = async (code) => {
        if (!code || isProcessing.current || errorModalRef.current) return;
        isProcessing.current = true; setIsChecking(true);
        let keep = false;
        let searchCode = code;
        if (code.startsWith('http')) {
            try {
                const url = new URL(code);
                const publicCodeParam = url.searchParams.get('publicCode');
                if (publicCodeParam) {
                    searchCode = publicCodeParam;
                } else {
                    showError('このQRコードはギフトカードの情報を含んでいません。');
                    setIsChecking(false);
                    return;
                }
            } catch (e) {
                showError('無効なQRコード形式です。');
                setIsChecking(false);
                return;
            }
        }
        try {
            const fn = callFunction('staffVerifyPrepaidCardCode');
            const result = await fn({ code: searchCode });
            setCardData(result.data);
            setStatus('amount');
            keep = true;
        } catch (error) {
            showError(error.message || 'データベースへの接続が拒否されました。再度お試しください。');
        }
        finally { setIsChecking(false); if (!keep && !errorModalRef.current) setTimeout(() => { isProcessing.current = false; }, 1000); }
    };

    const executeActivation = async () => {
        if (!cardData || !customerSignatureImg) { showError("エラー：顧客署名データが見つかりません。"); return; }
        setIsActivating(true);
        try {
            const employeeSig = sigPadEmployee.current ? sigPadEmployee.current.toDataURL() : null;
            const fn = httpsCallable(functions, 'activatePrepaidCard');
            await fn({ docId: cardData.id, amount: parseInt(amount, 10), userPin: pin, customerSignature: customerSignatureImg, employeeSignature: employeeSig });
            setStatus('complete');
        } catch (error) { showError(error.message || '有効化処理に失敗しました。'); }
        finally { setIsActivating(false); }
    };

    const handleScan = (result) => { if (result && status === 'scanning' && !errorModalRef.current) verifyCode(result?.text); };
    const handleKeyPress = (key) => {
        if (status === 'amount') { if (amount.length < 5) setAmount(p => p + key); }
        else if (status === 'pin') { if (pin.length < 4) setPin(p => p + key); }
        else if (status === 'manual') { if (manualCode.length < 12) setManualCode(p => p + key); }
    };
    const handleDelete = () => {
        if (status === 'amount') setAmount(p => p.slice(0, -1));
        else if (status === 'pin') setPin(p => p.slice(0, -1));
        else if (status === 'manual') setManualCode(p => p.slice(0, -1));
    };
    const handleEnter = () => {
        if (status === 'amount') submitAmount();
        else if (status === 'pin') submitPin();
        else if (status === 'manual' && manualCode) verifyCode(manualCode);
    };
    const submitAmount = () => {
        const v = parseInt(amount, 10);
        if (v >= 300 && v <= 10000) setStatus('confirm_amount');
        else { showError('金額は ¥300 〜 ¥10,000 の範囲で設定してください。'); setAmount(''); }
    };
    const confirmAmount = () => setStatus('pin');
    const submitPin = () => { if (pin.length === 4) setStatus('signature'); };
    const submitSignature = () => {
        if (sigPadCustomer.current && !sigPadCustomer.current.isEmpty()) { setCustomerSignatureImg(getInvertedSignature()); setStatus('payment'); }
        else showError("サインをご記入ください。");
    };
    const startPress = () => {
        if (sigPadEmployee.current && sigPadEmployee.current.isEmpty()) { showError("担当者の確認サインを行ってください。"); return; }
        if (activateTimer.current) clearInterval(activateTimer.current);
        setPressProgress(0);
        activateTimer.current = setInterval(() => {
            setPressProgress(prev => {
                const next = prev + 1;
                if (next >= 100) { clearInterval(activateTimer.current); activateTimer.current = null; executeActivation(); return 100; }
                return next;
            });
        }, 20);
    };
    const endPress = () => {
        if (status !== 'complete' && !isActivating) {
            if (activateTimer.current) { clearInterval(activateTimer.current); activateTimer.current = null; }
            setPressProgress(0);
        }
    };
    const resetToHome = () => {
        setStatus('ready'); setCardData(null); setManualCode(''); setAmount(''); setPin('');
        setCustomerSignatureImg(null); setPressProgress(0);
    };

    /* ── Container wrapping the whole POS ─────────────────── */
    const containerStyle = {
        position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        overflow: 'hidden',
        background: isCustomerView ? '#000' : 'var(--bg)',
        transition: 'background 0.3s',
    };

    return (
        <div className="page-enter" style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, padding: 0 }}>
            <div style={containerStyle}>

                {/* ─── 0. OPENING / READY SCREEN ──────────────────── */}
                {status === 'ready' && (
                    <motion.div key="ready" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                        style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: 48 }}>
                        <div style={{ marginBottom: 40 }}>
                            <div style={{
                                width: 80, height: 80, borderRadius: 24, margin: '0 auto 24px',
                                background: 'linear-gradient(135deg, var(--gold), #f5d77a)', boxShadow: '0 8px 32px rgba(212,175,55,0.25)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                            }}>
                                <CreditCard size={36} color="#fff" />
                            </div>
                            <h1 style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--xxl)', fontWeight: 800, color: 'var(--ink)', marginBottom: 12, letterSpacing: '0.05em' }}>PREPAID CARD</h1>
                            <p style={{ color: 'var(--text-2)', fontSize: 'var(--md)', lineHeight: 1.8 }}>
                                プリペイドカードのアクティベート処理を行います。<br/>
                                開始ボタンを押してカメラを起動してください。
                            </p>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 360 }}>
                            <button onClick={() => setStatus('scanning')} className="btn btn-gold" style={{ padding: '18px 48px', fontSize: 'var(--md)' }}>
                                <Camera size={20} /> カメラで読み取る
                            </button>
                            <button onClick={() => setStatus('manual')} className="btn btn-secondary" style={{ padding: '14px 48px' }}>
                                <Keyboard size={18} /> コードを手入力する
                            </button>
                        </div>
                    </motion.div>
                )}

                {/* ─── 1. SCANNING (Staff-facing, light theme) ──────── */}
                {status === 'scanning' && (
                    <StaffSplitView key="scanning"
                        title="コード読み取り"
                        subtitle="ギフトカードに印刷されている二次元コードをカメラで読み取ってください。"
                        leftContent={
                            <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 24 }}>
                                <div style={{ background: 'var(--surface-2)', padding: 20, borderRadius: 'var(--radius-sm)', border: '1px solid var(--border)' }}>
                                    <p style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginBottom: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>スキャンできない場合</p>
                                    <button onClick={() => setStatus('manual')} style={{
                                        width: '100%', padding: 16, background: 'var(--surface)', border: '1.5px solid var(--border)',
                                        borderRadius: 'var(--radius-sm)', color: 'var(--ink)', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12,
                                        cursor: 'pointer', fontFamily: 'var(--font-d)', letterSpacing: '0.05em', fontSize: 'var(--sm)', transition: 'all 0.2s',
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--gold)'; }}
                                    onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; }}
                                    ><Keyboard size={20} /> コードを手入力する</button>
                                </div>
                            </div>
                        }
                        rightContent={
                            <div style={{ width: '100%', height: '100%', maxHeight: '100%', position: 'relative', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '2px solid var(--border)', background: '#000' }}>
                                {isCameraActive && (
                                    <QrReader onResult={handleScan} constraints={{ facingMode: 'environment' }}
                                        containerStyle={{ height: '100%', paddingTop: 0 }} videoStyle={{ height: '100%', objectFit: 'cover' }} />
                                )}
                                <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                                    <div style={{ width: 200, height: 200, border: '2px solid var(--gold)', borderRadius: 16, position: 'relative', overflow: 'hidden' }}>
                                        <motion.div style={{ position: 'absolute', width: '100%', height: 2, background: 'var(--gold)', boxShadow: '0 0 12px var(--gold)' }}
                                            animate={{ top: ['0%', '100%', '0%'] }} transition={{ duration: 2.5, ease: 'linear', repeat: Infinity }} />
                                    </div>
                                </div>
                                <div style={{ position: 'absolute', bottom: 16, left: 0, width: '100%', textAlign: 'center', pointerEvents: 'none' }}>
                                    <p style={{ fontSize: 'var(--xs)', fontFamily: 'var(--font-d)', color: 'var(--gold)', background: 'rgba(0,0,0,0.7)', display: 'inline-block', padding: '6px 16px', borderRadius: 99, letterSpacing: '0.15em', fontWeight: 700 }}>SCANNING...</p>
                                </div>
                            </div>
                        }
                    />
                )}

                {/* ─── 1.5 MANUAL INPUT (Staff-facing, light) ────────── */}
                {status === 'manual' && (
                    <StaffSplitView key="manual"
                        title="コード入力"
                        subtitle="二次元コードの下にあるコードを手動で入力してください。"
                        leftContent={
                            <div style={{ width: '100%' }}>
                                <div style={{ position: 'relative', marginBottom: 12 }}>
                                    <Search style={{ position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-3)' }} size={20} />
                                    <input type="text" value={manualCode} readOnly placeholder="CODE"
                                        style={{
                                            width: '100%', background: 'var(--surface)', border: '2px solid var(--border)', borderRadius: 'var(--radius-sm)',
                                            padding: '20px 20px 20px 48px', color: 'var(--ink)', fontFamily: 'var(--font-d)', fontSize: 28, outline: 'none', textTransform: 'uppercase', letterSpacing: '0.05em',
                                        }} />
                                </div>
                                <p style={{ textAlign: 'right', fontSize: 'var(--xs)', color: 'var(--text-3)', fontFamily: 'var(--font-d)', marginBottom: 16, letterSpacing: '0.05em' }}>{manualCode.length} CHARACTERS</p>
                                <button onClick={() => setStatus('scanning')} style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontSize: 'var(--sm)', fontWeight: 600 }}>
                                    <Camera size={16} /> カメラに戻る
                                </button>
                            </div>
                        }
                        rightContent={<FullKeyboard onKeyPress={handleKeyPress} onDelete={handleDelete} onEnter={handleEnter} />}
                    />
                )}

                {/* ─── 2. AMOUNT (Customer-facing, dark, rotated) ───── */}
                {status === 'amount' && (
                    <CustomerSplitView key="amount" title="チャージ金額を入力" subtitle="¥300〜¥10,000まで選択可能です" stepIndicator={1}
                        leftContent={
                            <div style={{ textAlign: 'center', width: '100%' }}>
                                <div style={{ display: 'inline-flex', alignItems: 'baseline', gap: 8, borderBottom: '4px solid #d4af37', padding: '8px 32px' }}>
                                    <span style={{ fontSize: 36, color: '#d4af37', fontWeight: 700 }}>¥</span>
                                    <span style={{ fontSize: 80, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: 'white', letterSpacing: '-0.02em' }}>
                                        {amount ? parseInt(amount).toLocaleString() : '0'}
                                    </span>
                                </div>
                            </div>
                        }
                        rightContent={<div style={{ width: '100%', maxWidth: 400 }}><VirtualKeyboard onKeyPress={handleKeyPress} onDelete={handleDelete} onEnter={handleEnter} /></div>}
                    />
                )}

                {/* ─── 2.5 AMOUNT CONFIRMATION (Customer-facing, dark, rotated) ───── */}
                {status === 'confirm_amount' && (
                    <motion.div key="confirm_amount" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', position: 'relative', padding: 16 }}>
                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(180deg)' }}>
                            <div style={{ textAlign: 'center', maxWidth: 640 }}>
                                <h2 style={{ fontSize: 40, fontWeight: 700, color: 'white', marginBottom: 32 }}>チャージ金額の確認</h2>
                                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 24, padding: '32px 48px', marginBottom: 32 }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, fontSize: 24, color: '#d1d5db' }}>
                                        <span>チャージ金額</span>
                                        <span style={{ fontFamily: "'Oswald', sans-serif" }}>¥{parseInt(amount).toLocaleString()}</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 24, borderBottom: '1px solid rgba(255,255,255,0.2)', marginBottom: 24, fontSize: 24, color: '#d1d5db' }}>
                                        <span>発行手数料</span>
                                        <span style={{ fontFamily: "'Oswald', sans-serif" }}>¥100</span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 36, fontWeight: 700, color: '#d4af37' }}>
                                        <span>お支払い合計</span>
                                        <span style={{ fontFamily: "'Oswald', sans-serif" }}>¥{(parseInt(amount) + 100).toLocaleString()}</span>
                                    </div>
                                    <p style={{ marginTop: 24, fontSize: 16, color: '#9ca3af', lineHeight: 1.6 }}>お支払い金額には、チャージ金額に加えて<br/>カード発行手数料の100円が含まれます。</p>
                                </div>
                                <div style={{ display: 'flex', gap: 16 }}>
                                    <button onClick={() => setStatus('amount')} type="button" style={{ flex: 1, padding: 24, borderRadius: 16, border: '2px solid rgba(255,255,255,0.2)', background: 'transparent', color: 'white', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>修正する</button>
                                    <button onClick={confirmAmount} type="button" style={{ flex: 2, padding: 24, borderRadius: 16, border: 'none', background: '#d4af37', color: '#000', fontSize: 20, fontWeight: 700, cursor: 'pointer' }}>同意して次へ</button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ─── 3. PIN (Customer-facing, dark, rotated) ──────── */}
                {status === 'pin' && (
                    <CustomerSplitView key="pin" title="暗証番号を設定" subtitle="4桁の暗証番号を入力してください" stepIndicator={2}
                        leftContent={
                            <div style={{ display: 'flex', justifyContent: 'center', gap: 32 }}>
                                {[0,1,2,3].map(i => (
                                    <div key={i} style={{
                                        width: 32, height: 32, borderRadius: '50%', border: '4px solid rgba(255,255,255,0.3)',
                                        transition: 'all 0.3s', background: i < pin.length ? '#ccff00' : 'transparent',
                                        borderColor: i < pin.length ? '#ccff00' : 'rgba(255,255,255,0.3)',
                                        transform: i < pin.length ? 'scale(1.25)' : 'scale(1)',
                                    }} />
                                ))}
                            </div>
                        }
                        rightContent={<div style={{ width: '100%', maxWidth: 400 }}><VirtualKeyboard onKeyPress={handleKeyPress} onDelete={handleDelete} onEnter={handleEnter} /></div>}
                    />
                )}

                {/* ─── 4. SIGNATURE (Customer-facing, dark, rotated) ── */}
                {status === 'signature' && (
                    <div key="signature" style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', background: '#000', position: 'relative', padding: 16 }}>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 0 }}>
                            <div style={{ transform: 'rotate(180deg)', textAlign: 'center', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                                <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 8 }}>
                                    {[1,2,3].map(i => <div key={i} style={{ height: 4, width: 32, borderRadius: 4, background: i === 3 ? '#d4af37' : 'rgba(255,255,255,0.2)' }} />)}
                                </div>
                                <h2 style={{ fontSize: 40, fontWeight: 700, color: 'white', marginBottom: 8 }}>サインをご記入ください</h2>
                                <p style={{ color: '#9ca3af', fontSize: 14, fontFamily: 'monospace' }}>枠内に指でサインを書いてください</p>
                                <div style={{ width: '100%', maxWidth: 800, aspectRatio: '16/9', border: '2px dashed rgba(255,255,255,0.2)', borderRadius: 24, marginTop: 32, background: 'rgba(255,255,255,0.03)' }} />
                            </div>
                        </div>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, padding: 16 }}>
                            <div style={{ width: '100%', maxWidth: 800, aspectRatio: '16/9' }}>
                                <SignatureCanvas ref={sigPadCustomer} penColor="white" canvasProps={{ style: { width: '100%', height: '100%', background: 'transparent', cursor: 'crosshair' } }} backgroundColor="transparent" />
                            </div>
                        </div>
                        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }}>
                            <div style={{ transform: 'rotate(180deg)', width: '100%', maxWidth: 800, aspectRatio: '16/9', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', padding: '0 16px 16px' }}>
                                <div style={{ display: 'flex', gap: 16, pointerEvents: 'auto', transform: 'translateY(80px)' }}>
                                    <button onClick={() => sigPadCustomer.current.clear()} type="button" style={{ flex: 1, padding: 20, background: 'rgba(255,255,255,0.1)', borderRadius: 16, color: 'white', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', fontSize: 16 }}>
                                        <Eraser size={24} /> クリア
                                    </button>
                                    <button onClick={submitSignature} type="button" style={{ flex: 2, padding: 20, background: '#d4af37', borderRadius: 16, color: '#000', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, border: 'none', cursor: 'pointer', fontSize: 16 }}>
                                        <PenTool size={24} /> 決定
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* ─── 5. PAYMENT CONFIRMATION (split: customer top / staff bottom) ─── */}
                {status === 'payment' && (
                    <motion.div key="payment" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Customer-facing (rotated) */}
                        <div style={{ flex: 1, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(180deg)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: 32 }}>
                            <div style={{ textAlign: 'center', width: '100%' }}>
                                <h2 style={{ fontSize: 40, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: 'white', marginBottom: 12 }}>
                                    ¥{(parseInt(amount) + 100).toLocaleString()} <span style={{ fontSize: 20, fontWeight: 400, color: '#9ca3af' }}>をお支払いください</span>
                                </h2>
                                <div style={{ fontSize: 16, color: '#d1d5db', marginBottom: 24, fontFamily: "'Inter', sans-serif" }}>
                                    (チャージ金額: ¥{parseInt(amount).toLocaleString()} + 発行手数料: ¥100)
                                </div>
                                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12, padding: 24, maxWidth: 600, margin: '0 auto' }}>
                                    <p style={{ fontSize: 14, color: '#d1d5db', lineHeight: 1.8 }}>お客様によるお支払い確認後、職員がアクティベート処理を行います。<br />しばらくお待ちください。</p>
                                    <div style={{ marginTop: 16, display: 'flex', justifyContent: 'center' }}><Loader2 size={32} color="#d4af37" style={{ animation: 'spin 1s linear infinite' }} /></div>
                                </div>
                            </div>
                        </div>
                        {/* Staff-facing (light theme) */}
                        <div style={{ flex: 1, background: 'var(--surface)', display: 'flex', flexDirection: 'column', padding: 24, overflow: 'hidden', borderTop: '3px solid var(--gold)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, padding: '0 8px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                                    <h3 style={{ fontSize: 'var(--xs)', fontFamily: 'var(--font-d)', color: 'var(--text-3)', letterSpacing: '0.15em', fontWeight: 700, textTransform: 'uppercase' }}>STAFF OPERATION</h3>
                                    <button onClick={resetToHome} type="button" style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 'var(--xs)', background: 'var(--red-bg)', color: 'var(--red)', padding: '6px 14px', borderRadius: 99, border: '1px solid var(--red-border)', cursor: 'pointer', fontWeight: 700 }}>
                                        <XCircle size={12} /> 処理を中止
                                    </button>
                                </div>
                                <div style={{ textAlign: 'right' }}>
                                    <span style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginRight: 8, fontWeight: 600 }}>お支払い金額</span>
                                    <span style={{ fontSize: 28, fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--green)' }}>¥{(parseInt(amount) + 100).toLocaleString()}</span>
                                    <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginTop: 4 }}>(チャージ: ¥{parseInt(amount).toLocaleString()} + 手数料: ¥100)</div>
                                </div>
                            </div>
                            <div style={{ flex: 1, display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 20, overflow: 'auto', paddingBottom: 8 }}>
                                {/* Step 1: Cash */}
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-d)' }}>1</div>
                                        <h4 style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sm)' }}><Banknote size={18} /> 現金受取</h4>
                                        <p style={{ fontSize: 28, fontFamily: 'var(--font-d)', fontWeight: 800, color: 'var(--green)', marginBottom: 4 }}>¥{(parseInt(amount) + 100).toLocaleString()}</p>
                                        <p style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', lineHeight: 1.6 }}>現金を受け取り、金額を確認してください。<br/>(チャージ+手数料100円)</p>
                                    </div>
                                </div>
                                {/* Step 2: Employee signature */}
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                                        <div>
                                            <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--surface)', border: '2px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 8, fontSize: 14, fontWeight: 800, color: 'var(--ink)', fontFamily: 'var(--font-d)' }}>2</div>
                                            <h4 style={{ fontWeight: 700, color: 'var(--ink)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sm)' }}><PenTool size={18} /> 確認サイン</h4>
                                        </div>
                                        <button onClick={() => sigPadEmployee.current?.clear()} type="button" style={{ color: 'var(--text-3)', padding: 8, background: 'none', border: 'none', cursor: 'pointer' }}><RotateCcw size={14} /></button>
                                    </div>
                                    <p style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginBottom: 8 }}>あなたのサインを行ってください。</p>
                                    <div style={{ flex: 1, background: 'white', borderRadius: 8, overflow: 'hidden', border: '1.5px solid var(--border)', minHeight: 80 }}>
                                        <SignatureCanvas ref={sigPadEmployee} penColor="black" canvasProps={{ style: { width: '100%', height: '100%', background: 'white', cursor: 'crosshair' } }} backgroundColor="white" />
                                    </div>
                                </div>
                                {/* Step 3: Activate */}
                                <div style={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)', padding: 20, display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                                    <div>
                                        <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--gold)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12, fontSize: 14, fontWeight: 800, fontFamily: 'var(--font-d)' }}>3</div>
                                        <h4 style={{ fontWeight: 700, color: 'var(--ink)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sm)' }}><Send size={18} /> 送信</h4>
                                        <p style={{ fontSize: 'var(--xs)', color: 'var(--text-3)' }}>2秒長押しで送信してください。</p>
                                    </div>
                                    <button onMouseDown={startPress} onMouseUp={endPress} onMouseLeave={endPress} onTouchStart={startPress} onTouchEnd={endPress} onContextMenu={e => e.preventDefault()}
                                        type="button" style={{ position: 'relative', width: '100%', height: 56, marginTop: 12, userSelect: 'none', background: 'none', border: 'none', cursor: 'pointer' }}>
                                        <div style={{ position: 'relative', background: 'var(--surface)', border: '2px solid var(--gold)', borderRadius: 'var(--radius-sm)', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                                            <motion.div style={{ position: 'absolute', left: 0, top: 0, height: '100%', background: 'var(--gold)', width: `${pressProgress}%` }} />
                                            <span style={{ position: 'relative', zIndex: 10, fontWeight: 800, fontFamily: 'var(--font-d)', letterSpacing: '0.15em', color: pressProgress > 50 ? '#fff' : 'var(--gold)', display: 'flex', alignItems: 'center', gap: 8, fontSize: 'var(--sm)', textTransform: 'uppercase', transition: 'color 0.2s' }}>
                                                <Zap size={18} /> ACTIVATE
                                            </span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ─── 6. COMPLETE (split: customer / staff) ────────── */}
                {status === 'complete' && (
                    <motion.div key="complete" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
                        {/* Customer-facing */}
                        <div style={{ flex: 1, background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', transform: 'rotate(180deg)', borderBottom: '1px solid rgba(255,255,255,0.1)', padding: 32 }}>
                            <div style={{ textAlign: 'center', maxWidth: 600 }}>
                                <div style={{ width: 96, height: 96, background: '#ccff00', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 24px', boxShadow: '0 0 40px rgba(204,255,0,0.3)' }}>
                                    <Check size={48} color="#000" />
                                </div>
                                <h2 style={{ fontSize: 36, fontFamily: "'Oswald', sans-serif", fontWeight: 700, color: 'white', marginBottom: 24 }}>アクティベートが完了しました！</h2>
                                <div style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 16, padding: 32 }}>
                                    <p style={{ fontSize: 16, color: '#e5e7eb', lineHeight: 2 }}>ご利用ありがとうございました。<br /><span style={{ color: '#ccff00', fontWeight: 700 }}>my.mansuke.jp/redeem</span> にアクセスし、<br />PINコードと暗証番号で残高を追加してください。</p>
                                </div>
                            </div>
                        </div>
                        {/* Staff-facing */}
                        <div style={{ flex: 1, background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, borderTop: '3px solid var(--green)' }}>
                            <div style={{ textAlign: 'center' }}>
                                <div style={{ width: 64, height: 64, background: 'var(--green-bg)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px', border: '2px solid var(--green-border)' }}>
                                    <Check size={28} color="var(--green)" />
                                </div>
                                <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--lg)', fontWeight: 800, color: 'var(--ink)', marginBottom: 8, textTransform: 'uppercase' }}>処理完了</h3>
                                <p style={{ color: 'var(--text-2)', fontSize: 'var(--sm)', marginBottom: 24 }}>カードがアクティベートされました。</p>
                                <button onClick={resetToHome} className="btn btn-gold" style={{ padding: '16px 48px' }}>
                                    <Home size={18} /> ホームに戻る
                                </button>
                            </div>
                        </div>
                    </motion.div>
                )}

                {/* ─── Loading overlay ──────────────────────────── */}
                <AnimatePresence>
                    {isChecking && (
                        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            style={{ position: 'absolute', inset: 0, zIndex: 50, background: 'rgba(255,255,255,0.8)', backdropFilter: 'blur(8px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16 }}>
                            <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3 }} />
                            <p style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--sm)', color: 'var(--text-3)', letterSpacing: '0.1em', fontWeight: 700 }}>VERIFYING...</p>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ─── Error modal ──────────────────────────────── */}
                <AnimatePresence>
                    {errorModal.show && <ErrorModal message={errorModal.message} onClose={closeError} isCustomerView={isCustomerView} />}
                </AnimatePresence>

                {/* ─── Rotation notice ──────────────────────────── */}
                <AnimatePresence>
                    {showRotationNotice && (
                        <motion.div initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
                            style={{ position: 'absolute', bottom: 32, left: 0, right: 0, zIndex: 200, display: 'flex', justifyContent: 'center', padding: '0 16px', pointerEvents: 'none' }}>
                            <div style={{ background: 'var(--green)', color: '#fff', padding: '16px 32px', borderRadius: 16, boxShadow: '0 8px 32px rgba(16,185,129,0.3)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, maxWidth: 480, width: '100%' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
                                    <RotateCw size={24} />
                                    <h3 style={{ fontWeight: 800, fontSize: 'var(--md)', fontFamily: 'var(--font-d)', letterSpacing: '0.05em' }}>画面が反転しました</h3>
                                </div>
                                <p style={{ fontSize: 'var(--xs)', opacity: 0.9, textAlign: 'center' }}>これより先はお客様への操作をお願いしてください</p>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

export default PosPage;
