// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'deleteCurrency';

const log = {
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    error: (userID, msg) => actionBase.error(userID, ACTION_NAME, msg),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    warning: (userID, msg) => actionBase.warning(userID, ACTION_NAME, msg),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    info: (userID, msg) => actionBase.info(userID, ACTION_NAME, msg)
};

/** @type {actionBase.action_stop_callback} */
var ActionStopCallback = (user, userData, callback) => {}
/**
 * @type {actionBase.register_func}
 */
module.exports.register = (stopCallback) => {
    ActionStopCallback = stopCallback;
    return {
        [ACTION_NAME]: {
            start: startAction,
            stop: stopAction
        }
    };
}

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    const currencyCode = args.currency;
    if (typeof currencyCode !== 'string') {
        log.warning(userID, `invalid argument "currency"`);
        callback(false);
        return;
    }
    db.currency_delete(currencyCode, (error) => {
        if (error) {
            log.error(userID, `failed to delete currency ${currencyCode} (${error})`);
        }
        bot.sendMessage({ chatID: userID, text: error ? `_Something went wrong, failed to delete_` : `_Currency deleted_`, parseMode: 'MarkdownV2' }, () => {
            ActionStopCallback(user, userData, callback);
        });
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `switching to currencies menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'currencies', {}, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to switch to currencies menu (${error})`);
        } else {
            log.info(userID, `switched to currencies menu`);
        }
        callback(true);
    });
}
