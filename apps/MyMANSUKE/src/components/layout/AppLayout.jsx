import React from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import KycBarrier from './KycBarrier';
import { useAuth } from '../../contexts/AuthContext';

export default function AppLayout() {
    const { userData } = useAuth();
    const isApproved = userData?.kycStatus === 'approved';

    if (!isApproved) {
        return <KycBarrier />;
    }

    return (
        <div className="app-shell">
            <Sidebar />
            <main className="content-area">
                <div className="content-inner">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}
