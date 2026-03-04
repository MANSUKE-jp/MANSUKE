/**
 * functions/profile.js
 * firebase-functions v2: callable signature is (request) => {}
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const getDb = () => getFirestore('users');

function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }
}

// ── updateEmail ───────────────────────────────────────────────────────

exports.updateEmail = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;
    const { email } = request.data;

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new HttpsError('invalid-argument', '有効なメールアドレスを入力してください');
    }

    const userDoc = await getDb().collection('users').doc(uid).get();
    if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

    const kycStatus = userDoc.data().kycStatus;
    if (kycStatus !== 'mismatch' && kycStatus !== 'rejected') {
        throw new HttpsError('permission-denied', 'メールアドレスを変更できません');
    }

    try {
        const existing = await admin.auth().getUserByEmail(email);
        if (existing.uid !== uid) {
            throw new HttpsError('already-exists', 'このメールアドレスはすでに使用されています');
        }
    } catch (err) {
        if (err.code !== 'auth/user-not-found') throw err;
    }

    await admin.auth().updateUser(uid, { email });
    await getDb().collection('users').doc(uid).update({
        email,
        kycStatus: 'pending',
        kycMismatch: false,
        kycReason: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── updatePhone ───────────────────────────────────────────────────────

exports.updatePhone = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;
    const { phone } = request.data;

    if (!phone) throw new HttpsError('invalid-argument', '電話番号が必要です');

    let cleanPhone = phone.replace(/[\s\-().]/g, '');
    if (cleanPhone.startsWith('+81')) {
        cleanPhone = '0' + cleanPhone.slice(3);
    }

    let e164Phone = cleanPhone;
    if (cleanPhone.startsWith('0')) {
        e164Phone = '+81' + cleanPhone.slice(1);
    }

    const userDoc = await getDb().collection('users').doc(uid).get();
    if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

    const kycStatus = userDoc.data().kycStatus;
    if (kycStatus !== 'mismatch' && kycStatus !== 'rejected') {
        throw new HttpsError('permission-denied', '電話番号を変更できません');
    }

    const existing = await getDb().collection('users')
        .where('phone', '==', cleanPhone).limit(1).get();
    if (!existing.empty && existing.docs[0].id !== uid) {
        throw new HttpsError('already-exists', 'この電話番号はすでに使用されています');
    }

    try {
        await admin.auth().updateUser(uid, { phoneNumber: e164Phone });
    } catch (err) {
        throw new HttpsError('internal', '電話番号の更新に失敗しました: ' + err.message);
    }

    await getDb().collection('users').doc(uid).update({
        phone: cleanPhone,
        kycStatus: 'pending',
        kycMismatch: false,
        kycReason: null,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── updateNickname

exports.updateNickname = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;
    const { nickname } = request.data;

    if (!nickname || nickname.trim().length === 0) {
        throw new HttpsError('invalid-argument', 'ニックネームを入力してください');
    }
    if (nickname.trim().length > 10) {
        throw new HttpsError('invalid-argument', 'ニックネームは10文字以内で入力してください');
    }

    await getDb().collection('users').doc(uid).update({
        nickname: nickname.trim(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── updateAvatarUrl

exports.updateAvatarUrl = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;
    const { avatarUrl } = request.data;

    if (!avatarUrl || typeof avatarUrl !== 'string') {
        throw new HttpsError('invalid-argument', '無効な画像URLです');
    }

    await getDb().collection('users').doc(uid).update({
        avatarUrl,
        avatarHistory: admin.firestore.FieldValue.arrayUnion(avatarUrl),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── deleteAvatarUrl

exports.deleteAvatarUrl = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    const userDoc = await getDb().collection('users').doc(uid).get();
    if (!userDoc.exists) throw new HttpsError('not-found', 'ユーザーが見つかりません');

    const avatarUrl = userDoc.data().avatarUrl;
    if (avatarUrl) {
        // Firebase StorageのURLの特徴（.../o/avatars%2F...）が含まれているかチェックし、可能ならファイルも削除する
        try {
            if (avatarUrl.includes('firebasestorage.googleapis.com') && avatarUrl.includes('/o/avatars%2F')) {
                // Extracts essentially everything after "/o/" and before "?alt=media"
                // e.g. https://firebasestorage.googleapis.com/.../o/avatars%2Fuid_timestamp.jpeg?alt=...
                const match = avatarUrl.match(/\/o\/(avatars%2F[^?]+)/);
                if (match && match[1]) {
                    const filePath = decodeURIComponent(match[1]);
                    // Initialize Storage if necessary (already done via admin.initializeApp())
                    const bucket = admin.storage().bucket('mansuke-app.firebasestorage.app');
                    const file = bucket.file(filePath);
                    const [exists] = await file.exists();
                    if (exists) {
                        await file.delete();
                    }
                }
            }
        } catch (e) {
            console.error("Failed to delete avatar from storage:", e);
            // 続行してFirestoreドキュメントからはURLを消す
        }
    }

    await getDb().collection('users').doc(uid).update({
        avatarUrl: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});
