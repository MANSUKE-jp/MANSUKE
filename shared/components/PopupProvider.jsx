import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle, Info, HelpCircle } from 'lucide-react';
import './PopupProvider.css';

const PopupContext = createContext(null);

export const usePopup = () => {
    const context = useContext(PopupContext);
    if (!context) {
        throw new Error('usePopup must be used within a PopupProvider');
    }
    return context;
};

export const PopupProvider = ({ children }) => {
    const [popupContent, setPopupContent] = useState(null);

    const closePopup = useCallback(() => {
        setPopupContent(null);
    }, []);

    const showPopup = useCallback(({ type, title, message, defaultValue = '', secure = false }) => {
        return new Promise((resolve) => {
            const handleConfirm = (value) => {
                closePopup();
                resolve(type === 'prompt' ? value : true);
            };

            const handleCancel = () => {
                closePopup();
                resolve(type === 'prompt' ? null : false);
            };

            setPopupContent({
                type,
                title,
                message,
                defaultValue,
                secure,
                onConfirm: handleConfirm,
                onCancel: handleCancel,
            });
        });
    }, [closePopup]);

    const alert = useCallback(
        (message, title = 'Notification') => showPopup({ type: 'alert', title, message }),
        [showPopup]
    );

    const confirm = useCallback(
        (message, title = 'Confirmation') => showPopup({ type: 'confirm', title, message }),
        [showPopup]
    );

    const prompt = useCallback(
        (message, defaultValue = '', title = 'Input Required', secure = false) =>
            showPopup({ type: 'prompt', title, message, defaultValue, secure }),
        [showPopup]
    );

    const renderIcon = (type) => {
        switch (type) {
            case 'alert':
                return <Info className="popup-icon text-blue-500" size={32} />;
            case 'confirm':
                return <HelpCircle className="popup-icon text-orange-500" size={32} />;
            case 'prompt':
                return <CheckCircle className="popup-icon text-green-500" size={32} />;
            default:
                return null;
        }
    };

    return (
        <PopupContext.Provider value={{ alert, confirm, prompt }}>
            {children}
            <AnimatePresence>
                {popupContent && (
                    <div className="popup-overlay z-[9999]" onClick={(e) => {
                        // オーバーレイクリックでは閉じない（ネイティブ挙動に合わせ、明示的な操作を必要とする）
                    }}>
                        <motion.div
                            className="popup-backdrop"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            onClick={popupContent.type === 'alert' ? popupContent.onConfirm : undefined} // alertのみバックドロップクリックで閉じる（confirmとpromptは閉じない）
                        />
                        <motion.div
                            className="popup-container"
                            initial={{ scale: 0.9, opacity: 0, y: 20 }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.9, opacity: 0, y: 20 }}
                            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="popup-header">
                                {renderIcon(popupContent.type)}
                                {popupContent.title && <h3 className="popup-title">{popupContent.title}</h3>}
                            </div>
                            
                            <div className="popup-body">
                                {typeof popupContent.message === 'string' ? (
                                    <p className="popup-message">{popupContent.message.split('\n').map((line, i) => (
                                        <React.Fragment key={i}>
                                            {line}
                                            <br />
                                        </React.Fragment>
                                    ))}</p>
                                ) : (
                                    popupContent.message
                                )}
                            </div>

                            {popupContent.type === 'prompt' && (
                                <div className="popup-input-container">
                                    <input
                                        type={popupContent.secure ? 'password' : 'text'}
                                        defaultValue={popupContent.defaultValue}
                                        className="popup-input"
                                        autoFocus
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') popupContent.onConfirm(e.currentTarget.value);
                                            if (e.key === 'Escape') popupContent.onCancel();
                                        }}
                                        id="popup-prompt-input"
                                    />
                                </div>
                            )}

                            <div className="popup-actions" style={{ flexDirection: popupContent.type === 'alert' ? 'column' : 'row' }}>
                                {popupContent.type !== 'alert' && (
                                    <button className="popup-button popup-button-cancel" onClick={popupContent.onCancel}>
                                        キャンセル
                                    </button>
                                )}
                                <button
                                    className="popup-button popup-button-confirm"
                                    autoFocus={popupContent.type !== 'prompt'}
                                    onClick={() => {
                                        if (popupContent.type === 'prompt') {
                                            const input = document.getElementById('popup-prompt-input');
                                            popupContent.onConfirm(input ? input.value : '');
                                        } else {
                                            popupContent.onConfirm(true);
                                        }
                                    }}
                                >
                                    OK
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </PopupContext.Provider>
    );
};
