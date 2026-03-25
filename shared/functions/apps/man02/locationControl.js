// MAN02 位置情報制御 Cloud Functions
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");
if (!admin.apps.length) admin.initializeApp();
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const getMan02Db = () => getFirestore('man02');
const getUsersDb = () => getFirestore('users');

// スタッフ権限を確認するヘルパー
async function verifyStaff(uid) {
    const userDoc = await getUsersDb().collection('users').doc(uid).get();
    if (!userDoc.exists || !userDoc.data().isStaff) {
        throw new HttpsError('permission-denied', 'スタッフ権限が必要です');
    }
}

// 既存のドキュメントフィールドを保持しながら安全に更新するヘルパー
// update()はドキュメントが存在しない場合にエラーになるため、setにmergeを使い、
// 削除したいフィールドにはFirestore.FieldValue.delete()を使用する
async function safeUpdate(docRef, data) {
    await docRef.set(data, { merge: true });
}

// 位置情報の偽造を開始/停止
exports.man02ToggleSpoofing = onCall(async (request) => {
    await verifyStaff(request.auth.uid);
    const { isSpoofing, latitude, longitude } = request.data;

    const docRef = getMan02Db().collection('location').doc('current');
    const updateData = {
        isSpoofing: isSpoofing === true,
    };

    if (isSpoofing && latitude != null && longitude != null) {
        updateData.spoofedLatitude = latitude;
        updateData.spoofedLongitude = longitude;
        updateData.spoofedAt = FieldValue.serverTimestamp();
    }

    if (!isSpoofing) {
        updateData.spoofedLatitude = FieldValue.delete();
        updateData.spoofedLongitude = FieldValue.delete();
        updateData.spoofedAt = FieldValue.delete();
    }

    await safeUpdate(docRef, updateData);
    return { success: true };
});

// 位置情報とバッテリー残量の共有を開始/停止
exports.man02ToggleSharing = onCall(async (request) => {
    await verifyStaff(request.auth.uid);
    const { isSharing } = request.data;

    const docRef = getMan02Db().collection('location').doc('current');
    await safeUpdate(docRef, {
        isSharing: isSharing === true,
    });
    return { success: true };
});

// 偽造位置情報を更新
exports.man02UpdateSpoofedLocation = onCall(async (request) => {
    await verifyStaff(request.auth.uid);
    const { latitude, longitude } = request.data;

    if (latitude == null || longitude == null) {
        throw new HttpsError('invalid-argument', '緯度と経度を指定してください');
    }

    const docRef = getMan02Db().collection('location').doc('current');
    await safeUpdate(docRef, {
        spoofedLatitude: latitude,
        spoofedLongitude: longitude,
        spoofedAt: FieldValue.serverTimestamp(),
    });
    return { success: true };
});
