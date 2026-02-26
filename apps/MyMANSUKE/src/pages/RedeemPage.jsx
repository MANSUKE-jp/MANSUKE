import React, { useState } from 'react';
import {
    CreditCard, ShoppingBag, AlertCircle, CheckCircle2,
    Lock, Hash, HelpCircle, Users,
} from 'lucide-react';
import { callFunction } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

// ── Small FAQ Card ───────────────────────────────────────────────
function FaqCard({ question, answer }) {
    return (
        <div style={{
            background: 'rgba(99,102,241,0.05)',
            border: '1px solid rgba(99,102,241,0.15)',
            borderRadius: 'var(--radius-md)',
            padding: 'var(--spacing-md) var(--spacing-lg)',
            display: 'flex', gap: 12, alignItems: 'flex-start',
            marginBottom: 'var(--spacing-xl)',
        }}>
            <HelpCircle size={15} style={{ color: 'var(--accent-indigo)', flexShrink: 0, marginTop: 2 }} />
            <div>
                <div style={{ fontSize: 'var(--font-size-xs)', fontWeight: 700, color: 'var(--accent-indigo)', marginBottom: 4, letterSpacing: '0.04em' }}>
                    {question}
                </div>
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                    {answer}
                </div>
            </div>
        </div>
    );
}

// ── PIN Input ────────────────────────────────────────────────────
function PinInput({ value, onChange, maxLength, label, description, type = 'text', inputMode = 'text', placeholder = '' }) {
    return (
        <div className="input-group">
            <label className="input-label">{label}</label>
            {description && (
                <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 4, letterSpacing: '0.03em' }}>
                    {description}
                </div>
            )}
            <input
                className="input-field"
                type={type}
                inputMode={inputMode}
                value={value}
                onChange={e => {
                    const v = e.target.value.replace(/[^0-9a-zA-Z]/g, '');
                    if (v.length <= maxLength) onChange(v);
                }}
                maxLength={maxLength}
                placeholder={placeholder}
                style={{ letterSpacing: '0.15em', fontWeight: 600 }}
                autoComplete="off"
            />
            <div style={{ textAlign: 'right', fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 4 }}>
                {value.length} / {maxLength}
            </div>
        </div>
    );
}

export default function RedeemPage() {
    const { userData } = useAuth();
    const [pinCode, setPinCode] = useState('');
    const [userPin, setUserPin] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [result, setResult] = useState(null); // { amount }

    const currentBalance = userData?.balance ?? 0;

    const handleRedeem = async () => {
        setError('');
        if (pinCode.length !== 10) { setError('PINコードは10桁で入力してください'); return; }
        if (!/^\d{4}$/.test(userPin)) { setError('暗証番号は4桁の数字で入力してください'); return; }

        setLoading(true);
        try {
            const fn = callFunction('redeemCard');
            const res = await fn({ pinCode, userPin });
            setResult({ amount: res.data.amount });
        } catch (err) {
            setError(err.message || '引換に失敗しました。入力内容をご確認ください');
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setPinCode('');
        setUserPin('');
        setError('');
        setResult(null);
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">コード引換</h1>
                <p className="page-subtitle">MANSUKE PREPAID CARDでアカウント残高を追加</p>
            </div>

            {/* Current balance chip */}
            <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                background: 'var(--surface)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)', padding: '10px 18px',
                marginBottom: 'var(--spacing-xl)',
                boxShadow: 'var(--shadow-sm)',
            }}>
                <CreditCard size={15} style={{ color: 'var(--accent-indigo)' }} />
                <span style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', fontWeight: 600 }}>現在の残高</span>
                <span style={{ fontSize: 'var(--font-size-base)', fontWeight: 700, color: 'var(--ink)' }}>
                    ¥{currentBalance.toLocaleString()}
                </span>
            </div>

            {result ? (
                /* ── Success state ── */
                <div className="section-card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div style={{
                        width: 72, height: 72, borderRadius: '50%',
                        background: 'rgba(52,211,153,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        margin: '0 auto var(--spacing-lg)',
                    }}>
                        <CheckCircle2 size={36} style={{ color: 'var(--accent-emerald)' }} />
                    </div>
                    <div style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 8 }}>
                        残高を追加しました
                    </div>
                    <div style={{
                        fontSize: 40, fontWeight: 800, fontFamily: 'var(--font-d)',
                        color: 'var(--accent-emerald)', marginBottom: 'var(--spacing-md)',
                        letterSpacing: '0.05em',
                    }}>
                        +¥{result.amount.toLocaleString()}
                    </div>
                    <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                        新しい残高: ¥{(currentBalance).toLocaleString()}
                    </div>
                    <button className="btn btn-ghost" onClick={handleReset}>
                        別のカードを引き換える
                    </button>
                </div>
            ) : (
                /* ── Form state ── */
                <>
                    <FaqCard
                        question="PREPAID CARDはどこで購入できますか？"
                        answer="MANSUKEの職員が直接手渡しで販売しています。お気軽にお声かけください！"
                    />

                    <div className="section-card">
                        <div className="section-header">
                            <CreditCard size={18} style={{ color: 'var(--accent-indigo)' }} />
                            <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>PREPAID CARD情報を入力</div>
                        </div>
                        <div className="section-body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>

                            <PinInput
                                label="PINコード"
                                value={pinCode}
                                onChange={setPinCode}
                                maxLength={10}
                                inputMode="text"
                                placeholder="XXXXXXXXXX"
                            />

                            <PinInput
                                label="暗証番号"
                                description="購入時にお客様が設定した4桁の番号です。"
                                value={userPin}
                                onChange={v => { if (/^\d*$/.test(v) && v.length <= 4) setUserPin(v); }}
                                maxLength={4}
                                type="password"
                                inputMode="numeric"
                                placeholder="••••"
                            />

                            {error && (
                                <div style={{
                                    display: 'flex', alignItems: 'flex-start', gap: 8,
                                    background: 'rgba(244,63,94,0.07)',
                                    border: '1px solid rgba(244,63,94,0.2)',
                                    borderRadius: 'var(--radius-sm)',
                                    padding: 'var(--spacing-md)',
                                    fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)', lineHeight: 1.6,
                                }}>
                                    <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
                                    {error}
                                </div>
                            )}

                            <button
                                className="btn btn-primary btn-full"
                                style={{ marginTop: 4 }}
                                onClick={handleRedeem}
                                disabled={loading || pinCode.length !== 10 || userPin.length !== 4}
                            >
                                {loading ? <><div className="spinner" /> 照会中…</> : <>残高を追加する</>}
                            </button>

                            <div style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                                justifyContent: 'center',
                            }}>
                                <Lock size={11} />
                                入力情報はサーバーで安全に処理されます
                            </div>

                            <div style={{
                                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                                textAlign: 'center', lineHeight: 1.7,
                                borderTop: '1px solid var(--border)',
                                paddingTop: 12,
                            }}>
                                PREPAID CARDを使用することで、
                                <a
                                    href="https://legal.mansuke.jp/prepaid"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    style={{ color: 'var(--accent-indigo)', textDecoration: 'underline' }}
                                >
                                    アカウント残高およびPREPAID CARD 利用規約
                                </a>
                                に同意したことになります。
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
