const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require('axios');
const crypto = require('crypto');
const { internalCreateSubscription, internalCancelSubscription } = require('../../payment.js');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore("users");

// Configuration for WireGuard Easy API
const WG_HOST = 'vpn.mansuke.jp';
const WG_PORT = '80';
const WG_PASSWORD = 'mansuke_wg_api_pass_2026';
const WG_API_URL = `http://${WG_HOST}:${WG_PORT}/api`;

// Helper function to get authenticated UID from request (supports frontend auth & mansuke token)
async function getAuthenticatedUid(request) {
    if (request.auth && request.auth.uid) {
        return request.auth.uid;
    }

    const token = request.data?.token || request.rawRequest?.headers?.authorization?.split('Bearer ')[1];
    if (token) {
        try {
            const decodedToken = await admin.auth().verifyIdToken(token);
            if (decodedToken && decodedToken.uid) {
                return decodedToken.uid;
            }
        } catch (error) {
            console.error("Token verification failed natively. Checking via API...", error.message);
            try {
                const response = await axios.get('https://my.mansuke.jp/api/verifyMansukeToken', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data && response.data.uid) {
                    return response.data.uid;
                }
            } catch (apiError) {
                console.error("API verification failed:", apiError.message);
            }
        }
    }
    throw new HttpsError('unauthenticated', '認証が必要です。');
}

// Helper to authenticate with wg-easy API and get session cookie
async function getWgAuthCookie() {
    try {
        const response = await axios.post(`${WG_API_URL}/session`, {
            password: WG_PASSWORD
        }, { timeout: 8000 });
        
        // Extract the connect.sid cookie
        const cookies = response.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
            return cookies[0].split(';')[0];
        }
        throw new Error("No session cookie returned");
    } catch (error) {
        console.error("Failed to authenticate with WireGuard API:", error.message, error.response?.data, error.code);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new HttpsError('unavailable', 'VPNサーバー本体が現在応答していません。時間をおいて再度お試しください。');
        }
        throw new HttpsError('internal', 'VPNサーバーとの通信に失敗しました。');
    }
}

/**
 * 1. Register a new VPN device
 * This function triggers the payment (subscription creation), then creates the client in wg-easy.
 */
exports.registerVpnDevice = onCall({ invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { deviceName } = request.data;
    
    if (!deviceName || deviceName.trim().length === 0 || deviceName.length > 10) {
         throw new HttpsError('invalid-argument', 'デバイス名は1文字以上10文字以内で入力してください。');
    }

    // Prepare a unique name for wg-easy. Since wg-easy enforces unique client names,
    // we must append a random short string to prevent conflicts if two users use the same device name.
    const safeDeviceName = deviceName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const randomSuffix = crypto.randomBytes(3).toString('hex'); // 6 random characters
    const wgClientName = `${safeDeviceName.substring(0, 15)}_${uid.substring(0, 4)}_${randomSuffix}`;

    try {
        // Step 1: Create a subscription (₹200/month) using direct function call
        const subResult = await internalCreateSubscription(uid, 200, 'mansuke_vpn', `[VPN] ${deviceName}`, 'month');
        const subId = subResult.subId;
        
        try {
            // Step 2: Authenticate with wg-easy
            const cookie = await getWgAuthCookie();

            // Step 3: Create client in wg-easy
            await axios.post(`${WG_API_URL}/wireguard/client`, {
                name: wgClientName
            }, {
                headers: { 'Cookie': cookie },
                timeout: 8000
            });
            
            // Step 3.5: Fetch clients to get the ID of the newly created client
            const clientsResponse = await axios.get(`${WG_API_URL}/wireguard/client`, {
                headers: { 'Cookie': cookie },
                timeout: 8000
            });
            const newClient = clientsResponse.data.find(c => c.name === wgClientName);
            
            if (!newClient || !newClient.id) {
                throw new Error("Failed to retrieve the new VPN client ID from the server");
            }
            
            // Step 4: Save metadata to Firestore under /users/{uid}/vpn/{deviceId}
            const vpnRef = db.collection('users').doc(uid).collection('vpn').doc(newClient.id);
            
            await vpnRef.set({
                wgClientId: newClient.id,
                deviceName: deviceName,
                wgClientName: wgClientName,
                subscriptionId: subId,
                status: 'active',
                createdAt: FieldValue.serverTimestamp()
            });

            return { success: true, deviceId: newClient.id, message: "デバイスが登録されました。" };

        } catch (wgError) {
             // Rollback: cancel the subscription we just created
             try {
                 await internalCancelSubscription(uid, subId);
             } catch (cancelError) {
                 console.error("Failed to rollback subscription:", cancelError.message);
             }
             
             throw wgError; // re-throw to be caught by the outer catch block
        }

    } catch (error) {
        console.error("Error registering VPN device:", error);
        
        // If it's a known error from our subscription service (like insufficient funds), pass it along
        if (error instanceof HttpsError) {
             throw error;
        }
        
        throw new HttpsError('internal', `VPNデバイスの登録中にエラーが発生しました: ${error.message || '不明なエラー'}`);
    }
});

/**
 * 2. Delete a VPN device
 * Cancels the subscription, deletes the client from wg-easy, and removes it from Firestore.
 */
exports.deleteVpnDevice = onCall({ invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { deviceId } = request.data;
    
    if (!deviceId) {
        throw new HttpsError('invalid-argument', 'デバイスIDが指定されていません。');
    }
    
    const vpnRef = db.collection('users').doc(uid).collection('vpn').doc(deviceId);

    try {
        const vpnDoc = await vpnRef.get();
        if (!vpnDoc.exists) {
            throw new HttpsError('not-found', 'デバイスが見つかりません。');
        }
        
        const vpnData = vpnDoc.data();
        
        // Step 1: Cancel subscription
        if (vpnData.subscriptionId) {
            try {
                await internalCancelSubscription(uid, vpnData.subscriptionId);
            } catch (cancelError) {
                 console.warn("Subscription cancellation warning:", cancelError.message);
                 // We continue even if the subscription cancel fails (e.g. it might already be cancelled)
            }
        }
        
        // Step 2: Update status in firestore to 'canceled' and record the timestamp.
        // We do NOT delete the client from wg-easy here. It will run until the subscription expires.
        await vpnRef.update({
             status: 'canceled',
             canceledAt: FieldValue.serverTimestamp()
        });
        
        return { success: true, message: "解約を受け付けました。現在の契約期間が終了するまでご利用いただけます。" };
    } catch (error) {
         console.error("Error deleting VPN device:", error);
         if (error instanceof HttpsError) throw error;
         throw new HttpsError('internal', 'デバイスの削除中にエラーが発生しました。');
    }
});

/**
 * 3. Delete all VPN devices for a user
 */
exports.deleteAllVpnDevices = onCall({ invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    
    try {
        const snap = await db.collection('users').doc(uid).collection('vpn').get();
        const deletePromises = [];
        
        snap.forEach(doc => {
            const req = {
                auth: { uid },
                data: { deviceId: doc.id }
            };
            deletePromises.push(exports.deleteVpnDevice.run(req));
        });
        
        await Promise.all(deletePromises);
        return { success: true, message: "すべてのデバイスが削除されました。" };
        
    } catch(error) {
        console.error("Error deleting all VPN devices:", error);
         if (error instanceof HttpsError) throw error;
         throw new HttpsError('internal', 'すべてのデバイスの削除中にエラーが発生しました。');
    }
});

/**
 * 4. Get VPN Config details (IKEv2 style text representation)
 * We fetch the configuration from wg-easy and parse it.
 */
exports.getVpnConfig = onCall({ invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { deviceId } = request.data;

    if (!deviceId) {
        throw new HttpsError('invalid-argument', 'デバイスIDが指定されていません。');
    }

    try {
        // First verify ownership
        const vpnDoc = await db.collection('users').doc(uid).collection('vpn').doc(deviceId).get();
        if (!vpnDoc.exists) {
            throw new HttpsError('permission-denied', 'このデバイスへアクセスする権限がありません。');
        }
        
        const deviceName = vpnDoc.data().deviceName;

        const cookie = await getWgAuthCookie();
        
        // We get the raw config file stream from wg-easy
        const response = await axios.get(`${WG_API_URL}/wireguard/client/${deviceId}/configuration`, {
             headers: { 'Cookie': cookie },
             responseType: 'text',
             timeout: 8000
        });
        
        const rawConfig = response.data;
        
        // Parse the raw WireGuard .conf file
        const extractField = (regex, defaultVal = '') => {
            const match = rawConfig.match(regex);
            return match ? match[1].trim() : defaultVal;
        };
        
        const privateKey = extractField(/PrivateKey\s*=\s*(.+)/);
        const address = extractField(/Address\s*=\s*(.+)/);
        const dns = extractField(/DNS\s*=\s*(.+)/, '1.1.1.1');
        const publicKey = extractField(/PublicKey\s*=\s*(.+)/);
        const endpoint = extractField(/Endpoint\s*=\s*(.+)/);
        const allowedIPs = extractField(/AllowedIPs\s*=\s*(.+)/, '0.0.0.0/0, ::/0');

        return {
            success: true,
            config: {
                rawWireguardConfig: rawConfig,
                privateKey,
                address,
                dns,
                publicKey,
                endpoint,
                allowedIPs,
                deviceName: deviceName
            }
        };

    } catch (error) {
         console.error("Error fetching VPN config:", error);
         if (error instanceof HttpsError) throw error;
         throw new HttpsError('internal', 'VPN構成の取得に失敗しました。');
    }
});
