/**
 * functions/users.js — Staff-only user management Cloud Functions
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const getUsersDb = () => getFirestore('users');
const getOrdersDb = () => getFirestore('orders');
const { createUniqueTransactionId } = require('../../payment.js');

async function requireStaff(request) {
    if (!request.auth) throw new HttpsError('unauthenticated', '認証が必要です');
    const uid = request.auth.uid;
    const userDoc = await getUsersDb().collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data().isStaff) {
        throw new HttpsError('permission-denied', 'スタッフ権限が必要です');
    }
    return uid;
}

// ── staffSearchUsers ─────────────────────────────────────────────────
// Fetch all users and filter client-side for partial match on name/email/phone/uid
// Note: Firestore doesn't natively support partial text search.
// For production at scale, consider Algolia/Typesense or denormalized indexes.
exports.staffSearchUsers = onCall(async (request) => {
    await requireStaff(request);
    const { query } = request.data;
    if (!query || typeof query !== 'string' || query.trim().length < 1) {
        throw new HttpsError('invalid-argument', '1文字以上の検索クエリが必要です');
    }

    const q = query.trim().toLowerCase();

    try {
        // Attempt targeted searches first
        const results = new Map();

        // Search by email prefix
        const emailSnap = await getUsersDb().collection('users')
            .where('email', '>=', q)
            .where('email', '<=', q + '\uf8ff')
            .limit(20)
            .get();
        emailSnap.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

        // Search by phone prefix
        const phoneSnap = await getUsersDb().collection('users')
            .where('phone', '>=', q)
            .where('phone', '<=', q + '\uf8ff')
            .limit(20)
            .get();
        phoneSnap.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

        // Search by UID prefix
        const uidSnap = await getUsersDb().collection('users')
            .where('uid', '>=', q)
            .where('uid', '<=', q + '\uf8ff')
            .limit(20)
            .get();
        uidSnap.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

        // Search by lastName prefix
        const lnSnap = await getUsersDb().collection('users')
            .where('lastName', '>=', q)
            .where('lastName', '<=', q + '\uf8ff')
            .limit(20)
            .get();
        lnSnap.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

        // Search by firstName prefix
        const fnSnap = await getUsersDb().collection('users')
            .where('firstName', '>=', q)
            .where('firstName', '<=', q + '\uf8ff')
            .limit(20)
            .get();
        fnSnap.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

        // Search by nickname prefix
        const nnSnap = await getUsersDb().collection('users')
            .where('nickname', '>=', q)
            .where('nickname', '<=', q + '\uf8ff')
            .limit(20)
            .get();
        nnSnap.docs.forEach(d => results.set(d.id, { uid: d.id, ...d.data() }));

        // Sanitize output (remove sensitive fields like password)
        const users = Array.from(results.values()).map(u => ({
            uid: u.uid,
            lastName: u.lastName || '',
            firstName: u.firstName || '',
            email: u.email || '',
            phone: u.phone || '',
            nickname: u.nickname || '',
            balance: u.balance || 0,
            kycStatus: u.kycStatus || null,
            isStaff: u.isStaff || false,
            googleLinked: u.googleLinked || false,
            createdAt: u.createdAt || null,
        }));

        return { users: users.slice(0, 50) };
    } catch (err) {
        logger.error('staffSearchUsers error', err);
        throw new HttpsError('internal', 'ユーザー検索に失敗しました: ' + err.message);
    }
});

// ── staffGetUserDetail ──────────────────────────────────────────────
exports.staffGetUserDetail = onCall(async (request) => {
    await requireStaff(request);
    const { uid } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'UIDが必要です');

    try {
        const userDoc = await getUsersDb().collection('users').doc(uid).get();
        if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

        const data = userDoc.data();

        // Fetch transactions
        const txSnap = await getUsersDb().collection('users').doc(uid)
            .collection('transactions')
            .orderBy('createdAt', 'desc')
            .limit(100)
            .get();
        const transactions = txSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        // Fetch orders from orders database
        let orders = [];
        try {
            const orderSnap = await getOrdersDb().collection('orders')
                .where('userId', '==', uid)
                .orderBy('createdAt', 'desc')
                .limit(50)
                .get();
            orders = orderSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
            logger.warn('Failed to fetch orders (may not have index)', err.message);
        }

        // Fetch VPN devices
        let vpnDevices = [];
        try {
            const vpnSnap = await getUsersDb().collection('users').doc(uid)
                .collection('vpn')
                .orderBy('createdAt', 'desc')
                .get();
            vpnDevices = vpnSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        } catch (err) {
            logger.warn('Failed to fetch VPN devices', err.message);
        }

        // Remove sensitive fields (but keep password so staff can view/edit it)
        const { passkeys, ...safeData } = data;

        return {
            ...safeData,
            uid,
            transactions,
            orders,
            vpnDevices,
        };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffGetUserDetail error', err);
        throw new HttpsError('internal', 'ユーザー詳細の取得に失敗しました');
    }
});

// ── staffAdjustBalance ──────────────────────────────────────────────
exports.staffAdjustBalance = onCall(async (request) => {
    const staffUid = await requireStaff(request);
    const { uid, amount, memo } = request.data;

    if (!uid) throw new HttpsError('invalid-argument', 'UIDが必要です');
    if (typeof amount !== 'number' || amount === 0) throw new HttpsError('invalid-argument', '有効な金額を入力してください');

    try {
        const userRef = getUsersDb().collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

        const currentBalance = userDoc.data().balance || 0;
        if (currentBalance + amount < 0) throw new HttpsError('failed-precondition', '残高が不足しています');

        // Update balance
        await userRef.update({
            balance: admin.firestore.FieldValue.increment(amount),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // Create global transaction ID order
        const { transactionId: generatedTransactionId } = await createUniqueTransactionId(getOrdersDb(), {
            userId: uid,
            amount: amount,
            type: 'staff_adjustment',
            description: memo || 'MANSUKEサポートによる残高調整'
        });

        // Record transaction
        const txId = `staff_adj_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        await userRef.collection('transactions').doc(txId).set({
            id: txId,
            type: 'staff_adjustment',
            label: memo || 'MANSUKEサポートによる残高調整',
            amount: amount,
            balanceAfter: currentBalance + amount,
            adjustedBy: staffUid,
            transactionId: generatedTransactionId,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        // mark order as completed
        await getOrdersDb().collection('orders').doc(generatedTransactionId).update({
            status: 'completed',
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        logger.info('Balance adjusted by staff', { uid, amount, staffUid, memo, transactionId: generatedTransactionId });
        return { success: true, newBalance: currentBalance + amount, transactionId: generatedTransactionId };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffAdjustBalance error', err);
        throw new HttpsError('internal', '残高の調整に失敗しました');
    }
});

// ── staffUpdateUserProfile ──────────────────────────────────────────
exports.staffUpdateUserProfile = onCall(async (request) => {
    const staffUid = await requireStaff(request);
    const { uid, field, value } = request.data;

    if (!uid || !field) throw new HttpsError('invalid-argument', 'UIDとフィールド名が必要です');

    const allowedFields = ['lastName', 'firstName', 'furiganaLast', 'furiganaFirst', 'email', 'phone', 'nickname', 'birthday', 'password', 'kycStatus', 'avatarUrl'];
    if (!allowedFields.includes(field)) throw new HttpsError('invalid-argument', 'このフィールドは編集できません');

    try {
        const userRef = getUsersDb().collection('users').doc(uid);
        const userDoc = await userRef.get();
        if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

        // Handle Auth-related updates
        if (field === 'email') {
            if (!value || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
                throw new HttpsError('invalid-argument', '有効なメールアドレスを入力してください');
            }
            await admin.auth().updateUser(uid, { email: value });
            await userRef.update({ email: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else if (field === 'phone') {
            let e164 = (value || '').replace(/[\s\-().]/g, '');
            if (e164.startsWith('0')) e164 = '+81' + e164.slice(1);
            let cleanPhone = (value || '').replace(/[\s\-().]/g, '');
            if (cleanPhone.startsWith('+81')) cleanPhone = '0' + cleanPhone.slice(3);
            try { await admin.auth().updateUser(uid, { phoneNumber: e164 }); } catch (e) {
                logger.warn('Failed to update phone in Auth', e.message);
            }
            await userRef.update({ phone: cleanPhone, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else if (field === 'password') {
            if (!value || value.length < 8) {
                throw new HttpsError('invalid-argument', 'パスワードは8文字以上です');
            }
            await admin.auth().updateUser(uid, { password: value });
            await admin.auth().revokeRefreshTokens(uid);
            await userRef.update({ password: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else if (field === 'nickname') {
            if (!value || value.trim().length === 0 || value.trim().length > 10) {
                throw new HttpsError('invalid-argument', 'ニックネームは1〜10文字で入力してください');
            }
            await userRef.update({ nickname: value.trim(), updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        } else if (field === 'kycStatus') {
            const validStatus = ['pending', 'approved', 'rejected', 'mismatch', ''];
            if (!validStatus.includes(value)) throw new HttpsError('invalid-argument', '無効なKYCステータスです');
            await userRef.update({ kycStatus: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            
            const userRecord = await admin.auth().getUser(uid);
            const currentClaims = userRecord.customClaims || {};
            if (value === 'approved') {
                currentClaims.kycApproved = true;
            } else {
                delete currentClaims.kycApproved;
            }
            await admin.auth().setCustomUserClaims(uid, currentClaims);
        } else if (field === 'avatarUrl') {
            await userRef.update({ 
                avatarUrl: value, 
                avatarHistory: admin.firestore.FieldValue.arrayUnion(value),
                updatedAt: admin.firestore.FieldValue.serverTimestamp() 
            });
        } else {
            // lastName, firstName, furiganaLast, furiganaFirst, birthday
            await userRef.update({ [field]: value, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
            // Update displayName if name changed
            if (field === 'lastName' || field === 'firstName') {
                const freshData = (await userRef.get()).data();
                const displayName = `${freshData.lastName || ''} ${freshData.firstName || ''}`.trim();
                await admin.auth().updateUser(uid, { displayName });
                await userRef.update({ displayName });
            }
        }

        logger.info('Profile updated by staff', { uid, field, staffUid });
        return { success: true };
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffUpdateUserProfile error', err);
        throw new HttpsError('internal', 'プロフィールの更新に失敗しました: ' + err.message);
    }
});

// ── staffDeleteAvatarUrl ──────────────────────────────────────────────
exports.staffDeleteAvatarUrl = onCall(async (request) => {
    await requireStaff(request);
    const { uid } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'UIDが必要です');

    const userDoc = await getUsersDb().collection('users').doc(uid).get();
    if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

    const avatarUrl = userDoc.data().avatarUrl;
    if (avatarUrl) {
        try {
            if (avatarUrl.includes('firebasestorage.googleapis.com') && avatarUrl.includes('/o/avatars%2F')) {
                const match = avatarUrl.match(/\/o\/(avatars%2F[^?]+)/);
                if (match && match[1]) {
                    const filePath = decodeURIComponent(match[1]);
                    const bucket = admin.storage().bucket('mansuke-app.firebasestorage.app');
                    const file = bucket.file(filePath);
                    const [exists] = await file.exists();
                    if (exists) {
                        await file.delete();
                    }
                }
            }
        } catch (e) {
            logger.error("Failed to delete avatar from storage:", e);
        }
    }

    await getUsersDb().collection('users').doc(uid).update({
        avatarUrl: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── staffDeleteVpnDevice ──────────────────────────────────────────────
exports.staffDeleteVpnDevice = onCall(async (request) => {
    await requireStaff(request);
    const { uid, deviceId, immediate } = request.data;
    if (!uid || !deviceId) throw new HttpsError('invalid-argument', 'UIDとデバイスIDが必要です');

    try {
        const userRef = getUsersDb().collection('users').doc(uid);
        const vpnRef = userRef.collection('vpn').doc(deviceId);
        const vpnDoc = await vpnRef.get();
        if (!vpnDoc.exists) throw new HttpsError('not-found', 'VPNデバイスが見つかりません');

        const vpnData = vpnDoc.data();

        // Step 1: Cancel subscription (always attempt to cancel the subscription)
        if (vpnData.subscriptionId) {
            const { internalCancelSubscription } = require('../../payment.js');
            try {
                await internalCancelSubscription(uid, vpnData.subscriptionId);
            } catch (cancelError) {
                logger.warn("Subscription cancellation warning (staff):", cancelError.message);
            }
        }

        if (immediate) {
            // Immediate deletion: remove from wg-easy and delete firestore document
            const axios = require('axios');
            const WG_HOST = 'vpn.mansuke.jp';
            const WG_PORT = '80';
            const WG_PASSWORD = 'mansuke_wg_api_pass_2026';
            const WG_API_URL = `http://${WG_HOST}:${WG_PORT}/api`;

            try {
                // Auth with wg-easy
                const response = await axios.post(`${WG_API_URL}/session`, { password: WG_PASSWORD }, { timeout: 8000 });
                const cookies = response.headers['set-cookie'];
                if (cookies && cookies.length > 0) {
                    const cookie = cookies[0].split(';')[0];
                    // Delete from wg-easy
                    await axios.delete(`${WG_API_URL}/wireguard/client/${vpnData.wgClientId}`, {
                        headers: { 'Cookie': cookie },
                        timeout: 8000
                    });
                }
            } catch (wgError) {
                logger.error("Failed to delete client from wg-easy (staff):", wgError.message);
                // We'll throw an error if this was requested to be immediate, 
                // because we can't guarantee connection drop without deleting it from wg-easy.
                throw new HttpsError('internal', 'VPNサーバーからのデバイス削除に失敗しました (wg-easy APIエラー)');
            }

            // After successful wg-easy deletion, delete the Firestore doc entirely
            await vpnRef.delete();
            return { success: true, message: "デバイスを即時解約し、完全に削除しました。" };
            
        } else {
            // Period-end cancellation: just mark as canceled
            await vpnRef.update({
                status: 'canceled',
                canceledAt: admin.firestore.FieldValue.serverTimestamp()
            });
            return { success: true, message: "解約を受け付けました。現在の契約期間満了後にVPNが停止されます。" };
        }
    } catch (err) {
        if (err instanceof HttpsError) throw err;
        logger.error('staffDeleteVpnDevice error', err);
        throw new HttpsError('internal', 'VPNデバイスの削除に失敗しました: ' + err.message);
    }
});