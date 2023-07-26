// @ts-check

var db = require('./database');

const MENU_BUTTON_GOTO   = "MenuButtonGoto";
const MENU_BUTTON_ACTION = "MenuButtonAction";

const ACTION_INVALID = 'none';

/** @type {{ [userID: number]: { menu: string, menuArgs: string[], action: string, actionArgs?: any } }} */
var WalletUsersState = {};

module.exports.MENU_BUTTON_GOTO   = MENU_BUTTON_GOTO;
module.exports.MENU_BUTTON_ACTION = MENU_BUTTON_ACTION;
module.exports.ACTION_INVALID = ACTION_INVALID;
module.exports.getUserMenu = getUserMenu;
module.exports.setUserMenu = setUserMenu;
module.exports.getUserMenuArgs = getUserMenuArgs;
module.exports.getUserAction = getUserAction;
module.exports.setUserAction = setUserAction;
module.exports.clearUserAction = clearUserAction;
module.exports.getUserActionArgs = getUserActionArgs;
module.exports.setUserActionArgs = setUserActionArgs;

module.exports.findUserInvite = findUserInvite;

function checkUserState(userID) {
    if (!WalletUsersState[userID]) {
        WalletUsersState[userID] = { menu: 'main', menuArgs: [], action: ACTION_INVALID };
    }
}

/**
 * @param {number} userID 
 */
function getUserMenu(userID) {
    checkUserState(userID);
    return WalletUsersState[userID].menu;
}
/**
 * @param {number} userID 
 * @param {string} menu 
 * @param {string[]} [args] 
 */
function setUserMenu(userID, menu, args) {
    checkUserState(userID);
    WalletUsersState[userID].menu = menu;
    WalletUsersState[userID].menuArgs = args ? args : [];
}
/**
 * @param {number} userID 
 */
function getUserMenuArgs(userID) {
    checkUserState(userID);
    return WalletUsersState[userID].menuArgs;
}

/**
 * @param {number} userID 
 */
function getUserAction(userID) {
    checkUserState(userID);
    return WalletUsersState[userID].action;
}
/**
 * @param {number} userID 
 * @param {string} action 
 */
function setUserAction(userID, action) {
    checkUserState(userID);
    WalletUsersState[userID].action = action;
    delete WalletUsersState[userID].actionArgs;
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
    checkUserState(userID);
    return WalletUsersState[userID].actionArgs;
}
/**
 * @param {number} userID 
 * @param {any} args 
 */
function setUserActionArgs(userID, args) {
    checkUserState(userID);
    if (WalletUsersState[userID].action != ACTION_INVALID) {
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