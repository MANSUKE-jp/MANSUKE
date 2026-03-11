import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { db, functions } from '../firebase';
import { collection, query, onSnapshot, orderBy } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';
import { Wifi, Plus, Loader2, Smartphone, Trash2, Info, AlertTriangle, PlayCircle } from 'lucide-react';
import { usePayment } from '@mansuke/shared';
import { PaymentModal } from '@mansuke/shared/components/PaymentModal';
import { createPortal } from 'react-dom';
import { QRCodeSVG } from 'qrcode.react';

export default function VpnPage() {
    const { user, userData } = useAuth();
    const [loading, setLoading] = useState(true);
    const [devices, setDevices] = useState([]);
    
    // UI State
    const [showRegistrationModal, setShowRegistrationModal] = useState(false);
    const [deviceNameInput, setDeviceNameInput] = useState('');
    const [isRegistering, setIsRegistering] = useState(false);
    
    // Cancellation Modal State
    const [cancelDevice, setCancelDevice] = useState(null);
    const [isCanceling, setIsCanceling] = useState(false);

    const [setupDevice, setSetupDevice] = useState(null); // Which device to show setup info for
    const [configData, setConfigData] = useState(null);
    const [isFetchingConfig, setIsFetchingConfig] = useState(false);
    
    const payment = usePayment(functions);

    useEffect(() => {
        if (!user?.uid) {
            setLoading(false);
            return;
        }

        const q = query(collection(db, 'users', user.uid, 'vpn'), orderBy('createdAt', 'desc'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetchedDevices = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setDevices(fetchedDevices);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching VPN devices:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user?.uid]);

    // Handle Payment Failure Logic (Derived from user balance or subscription status)
    // For simplicity, if balance is < 0 or any sub is 'insufficient_funds', show warning.
    const showPaymentWarning = userData?.balance < 0 || devices.some(d => d.status === 'insufficient_funds' || d.status === 'failed');

    const handleOpenRegistration = () => {
        setDeviceNameInput('');
        setShowRegistrationModal(true);
    };

    const submitRegistration = (e) => {
        e.preventDefault();
        const trimmed = deviceNameInput.trim();
        if (trimmed.length === 0 || trimmed.length > 10) {
            alert("デバイス名は1文字以上、10文字以内で入力してください。");
            return;
        }
        
        setShowRegistrationModal(false);
        
        // Use generic payment modal for subscription
        payment.requestSubscription({
            amount: 300,
            description: `[VPN] ${trimmed}`,
            serviceName: 'mansuke_vpn',
            interval: 'month',
            isPreApproval: true,
            onSuccess: async () => {
                setIsRegistering(true);
                try {
                    // Call the VPN register function
                    const registerVpnFn = httpsCallable(functions, 'registerVpnDevice');
                    await registerVpnFn({ deviceName: trimmed });
                    alert("デバイスの登録が完了しました！");
                    // Data will be refreshed automatically via onSnapshot listener.
                } catch (error) {
                    console.error("VPN Registration Error:", error);
                    alert("VPNデバイスの作成に失敗しました: " + (error.message || "予期せぬエラーが発生しました。"));
                } finally {
                    setIsRegistering(false);
                }
            }
        });
    };

    const confirmDeleteDevice = async () => {
        if (!cancelDevice) return;
        
        try {
            setIsCanceling(true);
            const deleteVpnFn = httpsCallable(functions, 'deleteVpnDevice');
            await deleteVpnFn({ deviceId: cancelDevice.id });
            setCancelDevice(null);
        } catch (error) {
            console.error("Delete Error:", error);
            alert("解約に失敗しました: " + error.message);
        } finally {
            setIsCanceling(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!window.confirm("本当にすべてのVPNデバイスを解約しますか？\nすべてのサブスクリプションがキャンセルされます。")) return;
        
        try {
            setLoading(true);
            const deleteAllFn = httpsCallable(functions, 'deleteAllVpnDevices');
            await deleteAllFn();
            alert("すべてのデバイスを解約しました。");
        } catch (error) {
             console.error("Delete All Error:", error);
             alert("解約に失敗しました: " + error.message);
        } finally {
            setLoading(false);
        }
    };

    const handleShowSetup = async (device) => {
        setSetupDevice(device);
        setConfigData(null);
        setIsFetchingConfig(true);
        try {
            const getConfigFn = httpsCallable(functions, 'getVpnConfig');
            const result = await getConfigFn({ deviceId: device.id });
            setConfigData(result.data.config);
        } catch (error) {
            console.error("Fetch Config Error:", error);
            alert("設定情報の取得に失敗しました: " + error.message);
            setSetupDevice(null);
        } finally {
            setIsFetchingConfig(false);
        }
    };
    
    // Config File Download Handler
    const handleDownloadConfig = () => {
        if (!configData || !configData.rawWireguardConfig || !setupDevice) return;
        
        const blob = new Blob([configData.rawWireguardConfig], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${setupDevice.deviceName.replace(/[^a-zA-Z0-9_-]/g, '_')}.conf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    if (loading || isRegistering) {
        return (
            <div className="page-container flex-centered" style={{ minHeight: '60vh', flexDirection: 'column', gap: '16px' }}>
                <Loader2 className="animate-spin" size={48} style={{ color: '#3b82f6' }} />
                {isRegistering && <p style={{ color: 'var(--text-2)' }}>デバイスを登録中...</p>}
            </div>
        );
    }

    const hasDevices = devices.length > 0;

    return (
        <div className="page-container" style={{ paddingBottom: '100px' }}>
            <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Wifi size={28} style={{ color: '#3b82f6' }} />
                MANSUKE VPN
            </h1>
            <p className="page-subtitle" style={{ marginBottom: '24px' }}>
                クリーンで高速な「MANSUKE VPN」を通じて、安全なネットワーク接続を提供します。
            </p>

            {!hasDevices ? (
                // Unregistered State
                <div className="card" style={{ padding: '40px 20px', textAlign: 'center' }}>
                    <div style={{ width: 80, height: 80, background: 'var(--bg-elevated)', borderRadius: '50%', margin: '0 auto 24px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <Wifi size={40} style={{ color: '#3b82f6' }} />
                    </div>
                    <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '12px', color: 'var(--ink)' }}>
                        MANSUKE VPNで気持ちよくなろう！
                    </h2>
                    <p style={{ color: 'var(--text-2)', marginBottom: '32px', fontSize: '1.05rem' }}>
                        1デバイスあたり月額300円でご利用いただけます。いつでもキャンセルできます。
                    </p>
                    <button 
                        onClick={handleOpenRegistration}
                        className="btn btn-primary"
                        style={{ padding: '16px 32px', fontSize: '1.1rem', borderRadius: '99px' }}
                    >
                        MANSUKE VPNに登録する
                    </button>
                </div>
            ) : (
                // Registered State View
                <div>
                     <div className="card">
                        <div className="card-header border-b pb-4 mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 className="card-title flex items-center gap-2">
                                <Smartphone size={20} style={{ color: '#10b981' }} />
                                登録デバイスリスト
                            </h3>
                            <button 
                                onClick={handleDeleteAll}
                                className="btn btn-ghost" 
                                style={{ color: 'var(--red)', fontSize: '0.9rem', padding: '6px 12px' }}
                            >
                                すべて解約する
                            </button>
                        </div>
                        <div className="card-content">
                            <ul style={{ display: 'flex', flexDirection: 'column', gap: '16px', padding: 0, margin: '0 0 24px 0', listStyle: 'none' }}>
                                {devices.map((device) => (
                                    <li key={device.id} style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        justifyContent: 'space-between',
                                        padding: '16px', 
                                        background: 'var(--bg-elevated)', 
                                        border: '1px solid var(--border-color)',
                                        borderRadius: '12px' 
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(59, 130, 246, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                <Smartphone size={20} style={{ color: '#3b82f6' }} />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '1.1rem', fontWeight: '700', color: 'var(--ink)' }}>{device.deviceName}</div>
                                                <div style={{ fontSize: '0.85rem', color: 'var(--text-3)', marginTop: '2px' }}>
                                                    {device.status === 'active' ? (
                                                        <span style={{ color: 'var(--green)' }}>● 稼働中 (¥300/月)</span>
                                                    ) : device.status === 'canceled' ? (
                                                        <span style={{ color: 'var(--gold)' }}>● 解約済 (期間満了まで利用可能)</span>
                                                    ) : (
                                                        <span style={{ color: 'var(--red)' }}>● 支払いエラー</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button 
                                                onClick={() => handleShowSetup(device)}
                                                className="btn btn-secondary"
                                                style={{ padding: '8px 16px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                                            >
                                                <PlayCircle size={16} /> 接続手順
                                            </button>
                                            {device.status !== 'canceled' && (
                                                <button 
                                                    onClick={() => setCancelDevice(device)}
                                                    className="btn btn-ghost"
                                                    style={{ padding: '8px', color: 'var(--text-3)', border: '1px solid var(--border)', borderRadius: '8px' }}
                                                    title="解約"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </div>
                                    </li>
                                ))}
                            </ul>

                            <button
                                onClick={handleOpenRegistration}
                                className="btn btn-ghost"
                                style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', border: '2px dashed var(--border-color)', color: 'var(--text-2)', padding: '16px', borderRadius: '12px' }}
                                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--gold)'; e.currentTarget.style.color = 'var(--gold)'; }}
                                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-2)'; }}
                            >
                                <Plus size={18} />
                                デバイスを追加する (¥300/月)
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Registration Modal */}
            {showRegistrationModal && createPortal(
                <div className="modal-backdrop" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-panel" style={{ padding: '32px', maxWidth: '450px', width: '100%', background: '#fff', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ width: 64, height: 64, background: 'rgba(59, 130, 246, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#3b82f6' }}>
                            <Smartphone size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', textAlign: 'center', marginBottom: '8px', color: 'var(--ink)' }}>デバイス名を1つ登録してください</h2>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', textAlign: 'center', marginBottom: '24px' }}>
                            デバイス名は後で変えられません。あなたがわかるデバイス名であれば何でも大丈夫です。
                        </p>
                        
                        <form onSubmit={submitRegistration}>
                            <div style={{ marginBottom: '24px' }}>
                                <input
                                    type="text"
                                    className="input-field"
                                    placeholder="例: iPhone 15"
                                    value={deviceNameInput}
                                    onChange={(e) => setDeviceNameInput(e.target.value)}
                                    maxLength={10}
                                    required
                                    style={{ textAlign: 'center', fontSize: '1.1rem', fontWeight: 'bold' }}
                                />
                                <div style={{ textAlign: 'right', fontSize: '0.8rem', color: 'var(--text-3)', marginTop: '4px' }}>
                                    {deviceNameInput.length} / 10文字
                                </div>
                            </div>
                            
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <button type="submit" className="btn btn-primary btn-full">次へ進む</button>
                                <button type="button" className="btn btn-ghost btn-full" onClick={() => setShowRegistrationModal(false)}>キャンセル</button>
                            </div>
                        </form>
                    </div>
                </div>,
                document.body
            )}

            {/* Cancellation Confirmation Modal */}
            {cancelDevice && createPortal(
                <div className="modal-backdrop" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div className="modal-panel" style={{ padding: '32px', maxWidth: '450px', width: '100%', background: '#fff', borderRadius: '24px', boxShadow: 'var(--shadow-lg)' }}>
                        <div style={{ width: 64, height: 64, background: 'rgba(239, 68, 68, 0.1)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', color: '#ef4444' }}>
                            <AlertTriangle size={32} />
                        </div>
                        <h2 style={{ fontSize: '1.25rem', fontWeight: '800', textAlign: 'center', marginBottom: '8px', color: 'var(--ink)' }}>「{cancelDevice.deviceName}」を解約しますか？</h2>
                        <div style={{ fontSize: '0.95rem', color: 'var(--text-2)', textAlign: 'center', marginBottom: '24px', lineHeight: 1.6 }}>
                            <p>このデバイスの次回の自動請求を停止します。</p>
                            <p style={{ marginTop: '8px', color: 'var(--gold)', fontWeight: 'bold' }}>
                                ※すでに支払い済みの現在の契約期間が満了するまでは、引き続きVPNをご利用いただけます。
                            </p>
                        </div>
                        
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            <button 
                                onClick={confirmDeleteDevice} 
                                className="btn" 
                                style={{ background: 'var(--red)', color: 'white', padding: '16px', fontSize: '1.1rem', borderRadius: '99px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', opacity: isCanceling ? 0.7 : 1 }}
                                disabled={isCanceling}
                            >
                                {isCanceling ? <Loader2 size={20} className="animate-spin" /> : "解約を確定する"}
                            </button>
                            <button 
                                onClick={() => setCancelDevice(null)} 
                                className="btn btn-ghost btn-full"
                                disabled={isCanceling}
                            >
                                戻る
                            </button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Setup Instructions Modal */}
            {setupDevice && createPortal(
                <div className="modal-backdrop" style={{ background: 'rgba(0, 0, 0, 0.4)', backdropFilter: 'blur(4px)', position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <div className="modal-panel" style={{ padding: '0', maxWidth: '1200px', width: '100%', background: '#fff', borderRadius: '24px', overflow: 'hidden', display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
                        <div style={{ padding: '24px 32px', borderBottom: '1px solid var(--border)', background: 'var(--surface-2)', display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ width: 48, height: 48, background: '#fff', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: 'var(--shadow-sm)' }}>
                                <Info size={24} style={{ color: '#3b82f6' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--ink)' }}>VPNのセットアップ</h2>
                                <p style={{ fontSize: '0.85rem', color: 'var(--text-2)', margin: '4px 0 0 0' }}>ご利用中の端末に「WireGuard」アプリをインストールして設定を追加してください</p>
                            </div>
                        </div>
                        
                        <div style={{ display: 'flex', flexWrap: 'wrap', overflowY: 'auto' }}>
                            
                            {/* Left Column: Timeline UI */}
                            <div style={{ flex: '1 1 400px', padding: '32px', borderRight: '1px solid var(--border)', background: 'var(--bg)' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '24px', color: 'var(--ink)' }}>接続手順</h3>
                                
                                <div style={{ position: 'relative', paddingLeft: '24px' }}>
                                    {/* Timeline Line */}
                                    <div style={{ position: 'absolute', left: '7px', top: '12px', bottom: '24px', width: '2px', background: 'var(--border-color)' }}></div>
                                    
                                    {/* Step 1 */}
                                    <div style={{ position: 'relative', marginBottom: '32px' }}>
                                        <div style={{ position: 'absolute', left: '-24px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6', border: '3px solid var(--bg)' }}></div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--ink)', margin: '0 0 8px 0' }}>1. WireGuardアプリをインストール</h4>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                                            iOS/Mac 版App StoreやGoogle Playなどから「WireGuard」アプリをインストールしてください。<br/>
                                            濃い赤色の背景に、龍のようなアイコンです。
                                        </p>
                                    </div>
                                    
                                    {/* Step 2 */}
                                    <div style={{ position: 'relative', marginBottom: '32px' }}>
                                        <div style={{ position: 'absolute', left: '-24px', top: '2px', width: '16px', height: '16px', borderRadius: '50%', background: '#3b82f6', border: '3px solid var(--bg)' }}></div>
                                        <h4 style={{ fontSize: '1rem', fontWeight: 'bold', color: 'var(--ink)', margin: '0 0 8px 0' }}>2. VPN構成を追加</h4>
                                        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                                            WireGuardアプリを開いて、以下のいずれかの方法でVPNを構成してください。<br/><br/>
                                            <strong>QRコードから作成</strong><br/>
                                            1. アプリの右上にある＋ボタンを押し、「QRコードから作成」をタップ<br/>
                                            2. この画面に表示されているQRコードを読み取る<br/>
                                            3. 自由に名前をつけた後、表示されているスイッチをオンにして有効化<br/><br/>
                                            <strong>構成ファイルから作成</strong><br/>
                                            1. この画面に表示されている「構成ファイルをダウンロード」をタップ<br/>
                                            2. アプリの右上にある＋ボタンを押し、「ファイル、アーカイブから作成」をタップ<br/>
                                            3. ダウンロードした構成ファイルを選択<br/>
                                            4. 自由に名前をつけた後、表示されているスイッチをオンにして有効化
                                        </p>
                                    </div>
                                    
                                </div>
                            </div>
                            
                            {/* Right Column: Connection Info Table */}
                            <div style={{ flex: '1 1 400px', padding: '32px', display: 'flex', flexDirection: 'column' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', marginBottom: '24px', color: 'var(--ink)' }}>接続先情報</h3>
                                {isFetchingConfig || !configData ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0', gap: '16px' }}>
                                        <Loader2 className="animate-spin" size={32} style={{ color: '#3b82f6' }} />
                                        <span style={{ color: 'var(--text-2)' }}>設定情報を取得中...</span>
                                    </div>
                                ) : (
                                    <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                                        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '24px' }}>
                                            <div style={{ padding: '24px', background: '#fff', borderRadius: '16px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)', border: '1px solid var(--border)' }}>
                                                {configData.rawWireguardConfig && (
                                                    <QRCodeSVG value={configData.rawWireguardConfig} size={180} />
                                                )}
                                            </div>
                                            <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', textAlign: 'center', margin: 0 }}>
                                                または
                                            </p>
                                            
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '24px', width: '100%' }}>
                                                <button 
                                                    className="btn btn-primary"
                                                    onClick={handleDownloadConfig}
                                                    style={{ width: '100%', padding: '12px', borderRadius: '12px', fontWeight: 'bold', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                                                >
                                                    構成ファイルをダウンロード
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div style={{ padding: '24px 32px', borderTop: '1px solid var(--border)', background: 'var(--surface-2)', textAlign: 'right' }}>
                            <button type="button" className="btn btn-primary" onClick={() => setSetupDevice(null)} style={{ padding: '12px 32px', borderRadius: '99px' }}>閉じる</button>
                        </div>
                    </div>
                </div>,
                document.body
            )}

            {/* Failed Payment Notification */}
            {showPaymentWarning && createPortal(
                <div style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: '24px',
                    background: '#fff',
                    borderLeft: '4px solid var(--red)',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                    borderRadius: '12px',
                    padding: '20px 24px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '16px',
                    zIndex: 9998,
                    maxWidth: '400px',
                    animation: 'slideUp 0.3s ease-out'
                }}>
                    <AlertTriangle size={24} style={{ color: 'var(--red)', shrink: 0, marginTop: '2px' }} />
                    <div>
                        <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: 'var(--ink)', margin: '0 0 4px 0' }}>MANSUKEアカウント残高を追加してください</h4>
                        <p style={{ fontSize: '0.9rem', color: 'var(--text-2)', margin: 0, lineHeight: 1.5 }}>
                            あなたは支払いが遅延しています。残高を追加しない場合、サービスが停止される可能性があります。
                        </p>
                    </div>
                    <style>{`
                        @keyframes slideUp {
                            from { transform: translateY(100%); opacity: 0; }
                            to { transform: translateY(0); opacity: 1; }
                        }
                    `}</style>
                </div>,
                document.body
            )}
            
            {/* Generic Payment Modal */}
            {payment?.isOpen && createPortal(
                <PaymentModal 
                    isOpen={payment.isOpen}
                    onClose={payment.handleClose}
                    onConfirm={payment.handleConfirm}
                    amount={payment.paymentConfig.amount}
                    description={payment.paymentConfig.description}
                    serviceName={payment.paymentConfig.serviceName}
                    balance={userData?.balance || 0}
                    isLoading={payment.isProcessing}
                    isSubscription={payment.paymentConfig.isSubscription}
                />, 
                document.body
            )}
        </div>
    );
}
