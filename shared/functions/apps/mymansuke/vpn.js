const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");
const axios = require('axios');
const crypto = require('crypto');
const { internalCreateSubscription, internalCancelSubscription } = require('../../payment.js');

if (!admin.apps.length) admin.initializeApp();
const db = getFirestore("users");

// WireGuard Easy APIの設定
const WG_HOST = 'vpn.mansuke.jp';
const WG_PORT = '80';
const WG_PASSWORD = 'mansuke_wg_api_pass_2026';
const WG_API_URL = `http://${WG_HOST}:${WG_PORT}/api`;

// フロント認証とMANSUKEトークン認証の両方に対応した認証UID取得ヘルパー
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
            console.error("Firebaseによるトークン検証失敗。APIによる検証を試みます...", error.message);
            try {
                const response = await axios.get('https://my.mansuke.jp/api/verifyMansukeToken', {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (response.data && response.data.uid) {
                    return response.data.uid;
                }
            } catch (apiError) {
                console.error("API検証失敗:", apiError.message);
            }
        }
    }
    throw new HttpsError('unauthenticated', '認証が必要です。');
}

// wg-easy APIに認証してセッションCookieを取得するヘルパー
async function getWgAuthCookie() {
    try {
        const response = await axios.post(`${WG_API_URL}/session`, {
            password: WG_PASSWORD
        }, { timeout: 8000 });
        
        // connect.sid Cookieを取り出す
        const cookies = response.headers['set-cookie'];
        if (cookies && cookies.length > 0) {
            return cookies[0].split(';')[0];
        }
        throw new Error("No session cookie returned");
    } catch (error) {
        console.error("WireGuard API認証失敗:", error.message, error.response?.data, error.code);
        if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
            throw new HttpsError('unavailable', 'VPNサーバー本体が現在応答していません。時間をおいて再度お試しください。');
        }
        throw new HttpsError('internal', 'VPNサーバーとの通信に失敗しました。');
    }
}

// 1. VPNデバイスを登録する
// サブスクリプション作成後、wg-easyにクライアントを登録する。
exports.registerVpnDevice = onCall({ invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { deviceName } = request.data;
    
    if (!deviceName || deviceName.trim().length === 0 || deviceName.length > 10) {
         throw new HttpsError('invalid-argument', 'デバイス名は1文字以上10文字以内で入力してください。');
    }

    // wg-easyは包クライアント名を強制するため、
    // 同じデバイス名を使用した2人のユーザー間で競合しないようランダム文字列を付加する。
    const safeDeviceName = deviceName.trim().replace(/[^a-zA-Z0-9_\-]/g, '_');
    const randomSuffix = crypto.randomBytes(3).toString('hex'); // 6文字のランダム文字列
    const wgClientName = `${safeDeviceName.substring(0, 15)}_${uid.substring(0, 4)}_${randomSuffix}`;

    try {
        // ステップ1: サブスクリプションを作成する（300円/月）
        const subResult = await internalCreateSubscription(uid, 300, 'mansuke_vpn', `[VPN] ${deviceName}`, 'month');
        const subId = subResult.subId;
        
        try {
            // ステップ2: wg-easyに認証する
            const cookie = await getWgAuthCookie();

            // ステップ3: wg-easyにクライアントを作成する
            await axios.post(`${WG_API_URL}/wireguard/client`, {
                name: wgClientName
            }, {
                headers: { 'Cookie': cookie },
                timeout: 8000
            });
            
            // ステップ3.5: 新規作成クライアントのIDを取得するためクライアント一覧を取得
            const clientsResponse = await axios.get(`${WG_API_URL}/wireguard/client`, {
                headers: { 'Cookie': cookie },
                timeout: 8000
            });
            const newClient = clientsResponse.data.find(c => c.name === wgClientName);
            
            if (!newClient || !newClient.id) {
                throw new Error("Failed to retrieve the new VPN client ID from the server");
            }
            
            // ステップ4: /users/{uid}/vpn/{deviceId}にFirestoreにメタデータを保存する
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
             // ロールバック: 作成したサブスクリプションをキャンセルする
             try {
                 await internalCancelSubscription(uid, subId);
             } catch (cancelError) {
                 console.error("サブスクリプションのロールバック失敗:", cancelError.message);
             }
             
             throw wgError; // 外側のcatchブロックに淘り上げる
        }

    } catch (error) {
        console.error("Error registering VPN device:", error);
        
        // サブスクリプションサービスからの既知のエラー（残高不足など）はそのまま渡す
        if (error instanceof HttpsError) {
             throw error;
        }
        
        throw new HttpsError('internal', `VPNデバイスの登録中にエラーが発生しました: ${error.message || '不明なエラー'}`);
    }
});

// 2. VPNデバイスを削除する
// サブスクリプションをキャンセルし、wg-easyからクライアントを削除し、Firestoreからも削除する。
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
        
        // ステップ1: サブスクリプションをキャンセルする
        if (vpnData.subscriptionId) {
            try {
                await internalCancelSubscription(uid, vpnData.subscriptionId);
            } catch (cancelError) {
                 console.warn("サブスクリプションキャンセル警告:", cancelError.message);
                 // サブスクリプションキャンセルが失敗しても続行する（そもそもキャンセル済みの場合など）
            }
        }
        
        // ステップ2: Firestoreのステータスを'canceled'に更新してタイムスタンプを記録する。
        // wg-easyからは即座にクライアントを削除しない。サブスクリプションが切れるまで引き続き利用可能気。
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

// 3. ユーザーの全VPNデバイスを削除する
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

// 4. VPN構成詳細を取得する
// wg-easyから構成を取得してパースする。
exports.getVpnConfig = onCall({ invoker: "public" }, async (request) => {
    const uid = await getAuthenticatedUid(request);
    const { deviceId } = request.data;

    if (!deviceId) {
        throw new HttpsError('invalid-argument', 'デバイスIDが指定されていません。');
    }

    try {
        // まず所有権を確認する
        const vpnDoc = await db.collection('users').doc(uid).collection('vpn').doc(deviceId).get();
        if (!vpnDoc.exists) {
            throw new HttpsError('permission-denied', 'このデバイスへアクセスする権限がありません。');
        }
        
        const deviceName = vpnDoc.data().deviceName;

        const cookie = await getWgAuthCookie();
        
        // wg-easyから生の構成ファイルストリームを取得する
        const response = await axios.get(`${WG_API_URL}/wireguard/client/${deviceId}/configuration`, {
             headers: { 'Cookie': cookie },
             responseType: 'text',
             timeout: 8000
        });
        
        const rawConfig = response.data;
        
        // 生のWireGuard .confファイルをパースする
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
