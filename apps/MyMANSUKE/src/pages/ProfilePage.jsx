import React, { useState, useRef } from 'react';
import { Lock, Users, Shield, Check, AlertCircle, Pencil, X, Camera, User } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { callFunction } from '../firebase';
import ImageCropperModal from '../../../../shared/components/ImageCropperModal';
import { uploadProfilePicture } from '../utils/storage';

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

function AvatarRow({ avatarUrl }) {
    const { user } = useAuth();
    const [imageToCrop, setImageToCrop] = useState(null);
    const [uploading, setUploading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef(null);

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
        setUploading(true);
        setError('');
        try {
            const url = await uploadProfilePicture(user.uid, blob);
            const fn = callFunction('mymansukeUpdateAvatarUrl');
            await fn({ avatarUrl: url });
        } catch (err) {
            setError('プロフィールの更新に失敗しました: ' + err.message);
        } finally {
            setUploading(false);
        }
    };

    return (
        <div className="info-row" style={{ alignItems: 'center' }}>
            <span className="info-label">プロフィール画像</span>
            <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%', background: 'var(--surface-2)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                        border: '1px solid var(--border)', position: 'relative'
                    }}>
                        {avatarUrl ? (
                             <img src={avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                             <User size={24} style={{ color: 'var(--text-3)' }} />
                        )}
                        {uploading && (
                             <div style={{ position: 'absolute', inset: 0, background: 'rgba(255,255,255,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                 <div className="spinner spinner-dark" style={{ width: 16, height: 16 }} />
                             </div>
                        )}
                    </div>
                    <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.heic"
                        style={{ display: 'none' }}
                        ref={fileInputRef}
                        onChange={handleFileChange}
                    />
                    <button
                        onClick={() => fileInputRef.current?.click()}
                        disabled={uploading}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            background: 'none', border: '1px solid var(--border)',
                            borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                            color: 'var(--text-secondary)', fontSize: 'var(--font-size-xs)',
                            padding: '6px 12px', transition: 'all var(--transition-fast)',
                        }}
                    >
                        <Camera size={14} /> 変更
                    </button>
                    {avatarUrl && (
                        <button
                            onClick={async () => {
                                if (!window.confirm("プロフィール画像を削除してもよろしいですか？")) return;
                                setUploading(true); setError('');
                                try {
                                    const fn = callFunction('mymansukeDeleteAvatarUrl');
                                    await fn();
                                } catch (err) { setError('画像の削除に失敗しました: ' + err.message); }
                                finally { setUploading(false); }
                            }}
                            disabled={uploading}
                            style={{
                                display: 'flex', alignItems: 'center', gap: 6,
                                background: 'rgba(244,63,94,0.1)', border: '1px solid rgba(244,63,94,0.2)',
                                borderRadius: 'var(--radius-sm)', cursor: 'pointer',
                                color: 'var(--accent-rose)', fontSize: 'var(--font-size-xs)',
                                padding: '6px 12px', transition: 'all var(--transition-fast)',
                            }}
                        >
                            <X size={14} /> 削除
                        </button>
                    )}
                </div>
                {error && <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)' }}>{error}</div>}
            </div>
            {imageToCrop && (
                <ImageCropperModal
                    imageSrc={imageToCrop}
                    onCropDone={handleCropDone}
                    onCancel={() => setImageToCrop(null)}
                />
            )}
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
    const avatarUrl = userData?.avatarUrl || '';

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
                <AvatarRow avatarUrl={avatarUrl} />
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
