// @ts-check

var db = require('./database');

const MENU_BUTTON_GOTO   = "MenuButtonGoto";
const MENU_BUTTON_ACTION = "MenuButtonAction";

const ACTION_INVALID = 'none';

/** @type {{ [userID: number]: { menu: string, menuArgs: string[], action: string, actionArgs: string[] } }} */
var WalletUsersState = {};

module.exports.MENU_BUTTON_GOTO   = MENU_BUTTON_GOTO;
module.exports.MENU_BUTTON_ACTION = MENU_BUTTON_ACTION;
module.exports.ACTION_INVALID = ACTION_INVALID;
module.exports.getUserMenu = getUserMenu;
module.exports.setUserMenu = setUserMenu;
module.exports.getUserAction = getUserAction;
module.exports.setUserAction = setUserAction;
module.exports.clearUserAction = clearUserAction;
module.exports.setUserActionArgs = setUserActionArgs;

module.exports.findUserInvite = findUserInvite;

function checkUserState(userID) {
    if (!WalletUsersState[userID]) {
        WalletUsersState[userID] = { menu: 'main', menuArgs: [], action: ACTION_INVALID, actionArgs: [] };
    }
}

/**
 * @param {number} userID 
 */
function getUserMenu(userID) {
    checkUserState(userID);
    return { menu: WalletUsersState[userID].menu, args: WalletUsersState[userID].menuArgs };
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
function getUserAction(userID) {
    checkUserState(userID);
    return { action: WalletUsersState[userID].action, args: WalletUsersState[userID].actionArgs };
}
/**
 * @param {number} userID 
 * @param {string} action 
 * @param {string[]} [args] 
 */
function setUserAction(userID, action, args) {
    checkUserState(userID);
    WalletUsersState[userID].action = action;
    WalletUsersState[userID].actionArgs = args ? args : [];
}
/**
 * @param {number} userID 
 */
function clearUserAction(userID) {
    setUserAction(userID, ACTION_INVALID);
}

/**
 * @param {number} userID 
 * @param {string[]} args 
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