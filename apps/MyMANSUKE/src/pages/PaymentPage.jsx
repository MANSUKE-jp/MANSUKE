import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { CreditCard, Clock, ArrowUp, ArrowDown, AlertCircle, Wallet, PlusCircle, Info, Heart } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db, functions } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { usePayment, PaymentModal, usePopup } from '@mansuke/shared';

// ── Transaction Row ──────────────────────────────────────────────
function TransactionRow({ tx, computedBalanceAfter }) {
    const date = tx.createdAt?.toDate?.() ?? new Date();
    const isCredit = tx.amount > 0;

    const typeLabel = {
        prepaid_card: 'プリペイドカードによる残高追加',
    }[tx.type] || tx.label || tx.type;

    return (
        <div style={{
            display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
            padding: '14px 0',
            borderBottom: '1px solid var(--border)',
        }}>
            <div style={{
                width: 36, height: 36, borderRadius: 'var(--radius-sm)', flexShrink: 0,
                background: isCredit ? 'rgba(52,211,153,0.1)' : 'rgba(244,63,94,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
                {isCredit ? (
                    <ArrowUp size={18} style={{ color: 'var(--accent-emerald)' }} />
                ) : (
                    <ArrowDown size={18} style={{ color: 'var(--accent-rose)' }} />
                )}
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, marginBottom: 2 }}>
                    {typeLabel}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                    {date.toLocaleDateString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                    {' '}
                    {date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' })}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                    {tx.transactionId || tx.orderId || ''}
                </div>
            </div>
            
            <div style={{
                flex: 1, textAlign: 'center',
                fontSize: '1rem', fontWeight: 800,
                color: isCredit ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
            }}>
                {isCredit ? '+' : ''}¥{Math.abs(tx.amount || 0).toLocaleString()}
            </div>
            
            <div style={{
                flex: 1, textAlign: 'right',
                fontSize: '1rem', fontWeight: 700,
                color: 'var(--text-main)',
                fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
            }}>
                {computedBalanceAfter !== undefined ? `¥${computedBalanceAfter.toLocaleString()}` : '—'}
            </div>
        </div>
    );
}

import { useNavigate } from 'react-router-dom';

export default function PaymentPage() {
    const { user, userData } = useAuth();
    const navigate = useNavigate();
    const [rawTransactions, setRawTransactions] = useState([]);
    const [txLoading, setTxLoading] = useState(true);
    const [txError, setTxError] = useState('');
    
    // Donation state
    const [showDonationModal, setShowDonationModal] = useState(false);
    const [donationAmount, setDonationAmount] = useState('');
    const payment = usePayment(functions);
    const popup = usePopup();

    const balance = userData?.balance ?? 0;

    useEffect(() => {
        if (!user) return;
        const ref = collection(db, 'users', user.uid, 'transactions');
        const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setRawTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTxLoading(false);
        }, () => {
            setTxError('履歴の取得に失敗しました');
            setTxLoading(false);
        });
        return unsub;
    }, [user]);

    // Calculate computed balance for past transactions
    const transactionsWithBalance = React.useMemo(() => {
        if (!rawTransactions.length) return [];
        let runningBalance = balance;
        // The list is descending (newest first). So we iterate from 0 to n.
        // runningBalance represents "balance AFTER this transaction".
        return rawTransactions.map((tx) => {
            let computedBalanceAfter;
            if (tx.balanceAfter !== undefined) {
                computedBalanceAfter = tx.balanceAfter;
                // update running balance to the "before" state of THIS tx,
                // which is exactly `tx.balanceAfter - tx.amount`
                runningBalance = tx.balanceAfter - (tx.amount || 0);
            } else {
                computedBalanceAfter = runningBalance;
                runningBalance = computedBalanceAfter - (tx.amount || 0);
            }
            return {
                ...tx,
                computedBalanceAfter
            };
        });
    }, [rawTransactions, balance]);

    const handleDonationSubmit = async (e) => {
        e.preventDefault();
        const amount = parseInt(donationAmount, 10);
        if (isNaN(amount) || amount <= 0) {
            await popup.alert('正しい金額を入力してください。');
            return;
        }
        setShowDonationModal(false);
        payment.requestPayment({
            amount,
            description: 'MANSUKEへの寄付',
            serviceName: 'donation',
            onSuccess: async () => {
                await popup.alert('寄付が完了しました。ありがとうございます！');
                setDonationAmount('');
            }
        });
    };

    return (
        <div className="page-enter">
            <div className="page-header" style={{ position: 'relative' }}>
                <h1 className="page-title">お支払いと請求</h1>
                <p className="page-subtitle">残高と取引履歴の確認</p>
                <div style={{ position: 'absolute', top: 0, right: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div 
                        title="MANSUKEの運営と開発者のモチベーション維持のために、寄付をお願いします！"
                        style={{ 
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            width: '32px', height: '32px', borderRadius: '50%',
                            background: 'var(--bg-secondary)', color: 'var(--text-muted)',
                            cursor: 'help', transition: 'background 0.2s',
                        }}
                        onClick={async () => await popup.alert("MANSUKEの運営と開発者のモチベーション維持のために、寄付をお願いします！")}
                    >
                        <Info size={16} />
                    </div>
                    <button 
                        onClick={() => setShowDonationModal(true)} 
                        style={{ 
                            display: 'flex', alignItems: 'center', gap: '6px',
                            background: 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(225,29,72,0.1))',
                            border: '1px solid rgba(244,63,94,0.2)',
                            borderRadius: '99px',
                            padding: '8px 16px',
                            fontSize: '0.85rem',
                            fontWeight: '700',
                            color: 'var(--accent-rose)',
                            cursor: 'pointer',
                        }}
                        onMouseEnter={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(244,63,94,0.15), rgba(225,29,72,0.15))'}
                        onMouseLeave={e => e.currentTarget.style.background = 'linear-gradient(135deg, rgba(244,63,94,0.1), rgba(225,29,72,0.1))'}
                    >
                        <Heart size={16} fill="currentColor" style={{ opacity: 0.8 }} />
                        MANSUKEに寄付する
                    </button>
                </div>
            </div>

            {/* Balance + Add Funds — 2 column grid */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
                gap: 'var(--spacing-lg)',
                marginBottom: 'var(--spacing-xl)',
            }}>
                {/* Balance card */}
                <div className="section-card">
                    <div className="section-header" style={{ justifyContent: 'center' }}>
                        <Wallet size={18} style={{ color: 'var(--accent-indigo)' }} />
                        <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>アカウント残高</div>
                    </div>
                    <div className="section-body" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                        <div style={{
                            fontSize: 48, fontWeight: 800, fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
                            fontVariantNumeric: 'tabular-nums',
                            letterSpacing: '0.02em', color: 'var(--ink)',
                            lineHeight: 1,
                        }}>
                            ¥{balance.toLocaleString()}
                        </div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 8 }}>
                            利用可能残高
                        </div>
                    </div>
                </div>

                {/* Add Funds card */}
                <div className="section-card">
                    <div className="section-header">
                        <PlusCircle size={18} style={{ color: 'var(--accent-emerald)' }} />
                        <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>残高を追加する</div>
                    </div>
                    <div className="section-body" style={{ padding: '0 var(--spacing-xl)' }}>
                        <div 
                            onClick={() => navigate('/redeem')}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md) var(--spacing-md)', borderBottom: '1px solid var(--border)',
                                cursor: 'pointer', color: 'var(--text)',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <Wallet size={18} style={{ color: 'var(--accent-emerald)' }} />
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                MANSUKE PREPAID CARDで追加
                            </span>
                        </div>
                        <div 
                            onClick={async () => await popup.alert('クレジットカード追加機能は準備中です。')}
                            style={{
                                display: 'flex', alignItems: 'center', justifyContent: 'flex-start', gap: 'var(--spacing-md)',
                                padding: 'var(--spacing-md) var(--spacing-md)', borderBottom: '1px solid var(--border)',
                                cursor: 'pointer', color: 'var(--text)',
                                borderRadius: 'var(--radius-sm)',
                                transition: 'background-color 0.2s ease',
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-secondary)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                        >
                            <CreditCard size={18} style={{ color: 'var(--accent-indigo)' }} />
                            <span style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)' }}>
                                クレジットカードで追加
                            </span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Transaction history */}
            <div className="section-card">
                <div className="section-header">
                    <Clock size={18} style={{ color: 'var(--accent-indigo)' }} />
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>取引履歴</div>
                </div>
                <div className="section-body">
                    {txLoading ? (
                        <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)', color: 'var(--text-muted)' }}>
                            <div className="spinner spinner-dark" style={{ margin: '0 auto 12px' }} />
                            読み込み中…
                        </div>
                    ) : txError ? (
                        <div style={{
                            display: 'flex', gap: 8, alignItems: 'center',
                            color: 'var(--accent-rose)', fontSize: 'var(--font-size-sm)', padding: 'var(--spacing-lg)',
                        }}>
                            <AlertCircle size={15} /> {txError}
                        </div>
                    ) : transactionsWithBalance.length === 0 ? (
                        <div style={{
                            textAlign: 'center', padding: 'var(--spacing-xl)',
                            color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)',
                        }}>
                            <CreditCard size={32} style={{ opacity: 0.3, marginBottom: 12 }} />
                            <div>取引履歴はありません</div>
                            <div style={{ marginTop: 4, fontSize: 'var(--font-size-xs)' }}>
                                プリペイドカードを引き換えると、ここに表示されます
                            </div>
                        </div>
                    ) : (
                        <div>
                            {/* Column Headers */}
                            <div style={{
                                display: 'flex',
                                fontSize: 'var(--font-size-xs)',
                                fontWeight: 700,
                                color: 'var(--text-muted)',
                                paddingBottom: 'var(--spacing-sm)',
                                borderBottom: '1px solid var(--border)',
                                marginBottom: 'var(--spacing-sm)'
                            }}>
                                <div style={{ flex: 1, paddingLeft: 'calc(36px + var(--spacing-md))' }}>項目 / 取引ID</div>
                                <div style={{ flex: 1, textAlign: 'center' }}>決済額</div>
                                <div style={{ flex: 1, textAlign: 'right' }}>決済後の残高</div>
                            </div>

                            {transactionsWithBalance.map(tx => (
                                <TransactionRow key={tx.id} tx={tx} computedBalanceAfter={tx.computedBalanceAfter} />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Donation Amount Input Modal */}
            {showDonationModal && createPortal(
                <div className="modal-backdrop" style={{ background: 'rgba(0, 0, 0, 0.3)', backdropFilter: 'blur(4px)' }}>
                    <div className="modal-panel" style={{ padding: '32px', maxWidth: '400px' }}>
                        <div className="section-header" style={{ marginBottom: 24, padding: 0, border: 'none' }}>
                            <div style={{ fontSize: 'var(--font-size-md)', fontWeight: 800 }}>MANSUKEへの寄付</div>
                        </div>
                        <div className="section-body" style={{ padding: 0 }}>
                            <form onSubmit={handleDonationSubmit}>
                                <div style={{ marginBottom: '16px' }}>
                                    <label style={{ display: 'block', marginBottom: '8px', fontSize: '14px', fontWeight: 'bold' }}>
                                        MANSUKEに何円寄付しますか？
                                    </label>
                                    <input
                                        type="number"
                                        className="input-field"
                                        value={donationAmount}
                                        onChange={(e) => setDonationAmount(e.target.value)}
                                        placeholder="金額を入力"
                                        required
                                        min="1"
                                    />
                                </div>
                                <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: 24 }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        style={{ padding: '10px 20px', borderRadius: '99px' }}
                                        onClick={() => setShowDonationModal(false)}
                                    >
                                        キャンセル
                                    </button>
                                    <button 
                                        type="submit" 
                                        className="btn btn-primary" 
                                        style={{ padding: '10px 24px', borderRadius: '99px' }}
                                    >
                                        次へ
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Payment Framework Modal */}
            {createPortal(
                <PaymentModal 
                    isOpen={payment.isOpen}
                    onClose={payment.handleClose}
                    onConfirm={payment.handleConfirm}
                    amount={payment.paymentConfig.amount}
                    description={payment.paymentConfig.description}
                    serviceName={payment.paymentConfig.serviceName}
                    balance={balance}
                    isLoading={payment.isProcessing}
                    isSubscription={payment.paymentConfig.isSubscription}
                />, 
                document.body
            )}
        </div>
    );
}