const admin = require("firebase-admin");
const { getFirestore } = require("firebase-admin/firestore");

/**
 * 外部データベース（users）に対わるサイドエフェクトを実行する。
 * トランザクション外で実行することでクロスDB制約を回避する。
 */
exports.executeEffects = async (effects) => {
    if (!effects || effects.length === 0) return;

    const usersDb = getFirestore("users");

    for (const effect of effects) {
        if (effect.type === 'charge') {
            try {
                const userRef = usersDb.collection('users').doc(effect.uid);

                await usersDb.runTransaction(async (t) => {
                    const userSnap = await t.get(userRef);
                    if (!userSnap.exists) {
                        return; // ユーザーが存在しない
                    }

                    if (effect.idempotencyKey) {
                        const effectRef = userRef.collection('transactions').doc(effect.idempotencyKey);
                        const effectSnap = await t.get(effectRef);
                        if (effectSnap.exists) {
                            console.log(`[Effect] Charge already applied. Skipping to prevent double charge: ${effect.idempotencyKey}`);
                            return; // 既に課金済みなのでスキップ
                        }

                        t.update(userRef, {
                            balance: admin.firestore.FieldValue.increment(effect.amount)
                        });

                        t.set(effectRef, {
                            amount: effect.amount,
                            label: effect.message,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            type: "payment"
                        });
                    } else {
                        // Idempotency keyがない従来の挙動 (下位互換性のため)
                        t.update(userRef, {
                            balance: admin.firestore.FieldValue.increment(effect.amount)
                        });

                        const transRef = userRef.collection('transactions').doc();
                        t.set(transRef, {
                            amount: effect.amount,
                            label: effect.message,
                            createdAt: admin.firestore.FieldValue.serverTimestamp(),
                            type: "payment"
                        });
                    }
                });

                console.log(`[Effect] Processed charge: ${effect.amount} to user ${effect.uid}: ${effect.message}`);
            } catch (e) {
                console.error(`[Effect Error] Failed to charge user ${effect.uid}:`, e);
            }
        } else if (effect.type === 'consumeReceipt') { // 新しいレシート消費システム
            try {
                const userRef = usersDb.collection('users').doc(effect.uid);
                const receiptRef = userRef.collection('receipts').doc(effect.receiptId);

                await usersDb.runTransaction(async (t) => {
                    const snap = await t.get(receiptRef);
                    if (!snap.exists) return;
                    // Simply mark it as used. Balance is already deducted during pre-auth.
                    if (!snap.data().used) {
                        t.update(receiptRef, { used: true, usedAt: admin.firestore.FieldValue.serverTimestamp() });
                    }
                });
                console.log(`[Effect] Receipt consumed: ${effect.receiptId} for user ${effect.uid}`);
            } catch (e) {
                console.error(`[Effect Error] Failed to consume receipt ${effect.receiptId} user ${effect.uid}:`, e);
            }
        } else if (effect.type === 'refundReceipt') { // 新しいレシート返金システム
            try {
                const userRef = usersDb.collection('users').doc(effect.uid);
                const receiptRef = userRef.collection('receipts').doc(effect.receiptId);
                const transactionId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                const transRef = userRef.collection('transactions').doc(transactionId);

                await usersDb.runTransaction(async (t) => {
                    const snap = await t.get(receiptRef);
                    if (!snap.exists) return; // レシートが存在しない
                    const receipt = snap.data();

                    if (receipt.used || receipt.refunded) {
                        return; // すでに使用済み、または返金済みの場合は何もしない
                    }

                    // 残高を戻す
                    t.update(userRef, {
                        balance: admin.firestore.FieldValue.increment(receipt.amount),
                        updatedAt: admin.firestore.FieldValue.serverTimestamp()
                    });

                    // 取引履歴に返金レコードを作成
                    t.set(transRef, {
                        amount: receipt.amount,
                        type: 'refund',
                        label: `[${receipt.serviceId.toUpperCase()}] キャンセル・返金`,
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),
                        serviceId: receipt.serviceId,
                        originalReceiptId: effect.receiptId
                    });

                    // レシートを返金済みとしてマーク
                    t.update(receiptRef, {
                        refunded: true,
                        refundedAt: admin.firestore.FieldValue.serverTimestamp()
                    });
                });
                console.log(`[Effect] Refund issued for receipt: ${effect.receiptId} for user ${effect.uid}`);
            } catch (e) {
                console.error(`[Effect Error] Failed to refund receipt ${effect.receiptId} user ${effect.uid}:`, e);
            }
        }
    }
};
