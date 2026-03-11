/**
 * functions/index.js — Cloud Functions entry point
 * All functions are imported and exported from their respective modules.
 */

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
    // Auth
    checkEmailUnique,
    checkPhoneUnique,
    createAccount,
    changePassword,
    linkGoogle,
    unlinkGoogle,
    deleteUnlinkedGoogleUser,

    // Passkey
    registerPasskeyChallenge,
    verifyPasskeyRegistration,
    getPasskeyAuthChallenge,
    verifyPasskeyAuth,
    deletePasskey,
    renamePasskey,

    // Didit KYC Webhook
    diditWebhook,
    createDiditSession,

    // Profile
    updateEmail,
    updatePhone,
    mymansukeUpdateNickname: updateNickname,
    mymansukeUpdateAvatarUrl: updateAvatarUrl,
    mymansukeDeleteAvatarUrl: deleteAvatarUrl,
    mymansukeUpdateProfileFields: updateProfileFields,

    // Redeem
    redeemCard,

    // Payment Processing (Unified)
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

    // Webhooks

    // Auth Tools
    mymansukeVerifyMansukeToken: verifyMansukeToken,
};
