import React, { useState, useEffect, useRef } from 'react';
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
    
    // Form submission states
    const [submitState, setSubmitState] = useState('idle'); // 'idle' | 'success_delay' | 'loading'
    const webhookFinishedRef = useRef(false);

    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        const unsubscribe = onSnapshot(doc(db, 'users', user.uid, 'man-fi', 'info'), (docSnap) => {
            if (docSnap.exists() && docSnap.data().devices && docSnap.data().devices.length > 0) {
                console.log("Man-fi info updated via onSnapshot. Devices:", docSnap.data().devices);
                setManFiInfo(docSnap.data());
            } else {
                console.log("Man-fi info updated, but no devices found.");
                setManFiInfo(docSnap.data() || null); // Keep info if it exists but no devices
            }
            
            // Mark that a Firestore update was received
            webhookFinishedRef.current = true;

            // If we are currently loading, we can now finish
            setSubmitState(prev => {
                if (prev === 'loading') {
                    console.log("Transitioning submitState from loading to idle because data arrived");
                    return 'idle';
                }
                return prev;
            });

            setLoading(false);
        }, (error) => {
            console.error('Error fetching man-fi info:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    // Derive hasDevices
    const hasDevices = manFiInfo?.devices && manFiInfo.devices.length > 0;

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
            <div className="page-container flex-centered" style={{ minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={32} style={{ color: '#9ca3af' }} />
            </div>
        );
    }

    const { email, uid } = user || {};
    const name = userData ? `${userData.lastName || ''} ${userData.firstName || ''}`.trim() : '';

    // Determine whether to show the dashboard or the Fillout form
    const isDashboardVisible = hasDevices && !showForm;

    if (submitState === 'loading') {
        // Only show spinner if we're technically supposed to be on dashboard but processing hasn't cleared
        return (
            <div className="page-container flex-centered" style={{ flexDirection: 'column', gap: '16px', minHeight: '60vh' }}>
                <Loader2 className="animate-spin" size={48} style={{ color: '#3b82f6' }} />
                <p style={{ color: 'var(--text-2)' }}>登録情報を確認しています...</p>
                <p style={{ color: 'var(--text-3)', fontSize: '12px', marginTop: '8px' }}>
                    ※画面が変わらない場合は、ページを再読み込みしてください。
                </p>
            </div>
        );
    }

    return (
        <div className="page-container">
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={24} style={{ color: '#3b82f6' }} />
                man-fi
            </h1>

            {!isDashboardVisible ? (
                <div className="card fillout-container" style={{ display: 'flex', flexDirection: 'column' }}>
                    {!hasDevices ? (
                        <div style={{ padding: '40px 20px 20px', textAlign: 'center' }}>
                            <Wifi size={48} style={{ color: '#d1d5db', marginBottom: '16px', marginLeft: 'auto', marginRight: 'auto' }} />
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
                                setSubmitState('success_delay');
                                webhookFinishedRef.current = false;
                                
                                // After 2 seconds, evaluate if webhook finished
                                setTimeout(() => {
                                    console.log("2 second delay finished. Evaluating next state.");
                                    setShowForm(false);
                                    setSubmitState(prev => {
                                        if (prev === 'success_delay') {
                                            const nextState = webhookFinishedRef.current ? 'idle' : 'loading';
                                            console.log("Setting submitState to:", nextState);
                                            return nextState;
                                        }
                                        return prev;
                                    });
                                }, 2000);

                                // Safety timeout: if webhook takes more than 15s to arrive, force clear processing
                                // so they aren't stuck on loading forever.
                                setTimeout(() => {
                                    setSubmitState('idle');
                                }, 15000);
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
                                <Wifi size={20} style={{ color: '#3b82f6' }} />
                                Wi-Fi情報
                            </h3>
                        </div>
                        <div className="card-content">
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
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
                                <Smartphone size={20} style={{ color: '#10b981' }} />
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
                                            <Wifi size={16} style={{ color: '#9ca3af' }} />
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
