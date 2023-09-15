// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'renameAccount';
const ACTION_SHORT_NAME = 'rAcc';

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

const ARG_ACCOUNT_ACCOUNT_ID = 'id';

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    const accountID = args.accountID;
    if (typeof accountID !== 'number') {
        log.error(userID, `invalid argument "accountID"`);
        callback(false);
        return;
    }
    log.info(userID, `getting data of account ${accountID}...`);
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `failed to get data of account ${accountID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changing name of account ${accountID}...`);
            const menuMessageID = walletCommon.getUserMenuMessageID(userID);
            walletCommon.setUserMenuMessageID(userID, 0);
            bot.editMessage({ 
                message: { chatID: userID, id: menuMessageID }, 
                text: `*Renaming account*\nAccount *${bot.escapeMarkdown(accountData.name)}*\\. Please, enter new name`, 
                parseMode: 'MarkdownV2',
                inlineKeyboard: { inline_keyboard:[] } 
            }, (message, error) => {
                if (error) {
                    log.error(userID, `failed to send message about changing name of account ${accountID} (${error})`);
                    callback(false);
                } else {
                    log.info(userID, `sent message about changing name of account ${accountID}`);
                    callback(true);
                }
            });
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
    const accountID = typeof args.accountID === 'number' ? args.accountID : db.invalid_id;
    db.account_edit(accountID, { name: message.text }, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `failed to change name of account ${accountID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changed name of account ${accountID} (${accountData.name})`);
            ActionStopCallback(message.from, userData, callback);
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const accountID = args.accountID;
    log.info(userID, `returning to account ${accountID} menu`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'account', { [ARG_ACCOUNT_ACCOUNT_ID]: accountID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to account ${accountID} menu (${error})`);
        } else {
            log.info(userID, `returned to account ${accountID} menu`);
        }
        callback(true);
    });
}
