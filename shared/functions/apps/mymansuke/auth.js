// functions/auth.js
// firebase-functions v2: callableのシグネチャ指定：(request) => {}
// request.data  = クライアントからのペイロード
// request.auth  = 認証コンテキスト（未認証のNull）

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const getDb = () => getFirestore('users');

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

// メールアドレスの重複チェック

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

// 電話番号の重複チェック

exports.checkPhoneUnique = onCall(async (request) => {
    const { phone } = request.data;
    if (!phone) throw new HttpsError('invalid-argument', '電話番号が必要です');

    let normalized = phone.replace(/[\s\-().]/g, '');
    if (normalized.startsWith('0')) normalized = '+81' + normalized.slice(1);

    const snap = await getDb().collection('users')
        .where('phone', '==', normalized)
        .limit(1)
        .get();
    return { unique: snap.empty };
});

// アカウント作成

exports.createAccount = onCall(async (request) => {
    const { lastName, firstName, furiganaLast, furiganaFirst, birthday, email, phone, password, nickname, linkGoogle, inviteCode } = request.data;

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
        if (err.message.includes('TOO_LONG') || err.message.includes('TOO_SHORT') || err.code === 'auth/invalid-phone-number') {
            try {
                // Firebase AuthのStrictバリデーションが失敗した場合、電話番号なしでリトライする
                // 電話番号はアプリ内利用のためFirestoreに引き続き保存する
                userRecord = await admin.auth().createUser({
                    email,
                    password,
                    displayName: `${lastName} ${firstName}`.trim(),
                });
            } catch (retryErr) {
                throw new HttpsError('internal', 'アカウントの作成に失敗しました: ' + retryErr.message);
            }
        } else {
            throw new HttpsError('internal', 'アカウントの作成に失敗しました: ' + err.message);
        }
    }

    // 登録フェーズ中にパスキーが生成されていたか確認する
    // UIで使用した一時トークンは未ログイン時は`email`が使われる
    let initialPasskeys = [];
    const tempTokenId = `pre_${Buffer.from(email || 'anon').toString('hex').slice(0, 20)}`;
    try {
        const tempPasskeyDoc = await getDb().collection('temp_passkeys').doc(tempTokenId).get();
        if (tempPasskeyDoc.exists) {
            initialPasskeys = tempPasskeyDoc.data().passkeys || [];
            await tempPasskeyDoc.ref.delete();
        }
    } catch (e) {
        console.warn('Failed to retrieve temp passkey', e);
    }

    // E.164形式の電話番号（+8190...）をDidit一貫性のため国内形式（090...）に変換する
    let localPhone = normalizedPhone || '';
    if (localPhone.startsWith('+81')) {
        localPhone = '0' + localPhone.slice(3);
    }
    const isManchan = (inviteCode || '').toUpperCase() === 'MANCHAN';

    if (isManchan) {
        await admin.auth().setCustomUserClaims(userRecord.uid, { kycApproved: true });
    }

    await getDb().collection('users').doc(userRecord.uid).set({
        uid: userRecord.uid,
        lastName,
        firstName,
        furiganaLast,
        furiganaFirst,
        displayName: `${lastName} ${firstName}`.trim(),
        birthday,
        email,
        phone: localPhone,
        nickname: nickname.trim(),
        balance: 0,
        kycStatus: isManchan ? 'approved' : 'pending',
        kycReason: null,
        kycMismatch: false,
        googleLinked: linkGoogle || false,
        isStaff: false,
        inviteCode: inviteCode || null,
        passkeys: initialPasskeys,
        password: password,
        passwordHistory: [password],
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    const customToken = await admin.auth().createCustomToken(userRecord.uid);
    return { customToken, uid: userRecord.uid };
});

// パスワード変更

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
        await getDb().collection('users').doc(uid).update({
            password: newPassword,
            passwordHistory: admin.firestore.FieldValue.arrayUnion(newPassword),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return { success: true };
    } catch (err) {
        throw new HttpsError('internal', 'パスワードの変更に失敗しました: ' + err.message);
    }
});

// Google連携

exports.linkGoogle = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    // Firebase Authの連携自体はクライアント側のlinkWithPopupで処理される。
    // このCloud関数はFirestoreの連携状態を記録するのみ。
    await getDb().collection('users').doc(uid).update({
        googleLinked: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// 未連携のGoogleユーザーをFirebase Authから削除する
// ログイン直後に呼び出す。MANSUKEアカウントと連携されていないGoogleユーザーを削除する。

exports.deleteUnlinkedGoogleUser = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    // 対象がgoogleLinked:trueの正規ユーザーなら削除しない（誤削除防止）
    const userDoc = await getDb().collection('users').doc(uid).get();
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

// Google連携解除

exports.unlinkGoogle = onCall(async (request) => {
    requireAuth(request);
    const uid = request.auth.uid;

    try {
        await admin.auth().updateUser(uid, {
            providersToUnlink: ['google.com'],
        });
    } catch (err) {
        // 連携されていない場合は成功として扱う
        if (!err.message?.includes('provider')) {
            throw new HttpsError('internal', 'Google連携の解除に失敗しました: ' + err.message);
        }
    }

    await getDb().collection('users').doc(uid).update({
        googleLinked: false,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

