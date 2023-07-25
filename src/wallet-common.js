// @ts-check

const MENU_BUTTON_GOTO   = "MenuButtonGoto";
const MENU_BUTTON_ACTION = "MenuButtonAction";

const ACTION_INVALID = 'none';

/** @type {{ [userID: number]: { menu: string, action: string } }} */
var WalletUsersState = {};

module.exports.MENU_BUTTON_GOTO   = MENU_BUTTON_GOTO;
module.exports.MENU_BUTTON_ACTION = MENU_BUTTON_ACTION;
module.exports.ACTION_INVALID = ACTION_INVALID;
module.exports.getUserMenu = getUserMenu;
module.exports.setUserMenu = setUserMenu;
module.exports.getUserAction = getUserAction;
module.exports.setUserAction = setUserAction;
module.exports.clearUserAction = clearUserAction;

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
    }
}
/**
 * @param {number} userID 
 */
function clearUserAction(userID) {
    setUserAction(userID, ACTION_INVALID);
}