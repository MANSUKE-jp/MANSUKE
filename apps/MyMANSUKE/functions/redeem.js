/**
 * functions/redeem.js
 * Handles MANSUKE PREPAID CARD redemption.
 * - Looks up card in "prepaid-card" database > "cards" collection by pinCode
 * - Verifies userPin and status === 'active'
 * - Adds amount to user balance in "users" database
 * - Records a transaction entry
 * - Marks card as 'redeemed'
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const usersDb = getFirestore('users');
const prepaidDb = getFirestore('prepaid-card');

function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }
}

exports.redeemCard = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;
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
        logger.error('prepaid-card DB query error', err);
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

    const amount = Number(card.amount);
    if (!amount || amount <= 0) {
        throw new HttpsError('internal', 'カードの金額が無効です');
    }

    // Perform atomic update in users DB
    const userRef = usersDb.collection('users').doc(uid);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
        throw new HttpsError('not-found', 'ユーザーが見つかりません');
    }

    const now = new Date();
    const transactionId = `prepaid_${cardDoc.id}_${Date.now()}`;

    // Update user balance and record transaction
    await userRef.update({
        balance: FieldValue.increment(amount),
        updatedAt: FieldValue.serverTimestamp(),
    });

    // Record transaction in users/{uid}/transactions subcollection
    await userRef.collection('transactions').doc(transactionId).set({
        id: transactionId,
        type: 'prepaid_card',
        label: 'プリペイドカードによる残高追加',
        amount: amount,
        cardId: cardDoc.id,
        createdAt: FieldValue.serverTimestamp(),
    });

    // Mark card as redeemed
    await cardDoc.ref.update({
        status: 'redeemed',
        redeemedBy: uid,
        redeemedAt: FieldValue.serverTimestamp(),
    });

    logger.info('Prepaid card redeemed', { uid, cardId: cardDoc.id, amount });

    return { success: true, amount };
});
