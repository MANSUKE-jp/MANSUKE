/**
 * functions/index.js — Cloud Functions entry point
 * All functions are imported and exported from their respective modules.
 */

const { setGlobalOptions } = require("firebase-functions/v2");

// Set Tokyo as the default deployment region
setGlobalOptions({ region: "asia-northeast2" });

const { checkEmailUnique, checkPhoneUnique, createAccount, changePassword, linkGoogle, unlinkGoogle, deleteUnlinkedGoogleUser } = require('./auth');
const { registerPasskeyChallenge, verifyPasskeyRegistration, getPasskeyAuthChallenge, verifyPasskeyAuth, deletePasskey, renamePasskey } = require('./passkey');
const { diditWebhook, createDiditSession } = require('./didit');
const { updateEmail, updatePhone, updateNickname } = require('./profile');
const { redeemCard } = require('./redeem');
const { verifyMansukeToken } = require('./tokenVerification');
const { processPayment, refundPayment } = require('@mansuke/shared/functions/payment.js');

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

    // Redeem
    redeemCard,

    // Payment Processing (Unified)
    processPayment,
    refundPayment,

    // Auth Tools
    mymansukeVerifyMansukeToken: verifyMansukeToken,
};
