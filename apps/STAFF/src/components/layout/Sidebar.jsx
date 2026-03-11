import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    QrCode, Upload, CreditCard, Users,
    LogOut, CheckCircle2, Shield, PanelLeftClose, PanelLeftOpen, Activity
} from 'lucide-react';

const NAV_SECTIONS = [
    {
        label: 'PREPAID CARD',
        items: [
            { to: '/pos', icon: QrCode, label: <>PREPAID CARD<br/>専用POSレジ</> },
            { to: '/csv', icon: Upload, label: 'CSVファイル登録' },
            { to: '/cards', icon: CreditCard, label: '既存コードを管理' },
        ],
    },
    {
        label: 'MANSUKEアカウント情報',
        items: [
            { to: '/users', icon: Users, label: 'ユーザー検索' },
        ],
    },
];

export default function Sidebar({ user, mansukeUser, onLogout, isCollapsed, onToggleCollapse }) {
    const [isExpanded, setIsExpanded] = useState(false);

    const displayName = mansukeUser
        ? `${mansukeUser.lastName || ''} ${mansukeUser.firstName || ''}`.trim() || mansukeUser.nickname || 'Staff'
        : 'Staff';
    const initial = displayName[0]?.toUpperCase() || 'S';

    return (
        <nav className={`nav-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
            {/* Logo */}
            <div className={`sidebar-logo ${isCollapsed ? 'collapsed' : ''}`} style={{ 
                display: 'flex', 
                flexDirection: isCollapsed ? 'column' : 'row', 
                alignItems: isCollapsed ? 'center' : 'flex-start', 
                justifyContent: isCollapsed ? 'center' : 'space-between',
                gap: isCollapsed ? 12 : 0
            }}>
                <div>
                    {!isCollapsed && <span className="sidebar-logo-title">MANSUKE</span>}
                    {isCollapsed && <span className="sidebar-logo-title" style={{ fontSize: 22, textAlign: 'center' }}>M</span>}
                    {!isCollapsed && (
                        <span className="sidebar-logo-sub">
                            <Shield size={10} style={{ display: 'inline', verticalAlign: 'middle', marginRight: 4 }} />
                            STAFF CONSOLE
                        </span>
                    )}
                </div>
                <button
                    onClick={onToggleCollapse}
                    style={{
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        color: 'var(--text-3)', padding: 4, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        marginTop: isCollapsed ? 0 : 4
                    }}
                >
                    {isCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
                </button>
            </div>

            {/* Navigation */}
            <div className="sidebar-nav">
                {NAV_SECTIONS.map((section) => (
                    <div key={section.label}>
                        <div className="sidebar-nav-label">{section.label}</div>
                        {section.items.map(({ to, icon: Icon, label }) => (
                            <NavLink
                                key={to}
                                to={to}
                                className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
                            >
                                <Icon size={15} strokeWidth={1.8} />
                                <span>{label}</span>
                            </NavLink>
                        ))}
                    </div>
                ))}
            </div>

            {/* User chip */}
            <div className="sidebar-user account-widget-container">
                <AnimatePresence>
                    {isExpanded && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2 }}
                            className="account-widget-popup"
                            style={{ width: 232 }}
                        >
                            <div className="widget-avatar-large">
                                {mansukeUser?.avatarUrl ? <img src={mansukeUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
                            </div>
                            <div className="widget-popup-name">{displayName}</div>
                            <div className="widget-popup-email">{mansukeUser?.email || user?.email || ''}</div>
                            <div className="widget-popup-menu">
                                <button className="widget-menu-item danger" onClick={onLogout}>
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
                        {mansukeUser?.avatarUrl ? <img src={mansukeUser.avatarUrl} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initial}
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
                            STAFF
                        </span>
                    </div>
                </motion.button>
            </div>
        </nav>
    );
}
