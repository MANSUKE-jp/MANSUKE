import React, { useState } from 'react';
import { AlertTriangle, Hash, Check, Coins, User, Shield, Moon, Clock, Sparkles } from 'lucide-react';
import { httpsCallable } from 'firebase/functions';
import { functions } from '../../config/firebase.js';
import { ROLE_NAMES, ROLE_DEFINITIONS } from '../../constants/gameData.js';
import { usePayment, PaymentModal, usePopup } from '@mansuke/shared';

// ゲーム開始前のカウントダウン・役職希望リクエスト画面
export const CountdownScreen = ({ roomCode, matchId, mansukeUser, room, timeLeft }) => {
    // ステート管理
    const [selectedRole, setSelectedRole] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const myRequest = room?.roleRequests?.[mansukeUser?.uid];
    const [isLocked, setIsLocked] = useState(!!myRequest);

    // Payment Hook
    const payment = usePayment(functions);
    const popup = usePopup();

    // MANSUKE残高の取得（10Yen以上あるか判定）
    const balance = mansukeUser?.balance || 0;

    // カウントダウンの秒数
    const count = timeLeft !== undefined ? timeLeft : 15;

    // リクエスト送信処理 (事前決済を挟む)
    const handleConfirm = async () => {
        if (isSubmitting || isLocked || !selectedRole) return;

        payment.requestPayment({
            amount: 10,
            serviceName: "WEREWOLF",
            description: `[WEREWOLF] 役職指定（試合ID: ${matchId}）`,
            onSuccess: async (receiptId) => {
                setIsSubmitting(true);
                try {
                    const fn = httpsCallable(functions, 'submitRoleRequest');
                    await fn({ roomCode, roleId: selectedRole, receiptId });
                    setIsLocked(true);
                } catch (e) {
                    popup.alert("リクエストに失敗しました: " + e.message);
                } finally {
                    setIsSubmitting(false);
                }
            },
            onError: () => { }
        });
    };

    // 現在の部屋の設定で存在する役職のリストを生成
    const availableRoles = room?.roleSettings
        ? Object.entries(room.roleSettings)
            .filter(([, count]) => count > 0)
            .map(([role]) => role)
        : [];

    return (
        <div className="fixed inset-0 z-[100] flex flex-col md:flex-row bg-gray-950 text-gray-200 font-sans overflow-hidden">
            {/* 左側: カウンドダウン & 部屋情報 (30%) */}
            <div className="w-full md:w-[30%] flex flex-col items-center justify-center p-6 md:p-10 border-b md:border-b-0 md:border-r border-gray-700 bg-gray-800/50 backdrop-blur-md relative overflow-hidden">
                {/* 背景装飾 */}
                <div className="absolute top-0 left-0 w-full h-full pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-64 h-64 bg-red-600 rounded-full blur-[80px]"></div>
                    <div className="absolute -bottom-24 -right-24 w-64 h-64 bg-red-600 rounded-full blur-[80px]"></div>
                </div>

                <div className="relative z-10 flex flex-col items-center text-center">
                    <div className="flex items-center gap-2 mb-4 bg-red-950/10 px-4 py-1.5 rounded-full border border-red-500/30">
                        <Clock className="text-red-400 animate-pulse" size={18} />
                        <span className="text-xs font-black text-red-400 tracking-widest uppercase">まもなく開始します...</span>
                    </div>

                    <div className={`text-7xl md:text-9xl font-black font-mono tracking-tighter mb-8 transition-colors duration-300 ${count <= 5 ? 'text-red-500 drop-shadow-[0_0_25px_rgba(239,68,68,0.6)]' : 'text-gray-200 drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]'}`}>
                        {count}<span className="text-2xl md:text-4xl ml-2 text-gray-300">s</span>
                    </div>

                    <div className="space-y-3 w-full max-w-[240px]">
                        <div className="flex flex-col gap-1 bg-black/40 p-4 rounded-2xl border border-gray-700 backdrop-blur-sm shadow-xl">
                            <span className="text-[10px] text-gray-300 font-black tracking-widest uppercase">Room Code</span>
                            <span className="text-3xl font-black text-gray-200 font-mono tracking-widest">{roomCode}</span>
                        </div>
                        <div className="flex items-center justify-center gap-2 py-2 px-4 bg-gray-950/50 rounded-xl border border-gray-700/50">
                            <Hash size={12} className="text-gray-300" />
                            <span className="text-[10px] font-bold text-gray-300 tracking-tighter">MATCH: {matchId || "---"}</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* 右側: 役職指定 & 残高 (70%) */}
            <div className="flex-1 flex flex-col p-6 md:p-12 overflow-y-auto custom-scrollbar relative">
                <div className="max-w-4xl w-full mx-auto flex flex-col h-full">
                    {/* 案内ヘッダー */}
                    <div className="mb-8 md:mb-10">
                        <h2 className="text-3xl md:text-5xl font-black mb-4 flex items-center gap-4">
                            <Sparkles className="text-yellow-400 shrink-0" size={32} />
                            <span>役職事前指定</span>
                        </h2>
                        <div className="space-y-1 text-gray-300 font-bold">
                            <p className="text-sm md:text-base">料金を支払うことで、あなたの役職を事前に指定することができます。</p>
                            <p className="text-xs md:text-sm opacity-80">料金：1ゲームにつき10円（ご希望の役職になれなかった場合は請求しません）</p>
                            <p className="text-sm md:text-lg text-gray-200 mt-4 bg-gray-800/80 px-4 py-2 rounded-xl inline-block border border-gray-700">
                                あなたのMANSUKEアカウント残高：<span className="text-yellow-400 font-mono text-xl md:text-2xl mx-1">{balance}</span>円
                            </p>
                        </div>
                    </div>

                    {/* 操作エリア */}
                    <div className="flex-1">
                        {balance < 10 ? (
                            <div className="bg-red-950/20 border-2 border-red-500/30 p-10 rounded-3xl flex flex-col items-center justify-center text-center animate-pulse">
                                <AlertTriangle size={48} className="text-red-500 mb-4" />
                                <h3 className="text-xl md:text-2xl font-black text-red-400 mb-2">アカウント残高が不足しているため、<br className="sm:hidden" />この機能は使用できません。</h3>
                            </div>
                        ) : (
                            <div className="flex flex-col h-full">
                                <div className="mb-6 flex items-center gap-3">
                                    <div className="w-2 h-8 bg-red-600 rounded-full"></div>
                                    <div className="flex flex-col">
                                        <p className="text-lg md:text-xl font-bold text-gray-300">ご希望の役職を選択して、OKを押してください。</p>
                                        <p className="text-sm md:text-base text-gray-300 font-bold mt-1 ml-1">役職を指定しない場合は、OKを押さずにこのままお待ちください。</p>
                                    </div>
                                </div>

                                <div className="space-y-8">
                                    <div className="relative">
                                        {isLocked && (
                                            <div className="absolute -inset-4 z-20 bg-gray-950/80 backdrop-blur-md rounded-3xl flex flex-col items-center justify-center border-2 border-emerald-500/30 animate-fade-in shadow-2xl">
                                                <div className="bg-emerald-500/20 p-5 rounded-full mb-6 border border-emerald-500/30">
                                                    <Check size={56} className="text-emerald-400" />
                                                </div>
                                                <h3 className="text-3xl font-black text-emerald-400 mb-2">リクエスト完了</h3>
                                                <p className="text-gray-300 font-bold">役職の割り振りを待っています...</p>
                                            </div>
                                        )}

                                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4">

                                            {/* 各役職ボタン（ユニーク表示） */}
                                            {availableRoles.map(roleId => {
                                                const def = ROLE_DEFINITIONS[roleId];
                                                const Icon = def?.icon || User;
                                                const isSelected = selectedRole === roleId;

                                                return (
                                                    <button
                                                        key={roleId}
                                                        onClick={() => !isLocked && setSelectedRole(roleId)}
                                                        disabled={isLocked}
                                                        className={`relative flex flex-col items-center justify-center gap-2 p-5 rounded-2xl border-2 transition-all duration-200 group ${isSelected
                                                            ? 'bg-red-600/20 border-red-500 shadow-[0_0_30px_rgba(99,102,241,0.3)]'
                                                            : 'bg-gray-800/50 border-gray-700 hover:bg-gray-950 hover:border-red-500/50'
                                                            }`}
                                                    >
                                                        <div className={`p-3 rounded-xl transition-colors shrink-0 ${isSelected ? 'bg-red-600 text-white' : 'bg-gray-950 text-gray-300 group-hover:text-red-300'}`}>
                                                            <Icon size={28} />
                                                        </div>
                                                        <span className={`block font-black text-base md:text-lg text-center ${isSelected ? 'text-gray-200' : 'text-gray-300 group-hover:text-gray-300'}`}>
                                                            {ROLE_NAMES[roleId] || roleId}
                                                        </span>
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>

                                    {/* 決定ボタン */}
                                    <div className="flex justify-center mt-8">
                                        <button
                                            onClick={handleConfirm}
                                            disabled={isSubmitting || isLocked || !selectedRole}
                                            className="w-full max-w-md group relative py-5 rounded-2xl font-black text-2xl transition-all active:scale-95 bg-gradient-to-r from-emerald-500 to-emerald-600 text-white hover:from-emerald-400 hover:to-emerald-500 shadow-lg shadow-emerald-500/30 disabled:opacity-30 disabled:grayscale disabled:scale-95 disabled:cursor-not-allowed flex items-center justify-center gap-3 overflow-hidden border border-emerald-400/50"
                                        >
                                            {isSubmitting ? (
                                                <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    <Check className="relative z-10" size={24} />
                                                    <span className="relative z-10">役職を指定する</span>
                                                </>
                                            )}
                                            {/* ホバー演出用 */}
                                            <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover:animate-shimmer pointer-events-none"></div>
                                        </button>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            <PaymentModal
                isOpen={payment.isOpen}
                onClose={payment.handleClose}
                onConfirm={payment.handleConfirm}
                amount={payment.paymentConfig.amount}
                serviceName={payment.paymentConfig.serviceName}
                description={payment.paymentConfig.description}
                balance={balance}
                isLoading={payment.isProcessing}
            />
        </div>
    );
};