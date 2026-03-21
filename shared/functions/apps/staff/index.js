// MANSUKEスタッフコンソール — Cloud Functionsエントリーポイント

const { staffSearchCards, staffGetCardDetail, staffUpdateCardBalance, staffToggleCardStatus, staffVerifyPrepaidCardCode, activatePrepaidCard, importCards } = require('./cards');
// ユーザー管理
const { staffSearchUsers, staffGetUserDetail, staffAdjustBalance, staffUpdateUserProfile, staffDeleteAvatarUrl, staffDeleteVpnDevice, staffResumeVpnDevice } = require('./users');
const { verifyMansukeToken } = require('./tokenVerification');

module.exports = {
    // カード
    staffSearchCards,
    staffGetCardDetail,
    staffUpdateCardBalance,
    staffToggleCardStatus,
    staffVerifyPrepaidCardCode,
    activatePrepaidCard,
    importCards,

    // ユーザー管理
    staffSearchUsers,
    staffGetUserDetail,
    staffAdjustBalance,
    staffUpdateUserProfile,
    staffDeleteAvatarUrl,
    staffDeleteVpnDevice,
    staffResumeVpnDevice,

    // SSO
    staffVerifyMansukeToken: verifyMansukeToken,
};
