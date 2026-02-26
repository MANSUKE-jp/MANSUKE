/**
 * Import function triggers from their respective submodules:
 *
 * const {onCall} = require("firebase-functions/v2/https");
 * const {onDocumentWritten} = require("firebase-functions/v2/firestore");
 *
 * See a full list of supported triggers at https://firebase.google.com/docs/functions
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

// 大阪リージョン (asia-northeast2) を指定
setGlobalOptions({ region: "asia-northeast2" });

// Appを初期化し、そのインスタンスを受け取る
const app = initializeApp();

// 各データベースへの参照を取得
const db = getFirestore(app, 'prepaid-card');
const codeHubDb = getFirestore(app, 'code-hub');

// --- 既存の関数 ---
exports.activatePrepaidCard = onCall(async (request) => {
    // 1. デバッグログ: 関数が呼び出されたことを記録
    console.log("【Function Start】activatePrepaidCard called");
    // ※個人情報が含まれる場合はログ運用に注意してください
    console.log("Request Data Keys:", Object.keys(request.data || {}));
    console.log("Auth Data Uid:", request.auth ? request.auth.uid : 'anonymous');

    try {
        const { docId, amount, userPin, customerSignature, employeeSignature } = request.data;
        const operatorId = request.auth ? request.auth.uid : 'anonymous';

        // バリデーションチェックのログ
        if (!docId) throw new HttpsError("invalid-argument", "カードID(docId)がありません。");
        if (!amount) throw new HttpsError("invalid-argument", "金額(amount)がありません。");

        // DB操作開始ログ
        console.log(`Starting transaction for docId: ${docId}`);

        const result = await db.runTransaction(async (transaction) => {
            const cardRef = db.collection("cards").doc(docId);
            const cardDoc = await transaction.get(cardRef);

            if (!cardDoc.exists) {
                console.error(`Card not found: ${docId}`);
                throw new HttpsError("not-found", "カードが見つかりません。");
            }

            const cardData = cardDoc.data();
            console.log("Current Card Status:", cardData.status); // 現在のステータス確認

            if (cardData.status !== 'inactive') {
                throw new HttpsError("failed-precondition", `ステータス不正: ${cardData.status}`);
            }

            // 数値型への変換を確実に行う
            transaction.update(cardRef, {
                status: 'active',
                amount: Number(amount),
                userPin: String(userPin),
                customerSignature: customerSignature,
                employeeSignature: employeeSignature || null,
                activatedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                activatedBy: operatorId,
            });

            return {
                success: true,
                message: "有効化完了",
                amount: amount
            };
        });

        console.log("Transaction success!");
        return result;

    } catch (error) {
        // 2. エラー詳細をサーバーログに出力（重要：これがFirebase Consoleで見れます）
        console.error("【Function Error Detail】:", error);

        // クライアントにはHttpsErrorとして返すことで、INTERNALではなく具体的なエラーコードを返す
        if (error instanceof HttpsError) {
            throw error;
        }
        // 想定外のエラーもメッセージ付きで返す
        throw new HttpsError("internal", "サーバー内部エラーが発生しました: " + error.message);
    }
});

// --- 新規追加: カード一括インポート関数 ---
exports.importCards = onCall(async (request) => {
    console.log("【Function Start】importCards called");

    // 管理者権限チェック（必要に応じて有効化してください）
    // if (!request.auth) {
    //     throw new HttpsError('unauthenticated', '認証が必要です。');
    // }

    const { cards } = request.data;
    if (!cards || !Array.isArray(cards)) {
        throw new HttpsError("invalid-argument", "カードデータ(cards)が配列形式で必要です。");
    }

    console.log(`Processing batch of ${cards.length} cards...`);

    const batch = db.batch();
    const hubBatch = codeHubDb.batch();
    let successCount = 0;
    let skippedCount = 0;

    try {
        // 重複チェックのために既存データをクエリ
        // 注意: 大量のデータを一度にチェックするのはコストがかかるため、ループ内で効率的に処理します

        for (const card of cards) {
            const { publicCode, pinCode } = card;

            // 簡易重複チェック
            // ※厳密なチェックはトランザクションが必要ですが、一括登録のパフォーマンスを優先し
            // ここでは読み取り後の書き込み（Race Conditionのリスクは許容）とします。
            const existingPublic = await db.collection('cards')
                .where('publicCode', '==', publicCode).limit(1).get();

            const existingPin = await db.collection('cards')
                .where('pinCode', '==', pinCode).limit(1).get();

            if (!existingPublic.empty || !existingPin.empty) {
                skippedCount++;
                continue;
            }

            // 1. prepaid-card への登録
            const newCardRef = db.collection('cards').doc();
            batch.set(newCardRef, {
                publicCode: publicCode,
                pinCode: pinCode,
                status: 'inactive',
                amount: 0,
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                importedBy: request.auth ? request.auth.uid : 'system'
            });

            // 2. code-hub への登録
            const newHubRef = codeHubDb.collection('directory').doc();
            hubBatch.set(newHubRef, {
                publicCode: publicCode,
                targetDatabase: 'prepaid-card',
                createdAt: FieldValue.serverTimestamp()
            });

            successCount++;
        }

        if (successCount > 0) {
            await batch.commit();
            await hubBatch.commit();
        }

        console.log(`Batch finished. Success: ${successCount}, Skipped: ${skippedCount}`);

        return {
            success: true,
            successCount,
            skippedCount
        };

    } catch (error) {
        console.error("Import Error:", error);
        throw new HttpsError("internal", "インポート中にエラーが発生しました:" + error.message);
    }
}); 1