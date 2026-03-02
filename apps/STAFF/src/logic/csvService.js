import Papa from 'papaparse';
import { functions } from '../firebase';
import { httpsCallable } from 'firebase/functions';

export const parseCSV = (file) => {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                if (results.errors.length > 0) reject(results.errors);
                else resolve({ data: results.data, headers: results.meta.fields });
            },
            error: (error) => reject(error)
        });
    });
};

export const uploadPrepaidCards = async (data, mapping, onProgress) => {
    const BATCH_SIZE = 200;
    const total = data.length;
    let processed = 0, totalSkipped = 0, totalSuccess = 0;
    const chunks = [];
    for (let i = 0; i < total; i += BATCH_SIZE) chunks.push(data.slice(i, i + BATCH_SIZE));
    const importCardsFunction = httpsCallable(functions, 'importCards');

    for (const chunk of chunks) {
        const payload = chunk.map(row => ({
            publicCode: String(row[mapping.publicCode] || '').trim(),
            pinCode: String(row[mapping.pinCode] || '').trim()
        })).filter(item => item.publicCode && item.pinCode);

        if (payload.length > 0) {
            const result = await importCardsFunction({ cards: payload });
            totalSuccess += result.data.successCount;
            totalSkipped += result.data.skippedCount;
        }
        processed += chunk.length;
        if (onProgress) onProgress(Math.round((processed / total) * 100));
    }
    return { success: true, count: totalSuccess, skipped: totalSkipped };
};
