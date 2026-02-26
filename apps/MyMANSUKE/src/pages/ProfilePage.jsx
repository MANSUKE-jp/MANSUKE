import React, { useState } from 'react';
import { Lock, Users, Shield, Check, AlertCircle, Pencil, X } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { callFunction } from '../firebase';

function InfoRow({ label, value }) {
    return (
        <div className="info-row">
            <span className="info-label">{label}</span>
            <span className="info-value">{value || '—'}</span>
        </div>
    );
}

function SectionCard({ icon: Icon, title, subtitle, children }) {
    return (
        <div className="section-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div className="section-header">
                <div style={{
                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                    background: 'rgba(99,102,241,0.12)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                }}>
                    <Icon size={18} style={{ color: 'var(--accent-indigo)' }} />
                </div>
                <div>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>{title}</div>
                    {subtitle && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
                </div>
            </div>
            <div className="section-body">
                {children}
            </div>
        </div>
    );
}

// Inline nickname editor row
function NicknameRow({ nickname }) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(nickname);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const handleSave = async () => {
        const trimmed = val.trim();
        if (!trimmed) { setError('ニックネームを入力してください'); return; }
        if (trimmed.length > 10) { setError('10文字以内で入力してください'); return; }
        setSaving(true);
        setError('');
        try {
            const fn = callFunction('mymansukeUpdateNickname');
            await fn({ nickname: trimmed });
            setDone(true);
            setTimeout(() => { setDone(false); setEditing(false); }, 1200);
        } catch (err) {
            setError(err.message || 'ニックネームの変更に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    const handleCancel = () => {
        setVal(nickname);
        setError('');
        setEditing(false);
    };

    if (!editing) {
        return (
            <div className="info-row" style={{ alignItems: 'center' }}>
                <span className="info-label">ニックネーム</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span className="info-value">{nickname || '—'}</span>
                    <button
                        onClick={() => setEditing(true)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)',
                            padding: '4px 10px', transition: 'all var(--transition-fast)',
                        }}
                    >
                        <Pencil size={11} /> 変更
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div style={{ padding: 'var(--spacing-md) 0' }}>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginBottom: 8 }}>ニックネーム</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                    className="form-input"
                    style={{ flex: 1, height: 38, fontSize: 'var(--font-size-sm)' }}
                    value={val}
                    onChange={e => setVal(e.target.value)}
                    maxLength={10}
                    autoFocus
                    disabled={saving || done}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel(); }}
                />
                <button
                    className="btn btn-primary"
                    style={{ padding: '8px 14px', fontSize: 'var(--font-size-sm)', height: 38 }}
                    onClick={handleSave}
                    disabled={saving || done}
                >
                    {done ? <Check size={15} /> : saving ? <div className="spinner" style={{ width: 14, height: 14 }} /> : '保存'}
                </button>
                <button
                    className="btn btn-ghost"
                    style={{ padding: '8px 10px', height: 38 }}
                    onClick={handleCancel}
                    disabled={saving}
                >
                    <X size={15} />
                </button>
            </div>
            {error && (
                <div style={{
                    display: 'flex', alignItems: 'center', gap: 6, marginTop: 8,
                    fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)',
                }}>
                    <AlertCircle size={12} /> {error}
                </div>
            )}
        </div>
    );
}

export default function ProfilePage() {
    const { userData } = useAuth();

    const name = userData ? `${userData.lastName || ''} ${userData.firstName || ''}`.trim() : '';
    const email = userData?.email || '';
    const phone = userData?.phone || '';
    const birthday = userData?.birthday || '';
    const nickname = userData?.nickname || '';

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">個人情報</h1>
                <p className="page-subtitle">アカウントに登録されている情報を確認・変更できます</p>
            </div>

            {/* Public info — shown first */}
            <SectionCard
                icon={Users}
                title="他のMANSUKEユーザーもアクセスできる情報"
                subtitle="以下の情報は他のユーザーにも表示されます"
            >
                <NicknameRow nickname={nickname} />
            </SectionCard>

            {/* Private info */}
            <SectionCard
                icon={Lock}
                title="自分のみがアクセスできる情報"
                subtitle="この情報は他のユーザーには表示されません"
            >
                <InfoRow label="名前" value={name} />
                <InfoRow label="メールアドレス" value={email} />
                <InfoRow label="電話番号" value={phone} />
                <InfoRow label="生年月日" value={birthday} />
            </SectionCard>

            <div style={{
                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                padding: 'var(--spacing-md) var(--spacing-lg)',
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                display: 'flex', alignItems: 'flex-start', gap: 8,
            }}>
                <Shield size={14} style={{ flexShrink: 0, marginTop: 2, color: 'var(--accent-indigo)' }} />
                ニックネーム以外の情報は変更できません。情報の変更が必要な場合はサポートまでお問い合わせください。
            </div>
        </div>
    );
}
