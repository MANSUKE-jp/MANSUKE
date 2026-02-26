import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { LogOut, User, Settings, CheckCircle2, Save, X } from 'lucide-react';
import { db, usersDb, functions } from '../config/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

function AccountDisplay({ user }) {
    const [isExpanded, setIsExpanded] = useState(false);
    const [isEditing, setIsEditing] = useState(false);
    const [editNickname, setEditNickname] = useState(user?.nickname || "");
    const [isSaving, setIsSaving] = useState(false);

    // MANSUKEアカウントの情報から表示名を決定
    const fullName = user?.name || (user?.lastName && user?.firstName
        ? `${user.lastName} ${user.firstName}`
        : user?.displayName || user?.email || "ゲスト");

    const avatarUrl = user?.photoURL || null;

    // 最新のnickname (編集中・保存後を反映)
    const displayNickname = user?.nickname || "未設定";

    const handleLogout = async () => {
        if (user?.isAnonymous) {
            const { getAuth, signOut } = await import('firebase/auth');
            await signOut(getAuth());
            window.location.reload(); // Refresh to re-trigger anonymous login or show home
            return;
        }
        document.cookie = "__session=; domain=.mansuke.jp; path=/; max-age=0; secure; samesite=lax";
        window.location.href = `https://my.mansuke.jp/logout`;
    };

    const handleEditClick = () => {
        setEditNickname(user?.nickname || "");
        setIsEditing(true);
    };

    const handleCancelEdit = () => {
        setIsEditing(false);
    };

    const handleSaveNickname = async () => {
        if (!user || !user.uid) return;
        setIsSaving(true);
        try {
            const fn = httpsCallable(functions, 'updateNickname');
            await fn({ nickname: editNickname });
            // MANSUKE アカウントの state が自動更新されない場合のためにローカルだけでも表示できるように
            // 実際は onSnapshot によって自動更新されるか、親コンポーネント経由で再レンダリングされるはず
            if (user) user.nickname = editNickname;
            setIsEditing(false);
        } catch (error) {
            alert("ニックネームの更新に失敗しました。");
        } finally {
            setIsSaving(false);
        }
    };

    if (!user) return null;

    return (
        <div className="fixed bottom-4 left-4 z-50 account-widget-container" style={{ width: '280px' }}>
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="account-widget-popup"
                    >
                        <div className="widget-avatar-large flex flex-col items-center">
                            {avatarUrl ? (
                                <img src={avatarUrl} alt={fullName} />
                            ) : (
                                <User size={40} />
                            )}
                        </div>
                        <div className="widget-popup-name mt-2">{fullName}</div>
                        <div className="widget-popup-email mb-2">{user?.email}</div>


                        {/* ニックネーム編集エリア */}
                        <div className="px-4 pb-4">
                            {isEditing ? (
                                <div className="flex flex-col gap-2 bg-gray-800 p-3 rounded-lg border border-gray-700">
                                    <label className="text-xs text-gray-400 font-bold">ニックネーム</label>
                                    <input
                                        type="text"
                                        value={editNickname}
                                        onChange={(e) => setEditNickname(e.target.value)}
                                        className="w-full bg-gray-900 border border-gray-600 rounded px-2 py-1 text-sm text-white focus:outline-none focus:border-blue-500"
                                        placeholder="未設定"
                                        disabled={isSaving}
                                        autoFocus
                                    />
                                    <div className="flex justify-end gap-2 mt-2">
                                        <button
                                            onClick={handleCancelEdit}
                                            disabled={isSaving}
                                            className="px-3 py-1 text-xs text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 rounded flex items-center gap-1"
                                        >
                                            キャンセル
                                        </button>
                                        <button
                                            onClick={handleSaveNickname}
                                            disabled={isSaving}
                                            className="px-3 py-1 text-xs text-white bg-blue-600 hover:bg-blue-500 rounded flex items-center gap-1"
                                        >
                                            {isSaving ? "保存中..." : "保存"}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="widget-popup-menu mt-0 pt-0">
                                    <button
                                        onClick={handleEditClick}
                                        className="widget-menu-item"
                                    >
                                        <Settings size={16} /> ニックネームを変更
                                    </button>
                                </div>
                            )}
                        </div>

                        <div className="widget-popup-menu border-t border-gray-800">
                            <button
                                onClick={handleLogout}
                                className="widget-menu-item danger"
                            >
                                <LogOut size={16} /> ログアウト
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                    setIsExpanded(!isExpanded);
                    if (isExpanded) setIsEditing(false); // 閉じる時に編集状態リセット
                }}
                className={`account-widget-button ${isExpanded ? 'expanded' : 'collapsed'}`}
            >
                <div className="widget-avatar">
                    {avatarUrl ? (
                        <img src={avatarUrl} alt={fullName} />
                    ) : (
                        <User size={24} />
                    )}
                </div>
                <div className="widget-name-col">
                    <div className="widget-name-row">
                        <span className="widget-name-text">{fullName}</span>
                        <CheckCircle2 size={16}
                            className={isExpanded ? "text-indigo-200" : ""}
                            color={isExpanded ? "rgba(255,255,255,0.7)" : "#3b82f6"}
                        />
                    </div>
                    <div className="flex flex-col gap-0.5" style={{
                        color: isExpanded ? 'rgba(255,255,255,0.95)' : '#64748b',
                    }}>
                        <span className="widget-subtitle" style={{ fontWeight: '700' }}>
                            ニックネーム: {displayNickname}
                        </span>

                    </div>
                </div>
            </motion.button>
        </div>
    );
}

export default AccountDisplay;
