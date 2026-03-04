const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
if (!admin.apps.length) admin.initializeApp();

const db = getFirestore("users");
const ordersDb = getFirestore("orders");
const prepaidDb = getFirestore('prepaid-card');

// Helper function to get authenticated UID from request (supports frontend auth & mansuke token)
async function getAuthenticatedUid(request) {
    if (request.auth && request.auth.uid) {
        return request.auth.uid;
    }

    const token = request.data?.token || request.rawRequest?.headers?.authorization?.split('Bearer ')[1];
    if (token) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            if (decodedToken && decodedToken.uid) {
                return decodedToken.uid;
            }
        } catch (error) {
            console.error("Token verification failed natively. Checking via API...", error.message);
            const axios = require("axios");
            try {
                const response = await axios.get('https://my.mansuke.jp/api/verifyMansukeToken', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data && response.data.uid) {
                    return response.data.uid;
                }
            } catch (apiError) {
                console.error("API verification failed:", apiError.message);
            }
        }
    }
    throw new HttpsError('unauthenticated', '認証が必要です。');
}

async function createUniqueTempOrder(ordersDb, orderData) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    while (true) {
        let randomStr = '';
        for (let i = 0; i < 8; i++) {
            randomStr += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        const transactionId = `#${randomStr}`;
        const orderRef = ordersDb.collection('orders').doc(transactionId);
        try {
            await orderRef.create({
                ...orderData,
                status: 'payment_processing',
                createdAt: FieldValue.serverTimestamp(),
                transactionId: transactionId
            });
            return { transactionId, orderRef };
        } catch (error) {
            if (error.code === 6) { // ALREADY_EXISTS code
                continue;
            }
            throw error;
        }
    }
}

/**
 * 料金を支払い、レシート(Receipt)を発行する関数。
 * フロントエンドから決済モーダル経由で呼ばれる。
 */
exports.processPayment = onCall({ region: "asia-northeast2", cors: true, enforceAppCheck: false, invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    let { amount, serviceId, description } = request.data;

    // ==== Security Update: Enforce Server-Side Amount ====
    // 決済金額はクライアントから送信された値ではなく、サーバー側で定義された金額を強制する
    if (serviceId === 'hirusupa_gemini') {
        amount = 5;
        description = "ラジオネーム生成（AI）";
    }
    // =====================================================

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
        throw new HttpsError('invalid-argument', '不正な金額です。');
    }
    if (!serviceId) {
        throw new HttpsError('invalid-argument', 'サービスIDが指定されていません。');
    }

    const userRef = db.collection('users').doc(uid);
    const receiptId = `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const receiptRef = userRef.collection('receipts').doc(receiptId);

    // 取引履歴も残す
    const transactionId = `${serviceId}_${Date.now()}`;
    const transRef = userRef.collection('transactions').doc(transactionId);

    // 一時的な注文データを作成（決済処理中）
    const { transactionId: generatedTransactionId, orderRef } = await createUniqueTempOrder(ordersDb, {
        userId: uid,
        amount,
        serviceId,
        description,
        receiptId
    });

    try {
        await db.runTransaction(async (t) => {
            const userSnap = await t.get(userRef);
            if (!userSnap.exists) {
                throw new HttpsError('not-found', 'ユーザーが見つかりません。');
            }

            const currentBalance = userSnap.data().balance || 0;
            if (currentBalance < amount) {
                throw new HttpsError('failed-precondition', '残高が不足しています。');
            }

            // 残高を減らす
            t.update(userRef, {
                balance: FieldValue.increment(-amount),
                updatedAt: FieldValue.serverTimestamp()
            });

            // 取引履歴を作成
            t.set(transRef, {
                amount: -amount,
                balanceAfter: currentBalance - amount,
                type: 'payment',
                label: description || `[${serviceId.toUpperCase()}] サービス利用料`,
                createdAt: FieldValue.serverTimestamp(),
                serviceId,
                receiptId,
                transactionId: generatedTransactionId
            });

            // レシートを発行（未使用状態）
            t.set(receiptRef, {
                amount,
                serviceId,
                description,
                used: false,
                createdAt: FieldValue.serverTimestamp(),
                transactionId: transactionId, // The local history ID
                globalTransactionId: generatedTransactionId // order ID replacement
            });
        });

        // 決済成功時に注文のステータスを完了にする
        await orderRef.update({
            status: 'completed',
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true, receiptId, transactionId: generatedTransactionId };
    } catch (e) {
        // 決済失敗時に注文のステータスを失敗にする
        await orderRef.update({
            status: 'failed',
            error: e.message,
            updatedAt: FieldValue.serverTimestamp()
        }).catch(err => console.error("Failed to update order status to failed:", err));


        if (e instanceof HttpsError) throw e;
        console.error("Payment Error:", e);
        throw new HttpsError('internal', '決済処理に失敗しました。');
    }
});

/**
 * 発行済みのレシートをキャンセルし、返金する関数。
 * 各サービスのバックエンドで処理が失敗した時のみ呼ばれる想定。
 * （※基本的にはフロント側から勝手に呼べないようにしたいが、ユーザー自信のレシートならキャンセル可能にしても良い。
 * ただし今回はサービス間連携のため、フロントからでも呼べるようにしておくか、Admin SDKでのみ呼べるようにする。
 * レシートが used: false の場合のみ返金可能。）
 */
exports.refundPayment = onCall({ region: "asia-northeast2", cors: true, enforceAppCheck: false, invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { receiptId } = request.data;

    if (!receiptId) {
        throw new HttpsError('invalid-argument', 'レシートIDが必要です。');
    }

    const userRef = db.collection('users').doc(uid);
    const receiptRef = userRef.collection('receipts').doc(receiptId);

    const transactionId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transRef = userRef.collection('transactions').doc(transactionId);

    try {
        await db.runTransaction(async (t) => {
            const receiptSnap = await t.get(receiptRef);
            if (!receiptSnap.exists) {
                throw new HttpsError('not-found', 'レシートが見つかりません。');
            }

            const receipt = receiptSnap.data();
            if (receipt.used) {
                throw new HttpsError('failed-precondition', 'このレシートは既に使用されているため返金できません。');
            }
            if (receipt.refunded) {
                throw new HttpsError('failed-precondition', 'このレシートは既に返金済みです。');
            }

            const userSnap = await t.get(userRef);
            const currentBalance = userSnap.data()?.balance || 0;

            // 残高を戻す
            t.update(userRef, {
                balance: FieldValue.increment(receipt.amount),
                updatedAt: FieldValue.serverTimestamp()
            });

            // 取引履歴（返金）を作成
            t.set(transRef, {
                amount: receipt.amount,
                balanceAfter: currentBalance + receipt.amount,
                type: 'refund',
                label: `[${receipt.serviceId.toUpperCase()}] キャンセル・返金`,
                createdAt: FieldValue.serverTimestamp(),
                serviceId: receipt.serviceId,
                originalReceiptId: receiptId
            });

            // レシートを返金済みとしてマーク
            t.update(receiptRef, {
                refunded: true,
                refundedAt: FieldValue.serverTimestamp()
            });
        });

        // 取引が成功したらordersデータベースの注文も返金済みに更新する
        try {
            const receiptSnap = await db.runTransaction(async t => t.get(receiptRef));
            const receiptData = receiptSnap.data();
            if (receiptData && receiptData.globalTransactionId) {
                const orderRef = ordersDb.collection('orders').doc(receiptData.globalTransactionId);
                await orderRef.update({
                    status: 'refunded',
                    refundedAt: FieldValue.serverTimestamp()
                });
            } else if (receiptData && receiptData.orderId) {
                // fallback for older records
                const orderRef = ordersDb.collection('orders').doc(receiptData.orderId);
                await orderRef.update({
                    status: 'refunded',
                    refundedAt: FieldValue.serverTimestamp()
                });
            }
        } catch(err) {
            console.error("Failed to update order status to refunded:", err);
        }

        return { success: true };
    } catch (e) {
        if (e instanceof HttpsError) throw e;
        console.error("Refund Error:", e);
        throw new HttpsError('internal', '返金処理に失敗しました。');
    }
});

/**
 * Handles MANSUKE PREPAID CARD redemption.
 */
exports.redeemCard = onCall({ region: "asia-northeast2", cors: true, enforceAppCheck: false, invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { pinCode, userPin } = request.data;

    // Validate inputs
    if (!pinCode || typeof pinCode !== 'string' || pinCode.length !== 10) {
        throw new HttpsError('invalid-argument', 'PINコードは10桁で入力してください');
    }
    if (!userPin || typeof userPin !== 'string' || !/^\d{4}$/.test(userPin)) {
        throw new HttpsError('invalid-argument', '暗証番号は4桁の数字で入力してください');
    }

    // Look up card in "prepaid-card" database
    let cardSnap;
    try {
        cardSnap = await prepaidDb.collection('cards')
            .where('pinCode', '==', pinCode)
            .limit(1)
            .get();
    } catch (err) {
        console.error('prepaid-card DB query error', err);
        throw new HttpsError('internal', 'カードの照会に失敗しました: ' + err.message);
    }

    if (cardSnap.empty) {
        throw new HttpsError('not-found', 'PINコードが見つかりません。正しいコードをご確認ください');
    }

    const cardDoc = cardSnap.docs[0];
    const card = cardDoc.data();

    // Verify status
    if (card.status !== 'active') {
        if (card.status === 'inactive') {
            throw new HttpsError('failed-precondition', 'このカードはまだ利用できません');
        }
        throw new HttpsError('failed-precondition', 'このカードはすでに使用済みです');
    }

    // Verify userPin
    if (card.userPin !== userPin) {
        throw new HttpsError('permission-denied', '暗証番号が正しくありません');
    }
    // Perform atomic check and update
    try {
        const { amount, transactionId: generatedTransactionId } = await db.runTransaction(async (t) => {
            // Read card doc
            const tCardSnap = await t.get(cardDoc.ref);
            if (!tCardSnap.exists) {
                throw new HttpsError('not-found', 'カードが見つかりません');
            }
            const tCard = tCardSnap.data();

            // Status check again inside transaction
            if (tCard.status !== 'active') {
                if (tCard.status === 'inactive') {
                    throw new HttpsError('failed-precondition', 'このカードはまだ利用できません');
                }
                throw new HttpsError('failed-precondition', 'このカードはすでに使用済みです');
            }

            const amount = Number(tCard.amount);
            if (!amount || amount <= 0) {
                throw new HttpsError('internal', 'カードの金額が無効です');
            }

            // Create global transaction ID order
            const { transactionId: generatedTransactionId, orderRef } = await createUniqueTempOrder(ordersDb, {
                userId: uid,
                amount: amount,
                type: 'prepaid_card_charge',
                cardId: cardDoc.id,
                description: 'プリペイドカードによる残高追加'
            });

            const userRef = db.collection('users').doc(uid);
            const userSnap = await t.get(userRef);
            if (!userSnap.exists) {
                throw new HttpsError('not-found', 'ユーザーが見つかりません');
            }

            const currentBalance = userSnap.data()?.balance || 0;
            const transactionId = `prepaid_${cardDoc.id}_${Date.now()}`;

            // Update user balance
            t.update(userRef, {
                balance: FieldValue.increment(amount),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Record transaction
            t.set(userRef.collection('transactions').doc(transactionId), {
                id: transactionId,
                type: 'prepaid_card',
                label: 'プリペイドカードによる残高追加',
                amount: amount,
                balanceAfter: currentBalance + amount,
                cardId: cardDoc.id,
                transactionId: generatedTransactionId,
                createdAt: FieldValue.serverTimestamp(),
            });

            // Mark card as redeemed
            t.update(cardDoc.ref, {
                status: 'redeemed',
                redeemedBy: uid,
                redeemedAt: FieldValue.serverTimestamp(),
            });

            // Update order status
            t.update(orderRef, {
                status: 'completed',
                updatedAt: FieldValue.serverTimestamp()
            });

            return { amount, transactionId: generatedTransactionId };
        });

        console.info('Prepaid card redeemed', { uid, cardId: cardDoc.id, amount, transactionId: generatedTransactionId });
        return { success: true, amount, transactionId: generatedTransactionId };
    } catch (error) {
        console.error("Redemption transaction failed:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', 'チャージ処理に失敗しました。');
    }
});

exports.createUniqueTransactionId = createUniqueTempOrder; // Export so staff adjust can use it

