import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { Wifi, Plus, Loader2, Smartphone } from 'lucide-react';
import { FilloutStandardEmbed } from '@fillout/react';

export default function ManFiPage() {
    const { user, userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [manFiInfo, setManFiInfo] = useState(null);
    const [showForm, setShowForm] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'man-fi', 'info'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().devices && docSnap.data().devices.length > 0) {
                setManFiInfo(docSnap.data());
                setShowForm(false); // Hide form if devices exist
            } else {
                setManFiInfo(docSnap.data() || null); // Keep info if it exists but no devices
            }
            setLoading(false);
        }, (error) => {
            console.error('Error fetching man-fi info:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    // Calculate the end of the current month
    const getEndOfMonth = () => {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth(); // 0-indexed
        const lastDay = new Date(year, month + 1, 0); // 0th day of next month is last day of current month
        return `${year}年${month + 1}月末`;
    };

    if (loading) {
        return (
            <div className="page-container flex-centered">
                <Loader2 className="animate-spin text-gray-400" size={32} />
            </div>
        );
    }

    if (isSubmitting) {
        return (
            <div className="page-container flex-centered" style={{ flexDirection: 'column', gap: '16px' }}>
                <Loader2 className="animate-spin text-blue-500" size={48} />
                <p style={{ color: 'var(--text-2)' }}>登録処理を行っています...</p>
            </div>
        );
    }

    const { email, uid } = user || {};
    const name = userData ? `${userData.lastName || ''} ${userData.firstName || ''}`.trim() : '';
    const hasDevices = manFiInfo?.devices && manFiInfo.devices.length > 0;

    return (
        <div className="page-container">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={24} className="text-blue-500" />
                man-fi
            </h1>

            {showForm || !hasDevices ? (
                <div className="card fillout-container" style={{ display: 'flex', flexDirection: 'column' }}>
                    {!hasDevices ? (
                        <div style={{ padding: '40px 20px 20px', textAlign: 'center' }}>
                            <Wifi size={48} className="text-gray-300 mb-4 mx-auto" />
                            <h2 className="card-title text-lg font-semibold mb-2">端末が登録されていません</h2>
                            <p className="text-sm text-gray-500" style={{ color: 'var(--text-2)' }}>
                                man-fiを利用するには、ご利用になる端末のWi-Fiアドレス（MACアドレス）を登録してください。
                            </p>
                        </div>
                    ) : (
                        <div className="card-header">
                            <h2 className="card-title text-base font-semibold">以下のフォームにお答えください</h2>
                        </div>
                    )}
                    
                    <div className="card-content flex-1" style={{ position: 'relative', height: '600px', padding: 0 }}>
                        <FilloutStandardEmbed
                            filloutId="dMB9cGSbqPus"
                            parameters={{
                                uid: user?.uid || '',
                                name: name || '',
                                email: user?.email || ''
                            }}
                            onSubmit={() => {
                                console.log("Fillout form submitted!");
                                setIsSubmitting(true);
                                setShowForm(false);
                                
                                // Reset submitting state after a delay or let onSnapshot handle it
                                setTimeout(() => {
                                    setIsSubmitting(false);
                                }, 3000); 
                            }}
                        />
                    </div>
                    {hasDevices && (
                        <div className="card-footer" style={{ borderTop: '1px solid var(--border-color)', padding: '16px', display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                onClick={() => setShowForm(false)}
                                className="button-secondary"
                            >
                                キャンセル
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="manfi-dashboard">
                    <div style={{ marginBottom: '24px' }}>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: 'bold', marginBottom: '4px' }}>man-fiをご利用いただけます</h2>
                        <p style={{ color: 'var(--text-2)', fontSize: '0.9rem' }}>利用期間：{getEndOfMonth()}まで</p>
                    </div>

                    <div className="card" style={{ marginBottom: '24px' }}>
                        <div className="card-header border-b pb-4 mb-4">
                            <h3 className="card-title flex items-center gap-2">
                                <Wifi size={20} className="text-blue-500" />
                                Wi-Fi情報
                            </h3>
                        </div>
                        <div className="card-content">
                            <div style={{ display: 'grid', gap: '16px' }}>
                                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '4px' }}>SSID</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '600' }}>man-fi</div>
                                </div>
                                <div style={{ background: 'var(--bg-elevated)', padding: '16px', borderRadius: '8px' }}>
                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginBottom: '4px' }}>パスワード</div>
                                    <div style={{ fontSize: '1.1rem', fontWeight: '600', fontFamily: 'monospace' }}>wsp674021</div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <div className="card-header border-b pb-4 mb-4">
                            <h3 className="card-title flex items-center gap-2">
                                <Smartphone size={20} className="text-emerald-500" />
                                現在登録されているデバイス
                            </h3>
                        </div>
                        <div className="card-content">
                            {manFiInfo?.devices && manFiInfo.devices.length > 0 ? (
                                <ul style={{ display: 'flex', flexDirection: 'column', gap: '12px', padding: 0, margin: '0 0 24px 0', listStyle: 'none' }}>
                                    {manFiInfo.devices.map((mac, idx) => (
                                        <li key={idx} style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '12px', 
                                            padding: '12px 16px', 
                                            background: 'var(--bg-elevated)', 
                                            border: '1px solid var(--border-color)',
                                            borderRadius: '8px' 
                                        }}>
                                            <Wifi size={16} className="text-gray-400" />
                                            <span style={{ fontFamily: 'monospace', fontSize: '1.05rem' }}>{mac}</span>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-3)', background: 'var(--bg-elevated)', borderRadius: '8px', marginBottom: '24px' }}>
                                    登録されているデバイスはありません。
                                </div>
                            )}

                            <button
                                onClick={() => setShowForm(true)}
                                className="button-primary"
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginTop: '16px', background: 'var(--bg-elevated)', color: 'var(--text-1)', border: '1px solid var(--border-color)' }}
                            >
                                <Plus size={18} />
                                新しい端末を登録する
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
