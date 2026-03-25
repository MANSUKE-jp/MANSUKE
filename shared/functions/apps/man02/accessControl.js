// MAN02 アクセス制御 Cloud Functions
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

// ホワイトリスト取得
exports.man02GetAllowedUids = onCall(async (request) => {
    await verifyStaff(request.auth.uid);
    const doc = await getMan02Db().collection('config').doc('access').get();
    if (!doc.exists) return { allowedUids: [] };
    return { allowedUids: doc.data().allowedUids || [] };
});

// UIDをホワイトリストに追加
exports.man02AddAllowedUid = onCall(async (request) => {
    await verifyStaff(request.auth.uid);
    const { uid } = request.data;
    if (!uid || typeof uid !== 'string') {
        throw new HttpsError('invalid-argument', 'UIDを指定してください');
    }
    await getMan02Db().collection('config').doc('access').set({
        allowedUids: FieldValue.arrayUnion(uid),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
});

// UIDをホワイトリストから削除
exports.man02RemoveAllowedUid = onCall(async (request) => {
    await verifyStaff(request.auth.uid);
    const { uid } = request.data;
    if (!uid || typeof uid !== 'string') {
        throw new HttpsError('invalid-argument', 'UIDを指定してください');
    }
    await getMan02Db().collection('config').doc('access').set({
        allowedUids: FieldValue.arrayRemove(uid),
        updatedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return { success: true };
});
