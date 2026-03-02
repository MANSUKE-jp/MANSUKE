import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Home, User, Shield, Gift, CreditCard, MoreHorizontal,
    LogOut, CheckCircle2, PanelLeftClose, PanelLeftOpen
} from 'lucide-react';
import { signOut } from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuth } from '../../contexts/AuthContext';

const NAV_ITEMS = [
    { to: '/', icon: Home, label: 'ホーム' },
    { to: '/profile', icon: User, label: '個人情報' },
    { to: '/security', icon: Shield, label: 'セキュリティ' },
    { to: '/redeem', icon: Gift, label: 'コード引換' },
    { to: '/payment', icon: CreditCard, label: 'お支払いと残高' },
    { to: '/others', icon: MoreHorizontal, label: 'その他' },
];

export default function Sidebar({ isCollapsed, onToggleCollapse }) {
    const { user, userData } = useAuth();
    const navigate = useNavigate();
    const [isExpanded, setIsExpanded] = useState(false);

    const fullName = userData ? `${userData.lastName || ''} ${userData.firstName || ''}`.trim() : '';
    const displayName = fullName || user?.email || 'MANSUKE ユーザー';
    const initial = fullName ? fullName[0].toUpperCase() : (user?.email?.[0]?.toUpperCase() || 'M');

    const handleSignOut = async () => {
        await signOut(auth);
        navigate('/login');
    };

    return (
        <nav className={`nav-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Logo */}
            <div className="sidebar-logo" style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <div>
                    {!isCollapsed && <span className="sidebar-logo-title">MANSUKE</span>}
                    {isCollapsed && <span className="sidebar-logo-title" style={{ fontSize: 22, textAlign: 'center' }}>M</span>}
                    {!isCollapsed && <span className="sidebar-logo-sub">Powered By Cerinal</span>}
                </div>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', padding: 4, marginTop: 4, marginLeft: isCollapsed ? -8 : 0
                    }}
                >
                    {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
            </div>

            {/* Navigation */}
            <div className="sidebar-nav">
                <div className="sidebar-nav-label">マイページ</div>
                {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
                    <NavLink
                        key={to}
                        to={to}
                        end={to === '/'}
                        className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                    >
                        <Icon size={15} strokeWidth={1.8} />
                        <span>{label}</span>
                    </NavLink>
                ))}
            </div>

            {/* User chip + sign out (Interactive Widget) */}
            <div className="sidebar-user account-widget-container">
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
                                {userData?.avatarUrl ? <img src={userData.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                            </div>
                            <div className="widget-popup-name">{displayName}</div>
                            <div className="widget-popup-email">{user?.email}</div>

                            <div className="widget-popup-menu">
                                <button className="widget-menu-item" onClick={() => { setIsExpanded(false); navigate('/profile'); }}>
                                    <User size={16} /> 個人情報
                                </button>
                                <button className="widget-menu-item danger" onClick={handleSignOut}>
                                    <LogOut size={16} /> サインアウト
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
                        {userData?.avatarUrl ? <img src={userData.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                    </div>
                    <div className="widget-name-col">
                        <div className="widget-name-row">
                            <span className="widget-name-text">{displayName}</span>
                            <CheckCircle2 size={16} className={isExpanded ? "text-indigo-200" : ""} color={isExpanded ? "rgba(255,255,255,0.7)" : "#3b82f6"} />
                        </div>
                        <span className="widget-subtitle" style={{
                            color: isExpanded ? 'rgba(255,255,255,0.95)' : '#64748b',
                            fontWeight: '700'
                        }}>
                            ニックネーム: {userData?.nickname || "未設定"}
                        </span>
                    </div>
                </motion.button>
            </div>
        </nav>
    );
}
