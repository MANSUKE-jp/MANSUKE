// functions/cards.js — スタッフ専用カード管理Cloud Functions

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const getPrepaidDb = () => getFirestore('prepaid-card');
const getUsersDb = () => getFirestore('users');

async function requireStaff(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const uid = request.auth.uid;
    const userDoc = await getUsersDb().collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data().isStaff) {
        throw new HttpsError('permission-denied', 'スタッフ権限が必要です');
    }
    return uid;
}

// ── staffSearchCards ─────────────────────────────────────────────────
// Search cards by partial publicCode or pinCode match
exports.staffSearchCards = onCall(async (request) => {
    await requireStaff(request);
    const { query } = request.data;
    if (!query || typeof query !== 'string' || query.trim().length < 2) {
        throw new HttpsError('invalid-argument', '2文字以上の検索クエリが必要です');
    }

    const q = query.trim().toUpperCase();

    try {
        // Firestoreはネイティブの部分一致検索をサポートしないため、範囲クエリで取得する
        // publicCodeの範囲検索
        const publicSnap = await getPrepaidDb().collection('cards')
            .where('publicCode', '>=', q)
            .where('publicCode', '<=', q + '\uf8ff')
            .limit(50)
            .get();

        // pinCodeの範囲検索
        const pinSnap = await getPrepaidDb().collection('cards')
            .where('pinCode', '>=', q)
            .where('pinCode', '<=', q + '\uf8ff')
            .limit(50)
            .get();

        // 結果をマージし、doc IDで重複除去する
        const seen = new Set();
        const cards = [];

        const addDoc = (doc) => {
            if (seen.has(doc.id)) return;
            seen.add(doc.id);
            const data = doc.data();
            cards.push({
                id: doc.id,
                publicCode: data.publicCode || '',
                pinCode: data.pinCode || '',
                status: data.status || 'inactive',
                amount: data.amount || 0,
                userPin: data.userPin || null,
                createdAt: data.createdAt || null,
                activatedAt: data.activatedAt || null,
                redeemedAt: data.redeemedAt || null,
                redeemedBy: data.redeemedBy || null,
            });
        };

        publicSnap.docs.forEach(addDoc);
        pinSnap.docs.forEach(addDoc);

        // publicCodeでソート
        cards.sort((a, b) => a.publicCode.localeCompare(b.publicCode));

        return { cards: cards.slice(0, 100) };
    } catch (err) {
        logger.error('staffSearchCards error', err);
        throw new HttpsError('internal', '検索に失敗しました: ' + err.message);
    }
});

// ── staffGetCardDetail ────────────────────────────────────────────────
exports.staffGetCardDetail = onCall(async (request) => {
    await requireStaff(request);
    const { cardId } = request.data;
    if (!cardId) throw new HttpsError('invalid-argument', 'カードIDが必要です');

    try {
        const cardDoc = await getPrepaidDb().collection('cards').doc(cardId).get();
        if (!cardDoc.exists) throw new HttpsError('not-found', 'カードが見つかりません');

        const data = cardDoc.data();
        const result = { id: cardDoc.id, ...data };

        // 引き換え済みの場合、連絡ユーザー情報を取得する
        if (data.redeemedBy) {
            const userDoc = await getUsersDb().collection('users').doc(data.redeemedBy).get();
            if (userDoc.exists) {
                const u = userDoc.data();
                result.linkedUser = {
                    uid: u.uid,
                    lastName: u.lastName,
                    firstName: u.firstName,
                    email: u.email,
                    nickname: u.nickname,
                };
            }
        }

        return result;
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffGetCardDetail error', err);
        throw new HttpsError('internal', 'カード詳細の取得に失敗しました');
    }
});

// ── staffUpdateCardBalance ───────────────────────────────────────────
exports.staffUpdateCardBalance = onCall(async (request) => {
    const staffUid = await requireStaff(request);
    const { cardId, amount } = request.data;
    if (!cardId) throw new HttpsError('invalid-argument', 'カードIDが必要です');
    if (typeof amount !== 'number' || amount < 0) throw new HttpsError('invalid-argument', '有効な金額を入力してください');

    try {
        const cardRef = getPrepaidDb().collection('cards').doc(cardId);
        const cardDoc = await cardRef.get();
        if (!cardDoc.exists) throw new HttpsError('not-found', 'カードが見つかりません');

        const data = cardDoc.data();
        if (data.status !== 'active') throw new HttpsError('failed-precondition', 'アクティベート済みカードのみ残高変更できます');

        await cardRef.update({
            amount: amount,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            lastModifiedBy: staffUid,
        });

        logger.info('Card balance updated', { cardId, amount, staffUid });
        return { success: true };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffUpdateCardBalance error', err);
        throw new HttpsError('internal', '残高の更新に失敗しました');
    }
});

// ── staffToggleCardStatus ───────────────────────────────────────────
exports.staffToggleCardStatus = onCall(async (request) => {
    const staffUid = await requireStaff(request);
    const { cardId } = request.data;
    if (!cardId) throw new HttpsError('invalid-argument', 'カードIDが必要です');

    try {
        const cardRef = getPrepaidDb().collection('cards').doc(cardId);
        const cardDoc = await cardRef.get();
        if (!cardDoc.exists) throw new HttpsError('not-found', 'カードが見つかりません');

        const data = cardDoc.data();
        let newStatus;
        let updateData = {};

        if (data.status === 'disabled') {
            newStatus = data.previousStatus || 'inactive';
            updateData = {
                status: newStatus,
                reactivatedAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: staffUid,
            };
        } else if (data.status === 'inactive' || data.status === 'active') {
            newStatus = 'disabled';
            updateData = {
                status: newStatus,
                previousStatus: data.status,
                disabledAt: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastModifiedBy: staffUid,
            };
        } else {
            throw new HttpsError('failed-precondition', 'このカードのステータスは変更できません');
        }

        await cardRef.update(updateData);

        logger.info('Card status toggled', { cardId, oldStatus: data.status, newStatus, staffUid });
        return { success: true, newStatus };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffToggleCardStatus error', err);
        throw new HttpsError('internal', 'ステータスの変更に失敗しました');
    }
});

// ── staffVerifyPrepaidCardCode ──────────────────────────────────────
exports.staffVerifyPrepaidCardCode = onCall(async (request) => {
    await requireStaff(request);
    const { code } = request.data;
    if (!code || typeof code !== 'string') {
        throw new HttpsError('invalid-argument', '有効なコードが必要です');
    }

    try {
        const snapshot = await getPrepaidDb().collection('cards')
            .where('publicCode', '==', code)
            .limit(1)
            .get();
            
        if (snapshot.empty) {
            throw new HttpsError('not-found', '無効なコードです。システムに登録されていません。');
        }

        const doc = snapshot.docs[0];
        const data = doc.data();

        if (data.status !== 'inactive') {
            throw new HttpsError('failed-precondition', `このカードは既に使用されています。(ステータス: ${data.status})`);
        }

        return { id: doc.id, ...data };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffVerifyPrepaidCardCode error', err);
        throw new HttpsError('internal', 'データベースへの接続が拒否されました。再度お試しください。');
    }
});

// ── activatePrepaidCard ───────────────────────────────────────────
exports.activatePrepaidCard = onCall(async (request) => {
    const staffUid = await requireStaff(request);
    const { docId, amount, userPin, customerSignature, employeeSignature } = request.data;

    if (!docId) throw new HttpsError('invalid-argument', 'ドキュメントIDが必要です');
    if (!amount || amount < 300) throw new HttpsError('invalid-argument', '有効な金額を入力してください(300円以上)');
    if (!userPin || userPin.length !== 4) throw new HttpsError('invalid-argument', '暗証番号は4桁で指定してください');

    try {
        const cardRef = getPrepaidDb().collection('cards').doc(docId);
        const cardDoc = await cardRef.get();
        if (!cardDoc.exists) throw new HttpsError('not-found', 'カードが見つかりません');

        const data = cardDoc.data();
        if (data.status !== 'inactive') {
            throw new HttpsError('failed-precondition', '未有効化のカードである必要があります');
        }

        await cardRef.update({
            status: 'active',
            amount: amount,
            userPin: userPin,
            customerSignature: customerSignature || null,
            employeeSignature: employeeSignature || null,
            activatedAt: admin.firestore.FieldValue.serverTimestamp(),
            activatedBy: staffUid,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        logger.info('Card activated', { docId, amount, staffUid });
        return { success: true };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('activatePrepaidCard error', err);
        throw new HttpsError('internal', '有効化に失敗しました');
    }
});

// ── importCards ──────────────────────────────────────────────────
exports.importCards = onCall(async (request) => {
    await requireStaff(request);
    const { cards } = request.data;
    if (!Array.isArray(cards)) throw new HttpsError('invalid-argument', '配列が必要です');

    try {
        let successCount = 0;
        let skippedCount = 0;

        // バッチ処理（Firestoreの上限500件対応）
        const chunks = [];
        for (let i = 0; i < cards.length; i += 400) {
            chunks.push(cards.slice(i, i + 400));
        }

        for (const chunk of chunks) {
            const batch = getPrepaidDb().batch();
            for (const item of chunk) {
                if (!item.publicCode || !item.pinCode) {
                    skippedCount++;
                    continue;
                }
                const cardRef = getPrepaidDb().collection('cards').doc();
                batch.set(cardRef, {
                    publicCode: item.publicCode,
                    pinCode: item.pinCode,
                    status: 'inactive',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                });
                successCount++;
            }
            await batch.commit();
        }

        return { successCount, skippedCount };
    } catch (err) {
        logger.error('importCards error', err);
        throw new HttpsError('internal', 'インポートに失敗しました');
    }
});
