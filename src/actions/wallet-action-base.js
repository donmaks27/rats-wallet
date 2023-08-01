// @ts-check

var log = require('../log');
var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');

/**
 * @typedef {(user: bot.user_data, userData: db.user_data, callback: (success: boolean) => any) => any} action_stop_callback
 * @typedef {(user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (success: boolean) => any) => any} action_start_func
 * @typedef {(message: bot.message_data, userData: db.user_data, args: walletCommon.args_data, callback: (success: boolean) => any) => any} action_message_func
 * @typedef {(user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (success: boolean) => any) => any} action_stop_func
 * @typedef {{ start: action_start_func, onMessage?: action_message_func, stop: action_stop_func }} action_handlers
 * @typedef {(stopCallback: action_stop_callback) => { [actionName: string]: action_handlers }} register_func
 */

/**
 * @param {number} userID 
 * @param {string} action
 * @param {string} msg 
 */
module.exports.error = (userID, action, msg) => log.error(`[WALLET][ACTION][USER ${userID}][${action}] ${msg}`);
/**
 * @param {number} userID 
 * @param {string} action
 * @param {string} msg 
 */
module.exports.warning = (userID, action, msg) => log.warning(`[WALLET][ACTION][USER ${userID}][${action}] ${msg}`);
/**
 * @param {number} userID 
 * @param {string} action
 * @param {string} msg 
 */
module.exports.info = (userID, action, msg) => log.info(`[WALLET][ACTION][USER ${userID}][${action}] ${msg}`);

