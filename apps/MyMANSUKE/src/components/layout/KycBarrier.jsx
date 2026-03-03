import React, { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { Clock, ShieldCheck, XCircle, AlertTriangle, ArrowRight, RefreshCw, Mail, Phone, ExternalLink, Pencil, Check, X, Shield, Lock } from 'lucide-react';
import { callFunction } from '../../firebase';

const REASON_MESSAGES = {
    phoneNumber: 'ご提出いただいた電話番号はリスクが高いため、承認されませんでした。',
    email: 'ご提出いただいたメールアドレスは承認されませんでした。',
    idCheck: '本人確認書類の信憑性を確認できませんでした。',
    faceCheck: '本人確認書類の顔写真とセルフィーが一致していません。',
};

function EditFieldInline({ field, label, value, onSave }) {
    const [editing, setEditing] = useState(false);
    const [val, setVal] = useState(value || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e) => {
        if (e) e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const fn = callFunction(field === 'email' ? 'updateEmail' : 'updatePhone');
            const data = field === 'email' ? { email: val } : { phone: val };
            await fn(data);
            onSave(val);
            setEditing(false);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    if (!editing) {
        return (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                <div>
                    <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
                    <div style={{ fontSize: '15px', color: 'var(--text)', fontWeight: 500 }}>{value || '未設定'}</div>
                </div>
                <button
                    onClick={() => setEditing(true)}
                    className="btn btn-ghost"
                    style={{ padding: '6px 12px', fontSize: '12px', height: 'auto', borderRadius: '8px' }}
                >
                    <Pencil size={14} style={{ marginRight: 6 }} /> 変更
                </button>
            </div>
        );
    }

    return (
        <div style={{ padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ fontSize: '11px', color: 'var(--text-3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 8 }}>{label}を編集</div>
            <div style={{ display: 'flex', gap: 8 }}>
                <input
                    type={field === 'email' ? 'email' : 'tel'}
                    className="input-field"
                    style={{ padding: '8px 12px', fontSize: '14px', flex: 1 }}
                    value={val}
                    onChange={(e) => setVal(e.target.value)}
                    autoFocus
                    disabled={loading}
                />
                <button
                    onClick={handleSubmit}
                    className="btn btn-primary"
                    style={{ padding: '8px', width: 40, height: 40, borderRadius: '8px' }}
                    disabled={loading}
                >
                    {loading ? <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Check size={18} />}
                </button>
                <button
                    onClick={() => { setEditing(false); setVal(value); setError(''); }}
                    className="btn btn-ghost"
                    style={{ padding: '8px', width: 40, height: 40, borderRadius: '8px' }}
                    disabled={loading}
                >
                    <X size={18} />
                </button>
            </div>
            {error && <div style={{ fontSize: '12px', color: 'var(--red)', marginTop: 4 }}>{error}</div>}
        </div>
    );
}

export default function KycBarrier() {
    const { user, userData } = useAuth();
    const [loadingDidit, setLoadingDidit] = useState(false);

    if (!user || !userData) return null;

    const kycStatus = userData.kycStatus || 'pending';
    const kycReason = userData.kycReason;
    const kycDiditEmail = userData.kycDiditEmail;
    const kycDiditPhone = userData.kycDiditPhone;

    const handleStartKyc = async (e) => {
        if (e) e.preventDefault();
        setLoadingDidit(true);
        try {
            const fn = callFunction('createDiditSession');
            const result = await fn();
            if (result.data && result.data.url) {
                window.location.href = result.data.url;
            } else {
                throw new Error('セッションURLが取得できませんでした');
            }
        } catch (err) {
            alert('本人確認セッションの開始に失敗しました: ' + err.message);
        } finally {
            setLoadingDidit(false);
        }
    };

    let statusContent = null;

    if (kycStatus === 'pending') {
        statusContent = (
            <div className="status-section">
                <div className="icon-badge pending">
                    <Clock size={32} />
                </div>
                <h2 className="barrier-title">本人確認が必要です</h2>
                <p className="barrier-desc">
                    MANSUKEアカウントのサービスを安全にご利用いただくために、本人確認（KYC）を完了してください。<br />
                    スマートフォンを使用して、本人確認書類とセルフィーの撮影を行います。
                </p>
            </div>
        );
    } else if (kycStatus === 'mismatch') {
        statusContent = (
            <div className="status-section">
                <div className="icon-badge mismatch">
                    <AlertTriangle size={32} />
                </div>
                <h2 className="barrier-title">登録情報と一致しません</h2>
                <p className="barrier-desc">
                    本人確認で照合された情報が、MANSUKEアカウントの登録情報と異なります。<br />
                    以下の情報を修正してから、再度お試しください。
                </p>

                <div className="mismatch-comparison">
                    <div className="comparison-table">
                        <div className="table-header">
                            <div>項目</div>
                            <div>MANSUKE登録</div>
                            <div>Didit照合結果</div>
                        </div>
                        <div className="table-row">
                            <div className="row-label">メールアドレス</div>
                            <div className={userData.email !== kycDiditEmail ? 'mismatch-text' : ''}>{userData.email || '—'}</div>
                            <div className="verified-text">{kycDiditEmail || '—'}</div>
                        </div>
                        <div className="table-row">
                            <div className="row-label">電話番号</div>
                            <div className={userData.phone !== kycDiditPhone ? 'mismatch-text' : ''}>{userData.phone || '—'}</div>
                            <div className="verified-text">{kycDiditPhone || '—'}</div>
                        </div>
                    </div>
                </div>
            </div>
        );
    } else if (kycStatus === 'rejected') {
        statusContent = (
            <div className="status-section">
                <div className="icon-badge rejected">
                    <XCircle size={32} />
                </div>
                <h2 className="barrier-title">本人確認に失敗しました</h2>
                <div className="reason-box">
                    {REASON_MESSAGES[kycReason] || '規定の基準を満たさなかったため、承認されませんでした。'}
                </div>
                <p className="barrier-desc">
                    登録情報を確認し、必要があれば修正してから再度認証を行ってください。
                </p>
            </div>
        );
    }

    return (
        <div className="kyc-barrier-container">
            <style>{`
                .kyc-barrier-container {
                    position: fixed;
                    inset: 0;
                    z-index: 99999;
                    background: var(--bg);
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    padding: var(--spacing-xl);
                    overflow-y: auto;
                    animation: fadeIn 0.4s ease-out;
                }

                .barrier-card {
                    background: var(--surface);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-xl);
                    width: 100%;
                    max-width: 1000px;
                    padding: 48px;
                    box-shadow: 0 32px 64px rgba(15, 23, 42, 0.12);
                    display: grid;
                    grid-template-columns: 1.2fr 1fr;
                    gap: 48px;
                    position: relative;
                }

                @media (max-width: 768px) {
                    .barrier-card {
                        grid-template-columns: 1fr;
                        padding: 32px;
                        gap: 32px;
                    }
                }

                .status-section {
                    text-align: left;
                }

                .icon-badge {
                    width: 64px;
                    height: 64px;
                    border-radius: 20px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    margin-bottom: 24px;
                }

                .icon-badge.pending { background: rgba(245, 158, 11, 0.1); color: var(--amber); }
                .icon-badge.mismatch { background: rgba(239, 68, 68, 0.1); color: var(--red); }
                .icon-badge.rejected { background: rgba(239, 68, 68, 0.1); color: var(--red); }

                .barrier-title {
                    font-family: var(--font-d);
                    font-size: 32px;
                    font-weight: 800;
                    color: var(--ink);
                    margin-bottom: 16px;
                    letter-spacing: 0.02em;
                }

                .barrier-desc {
                    font-size: 15px;
                    color: var(--text-2);
                    line-height: 1.7;
                    margin-bottom: 32px;
                }

                .mismatch-comparison {
                    background: var(--surface-2);
                    border-radius: var(--radius-md);
                    padding: 20px;
                    margin-bottom: 24px;
                }

                .comparison-table {
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .table-header {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    font-size: 11px;
                    font-weight: 800;
                    color: var(--text-3);
                    text-transform: uppercase;
                    letter-spacing: 0.05em;
                }

                .table-row {
                    display: grid;
                    grid-template-columns: 1fr 1fr 1fr;
                    font-size: 13px;
                    align-items: center;
                    padding-top: 8px;
                    border-top: 1px solid rgba(0,0,0,0.05);
                }

                .row-label { font-weight: 700; color: var(--text-2); }
                .mismatch-text { color: var(--red); font-weight: 700; }
                .verified-text { color: var(--green); font-weight: 700; }

                .reason-box {
                    background: rgba(239, 68, 68, 0.05);
                    border-left: 4px solid var(--red);
                    padding: 16px;
                    border-radius: 4px;
                    font-size: 14px;
                    color: var(--text-2);
                    margin-bottom: 24px;
                }

                .profile-section {
                    background: var(--bg);
                    border: 1px solid var(--border);
                    border-radius: var(--radius-lg);
                    padding: 24px;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .section-label {
                    font-family: var(--font-d);
                    font-size: 14px;
                    font-weight: 700;
                    color: var(--text-3);
                    text-transform: uppercase;
                    letter-spacing: 0.1em;
                    margin-bottom: 8px;
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .action-group {
                    margin-top: 32px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                }

                .explanation-card {
                    margin-top: 48px;
                    max-width: 1000px;
                    width: 100%;
                    padding: 24px;
                    border-radius: var(--radius-lg);
                    background: rgba(15, 23, 42, 0.03);
                    border: 1px solid var(--border);
                }

                .explanation-text {
                    font-size: 12px;
                    color: var(--text-2);
                    line-height: 1.8;
                }

                @keyframes fadeIn {
                    from { opacity: 0; transform: scale(0.98); }
                    to { opacity: 1; transform: scale(1); }
                }

                .spinner {
                    width: 20px;
                    height: 20px;
                    border: 2px solid rgba(255,255,255,0.3);
                    border-radius: 50%;
                    border-top-color: #fff;
                    animation: spin 0.8s linear infinite;
                }

                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
            `}</style>

            <div className="barrier-card">
                {statusContent}

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <div className="profile-section">
                        <div className="section-label">
                            <Lock size={14} /> 登録情報の確認・変更
                        </div>
                        <EditFieldInline
                            field="email"
                            label="メールアドレス"
                            value={userData.email}
                            onSave={() => { }}
                        />
                        <EditFieldInline
                            field="phoneNumber"
                            label="電話番号"
                            value={userData.phone}
                            onSave={() => { }}
                        />
                    </div>

                    <div className="action-group">
                        <button
                            className="btn btn-primary btn-full"
                            style={{ height: 56, fontSize: 16 }}
                            onClick={handleStartKyc}
                            disabled={loadingDidit}
                        >
                            {loadingDidit ? <div className="spinner" style={{ marginRight: 12 }} /> : <ShieldCheck size={20} style={{ marginRight: 10 }} />}
                            {kycStatus === 'pending' ? '本人確認を開始する' : '再度本人確認を行う'}
                        </button>

                        <div style={{ display: 'flex', gap: 12 }}>
                            <button
                                className="btn btn-ghost"
                                style={{ flex: 1, height: 48, fontSize: 13 }}
                                onClick={() => window.location.reload()}
                                disabled={loadingDidit}
                            >
                                <RefreshCw size={16} style={{ marginRight: 8 }} /> ステータスを更新
                            </button>
                            <a
                                href="/logout"
                                className="btn btn-danger"
                                style={{ flex: 1, height: 48, fontSize: 13 }}
                            >
                                ログアウト
                            </a>
                        </div>
                    </div>
                </div>
            </div>

            <div className="explanation-card">
                <div className="section-label" style={{ marginBottom: 12 }}>
                    <Shield size={14} /> 本人確認について
                </div>
                <p className="explanation-text">
                    MANSUKEのコミュニティをより安全なものにする取り組みの一環として、MANSUKEはお客様のメールアドレス・電話番号・セルフィー（自撮り）・政府発行の身分証明書の提出を求めます。<br />
                    お客様のメールアドレスと電話番号の所有を確認した後、セルフィーの撮影ステップに入ります。通常の場合本人確認ステップはこれにて終了となりますが、すでに同じセルフィーでMANSUKEアカウントに登録されている場合や、ライブネス（微弱な表情の変化など）を確認できなかった場合、政府発行の身分証明書の撮影ステップになる場合があります。<br />
                    いずれの情報も世界最高のセキュリティ基準を誇る本人確認サービスのDiditによって処理されます。<br />
                    本人確認に用いた情報はMANSUKEのプライバシーポリシーに沿って適切に扱います。
                </p>
            </div>
        </div>
    );
}
