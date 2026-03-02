/**
 * Unified Cloud Functions entry point for all MANSUKE apps.
 */

const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// Set Tokyo as the default deployment region globally
setGlobalOptions({ region: "asia-northeast2", maxInstances: 10 });

// Admin SDKの初期化（コールドスタート対策で重複初期化防止）
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// Import all app-specific functions
const hirusupa = require("./apps/hirusupa");
const werewolf = require("./apps/werewolf");
const mymansuke = require("./apps/mymansuke");
const staff = require("./apps/staff");

// Export all functions
module.exports = {
    ...hirusupa,
    ...werewolf,
    ...mymansuke,
    ...staff,
};
