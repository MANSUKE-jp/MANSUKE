import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Settings, CheckCircle2 } from 'lucide-react';

function AccountDisplay({ user, appName = 'default' }) {
    const [isExpanded, setIsExpanded] = useState(false);

    // MANSUKEアカウントの情報から表示名を決定
    // APIから送られるnameを最優先で使用し、なければ直接組み立てる
    const fullName = user?.name || (user?.lastName && user?.firstName
        ? `${user.lastName} ${user.firstName}`
        : user?.displayName || user?.email || "ゲスト");

    // アイコンURLの取得
    const avatarUrl = user?.avatarUrl || user?.photoURL || null;

    const handleLogout = () => {
        // ログアウト処理:
        // Cookieの削除と my.mansuke.jp のログアウトエンドポイントへのリダイレクト
        // 確実な削除のため、セット時と同じ属性（domain, path, secure, samesite）を指定します
        document.cookie = "__session=; domain=.mansuke.jp; path=/; max-age=0; secure; samesite=lax";
        window.location.href = `https://my.mansuke.jp/logout`;
    };

    const handleProfileClick = () => {
        if (appName === 'WEREWOLF') {
            // WHEREWOLFの場合はニックネーム変更（プロフィールのタブなど）へ
            window.location.href = 'https://my.mansuke.jp/profile';
        } else {
            // それ以外は個人情報ページへ
            window.location.href = 'https://my.mansuke.jp/profile';
        }
    };

    const profileButtonText = appName === 'WEREWOLF' ? 'ニックネームを変更' : '個人情報';

    if (!user) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 account-widget-container" style={{ width: '280px' }}>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="account-widget-popup"
                    >
                        <div className="widget-avatar-large">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <div className="widget-popup-name">{fullName}</div>
                        <div className="widget-popup-email">{user?.email}</div>

                        <div className="widget-popup-menu">
                            <button
                                onClick={handleProfileClick}
                                className="widget-menu-item"
                            >
                                <Settings size={16} /> {profileButtonText}
                            </button>
                            <button
                                onClick={handleLogout}
                                className="widget-menu-item danger"
                            >
                                <LogOut size={16} /> ログアウト
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsExpanded(!isExpanded)}
                className={`account-widget-button ${isExpanded ? 'expanded' : 'collapsed'}`}
            >
                <div className="widget-avatar">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={fullName} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                    ) : (
                        <User size={24} />
                    )}
                </div>
                <div className="widget-name-col">
                    <div className="widget-name-row">
                        <span className="widget-name-text">{fullName}</span>
                        <CheckCircle2 size={16}
                            className={isExpanded ? "text-indigo-200" : ""}
                            color={isExpanded ? "rgba(255,255,255,0.7)" : "#3b82f6"}
                        />
                    </div>
                    <span className="widget-subtitle" style={{
                        color: isExpanded ? 'rgba(255,255,255,0.95)' : '#64748b',
                        fontWeight: isExpanded ? '700' : '700'
                    }}>
                        ニックネーム: {user?.nickname || "未設定"}
                    </span>
                </div>
            </motion.button>
        </div>
    );
}

export default AccountDisplay;
