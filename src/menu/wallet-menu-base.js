// @ts-check

var log = require('../log');
var db  = require('../database');
var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');

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
    return makeButton(walletCommon.MENU_BUTTON_ACTION, action, args);
}
/**
 * @param {string} str 
 */
module.exports.makeMenuMessageTitle = function(str) {
    return `*${bot.escapeMarkdown(str)}*`;
}

/**
 * @param {string} refType 
 * @param {string} refDestination 
 * @param {walletCommon.args_data} [args] 
 */
function makeButton(refType, refDestination, args) {
    return walletCommon.encodeArgs(`${refType}:${refDestination}`, args);
}