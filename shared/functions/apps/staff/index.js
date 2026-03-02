/**
 * MANSUKE Staff Console — Cloud Functions entry point
 */

const { staffSearchCards, staffGetCardDetail, staffUpdateCardBalance, staffToggleCardStatus, staffVerifyPrepaidCardCode, activatePrepaidCard, importCards } = require('./cards');
const { staffSearchUsers, staffGetUserDetail, staffAdjustBalance, staffUpdateUserProfile } = require('./users');
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

    // Users
    staffSearchUsers,
    staffGetUserDetail,
    staffAdjustBalance,
    staffUpdateUserProfile,

    // SSO
    staffVerifyMansukeToken: verifyMansukeToken,
};
