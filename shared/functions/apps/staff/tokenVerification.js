const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const { getFirestore } = require('firebase-admin/firestore');
const getDb = () => getFirestore('users');

exports.verifyMansukeToken = onRequest({ cors: false }, async (req, res) => {
    const origin = req.headers.origin;
    if (origin && (
        origin.endsWith('.mansuke.jp') ||
        origin.endsWith('.web.app') ||
        origin === 'http://localhost:5173' ||
        origin === 'http://localhost:5174' ||
        origin === 'http://localhost:5175'
    )) {
        res.set('Access-Control-Allow-Origin', origin);
        res.set('Access-Control-Allow-Credentials', 'true');
    }

    if (req.method === 'OPTIONS') {
        res.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
        res.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        res.set('Access-Control-Max-Age', '3600');
        res.status(204).send('');
        return;
    }

    try {
        let idToken = null;
        const cookieHeader = req.headers.cookie || '';
        const cookies = {};
        cookieHeader.split(';').forEach(cookie => {
            const parts = cookie.split('=');
            if (parts.length >= 2) {
                cookies[parts[0].trim()] = parts.slice(1).join('=').trim();
            }
        });
        if (cookies['__session']) idToken = cookies['__session'];
        if (!idToken && req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
            idToken = req.headers.authorization.split('Bearer ')[1];
        }
        if (!idToken) {
            res.status(401).json({ error: 'No token found', code: 'no_token_found' });
            return;
        }

        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;
        const userDoc = await getDb().collection('users').doc(uid).get();

        let userData = { uid };
        if (userDoc.exists) {
            const data = userDoc.data();
            userData.nickname = data.nickname || "MANSUKE ユーザー";
            userData.name = (data.lastName && data.firstName)
                ? `${data.lastName} ${data.firstName}` : userData.nickname;
            userData.isStaff = data.isStaff === true;
        }

        try {
            const customToken = await admin.auth().createCustomToken(uid);
            userData.customToken = customToken;
        } catch (tokenErr) {
            console.error("Failed to mint custom token:", tokenErr);
        }

        res.status(200).json(userData);
    } catch (error) {
        console.error('Error verifying token:', error);
        res.status(401).json({ error: 'Invalid token', code: 'invalid_token' });
    }
});
