import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
    ArrowLeft, Loader2, Edit3, Key, DollarSign, Save,
    User, Mail, Phone, Calendar, Shield, Hash, Clock, X, ShoppingBag, Server, Trash2, Terminal, Activity
} from 'lucide-react';
import { callFunction } from '../firebase';
import { usePopup } from '@mansuke/shared';

const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts._seconds ? ts._seconds * 1000 : ts);
    return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const formatBytes = (bytes) => {
    if (bytes === 0 || !bytes) return '0 B';
    const k = 1024 * 1024; // MB base
    if (bytes < k) return '< 1 MB'; // Or standard formatting if finer grain needed
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
};


const kycLabels = { pending: '審査待ち', approved: '承認済み', rejected: '拒否', mismatch: '不一致' };
const kycBadgeClass = { pending: 'badge-inactive', approved: 'badge-active', rejected: 'badge-disabled', mismatch: 'badge-disabled' };

// --- REMOVED VpnLogsTable ---

const UserDetailPage = () => {
    const { uid } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('info');
    const [saving, setSaving] = useState(false);
    
    // Popup Hook
    const popup = usePopup();

    // VPN Modal State
    const [cancelModalDevice, setCancelModalDevice] = useState(null);

    // Balance adjust state
    const [showAdjust, setShowAdjust] = useState(false);
    const [adjustMode, setAdjustMode] = useState('plus');
    const [adjustAmount, setAdjustAmount] = useState('');
    const [adjustMemo, setAdjustMemo] = useState('MANSUKEサポートによる残高調整');

    // Edit profile state
    const [editingField, setEditingField] = useState(null);
    const [editValue, setEditValue] = useState('');

    // Password state
    const [showPasswordReset, setShowPasswordReset] = useState(false);
    const [newPassword, setNewPassword] = useState('');

    const fetchDetail = async () => {
        setLoading(true); setError('');
        try {
            const fn = callFunction('staffGetUserDetail');
            const result = await fn({ uid });
            setDetail(result.data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchDetail(); }, [uid]);

    const handleAdjustBalance = async () => {
        const amt = parseInt(adjustAmount, 10);
        if (isNaN(amt) || amt <= 0) { setError('有効な金額を入力してください。'); return; }
        const finalAmount = adjustMode === 'minus' ? -amt : amt;
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffAdjustBalance');
            await fn({ uid, amount: finalAmount, memo: adjustMemo });
            setShowAdjust(false); setAdjustAmount('');
            await fetchDetail();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handleUpdateProfile = async (field) => {
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffUpdateUserProfile');
            await fn({ uid, field, value: editValue });
            setEditingField(null); setEditValue('');
            await fetchDetail();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handlePasswordChange = async () => {
        if (!newPassword || newPassword.length < 8) { setError('パスワードは8文字以上です。'); return; }
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffUpdateUserProfile');
            await fn({ uid, field: 'password', value: newPassword });
            setShowPasswordReset(false); setNewPassword('');
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const tabs = [
        { id: 'info', label: '個人情報' },
        { id: 'balance', label: '残高と取引履歴' },
        { id: 'vpn', label: 'VPN接続' },
        { id: 'edit', label: 'プロフィール編集' },
    ];

    const editableFields = [
        { key: 'lastName', label: '姓', icon: User },
        { key: 'firstName', label: '名', icon: User },
        { key: 'email', label: 'メールアドレス', icon: Mail },
        { key: 'phone', label: '電話番号', icon: Phone },
        { key: 'nickname', label: 'ニックネーム', icon: Hash },
        { key: 'birthday', label: '生年月日', icon: Calendar },
        { key: 'kycStatus', label: 'KYC ステータス', icon: Shield },
    ];

    if (loading) {
        return (
            <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <div className="spinner" />
            </div>
        );
    }

    const d = detail || {};

    // Merge transactions and orders into a single timeline
    const allTransactions = [];
    if (detail?.transactions) {
        detail.transactions.forEach(tx => allTransactions.push({ ...tx, source: 'transaction' }));
    }
    if (detail?.orders) {
        detail.orders.forEach(order => allTransactions.push({
            ...order,
            source: 'order',
            label: order.orderId || '注文',
            amount: -(order.amount || 0),
            createdAt: order.createdAt,
        }));
    }
    allTransactions.sort((a, b) => {
        const getMs = (ts) => {
            if (!ts) return 0;
            if (ts._seconds) return ts._seconds * 1000;
            if (ts.toDate) return ts.toDate().getTime();
            return new Date(ts).getTime();
        };
        return getMs(b.createdAt) - getMs(a.createdAt);
    });

    // Calculate computed balance for past transactions
    let runningBalance = d.balance || 0;
    const transactionsWithBalance = allTransactions.map((tx) => {
        let computedBalanceAfter;
        if (tx.balanceAfter !== undefined) {
            computedBalanceAfter = tx.balanceAfter;
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

    return (
        <div className="page-enter">
            {/* Header with back button */}
            <div style={{ marginBottom: 24 }}>
                <button onClick={() => navigate('/users')} className="btn btn-ghost" style={{ marginBottom: 16, padding: '8px 0' }}>
                    <ArrowLeft size={16} /> ユーザー検索に戻る
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%', flexShrink: 0,
                        background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        color: 'white', fontWeight: 700, fontSize: 24, overflow: 'hidden'
                    }}>
                        {d.avatarUrl ? (
                            <img src={d.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            (d.lastName || d.email || '?')[0].toUpperCase()
                        )}
                    </div>
                    <div style={{ flex: 1 }}>
                        <h1 className="page-title" style={{ marginBottom: 4 }}>{d.lastName} {d.firstName}</h1>
                        <div style={{ fontSize: 'var(--sm)', color: 'var(--text-3)' }}>{d.email} · UID: {uid}</div>
                    </div>
                    <span className={`badge ${kycBadgeClass[d.kycStatus] || 'badge-inactive'}`}>
                        KYC: {kycLabels[d.kycStatus] || d.kycStatus || '未設定'}
                    </span>
                </div>
            </div>

            {error && <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 'var(--sm)', background: 'var(--red-bg)', padding: '12px 16px', borderRadius: 12 }}>{error}</div>}

            {/* Tabs */}
            <div className="tabs">
                {tabs.map(t => (
                    <button key={t.id} className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>{t.label}</button>
                ))}
            </div>

            {/* Tab: Info */}
            {tab === 'info' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    <div className="section-card">
                        <div className="section-body">
                            <div className="info-row"><span className="info-label">氏名</span><span className="info-value">{d.lastName} {d.firstName}</span></div>
                            <div className="info-row"><span className="info-label">フリガナ</span><span className="info-value">{d.furiganaLast} {d.furiganaFirst}</span></div>
                            <div className="info-row"><span className="info-label">ニックネーム</span><span className="info-value">{d.nickname || '—'}</span></div>
                            <div className="info-row"><span className="info-label">メールアドレス</span><span className="info-value">{d.email}</span></div>
                            <div className="info-row"><span className="info-label">電話番号</span><span className="info-value">{d.phone || '—'}</span></div>
                            <div className="info-row"><span className="info-label">生年月日</span><span className="info-value">{d.birthday || '—'}</span></div>
                            <div className="info-row"><span className="info-label">UID</span><span className="info-value" style={{ fontFamily: 'monospace', fontSize: 'var(--xs)' }}>{d.uid}</span></div>
                            <div className="info-row"><span className="info-label">KYC ステータス</span><span className="info-value"><span className={`badge ${kycBadgeClass[d.kycStatus] || 'badge-inactive'}`}>{kycLabels[d.kycStatus] || d.kycStatus || '未設定'}</span></span></div>
                            <div className="info-row"><span className="info-label">スタッフ</span><span className="info-value">{d.isStaff ? 'はい' : 'いいえ'}</span></div>
                            <div className="info-row"><span className="info-label">Google連携</span><span className="info-value">{d.googleLinked ? '連携済み' : '未連携'}</span></div>
                            <div className="info-row"><span className="info-label">アカウント作成日</span><span className="info-value">{formatDate(d.createdAt)}</span></div>
                        </div>
                    </div>
                    {(d.passwordHistory?.length > 0 || d.avatarHistory?.length > 0) && (
                        <div className="section-card">
                            <div className="section-header" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '16px', borderBottom: '1px solid var(--border)', fontSize: 'var(--font-size-base)', fontWeight: 700 }}>
                                <Clock size={16} /> 履歴情報
                            </div>
                            <div className="section-body" style={{ padding: '16px' }}>
                                {d.passwordHistory?.length > 0 && (
                                    <div style={{ marginBottom: d.avatarHistory?.length > 0 ? 24 : 0 }}>
                                        <div style={{ fontSize: 'var(--sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>過去のパスワード</div>
                                        <ul style={{ paddingLeft: 20, margin: 0, color: 'var(--text-2)', fontSize: 'var(--sm)', fontFamily: 'monospace' }}>
                                            {d.passwordHistory.map((pw, i) => (
                                                <li key={i} style={{ marginBottom: 4 }}>{pw}</li>
                                            ))}
                                        </ul>
                                    </div>
                                )}
                                {d.avatarHistory?.length > 0 && (
                                    <div>
                                        <div style={{ fontSize: 'var(--sm)', fontWeight: 600, marginBottom: 8, color: 'var(--text)' }}>アイコン履歴</div>
                                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                                            {d.avatarHistory.map((url, i) => (
                                                <img key={i} src={url} alt={`Avatar history ${i}`} style={{ width: 48, height: 48, borderRadius: '50%', objectFit: 'cover', border: '1px solid var(--border-color)' }} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Tab: Balance + Transactions (merged) */}
            {tab === 'balance' && (
                <div>
                    {/* Balance display */}
                    <div className="section-card" style={{ marginBottom: 20, textAlign: 'center', padding: 32 }}>
                        <div style={{ fontSize: 'var(--xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 8 }}>アカウント残高</div>
                        <div style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--xxl)', fontWeight: 800, color: 'var(--green)' }}>
                            ¥{(d.balance || 0).toLocaleString()}
                        </div>
                    </div>

                    {/* Adjust controls */}
                    {!showAdjust ? (
                        <button className="btn btn-gold btn-full" onClick={() => setShowAdjust(true)} style={{ marginBottom: 28 }}>
                            <DollarSign size={16} /> 残高を調整する
                        </button>
                    ) : (
                        <div className="balance-adjust-panel" style={{ marginBottom: 28 }}>
                            <div className="balance-toggle">
                                <button className={adjustMode === 'plus' ? 'active-plus' : ''} onClick={() => setAdjustMode('plus')}>＋ 加算</button>
                                <button className={adjustMode === 'minus' ? 'active-minus' : ''} onClick={() => setAdjustMode('minus')}>－ 減算</button>
                            </div>
                            <div className="input-group" style={{ marginBottom: 16 }}>
                                <label className="input-label">金額 (¥)</label>
                                <input className="input-field" type="number" value={adjustAmount} onChange={e => setAdjustAmount(e.target.value)} placeholder="0" min="1" />
                            </div>
                            {adjustAmount && (
                                <div style={{ marginBottom: 16, padding: 12, background: adjustMode === 'plus' ? 'var(--green-bg)' : 'var(--red-bg)', borderRadius: 12, textAlign: 'center' }}>
                                    <span style={{ fontSize: 'var(--xs)', color: 'var(--text-3)' }}>調整後の残高：</span>
                                    <span style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--lg)', fontWeight: 700, marginLeft: 8, color: adjustMode === 'plus' ? 'var(--green)' : 'var(--red)' }}>
                                        ¥{((d.balance || 0) + (adjustMode === 'plus' ? parseInt(adjustAmount || 0) : -parseInt(adjustAmount || 0))).toLocaleString()}
                                    </span>
                                </div>
                            )}
                            <div className="input-group" style={{ marginBottom: 16 }}>
                                <label className="input-label">明細への記載</label>
                                <input className="input-field" value={adjustMemo} onChange={e => setAdjustMemo(e.target.value)} placeholder="MANSUKEサポートによる残高調整" />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn btn-ghost" onClick={() => setShowAdjust(false)} disabled={saving}>キャンセル</button>
                                <button className="btn btn-gold" onClick={handleAdjustBalance} disabled={saving} style={{ flex: 1 }}>
                                    {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                                    確定する
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Transaction history */}
                    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
                        <div style={{ fontSize: 'var(--xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 12 }}>取引履歴</div>
                        {transactionsWithBalance.length > 0 ? (
                            <div className="section-card">
                                {/* Column Headers */}
                                <div style={{
                                    display: 'flex',
                                    fontSize: 'var(--xs)',
                                    fontWeight: 700,
                                    color: 'var(--text-muted)',
                                    padding: '12px 24px',
                                    borderBottom: '1px solid var(--border)'
                                }}>
                                    <div style={{ flex: 1 }}>項目 / 取引ID</div>
                                    <div style={{ flex: 1, textAlign: 'center' }}>決済額</div>
                                    <div style={{ flex: 1, textAlign: 'right' }}>決済後の残高</div>
                                </div>
                                <div className="section-body" style={{ padding: 0 }}>
                                    {transactionsWithBalance.map((tx, i) => (
                                        <div key={tx.id || i} style={{
                                            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                                            padding: '16px 24px', borderBottom: i < transactionsWithBalance.length - 1 ? '1px solid var(--border)' : 'none'
                                        }}>
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
                                                    <span style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--sm)' }}>
                                                        {tx.label || tx.type || '不明な取引'}
                                                    </span>
                                                    {tx.type === 'staff_adjustment' && (
                                                        <span style={{ fontSize: 10, background: 'var(--gold-bg)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>スタッフ調整</span>
                                                    )}
                                                    {tx.source === 'order' && (
                                                        <span style={{ fontSize: 10, background: '#eff6ff', color: '#3b82f6', padding: '2px 8px', borderRadius: 99, fontWeight: 700 }}>注文</span>
                                                    )}
                                                </div>
                                                <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)' }}>
                                                    {formatDate(tx.createdAt)}{tx.status ? ` · ${tx.status}` : ''}
                                                </div>
                                                <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                                                    {tx.transactionId || tx.orderId || ''}
                                                </div>
                                            </div>
                                            <div style={{
                                                flex: 1, textAlign: 'center',
                                                fontFamily: 'var(--font-d)', fontSize: 'var(--md)', fontWeight: 800,
                                                color: tx.amount >= 0 ? 'var(--green)' : 'var(--red)', textShadow: '0 1px 2px rgba(0,0,0,0.05)'
                                            }}>
                                                {tx.amount >= 0 ? '+' : ''}¥{Math.abs(tx.amount || 0).toLocaleString()}
                                            </div>
                                            <div style={{
                                                flex: 1, textAlign: 'right',
                                                fontFamily: 'var(--font-d)', fontSize: 'var(--md)', fontWeight: 700,
                                                color: 'var(--ink)'
                                            }}>
                                                {tx.computedBalanceAfter !== undefined ? `¥${tx.computedBalanceAfter.toLocaleString()}` : '—'}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                        <div className="empty-state">
                            <div className="empty-state-icon"><Clock size={40} style={{ opacity: 0.3 }} /></div>
                                <div className="empty-state-text">取引履歴がありません</div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Tab: VPN Devices */}
            {tab === 'vpn' && (
                <div>
                    <div className="section-card" style={{ marginBottom: 24 }}>
                        <div className="section-header"><Server size={16} /> 設定済みVPNデバイス</div>
                        <div className="section-body" style={{ padding: 0 }}>
                            {(!d.vpnDevices || d.vpnDevices.length === 0) ? (
                                <div className="empty-state" style={{ padding: 40 }}>
                                    <div className="empty-state-icon"><Server size={40} style={{ opacity: 0.3 }} /></div>
                                    <div className="empty-state-text">VPNデバイスは登録されていません</div>
                                </div>
                            ) : (
                                <div>
                                    {d.vpnDevices.map((device, i) => (
                                        <React.Fragment key={device.id}>
                                        <div style={{
                                            padding: '16px 24px', borderBottom: (i < d.vpnDevices.length - 1) ? '1px solid var(--border)' : 'none',
                                            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16
                                        }}>
                                            <div style={{ flex: 1, minWidth: 200 }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                                                    <span style={{ fontWeight: 700, fontSize: 'var(--md)', color: 'var(--ink)' }}>{device.deviceName}</span>
                                                    <span className={`badge ${device.status === 'active' ? 'badge-active' : 'badge-disabled'}`}>
                                                        {device.status === 'active' ? '利用中' : '解約済み / 停止中'}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', fontFamily: "monospace", marginBottom: 2 }}>ID: {device.id}</div>
                                                <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', fontFamily: "monospace", marginBottom: 2 }}>Sub: {device.subscriptionId || '—'}</div>
                                                <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginBottom: 2 }}>作成日: {formatDate(device.createdAt)}</div>
                                                {device.canceledAt && (
                                                    <div style={{ fontSize: 'var(--xs)', color: 'var(--red)', marginBottom: 2, fontWeight: 600 }}>解約受付日時: {formatDate(device.canceledAt)}</div>
                                                )}
                                                {device.status === 'active' && device.address && (
                                                    <div style={{ marginTop: 8, padding: 12, background: 'var(--bg-2)', borderRadius: 8, fontSize: 'var(--xs)' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 4, marginBottom: 4 }}>
                                                            <span style={{ color: 'var(--text-3)' }}>IPアドレス:</span>
                                                            <span style={{ fontFamily: 'monospace', color: 'var(--ink)' }}>{device.address}</span>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 4, marginBottom: 4 }}>
                                                            <span style={{ color: 'var(--text-3)' }}>データ転送量:</span>
                                                            <span style={{ color: 'var(--ink)' }}>
                                                                <span style={{ color: 'var(--green)', fontWeight: 600 }}>↓ {formatBytes(device.transferRx)}</span> / 
                                                                <span style={{ color: 'var(--blue)', fontWeight: 600, marginLeft: 8 }}>↑ {formatBytes(device.transferTx)}</span>
                                                            </span>
                                                        </div>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '100px 1fr', gap: 4 }}>
                                                            <span style={{ color: 'var(--text-3)' }}>最終接続:</span>
                                                            <span style={{ color: 'var(--ink)' }}>{device.latestHandshakeAt ? new Date(device.latestHandshakeAt).toLocaleString('ja-JP') : '未接続'}</span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                            <div style={{ display: 'flex', gap: 8 }}>
                                                {device.status === 'active' && (
                                                    <button className="btn btn-sm btn-ghost" style={{ color: 'var(--red)' }}
                                                        onClick={() => setCancelModalDevice(device)}>
                                                        解約
                                                    </button>
                                                )}
                                                {device.status === 'canceled' && (
                                                    <button className="btn btn-sm btn-outline" style={{ color: 'var(--green)' }}
                                                        onClick={async () => {
                                                            if (await popup.confirm(`${device.deviceName} を再開し、サブスクリプションを復元しますか？`)) {
                                                                setSaving(true); setError('');
                                                                try {
                                                                    const fn = callFunction('staffResumeVpnDevice');
                                                                    await fn({ uid, deviceId: device.id });
                                                                    await fetchDetail();
                                                                } catch (err) { setError(err.message); }
                                                                finally { setSaving(false); }
                                                            }
                                                        }}
                                                        disabled={saving}>
                                                        再開
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        </React.Fragment>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Tab: Edit profile */}
            {tab === 'edit' && (
                <div>
                    <div className="section-card" style={{ marginBottom: 24 }}>
                        <div className="section-body">
                            {editableFields.map(({ key, label, icon: Icon }) => (
                                <div key={key} className="info-row" style={{ alignItems: 'center' }}>
                                    <span className="info-label" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                        <Icon size={14} /> {label}
                                    </span>
                                    {editingField === key ? (
                                        <div style={{ flex: 1, display: 'flex', gap: 8 }}>
                                            {key === 'kycStatus' ? (
                                                <select className="input-field" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, padding: '8px 12px' }}>
                                                    <option value="">未設定</option>
                                                    <option value="pending">審査待ち (pending)</option>
                                                    <option value="approved">承認済み (approved)</option>
                                                    <option value="rejected">拒否 (rejected)</option>
                                                    <option value="mismatch">不一致 (mismatch)</option>
                                                </select>
                                            ) : (
                                                <input className="input-field" value={editValue} onChange={e => setEditValue(e.target.value)} style={{ flex: 1, padding: '8px 12px' }}
                                                    type={key === 'birthday' ? 'date' : 'text'} />
                                            )}
                                            <button className="btn btn-sm btn-gold" onClick={() => handleUpdateProfile(key)} disabled={saving}>
                                                {saving ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={14} />}
                                            </button>
                                            <button className="btn btn-sm btn-ghost" onClick={() => setEditingField(null)}>
                                                <X size={14} />
                                            </button>
                                        </div>
                                    ) : (
                                        <div style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <span className="info-value">
                                                {key === 'kycStatus' 
                                                    ? (kycLabels[d[key]] || d[key] || '未設定') 
                                                    : (d[key] || '—')
                                                }
                                            </span>
                                            <button className="btn btn-sm btn-ghost" onClick={() => { setEditingField(key); setEditValue(d[key] || ''); }}>
                                                <Edit3 size={14} />
                                            </button>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                    <div className="section-card">
                        <div className="section-header"><Key size={16} /> パスワード変更</div>
                        <div className="section-body">
                            {!showPasswordReset ? (
                                <button className="btn btn-secondary btn-full" onClick={() => setShowPasswordReset(true)}>
                                    <Key size={16} /> パスワードを変更する
                                </button>
                            ) : (
                                <div>
                                    <div className="input-group" style={{ marginBottom: 16 }}>
                                        <label className="input-label">新しいパスワード</label>
                                        <input className="input-field" type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="8文字以上、英小文字+数字を含む" />
                                    </div>
                                    <div style={{ display: 'flex', gap: 12 }}>
                                        <button className="btn btn-ghost" onClick={() => setShowPasswordReset(false)} disabled={saving}>キャンセル</button>
                                        <button className="btn btn-primary" onClick={handlePasswordChange} disabled={saving} style={{ flex: 1 }}>
                                            {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Save size={16} />}
                                            パスワードを更新
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {cancelModalDevice && (
                <div className="modal-backdrop" onClick={() => !saving && setCancelModalDevice(null)}>
                    <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: 400 }}>
                        <div className="modal-header">
                            <h3 style={{ margin: 0, fontSize: 'var(--lg)', fontWeight: 800 }}>VPN解約 ({cancelModalDevice.deviceName})</h3>
                            <button className="icon-btn" onClick={() => setCancelModalDevice(null)} disabled={saving}><X size={20} /></button>
                        </div>
                        <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                            <p style={{ fontSize: 'var(--sm)', color: 'var(--text-2)' }}>解約方法を選択してください。</p>
                            <button className="btn btn-outline" 
                                onClick={async () => {
                                    if (await popup.confirm(`${cancelModalDevice.deviceName} を現在の契約期間満了後に解約しますか？`)) {
                                        setSaving(true); setError('');
                                        try {
                                            const fn = callFunction('staffDeleteVpnDevice');
                                            await fn({ uid, deviceId: cancelModalDevice.id, immediate: false });
                                            setCancelModalDevice(null);
                                            await fetchDetail();
                                        } catch (err) { setError(err.message); }
                                        finally { setSaving(false); }
                                    }
                                }}
                                disabled={saving}>
                                期間満了後解約
                            </button>
                            <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginTop: -8 }}>
                                現在の請求期間が終了するまで利用可能ですが、次回の請求は行われません。スタッフは期間終了までに「再開」が可能です。
                            </div>
                            
                            <hr style={{ border: 'none', borderTop: '1px solid var(--border)', margin: '8px 0' }} />

                            <button className="btn" style={{ background: 'var(--red-bg)', color: 'var(--red)' }}
                                onClick={async () => {
                                    if (await popup.confirm(`【警告】${cancelModalDevice.deviceName} を即時解約し、完全に削除します。返金は行われません。よろしいですか？`)) {
                                        setSaving(true); setError('');
                                        try {
                                            const fn = callFunction('staffDeleteVpnDevice');
                                            await fn({ uid, deviceId: cancelModalDevice.id, immediate: true });
                                            setCancelModalDevice(null);
                                            await fetchDetail();
                                        } catch (err) { setError(err.message); }
                                        finally { setSaving(false); }
                                    }
                                }}
                                disabled={saving}>
                                <Trash2 size={16} /> 即時解約して削除
                            </button>
                            <div style={{ fontSize: 'var(--xs)', color: 'var(--red)', marginTop: -8 }}>
                                直ちにサーバーから削除され、再開はできません。
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default UserDetailPage;
