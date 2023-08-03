// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'createCurrency';

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
    log.info(userID, `sending message abount new currency code...`);
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    walletCommon.setUserMenuMessageID(userID, 0);
    bot.editMessage({
        message: { chatID: userID, id: menuMessageID },
        text: `*Creating new currency*\nPlease, enter new currency code`,
        parseMode: 'MarkdownV2',
        inlineKeyboard: { inline_keyboard: [] }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to send message abount new currency code (${error})`);
            callback(false);
        } else {
            log.info(userID, `sent message abount new currency code`);
            callback(true);
        }
    });
}
/**
 * @type {actionBase.action_message_func}
 */
function onUserMessage(message, userData, args, callback) {
    const userID = message.from.id;
    if (!message.text || (message.text.length == 0)) {
        log.warning(userID, `empty message text`);
        callback(true);
        return;
    }
    const currencyCode = message.text;
    log.info(userID, `searching currency ${currencyCode}...`);
    db.currency_get(currencyCode, (currencyData, error) => {
        if (currencyData) {
            log.warning(userID, `currency ${currencyCode} already created`);
            bot.sendMessage({ chatID: userID, text: `Such currency already exists, try again` });
            callback(true);
        } else {
            log.info(userID, `didn't find currency ${currencyCode}, creating new currency...`);
            db.currency_create({ code: currencyCode }, (currencyData, error) => {
                if (error) {
                    log.error(userID, `failed to create currency ${currencyCode} (${error})`);
                    bot.sendMessage({ chatID: userID, text: `_Something went wrong, failed to create currency_` }, () => {
                        ActionStopCallback(message.from, userData, () => { callback(false); });
                    });
                } else {
                    log.info(userID, `created currency ${currencyCode}`);
                    args.currency = currencyCode;
                    walletCommon.setUserActionArgs(userID, args);
                    ActionStopCallback(message.from, userData, callback);
                }
            });
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const currencyCreated = typeof args.currency === 'string';
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    log.info(userID, `switching menu...`);
    walletMenu.sendMenuMessage(currencyCreated ? 'currency' : 'currencies', currencyCreated ? { currency: currencyCode } : {}, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to switch menu ${currencyCode} (${error})`);
        } else {
            log.info(userID, `menu switched`);
        }
        callback(true);
    });
}
