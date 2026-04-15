import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { KeyRound, ShieldCheck, AlertCircle, ArrowRight } from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth, callFunction } from '../firebase';
import { authenticatePasskey, isPasskeySupported, getPasskeyErrorMessage } from '../utils/passkey';

export default function PasskeyVerify() {
    const { user, userData, setPasskeyVerified } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const redirectTo = location.state?.redirect || '/';
    const isAppMode = location.state?.appMode || false;
    const callbackScheme = location.state?.callback || '';

    const handleSignOut = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (err) {
            // silent
        }
    };

    const [status, setStatus] = useState('loading-context'); // idle | loading | error | loading-context
    const [error, setError] = useState('');
    const [supported, setSupported] = useState(null); // null = checking

    // アプリモード時のコールバック処理
    const handleAppCallback = async (currentUser) => {
        try {
            const idToken = await currentUser.getIdToken(true);
            if (callbackScheme) {
                window.location.href = `${callbackScheme}?token=${encodeURIComponent(idToken)}`;
            }
        } catch (err) {
            console.error('Failed to get ID token for app callback:', err);
        }
    };

    useEffect(() => {
        if (!user || userData === null) return;
        const passkeys = userData.passkeys || [];
        if (passkeys.length === 0) {
            const skipVerification = async () => {
                setPasskeyVerified(true);

                // アプリモード時はトークンをアプリに返す
                if (isAppMode && callbackScheme) {
                    await handleAppCallback(user);
                    return;
                }

                const token = await user.getIdToken();
                const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
                const domainStr = isLocalhost ? '' : 'domain=.mansuke.jp;';
                document.cookie = `__session=${token}; ${domainStr} path=/; max-age=3600; secure; samesite=lax`;

                if (redirectTo.startsWith('http')) {
                    try {
                        const urlObj = new URL(redirectTo);
                        if (urlObj.hostname.endsWith('.mansuke.jp') || urlObj.hostname.endsWith('.web.app') || urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                            window.location.href = redirectTo;
                            return;
                        }
                    } catch (e) {}
                }
                navigate(redirectTo, { replace: true });
            };
            skipVerification();
        } else {
            if (status === 'loading-context') setStatus('idle');
        }
    }, [userData, user, redirectTo, navigate, setPasskeyVerified, status, isAppMode, callbackScheme]);

    useEffect(() => {
        let cancelled = false;
        isPasskeySupported().then(result => {
            if (!cancelled) setSupported(result);
        });
        return () => { cancelled = true; };
    }, []);

    const handleVerify = async () => {
        setStatus('loading');
        setError('');
        try {
            // 1. Cloud Functionからチャレンジを取得する
            const getChallengeF = callFunction('getPasskeyAuthChallenge');
            const { data: challengeData } = await getChallengeF({ uid: user.uid });

            // 2. パスキーで認証する（WebAuthn）
            const assertion = await authenticatePasskey(challengeData);

            // 3. Cloud Functionで検証する
            const verifyF = callFunction('verifyPasskeyAuth');
            await verifyF({ uid: user.uid, assertion });

            setPasskeyVerified(true);

            // アプリモード時はトークンをアプリに返す
            if (isAppMode && callbackScheme) {
                await handleAppCallback(user);
                return;
            }

            // 他のMANSUKEアプリへのリダイレクト用Cookie
            const token = await user.getIdToken();
            const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
            const domainStr = isLocalhost ? '' : 'domain=.mansuke.jp;';
            document.cookie = `__session=${token}; ${domainStr} path=/; max-age=3600; secure; samesite=lax`;

            if (redirectTo.startsWith('http')) {
                try {
                    const urlObj = new URL(redirectTo);
                    if (urlObj.hostname.endsWith('.mansuke.jp') || urlObj.hostname.endsWith('.web.app') || urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                        window.location.href = redirectTo;
                        return;
                    }
                } catch (e) {
                    // URL形式不詳、無視
                }
            }

            navigate(redirectTo, { replace: true });
        } catch (err) {
            const msg = getPasskeyErrorMessage(err);
            if (msg === null) {
                // ユーザーがキャンセルした
                setStatus('idle');
            } else {
                setError(msg);
                setStatus('error');
            }
        }
    };

    return (
        <div className="auth-page">
            {/* 背景装飾 */}
            <div className="bg-orb bg-orb-1" style={{ top: '-10%', right: '-5%' }} />
            <div className="bg-orb bg-orb-2" style={{ bottom: '-10%', left: '-5%' }} />

            <div className="login-card" style={{ textAlign: 'center' }}>
                {/* アイコン */}
                <div style={{
                    width: 80, height: 80,
                    margin: '0 auto var(--spacing-xl)',
                    borderRadius: '50%',
                    background: 'rgba(99,102,241,0.12)',
                    border: '1px solid rgba(99,102,241,0.25)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <KeyRound size={36} style={{ color: 'var(--accent-indigo)' }} />
                </div>

                <div>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 'var(--spacing-md)' }}>
                        <ShieldCheck size={20} style={{ color: 'var(--accent-emerald)' }} />
                        <span style={{ fontSize: 'var(--font-size-sm)', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                            セキュリティ確認
                        </span>
                    </div>

                    <h1 style={{
                        fontSize: 'var(--font-size-xl)', fontWeight: 800,
                        marginBottom: 'var(--spacing-md)', letterSpacing: '-0.02em',
                    }}>
                        パスキーでご本人確認を<br />行ってください
                    </h1>

                    <p style={{
                        fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)',
                        marginBottom: 'var(--spacing-xl)', lineHeight: 1.7,
                    }}>
                        ログインの最終確認として、登録済みのパスキーを使用して本人確認を行います。デバイスの生体認証を使用してください。
                    </p>

                    {supported === false && (
                        <div style={{
                            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                            borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)',
                            marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-sm)',
                            color: 'var(--accent-rose)', textAlign: 'left',
                        }}>
                            このブラウザまたはデバイスはパスキーに対応していません。最新のブラウザをご使用いただくか、別のデバイスでお試しください。
                        </div>
                    )}

                    {status === 'error' && (
                        <div style={{
                            display: 'flex', alignItems: 'flex-start', gap: 10,
                            background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                            borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)',
                            marginBottom: 'var(--spacing-lg)',
                            fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)', textAlign: 'left',
                        }}>
                            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                            {error}
                        </div>
                    )}

                    <button
                        className="btn btn-primary btn-full"
                        onClick={handleVerify}
                        disabled={status === 'loading' || status === 'loading-context' || supported !== true}
                    >
                        {status === 'loading' || status === 'loading-context' ? (
                            <><div className="spinner" /> 確認中...</>
                        ) : (
                            <>パスキーで確認する <ArrowRight size={16} /></>
                        )}
                    </button>

                    <div style={{
                        marginTop: 'var(--spacing-lg)',
                        fontSize: 'var(--font-size-xs)',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        flexWrap: 'wrap',
                        gap: 6,
                    }}>
                        <span style={{
                            wordBreak: 'break-all',
                            textAlign: 'center'
                        }}>
                            {user?.email}のMANSUKEアカウントにログインしています
                        </span>
                        <button
                            type="button"
                            onClick={handleSignOut}
                            style={{
                                background: 'none', border: 'none', padding: 0,
                                fontSize: 'inherit', color: 'var(--accent-indigo)',
                                cursor: 'pointer', textDecoration: 'underline',
                                flexShrink: 0
                            }}
                        >
                            ログアウト
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
