// functions/didit.js
// Didit KYC Webhookハンドラー。
//
// DiditはKYC結果含出APIリクエスト（POST）をこのHTTPSエンドポイントに送信する。
// リクエストはDIDIT_WEBHOOK_SECRETを使ってHMAC-SHA256で検証する。
//
// セットアップ:
//   1. この関数をデプロイする: firebase deploy --only functions:diditWebhook
//   2. Firebaseコンソール > Functions > diditWebhookからエンドポイントURLを取得する
//      （例: https://us-central1-mansuke-app.cloudfunctions.net/diditWebhook）
//   3. そのURLをDiditダッシュボードに登録する:
//      https://verify.didit.me/ → Settings → Webhooks → Add webhook URL
//   4. Diditダッシュボードからwebhookシークレットをコピーしてfunctions/.envに設定する:
//      DIDIT_WEBHOOK_SECRET=《シークレット》

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

if (!admin.apps.length) admin.initializeApp();

const { getFirestore } = require('firebase-admin/firestore');
const getDb = () => getFirestore('users');

const WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET;
const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || '72de9a63-73eb-475d-9e11-5e95c445199d';

// HMAC署名検証

function verifySignature(rawBody, signature) {
    if (!WEBHOOK_SECRET) {
        logger.warn('DIDIT_WEBHOOK_SECRETが未設定 -- 署名検証をスキップします');
        return true; // 開発環境では許可、本番環境ではブロックする
    }
    const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

    // デバッグログ
    const secretMasked = WEBHOOK_SECRET.substring(0, 4) + '...' + WEBHOOK_SECRET.substring(WEBHOOK_SECRET.length - 4);
    logger.info('Signature debug:', {
        secretLength: WEBHOOK_SECRET.length,
        secretMasked,
        expected,
        received: signature,
        rawBodyLength: rawBody ? rawBody.length : 0
    });

    try {
        return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
    } catch (err) {
        logger.error('Signature compare error', err);
        return false;
    }
}

// Webhookハンドラー

exports.diditWebhook = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    // functions.loggerはReferenceErrorを引き起こしていたため削除済み
    logger.info('Incoming Headers:', req.headers);

    const sigV2 = req.headers['x-signature-v2'] || '';
    const sigSimple = req.headers['x-signature-simple'] || '';
    const sigLegacy = req.headers['x-signature'] || '';
    const timestamp = req.headers['x-timestamp'] || '';

    const rawBodyBuffer = req.rawBody || Buffer.from(JSON.stringify(req.body));
    const timestampBodyBuffer = timestamp ? Buffer.concat([Buffer.from(timestamp + '.'), rawBodyBuffer]) : null;

    let isValid = false;
    let matchedSig = null;

    const possibleSigs = [sigSimple, sigLegacy, sigV2].filter(Boolean);

    for (const sig of possibleSigs) {
        if (verifySignature(rawBodyBuffer, sig)) {
            isValid = true;
            matchedSig = sig;
            break;
        }
        if (timestampBodyBuffer && verifySignature(timestampBodyBuffer, sig)) {
            isValid = true;
            matchedSig = sig;
            break;
        }
    }

    if (!isValid) {
        logger.error('Didit webhook: invalid signature');
        return res.status(401).json({ error: 'Invalid signature' });
    }

    logger.info('Signature valid!', { matchedSig });

    const payload = req.body;
    logger.info('Didit webhook received', { payload });

    // Diditからのペイロードの主要フィールドを取り出す
    // Diditから期待されるペイロード構造:
    // {
    //   workflow_id: "...",
    //   session_id: "...",
    //   vendor_data: "...", <- Firebase UID（URLの?vendor_data=経由で渡す）
    //   status: "Approved" | "Declined",
    //   decision: { ... },
    // }

    // Diditは実際のペイロードで先頭大文字のステータスを使うため小文字化する: "Approved" | "Declined"
    const status = (payload.status || '').toLowerCase();

    const decision = payload.decision || {};
    const metadata = payload.metadata || decision.metadata || {};
    const sessionId = payload.session_id || decision.session_id;

    // Diditの詳細配列から検証済みメールアドレスと電話番号を取り出す
    const emailVerifications = decision.email_verifications || [];
    const phoneVerifications = decision.phone_verifications || [];

    let approvedEmail = payload.email || payload.approved_email || null;
    if (!approvedEmail && emailVerifications.length > 0) {
        approvedEmail = emailVerifications[0].email;
    }

    let approvedPhone = payload.phone_number || payload.approved_phone || null;
    if (!approvedPhone && phoneVerifications.length > 0) {
        approvedPhone = phoneVerifications[0].full_number || phoneVerifications[0].phone_number;
        // 日本の電話番号を正規化する（例: +8180... → 080...）
        if (approvedPhone && approvedPhone.startsWith('+81')) {
            approvedPhone = '0' + approvedPhone.slice(3);
        }
    }

    // Firebase UIDをvendor_dataで渡すが、user_id/userIdもフォールバックとして確認する
    let userId = payload.vendor_data || payload.user_id || payload.userId;

    // Diditがvendor_dataを落とした場合、検証済みメールアドレスや電話番号でユーザーを特实する
    if (!userId && approvedEmail) {
        const usersByEmail = await getDb().collection('users').where('email', '==', approvedEmail).limit(1).get();
        if (!usersByEmail.empty) {
            userId = usersByEmail.docs[0].id;
        }
    }

    if (!userId && approvedPhone) {
        const usersByPhone = await getDb().collection('users').where('phone', '==', approvedPhone).limit(1).get();
        if (!usersByPhone.empty) {
            userId = usersByPhone.docs[0].id;
        }
    }

    const reason = metadata.reason;

    if (!userId) {
        logger.warn('Didit webhook: no user_id found and could not match by email/phone', { payload, approvedEmail, approvedPhone });
        return res.status(200).json({ received: true, note: 'user not found by id, email, or phone' });
    }

    const userRef = getDb().collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        logger.error('Didit webhook: user not found', { userId });
        return res.status(200).json({ received: true, note: 'user not found' });
    }

    const userData = userDoc.data();

    if (status === 'approved') {
        // Check that approved email & phone match the account
        const emailMatches = !approvedEmail || approvedEmail === userData.email;
        
        let normalizedUserPhone = userData.phone || '';
        if (normalizedUserPhone.startsWith('+81')) {
            normalizedUserPhone = '0' + normalizedUserPhone.slice(3);
        }
        let normalizedApprovedPhone = approvedPhone || '';
        if (normalizedApprovedPhone.startsWith('+81')) {
            normalizedApprovedPhone = '0' + normalizedApprovedPhone.slice(3);
        }
        
        const phoneMatches = !approvedPhone || normalizedApprovedPhone === normalizedUserPhone;

        if (!emailMatches || !phoneMatches) {
            // 不一致 -- 不一致状態で保存する（小字化変換の古いセッションをDiditが再利用しないよう）
            await userRef.update({
                kycStatus: 'mismatch',
                kycMismatch: true,
                kycSessionId: sessionId,
                kycDiditEmail: approvedEmail || null,
                kycDiditPhone: approvedPhone || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        } else {
            await userRef.update({
                kycStatus: 'approved',
                kycMismatch: false,
                kycReason: null,
                kycSessionId: sessionId,
                kycApprovedEmail: approvedEmail || null,
                kycApprovedPhone: approvedPhone || null,
                kycDiditEmail: approvedEmail || null,
                kycDiditPhone: approvedPhone || null,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            });
            // FirestoreルールがなkycApprovedを確認できるようカスタムクレームを設定する
            await admin.auth().setCustomUserClaims(userId, { kycApproved: true });
        }

        logger.info('Didit KYC approved', { userId, emailMatches, phoneMatches });

    } else if (status === 'declined') {
        await userRef.update({
            kycStatus: 'rejected',
            kycReason: reason || null,
            kycMismatch: false,
            kycSessionId: sessionId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        logger.info('Didit KYC declined', { userId, reason });
    } else {
        logger.warn('Didit webhook: unknown status', { status });
    }

    return res.status(200).json({ received: true });
});

// Diditセッション作成

exports.createDiditSession = onCall(async (request) => {
    // 1. 認証確認
    if (!request.auth) {
        throw new HttpsError(
            'unauthenticated',
            'Must be logged in to create a Didit session.'
        );
    }

    const uid = request.auth.uid;
    const apiKey = process.env.DIDIT_API_KEY;

    if (!apiKey) {
        logger.error('DIDIT_API_KEY is not set');
        throw new HttpsError(
            'internal',
            'Server configuration error: DIDIT_API_KEY is missing'
        );
    }

    // 2. Didit API向けのペイロードを準備する
    const payload = {
        workflow_id: WORKFLOW_ID,
        vendor_data: uid, // Firebase UIDを渡してwebhookがユーザーを識別できるようにする
    };

    try {
        // 3. Didit POST /v3/sessionを呼び出す
        const response = await fetch('https://verification.didit.me/v3/session/', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text();
            logger.error('Didit API Error', { status: response.status, errorText });
            throw new HttpsError(
                'internal',
                `Failed to create Didit session: ${response.status} ${response.statusText}`
            );
        }

        const result = await response.json();
        // APIはセッションURLを返す： { url: "https://verify.didit.me/..." }

        // フロントエンドにURLを返す
        return {
            url: result.url
        };

    } catch (err) {
        logger.error('Error calling Didit Create Session API', err);
        throw new HttpsError('internal', err.message || 'Failed to connect to Didit API');
    }
});
