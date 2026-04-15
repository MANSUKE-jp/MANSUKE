// MANSUKE KEYBOARD — チャットセッション Cloud Functions
// Firebase Realtime Databaseを使用してメッセージを一時管理する

const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const axios = require("axios");
if (!admin.apps.length) admin.initializeApp();

const rtdb = admin.database();
const SESSION_PATH = "keyboard_chat";
const MAX_MESSAGES = 200;
const MESSAGE_TTL_MS = 60 * 60 * 1000; // 1時間

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

// 古いメッセージのクリーンアップ
async function cleanupOldMessages() {
    const cutoff = Date.now() - MESSAGE_TTL_MS;
    const oldMsgs = await rtdb
        .ref(`${SESSION_PATH}/messages`)
        .orderByChild("timestamp")
        .endAt(cutoff)
        .once("value");

    if (oldMsgs.exists()) {
        const updates = {};
        oldMsgs.forEach((child) => {
            updates[child.key] = null;
        });
        await rtdb.ref(`${SESSION_PATH}/messages`).update(updates);
    }
}

// メッセージ送信
// POST body: { uid, name, text, type?, code? }
exports.keyboardChatSend = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { uid, name, text, type = "chat", code } = req.body;
        if (!uid || !name || !text) {
            res.status(400).json({ error: "uid, name, text are required" });
            return;
        }

        const messageData = {
            text,
            senderUid: uid,
            senderName: name,
            type,
            timestamp: Date.now(),
        };
        if (type === "roomCode" && code) {
            messageData.code = code;
        }

        await rtdb.ref(`${SESSION_PATH}/messages`).push(messageData);

        // 非同期でクリーンアップ（レスポンスを遅らせない）
        cleanupOldMessages().catch((e) =>
            console.error("Cleanup error:", e)
        );

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Send error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// セッション参加
// POST body: { uid, name }
exports.keyboardChatJoin = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { uid, name } = req.body;
        if (!uid || !name) {
            res.status(400).json({ error: "uid, name are required" });
            return;
        }

        // 参加者リストに追加
        await rtdb.ref(`${SESSION_PATH}/participants/${uid}`).set({
            name,
            joinedAt: Date.now(),
        });

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Join error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// セッション退出
// POST body: { uid, name }
exports.keyboardChatLeave = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { uid, name } = req.body;
        if (!uid || !name) {
            res.status(400).json({ error: "uid, name are required" });
            return;
        }

        // 参加者リストから削除
        await rtdb.ref(`${SESSION_PATH}/participants/${uid}`).remove();

        // 人数確認（誰もいなくなったらチャット履歴を全消去します）
        const snapshot = await rtdb.ref(`${SESSION_PATH}/participants`).once("value");
        if (!snapshot.exists() || Object.keys(snapshot.val()).length === 0) {
            await rtdb.ref(`${SESSION_PATH}/messages`).remove();
            console.log("All participants left. Cleared all messages.");
        }

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("Leave error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// メッセージポーリング
// POST body: { since? } — since はタイムスタンプ（ミリ秒）
// returns: { messages: [...], participants: [...] }
exports.keyboardChatPoll = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const since = req.body.since || 0;

        // メッセージ取得
        const msgSnap = await rtdb
            .ref(`${SESSION_PATH}/messages`)
            .orderByChild("timestamp")
            .startAt(since + 1)
            .limitToLast(50)
            .once("value");

        const messages = [];
        if (msgSnap.exists()) {
            msgSnap.forEach((child) => {
                messages.push({ id: child.key, ...child.val() });
            });
        }

        // 参加者取得
        const partSnap = await rtdb
            .ref(`${SESSION_PATH}/participants`)
            .once("value");

        const participants = [];
        if (partSnap.exists()) {
            partSnap.forEach((child) => {
                participants.push({
                    uid: child.key,
                    ...child.val(),
                });
            });
        }

        res.status(200).json({
            messages,
            participants,
            serverTime: Date.now(),
        });
    } catch (error) {
        console.error("Poll error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// リアクション送信
// POST body: { uid, messageId, reactionType } 
// reactionType="ok" or "no"
exports.keyboardChatReact = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const { uid, messageId, reactionType } = req.body;
        if (!uid || !messageId || !reactionType) {
            res.status(400).json({ error: "Missing parameters" });
            return;
        }

        const msgRef = rtdb.ref(`${SESSION_PATH}/messages/${messageId}/reactions/${reactionType}/${uid}`);
        await msgRef.set(true);

        res.status(200).json({ success: true });
    } catch (error) {
        console.error("React error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});

// 住所特定テンプレート生成
// POST body: { colorName }
exports.keyboardAddressTemplate = onRequest(async (req, res) => {
    if (setCors(req, res)) return;
    if (req.method !== "POST") {
        res.status(405).json({ error: "Method not allowed" });
        return;
    }

    try {
        const colorName = req.body.colorName || "不明";
        
        // ランダムな日付 (2000年4月2日〜2014年3月31日)
        const start = new Date(2000, 3, 2).getTime();
        const end = new Date(2014, 2, 31).getTime();
        const randomTime = start + Math.random() * (end - start);
        const randomDate = new Date(randomTime);
        const yyyy = randomDate.getFullYear();
        const mm = randomDate.getMonth() + 1;
        const dd = randomDate.getDate();

        // 住所生成
        let address = "東京都千代田区千代田1-1"; // fallback
        const apiKey = process.env.MAPS_API_KEY;
        
        if (apiKey) {
            let foundResidential = false;
            let attempts = 0;
            
            while (!foundResidential && attempts < 40) {
                attempts++;
                
                // 日本全国の座標
                // 北緯 31.0 ~ 45.3, 東経 129.0 ~ 145.8
                const lat = 31.0 + Math.random() * 14.3;
                const lng = 129.0 + Math.random() * 16.8;
                
                try {
                    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=ja&result_type=street_address|premise&key=${apiKey}`;
                    const geoRes = await axios.get(geoUrl); // axiosを使う場合は事前に展開またはrequire済みの前提
                    
                    if (geoRes.data && geoRes.data.results && geoRes.data.results.length > 0) {
                        for (const result of geoRes.data.results) {
                            if (result.types.includes("street_address") || result.types.includes("premise") || result.types.includes("subpremise")) {
                                
                                let fmt = result.formatted_address;
                                fmt = fmt.replace(/^日本、\s*/, "");
                                fmt = fmt.replace(/〒\d{3}-\d{4}\s*/, "");
                                
                                // マンション名や会社名を除外するため、最初の空白以降を切り捨てる
                                fmt = fmt.split(/[\s　]+/)[0];
                                
                                // 漢数字の丁目を半角にする
                                const kanjiMap = {
                                    '一': '1', '二': '2', '三': '3', '四': '4', '五': '5',
                                    '六': '6', '七': '7', '八': '8', '九': '9', '十': '10',
                                    '十一': '11', '十二': '12', '十三': '13', '十四': '14', '十五': '15',
                                    '十六': '16', '十七': '17', '十八': '18', '十九': '19', '二十': '20'
                                };
                                Object.keys(kanjiMap).forEach(k => {
                                    fmt = fmt.replace(new RegExp(k + "丁目", "g"), kanjiMap[k] + "丁目");
                                });
                                
                                // 半角数字などに変換
                                fmt = fmt.replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0));
                                fmt = fmt.replace(/[−ー－—]/g, '-');
                                
                                if (fmt && !fmt.includes("Unnamed") && /\d/.test(fmt)) {
                                    address = fmt;
                                    foundResidential = true;
                                    break;
                                }
                            }
                        }
                    }
                } catch(e) {
                    console.error("Geocoding API error:", e.message);
                }
            }
        } else {
            console.warn("MAPS_API_KEY is not set.");
        }

        const text = `${colorName}のプレイヤーは、${yyyy}年${mm}月${dd}日生まれ、住所は${address}ではないでしょうか？`;
        res.status(200).json({ text });
    } catch (error) {
        console.error("Address Template error:", error);
        res.status(500).json({ error: "Internal error" });
    }
});
