// @ts-check

var db = require('./database');

const MENU_BUTTON_GOTO   = "MenuButtonGoto";
const MENU_BUTTON_ACTION = "MenuButtonAction";

const ACTION_INVALID = 'none';

/** @type {{ [userID: number]: { menu: string, action: string, actionArgs?: any } }} */
var WalletUsersState = {};

module.exports.MENU_BUTTON_GOTO   = MENU_BUTTON_GOTO;
module.exports.MENU_BUTTON_ACTION = MENU_BUTTON_ACTION;
module.exports.ACTION_INVALID = ACTION_INVALID;
module.exports.getUserMenu = getUserMenu;
module.exports.setUserMenu = setUserMenu;
module.exports.getUserAction = getUserAction;
module.exports.setUserAction = setUserAction;
module.exports.clearUserAction = clearUserAction;
module.exports.getUserActionArgs = getUserActionArgs;
module.exports.setUserActionArgs = setUserActionArgs;

module.exports.findUserInvite = findUserInvite;

/**
 * @param {number} userID 
 */
function getUserMenu(userID) {
    if (!WalletUsersState[userID]) {
        return 'main';
    }
    return WalletUsersState[userID].menu;
}
/**
 * @param {number} userID 
 * @param {string} menu 
 */
function setUserMenu(userID, menu) {
    if (!WalletUsersState[userID]) {
        WalletUsersState[userID] = { menu: menu, action: ACTION_INVALID };
    } else {
        WalletUsersState[userID].menu = menu;
    }
}

/**
 * @param {number} userID 
 */
function getUserAction(userID) {
    if (!WalletUsersState[userID]) {
        return ACTION_INVALID;
    }
    return WalletUsersState[userID].action;
}
/**
 * @param {number} userID 
 * @param {string} action 
 */
function setUserAction(userID, action) {
    if (!WalletUsersState[userID]) {
        WalletUsersState[userID] = { menu: 'main', action: action };
    } else {
        WalletUsersState[userID].action = action;
        delete WalletUsersState[userID].actionArgs;
    }
}
/**
 * @param {number} userID 
 */
function clearUserAction(userID) {
    setUserAction(userID, ACTION_INVALID);
}

/**
 * @param {number} userID 
 */
function getUserActionArgs(userID) {
    return WalletUsersState[userID] ? WalletUsersState[userID].actionArgs : null;
}
/**
 * @param {number} userID 
 * @param {any} args 
 */
function setUserActionArgs(userID, args) {
    if (WalletUsersState[userID] && (WalletUsersState[userID].action != ACTION_INVALID)) {
        WalletUsersState[userID].actionArgs = args;
    }
}

/**
 * @param {number} userID 
 * @param {(inviteData: db.user_invite_data | null, error?: string) => any} callback 
 */
function findUserInvite(userID, callback) {
    db.invite_get(userID, (inviteData, error) => {
        if (error) {
            callback(null, error);
        } else if (!inviteData) {
            callback(null, `empty invite data`);
        } else if ((inviteData.expire_date.valueOf() > 0) && (inviteData.expire_date <= new Date())) {
            db.invite_delete(userID, (error) => {
                callback(null, `invite expired`);
            });
        } else {
            callback(inviteData);
        }
    });
}