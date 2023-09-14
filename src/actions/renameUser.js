// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'renameUser';
const ACTION_SHORT_NAME = 'rUser';

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
    log.info(userID, `sending start message...`);
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    walletCommon.setUserMenuMessageID(userID, 0);
    bot.editMessage({
        message: { chatID: userID, id: menuMessageID },
        text: `*Changing user name*\nCurrent name is *${bot.escapeMarkdown(userData.name)}*\\. Please, enter new name`, 
        parseMode: 'MarkdownV2',
        inlineKeyboard: {
            inline_keyboard: []
        }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to send start message (${error})`);
            callback(false);
        } else {
            log.info(userID, `sent start message`);
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
        log.warning(userID, `empty new name`);
        callback(true);
    } else {
        db.user_edit(userID, { name: message.text }, (data, error) => {
            if (error || !data) {
                log.error(userID, `failed to update user name (${error})`);
                callback(false);
            } else {
                log.info(userID, `name is changed`);
                bot.sendMessage({ chatID: message.from.id, text: `The name has been changed` }, (msg, error) => {
                    ActionStopCallback(message.from, data, callback);
                });
            }
        });
    }
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `restoring menu message...`);
    const currentMenu = walletCommon.getUserMenu(userID);
    walletMenu.sendMenuMessage(currentMenu.menu, currentMenu.args, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to restore menu message (${error})`);
        } else {
            log.info(userID, `menu message restored`);
        }
        callback(true);
    });
}
