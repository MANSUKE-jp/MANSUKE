// functions/index.js — Cloud Functionsエントリーポイント
// 各モジュールから関数をインポートしてエクスポートする。

const { onCall } = require("firebase-functions/v2/https");
const admin = require("firebase-admin");

// Admin SDKの初期化
if (admin.apps.length === 0) {
    admin.initializeApp();
}

const { checkEmailUnique, checkPhoneUnique, createAccount, changePassword, linkGoogle, unlinkGoogle, deleteUnlinkedGoogleUser } = require('./auth');
const { registerPasskeyChallenge, verifyPasskeyRegistration, getPasskeyAuthChallenge, verifyPasskeyAuth, deletePasskey, renamePasskey } = require('./passkey');
const { diditWebhook, createDiditSession } = require('./didit');
const { updateEmail, updatePhone, updateNickname, updateAvatarUrl, deleteAvatarUrl, updateProfileFields } = require('./profile');
const { verifyMansukeToken } = require('./tokenVerification');
const { registerVpnDevice, deleteVpnDevice, deleteAllVpnDevices, getVpnConfig } = require('./vpn');
const { processPayment, refundPayment, redeemCard, createSubscription, cancelSubscription, processSubscriptions } = require('../../payment.js');
module.exports = {
    // 認証
    checkEmailUnique,
    checkPhoneUnique,
    createAccount,
    changePassword,
    linkGoogle,
    unlinkGoogle,
    deleteUnlinkedGoogleUser,

    // パスキー
    registerPasskeyChallenge,
    verifyPasskeyRegistration,
    getPasskeyAuthChallenge,
    verifyPasskeyAuth,
    deletePasskey,
    renamePasskey,

    // Didit KYC Webhook
    diditWebhook,
    createDiditSession,

    // プロフィール
    updateEmail,
    updatePhone,
    mymansukeUpdateNickname: updateNickname,
    mymansukeUpdateAvatarUrl: updateAvatarUrl,
    mymansukeDeleteAvatarUrl: deleteAvatarUrl,
    mymansukeUpdateProfileFields: updateProfileFields,

    // 怒月カード引う換え
    redeemCard,

    // 決済処理（統合）
    processPayment,
    refundPayment,
    createSubscription,
    cancelSubscription,
    processSubscriptions,

    // VPN API
    registerVpnDevice,
    deleteVpnDevice,
    deleteAllVpnDevices,
    getVpnConfig,

    // Webhook

    // 認証ツール
    mymansukeVerifyMansukeToken: verifyMansukeToken,
};
