import Papa from 'papaparse';
import { functions } from '../config/firebase';
import { httpsCallable } from 'firebase/functions';

/**
 * CSVファイルを解析する
 * @param {File} file 
 * @returns {Promise<Array>} 解析されたデータ配列
 */
export const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) {
                    reject(results.errors);
                } else {
                    resolve({
                        data: results.data,
                        headers: results.meta.fields
                    });
                }
            },
            error: (error) => reject(error)
        });
    });
};

/**
 * Firestoreへ一括登録する（Cloud Functions経由）
 * * @param {Array} data CSVデータ
 * @param {Object} mapping カラムマッピング { publicCode: 'header1', pinCode: 'header2' }
 * @param {Function} onProgress 進捗コールバック
 */
export const uploadPrepaidCards = async (data, mapping, onProgress) => {
    // Cloud Functions はペイロード制限（10MB等）やタイムアウトがあるため、
    // クライアント側で適切なサイズに分割して送信します。
    // 処理の重さを考慮して、バッチサイズは少し控えめに設定します。
    const BATCH_SIZE = 200;
    const total = data.length;
    let processed = 0;
    let totalSkipped = 0;
    let totalSuccess = 0;

    // データをチャンクに分割
    const chunks = [];
    for (let i = 0; i < total; i += BATCH_SIZE) {
        chunks.push(data.slice(i, i + BATCH_SIZE));
    }

    // Cloud Functions の関数参照を取得
    const importCardsFunction = httpsCallable(functions, 'importCards');

    for (const chunk of chunks) {
        // 必要なデータのみ抽出して軽量化
        const payload = chunk.map(row => ({
            publicCode: String(row[mapping.publicCode] || '').trim(),
            pinCode: String(row[mapping.pinCode] || '').trim()
        })).filter(item => item.publicCode && item.pinCode);

            if (payload.length > 0) {
                // Cloud Functions 呼び出し
                const result = await importCardsFunction({ cards: payload });

                const { successCount, skippedCount } = result.data;
                totalSuccess += successCount;
                totalSkipped += skippedCount;


            }

            processed += chunk.length;
            if (onProgress) onProgress(Math.round((processed / total) * 100));
        }


        return { success: true, count: totalSuccess, skipped: totalSkipped };

};