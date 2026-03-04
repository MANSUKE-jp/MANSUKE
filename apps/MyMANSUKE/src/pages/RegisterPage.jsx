import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { signInWithPopup, linkWithPopup, signInWithCustomToken } from 'firebase/auth';
import {
    Check, ChevronRight, ChevronLeft, AlertCircle, ChevronDown,
    Eye, EyeOff, User, Mail, Phone, Lock, AtSign, Calendar,
    Fingerprint, Sparkles, ExternalLink, Camera
} from 'lucide-react';
import { auth, googleProvider, callFunction } from '../firebase';
import { validatePassword, validateNickname, isPasswordValid, isNicknameValid, isEmailValid, isPhoneValid } from '../utils/validators';
import { registerPasskey, isPasskeySupported, getPasskeyErrorMessage } from '../utils/passkey';
import ImageCropperModal from '../../../../shared/components/ImageCropperModal';
import { uploadProfilePicture } from '../utils/storage';

const TOTAL_STEPS = 11;

// ── Step Progress Bar ──────────────────────────────────────────────────
function StepBar({ current }) {
    return (
        <div style={{ marginBottom: 'var(--spacing-xl)' }}>
            <div style={{
                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                fontWeight: 600, marginBottom: 'var(--spacing-sm)',
                letterSpacing: '0.06em',
            }}>
                ステップ {current} / {TOTAL_STEPS}
            </div>
            <div style={{ display: 'flex', gap: 4 }}>
                {Array.from({ length: TOTAL_STEPS }, (_, i) => (
                    <div
                        key={i}
                        style={{
                            flex: i + 1 === current ? 3 : 1,
                            height: 4,
                            borderRadius: 9999,
                            background: i + 1 < current
                                ? 'var(--accent-emerald)'
                                : i + 1 === current
                                    ? 'var(--gradient-primary)'
                                    : 'var(--border)',
                            backgroundImage: i + 1 === current ? 'var(--gradient-primary)' : undefined,
                            transition: 'all 0.4s cubic-bezier(0.34,1.56,0.64,1)',
                        }}
                    />
                ))}
            </div>
        </div>
    );
}

// ── Checkbox Row ───────────────────────────────────────────────────────
function CheckboxRow({ checked, onChange, children }) {
    return (
        <div
            className={`checkbox-wrapper${checked ? ' checked' : ''}`}
            onClick={() => onChange(!checked)}
            role="checkbox"
            aria-checked={checked}
            tabIndex={0}
            onKeyDown={e => e.key === ' ' && onChange(!checked)}
        >
            <div className={`checkbox-box${checked ? ' checked' : ''}`}>
                {checked && <Check size={12} color="#fff" strokeWidth={3} />}
            </div>
            <span style={{ fontSize: 'var(--font-size-sm)', lineHeight: 1.6, flex: 1 }}>
                {children}
            </span>
        </div>
    );
}

function CustomSelect({ value, onChange, options, placeholder, maxH = 240 }) {
    const [open, setOpen] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <div
                className="input-field"
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px' }}
                onClick={() => setOpen(!open)}
            >
                <span style={{ color: value ? 'var(--text)' : 'var(--text-3)' }}>
                    {value ? options.find(o => String(o.value) === String(value))?.label : placeholder}
                </span>
                <ChevronDown size={16} style={{ transform: open ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s cubic-bezier(0.4, 0, 0.2, 1)', color: 'var(--text-3)' }} />
            </div>
            {open && (
                <>
                    <div style={{ position: 'fixed', inset: 0, zIndex: 90 }} onClick={() => setOpen(false)} />
                    <div style={{
                        position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
                        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                        maxHeight: maxH, overflowY: 'auto', zIndex: 100,
                        boxShadow: 'var(--shadow-lg)',
                        padding: '8px 0'
                    }}>
                        <div
                            style={{ padding: '12px 20px', cursor: 'pointer', fontSize: 'var(--font-size-base)', color: 'var(--text-3)' }}
                            onClick={() => { onChange(''); setOpen(false); }}
                        >
                            {placeholder}
                        </div>
                        {options.map(opt => (
                            <div
                                key={opt.value}
                                style={{
                                    padding: '12px 20px', cursor: 'pointer', fontSize: 'var(--font-size-base)',
                                    background: String(value) === String(opt.value) ? 'var(--surface-2)' : 'transparent',
                                    color: String(value) === String(opt.value) ? 'var(--ink)' : 'var(--text-2)',
                                    fontWeight: String(value) === String(opt.value) ? 600 : 400,
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => {
                                    if (String(value) !== String(opt.value)) e.target.style.background = 'var(--surface-2)';
                                }}
                                onMouseLeave={(e) => {
                                    if (String(value) !== String(opt.value)) e.target.style.background = 'transparent';
                                }}
                                onClick={() => { onChange(opt.value); setOpen(false); }}
                            >
                                {opt.label}
                            </div>
                        ))}
                    </div>
                </>
            )}
        </div>
    );
}

function DatePicker({ value, onChange }) {
    const { year, month, day } = value;

    const years = Array.from({ length: 120 }, (_, i) => new Date().getFullYear() - i);
    const months = Array.from({ length: 12 }, (_, i) => i + 1);
    const days = Array.from({ length: 31 }, (_, i) => i + 1);

    return (
        <div className="date-picker" style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <div style={{ flex: 2 }}>
                <div className="input-label" style={{ marginBottom: 8 }}>年</div>
                <CustomSelect
                    value={year}
                    onChange={v => onChange({ ...value, year: v })}
                    options={years.map(y => ({ value: y, label: y }))}
                    placeholder="YYYY"
                />
            </div>
            <div style={{ flex: 1 }}>
                <div className="input-label" style={{ marginBottom: 8 }}>月</div>
                <CustomSelect
                    value={month}
                    onChange={v => onChange({ ...value, month: v })}
                    options={months.map(m => ({ value: m, label: String(m).padStart(2, '0') }))}
                    placeholder="MM"
                />
            </div>
            <div style={{ flex: 1 }}>
                <div className="input-label" style={{ marginBottom: 8 }}>日</div>
                <CustomSelect
                    value={day}
                    onChange={v => onChange({ ...value, day: v })}
                    options={days.map(d => ({ value: d, label: String(d).padStart(2, '0') }))}
                    placeholder="DD"
                />
            </div>
        </div>
    );
}

// ── PasswordInput with toggle ──────────────────────────────────────────
function PasswordInput({ value, onChange, id, placeholder, autoComplete }) {
    const [show, setShow] = useState(false);
    return (
        <div style={{ position: 'relative' }}>
            <input
                id={id}
                className="input-field"
                type={show ? 'text' : 'password'}
                value={value}
                onChange={e => onChange(e.target.value)}
                placeholder={placeholder || '••••••••'}
                autoComplete={autoComplete || 'new-password'}
                style={{ paddingRight: 48 }}
            />
            <button
                type="button"
                onClick={() => setShow(s => !s)}
                style={{
                    position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', padding: 4,
                }}
                tabIndex={-1}
            >
                {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
        </div>
    );
}

// ── Error bubble ───────────────────────────────────────────────────────
function ErrorBox({ errors }) {
    if (!errors || errors.length === 0) return null;
    return (
        <div style={{
            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
            borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)',
            display: 'flex', flexDirection: 'column', gap: 4,
            marginTop: 'var(--spacing-lg)'
        }}>
            {errors.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                    {e}
                </div>
            ))}
        </div>
    );
}

// ────────────────────────────────────────────────────────────────────────
// Register Page
// ────────────────────────────────────────────────────────────────────────

export default function RegisterPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/profile';

    const [step, setStep] = useState(1);
    const [submitting, setSubmitting] = useState(false);
    const [errors, setErrors] = useState([]);

    // Form state
    const [agreedTerms, setAgreedTerms] = useState(false);
    const [agreedPrivacy, setAgreedPrivacy] = useState(false);
    const [lastName, setLastName] = useState('');
    const [firstName, setFirstName] = useState('');
    const [furiganaLast, setFuriganaLast] = useState('');
    const [furiganaFirst, setFuriganaFirst] = useState('');
    const [birthday, setBirthday] = useState({ year: '', month: '', day: '' });
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [password, setPassword] = useState('');
    const [password2, setPassword2] = useState('');
    const [nickname, setNickname] = useState('');
    const [avatarBlob, setAvatarBlob] = useState(null);
    const [imageToCrop, setImageToCrop] = useState(null);
    const fileInputRef = useRef(null);
    const [passkeyDone, setPasskeyDone] = useState(false);
    const [googleLinked, setGoogleLinked] = useState(false);

    const clearErrors = () => setErrors([]);

    // ── Validation per step ──
    const validateStep = async (s) => {
        clearErrors();
        switch (s) {
            case 1:
                if (!agreedTerms || !agreedPrivacy) {
                    setErrors(['MANSUKEの利用規約とプライバシーポリシーへの同意が必要です']);
                    return false;
                }
                return true;
            case 2:
                if (!furiganaLast.trim() || !furiganaFirst.trim()) {
                    setErrors(['フリガナ（セイ・メイ）を入力してください']);
                    return false;
                }
                if (!lastName.trim() || !firstName.trim()) {
                    setErrors(['姓と名を入力してください']);
                    return false;
                }
                return true;
            case 3:
                if (!birthday.year || !birthday.month || !birthday.day) {
                    setErrors(['生年月日を入力してください']);
                    return false;
                }
                return true;
            case 4: {
                if (!isEmailValid(email)) { setErrors(['有効なメールアドレスを入力してください']); return false; }
                setSubmitting(true);
                try {
                    const fn = callFunction('checkEmailUnique');
                    const { data } = await fn({ email });
                    if (!data.unique) { setErrors(['このメールアドレスはすでに使用されています']); return false; }
                } catch { setErrors(['メールアドレスの確認中にエラーが発生しました']); return false; }
                finally { setSubmitting(false); }
                return true;
            }
            case 5: {
                if (!isPhoneValid(phone)) { setErrors(['有効な電話番号を入力してください']); return false; }
                setSubmitting(true);
                try {
                    const fn = callFunction('checkPhoneUnique');
                    const { data } = await fn({ phone });
                    if (!data.unique) { setErrors(['この電話番号はすでに使用されています']); return false; }
                } catch { setErrors(['電話番号の確認中にエラーが発生しました']); return false; }
                finally { setSubmitting(false); }
                return true;
            }
            case 6: {
                const pwErrors = validatePassword(password);
                if (pwErrors.length > 0) { setErrors(pwErrors); return false; }
                if (password !== password2) { setErrors(['パスワードが一致しません']); return false; }
                return true;
            }
            case 7: {
                const nnErrors = validateNickname(nickname);
                if (nnErrors.length > 0) { setErrors(nnErrors); return false; }
                return true;
            }
            default: return true;
        }
    };

    const goNext = async () => {
        const ok = await validateStep(step);
        if (ok) setStep(s => Math.min(s + 1, TOTAL_STEPS));
    };

    const goBack = () => setStep(s => Math.max(s - 1, 1));

    const handleFileChange = (e) => {
        if (e.target.files && e.target.files.length > 0) {
            const file = e.target.files[0];
            const reader = new FileReader();
            reader.addEventListener('load', () => setImageToCrop(reader.result));
            reader.readAsDataURL(file);
        }
        e.target.value = null; // reset
    };

    const handleCropDone = (blob) => {
        setAvatarBlob(blob);
        setImageToCrop(null);
    };

    // ── Step 9: Google link ──
    const handleGoogleLink = async () => {
        setSubmitting(true);
        clearErrors();
        try {
            // We use signInWithPopup to authenticate with Google, 
            // but we don't finalize account creation until Step 10.
            // When we do this, the credential is saved in Firebase Auth.
            // However, this creates a new Firebase Auth user before our form is complete.
            // For a seamless flow without creating orphan users: 
            // The user intends to link. We just simulate linking here, and backend createAccount 
            // will just set linkGoogle: true. We actually don't NEED the popup right now for registration!
            // Actually, to prove they own the Google account, we *should* pop up.
            // But since creating a user via popup bypasses our backend checks, let's just do a popup
            // and delete the temporary user if they abort? No, best to just get their authorization.
            // Let's use linkWithPopup if they were logged in, but they aren't.
            // We will just do a standard Google sign in popup:
            const result = await signInWithPopup(auth, googleProvider);

            // If they signed in with it, they authorized. 
            // BUT wait, this logs them into Firebase right now as the Google user!
            // So we might want to capture their info and pre-fill, or just set flag.
            // For now, since MANSUKE requirements say backend handles creation, doing signInWithPopup on client 
            // creates an auth record before the backend createAccount gets called.
            // To prevent conflicts where `createAccount` hits `email-already-exists`, 
            // if we are doing Google Link in Step 8 AFTER they entered email in Step 4, 
            // we'll run into `email-already-exists` when `createAccount` runs if the Google email matches!

            // To fix this cleanly: we delete the client-side user immediately, just using it as proof of auth.
            const user = result.user;
            await user.delete();

            setGoogleLinked(true);
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setErrors(['Google連携に失敗しました: ' + err.message]);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Step 10: Passkey ──
    const handlePasskeySetup = async () => {
        const supported = await isPasskeySupported();
        if (!supported) {
            setErrors(['このブラウザまたはデバイスはパスキーに対応していません。別のデバイスまたはブラウザをお試しください。']);
            return;
        }
        setSubmitting(true);
        clearErrors();
        try {
            // Temporary challenge for registration preview
            // Real challenge is issued after account creation
            const fn = callFunction('registerPasskeyChallenge');
            const { data: challengeData } = await fn({
                email,
                displayName: email,
            });
            const attestation = await registerPasskey(challengeData);
            const verifyFn = callFunction('verifyPasskeyRegistration');
            await verifyFn({ tempToken: challengeData.tempToken, attestation });
            setPasskeyDone(true);
        } catch (err) {
            const msg = getPasskeyErrorMessage(err);
            if (msg !== null) {
                setErrors([msg]);
            }
        } finally {
            setSubmitting(false);
        }
    };

    // ── Step 11: Submit all data → Firestore ──
    const handleFinalSubmit = async () => {
        setSubmitting(true);
        clearErrors();
        try {
            const fn = callFunction('createAccount');
            const result = await fn({
                lastName,
                firstName,
                furiganaLast,
                furiganaFirst,
                birthday: `${birthday.year}/${String(birthday.month).padStart(2, '0')}/${String(birthday.day).padStart(2, '0')}`,
                email,
                phone,
                password,
                nickname,
                linkGoogle: googleLinked,
            });

            const { customToken } = result.data;
            if (customToken) {
                const userCred = await signInWithCustomToken(auth, customToken);
                
                if (avatarBlob) {
                    try {
                        const url = await uploadProfilePicture(userCred.user.uid, avatarBlob);
                        const fnAvatar = callFunction('mymansukeUpdateAvatarUrl');
                        await fnAvatar({ avatarUrl: url });
                    } catch (e) {
                        console.error("Avatar upload failed during registration:", e);
                    }
                }
            }

            // Redirect to passkey verification, passing along the redirect URL
            navigate('/passkey-verify', { state: { redirect: redirectTo } });
        } catch (err) {
            setErrors([err.message || 'アカウントの作成に失敗しました']);
        } finally {
            setSubmitting(false);
        }
    };

            const stepTitles = {
                1: 'はじめまして！',
                2: 'お名前を教えてください！:D',
                3: '生年月日を教えていただけますか？',
                4: 'メールアドレスをご入力ください。',
                5: '電話番号のご入力もお願いします！',
                6: 'ご希望のパスワードを入力してください。',
                7: 'ニックネームを設定してください。',
                8: 'プロフィール画像を設定しましょう',
                9: 'Googleアカウントと連携することで、さらに便利にログインできます！',
                10: 'パスキーの設定を行ってください。',
                11: 'すべての設定が完了しました！'
            };

            return (
                <div className="auth-page">
                    <div className="bg-orb bg-orb-1" style={{ top: '-10%', right: '-5%' }} />
                    <div className="bg-orb bg-orb-2" style={{ bottom: '-10%', left: '-5%' }} />

                    <div style={{ position: 'fixed', top: 40, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 50 }}>
                        <span className="login-logo">MANSUKE</span>
                        <span className="login-logo-sub" style={{ marginBottom: 0 }}>POWERED BY CERINAL</span>
                    </div>

                    <div className="register-card" style={{ marginTop: 80 }}>
                        
                        <StepBar current={step} />
                        <h2 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, letterSpacing: '-0.03em', marginBottom: 'var(--spacing-xl)' }}>
                            {stepTitles[step]}
                        </h2>

                        <div className="register-form-container page-enter" key={step}>

                    {/* ── STEP 1: Terms ── */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                MANSUKEの規約とポリシーをお読みください。
                            </p>

                            <CheckboxRow checked={agreedTerms} onChange={setAgreedTerms}>
                                <a href="https://legal.mansuke.jp/terms" target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}
                                    onClick={e => e.stopPropagation()}>
                                    利用規約 <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                </a>
                                {' '}に同意する
                            </CheckboxRow>

                            <CheckboxRow checked={agreedPrivacy} onChange={setAgreedPrivacy}>
                                <a href="https://legal.mansuke.jp/privacy" target="_blank" rel="noopener noreferrer"
                                    style={{ color: 'var(--accent-violet)', textDecoration: 'none' }}
                                    onClick={e => e.stopPropagation()}>
                                    プライバシーポリシー <ExternalLink size={11} style={{ display: 'inline', verticalAlign: 'middle' }} />
                                </a>
                                {' '}に同意する
                            </CheckboxRow>

                            <div style={{
                                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                                padding: 'var(--spacing-md)',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                            }}>
                                お客様は、legal.mansuke.jpよりいつでも最新の規約とポリシーを確認することができます。
                            </div>
                        </div>
                    )}

                    {/* ── STEP 2: Name ── */}
                    {step === 2 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label" htmlFor="furi-last">セイ (カタカナ)</label>
                                    <input id="furi-last" className="input-field" type="text" value={furiganaLast}
                                        onChange={e => setFuriganaLast(e.target.value)} placeholder="ヤマダ" />
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label" htmlFor="furi-first">メイ (カタカナ)</label>
                                    <input id="furi-first" className="input-field" type="text" value={furiganaFirst}
                                        onChange={e => setFuriganaFirst(e.target.value)} placeholder="タロウ" />
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label" htmlFor="last-name">姓</label>
                                    <input id="last-name" className="input-field" type="text" value={lastName}
                                        onChange={e => setLastName(e.target.value)} placeholder="山田" />
                                </div>
                                <div className="input-group" style={{ flex: 1 }}>
                                    <label className="input-label" htmlFor="first-name">名</label>
                                    <input id="first-name" className="input-field" type="text" value={firstName}
                                        onChange={e => setFirstName(e.target.value)} placeholder="太郎" />
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 3: Birthday ── */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <DatePicker value={birthday} onChange={setBirthday} />
                        </div>
                    )}

                    {/* ── STEP 4: Email ── */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <div className="input-group">
                                <label className="input-label" htmlFor="email-reg">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Mail size={13} /> メールアドレス</span>
                                </label>
                                <input id="email-reg" className="input-field" type="email" value={email}
                                    onChange={e => setEmail(e.target.value)} placeholder="example@email.com"
                                    autoComplete="email" />
                            </div>
                        </div>
                    )}

                    {/* ── STEP 5: Phone ── */}
                    {step === 5 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <div className="input-group">
                                <label className="input-label" htmlFor="phone-reg">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Phone size={13} /> 電話番号（ハイフンなし）</span>
                                </label>
                                <input id="phone-reg" className="input-field" type="tel" value={phone}
                                    onChange={e => setPhone(e.target.value)} placeholder="09012345678"
                                    autoComplete="tel" />
                            </div>
                        </div>
                    )}

                    {/* ── STEP 6: Password ── */}
                    {step === 6 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <div className="input-group">
                                <label className="input-label" htmlFor="pw1">パスワード</label>
                                <PasswordInput id="pw1" value={password} onChange={setPassword} />
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginTop: 4 }}>
                                    {[
                                        { ok: password.length >= 8 && password.length <= 32, label: '8文字以上32文字以内' },
                                        { ok: /[a-z]/.test(password), label: '小文字アルファベットを含む' },
                                        { ok: /[0-9]/.test(password), label: '数字を含む' },
                                    ].map(({ ok, label }) => (
                                        <div key={label} style={{
                                            display: 'flex', alignItems: 'center', gap: 6,
                                            fontSize: 'var(--font-size-xs)',
                                            color: ok ? 'var(--accent-emerald)' : 'var(--text-muted)',
                                        }}>
                                            <Check size={11} />
                                            {label}
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="input-group">
                                <label className="input-label" htmlFor="pw2">確認のため、再度パスワードを入力してください。</label>
                                <PasswordInput id="pw2" value={password2} onChange={setPassword2}
                                    placeholder="••••••••" autoComplete="new-password" />
                            </div>
                        </div>
                    )}

                    {/* ── STEP 7: Nickname ── */}
                    {step === 7 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <div style={{
                                fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)',
                                padding: 'var(--spacing-sm) var(--spacing-md)',
                                background: 'rgba(255,255,255,0.02)',
                                borderRadius: 'var(--radius-md)',
                                border: '1px solid var(--border)',
                            }}>
                                他のMANSUKEユーザーにも表示されます。マイページよりいつでも変更することができます。
                            </div>
                            <div className="input-group">
                                <label className="input-label" htmlFor="nickname-reg">
                                    <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><AtSign size={13} /> ニックネーム（10文字まで）</span>
                                </label>
                                <input id="nickname-reg" className="input-field" type="text" value={nickname}
                                    onChange={e => setNickname(e.target.value.slice(0, 10))}
                                    placeholder="まんすけ発射"
                                    maxLength={10} />
                                <div className="input-hint">{nickname.length} / 10</div>
                            </div>
                        </div>
                    )}

                    {/* ── STEP 8: Profile Picture ── */}
                    {step === 8 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)', alignItems: 'center' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', width: '100%' }}>
                                設定しない場合は、後からマイページで変更できます。
                            </p>
                            <div style={{
                                width: 140, height: 140, borderRadius: '50%', background: 'var(--surface-2)',
                                display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                                border: '2px dashed var(--border)', cursor: 'pointer', position: 'relative'
                            }} onClick={() => fileInputRef.current?.click()}>
                                {avatarBlob ? (
                                    <img src={URL.createObjectURL(avatarBlob)} alt="Preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                ) : (
                                    <Camera size={36} style={{ color: 'var(--text-3)' }} />
                                )}
                            </div>
                            <input
                                type="file"
                                accept=".jpg,.jpeg,.png,.webp,.heic"
                                style={{ display: 'none' }}
                                ref={fileInputRef}
                                onChange={handleFileChange}
                            />
                            <button className="btn btn-secondary" onClick={() => fileInputRef.current?.click()}>
                                画像を選択する
                            </button>
                            {imageToCrop && (
                                <ImageCropperModal
                                    imageSrc={imageToCrop}
                                    onCropDone={handleCropDone}
                                    onCancel={() => setImageToCrop(null)}
                                />
                            )}
                        </div>
                    )}

                    {/* ── STEP 9: Google Link ── */}
                    {step === 9 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-lg)' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                ご希望の場合は、以下のボタンを押してください。
                            </p>

                            {googleLinked ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: 'var(--spacing-lg)',
                                    background: 'rgba(52,211,153,0.08)',
                                    border: '1px solid rgba(52,211,153,0.25)',
                                    borderRadius: 'var(--radius-md)',
                                }}>
                                    <Check size={20} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
                                    <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                                        Googleアカウントとの連携設定が完了しました
                                    </span>
                                </div>
                            ) : (
                                <button className="btn btn-google btn-full" onClick={handleGoogleLink}>
                                    <GoogleIcon />
                                    Googleアカウントで連携する
                                </button>
                            )}

                        </div>
                    )}

                    {/* ── STEP 10: Passkey ── */}
                    {step === 10 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-xl)' }}>
                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                                アカウントのセキュリティを強化するため、ご登録時にパスキーのご登録をお願いしております。
                            </p>

                            {passkeyDone ? (
                                <div style={{
                                    display: 'flex', alignItems: 'center', gap: 12,
                                    padding: 'var(--spacing-lg)',
                                    background: 'rgba(52,211,153,0.08)',
                                    border: '1px solid rgba(52,211,153,0.25)',
                                    borderRadius: 'var(--radius-md)',
                                }}>
                                    <Check size={20} style={{ color: 'var(--accent-emerald)', flexShrink: 0 }} />
                                    <div>
                                        <div style={{ fontSize: 'var(--font-size-sm)', fontWeight: 600, color: 'var(--accent-emerald)' }}>
                                            パスキーの設定が完了しました
                                        </div>
                                        <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                                            2段階認証の手段として登録されています。
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <button
                                    className="btn btn-primary btn-full"
                                    onClick={handlePasskeySetup}
                                    disabled={submitting}
                                >
                                    {submitting ? (
                                        <><div className="spinner" /> 設定中...</>
                                    ) : (
                                        <><Fingerprint size={18} /> パスキーを設定する</>
                                    )}
                                </button>
                            )}
                        </div>
                    )}

                    {/* ── STEP 11: Done ── */}
                    {step === 11 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-md)', textAlign: 'center' }}>
                            <div style={{ fontSize: 64, marginBottom: 'var(--spacing-md)' }}>✅</div>
                            <p style={{ fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)' }}>
                                次に、メールアドレス・電話番号とセルフィーの確認を行います。
                            </p>
                            {/* Summary */}
                            <div style={{
                                textAlign: 'left', background: 'rgba(255,255,255,0.03)',
                                border: '1px solid var(--border)', borderRadius: 'var(--radius-md)',
                                padding: 'var(--spacing-xl)',
                                display: 'flex', flexDirection: 'column', gap: 16,
                            }}>
                                {[
                                    { label: 'お名前', value: `${lastName} ${firstName}` },
                                    { label: 'フリガナ', value: `${furiganaLast} ${furiganaFirst}` },
                                    { label: 'メールアドレス', value: email },
                                    { label: '電話番号', value: phone },
                                    { label: 'ニックネーム', value: nickname },
                                ].map(({ label, value }) => (
                                    <div key={label} style={{ display: 'flex', gap: 24, fontSize: 'var(--font-size-md)' }}>
                                        <span style={{ color: 'var(--text-muted)', flex: '0 0 160px' }}>{label}</span>
                                        <span style={{ fontWeight: 500 }}>{value}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <ErrorBox errors={errors} />

                    {/* Navigation buttons */}
                    <div style={{
                        display: 'flex', gap: 'var(--spacing-md)',
                        marginTop: 'var(--spacing-xl)',
                    }}>
                        {step > 1 && step < 11 && (
                            <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={goBack}>
                                <ChevronLeft size={18} />
                            </button>
                        )}

                        {step < 10 && (
                            <button
                                className="btn btn-primary btn-full"
                                onClick={goNext}
                                disabled={submitting}
                                style={{ flex: 1 }}
                            >
                                {submitting ? (
                                    <><div className="spinner" /> 確認中...</>
                                ) : (
                                    <>{(step === 9 && !googleLinked) || (step === 8 && !avatarBlob) ? 'スキップ' : '次へ'} <ChevronRight size={16} /></>
                                )}
                            </button>
                        )}

                        {step === 10 && passkeyDone && (
                            <button className="btn btn-primary btn-full" onClick={goNext} style={{ flex: 1 }}>
                                次へ <ChevronRight size={16} />
                            </button>
                        )}

                        {step === 11 && (
                            <button
                                className="btn btn-primary btn-full"
                                onClick={handleFinalSubmit}
                                disabled={submitting}
                                style={{ flex: 1 }}
                            >
                                {submitting ? (
                                    <><div className="spinner" /> 送信中...</>
                                ) : (
                                    <><Sparkles size={16} /> MANSUKEアカウントを作成する</>
                                )}
                            </button>
                        )}
                    </div>

                    {/* Login link */}
                    {step === 1 && (
                        <div style={{ textAlign: 'center', marginTop: 'var(--spacing-lg)', fontSize: 'var(--font-size-sm)', color: 'var(--text-muted)' }}>
                            すでにアカウントをお持ちの方は{' '}
                            <Link to="/login" style={{ color: 'var(--accent-violet)', textDecoration: 'none', fontWeight: 600 }}>
                                ログイン
                            </Link>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="18" height="18" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
    );
}