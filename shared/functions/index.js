// 全MANSUKEアプリのCloud Functions統合エントリーポイント

const { setGlobalOptions } = require("firebase-functions/v2");
const admin = require("firebase-admin");

// デプロイリージョンを大阪にグローバル設定する
setGlobalOptions({ region: "asia-northeast2", maxInstances: 10 });

// Admin SDKの初期化（コールドスタート対策で重複初期化防止）
if (admin.apps.length === 0) {
    admin.initializeApp();
}

// 各アプリの関数をインポート
const hirusupa = require("./apps/hirusupa");
const werewolf = require("./apps/werewolf");
const mymansuke = require("./apps/mymansuke");
const staff = require("./apps/staff");
const man02 = require("./apps/man02");
const keyboard = require("./apps/keyboard");

// 全関数をエクスポート
module.exports = {
    ...hirusupa,
    ...werewolf,
    ...mymansuke,
    ...staff,
    ...man02,
    ...keyboard,
};
