import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { useAuth } from '../contexts/AuthContext';

export default function LogoutPage() {
    const navigate = useNavigate();
    const { setPasskeyVerified } = useAuth();

    useEffect(() => {
        const performLogout = async () => {
            try {
                // パスキー認証状態をリセットする
                setPasskeyVerified(false);
                localStorage.removeItem('mansukePasskeyVerified');

                // ====== 確実なCookie削除（あらゆるドメイン/パスの組み合わせを破壊） ======
                const domains = [
                    '.mansuke.jp',
                    'mansuke.jp',
                    'my.mansuke.jp',
                    window.location.hostname,
                    ''
                ];
                domains.forEach(d => {
                    const domainStr = d ? `domain=${d};` : '';
                    document.cookie = `__session=; ${domainStr} path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT; secure; samesite=lax`;
                    document.cookie = `__session=; ${domainStr} path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT;`;
                });

                // Firebase Authからサインアウトする
                await signOut(auth);
            } catch (err) {
                // silent
            } finally {
                // ログインページにリダイレクト（残存React状態をワイプするためハードリロード）
                window.location.href = '/login';
            }
        };

        performLogout();
    }, [setPasskeyVerified]);

    return (
        <div style={{
            width: '100vw', height: '100vh',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'var(--bg-base)',
        }}>
            <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
        </div>
    );
}
