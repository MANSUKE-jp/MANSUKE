import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, CheckCircle, AlertTriangle, ShieldCheck, CreditCard, Sparkles, Loader2 } from 'lucide-react';

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
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        variants={overlayVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        onClick={!isLoading ? onClose : undefined}
                        className="absolute inset-0 bg-black/60 backdrop-blur-md"
                    />

                    {/* Modal Content */}
                    <motion.div
                        variants={modalVariants}
                        initial="hidden"
                        animate="visible"
                        exit="exit"
                        className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden font-sans border border-gray-100"
                        style={{ fontFamily: "'Inter', 'Outfit', sans-serif" }}
                    >
                        {/* Header Decoration */}
                        <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 opacity-10"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 blur-[80px] rounded-full opacity-20 transform translate-x-1/2 -translate-y-1/2"></div>

                        <div className="relative p-8 flex flex-col items-center">
                            {/* Icon */}
                            <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 to-purple-600 shadow-xl shadow-indigo-200 flex items-center justify-center mb-6 text-white transform -rotate-3 hover:rotate-0 transition-transform">
                                <CreditCard size={32} />
                            </div>

                            <h2 className="text-2xl font-black text-gray-900 mb-1 tracking-tight text-center">
                                決済の確認
                            </h2>
                            <p className="text-sm font-bold text-indigo-600 mb-8 bg-indigo-50 px-3 py-1 rounded-full">
                                {serviceName || 'MANSUKE サービス'}
                            </p>

                            {/* Payment Details */}
                            <div className="w-full bg-gray-50 rounded-2xl p-6 mb-6 border border-gray-100 shadow-inner">
                                <div className="flex flex-col items-center justify-center mb-6">
                                    <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">お支払い金額</span>
                                    {isHirusupa ? (
                                        <span className="text-2xl font-black text-gray-900 tracking-tight">未確定金額</span>
                                    ) : (
                                        <div className="flex items-baseline gap-0.5">
                                            <span className="text-2xl font-bold text-gray-500">¥</span>
                                            <span className="text-5xl font-black text-gray-900 tracking-tighter">{amount}</span>
                                        </div>
                                    )}
                                </div>
                                <div className="w-full h-px bg-gradient-to-r from-transparent via-gray-200 to-transparent mb-4"></div>
                                <div className="text-center">
                                    <p className="text-sm font-bold text-gray-600 break-words">{description}</p>
                                </div>
                            </div>

                            {/* Balance Info */}
                            <div className="w-full mb-8">
                                <div className="flex justify-between items-center px-4 mb-2">
                                    <span className="text-sm font-bold text-gray-500">アカウント残高</span>
                                    <span className="text-sm font-black text-gray-900">¥{balance}</span>
                                </div>

                                {isHirusupa ? null : canAfford ? (
                                    <div className="flex justify-between items-center px-4 py-2 bg-emerald-50 rounded-xl border border-emerald-100">
                                        <div className="flex items-center gap-2 text-emerald-600">
                                            <CheckCircle size={16} />
                                            <span className="text-xs font-bold">決済後残高</span>
                                        </div>
                                        <span className="text-sm font-black text-emerald-700">¥{balance - amount}</span>
                                    </div>
                                ) : (
                                    <div className="flex flex-col gap-2 p-4 bg-red-50 rounded-xl border border-red-100">
                                        <div className="flex items-center gap-2 text-red-600">
                                            <AlertTriangle size={18} className="shrink-0" />
                                            <span className="text-sm font-bold">残高が不足しています</span>
                                        </div>
                                        <p className="text-xs text-red-500/80 font-medium pl-6">
                                            あと ¥{amount - balance} 必要です。チャージしてから再度お試しください。
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Actions */}
                            <div className="w-full flex flex-col gap-3">
                                <button
                                    onClick={onConfirm}
                                    disabled={!canAfford || isLoading}
                                    className="relative w-full py-4 rounded-xl font-black text-lg transition-all active:scale-[0.98] disabled:scale-100 disabled:opacity-50 disabled:cursor-not-allowed group overflow-hidden bg-gray-900 text-white hover:bg-black shadow-[0_8px_30px_rgb(0,0,0,0.12)] hover:shadow-[0_8px_30px_rgb(0,0,0,0.2)] disabled:shadow-none"
                                >
                                    {isLoading ? (
                                        <div className="flex items-center justify-center gap-2">
                                            <Loader2 size={20} className="animate-spin" />
                                            <span>処理中...</span>
                                        </div>
                                    ) : (
                                        <>
                                            <span className="relative z-10 font-bold flex items-center justify-center gap-2">
                                                決済を確定する
                                                <Sparkles size={18} className="text-yellow-400" />
                                            </span>
                                        </>
                                    )}
                                    {/* Shimmer effect */}
                                    <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent group-hover:animate-[shimmer_1.5s_infinite] z-0"></div>
                                </button>

                                {!isLoading && (
                                    <button
                                        onClick={onClose}
                                        className="w-full py-3 rounded-xl font-bold text-gray-500 hover:text-gray-700 hover:bg-gray-100 transition-colors"
                                    >
                                        キャンセル
                                    </button>
                                )}
                            </div>

                            {/* Footer */}
                            <div className="w-full mt-6 pt-6 border-t border-gray-100 flex items-center justify-center gap-2 text-gray-400">
                                <ShieldCheck size={14} />
                                <span className="text-[10px] uppercase tracking-widest font-bold">Secured by MANSUKE</span>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};

export default PaymentModal;
