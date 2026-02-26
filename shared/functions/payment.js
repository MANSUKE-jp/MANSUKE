const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
if (!admin.apps.length) admin.initializeApp();

const db = getFirestore("users");

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

/**
 * 料金を支払い、レシート(Receipt)を発行する関数。
 * フロントエンドから決済モーダル経由で呼ばれる。
 */
exports.processPayment = onCall({ region: "asia-northeast2" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { amount, serviceId, description } = request.data;

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
                type: 'payment',
                label: description || `[${serviceId.toUpperCase()}] サービス利用料`,
                createdAt: FieldValue.serverTimestamp(),
                serviceId,
                receiptId
            });

            // レシートを発行（未使用状態）
            t.set(receiptRef, {
                amount,
                serviceId,
                description,
                used: false,
                createdAt: FieldValue.serverTimestamp(),
                transactionId
            });
        });

        return { success: true, receiptId };
    } catch (e) {
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
exports.refundPayment = onCall({ region: "asia-northeast2" }, async (request) => {
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

            // 残高を戻す
            t.update(userRef, {
                balance: FieldValue.increment(receipt.amount),
                updatedAt: FieldValue.serverTimestamp()
            });

            // 取引履歴（返金）を作成
            t.set(transRef, {
                amount: receipt.amount,
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

        return { success: true };
    } catch (e) {
        if (e instanceof HttpsError) throw e;
        console.error("Refund Error:", e);
        throw new HttpsError('internal', '返金処理に失敗しました。');
    }
});

