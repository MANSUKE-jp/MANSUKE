import React, { useState, useEffect, useRef } from 'react';
import {
    X, Loader2, Edit3, Key, DollarSign, Save, ShoppingBag,
    User, Mail, Phone, Calendar, Shield, Hash, Clock, Camera
} from 'lucide-react';
import { callFunction } from '../firebase';
import ImageCropperModal from '../../../../shared/components/ImageCropperModal';
import { uploadProfilePicture } from '../utils/storage';

const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts._seconds ? ts._seconds * 1000 : ts);
    return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const kycLabels = { pending: '審査待ち', approved: '承認済み', rejected: '拒否', mismatch: '不一致' };
const kycBadgeClass = { pending: 'badge-inactive', approved: 'badge-active', rejected: 'badge-disabled', mismatch: 'badge-disabled' };

const UserDetailModal = ({ user, onClose, onRefresh }) => {
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tab, setTab] = useState('info');
    const [saving, setSaving] = useState(false);

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

    // Avatar state
    const fileInputRef = useRef(null);
    const [imageToCrop, setImageToCrop] = useState(null);
    const [uploadingAvatar, setUploadingAvatar] = useState(false);

    const fetchDetail = async () => {
        setLoading(true); setError('');
        try {
            const fn = callFunction('staffGetUserDetail');
            const result = await fn({ uid: user.uid });
            setDetail(result.data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchDetail(); }, [user.uid]);

    const handleAdjustBalance = async () => {
        const amt = parseInt(adjustAmount, 10);
        if (isNaN(amt) || amt <= 0) { setError('有効な金額を入力してください。'); return; }
        const finalAmount = adjustMode === 'minus' ? -amt : amt;
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffAdjustBalance');
            await fn({ uid: user.uid, amount: finalAmount, memo: adjustMemo });
            setShowAdjust(false); setAdjustAmount('');
            await fetchDetail();
            onRefresh?.();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handleUpdateProfile = async (field) => {
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffUpdateUserProfile');
            await fn({ uid: user.uid, field, value: editValue });
            setEditingField(null); setEditValue('');
            await fetchDetail();
            onRefresh?.();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handlePasswordChange = async () => {
        if (!newPassword || newPassword.length < 8) { setError('パスワードは8文字以上です。'); return; }
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffUpdateUserProfile');
            await fn({ uid: user.uid, field: 'password', value: newPassword });
            setShowPasswordReset(false); setNewPassword('');
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => setImageToCrop(reader.result));
            reader.readAsDataURL(file);
        }
        e.target.value = null; // reset
    };

    const handleCropDone = async (blob) => {
        setImageToCrop(null);
        setUploadingAvatar(true);
        setError('');
        try {
            const url = await uploadProfilePicture(user.uid, blob);
            const fn = callFunction('staffUpdateUserProfile');
            await fn({ uid: user.uid, field: 'avatarUrl', value: url });
            await fetchDetail();
            onRefresh?.();
        } catch (err) {
            setError('プロフィールの更新に失敗しました: ' + err.message);
        } finally {
            setUploadingAvatar(false);
        }
    };

    const handleDeleteAvatar = async () => {
        if (!window.confirm("プロフィール画像を削除してもよろしいですか？")) return;
        setUploadingAvatar(true); setError('');
        try {
            const fn = callFunction('staffDeleteAvatarUrl');
            await fn({ uid: user.uid });
            await fetchDetail();
            onRefresh?.();
        } catch (err) { setError('画像の削除に失敗しました: ' + err.message); }
        finally { setUploadingAvatar(false); }
    };

    const d = detail || user;
    const tabs = [
        { id: 'info', label: '個人情報' },
        { id: 'balance', label: '残高' },
        { id: 'transactions', label: '取引履歴' },
        { id: 'orders', label: '注文履歴' },
        { id: 'edit', label: 'プロフィール編集' },
    ];

    const editableFields = [
        { key: 'lastName', label: '姓', icon: User },
        { key: 'firstName', label: '名', icon: User },
        { key: 'furiganaLast', label: 'セイ', icon: User },
        { key: 'furiganaFirst', label: 'メイ', icon: User },
        { key: 'email', label: 'メールアドレス', icon: Mail },
        { key: 'phone', label: '電話番号', icon: Phone },
        { key: 'nickname', label: 'ニックネーム', icon: Hash },
        { key: 'birthday', label: '生年月日', icon: Calendar },
        { key: 'kycStatus', label: '本人確認ステータス', icon: Shield },
    ];

    return (
        <div className="modal-backdrop" onClick={onClose}>
            <div className="modal-panel" onClick={e => e.stopPropagation()} style={{ maxWidth: 880 }}>
                <button className="modal-close" onClick={onClose}><X size={18} /></button>

                {loading ? (
                    <div style={{ textAlign: 'center', padding: 48 }}><div className="spinner" style={{ margin: '0 auto' }} /></div>
                ) : (
                    <>
                        {/* Header */}
                        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, marginBottom: 24 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, alignItems: 'center' }}>
                                <div style={{
                                    width: 80, height: 80, borderRadius: '50%', flexShrink: 0,
                                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    color: 'white', fontWeight: 700, fontSize: 24,
                                    overflow: 'hidden', position: 'relative'
                                }}>
                                    {d.avatarUrl ? (
                                        <img src={d.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                    ) : (
                                        (d.lastName || d.email || '?')[0].toUpperCase()
                                    )}
                                    {uploadingAvatar && (
                                        <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <div className="spinner spinner-dark" style={{ width: 20, height: 20 }} />
                                        </div>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: 4 }}>
                                    <input type="file" accept=".jpg,.jpeg,.png,.webp,.heic" style={{ display: 'none' }} ref={fileInputRef} onChange={handleFileChange} />
                                    <button onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar} className="btn btn-sm btn-ghost" style={{ padding: '4px 8px', fontSize: 10 }}>
                                        <Camera size={12} style={{ marginRight: 2 }} /> 変更
                                    </button>
                                    {d.avatarUrl && (
                                        <button onClick={handleDeleteAvatar} disabled={uploadingAvatar} className="btn btn-sm" style={{ padding: '4px 8px', fontSize: 10, background: 'rgba(244,63,94,0.1)', color: 'var(--accent-rose)' }}>
                                            <X size={12} style={{ marginRight: 2 }} /> 削除
                                        </button>
                                    )}
                                </div>
                            </div>
                            <div style={{ flex: 1 }}>
                                <div className="modal-title" style={{ marginBottom: 4 }}>
                                    {d.lastName} {d.firstName}
                                </div>
                                <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)' }}>{d.email}</div>
                            </div>
                            <span className={`badge ${kycBadgeClass[d.kycStatus] || 'badge-inactive'}`}>
                                KYC: {kycLabels[d.kycStatus] || d.kycStatus || '未設定'}
                            </span>
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
                            <div className="section-card">
                                <div className="section-body">
                                    <div className="info-row"><span className="info-label">氏名</span><span className="info-value">{d.lastName} {d.firstName}</span></div>
                                    <div className="info-row"><span className="info-label">フリガナ</span><span className="info-value">{d.furiganaLast} {d.furiganaFirst}</span></div>
                                    <div className="info-row"><span className="info-label">ニックネーム</span><span className="info-value">{d.nickname || '—'}</span></div>
                                    <div className="info-row"><span className="info-label">メールアドレス</span><span className="info-value">{d.email}</span></div>
                                    <div className="info-row"><span className="info-label">電話番号</span><span className="info-value">{d.phone || '—'}</span></div>
                                    <div className="info-row"><span className="info-label">現在のパスワード</span><span className="info-value"><span style={{ fontFamily: 'monospace', letterSpacing: '0.05em' }}>{d.password || '—'}</span></span></div>
                                    <div className="info-row"><span className="info-label">生年月日</span><span className="info-value">{d.birthday || '—'}</span></div>
                                    <div className="info-row"><span className="info-label">UID</span><span className="info-value" style={{ fontFamily: 'monospace', fontSize: 'var(--xs)' }}>{d.uid}</span></div>
                                    <div className="info-row"><span className="info-label">KYC ステータス</span><span className="info-value"><span className={`badge ${kycBadgeClass[d.kycStatus] || 'badge-inactive'}`}>{kycLabels[d.kycStatus] || d.kycStatus || '未設定'}</span></span></div>
                                    <div className="info-row"><span className="info-label">スタッフ</span><span className="info-value">{d.isStaff ? 'はい' : 'いいえ'}</span></div>
                                    <div className="info-row"><span className="info-label">Google連携</span><span className="info-value">{d.googleLinked ? '連携済み' : '未連携'}</span></div>
                                    <div className="info-row"><span className="info-label">アカウント作成日</span><span className="info-value">{formatDate(d.createdAt)}</span></div>
                                </div>
                            </div>
                        )}

                        {/* Tab: Balance */}
                        {tab === 'balance' && (
                            <div style={{ maxWidth: 500, margin: '0 auto' }}>
                                <div className="section-card" style={{ marginBottom: 24, textAlign: 'center', padding: 32 }}>
                                    <div style={{ fontSize: 'var(--xs)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text-3)', marginBottom: 8 }}>現在の残高</div>
                                    <div style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--xxl)', fontWeight: 800, color: 'var(--green)' }}>
                                        ¥{(d.balance || 0).toLocaleString()}
                                    </div>
                                </div>

                                {!showAdjust ? (
                                    <button className="btn btn-gold btn-full" onClick={() => setShowAdjust(true)}>
                                        <DollarSign size={16} /> 残高を調整する
                                    </button>
                                ) : (
                                    <div className="balance-adjust-panel">
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
                            </div>
                        )}

                        {/* Tab: Transactions */}
                        {tab === 'transactions' && (
                            <div>
                                {detail?.transactions && detail.transactions.length > 0 ? (() => {
                                    let runningBalance = d.balance || 0;
                                    const txWithBalance = detail.transactions.map(tx => {
                                        let computedBalanceAfter;
                                        if (tx.balanceAfter !== undefined) {
                                            computedBalanceAfter = tx.balanceAfter;
                                            runningBalance = tx.balanceAfter - (tx.amount || 0);
                                        } else {
                                            computedBalanceAfter = runningBalance;
                                            runningBalance = computedBalanceAfter - (tx.amount || 0);
                                        }
                                        return { ...tx, computedBalanceAfter };
                                    });
                                    return (
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
                                                {txWithBalance.map((tx, i) => (
                                                    <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '16px 24px', borderBottom: i < txWithBalance.length - 1 ? '1px solid var(--border)' : 'none' }}>
                                                        <div style={{ flex: 1, minWidth: 0 }}>
                                                            <div style={{ marginBottom: 4 }}>
                                                                <div style={{ fontWeight: 600, color: 'var(--ink)', fontSize: 'var(--sm)', marginBottom: tx.type === 'staff_adjustment' ? 6 : 0 }}>
                                                                    {tx.label || tx.type || '不明な取引'}
                                                                </div>
                                                                {tx.type === 'staff_adjustment' && (
                                                                    <div>
                                                                        <span style={{ fontSize: 10, background: 'var(--gold-bg)', color: 'var(--gold)', padding: '2px 8px', borderRadius: 99, fontWeight: 700, display: 'inline-block' }}>スタッフ調整</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)' }}>{formatDate(tx.createdAt)}</div>
                                                            <div style={{ fontSize: 'var(--xs)', color: 'var(--text-3)', marginTop: 2, fontFamily: "'Inter', sans-serif" }}>
                                                                {tx.transactionId || tx.orderId || ''}
                                                            </div>
                                                        </div>
                                                        <div style={{ flex: 1, textAlign: 'center', fontFamily: 'var(--font-d)', fontSize: 'var(--md)', fontWeight: 800, color: tx.amount >= 0 ? 'var(--green)' : 'var(--red)', textShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
                                                            {tx.amount >= 0 ? '+' : ''}¥{Math.abs(tx.amount || 0).toLocaleString()}
                                                        </div>
                                                        <div style={{ flex: 1, textAlign: 'right', fontFamily: 'var(--font-d)', fontSize: 'var(--md)', fontWeight: 700, color: 'var(--ink)' }}>
                                                            {tx.computedBalanceAfter !== undefined ? `¥${tx.computedBalanceAfter.toLocaleString()}` : '—'}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    );
                                })() : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon"><Clock size={40} style={{ opacity: 0.3 }} /></div>
                                        <div className="empty-state-text">取引履歴がありません</div>
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Tab: Orders */}
                        {tab === 'orders' && (
                            <div>
                                {detail?.orders && detail.orders.length > 0 ? (
                                    <div className="tx-list">
                                        {detail.orders.map((order, i) => (
                                            <div key={i} className="tx-item">
                                                <div className="tx-label">
                                                    <span style={{ fontWeight: 700 }}>{order.orderId || `注文 ${i + 1}`}</span>
                                                    <small>{formatDate(order.createdAt)}{order.status ? ` · ${order.status}` : ''}</small>
                                                </div>
                                                <div className="tx-amount negative">
                                                    ¥{(order.amount || 0).toLocaleString()}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="empty-state">
                                        <div className="empty-state-icon"><ShoppingBag size={40} style={{ opacity: 0.3 }} /></div>
                                        <div className="empty-state-text">注文履歴がありません</div>
                                    </div>
                                )}
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
                                                                <option value="pending">審査待ち</option>
                                                                <option value="approved">承認済み</option>
                                                                <option value="rejected">拒否</option>
                                                                <option value="mismatch">不一致</option>
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
                                                            {key === 'kycStatus' ? (kycLabels[d[key]] || d[key] || '未設定') : (d[key] || '—')}
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

                                {/* Password */}
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
                        {imageToCrop && (
                            <ImageCropperModal
                                imageSrc={imageToCrop}
                                onCropDone={handleCropDone}
                                onCancel={() => setImageToCrop(null)}
                            />
                        )}
                    </>
                )}
            </div>
        </div>
    );
};

export default UserDetailModal;
