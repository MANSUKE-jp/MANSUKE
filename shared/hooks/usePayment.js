import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';

export const usePayment = (functionsInstance) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState({
        amount: 0,
        description: '',
        serviceName: '',
        onSuccess: null,
        onError: null
    });

    /**
     * @param {Object} config
     * @param {number} config.amount
     * @param {string} config.description
     * @param {string} config.serviceName
     * @param {boolean} config.isPreApproval // Skip backend call on confirmation
     * @param {Function} config.onSuccess  // Called with receiptId on success
     * @param {Function} config.onError
     */
    const requestPayment = (config) => {
        setPaymentConfig(config);
        setIsOpen(true);
    };

    const handleClose = () => {
        setIsOpen(false);
        if (paymentConfig.onError) {
            paymentConfig.onError(new Error("キャンセルされました"));
        }
    };

    const handleConfirm = async () => {
        setIsProcessing(true);
        try {
            // == NEW: Pre-Approval Flow (No immediate backend charge) ==
            if (paymentConfig.isPreApproval) {
                setIsOpen(false);
                if (paymentConfig.onSuccess) {
                    await paymentConfig.onSuccess("pre-approved");
                }
                return;
            }
            // ==========================================================

            const processPaymentFn = httpsCallable(functionsInstance, 'processPayment');

            const result = await processPaymentFn({
                amount: paymentConfig.amount,
                serviceId: paymentConfig.serviceName.toLowerCase(),
                description: paymentConfig.description
            });

            if (result.data.success) {
                setIsOpen(false);
                if (paymentConfig.onSuccess) {
                    await paymentConfig.onSuccess(result.data.receiptId);
                }
            } else {
                throw new Error("決済に失敗しました。");
            }
        } catch (error) {
            if (paymentConfig.onError) {
                paymentConfig.onError(error);
            } else {
                alert(`決済エラー: ${error.message}`);
            }
            setIsOpen(false);
        } finally {
            setIsProcessing(false);
        }
    };

    return {
        isOpen,
        isProcessing,
        paymentConfig,
        requestPayment,
        handleClose,
        handleConfirm
    };
};

export default usePayment;
