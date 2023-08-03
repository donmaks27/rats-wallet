// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'deleteAccount';

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
    const accountID = args.accountID;
    if (typeof accountID !== 'number') {
        log.warning(userID, `invalid argument "accountID"`);
        callback(false);
        return;
    }
    db.account_delete(accountID, (error) => {
        if (error) {
            log.error(userID, `failed to delete account ${accountID} (${error})`);
        }
        const menuMessageID = walletCommon.getUserMenuMessageID(userID);
        walletCommon.setUserMenuMessageID(userID, 0);
        bot.editMessage({ 
            message: { chatID: userID, id: menuMessageID }, 
            text: error ? `_Something went wrong, failed to delete account_` : `_Account deleted_`,
            parseMode: 'MarkdownV2',
            inlineKeyboard: { inline_keyboard: [] }
        }, () => {
            ActionStopCallback(user, userData, callback);
        });
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `switching to accounts menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'accounts', {}, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to switch to accounts menu (${error})`);
        } else {
            log.info(userID, `switched to accounts menu`);
        }
        callback(true);
    });
}
