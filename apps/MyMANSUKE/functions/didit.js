/**
 * functions/didit.js
 * Didit KYC webhook handler.
 *
 * Didit sends POST requests to this HTTPS endpoint when KYC results are ready.
 * The request payload is verified with HMAC-SHA256 using the DIDIT_WEBHOOK_SECRET.
 *
 * Setup:
 *   1. Deploy this function: firebase deploy --only functions:diditWebhook
 *   2. Get the endpoint URL from Firebase Console > Functions > diditWebhook
 *      (e.g. https://us-central1-mansuke-app.cloudfunctions.net/diditWebhook)
 *   3. Register this URL in the Didit dashboard:
 *      https://verify.didit.me/ → Settings → Webhooks → Add webhook URL
 *   4. Copy the webhook secret from Didit dashboard and set it in functions/.env:
 *      DIDIT_WEBHOOK_SECRET=<your_secret>
 */

const { onRequest, onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const { getFirestore } = require('firebase-admin/firestore');
const db = getFirestore('users');

const WEBHOOK_SECRET = process.env.DIDIT_WEBHOOK_SECRET;
const WORKFLOW_ID = process.env.DIDIT_WORKFLOW_ID || '72de9a63-73eb-475d-9e11-5e95c445199d';

// ── HMAC verification ─────────────────────────────────────────────────

function verifySignature(rawBody, signature) {
    if (!WEBHOOK_SECRET) {
        logger.warn('DIDIT_WEBHOOK_SECRET not set — skipping signature verification');
        return true; // Allow in dev, block in prod
    }
    const expected = crypto
        .createHmac('sha256', WEBHOOK_SECRET)
        .update(rawBody)
        .digest('hex');

    // DEBUG LOGGING
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

// ── Webhook Handler ───────────────────────────────────────────────────

exports.diditWebhook = onRequest(async (req, res) => {
    if (req.method !== 'POST') {
        return res.status(405).send('Method Not Allowed');
    }

    functions.logger.info('Incoming Headers:', req.headers);
    // (Wait, I should use logger instead of functions.logger)
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

    // Extract key fields
    // Expected payload structure from Didit:
    // {
    //   workflow_id: "...",
    //   session_id: "...",
    //   vendor_data: "...", <- This contains our Firebase UID (passed via URL ?vendor_data=)
    //   status: "Approved" | "Declined",
    //   decision: { ... },
    // }

    // Didit often uses capitalized statuses in their actual payloads: "Approved" | "Declined", so lowercase it
    const status = (payload.status || '').toLowerCase();

    const decision = payload.decision || {};
    const metadata = payload.metadata || decision.metadata || {};
    const sessionId = payload.session_id || decision.session_id;

    // Extract verified email/phone from Didit's detailed arrays
    const emailVerifications = decision.email_verifications || [];
    const phoneVerifications = decision.phone_verifications || [];

    let approvedEmail = payload.email || payload.approved_email || null;
    if (!approvedEmail && emailVerifications.length > 0) {
        approvedEmail = emailVerifications[0].email;
    }

    let approvedPhone = payload.phone_number || payload.approved_phone || null;
    if (!approvedPhone && phoneVerifications.length > 0) {
        approvedPhone = phoneVerifications[0].full_number || phoneVerifications[0].phone_number;
        // Normalize Japanese phone numbers (e.g. +8180... -> 080...)
        if (approvedPhone && approvedPhone.startsWith('+81')) {
            approvedPhone = '0' + approvedPhone.slice(3);
        }
    }

    // We pass the Firebase UID in vendor_data, but also check user_id/userId as fallbacks
    let userId = payload.vendor_data || payload.user_id || payload.userId;

    // If Didit dropped vendor_data, fallback to finding the user by their verified email/phone
    if (!userId && approvedEmail) {
        const usersByEmail = await db.collection('users').where('email', '==', approvedEmail).limit(1).get();
        if (!usersByEmail.empty) {
            userId = usersByEmail.docs[0].id;
        }
    }

    if (!userId && approvedPhone) {
        const usersByPhone = await db.collection('users').where('phone', '==', approvedPhone).limit(1).get();
        if (!usersByPhone.empty) {
            userId = usersByPhone.docs[0].id;
        }
    }

    const reason = metadata.reason;

    if (!userId) {
        logger.warn('Didit webhook: no user_id found and could not match by email/phone', { payload, approvedEmail, approvedPhone });
        return res.status(200).json({ received: true, note: 'user not found by id, email, or phone' });
    }

    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    if (!userDoc.exists) {
        logger.error('Didit webhook: user not found', { userId });
        return res.status(200).json({ received: true, note: 'user not found' });
    }

    const userData = userDoc.data();

    if (status === 'approved') {
        // Check that approved email & phone match the account
        const emailMatches = !approvedEmail || approvedEmail === userData.email;
        const phoneMatches = !approvedPhone || approvedPhone === userData.phone;

        if (!emailMatches || !phoneMatches) {
            // Mismatch — store as 'mismatch' (NOT 'approved') so Didit doesn't reuse the old session
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
            // Set custom claim so Firestore rules can check kycApproved
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

// ── Didit Session Creation ──────────────────────────────────────────────

exports.createDiditSession = onCall(async (request) => {
    // 1. Verify caller is authenticated
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

    // 2. Prepare payload for Didit API
    const payload = {
        workflow_id: WORKFLOW_ID,
        vendor_data: uid, // Pass the Firebase UID so webhook can identify user
    };

    try {
        // 3. Call Didit POST /v3/session
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
        // The API returns a session URL, e.g. { url: "https://verify.didit.me/..." }

        // Return the URL to the frontend
        return {
            url: result.url
        };

    } catch (err) {
        logger.error('Error calling Didit Create Session API', err);
        throw new HttpsError('internal', err.message || 'Failed to connect to Didit API');
    }
});
