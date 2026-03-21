const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
if (!admin.apps.length) admin.initializeApp();

const db = getFirestore("users");
const ordersDb = getFirestore("orders");
const prepaidDb = getFirestore('prepaid-card');

// フロント認証とMANSUKEトークン認証の両方に対応した認証UID取得ヘルパー関数
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
            console.error("Firebaseによるトークン検証失敗。APIによる検証を試みます...", error.message);
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
            if (error.code === 6) { // ALREADY_EXISTS エラーコード
                continue;
            }
            console.error("Error creating temp order:", error);
            throw error;
        }
    }
}

// 料金を支払い、レシートを発行する関数。
// フロントエンドから決済モーダル経由で呼ばれる。
exports.processPayment = onCall(async (request) => {
    try {
        const uid = await getAuthenticatedUid(request);
        let { amount, serviceId, description } = request.data;

        // セキュリティ上、サーバー側で決済金額を強制する（クライアントの値は使用しない）
        // サービスごとに金額と説明を上書き設定する
        if (serviceId === 'hirusupa_gemini') {
            amount = 5;
            description = "ラジオネーム生成（AI）";
        }

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
        let generatedTransactionId, orderRef;
        try {
            const tempOrder = await createUniqueTempOrder(ordersDb, {
                userId: uid,
                amount,
                serviceId,
                description,
                receiptId
            });
            generatedTransactionId = tempOrder.transactionId;
            orderRef = tempOrder.orderRef;
        } catch (e) {
            console.error("Payment Debug: Failed in createUniqueTempOrder:", e);
            throw e;
        }

        try {
            await db.runTransaction(async (t) => {
                const userSnap = await t.get(userRef);
                if (!userSnap.exists) {
                    console.error(`User missing for uid: ${uid}`);
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
                    transactionId: transactionId, // ローカル取引履歴ID
                    globalTransactionId: generatedTransactionId // 注文IDの代替
                });
            });

            // 決済成功時に注文のステータスを完了にする
            if (orderRef) {
                await orderRef.update({
                    status: 'completed',
                    updatedAt: FieldValue.serverTimestamp()
                });
            }

            return { success: true, receiptId, transactionId: generatedTransactionId };
        } catch (e) {
            // 決済失敗時に注文のステータスを失敗にする
            if (orderRef) {
                await orderRef.update({
                    status: 'failed',
                    error: e.message || 'Unknown error',
                    updatedAt: FieldValue.serverTimestamp()
                }).catch(err => console.error("注文ステータスの失敗更新に失敗:", err));
            }


            if (e instanceof HttpsError) throw e;
            console.error("Payment Error Full Details:", e);
            if (e.stack) console.error("Stack trace:", e.stack);
            throw new HttpsError('internal', '決済処理に失敗しました。詳細なエラーログを確認してください。');
        }
    } catch (globalErr) {
        console.error("Payment Global Catch:", globalErr);
        if (globalErr.stack) console.error("Global Stack trace:", globalErr.stack);
        if (globalErr instanceof HttpsError) {
            throw globalErr;
        }
        throw new HttpsError('internal', `決済処理の初期化に失敗しました: ${globalErr.message || "Unknown"}`);
    }
});

// 発行済みのレシートをキャンセルし返金する関数。
// 各サービスのバックエンドで処理が失敗した時のみ呼ばれる想定。
// レシートが used:false の場合のみ返金可能。
exports.refundPayment = onCall(async (request) => {
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
                // 古いレコードへのフォールバック
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

// MANSUKE プリペイドカード引き換え処理
exports.redeemCard = onCall(async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { pinCode, userPin } = request.data;

    // 入力値のバリデーション
    if (!pinCode || typeof pinCode !== 'string' || pinCode.length !== 10) {
        throw new HttpsError('invalid-argument', 'PINコードは10桁で入力してください');
    }
    if (!userPin || typeof userPin !== 'string' || !/^\d{4}$/.test(userPin)) {
        throw new HttpsError('invalid-argument', '暗証番号は4桁の数字で入力してください');
    }

    // prepaid-card データベースでカードを検索する
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

    // ステータスの検証
    if (card.status !== 'active') {
        if (card.status === 'inactive') {
            throw new HttpsError('failed-precondition', 'このカードはまだ利用できません');
        }
        throw new HttpsError('failed-precondition', 'このカードはすでに使用済みです');
    }

    // 暗証番号の検証
    if (card.userPin !== userPin) {
        throw new HttpsError('permission-denied', '暗証番号が正しくありません');
    }
    // アトミックなチェックと更新を実行
    try {
        const { amount, transactionId: generatedTransactionId } = await db.runTransaction(async (t) => {
            // カードドキュメントを読み込む
            const tCardSnap = await t.get(cardDoc.ref);
            if (!tCardSnap.exists) {
                throw new HttpsError('not-found', 'カードが見つかりません');
            }
            const tCard = tCardSnap.data();

            // トランザクション内でもステータスを再確認する
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

            // グローバルトランザクションIDの注文を生成する
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

            // ユーザー残高を更新する
            t.update(userRef, {
                balance: FieldValue.increment(amount),
                updatedAt: FieldValue.serverTimestamp(),
            });

            // 取引履歴を記録する
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

            // カードを引き換え済みとしてマークする
            t.update(cardDoc.ref, {
                status: 'redeemed',
                redeemedBy: uid,
                redeemedAt: FieldValue.serverTimestamp(),
            });

            // 注文ステータスを完了にする
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

async function internalCreateSubscription(uid, amount, serviceId, description, interval = 'month') {
    // 必要に応じてサーバー側で決済金額を強制する
    if (serviceId === 'hirusupa_gemini') {
        amount = 5;
    }

    if (!amount || amount <= 0 || !Number.isInteger(amount)) {
        throw new HttpsError('invalid-argument', '不正な金額です。');
    }
    if (!serviceId) {
        throw new HttpsError('invalid-argument', 'サービスIDが指定されていません。');
    }

    const userRef = db.collection('users').doc(uid);
    const subId = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const subRef = userRef.collection('subscriptions').doc(subId);

    const receiptId = `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const receiptRef = userRef.collection('receipts').doc(receiptId);
    const transactionId = `${serviceId}_${Date.now()}`;
    const transRef = userRef.collection('transactions').doc(transactionId);

    const { transactionId: generatedTransactionId, orderRef } = await createUniqueTempOrder(ordersDb, {
        userId: uid,
        amount,
        serviceId,
        description,
        receiptId,
        type: 'subscription_initial'
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

            const now = new Date();
            const nextBillingDate = new Date(now);
            if (interval === 'month') {
                nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
            } else if (interval === 'day') {
                nextBillingDate.setDate(nextBillingDate.getDate() + 1);
            } else if (interval === 'year') {
                nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
            } else {
                throw new HttpsError('invalid-argument', '無効な期間指定です。');
            }

            t.update(userRef, {
                balance: FieldValue.increment(-amount),
                updatedAt: FieldValue.serverTimestamp()
            });

            t.set(transRef, {
                amount: -amount,
                balanceAfter: currentBalance - amount,
                type: 'payment',
                label: description || `[${serviceId.toUpperCase()}] サブスクリプション初回決済`,
                createdAt: FieldValue.serverTimestamp(),
                serviceId,
                receiptId,
                transactionId: generatedTransactionId,
                subscriptionId: subId
            });

            t.set(receiptRef, {
                amount,
                serviceId,
                description,
                used: false,
                createdAt: FieldValue.serverTimestamp(),
                transactionId: transactionId,
                globalTransactionId: generatedTransactionId,
                subscriptionId: subId
            });

            t.set(subRef, {
                serviceId,
                description,
                amount,
                interval,
                status: 'active',
                createdAt: FieldValue.serverTimestamp(),
                nextBillingDate: admin.firestore.Timestamp.fromDate(nextBillingDate),
                lastBillingDate: FieldValue.serverTimestamp(),
                failureCount: 0
            });
        });

        await orderRef.update({
            status: 'completed',
            updatedAt: FieldValue.serverTimestamp()
        });

        return { success: true, subId, receiptId, transactionId: generatedTransactionId };
    } catch (e) {
        await orderRef.update({
            status: 'failed',
            error: e.message,
            updatedAt: FieldValue.serverTimestamp()
        }).catch(err => console.error("注文ステータスの失敗更新に失敗:", err));

        if (e instanceof HttpsError) throw e;
        console.error("Subscription Error:", e);
        throw new HttpsError('internal', 'サブスクリプション処理に失敗しました。');
    }
}

// サブスクリプションを作成し、初回の決済を行う
exports.createSubscription = onCall(async (request) => {
    const uid = await getAuthenticatedUid(request);
    let { amount, serviceId, description, interval = 'month' } = request.data;
    return await internalCreateSubscription(uid, amount, serviceId, description, interval);
});

async function internalCancelSubscription(uid, subId) {
    if (!subId) {
        throw new HttpsError('invalid-argument', 'サブスクリプションIDが指定されていません。');
    }

    const subRef = db.collection('users').doc(uid).collection('subscriptions').doc(subId);
    
    try {
        await db.runTransaction(async (t) => {
            const subSnap = await t.get(subRef);
            if (!subSnap.exists) {
                throw new HttpsError('not-found', 'サブスクリプションが見つかりません。');
            }
            if (subSnap.data().status === 'cancelled') {
                throw new HttpsError('failed-precondition', '既にキャンセルされています。');
            }

            t.update(subRef, {
                status: 'cancelled',
                cancelledAt: FieldValue.serverTimestamp()
            });
        });

        return { success: true };
    } catch (e) {
        if (e instanceof HttpsError) throw e;
        console.error("Cancel Subscription Error:", e);
        throw new HttpsError('internal', 'キャンセル処理に失敗しました。');
    }
}

// サブスクリプションをキャンセルする
exports.cancelSubscription = onCall(async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { subId } = request.data;
    return await internalCancelSubscription(uid, subId);
});

// 定期的にサブスクリプションの決済を行うスケジュール関数
// 毎時間実行し、nextBillingDate が過ぎている active なサブスクリプションを処理する。
exports.processSubscriptions = onSchedule({ schedule: "every 1 hours" }, async (event) => {
    const nowTimestamp = admin.firestore.Timestamp.now();
    
    const subsQuery = db.collectionGroup('subscriptions')
        .where('status', '==', 'active')
        .where('nextBillingDate', '<=', nowTimestamp)
        .limit(100);

    try {
        const querySnapshot = await subsQuery.get();
        if (querySnapshot.empty) {
            console.log("No subscriptions to process.");
            return;
        }

        console.log(`Processing ${querySnapshot.size} subscriptions...`);

        for (const doc of querySnapshot.docs) {
            const subData = doc.data();
            const subRef = doc.ref;
            const userRef = subRef.parent.parent;
            if (!userRef) continue;
            
            const uid = userRef.id;
            const amount = subData.amount;
            const serviceId = subData.serviceId;
            const description = subData.description || `[${serviceId.toUpperCase()}] 定期課金`;

            try {
                await db.runTransaction(async (t) => {
                    const userSnap = await t.get(userRef);
                    if (!userSnap.exists) {
                        t.update(subRef, { status: 'failed', failureReason: 'user-not-found', updatedAt: FieldValue.serverTimestamp() });
                        return;
                    }
                    const subSnap = await t.get(subRef);
                    if (!subSnap.exists || subSnap.data().status !== 'active') {
                        return;
                    }

                    const currentBalance = userSnap.data().balance || 0;
                    if (currentBalance < amount) {
                        t.update(subRef, {
                            status: 'insufficient_funds',
                            failureCount: FieldValue.increment(1),
                            lastFailedAt: FieldValue.serverTimestamp(),
                            updatedAt: FieldValue.serverTimestamp()
                        });
                        return;
                    }

                    const nextBillingDate = subData.nextBillingDate.toDate();
                    const interval = subData.interval;
                    if (interval === 'month') {
                        nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                    } else if (interval === 'day') {
                        nextBillingDate.setDate(nextBillingDate.getDate() + 1);
                    } else if (interval === 'year') {
                        nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                    } else {
                        nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                    }
                    
                    // いつでも未来の日付になるように計算
                    const now = new Date();
                    while(nextBillingDate <= now) {
                        if (interval === 'month') nextBillingDate.setMonth(nextBillingDate.getMonth() + 1);
                        else if (interval === 'day') nextBillingDate.setDate(nextBillingDate.getDate() + 1);
                        else if (interval === 'year') nextBillingDate.setFullYear(nextBillingDate.getFullYear() + 1);
                        else nextBillingDate.setDate(nextBillingDate.getDate() + 30);
                    }

                    const receiptId = `rect_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                    const receiptRef = userRef.collection('receipts').doc(receiptId);
                    const transactionId = `${serviceId}_${Date.now()}`;
                    const transRef = userRef.collection('transactions').doc(transactionId);
                    
                    t.update(userRef, {
                        balance: FieldValue.increment(-amount),
                        updatedAt: FieldValue.serverTimestamp()
                    });

                    t.set(transRef, {
                        amount: -amount,
                        balanceAfter: currentBalance - amount,
                        type: 'payment',
                        label: description,
                        createdAt: FieldValue.serverTimestamp(),
                        serviceId,
                        receiptId,
                        subscriptionId: doc.id
                    });

                    t.set(receiptRef, {
                        amount,
                        serviceId,
                        description,
                        used: false,
                        createdAt: FieldValue.serverTimestamp(),
                        subscriptionId: doc.id
                    });

                    t.update(subRef, {
                        lastBillingDate: FieldValue.serverTimestamp(),
                        nextBillingDate: admin.firestore.Timestamp.fromDate(nextBillingDate),
                        failureCount: 0,
                        updatedAt: FieldValue.serverTimestamp()
                    });
                });
            } catch (err) {
                console.error(`Failed to process subscription ${doc.id} for user ${uid}:`, err);
            }
        }
    } catch (err) {
        console.error("Error in processSubscriptions:", err);
    }
});
async function internalResumeSubscription(uid, subId) {
    if (!subId) {
        throw new HttpsError('invalid-argument', 'サブスクリプションIDが指定されていません。');
    }

    const subRef = db.collection('users').doc(uid).collection('subscriptions').doc(subId);
    
    try {
        await db.runTransaction(async (t) => {
            const subSnap = await t.get(subRef);
            if (!subSnap.exists) {
                throw new HttpsError('not-found', 'サブスクリプションが見つかりません。');
            }
            if (subSnap.data().status !== 'cancelled') {
                throw new HttpsError('failed-precondition', 'サブスクリプションはキャンセルされていません。');
            }

            t.update(subRef, {
                status: 'active',
                cancelledAt: FieldValue.delete(),
                updatedAt: FieldValue.serverTimestamp()
            });
        });

        return { success: true };
    } catch (e) {
        if (e instanceof HttpsError) throw e;
        console.error("Resume Subscription Error:", e);
        throw new HttpsError('internal', '再開処理に失敗しました。');
    }
}

Object.assign(exports, {
    internalCreateSubscription,
    internalCancelSubscription,
    internalResumeSubscription
});
