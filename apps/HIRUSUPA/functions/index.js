const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const { getDatabase } = require("firebase-admin/database");
const { initializeApp } = require("firebase-admin/app");
const axios = require("axios");

// アプリを初期化
const app = initializeApp();

// Firestoreの初期化
// デフォルトまたは 'hirusupa' データベース
const hirusupaDb = getFirestore("hirusupa");
// 残高管理用の 'users' データベース
const usersDb = getFirestore("users");

// Realtime Databaseの初期化
const rtdb = getDatabase();

// iTunes APIのベースURL
const ITUNES_API_URL = "https://itunes.apple.com/search";
// MANSUKE SSOトークンの検証
async function getAuthenticatedUid(request) {
    // 1. Firebase Auth (localhost等) のチェック
    if (request.auth && request.auth.uid) {
        return request.auth.uid;
    }

    // 2. MANSUKE SSOトークンのチェック (data.token または Authorizationヘッダー)
    const token = request.data?.token || request.rawRequest?.headers?.authorization?.split('Bearer ')[1];

    if (token) {
        try {
            const response = await axios.get('https://my.mansuke.jp/api/verifyMansukeToken', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.data && response.data.uid) {
                return response.data.uid;
            }
        } catch (error) {
            console.error("SSO Verification Error:", error.message);
        }
    }

    throw new HttpsError('unauthenticated', 'この機能を利用するにはログインが必要です。');
}

// --- 1. iTunes検索 ---
exports.searchiTunes = onCall({ region: "asia-northeast2" }, async (request) => {
    const { mode, query, targetArtistName } = request.data;
    if (!mode || !query) {
        throw new HttpsError('invalid-argument', 'Mode and query are required.');
    }

    try {
        let resultData = [];

        if (mode === 'fetchSongsByArtist') {
            const url = `${ITUNES_API_URL}?term=${encodeURIComponent(query)}&country=JP&lang=ja_jp&media=music&entity=song&limit=200`;
            const response = await axios.get(url);
            if (response.data.resultCount === 0) throw new HttpsError('not-found', "アーティストが見つかりませんでした。");

            const songs = response.data.results
                .filter(item => item.artistName.toLowerCase() === query.toLowerCase() && item.kind === 'song')
                .map(item => item.trackName);
            resultData = [...new Set(songs)];
            if (resultData.length === 0) throw new HttpsError('not-found', "曲が見つかりませんでした。");

        } else if (mode === 'searchArtists') {
            const url = `${ITUNES_API_URL}?term=${encodeURIComponent(query)}&country=JP&lang=ja_jp&media=music&entity=album&limit=100`;
            const response = await axios.get(url);
            const artistMap = new Map();
            response.data.results.forEach(item => {
                if (item.artistName && !artistMap.has(item.artistId)) {
                    artistMap.set(item.artistId, {
                        id: item.artistId,
                        name: item.artistName,
                        image: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : null,
                        genre: item.primaryGenreName
                    });
                }
            });
            resultData = Array.from(artistMap.values());

        } else if (mode === 'searchTracks') {
            const url = `${ITUNES_API_URL}?term=${encodeURIComponent(query)}&country=JP&lang=ja_jp&media=music&limit=200`;
            const response = await axios.get(url);
            const searchTerms = query.toLowerCase().trim().split(/\s+/).filter(Boolean);
            const trackMap = new Map();

            response.data.results
                .filter(item => item.wrapperType === 'track')
                .filter(item => {
                    if (targetArtistName) {
                        const itemArtist = item.artistName.toLowerCase();
                        const targetArtist = targetArtistName.toLowerCase();
                        if (!itemArtist.includes(targetArtist) && !targetArtist.includes(itemArtist)) return false;
                    }
                    const targetText = `${item.trackName} ${item.artistName} ${item.collectionName || ''}`.toLowerCase();
                    return searchTerms.every(term => targetText.includes(term));
                })
                .forEach(item => {
                    const key = `${item.trackName.toLowerCase()}-${item.artistName.toLowerCase()}`;
                    if (!trackMap.has(key) || (trackMap.get(key).kind !== 'song' && item.kind === 'song')) {
                        trackMap.set(key, {
                            id: item.trackId,
                            name: item.trackName,
                            artist: item.artistName,
                            album: item.collectionName,
                            image: item.artworkUrl100 ? item.artworkUrl100.replace('100x100bb', '600x600bb') : null,
                            previewUrl: item.previewUrl,
                            kind: item.kind
                        });
                    }
                });
            resultData = Array.from(trackMap.values());
        }
        return resultData;
    } catch (error) {
        console.error("iTunes API Error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', '検索処理中にエラーが発生しました。', error.message);
    }
});

// --- 2. 過去7日間の統計取得 ---
exports.getWeeklyStats = onCall({ region: "asia-northeast2" }, async (request) => {
    try {
        const statsRef = rtdb.ref('stats/dailyCounts');
        const dates = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            dates.push(d.toISOString().split('T')[0]);
        }
        const startKey = dates[0];
        const endKey = dates[dates.length - 1];
        const snapshot = await statsRef.orderByKey().startAt(startKey).endAt(endKey).get();
        const data = snapshot.val() || {};
        const result = dates.map(date => ({
            date: date,
            label: date.slice(5).replace('-', '/'),
            count: data[date] || 0
        }));
        return result;
    } catch (error) {
        console.error("Weekly Stats Error:", error);
        throw new HttpsError('internal', '統計データの取得に失敗しました。', error.message);
    }
});

// --- 3. 履歴検索 ---
exports.searchHistory = onCall({ region: "asia-northeast2" }, async (request) => {
    const { artistName, songName, radioName, excludeMansuke } = request.data;
    try {
        const snapshot = await hirusupaDb.collection("history").orderBy("sentAt", "desc").limit(5000).get();
        if (snapshot.empty) return [];
        const results = snapshot.docs
            .map(doc => {
                const data = doc.data();
                let isoDate = null;
                try {
                    if (data.sentAt && typeof data.sentAt.toDate === 'function') {
                        isoDate = data.sentAt.toDate().toISOString();
                    } else if (data.sentAt) {
                        isoDate = new Date().toISOString();
                    }
                } catch (e) {
                    console.warn(`Date conversion failed for doc ${doc.id}`, e);
                }
                return { id: doc.id, ...data, sentAt: isoDate };
            })
            .filter(item => {
                if (artistName && item.artistName !== artistName) return false;
                if (songName) {
                    if (!item.songName || typeof item.songName !== 'string') return false;
                    if (!item.songName.toLowerCase().includes(songName.toLowerCase())) return false;
                }
                if (radioName) {
                    if (!item.radioName || typeof item.radioName !== 'string') return false;
                    if (!item.radioName.toLowerCase().includes(radioName.toLowerCase())) return false;
                }
                if (excludeMansuke) {
                    if (item.radioName && typeof item.radioName === 'string' && item.radioName.startsWith("まんすけ")) return false;
                }
                return true;
            })
            .slice(0, 100);
        return results;
    } catch (error) {
        console.error("Search Error Details:", error);
        throw new HttpsError('internal', '履歴検索に失敗しました。', error.message);
    }
});

// --- 4. Gemini APIを使ったラジオネーム生成と課金処理 (Receiptベース) ---
exports.generateRadioNamesFromGemini = onCall({ region: "asia-northeast2" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { sessionId, receiptId } = request.data || {};

    if (!receiptId) {
        throw new HttpsError('invalid-argument', 'レシートIDが指定されていません。');
    }

    const mansukeUserRef = usersDb.collection('users').doc(uid);
    const receiptRef = mansukeUserRef.collection('receipts').doc(receiptId);
    let receiptAmount = 0;
    let serviceId = '';

    try {
        // --- 1. レシートの消費（Gemini呼び出し前に消費状態にする） ---
        await usersDb.runTransaction(async (transaction) => {
            const receiptSnap = await transaction.get(receiptRef);
            if (!receiptSnap.exists) {
                throw new HttpsError('not-found', 'レシートが見つかりません。');
            }

            const receipt = receiptSnap.data();
            if (receipt.used) {
                throw new HttpsError('failed-precondition', 'このレシートは既に使用されています。');
            }
            if (receipt.refunded) {
                throw new HttpsError('failed-precondition', 'このレシートは返金済みです。');
            }
            if (receipt.serviceId !== 'HIRUSUPA') {
                throw new HttpsError('failed-precondition', 'このレシートはHIRUSUPA用ではありません。');
            }

            receiptAmount = receipt.amount;
            serviceId = receipt.serviceId;

            transaction.update(receiptRef, {
                used: true,
                usedAt: FieldValue.serverTimestamp()
            });
        });

        // --- 2. Gemini API 呼び出し ---
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new HttpsError('internal', 'APIキーが設定されていません。');

        const { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } = require("@google/generative-ai");
        const genAI = new GoogleGenerativeAI(apiKey);
        const safetySettings = [
            { category: HarmCategory.HARM_CATEGORY_HARASSMENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_HATE_SPEECH, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
            { category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT, threshold: HarmBlockThreshold.BLOCK_ONLY_HIGH },
        ];

        const modelName = process.env.GEMINI_MODEL || "gemini-2.5-flash";
        const model = genAI.getGenerativeModel({ model: modelName, safetySettings, generationConfig: { responseMimeType: "application/json" } });

        const prompt = `日本のラジオ番組のリクエストメールで使われるような、ユニークで面白く、かつ自然なラジオネームを100個考えて下さい。ランダムなテーマで作成して下さい。出力条件: 文字列の配列形式（["ネームA", "ネームB", ...]）であること。Markdown記法や挨拶は一切含めないこと。`;
        const result = await model.generateContent(prompt);
        const responseText = await result.response.text();
        const firstOpenBracket = responseText.indexOf('[');
        const lastCloseBracket = responseText.lastIndexOf(']');

        if (firstOpenBracket === -1 || lastCloseBracket === -1) throw new Error("有効なJSON配列が見つかりませんでした。");
        const jsonString = responseText.substring(firstOpenBracket, lastCloseBracket + 1);
        const radioNames = JSON.parse(jsonString);

    } catch (error) {
        // --- Gemini障害時などの返金処理 ---
        // エラーが発生し、かつレシートを消費済みだった場合は返金する
        if (receiptAmount > 0) {
            try {
                await usersDb.runTransaction(async (t) => {
                    const rSnap = await t.get(receiptRef);
                    if (rSnap.exists && rSnap.data().used && !rSnap.data().refunded) {
                        const transactionId = `refund_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
                        const transRef = mansukeUserRef.collection('transactions').doc(transactionId);

                        t.update(mansukeUserRef, {
                            balance: FieldValue.increment(receiptAmount),
                            updatedAt: FieldValue.serverTimestamp()
                        });
                        t.set(transRef, {
                            amount: receiptAmount,
                            type: 'refund',
                            label: `[${serviceId.toUpperCase()}] APIエラーによる返金`,
                            createdAt: FieldValue.serverTimestamp(),
                            serviceId: serviceId,
                            originalReceiptId: receiptId
                        });
                        t.update(receiptRef, {
                            refunded: true,
                            refundedAt: FieldValue.serverTimestamp()
                        });
                    }
                });
                console.log(`Refunded receipt ${receiptId} due to Gemini error.`);
            } catch (refundErr) {
                console.error("Failed to refund after Gemini error:", refundErr);
            }
        }

        console.error("Gemini API Function Error:", error);
        if (error instanceof HttpsError) throw error;
        throw new HttpsError('internal', error.message || '予期せぬエラーが発生しました。');
    }

    try {
        // --- 4. 統計記録 (hirusupa データベースの users コレクションに保存) ---
        const today = new Date();
        const yearMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
        const hirusupaUserRef = hirusupaDb.collection('users').doc(uid);
        await hirusupaUserRef.set({
            geminiUsage: { [yearMonth]: FieldValue.increment(1) },
            lastGeminiUsage: FieldValue.serverTimestamp()
        }, { merge: true });
    } catch (dbError) { console.error("Stats log error:", dbError); }

    // --- 正常終了 ---
    return { names: radioNames, totalAmount: receiptAmount };
});



// --- 5. 履歴保存と統計更新をサーバーで行う ---
exports.logSubmission = onCall({ region: "asia-northeast2" }, async (request) => {
    // 認証は必須ではない（匿名でもSSOでも受け付けるためgetAuthenticatedUidは通さない場合があるが、
    // ここでは念のためUid取得を試みる。失敗してもログは残す）
    let uid = "unknown";
    try {
        uid = await getAuthenticatedUid(request);
    } catch (e) { /* ignore */ }

    const { artistName, songName, radioName, targetForm } = request.data;

    try {
        // 1. Firestore履歴保存
        await hirusupaDb.collection("history").add({
            uid,
            artistName,
            songName,
            radioName,
            sentAt: FieldValue.serverTimestamp(),
            targetForm: targetForm || "unknown"
        });

        // 2. RTDBカウンター更新
        const today = new Date().toISOString().split('T')[0];
        const totalRef = rtdb.ref('stats/totalCount');
        const todayRef = rtdb.ref(`stats/dailyCounts/${today}`);

        await Promise.all([
            totalRef.transaction((curr) => (curr || 0) + 1),
            todayRef.transaction((curr) => (curr || 0) + 1)
        ]);

        return { success: true };
    } catch (error) {
        console.error("Log Submission Error:", error);
        throw new HttpsError('internal', 'ログ保存に失敗しました。');
    }
});

// --- 6. 生成されたラジオネームの自動保存をサーバーで行う ---
exports.saveRadioName = onCall({ region: "asia-northeast2" }, async (request) => {
    let uid = "unknown";
    try {
        uid = await getAuthenticatedUid(request);
    } catch (e) { /* ignore */ }

    const { name, region, userAgent } = request.data;

    try {
        await hirusupaDb.collection("radio_names").add({
            uid,
            name,
            region: region || "unknown",
            userAgent: userAgent || "unknown",
            createdAt: FieldValue.serverTimestamp()
        });
        return { success: true };
    } catch (error) {
        console.error("Save Radio Name Error:", error);
        throw new HttpsError('internal', 'ラジオネームの保存に失敗しました。');
    }
});

// --- 7. ユーザーの現在の残高を取得する ---
exports.getUserBalance = onCall({ region: "asia-northeast2" }, async (request) => {
    const uid = await getAuthenticatedUid(request);

    try {
        const userDoc = await usersDb.collection("users").doc(uid).get();
        const balance = userDoc.exists ? (userDoc.data().balance || 0) : 0;
        return { balance };
    } catch (error) {
        console.error("Get User Balance Error:", error);
        throw new HttpsError('internal', '残高の取得に失敗しました。');
    }
});