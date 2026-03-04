import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CreditCard, AlertTriangle, Loader2 } from 'lucide-react';

export const PaymentModal = ({
    isOpen,
    onClose,
    onConfirm,
    amount,
    description,
    serviceName,
    balance = 0,
    isLoading = false
}) => {
    // If modal is closed, don't render content (but keep AnimatePresence wrapper for exit animations)
    const isHirusupa = serviceName === 'HIRUSUPA';
    const canAfford = isHirusupa ? true : balance >= amount;

    // Component variants
    const overlayVariants = {
        hidden: { opacity: 0 },
        visible: { opacity: 1, transition: { duration: 0.2 } },
        exit: { opacity: 0, transition: { duration: 0.2 } }
    };

    const modalVariants = {
        hidden: { scale: 0.95, opacity: 0, y: 20 },
        visible: {
            scale: 1,
            opacity: 1,
            y: 0,
            transition: { type: "spring", stiffness: 300, damping: 30 }
        },
        exit: {
            scale: 0.95,
            opacity: 0,
            y: 20,
            transition: { duration: 0.2 }
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    {/* Backdrop */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={!isLoading ? onClose : undefined}
                        style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(4px)' }}
                    />

                    {/* Modal Content */}
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        style={{ 
                            position: 'relative', width: '100%', maxWidth: '400px', 
                            background: '#ffffff', borderRadius: '24px', 
                            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', 
                            overflow: 'hidden', fontFamily: "'Inter', sans-serif",
                            padding: '32px', textAlign: 'center', border: '1px solid #f3f4f6'
                        }}
                    >
                        <div style={{ width: 64, height: 64, margin: '0 auto 16px', background: '#f8fafc', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0f172a' }}>
                            <CreditCard size={32} />
                        </div>
                        <h2 style={{ fontSize: '20px', fontWeight: 800, margin: '0 0 8px 0', color: '#0f172a' }}>決済の確認</h2>
                        <div style={{ fontSize: '14px', color: '#64748b', marginBottom: 24, fontWeight: 700 }}>
                            {serviceName === 'donation' ? 'MANSUKE サービス' : serviceName || 'MANSUKE サービス'}
                        </div>

                        <div style={{ background: '#f8fafc', borderRadius: '16px', padding: '24px', marginBottom: 24, border: '1px solid #f1f5f9' }}>
                            <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: 8 }}>お支払い金額</div>
                            <div style={{ fontSize: 36, fontWeight: 900, color: '#0f172a', lineHeight: 1 }}>
                                {isHirusupa ? '未確定' : `¥${amount.toLocaleString()}`}
                            </div>
                            <div style={{ marginTop: 16, fontSize: '14px', fontWeight: 600, color: '#475569' }}>
                                {description}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, padding: '0 16px' }}>
                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#64748b' }}>現在のアカウント残高</span>
                            <span style={{ fontSize: '16px', fontWeight: 800, color: '#0f172a' }}>¥{balance.toLocaleString()}</span>
                        </div>

                        {isHirusupa ? null : canAfford ? (
                            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', background: 'rgba(52,211,153,0.1)', borderRadius: '12px', marginBottom: 24 }}>
                                <span style={{ fontSize: '14px', fontWeight: 700, color: '#10b981', display: 'flex', alignItems: 'center', gap: 6 }}>
                                    決済後残高
                                </span>
                                <span style={{ fontSize: '16px', fontWeight: 800, color: '#059669' }}>
                                    ¥{(balance - amount).toLocaleString()}
                                </span>
                            </div>
                        ) : (
                            <div style={{ textAlign: 'left', padding: '16px', background: 'rgba(244,63,94,0.1)', borderRadius: '12px', marginBottom: 24, color: '#e11d48' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 4, fontSize: '14px' }}>
                                    <AlertTriangle size={16} /> 残高が不足しています
                                </div>
                                <div style={{ fontSize: '12px', paddingLeft: 22, fontWeight: 600, opacity: 0.9 }}>
                                    あと ¥{(amount - balance).toLocaleString()} 必要です。
                                </div>
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                            <button 
                                onClick={onConfirm} 
                                disabled={!canAfford || isLoading}
                                style={{ 
                                    padding: '16px', borderRadius: '12px', fontSize: '16px', 
                                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                                    background: (!canAfford || isLoading) ? '#cbd5e1' : '#0f172a',
                                    color: '#ffffff', fontWeight: 700, border: 'none', cursor: (!canAfford || isLoading) ? 'not-allowed' : 'pointer',
                                    transition: 'background 0.2s', width: '100%'
                                }}
                            >
                                {isLoading ? (
                                    <>
                                        <Loader2 size={20} className="animate-spin" />
                                        <span>処理中...</span>
                                    </>
                                ) : '決済を確定する'}
                            </button>
                            {!isLoading && (
                                <button 
                                    onClick={onClose} 
                                    style={{ 
                                        padding: '16px', borderRadius: '12px', fontSize: '14px',
                                        background: 'transparent', color: '#64748b', fontWeight: 700,
                                        border: 'none', cursor: 'pointer', transition: 'color 0.2s', width: '100%'
                                    }}
                                >
                                    キャンセル
                                </button>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PaymentModal;
