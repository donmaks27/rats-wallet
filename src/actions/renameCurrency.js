// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'renameCurrency';
const ACTION_SHORT_NAME = 'rCur';

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
            shortName: ACTION_SHORT_NAME,
            start: startAction,
            onMessage: onUserMessage,
            stop: stopAction
        }
    };
}

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.currency !== 'string') {
        log.error(userID, `invalid argument "currency"`);
        callback(false);
        return;
    }
    const currencyCode = args.currency;
    const shouldClearName = args.clearName ? true : false;
    if (shouldClearName) {
        log.info(userID, `clearing name of currency ${currencyCode}...`);
        db.currency_edit(currencyCode, { name: null }, (currencyData, error) => {
            if (error) {
                log.error(userID, `failed to clear name of currency ${currencyCode} (${error})`);
                callback(false);
            } else {
                log.info(userID, `currency name of ${currencyCode} cleared`);
                ActionStopCallback(user, userData, callback);
            }
        });
    } else {
        log.info(userID, `getting data of currency ${currencyCode}...`);
        db.currency_get(currencyCode, (currencyData, error) => {
            if (error || !currencyData) {
                log.error(userID, `failed to get data of currency ${currencyCode} (${error})`);
                callback(false);
            } else {
                log.info(userID, `changing name of currency ${currencyCode}...`);
                const menuMessageID = walletCommon.getUserMenuMessageID(userID);
                walletCommon.setUserMenuMessageID(userID, 0);
                bot.editMessage({ 
                    message: { chatID: userID, id: menuMessageID }, 
                    text: `*Renaming currency*\nCurrency *${bot.escapeMarkdown(currencyData.name ? `${currencyData.name} (${currencyCode})` : currencyCode)}*\\. Please, enter new name`, 
                    parseMode: 'MarkdownV2',
                    inlineKeyboard: { inline_keyboard:[] } 
                }, (message, error) => {
                    if (error) {
                        log.error(userID, `failed to send message about changing name of currency ${currencyCode} (${error})`);
                        callback(false);
                    } else {
                        log.info(userID, `sent message about changing name of currency ${currencyCode}`);
                        callback(true);
                    }
                });
            }
        });
    }
}
/**
 * @type {actionBase.action_message_func}
 */
function onUserMessage(message, userData, args, callback) {
    const userID = message.from.id;
    const shouldClearName = args.clearName ? true : false;
    if (shouldClearName) {
        log.error(userID, `shouldClearName is true, it shouldn't happen, action should be stopped already`);
        callback(false);
        return;
    }
    if (!message.text || (message.text.length == 0)) {
        log.warning(userID, `empty message text`);
        callback(true);
        return;
    }
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    db.currency_edit(currencyCode, { name: message.text }, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `failed to change name of currency ${currencyCode} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changed name of currency ${currencyCode} (${currencyData.name})`);
            ActionStopCallback(message.from, userData, callback);
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `returning to currency ${args.currency} menu`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'currency', { currency: args.currency }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to currency ${args.currency} menu (${error})`);
        } else {
            log.info(userID, `returned to currency ${args.currency} menu`);
        }
        callback(true);
    });
}
