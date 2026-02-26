/**
 * functions/auth.js
 * firebase-functions v2: callable signature is (request) => {}
 * request.data  = payload from client
 * request.auth  = auth context (null if unauthenticated)
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore('users'); // Named database: "users"

function validatePassword(pw) {
    if (!pw || pw.length < 8 || pw.length > 32) return false;
    if (!/[a-z]/.test(pw)) return false;
    if (!/[0-9]/.test(pw)) return false;
    return true;
}

function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }
}

// ── checkEmailUnique ──────────────────────────────────────────────────

exports.checkEmailUnique = onCall(async (request) => {
    const { email } = request.data;
    if (!email) throw new HttpsError('invalid-argument', 'メールアドレスが必要です');

    try {
        await admin.auth().getUserByEmail(email);
        return { unique: false };
    } catch (err) {
        if (err.code === 'auth/user-not-found') return { unique: true };
        throw new HttpsError('internal', 'メールアドレスの確認に失敗しました');
    }
});

// ── checkPhoneUnique ──────────────────────────────────────────────────

exports.checkPhoneUnique = onCall(async (request) => {
    const { phone } = request.data;
    if (!phone) throw new HttpsError('invalid-argument', '電話番号が必要です');

    let normalized = phone.replace(/[\s\-().]/g, '');
    if (normalized.startsWith('0')) normalized = '+81' + normalized.slice(1);

    const snap = await db.collection('users')
        .where('phone', '==', normalized)
        .limit(1)
        .get();
    return { unique: snap.empty };
});

// ── createAccount ─────────────────────────────────────────────────────

exports.createAccount = onCall(async (request) => {
    const { lastName, firstName, birthday, email, phone, password, nickname, linkGoogle } = request.data;

    if (!validatePassword(password)) {
        throw new HttpsError(
            'invalid-argument',
            'パスワードは8文字以上32文字以下で、小文字と数字を含む必要があります'
        );
    }
    if (!nickname || nickname.trim().length > 10) {
        throw new HttpsError('invalid-argument', 'ニックネームは10文字以内で入力してください');
    }

    let normalizedPhone = phone?.replace(/[\s\-().]/g, '') || '';
    if (normalizedPhone.startsWith('0')) normalizedPhone = '+81' + normalizedPhone.slice(1);

    let userRecord;
    try {
        userRecord = await admin.auth().createUser({
            email,
            password,
            displayName: `${lastName} ${firstName}`.trim(),
            phoneNumber: normalizedPhone || undefined,
        });
    } catch (err) {
        if (err.code === 'auth/email-already-exists') {
            throw new HttpsError('already-exists', 'このメールアドレスはすでに使用されています');
        }
        if (err.code === 'auth/phone-number-already-exists') {
            throw new HttpsError('already-exists', 'この電話番号はすでに使用されています');
        }
        throw new HttpsError('internal', 'アカウントの作成に失敗しました: ' + err.message);
    }

    const { FieldValue } = require('firebase-admin/firestore');

    // Check if there was a passkey generated during registration phase
    // The tempToken used in UI was `email` if not logged in.
    let initialPasskeys = [];
    const tempTokenId = `pre_${Buffer.from(email || 'anon').toString('hex').slice(0, 20)}`;
    try {
        const tempPasskeyDoc = await db.collection('temp_passkeys').doc(tempTokenId).get();
        if (tempPasskeyDoc.exists) {
            initialPasskeys = tempPasskeyDoc.data().passkeys || [];
            await tempPasskeyDoc.ref.delete();
        }
    } catch (e) {
        console.warn('Failed to retrieve temp passkey', e);
    }

    await db.collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        lastName,
        firstName,
        displayName: `${lastName} ${firstName}`.trim(),
        birthday,
        email,
        phone: normalizedPhone,
        nickname: nickname.trim(),
        balance: 0,
        kycStatus: 'pending',
        kycReason: null,
        kycMismatch: false,
        googleLinked: linkGoogle || false,
        isStaff: false,
        passkeys: initialPasskeys,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
    });

    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    return { customToken, uid: userRecord.uid };
});

// ── changePassword ────────────────────────────────────────────────────

exports.changePassword = onCall(async (request) => {
    requireAuth(request);
    const { newPassword } = request.data;
    const uid = request.auth.uid;

    if (!validatePassword(newPassword)) {
        throw new HttpsError(
            'invalid-argument',
            'パスワードは8文字以上32文字以下で、小文字と数字を含む必要があります'
        );
    }

    try {
        await admin.auth().updateUser(uid, { password: newPassword });
        await admin.auth().revokeRefreshTokens(uid);
        const { FieldValue } = require('firebase-admin/firestore');
        await db.collection('users').doc(uid).update({
            updatedAt: FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (err) {
        throw new HttpsError('internal', 'パスワードの変更に失敗しました: ' + err.message);
    }
});

// ── linkGoogle ────────────────────────────────────────────────────────

exports.linkGoogle = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    // Firebase Auth linking is handled client-side via linkWithPopup.
    // This CF simply records the link state in Firestore.
    const { FieldValue } = require('firebase-admin/firestore');
    await db.collection('users').doc(uid).update({
        googleLinked: true,
        updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── deleteUnlinkedGoogleUser ──────────────────────────────────────────
// ログイン直後に呼び出す。MANSUKEアカウントと連携されていないGoogleユーザーを
// Firebase Authから完全に削除する。

exports.deleteUnlinkedGoogleUser = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    // 対象がgoogleLinked:trueの正規ユーザーなら削除しない（誤削除防止）
    const userDoc = await db.collection('users').doc(uid).get();
    if (userDoc.exists && userDoc.data()?.googleLinked === true) {
        throw new HttpsError(
            'failed-precondition',
            'このアカウントはMANSUKEアカウントと連携済みです'
        );
    }

    // 未連携 or ドキュメント未存在 → Firebase Authから削除
    try {
        await admin.auth().deleteUser(uid);
    } catch (err) {
        throw new HttpsError('internal', 'Googleアカウントの削除に失敗しました: ' + err.message);
    }

    return { success: true };
});

// ── unlinkGoogle ──────────────────────────────────────────────────────

exports.unlinkGoogle = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    try {
        await admin.auth().updateUser(uid, {
            providersToUnlink: ['google.com'],
        });
    } catch (err) {
        // If not linked, treat as success
        if (!err.message?.includes('provider')) {
            throw new HttpsError('internal', 'Google連携の解除に失敗しました: ' + err.message);
        }
    }

    const { FieldValue } = require('firebase-admin/firestore');
    await db.collection('users').doc(uid).update({
        googleLinked: false,
        updatedAt: FieldValue.serverTimestamp(),
    });

    return { success: true };
});

