// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'createLabel';
const ACTION_SHORT_NAME = 'crLab';

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
    log.info(userID, `sending message abount new label...`);
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    walletCommon.setUserMenuMessageID(userID, 0);
    bot.editMessage({
        message: { chatID: userID, id: menuMessageID },
        text: `*Creating new label*\nPlease, enter new label name`,
        parseMode: 'MarkdownV2',
        inlineKeyboard: { inline_keyboard: [] }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to send message abount new label (${error})`);
            callback(false);
        } else {
            log.info(userID, `sent message abount new label`);
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
    const labelName = message.text;
    log.info(userID, `creating new label "${labelName}"...`);
    db.label_create({ user_id: userID, name: labelName }, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `failed to create new label "${labelName}" (${error})`);
            bot.sendMessage({ chatID: userID, text: `_Something went wrong, failed to create label_` }, () => {
                ActionStopCallback(message.from, userData, () => { callback(false); });
            });
        } else {
            log.info(userID, `created new label "${labelName}"`);
            args.labelID = labelData.id;
            walletCommon.setUserActionArgs(userID, args);
            ActionStopCallback(message.from, userData, callback);
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const labelCreated = typeof args.labelID === 'number';
    const labelID = typeof args.labelID === 'number' ? args.labelID : db.invalid_id;
    log.info(userID, `switching menu...`);
    walletMenu.sendMenuMessage(labelCreated ? 'label' : 'labels', labelCreated ? { labelID: labelID } : {}, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to switch menu (${error})`);
        } else {
            log.info(userID, `menu switched`);
        }
        callback(true);
    });
}
