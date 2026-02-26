import React, { useState, useRef, useEffect } from 'react';
import {
    Lock, ChevronRight, X, AlertCircle,
    Check, Eye, EyeOff, Fingerprint, Trash2, Plus,
    Pencil,
} from 'lucide-react';
import { linkWithPopup } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth, callFunction, googleProvider } from '../firebase';
import { validatePassword } from '../utils/validators';
import { registerPasskey } from '../utils/passkey';

// ═══════════════════════════════════════════════════════════════════
// SHARED HELPERS
// ═══════════════════════════════════════════════════════════════════

function PasswordField({ id, label, value, onChange, autoComplete }) {
    const [show, setShow] = useState(false);
    return (
        <div className="input-group">
            <label className="input-label" htmlFor={id}>{label}</label>
            <div style={{ position: 'relative' }}>
                <input id={id} className="input-field" type={show ? 'text' : 'password'}
                    value={value} onChange={e => onChange(e.target.value)}
                    autoComplete={autoComplete} style={{ paddingRight: 48 }} />
                <button type="button" tabIndex={-1} onClick={() => setShow(s => !s)}
                    style={{
                        position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                        background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)',
                    }}>
                    {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
            </div>
        </div>
    );
}

function ErrorBox({ message }) {
    if (!message) return null;
    return (
        <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 8,
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)',
            fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)',
        }}>
            <AlertCircle size={15} style={{ flexShrink: 0, marginTop: 2 }} />
            {message}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// EXPANDABLE PANEL — in-card animation
// ═══════════════════════════════════════════════════════════════════
function ExpandPanel({ open, children }) {
    const ref = useRef(null);
    const [height, setHeight] = useState(0);

    useEffect(() => {
        if (!ref.current) return;
        if (open) {
            setHeight(ref.current.scrollHeight);
        } else {
            setHeight(0);
        }
    }, [open]);

    // When content changes while open, recalc height
    useEffect(() => {
        if (!open || !ref.current) return;
        const observer = new ResizeObserver(() => {
            setHeight(ref.current?.scrollHeight ?? 0);
        });
        observer.observe(ref.current);
        return () => observer.disconnect();
    }, [open]);

    return (
        <div style={{
            overflow: 'hidden',
            maxHeight: height,
            transition: 'max-height 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        }}>
            <div ref={ref}>
                <div style={{
                    padding: '24px var(--spacing-xl) var(--spacing-xl)',
                    borderTop: open ? '1px solid var(--border)' : 'none',
                    animation: open ? 'fadeSlideIn 0.3s ease both' : 'none',
                }}>
                    {children}
                </div>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PASSWORD SECTION
// ═══════════════════════════════════════════════════════════════════
function PasswordSection() {
    const [open, setOpen] = useState(false);
    const [current, setCurrent] = useState('');
    const [next1, setNext1] = useState('');
    const [next2, setNext2] = useState('');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [done, setDone] = useState(false);

    const reset = () => {
        setCurrent(''); setNext1(''); setNext2('');
        setError(''); setDone(false); setOpen(false);
    };

    const handleSave = async () => {
        setError('');
        const errs = validatePassword(next1);
        if (errs.length > 0) { setError(errs[0]); return; }
        if (next1 !== next2) { setError('新しいパスワードが一致しません'); return; }
        setSaving(true);
        try {
            const fn = callFunction('changePassword');
            await fn({ currentPassword: current, newPassword: next1 });
            setDone(true);
        } catch (err) {
            setError(err.message || 'パスワードの変更に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="section-card" style={{ marginBottom: 'var(--spacing-xl)', overflow: 'hidden' }}>
            <div className="section-header">
                <Lock size={18} style={{ color: 'var(--accent-indigo)' }} />
                <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>パスワード</div>
            </div>
            <div className="section-body" style={{ padding: '0 var(--spacing-xl)' }}>
                <div
                    role="button" tabIndex={0}
                    onClick={() => open ? reset() : setOpen(true)}
                    onKeyDown={e => e.key === 'Enter' && (open ? reset() : setOpen(true))}
                    style={{
                        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                        padding: 'var(--spacing-lg) 0',
                        cursor: 'pointer', transition: 'all var(--transition-fast)',
                    }}
                >
                    <div style={{
                        width: 40, height: 40, borderRadius: 'var(--radius-md)',
                        background: 'rgba(99,102,241,0.08)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                    }}>
                        <Lock size={18} style={{ color: 'var(--accent-indigo)' }} />
                    </div>
                    <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>パスワードを変更</div>
                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>定期的なパスワード変更でセキュリティを強化しましょう</div>
                    </div>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)',
                        transform: open ? 'rotate(90deg)' : 'none',
                        transition: 'transform 0.25s ease',
                    }}>
                        <ChevronRight size={16} />
                    </div>
                </div>
            </div>

            <ExpandPanel open={open}>
                {done ? (
                    <div style={{ textAlign: 'center', padding: '16px 0' }}>
                        <div style={{
                            width: 48, height: 48, borderRadius: '50%',
                            background: 'rgba(52,211,153,0.12)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
                        }}>
                            <Check size={24} style={{ color: 'var(--accent-emerald)' }} />
                        </div>
                        <p style={{ fontWeight: 600, color: 'var(--accent-emerald)', marginBottom: 16 }}>パスワードを変更しました</p>
                        <button className="btn btn-ghost" onClick={reset}>閉じる</button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 4 }}>
                            パスワードを変更した場合、すべてのデバイスでサインアウトします。
                        </p>
                        <PasswordField id="cur-pw" label="現在のパスワード" value={current} onChange={setCurrent} autoComplete="current-password" />
                        <PasswordField id="new-pw1" label="新しいパスワード" value={next1} onChange={setNext1} autoComplete="new-password" />
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                            {[
                                { ok: next1.length >= 8 && next1.length <= 32, label: '8文字以上32文字以内' },
                                { ok: /[a-z]/.test(next1), label: '小文字アルファベットを含む' },
                                { ok: /[0-9]/.test(next1), label: '数字を含む' },
                            ].map(({ ok, label }) => (
                                <div key={label} style={{
                                    display: 'flex', alignItems: 'center', gap: 6,
                                    fontSize: 'var(--font-size-xs)',
                                    color: ok ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                }}>
                                    <Check size={11} />{label}
                                </div>
                            ))}
                        </div>
                        <PasswordField id="new-pw2" label="新しいパスワード（確認）" value={next2} onChange={setNext2} autoComplete="new-password" />
                        <ErrorBox message={error} />
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginTop: 4 }}>
                            <button className="btn btn-ghost" style={{ flex: 1 }} onClick={reset}>キャンセル</button>
                            <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                                {saving ? <><div className="spinner" /> 変更中…</> : '変更する'}
                            </button>
                        </div>
                    </div>
                )}
            </ExpandPanel>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// PASSKEY SECTION
// ═══════════════════════════════════════════════════════════════════
function PasskeySection({ passkeyList, setPasskeyList }) {
    const { user, userData } = useAuth();
    const [addOpen, setAddOpen] = useState(false);
    const [addStatus, setAddStatus] = useState('idle');
    const [addError, setAddError] = useState('');
    const [renaming, setRenaming] = useState(null); // passkey object
    const [deleteError, setDeleteError] = useState('');

    const handleRegister = async () => {
        setAddStatus('loading');
        setAddError('');
        try {
            const fn = callFunction('registerPasskeyChallenge');
            const { data: challengeData } = await fn({ uid: user.uid, displayName: userData?.nickname || user.email });
            const attestation = await registerPasskey(challengeData);
            const verifyFn = callFunction('verifyPasskeyRegistration');
            await verifyFn({ uid: user.uid, attestation });
            setAddStatus('done');
        } catch (err) {
            if (err.name !== 'NotAllowedError') {
                setAddError(err.message || 'パスキーの追加に失敗しました');
                setAddStatus('error');
            } else {
                setAddStatus('idle');
            }
        }
    };

    const handleDelete = async (credentialId) => {
        setDeleteError('');
        try {
            await callFunction('deletePasskey')({ credentialId });
            setPasskeyList(prev => prev.filter(p => p.id !== credentialId));
        } catch (err) {
            setDeleteError(err.message || 'パスキーの削除に失敗しました');
        }
    };

    return (
        <div className="section-card" style={{ marginBottom: 'var(--spacing-xl)', overflow: 'hidden' }}>
            <div className="section-header" style={{ justifyContent: 'space-between' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                    <Fingerprint size={18} style={{ color: 'var(--accent-indigo)' }} />
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>パスキー</div>
                </div>
                <button className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: 'var(--font-size-sm)' }}
                    onClick={() => { setAddOpen(o => !o); setAddStatus('idle'); setAddError(''); }}>
                    <Plus size={14} /> 追加
                </button>
            </div>

            {/* Add passkey expandable */}
            <ExpandPanel open={addOpen}>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', gap: 'var(--spacing-md)' }}>
                    <div style={{
                        width: 56, height: 56, borderRadius: '50%',
                        background: 'rgba(99,102,241,0.12)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <Fingerprint size={28} style={{ color: 'var(--accent-indigo)' }} />
                    </div>
                    {addStatus === 'done' ? (
                        <>
                            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(52,211,153,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto' }}>
                                <Check size={24} style={{ color: 'var(--accent-emerald)' }} />
                            </div>
                            <p style={{ color: 'var(--accent-emerald)', fontWeight: 600 }}>パスキーを追加しました</p>
                            <button className="btn btn-ghost" onClick={() => { setAddOpen(false); setAddStatus('idle'); }}>閉じる</button>
                        </>
                    ) : (
                        <>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.7, maxWidth: 320 }}>
                                デバイスの生体認証（Face ID・Touch ID など）でパスキーを登録します。
                            </p>
                            <ErrorBox message={addError} />
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', width: '100%', maxWidth: 340 }}>
                                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setAddOpen(false)}>キャンセル</button>
                                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleRegister} disabled={addStatus === 'loading'}>
                                    {addStatus === 'loading' ? <><div className="spinner" /> 設定中…</> : <><Fingerprint size={16} /> 追加する</>}
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </ExpandPanel>

            {/* Passkey list */}
            <div className="section-body">
                {passkeyList.length === 0 ? (
                    <div style={{ padding: 'var(--spacing-xl)', textAlign: 'center', color: 'var(--text-muted)', fontSize: 'var(--font-size-sm)' }}>
                        登録済みのパスキーはありません
                    </div>
                ) : (
                    passkeyList.map((pk) => (
                        <div key={pk.id}>
                            <div className="passkey-item">
                                <div style={{
                                    width: 36, height: 36, borderRadius: 'var(--radius-sm)',
                                    background: 'rgba(99,102,241,0.08)',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
                                }}>
                                    <Fingerprint size={18} style={{ color: 'var(--accent-indigo)' }} />
                                </div>
                                <div style={{ flex: 1 }}>
                                    <div style={{ fontWeight: 500, fontSize: 'var(--font-size-sm)' }}>{pk.name || 'パスキー'}</div>
                                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)' }}>
                                        登録日: {pk.createdAt ? new Date(pk.createdAt).toLocaleDateString('ja-JP') : '不明'}
                                    </div>
                                </div>
                                <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: 'var(--font-size-xs)' }}
                                    onClick={() => setRenaming(renaming?.id === pk.id ? null : pk)}>
                                    <Pencil size={13} /> 名前変更
                                </button>
                                <button className="btn btn-danger" style={{ padding: '6px 12px', fontSize: 'var(--font-size-xs)' }}
                                    onClick={() => handleDelete(pk.id)}>
                                    <Trash2 size={13} /> 削除
                                </button>
                            </div>

                            {/* Inline rename form */}
                            <ExpandPanel open={renaming?.id === pk.id}>
                                <RenameInline passkey={pk}
                                    onClose={() => setRenaming(null)}
                                    onRenamed={(id, name) => {
                                        setPasskeyList(prev => prev.map(p => p.id === id ? { ...p, name } : p));
                                        setRenaming(null);
                                    }} />
                            </ExpandPanel>
                        </div>
                    ))
                )}
                {deleteError && (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 8, marginTop: 12,
                        background: 'rgba(244,63,94,0.07)', border: '1px solid rgba(244,63,94,0.2)',
                        borderRadius: 'var(--radius-sm)', padding: '10px 14px',
                        fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)', lineHeight: 1.6,
                    }}>
                        <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 2 }} />
                        {deleteError}
                    </div>
                )}
            </div>
        </div>
    );
}

// ── Inline rename form ─────────────────────────────────────────────
function RenameInline({ passkey, onClose, onRenamed }) {
    const [name, setName] = useState(passkey.name || '');
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    const handleSave = async () => {
        const trimmed = name.trim();
        if (!trimmed) { setError('名前を入力してください'); return; }
        if (trimmed.length > 30) { setError('30文字以内で入力してください'); return; }
        setSaving(true);
        setError('');
        try {
            await callFunction('renamePasskey')({ credentialId: passkey.id, name: trimmed });
            onRenamed(passkey.id, trimmed);
        } catch (err) {
            setError(err.message || '名前の変更に失敗しました');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)' }}>
            <div className="input-group">
                <label className="input-label">パスキーの名前</label>
                <input className="input-field" value={name} onChange={e => setName(e.target.value)}
                    maxLength={30} autoFocus disabled={saving}
                    onKeyDown={e => { if (e.key === 'Enter') handleSave(); }}
                    placeholder="例: iPhone 15 Pro" />
            </div>
            <ErrorBox message={error} />
            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={onClose}>キャンセル</button>
                <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleSave} disabled={saving}>
                    {saving ? <><div className="spinner" /> 保存中…</> : '変更する'}
                </button>
            </div>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// GOOGLE LINK ROW
// ═══════════════════════════════════════════════════════════════════
function GoogleLinkRow() {
    const { userData } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [linked, setLinked] = useState(userData?.googleLinked || false);

    const GoogleSvg = () => (
        <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0 }}>
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
        </svg>
    );

    const handleLink = async () => {
        setLoading(true); setError('');
        try {
            await linkWithPopup(auth.currentUser, googleProvider);
            await callFunction('linkGoogle')({});
            setLinked(true);
        } catch (err) {
            if (err.code === 'auth/provider-already-linked') {
                try { await callFunction('linkGoogle')({}); setLinked(true); } catch (_) { }
            } else if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setError(err.message || 'Google連携に失敗しました');
            }
        } finally { setLoading(false); }
    };

    const handleUnlink = async () => {
        setLoading(true); setError('');
        try { await callFunction('unlinkGoogle')({}); setLinked(false); }
        catch (err) { setError(err.message || '解除に失敗しました'); }
        finally { setLoading(false); }
    };

    return (
        <div style={{ padding: 'var(--spacing-lg) 0' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)', marginBottom: error ? 12 : 0 }}>
                <GoogleSvg />
                <span style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}>
                    {linked ? 'Googleアカウントと連携済み' : 'Googleアカウントと未連携'}
                </span>
                {linked ? <span className="badge badge-approved">連携中</span>
                    : <span className="badge badge-pending">未連携</span>}
                {linked ? (
                    <button className="btn btn-danger" style={{ padding: '7px 14px', fontSize: 'var(--font-size-xs)' }}
                        onClick={handleUnlink} disabled={loading}>
                        {loading ? <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} /> : '連携を解除'}
                    </button>
                ) : (
                    <button className="btn btn-google" style={{ width: 'auto', padding: '7px 16px', fontSize: 'var(--font-size-xs)', gap: 6 }}
                        onClick={handleLink} disabled={loading}>
                        {loading ? <div className="spinner spinner-dark" style={{ width: 14, height: 14 }} />
                            : <><GoogleSvg /> Googleで連携</>}
                    </button>
                )}
            </div>
            {error && (
                <div style={{ display: 'flex', gap: 6, fontSize: 'var(--font-size-xs)', color: 'var(--accent-rose)', alignItems: 'center', marginTop: 8 }}>
                    <AlertCircle size={12} />{error}
                </div>
            )}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════
// MAIN SecurityPage
// ═══════════════════════════════════════════════════════════════════
export default function SecurityPage() {
    const { userData } = useAuth();
    const passkeys = userData?.passkeys || [];
    const [passkeyList, setPasskeyList] = useState(passkeys);

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">セキュリティ</h1>
                <p className="page-subtitle">パスワード・パスキー・Google連携の確認と変更</p>
            </div>

            <PasswordSection />
            <PasskeySection passkeyList={passkeyList} setPasskeyList={setPasskeyList} />

            {/* Google section */}
            <div className="section-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="section-header">
                    <svg width="18" height="18" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
                        <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z" />
                        <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z" />
                        <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z" />
                        <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z" />
                        <path fill="none" d="M0 0h48v48H0z" />
                    </svg>
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>Google連携</div>
                </div>
                <div className="section-body" style={{ padding: '0 var(--spacing-xl)' }}>
                    <GoogleLinkRow />
                </div>
            </div>
        </div>
    );
}
