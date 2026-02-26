import React, { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { signInWithEmailAndPassword, signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '../firebase';
import { AlertCircle, ArrowRight } from 'lucide-react';

export default function LoginPage() {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const redirectTo = searchParams.get('redirect') || '/';

    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleLogin = async e => {
        e.preventDefault();
        setError(''); setLoading(true);
        try {
            await signInWithEmailAndPassword(auth, email, pass);
            navigate('/passkey-verify', { state: { redirect: redirectTo } });
        } catch (err) {
            setError(getErrorMessage(err.code));
        } finally { setLoading(false); }
    };

    const handleGoogle = async () => {
        setError(''); setLoading(true);
        try {
            const cred = await signInWithPopup(auth, googleProvider);
            const uid = cred.user.uid;

            // Verify this Google account is linked to a MANSUKE account
            // The users Firestore has googleLinked:true for linked accounts
            // We check Firestore via a custom token approach: if the uid exists
            // in users collection AND googleLinked=true, allow login.
            const { getFirestore, getDoc, doc } = await import('firebase/firestore');
            const { getApp } = await import('firebase/app');
            const fsdb = getFirestore(getApp(), 'users');
            const userDoc = await getDoc(doc(fsdb, 'users', uid));

            if (!userDoc.exists() || !userDoc.data()?.googleLinked) {
                // このGoogleアカウントはどのMANSUKEアカウントとも連携されていない
                // Firebase AuthからGoogleユーザーを削除してからサインアウト
                try {
                    const { getFunctions, httpsCallable } = await import('firebase/functions');
                    const fns = getFunctions();
                    await httpsCallable(fns, 'deleteUnlinkedGoogleUser')();
                } catch (deleteErr) {
                    // silent
                } finally {
                    await import('firebase/auth').then(({ signOut: so }) => so(auth));
                }
                setError('このGoogleアカウントはどのMANSUKEアカウントとも連携されていません。メールアドレスとパスワードでログインし、セキュリティページからGoogle連携を行ってください。');
                return;
            }

            navigate('/passkey-verify', { state: { redirect: redirectTo } });
        } catch (err) {
            if (err.code !== 'auth/popup-closed-by-user' && err.code !== 'auth/cancelled-popup-request') {
                setError(getErrorMessage(err.code));
            }
        } finally { setLoading(false); }
    };

    return (
        <div className="auth-page">
            {/* 背景の光るオーブを追加 */}
            <div className="bg-orb bg-orb-1" style={{ top: '-10%', right: '-5%' }} />
            <div className="bg-orb bg-orb-2" style={{ bottom: '-10%', left: '-5%' }} />

            <div className="login-card">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 'var(--spacing-xl)' }}>
                    <span className="login-logo">MANSUKE</span>
                    <span className="login-logo-sub" style={{ marginBottom: 0 }}>Powered By Cerinal</span>
                </div>

                <h1 className="login-title">ログイン</h1>

                {error && (
                    <div className="error-box">
                        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 2 }} />
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    <div className="input-group">
                        <label className="input-label" htmlFor="login-email">メールアドレス</label>
                        <input id="login-email" className="input-field" type="text"
                            value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="example@email.com" required autoComplete="username"
                        />
                    </div>
                    <div className="input-group">
                        <label className="input-label" htmlFor="login-pass">パスワード</label>
                        <input id="login-pass" className="input-field" type="password"
                            value={pass} onChange={e => setPass(e.target.value)}
                            placeholder="••••••••" required autoComplete="current-password"
                        />
                    </div>
                    <button type="submit" className="btn btn-primary btn-full" disabled={loading}
                        style={{ marginTop: 4 }}>
                        {loading ? <div className="spinner" /> : <>ログイン <ArrowRight size={14} /></>}
                    </button>
                </form>

                <div className="auth-divider">
                    <span>または</span>
                </div>

                <button className="btn-google" onClick={handleGoogle} disabled={loading}>
                    <GoogleIcon /> Googleでログイン
                </button>

                <div style={{
                    marginTop: 24, paddingTop: 20,
                    borderTop: '1px solid rgba(15, 23, 42, 0.1)',
                }}>
                    <p style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 10, textAlign: 'center' }}>
                        アカウントをお持ちでないですか？
                    </p>
                    <button className="btn btn-secondary btn-full"
                        onClick={() => navigate(`/register?redirect=${encodeURIComponent(redirectTo)}`)}>
                        アカウントを作成する
                    </button>
                </div>
            </div>
        </div>
    );
}

function GoogleIcon() {
    return (
        <svg width="16" height="16" viewBox="0 0 18 18">
            <path fill="#4285F4" d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 01-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 009 18z" />
            <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 013.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 000 9c0 1.452.348 2.827.957 4.042l3.007-2.332z" />
            <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 00.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
        </svg>
    );
}

function getErrorMessage(code) {
    const map = {
        'auth/user-not-found': 'メールアドレスまたはパスワードが正しくありません',
        'auth/wrong-password': 'メールアドレスまたはパスワードが正しくありません',
        'auth/invalid-credential': 'メールアドレスまたはパスワードが正しくありません',
        'auth/too-many-requests': 'しばらく時間をおいてから再度お試しください',
        'auth/user-disabled': 'このアカウントは無効です',
        'auth/network-request-failed': 'ネットワークエラーが発生しました',
    };
    return map[code] || 'ログインに失敗しました。もう一度お試しください。';
}