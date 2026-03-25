// MAN02 — Cloud Functionsエントリーポイント

const { verifyMansukeToken } = require('./tokenVerification');
const { man02GetAllowedUids, man02AddAllowedUid, man02RemoveAllowedUid } = require('./accessControl');
const { man02ToggleSpoofing, man02UpdateSpoofedLocation, man02ToggleSharing } = require('./locationControl');

module.exports = {
    // SSO
    man02VerifyMansukeToken: verifyMansukeToken,

    // アクセス制御
    man02GetAllowedUids,
    man02AddAllowedUid,
    man02RemoveAllowedUid,

    // 位置情報制御
    man02ToggleSpoofing,
    man02UpdateSpoofedLocation,
    man02ToggleSharing,
};
