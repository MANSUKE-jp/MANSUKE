import React, { useState } from 'react';
import Sidebar from './Sidebar';

export default function AppLayout({ children, user, mansukeUser, onLogout, fullWidth = false }) {
    const [isCollapsed, setIsCollapsed] = useState(false);
    return (
        <div className="app-shell">
            <Sidebar user={user} mansukeUser={mansukeUser} onLogout={onLogout} isCollapsed={isCollapsed} onToggleCollapse={() => setIsCollapsed(!isCollapsed)} />
            <main className="content-area">
                <div className={fullWidth ? "content-full" : "content-inner"}>
                    {children}
                </div>
            </main>
        </div>
    );
}
