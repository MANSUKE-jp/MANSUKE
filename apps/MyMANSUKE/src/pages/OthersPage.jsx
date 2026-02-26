import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import {
    MessageSquare, LogOut, Trash2, ChevronRight, FileText,
    TriangleAlert, ExternalLink, X, Shield, ShoppingBag, Scroll,
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';

// ────────────────────────────────────────────────────────────────────
// 規約・ポリシーリンク一覧
// href: リンクURL（後から変更しやすいようにここで一元管理）
// ────────────────────────────────────────────────────────────────────
const LEGAL_LINKS = [
    { label: '利用規約', href: 'https://legal.mansuke.jp/terms' },
    { label: 'プライバシーポリシー', href: 'https://legal.mansuke.jp/privacy' },
    { label: 'コミュニティガイドライン', href: 'https://legal.mansuke.jp/community' },
    { label: '特定商取引法に基づく表記', href: 'https://legal.mansuke.jp/tokusho' },
    { label: 'アカウント残高およびPREPAID CARD 利用規約', href: 'https://legal.mansuke.jp/prepaid' },
];

// ── Account Delete Panel — rendered via Portal to avoid clipping ───
function DeleteAccountPanel({ onClose }) {
    return createPortal(
        <div style={{
            position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh',
            background: 'var(--bg)', zIndex: 9000, overflowY: 'auto',
            display: 'flex', flexDirection: 'column',
        }}>
            {/* Top bar */}
            <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '20px 32px',
                borderBottom: '1px solid var(--border)',
                background: 'var(--surface)',
                position: 'sticky', top: 0, zIndex: 1,
                flexShrink: 0,
            }}>
                <button onClick={onClose} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', display: 'flex', alignItems: 'center',
                    gap: 8, fontSize: 'var(--font-size-sm)', fontWeight: 600, padding: '8px 0',
                }}>
                    <X size={18} /> 閉じる
                </button>
                <div style={{ fontWeight: 700, fontSize: 'var(--font-size-base)', color: 'var(--ink)' }}>
                    アカウント削除
                </div>
            </div>

            {/* Content */}
            <div style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '64px 24px', textAlign: 'center', gap: 'var(--spacing-xl)',
                minHeight: 0,
            }}>
                <div style={{
                    width: 72, height: 72, borderRadius: '50%',
                    background: 'rgba(244,63,94,0.1)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                    <TriangleAlert size={32} style={{ color: 'var(--accent-rose)' }} />
                </div>

                <div style={{ maxWidth: 480 }}>
                    <h2 style={{
                        fontSize: 'var(--font-size-xl)', fontWeight: 800,
                        marginBottom: 12, color: 'var(--ink)',
                        fontFamily: 'var(--font-d)', letterSpacing: '0.02em',
                    }}>
                        アカウント削除について
                    </h2>
                    <p style={{
                        fontSize: 'var(--font-size-base)', color: 'var(--text-secondary)',
                        lineHeight: 1.8,
                    }}>
                        アカウント削除は現在、サポートによる手作業で対応しております。
                        削除をご希望の場合は、MANSUKEへお問い合わせください。
                    </p>
                </div>

                <button
                    onClick={() => {
                        window.ChannelIO?.('showMessenger');
                        onClose();
                    }}
                    className="btn btn-danger"
                    style={{ border: 'none', display: 'inline-flex' }}
                >
                    <ExternalLink size={15} />
                    MANSUKEへお問い合わせ
                </button>
            </div>
        </div>,
        document.body
    );
}

// ── Shared Row component ────────────────────────────────────────────
function ActionRow({ icon: Icon, label, sublabel, onClick, href, danger }) {
    const inner = (
        <>
            <div style={{
                width: 40, height: 40, borderRadius: 'var(--radius-md)',
                background: danger ? 'rgba(244,63,94,0.08)' : 'rgba(99,102,241,0.08)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
                <Icon size={18} style={{ color: danger ? 'var(--accent-rose)' : 'var(--accent-indigo)' }} />
            </div>
            <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--font-size-sm)', color: danger ? 'var(--accent-rose)' : 'var(--text)' }}>
                    {label}
                </div>
                {sublabel && (
                    <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--text-muted)', marginTop: 2 }}>
                        {sublabel}
                    </div>
                )}
            </div>
            {href
                ? <ExternalLink size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                : <ChevronRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />}
        </>
    );

    const baseStyle = {
        display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
        padding: 'var(--spacing-md) 0',
        borderBottom: '1px solid var(--border)',
        width: '100%', background: 'none', border: 'none',
        cursor: 'pointer', textDecoration: 'none', color: 'inherit',
    };

    if (href) {
        return <a href={href} target="_blank" rel="noopener noreferrer" style={baseStyle}>{inner}</a>;
    }
    return <button onClick={onClick} style={baseStyle}>{inner}</button>;
}

// ── Legal Link Row ─────────────────────────────────────────────────
function LegalRow({ label, href }) {
    return (
        <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            style={{
                display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)',
                padding: '12px 0',
                borderBottom: '1px solid var(--border)',
                textDecoration: 'none', color: 'inherit',
            }}
        >
            <div style={{ flex: 1, fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>
                {label}
            </div>
            <ExternalLink size={13} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
        </a>
    );
}

// ── Main ───────────────────────────────────────────────────────────
export default function OthersPage() {
    const { user } = useAuth();
    const [showDelete, setShowDelete] = useState(false);
    const [loggingOut, setLoggingOut] = useState(false);

    const handleLogout = async () => {
        setLoggingOut(true);
        try { await signOut(auth); } catch (e) { setLoggingOut(false); }
    };

    return (
        <div className="page-enter">
            <div className="page-header">
                <h1 className="page-title">その他</h1>
                <p className="page-subtitle">規約・サポート・アカウント管理</p>
            </div>

            {/* ── 規約とポリシー ── */}
            <div className="section-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="section-header">
                    <Scroll size={18} style={{ color: 'var(--accent-indigo)' }} />
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>規約とポリシー</div>
                </div>
                <div className="section-body" style={{ padding: '0 var(--spacing-xl)' }}>
                    {LEGAL_LINKS.map(({ label, href }) => (
                        <LegalRow key={label} label={label} href={href} />
                    ))}
                </div>
            </div>

            {/* ── サポート ── */}
            <div className="section-card" style={{ marginBottom: 'var(--spacing-xl)' }}>
                <div className="section-header">
                    <MessageSquare size={18} style={{ color: 'var(--accent-indigo)' }} />
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>サポート</div>
                </div>
                <div className="section-body" style={{ padding: '0 var(--spacing-xl)' }}>
                    <ActionRow
                        icon={MessageSquare}
                        label="MANSUKEへお問い合わせ"
                        sublabel="ご不明な点はお気軽にどうぞ"
                        onClick={() => window.ChannelIO?.('showMessenger')}
                    />
                </div>
            </div>

            {/* ── アカウント ── */}
            <div className="section-card">
                <div className="section-header">
                    <LogOut size={18} style={{ color: 'var(--accent-indigo)' }} />
                    <div style={{ fontSize: 'var(--font-size-base)', fontWeight: 700 }}>アカウント</div>
                </div>
                <div className="section-body" style={{ padding: '0 var(--spacing-xl)' }}>
                    <ActionRow
                        icon={LogOut}
                        label={loggingOut ? 'ログアウト中…' : 'ログアウト'}
                        sublabel="このデバイスからサインアウトします"
                        onClick={handleLogout}
                    />
                    <ActionRow
                        icon={Trash2}
                        label="アカウント削除"
                        sublabel="アカウントを完全に削除します"
                        onClick={() => setShowDelete(true)}
                        danger
                    />
                </div>
            </div>

            {showDelete && <DeleteAccountPanel onClose={() => setShowDelete(false)} />}
        </div>
    );
}
