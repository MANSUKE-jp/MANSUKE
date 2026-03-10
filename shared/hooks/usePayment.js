import { useState } from 'react';
import { httpsCallable } from 'firebase/functions';

export const usePayment = (functionsInstance) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [paymentConfig, setPaymentConfig] = useState({
        amount: 0,
        description: '',
        serviceName: '',
        isSubscription: false,
        interval: 'month',
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
        setPaymentConfig({ ...config, isSubscription: false });
        setIsOpen(true);
    };

    /**
     * @param {Object} config
     * @param {number} config.amount
     * @param {string} config.description
     * @param {string} config.serviceName
     * @param {string} config.interval - 'day', 'month', 'year'
     * @param {Function} config.onSuccess  // Called with subId on success
     * @param {Function} config.onError
     */
    const requestSubscription = (config) => {
        setPaymentConfig({ ...config, isSubscription: true });
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

            // == NEW: Subscription Flow ==
            if (paymentConfig.isSubscription) {
                const createSubscriptionFn = httpsCallable(functionsInstance, 'createSubscription');
                const result = await createSubscriptionFn({
                    amount: paymentConfig.amount,
                    serviceId: paymentConfig.serviceName.toLowerCase(),
                    description: paymentConfig.description,
                    interval: paymentConfig.interval || 'month'
                });

                if (result.data.success) {
                    setIsOpen(false);
                    if (paymentConfig.onSuccess) {
                        await paymentConfig.onSuccess(result.data.subId);
                    }
                } else {
                    throw new Error("サブスクリプションの作成に失敗しました。");
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
        requestSubscription,
        handleClose,
        handleConfirm
    };
};

export default usePayment;
