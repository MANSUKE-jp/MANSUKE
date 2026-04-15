// MANSUKE KEYBOARD — ID Token → Custom Token 変換
// アプリからWeb経由で取得したFirebase ID Tokenを受け取り、
// signInWithCustomTokenで使えるCustom Tokenを発行する

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();

// CORS設定ヘルパー
function setCors(req, res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
    if (req.method === "OPTIONS") {
        res.status(204).send("");
        return true;
    }
    return false;
}

/**
 * POST body: { idToken: string }
 * Response: { customToken: string, uid: string }
 *
 * アプリがmy.mansuke.jpから取得したID Tokenを検証し、
 * そのユーザーのCustom Tokenを返す。
 * アプリはこのCustom TokenでsignInWithCustomTokenを呼び出す。
 */
exports.keyboardExchangeToken = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { idToken } = req.body;
        if (!idToken) {
            res.status(400).json({ error: "idToken is required" });
            return;
        }

        // ID Tokenを検証する
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        const uid = decodedToken.uid;

        // Custom Tokenを生成する
        const customToken = await admin.auth().createCustomToken(uid);

        res.status(200).json({
            customToken,
            uid,
        });
    } catch (error) {
        console.error("Exchange Token error:", error);

        if (error.code === "auth/id-token-expired") {
            res.status(401).json({ error: "Token expired" });
        } else if (error.code === "auth/argument-error" || error.code === "auth/id-token-revoked") {
            res.status(401).json({ error: "Invalid token" });
        } else {
            res.status(500).json({ error: "Internal error" });
        }
    }
});
