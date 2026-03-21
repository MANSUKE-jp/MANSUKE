// functions/passkey.js
// firebase-functions v2: callableのシグネチャ指定: (request) => {}

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const {
    generateRegistrationOptions,
    verifyRegistrationResponse,
    generateAuthenticationOptions,
    verifyAuthenticationResponse,
} = require('@simplewebauthn/server');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const getDb = () => getFirestore('users');

const RP_ID = process.env.RP_ID || 'mansuke.jp';
const RP_NAME = 'MANSUKEアカウント';
const RP_ORIGIN = process.env.RP_ORIGIN || 'https://my.mansuke.jp';

// 開発環境用にローカルホストのオリジンも許可する
const EXPECTED_ORIGINS = [RP_ORIGIN, 'http://localhost:5173', 'http://localhost:5174', 'http://localhost:3000', 'http://localhost:4000'];
const EXPECTED_RPIDS = [RP_ID, 'localhost'];

function requireAuth(request) {
    if (!request.auth) {
        throw new HttpsError('unauthenticated', '認証が必要です');
    }
}

// challengesコレクションへのヘルパー (users DB内)
const challengesCol = () => getDb().collection('challenges');

// パスキー登録チャレンジ生成

exports.registerPasskeyChallenge = onCall(async (request) => {
    const { uid: dataUid, email, displayName, nickname } = request.data;
    const uid = request.auth?.uid || dataUid;

    const userName = email || displayName || 'user';
    const userDisplay = nickname || displayName || 'User';
    const userIdBytes = Buffer.from(uid || email || require('crypto').randomUUID());

    const userDoc = uid ? await getDb().collection('users').doc(uid).get() : null;
    const existingPasskeys = userDoc?.data()?.passkeys || [];

    const options = await generateRegistrationOptions({
        rpName: RP_NAME,
        rpID: RP_ID,
        userID: userIdBytes,
        userName,
        userDisplayName: userDisplay,
        attestationType: 'none',
        excludeCredentials: existingPasskeys.map(pk => ({
            id: pk.credentialID,
            type: 'public-key',
        })),
        authenticatorSelection: {
            residentKey: 'required',
            userVerification: 'required',
        },
    });

    const challengeDocId = uid
        ? uid
        : `pre_${Buffer.from(email || 'anon').toString('hex').slice(0, 20)}`;

    await challengesCol().doc(challengeDocId).set({
        challenge: options.challenge,
        type: 'registration',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        ...(uid ? {} : { email }),
    });

    return {
        ...options,
        challenge: options.challenge,
        rpId: RP_ID,
        userId: userIdBytes.toString('base64url'),
        userName,
        displayName: userDisplay,
        tempToken: challengeDocId,
    };
});

// ── verifyPasskeyRegistration ─────────────────────────────────────────

exports.verifyPasskeyRegistration = onCall(async (request) => {
    const { attestation, tempToken } = request.data;
    const uid = request.auth?.uid;

    const challengeId = uid || tempToken;
    const challengeRef = challengesCol().doc(challengeId);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists) {
        throw new HttpsError('not-found', 'チャレンジが見つかりません。再度お試しください。');
    }

    const { challenge } = challengeDoc.data();

    let verification;
    try {
        verification = await verifyRegistrationResponse({
            response: attestation,
            expectedChallenge: challenge,
            expectedOrigin: EXPECTED_ORIGINS,
            expectedRPID: EXPECTED_RPIDS,
            requireUserVerification: true,
        });
    } catch (err) {
        throw new HttpsError('invalid-argument', 'パスキーの検証に失敗しました: ' + err.message);
    }

    if (!verification.verified || !verification.registrationInfo) {
        throw new HttpsError('invalid-argument', 'パスキーの検証に失敗しました');
    }

    const { credential } = verification.registrationInfo;

    // 1剧1パスキー（UID登録済み）は説明的なデフォルト名にする;
    // 2枚目以降は汎用名にする。
    const existingPasskeys = uid
        ? (await getDb().collection('users').doc(uid).get()).data()?.passkeys || []
        : [];
    const defaultName = existingPasskeys.length === 0
        ? 'アカウント作成時に登録したパスキー'
        : 'パスキー';

    const passkeyData = {
        id: credential.id,
        credentialID: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        name: defaultName,
        createdAt: new Date().toISOString(),
    };

    await challengeRef.delete();

    if (uid) {
        await getDb().collection('users').doc(uid).update({
            passkeys: admin.firestore.FieldValue.arrayUnion(passkeyData),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    } else {
        // 事前登録（アカウント未作成）の場合、createAccountが後で取得できるようtemp_passkeysから一時保存する。
        // MANSUKEではパスキーセットアップ後にユーザードキュメントを作成するフロー。
        await getDb().collection('temp_passkeys').doc(tempToken).set({
            passkeys: [passkeyData],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }

    return { verified: true, passkeyId: passkeyData.id };
});

// ── getPasskeyAuthChallenge ───────────────────────────────────────────

exports.getPasskeyAuthChallenge = onCall(async (request) => {
    const uid = request.data.uid || request.auth?.uid;
    if (!uid) throw new HttpsError('invalid-argument', 'UID が必要です');

    const userDoc = await getDb().collection('users').doc(uid).get();
    const passkeys = userDoc.data()?.passkeys || [];

    const options = await generateAuthenticationOptions({
        rpID: RP_ID,
        allowCredentials: passkeys.map(pk => ({
            id: pk.credentialID,
            type: 'public-key',
        })),
        userVerification: 'required',
    });

    await challengesCol().doc(`auth_${uid}`).set({
        challenge: options.challenge,
        type: 'authentication',
        uid,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
        ...options,
        challenge: options.challenge,
        rpId: RP_ID,
        allowCredentials: passkeys.map(pk => ({ id: pk.credentialID, type: 'public-key' })),
    };
});

// ── verifyPasskeyAuth ─────────────────────────────────────────────────

exports.verifyPasskeyAuth = onCall(async (request) => {
    const { uid, assertion } = request.data;
    if (!uid) throw new HttpsError('invalid-argument', 'UID が必要です');

    const challengeRef = challengesCol().doc(`auth_${uid}`);
    const challengeDoc = await challengeRef.get();

    if (!challengeDoc.exists) {
        throw new HttpsError('not-found', 'チャレンジが見つかりません。再度お試しください。');
    }

    const { challenge } = challengeDoc.data();

    const userDoc = await getDb().collection('users').doc(uid).get();
    const passkeys = userDoc.data()?.passkeys || [];

    const credId = assertion.id;
    const passkeyRecord = passkeys.find(pk =>
        pk.credentialID === credId || pk.id === credId
    );

    if (!passkeyRecord) {
        throw new HttpsError('not-found', 'パスキーが見つかりません');
    }

    let verification;
    try {
        verification = await verifyAuthenticationResponse({
            response: assertion,
            expectedChallenge: challenge,
            expectedOrigin: EXPECTED_ORIGINS,
            expectedRPID: EXPECTED_RPIDS,
            credential: {
                id: passkeyRecord.credentialID,
                publicKey: Buffer.from(passkeyRecord.publicKey, 'base64'),
                counter: passkeyRecord.counter,
            },
            requireUserVerification: true,
        });
    } catch (err) {
        throw new HttpsError('invalid-argument', 'パスキー認証に失敗しました: ' + err.message);
    }

    if (!verification.verified) {
        throw new HttpsError('unauthenticated', 'パスキー認証に失敗しました');
    }

    const updatedPasskeys = passkeys.map(pk =>
        pk.credentialID === credId
            ? { ...pk, counter: verification.authenticationInfo.newCounter }
            : pk
    );

    await getDb().collection('users').doc(uid).update({
        passkeys: updatedPasskeys,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await challengeRef.delete();
    return { verified: true };
});

// ── deletePasskey ─────────────────────────────────────────────────────

exports.deletePasskey = onCall(async (request) => {
    requireAuth(request);
    const { credentialId } = request.data;
    const uid = request.auth.uid;

    const userDoc = await getDb().collection('users').doc(uid).get();
    const passkeys = userDoc.data()?.passkeys || [];

    const filtered = passkeys.filter(pk => pk.id !== credentialId && pk.credentialID !== credentialId);

    await getDb().collection('users').doc(uid).update({
        passkeys: filtered,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});

// ── renamePasskey ─────────────────────────────────────────────────────

exports.renamePasskey = onCall(async (request) => {
    requireAuth(request);
    const { credentialId, name } = request.data;
    const uid = request.auth.uid;

    if (!name || name.trim().length === 0) {
        throw new HttpsError('invalid-argument', '名前を入力してください');
    }
    if (name.trim().length > 30) {
        throw new HttpsError('invalid-argument', '名前は30文字以内で入力してください');
    }

    const userDoc = await getDb().collection('users').doc(uid).get();
    const passkeys = userDoc.data()?.passkeys || [];

    const updated = passkeys.map(pk =>
        (pk.id === credentialId || pk.credentialID === credentialId)
            ? { ...pk, name: name.trim() }
            : pk
    );

    if (updated.every((pk, i) => pk.name === passkeys[i].name)) {
        throw new HttpsError('not-found', 'パスキーが見つかりません');
    }

    await getDb().collection('users').doc(uid).update({
        passkeys: updated,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true };
});
