import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Loader2, Edit3, Ban, CheckCircle2, Clock, Zap, Gift, User, X } from 'lucide-react';
import { callFunction } from '../firebase';

const statusMap = {
    inactive: { label: '未使用', class: 'badge-inactive', dot: 'gray' },
    active: { label: 'アクティベート済み', class: 'badge-active', dot: 'green' },
    redeemed: { label: '使用済み（残高追加済み）', class: 'badge-redeemed', dot: 'blue' },
    disabled: { label: '無効', class: 'badge-disabled', dot: 'red' },
};

const formatDate = (ts) => {
    if (!ts) return '—';
    const d = ts.toDate ? ts.toDate() : new Date(ts._seconds ? ts._seconds * 1000 : ts);
    return d.toLocaleString('ja-JP', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
};

const CardDetailPage = () => {
    const { cardId } = useParams();
    const navigate = useNavigate();
    const [detail, setDetail] = useState(null);
    const [loading, setLoading] = useState(true);
    const [editBalance, setEditBalance] = useState(false);
    const [newAmount, setNewAmount] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const fetchDetail = async () => {
        setLoading(true); setError('');
        try {
            const fn = callFunction('staffGetCardDetail');
            const result = await fn({ cardId });
            setDetail(result.data);
        } catch (err) { setError(err.message); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchDetail(); }, [cardId]);

    const handleUpdateBalance = async () => {
        const amt = parseInt(newAmount, 10);
        if (isNaN(amt) || amt < 0) { setError('有効な金額を入力してください。'); return; }
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffUpdateCardBalance');
            await fn({ cardId, amount: amt });
            await fetchDetail();
            setEditBalance(false);
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    const handleToggleStatus = async () => {
        setSaving(true); setError('');
        try {
            const fn = callFunction('staffToggleCardStatus');
            await fn({ cardId });
            await fetchDetail();
        } catch (err) { setError(err.message); }
        finally { setSaving(false); }
    };

    if (loading) {
        return (
            <div className="page-enter" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 400 }}>
                <div className="spinner" />
            </div>
        );
    }

    const cd = detail || {};
    const st = statusMap[cd.status] || statusMap.inactive;

    const events = [];
    if (cd.createdAt) events.push({ label: 'コード登録', date: cd.createdAt, dot: 'gray', icon: Clock });
    if (cd.activatedAt) events.push({ label: 'アクティベート', date: cd.activatedAt, dot: 'green', icon: Zap, extra: cd.activatedBy ? `by ${cd.activatedBy}` : null });
    if (cd.redeemedAt) events.push({ label: '残高追加（使用済み）', date: cd.redeemedAt, dot: 'blue', icon: Gift, extra: cd.redeemedBy ? `by ${cd.redeemedBy}` : null });

    return (
        <div className="page-enter">
            {/* Header */}
            <div style={{ marginBottom: 24 }}>
                <button onClick={() => navigate('/cards')} className="btn btn-ghost" style={{ marginBottom: 16, padding: '8px 0' }}>
                    <ArrowLeft size={16} /> コード検索に戻る
                </button>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: 1 }}>
                        <h1 className="page-title" style={{ fontFamily: 'monospace' }}>{cd.publicCode}</h1>
                        <div style={{ fontSize: 'var(--sm)', color: 'var(--text-3)' }}>カードID: {cardId}</div>
                    </div>
                    <span className={`badge ${st.class}`}>{st.label}</span>
                </div>
            </div>

            {error && <div style={{ color: 'var(--red)', marginBottom: 16, fontSize: 'var(--sm)', background: 'var(--red-bg)', padding: '12px 16px', borderRadius: 12 }}>{error}</div>}

            {/* Card info */}
            <div className="section-card" style={{ marginBottom: 24 }}>
                <div className="section-body">
                    <div className="info-row"><span className="info-label">公開コード</span><span className="info-value" style={{ fontFamily: 'monospace' }}>{cd.publicCode}</span></div>
                    <div className="info-row"><span className="info-label">PINコード</span><span className="info-value" style={{ fontFamily: 'monospace' }}>{cd.pinCode}</span></div>
                    <div className="info-row"><span className="info-label">暗証番号</span><span className="info-value">{cd.userPin || '—'}</span></div>
                    <div className="info-row">
                        <span className="info-label">カード残高</span>
                        <span className="info-value" style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--lg)', color: 'var(--green)' }}>
                            ¥{(cd.amount || 0).toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            {/* Timeline */}
            {events.length > 0 && (
                <div style={{ marginBottom: 24 }}>
                    <h3 style={{ fontFamily: 'var(--font-d)', fontSize: 'var(--sm)', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text-3)', marginBottom: 16 }}>イベントタイムライン</h3>
                    <div className="timeline">
                        {events.map((ev, i) => (
                            <div key={i} className="timeline-item">
                                <div className={`timeline-dot ${ev.dot}`} />
                                <div className="timeline-label">{ev.label}</div>
                                <div className="timeline-date">{formatDate(ev.date)} {ev.extra && <span style={{ marginLeft: 8, color: 'var(--text-3)' }}>({ev.extra})</span>}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Linked user info */}
            {detail?.linkedUser && (
                <div className="section-card" style={{ marginBottom: 24 }}>
                    <div className="section-header"><User size={16} /> 紐づけされたアカウント</div>
                    <div className="section-body">
                        <div className="info-row"><span className="info-label">氏名</span><span className="info-value">{detail.linkedUser.lastName} {detail.linkedUser.firstName}</span></div>
                        <div className="info-row"><span className="info-label">メールアドレス</span><span className="info-value">{detail.linkedUser.email}</span></div>
                        <div className="info-row"><span className="info-label">UID</span><span className="info-value" style={{ fontFamily: 'monospace', fontSize: 'var(--xs)' }}>{detail.linkedUser.uid}</span></div>
                    </div>
                </div>
            )}

            {/* Balance edit for active cards */}
            {(cd.status === 'active') && (
                <div style={{ marginBottom: 16 }}>
                    {!editBalance ? (
                        <button className="btn btn-secondary btn-full" onClick={() => { setEditBalance(true); setNewAmount(String(cd.amount || 0)); }}>
                            <Edit3 size={16} /> カード残高を修正
                        </button>
                    ) : (
                        <div className="balance-adjust-panel">
                            <div className="input-group" style={{ marginBottom: 16 }}>
                                <label className="input-label">新しい残高 (¥)</label>
                                <input className="input-field" type="number" value={newAmount} onChange={e => setNewAmount(e.target.value)} min="0" />
                            </div>
                            <div style={{ display: 'flex', gap: 12 }}>
                                <button className="btn btn-ghost" onClick={() => setEditBalance(false)} disabled={saving}>キャンセル</button>
                                <button className="btn btn-gold" onClick={handleUpdateBalance} disabled={saving} style={{ flex: 1 }}>
                                    {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <CheckCircle2 size={16} />}
                                    保存
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            )}

            {/* Toggle status */}
            {(cd.status === 'inactive' || cd.status === 'active' || cd.status === 'disabled') && (
                <button className={`btn btn-full ${cd.status === 'disabled' ? 'btn-primary' : 'btn-danger'}`} onClick={handleToggleStatus} disabled={saving}>
                    {saving ? <Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> : <Ban size={16} />}
                    {cd.status === 'disabled' ? 'コードを有効化' : 'コードを無効化'}
                </button>
            )}
        </div>
    );
};

export default CardDetailPage;
