import React, { useState, useEffect } from 'react';
import { CreditCard, Clock, TrendingUp, TrendingDown, AlertCircle, Wallet, PlusCircle } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';

// ── Transaction Row ──────────────────────────────────────────────
function TransactionRow({ tx }) {
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
                    <TrendingUp size={18} style={{ color: 'var(--accent-emerald)' }} />
                ) : (
                    <TrendingDown size={18} style={{ color: 'var(--accent-rose)' }} />
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
            </div>
            <div style={{
                fontSize: '1rem', fontWeight: 800,
                color: isCredit ? 'var(--accent-emerald)' : 'var(--accent-rose)',
                fontFamily: "'Inter', 'Noto Sans JP', sans-serif",
                fontVariantNumeric: 'tabular-nums',
                letterSpacing: '0.02em',
            }}>
                {isCredit ? '+' : ''}¥{Math.abs(tx.amount).toLocaleString()}
            </div>
        </div>
    );
}

import { useNavigate } from 'react-router-dom';

export default function PaymentPage() {
    const { user, userData } = useAuth();
    const navigate = useNavigate();
    const [transactions, setTransactions] = useState([]);
    const [txLoading, setTxLoading] = useState(true);
    const [txError, setTxError] = useState('');

    const balance = userData?.balance ?? 0;

    useEffect(() => {
        if (!user) return;
        const ref = collection(db, 'users', user.uid, 'transactions');
        const q = query(ref, orderBy('createdAt', 'desc'), limit(50));
        const unsub = onSnapshot(q, (snap) => {
            setTransactions(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            setTxLoading(false);
        }, () => {
            setTxError('履歴の取得に失敗しました');
            setTxLoading(false);
        });
        return unsub;
    }, [user]);

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">お支払いと請求</h1>
                <p className="page-subtitle">残高と取引履歴の確認</p>
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
                    <div className="section-header">
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
                    <div className="section-body" style={{
                        display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-xl)',
                        justifyContent: 'center', height: '100%',
                    }}>
                        <button
                            className="btn btn-primary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => navigate('/redeem')}
                        >
                            MANSUKE PREPAID CARDで追加
                        </button>
                        <button
                            className="btn btn-secondary"
                            style={{ width: '100%', justifyContent: 'center' }}
                            onClick={() => alert('クレジットカード追加機能は準備中です。')}
                        >
                            クレジットカードで追加
                        </button>
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
                    ) : transactions.length === 0 ? (
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
                            {transactions.map(tx => (
                                <TransactionRow key={tx.id} tx={tx} />
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}