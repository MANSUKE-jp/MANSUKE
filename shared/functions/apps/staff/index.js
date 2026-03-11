/**
 * MANSUKE Staff Console — Cloud Functions entry point
 */

const { staffSearchCards, staffGetCardDetail, staffUpdateCardBalance, staffToggleCardStatus, staffVerifyPrepaidCardCode, activatePrepaidCard, importCards } = require('./cards');
// Users
const { staffSearchUsers, staffGetUserDetail, staffAdjustBalance, staffUpdateUserProfile, staffDeleteAvatarUrl, staffDeleteVpnDevice } = require('./users');
const { verifyMansukeToken } = require('./tokenVerification');

module.exports = {
    // Cards
    staffSearchCards,
    staffGetCardDetail,
    staffUpdateCardBalance,
    staffToggleCardStatus,
    staffVerifyPrepaidCardCode,
    activatePrepaidCard,
    importCards,

    // User Management
    staffSearchUsers,
    staffGetUserDetail,
    staffAdjustBalance,
    staffUpdateUserProfile,
    staffDeleteAvatarUrl,
    staffDeleteVpnDevice,

    // SSO
    staffVerifyMansukeToken: verifyMansukeToken,
};
