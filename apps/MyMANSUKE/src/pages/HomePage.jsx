import React from 'react';
import { useAuth } from '../contexts/AuthContext';

// ────────────────────────────────────────────────────────────────────
// アプリ一覧（後から追加できるように配列で管理）
//
// iconUrl     : アイコン画像URL
// name        : 表示名
// href        : 遷移先URL
// internalId  : アクセス制御用内部ID（必須）。
//               Firestore users/{uid}.blockedApps 配列にこのIDが含まれている
//               ユーザーにはカードを非表示にします。
//               登録されていないユーザーは全アプリにアクセスできます。
// ────────────────────────────────────────────────────────────────────
const APPS = [
    {
        internalId: 'hirusupa',
        iconUrl: 'https://i.imghippo.com/files/t9845ZbY.png',
        name: 'HIRUSUPA',
        href: 'https://hirusupa.mansuke.jp'
    },
    {
        internalId: 'werewolf',
        iconUrl: 'https://i.imghippo.com/files/qpDV9295cJk.png',
        name: 'WEREWOLF',
        href: 'https://werewolf.mansuke.jp'
    }
    // 例:
    // {
    //     internalId: 'hirusupa',
    //     iconUrl: 'https://example.com/icon.png',
    //     name: 'HIRUSUPA',
    //     href: 'https://hirusupa.mansuke.jp',
    // },
];

// ── App Card ───────────────────────────────────────────────────────
function AppCard({ iconUrl, name, href }) {
    const card = (
        <div style={{
            background: 'var(--surface)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            padding: '28px 16px',
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            gap: 14,
            cursor: href ? 'pointer' : 'default',
            transition: 'all 0.2s ease',
            boxShadow: 'var(--shadow-sm)',
            userSelect: 'none',
            textDecoration: 'none',
            color: 'inherit',
        }}
            onMouseEnter={e => {
                if (href) {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                }
            }}
            onMouseLeave={e => {
                e.currentTarget.style.transform = '';
                e.currentTarget.style.boxShadow = 'var(--shadow-sm)';
            }}
        >
            <div style={{
                width: 64, height: 64, borderRadius: 18,
                overflow: 'hidden', flexShrink: 0,
                background: 'var(--surface-2)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
            }}>
                {iconUrl ? (
                    <img src={iconUrl} alt={name}
                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                    <div style={{
                        width: '100%', height: '100%',
                        background: 'linear-gradient(135deg, rgba(212,175,55,0.3), rgba(99,102,241,0.3))',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 22, fontWeight: 800, color: 'var(--text-muted)',
                        fontFamily: 'var(--font-d)',
                    }}>
                        {name?.[0] ?? '?'}
                    </div>
                )}
            </div>
            <div style={{
                fontSize: 'var(--font-size-sm)', fontWeight: 700,
                color: 'var(--ink)', textAlign: 'center', letterSpacing: '0.02em',
            }}>
                {name}
            </div>
        </div>
    );

    if (href) {
        return (
            <a href={href} target="_blank" rel="noopener noreferrer"
                style={{ textDecoration: 'none', display: 'block' }}>
                {card}
            </a>
        );
    }
    return card;
}

// ── Placeholder (アプリが1件もない場合) ───────────────────────────
function EmptyState() {
    return (
        <div style={{
            gridColumn: '1 / -1', textAlign: 'center',
            padding: '64px 32px', color: 'var(--text-muted)',
        }}>
            <div style={{
                fontSize: 48, marginBottom: 16, opacity: 0.3,
                fontFamily: 'var(--font-d)', fontWeight: 800, letterSpacing: '0.1em',
            }}>
                MANSUKE
            </div>
            <div style={{ fontSize: 'var(--font-size-sm)' }}>
                利用可能なアプリは現在登録されていません
            </div>
        </div>
    );
}

// ── Main ───────────────────────────────────────────────────────────
export default function HomePage() {
    const { userData } = useAuth();
    const lastName = userData?.lastName ?? '';

    // アクセス制御: blockedApps 配列にアプリのinternalIdが含まれていたら非表示
    // blockedApps が未設定（null/undefined）の場合は全アプリに表示
    const blockedApps = userData?.blockedApps ?? [];

    const visibleApps = APPS.filter(app => !blockedApps.includes(app.internalId));

    return (
        <div className="page-enter" style={{ textAlign: 'center' }}>
            {/* Greeting */}
            <div style={{ marginBottom: '56px' }}>
                <h1 style={{
                    fontSize: 'clamp(36px, 5vw, 56px)',
                    fontFamily: 'var(--font-d)',
                    fontWeight: 800,
                    letterSpacing: '0.04em',
                    color: 'var(--ink)',
                    marginBottom: 12,
                    lineHeight: 1.15,
                }}>
                    {lastName && `${lastName}様`}、こんにちは
                </h1>
                <p style={{
                    fontSize: 'var(--font-size-base)',
                    color: 'var(--text-secondary)',
                    letterSpacing: '0.03em',
                }}>
                    ご利用になりたいアプリを選択してください
                </p>
            </div>

            {/* App Grid — max 4 per row */}
            <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
                maxWidth: '640px',
                margin: '0 auto',
                gap: 'var(--spacing-lg)',
            }}>
                {visibleApps.length === 0 ? (
                    <EmptyState />
                ) : (
                    visibleApps.map((app, i) => (
                        <AppCard key={i} {...app} />
                    ))
                )}
            </div>
        </div>
    );
}
