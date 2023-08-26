// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'renameLabel';
const ACTION_SHORT_NAME = 'rLab';

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
    const labelID = args.labelID;
    if (typeof labelID !== 'number') {
        log.error(userID, `invalid argument "labelID"`);
        callback(false);
        return;
    }
    log.info(userID, `getting data of label ${labelID}...`);
    db.label_get(labelID, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `failed to get data of label ${labelID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changing name of label ${labelID}...`);
            const menuMessageID = walletCommon.getUserMenuMessageID(userID);
            walletCommon.setUserMenuMessageID(userID, 0);
            bot.editMessage({ 
                message: { chatID: userID, id: menuMessageID }, 
                text: `*Renaming label*\nLabel *${labelData.name}*\\. Please, enter new name`, 
                parseMode: 'MarkdownV2',
                inlineKeyboard: { inline_keyboard:[] } 
            }, (message, error) => {
                if (error) {
                    log.error(userID, `failed to send message about changing name of label ${labelID} (${error})`);
                    callback(false);
                } else {
                    log.info(userID, `sent message about changing name of label ${labelID}`);
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
    const labelID = typeof args.labelID === 'number' ? args.labelID : db.invalid_id;
    db.label_edit(labelID, { name: message.text }, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `failed to change name of label ${labelID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changed name of label ${labelID} (${labelData.name})`);
            ActionStopCallback(message.from, userData, callback);
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const labelID = args.labelID;
    log.info(userID, `returning to label ${labelID} menu`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'label', { labelID: labelID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to label ${labelID} menu (${error})`);
        } else {
            log.info(userID, `returned to label ${labelID} menu`);
        }
        callback(true);
    });
}
