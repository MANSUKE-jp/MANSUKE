import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import PasskeyVerify from './pages/PasskeyVerify';
import HomePage from './pages/HomePage';
import ProfilePage from './pages/ProfilePage';
import SecurityPage from './pages/SecurityPage';
import RedeemPage from './pages/RedeemPage';
import PaymentPage from './pages/PaymentPage';
import OthersPage from './pages/OthersPage';
import VpnPage from './pages/VpnPage';
import LogoutPage from './pages/LogoutPage';
import SsoRedirect from './pages/SsoRedirect';
import useChannelTalk from './hooks/useChannelTalk';

// ──────────────────────────────────────────────
// Guards & Error Boundary
// ──────────────────────────────────────────────

class GlobalErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }
    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }
    componentDidCatch(error, errorInfo) {
        console.error("Caught by ErrorBoundary:", error, errorInfo);
    }
    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '40px', background: '#fef2f2', color: '#7f1d1d', minHeight: '100vh', fontFamily: 'sans-serif' }}>
                    <h1 style={{ fontSize: '24px', fontWeight: 'bold' }}>エラーが発生しました (App Crashed)</h1>
                    <p>この画面のスクリーンショットを開発者に送ってください。</p>
                    <pre style={{ background: '#fee2e2', padding: '16px', borderRadius: '8px', overflowX: 'auto', marginTop: '16px' }}>
                        {this.state.error && this.state.error.toString()}
                    </pre>
                </div>
            );
        }
        return this.props.children;
    }
}

// Redirect to /login if not authenticated (preserve redirect param)
function RequireAuth({ children }) {
    const { user, loading, passkeyVerified } = useAuth();
    const location = useLocation();

    if (loading) return <FullPageLoader />;

    if (!user) {
        const redirect = location.pathname + location.search;
        return <Navigate to={`/login?redirect=${encodeURIComponent(redirect)}`} replace />;
    }

    // After login, must verify passkey before accessing any page (Skip in local dev)
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (!passkeyVerified && !isLocalhost) {
        return <Navigate to="/passkey-verify" replace state={{ from: location }} />;
    }

    return children;
}

// Redirect authenticated + passkey-verified users away from auth pages
function GuestOnly({ children }) {
    const { user, loading, passkeyVerified } = useAuth();
    const location = useLocation();

    if (loading) return <FullPageLoader />;
    if (user && passkeyVerified) {
        const searchParams = new URLSearchParams(location.search);
        const redirectParam = searchParams.get('redirect');

        if (redirectParam && redirectParam.startsWith('http')) {
            try {
                const urlObj = new URL(redirectParam);
                if (urlObj.hostname.endsWith('.mansuke.jp') || urlObj.hostname.endsWith('.web.app') || urlObj.hostname === 'localhost' || urlObj.hostname === '127.0.0.1') {
                    window.location.href = redirectParam;
                    return null;
                }
            } catch (_e) {
                // invalid URL, ignore
            }
        }
        return <Navigate to={redirectParam && redirectParam.startsWith('/') ? redirectParam : "/"} replace />;
    }
    return children;
}

function FullPageLoader() {
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

// ──────────────────────────────────────────────
// Router
// ──────────────────────────────────────────────
function AppRoutes() {
    const { user, userData } = useAuth();
    useChannelTalk(user, userData);

    return (
        <>
            <div className="mobile-blocker">
                <div style={{ textAlign: 'center', padding: '24px' }}>
                    <div style={{ fontSize: '48px', marginBottom: '16px' }}>📱❌</div>
                    <h2 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '12px' }}>このデバイスには対応していません</h2>
                    <p style={{ fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                        MyMANSUKEは、スマートフォンなどの画面の小さいデバイスからのアクセスに対応していません。<br />
                        恐れ入りますが、PCまたはタブレットからアクセスしてください。
                    </p>
                </div>
            </div>
            
            <div className="desktop-app-container">
                <Routes>
                    {/* Guest routes */}
                    <Route path="/login" element={<GuestOnly><LoginPage /></GuestOnly>} />
                    <Route path="/register" element={<GuestOnly><RegisterPage /></GuestOnly>} />

                    {/* Passkey verification (auth'd but passkey not yet done this session) */}
                    <Route path="/passkey-verify" element={<PasskeyVerify />} />

                    {/* SSO Handoff */}
                    <Route path="/sso" element={<RequireAuth><SsoRedirect /></RequireAuth>} />

                    {/* Logout route */}
                    <Route path="/logout" element={<LogoutPage />} />

                    {/* Protected routes — wrapped in AppLayout (sidebar + content) */}
                    <Route element={<RequireAuth><AppLayout /></RequireAuth>}>
                        <Route index element={<HomePage />} />
                        <Route path="profile" element={<ProfilePage />} />
                        <Route path="security" element={<SecurityPage />} />
                        <Route path="redeem" element={<RedeemPage />} />
                        <Route path="payment" element={<PaymentPage />} />
                        <Route path="vpn" element={<VpnPage />} />
                        <Route path="others" element={<OthersPage />} />
                    </Route>

                    {/* Fallback */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </div>
        </>
    );
}

export default function App() {
    return (
        <GlobalErrorBoundary>
            <BrowserRouter>
                <AuthProvider>
                    <AppRoutes />
                </AuthProvider>
            </BrowserRouter>
        </GlobalErrorBoundary>
    );
}
