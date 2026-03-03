const { onRequest } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const logger = require("firebase-functions/logger");

// ──────────────────────────────────────────────
// Webhook endpoint for man-fi device registration (from Fillout)
// ──────────────────────────────────────────────
exports.manFiWebhook = onRequest({ cors: true, region: 'asia-northeast2' }, async (req, res) => {
    logger.info("Received man-fi webhook request", {
        body: req.body,
        query: req.query,
    });

    try {
        const payload = req.body;
        
        // 1. Check if the payload has the expected structure
        if (!payload || !payload.submission) {
            logger.warn("Received malformed webhook payload", { body: req.body });
            return res.status(400).send({ success: false, message: "Invalid payload structure" });
        }

        const submission = payload.submission;
        
        // 2. Extract UID
        // Check urlParameters in submission first
        const urlParams = submission.urlParameters || [];
        const uidParam = urlParams.find(p => p.id === 'uid' || p.name === 'uid');
        let uid = uidParam ? uidParam.value : null;

        // Fallback: If UID from body is null or missing, check URL query params. 
        // This handles cases where Fillout passes parameters directly in the Webhook URL.
        if (!uid && req.query && req.query.uid) {
            uid = req.query.uid;
        }

        if (!uid) {
            logger.error("No UID found in webhook payload or query.", { urlParameters: urlParams, query: req.query });
            return res.status(400).send({ success: false, message: "Missing UID in urlParameters or query" });
        }

        // 3. Extract Wi-Fi address (MAC address typically) from questions
        // Question name is "「man-fi」のWi-Fiアドレスを入力してください。" or similar. ID is "u18h" but let's be robust
        const questions = submission.questions || [];
        const wifiQuestion = questions.find(q => q.name && q.name.includes('Wi-Fiアドレス'));
        
        // Fallback to searching by ID if the name search fails
        const wifiAddress = wifiQuestion ? wifiQuestion.value : (questions.length > 0 ? questions[0].value : null);

        if (!wifiAddress) {
            logger.error("No Wi-Fi address found in webhook payload.", { questions });
            return res.status(400).send({ success: false, message: "Missing Wi-Fi address in questionnaire" });
        }

        // 4. Save to Firestore
        // Path: users/{uid}/man-fi/info
        // Format: { registeredMonth: "202603", devices: [...existingDevices, newDevice] }
        
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const registeredMonth = `${year}${month}`;

        const manFiRef = admin.firestore().collection('users').doc(uid).collection('man-fi').doc('info');
        
        await admin.firestore().runTransaction(async (transaction) => {
            const docSnap = await transaction.get(manFiRef);
            
            let devices = [];
            if (docSnap.exists) {
                const data = docSnap.data();
                devices = Array.isArray(data.devices) ? data.devices : [];
            }
            
            // Add the new Wi-Fi address if it's not already in the list
            if (!devices.includes(wifiAddress)) {
                devices.push(wifiAddress);
            }

            transaction.set(manFiRef, {
                registeredMonth: registeredMonth,
                devices: devices,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        });

        logger.info(`Successfully processed man-fi webhook for user ${uid}. Device: ${wifiAddress}`);
        res.status(200).send({ success: true, message: "Webhook processed successfully." });
    } catch (error) {
        logger.error("Error processing man-fi webhook", error);
        res.status(500).send({ success: false, error: error.message });
    }
});
