import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle } from 'lucide-react';

export default function SsoRedirect() {
    const { user, passkeyVerified } = useAuth();
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const [error, setError] = useState('');

    useEffect(() => {
        const processSso = async () => {
            const redirectParam = searchParams.get('redirect');

            if (!redirectParam) {
                navigate('/', { replace: true });
                return;
            }

            if (!user || !passkeyVerified) {
                // Should not happen if wrapped in RequireAuth, but safety check
                navigate(`/login?redirect=${encodeURIComponent(redirectParam)}`, { replace: true });
                return;
            }

            try {
                const urlObj = new URL(redirectParam);
                // Only allow SSO to trusted MANSUKE domains and localhost
                if (
                    urlObj.hostname.endsWith('.mansuke.jp') ||
                    urlObj.hostname.endsWith('.web.app') ||
                    urlObj.hostname === 'localhost' ||
                    urlObj.hostname === '127.0.0.1'
                ) {
                    // Generate a fresh ID token to pass to the target app
                    const token = await user.getIdToken(true);

                    // Append the token to the redirect URL
                    urlObj.searchParams.set('token', token);

                    window.location.href = urlObj.toString();
                } else {
                    setError('無効なリダイレクト先です。');
                }
            } catch (e) {
                setError('リダイレクトURLの形式が不正です。');
            }
        };

        processSso();
    }, [user, passkeyVerified, searchParams, navigate]);

    return (
        <div className="auth-page">
            <div className="bg-orb bg-orb-1" style={{ top: '-10%', right: '-5%' }} />
            <div className="bg-orb bg-orb-2" style={{ bottom: '-10%', left: '-5%' }} />

            <div className="login-card" style={{ textAlign: 'center' }}>
                <h1 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 800, marginBottom: 'var(--spacing-md)' }}>
                    MANSUKEアカウントを認証中
                </h1>

                {error ? (
                    <div style={{
                        display: 'flex', alignItems: 'flex-start', gap: 10,
                        background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)',
                        borderRadius: 'var(--radius-md)', padding: 'var(--spacing-md)',
                        marginBottom: 'var(--spacing-lg)',
                        fontSize: 'var(--font-size-sm)', color: 'var(--accent-rose)', textAlign: 'left',
                    }}>
                        <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
                        {error}
                        <br />
                        <button onClick={() => navigate('/')} style={{ marginTop: 10, textDecoration: 'underline', background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}>
                            ホームへ戻る
                        </button>
                    </div>
                ) : (
                    <>
                        <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                            MANSUKEアカウントを連携しています...
                        </p>
                        <div className="spinner" style={{ margin: '0 auto', width: 32, height: 32 }} />
                    </>
                )}
            </div>
        </div>
    );
}
