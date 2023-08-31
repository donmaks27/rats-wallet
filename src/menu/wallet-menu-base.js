// @ts-check

var log = require('../log');
var db  = require('../database');
var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var walletActions = require('../wallet-actions');

/**
 * @typedef {{ text: string, parseMode?: bot.message_parse_mode, keyboard: bot.keyboard_button_inline_data[][] }} menu_data
 * @typedef {(user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (menuData: menu_data) => any) => void} menu_create_func
 * @typedef {() => { [menu: string]: menu_create_func }} menu_get_func
 */

/**
 * @param {number} userID 
 * @param {string} msg 
 */
module.exports.error = (userID, msg) => log.error(`[WALLET][MENU][USER ${userID}] ${msg}`);
/**
 * @param {number} userID 
 * @param {string} msg 
 */
module.exports.warning = (userID, msg) => log.warning(`[WALLET][MENU][USER ${userID}] ${msg}`);
/**
 * @param {number} userID 
 * @param {string} msg 
 */
module.exports.info = (userID, msg) => log.info(`[WALLET][MENU][USER ${userID}] ${msg}`);

/**
 * @param {walletCommon.menu_type} type 
 * @param {walletCommon.args_data} [args] 
 */
module.exports.makeMenuButton = function(type, args) {
    return makeButton(walletCommon.MENU_BUTTON_GOTO, type, args);
}
/**
 * @param {walletCommon.action_type} action 
 * @param {walletCommon.args_data} [args] 
 */
module.exports.makeActionButton = function(action, args) {
    return makeButton(walletCommon.MENU_BUTTON_ACTION, walletActions.getActionShortName(action), args);
}
module.exports.makeDummyButton = function() {
    return walletCommon.MENU_BUTTON_DUMMY;
}
/**
 * @param {string} str 
 */
module.exports.makeMenuMessageTitle = function(str) {
    return `*${bot.escapeMarkdown(str)}*`;
}

/**
 * @param {Date} date 
 */
module.exports.encodeDate = function(date) {
    return (date.getUTCFullYear() * 12 + date.getUTCMonth()) * 31 + (date.getUTCDate() - 1);
}
/**
 * @param {number} encodedDate 
 */
module.exports.decodeDate = function(encodedDate) {
    const day = encodedDate % 31;
    const monthAndYear = Math.floor((encodedDate - day) / 31);
    const month = monthAndYear % 12;
    const year = Math.floor((monthAndYear - month) / 12);
    var date = new Date(0);
    date.setUTCFullYear(year);
    date.setUTCMonth(month);
    date.setUTCDate(day + 1);
    return date;
}

/**
 * @param {string} refType 
 * @param {string} refDestination 
 * @param {walletCommon.args_data} [args] 
 */
function makeButton(refType, refDestination, args) {
    return walletCommon.encodeArgs(`${refType}:${refDestination}`, args);
}