// @ts-check

var db = require('./database');

/**
 * @typedef {{ [key: string]: string|number|boolean|null }} args_data
 * @typedef {'invite'|'renameUser'|
 *           'archiveAccount'|'deleteAccount'|'createAccount'|
 *           'archiveCurrency'|'renameCurrency'|'createCurrency'|'deleteCurrency'|
 *           'archiveLabel'|'createLabel'|'deleteLabel'|'makeLabelGlobal'|'renameLabel'
 *          } action_type
 * @typedef {'main'|'settings'|'wallet'|
 *           'accounts'|'account'|'createAccount'|'deleteAccount'|
 *           'currencies'|'currency'|'deleteCurrency'|
 *           'label'|'labels'|'deleteLabel'|'makeLabelGlobal'
 *          } menu_type
 */

const MENU_BUTTON_GOTO   = "m";
const MENU_BUTTON_ACTION = "a";

const ACTION_INVALID = 'none';

/** @type {{ [userID: number]: { menu: string, menuArgs: args_data, menuMessageID: number, action: string, actionArgs: args_data } }} */
var WalletUsersState = {};

module.exports.MENU_BUTTON_GOTO   = MENU_BUTTON_GOTO;
module.exports.MENU_BUTTON_ACTION = MENU_BUTTON_ACTION;
module.exports.ACTION_INVALID = ACTION_INVALID;
module.exports.getUserMenu = getUserMenu;
module.exports.setUserMenu = setUserMenu;
module.exports.getUserMenuMessageID = getUserMenuMessageID;
module.exports.setUserMenuMessageID = setUserMenuMessageID;
module.exports.getUserAction = getUserAction;
module.exports.setUserAction = setUserAction;
module.exports.clearUserAction = clearUserAction;
module.exports.setUserActionArgs = setUserActionArgs;

module.exports.encodeArgs = encodeArgs;
module.exports.decodeArgs = decodeArgs;

module.exports.findUserInvite = findUserInvite;

function checkUserState(userID) {
    if (!WalletUsersState[userID]) {
        WalletUsersState[userID] = { menu: 'main', menuArgs: {}, menuMessageID: 0, action: ACTION_INVALID, actionArgs: {} };
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
 * @param {args_data} [args] 
 */
function setUserMenu(userID, menu, args) {
    checkUserState(userID);
    WalletUsersState[userID].menu = menu;
    WalletUsersState[userID].menuArgs = args ? args : {};
}

/**
 * @param {number} userID 
 */
function getUserMenuMessageID(userID) {
    checkUserState(userID);
    return WalletUsersState[userID].menuMessageID;
}
/**
 * @param {number} userID 
 * @param {number} messageID 
 */
function setUserMenuMessageID(userID, messageID) {
    checkUserState(userID);
    WalletUsersState[userID].menuMessageID = messageID;
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
 * @param {args_data} [args] 
 */
function setUserAction(userID, action, args) {
    checkUserState(userID);
    WalletUsersState[userID].action = action;
    WalletUsersState[userID].actionArgs = args ? args : {};
}
/**
 * @param {number} userID 
 */
function clearUserAction(userID) {
    setUserAction(userID, ACTION_INVALID);
}

/**
 * @param {number} userID 
 * @param {args_data} args 
 */
function setUserActionArgs(userID, args) {
    checkUserState(userID);
    if (WalletUsersState[userID].action != ACTION_INVALID) {
        WalletUsersState[userID].actionArgs = args;
    }
}

/**
 * @param {string} str 
 * @param {args_data} [args] 
 */
function encodeArgs(str, args) {
    var result = str;
    if (args) {
        for (var argKey in args) {
            const argValue = args[argKey];
            result += `;${argKey}=`;
            if (argValue === null) {
                result += '0';
            } else {
                switch (typeof argValue) {
                case 'boolean': 
                    result += argValue ? 't' : 'f'; 
                    break;
                case 'number': 
                    result += `n${argValue}`; 
                    break;
                default: 
                    result += `s${argValue}`; 
                    break;
                }
            }
        }
    }
    return result;
}
/**
 * @param {string} str 
 * @returns {args_data}
 */
function decodeArgs(str) {
    var args = str.split(';');
    /** @type {args_data} */
    var result = {};
    for (var i = 0; i < args.length; i++) {
        const arg = args[i].split('=');
        if ((arg.length != 2) || (arg[1].length == 0)) {
            continue;
        }

        const argKey = arg[0];
        const argValue = arg[1].substring(1);
        switch (arg[1][0]) {
        case '0': result[argKey] = null; break;
        case 't': result[argKey] = true; break;
        case 'f': result[argKey] = false; break;
        case 'n': result[argKey] = Number.parseInt(argValue); break;
        case 's': result[argKey] = argValue; break;
        default: ;
        }
    }
    return result;
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