// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'renameCategory';
const ACTION_SHORT_NAME = 'rCat';

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
    const categoryID = args.categoryID;
    if (typeof categoryID !== 'number') {
        log.error(userID, `invalid argument "categoryID"`);
        callback(false);
        return;
    }
    log.info(userID, `getting data of category ${categoryID}...`);
    db.category_get(categoryID, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `failed to get data of category ${categoryID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changing name of category ${categoryID}...`);
            const menuMessageID = walletCommon.getUserMenuMessageID(userID);
            walletCommon.setUserMenuMessageID(userID, 0);
            bot.editMessage({ 
                message: { chatID: userID, id: menuMessageID }, 
                text: `*Renaming category*\nCategory *${categoryData.name}*\\. Please, enter new name`, 
                parseMode: 'MarkdownV2',
                inlineKeyboard: { inline_keyboard:[] } 
            }, (message, error) => {
                if (error) {
                    log.error(userID, `failed to send message about changing name of category ${categoryID} (${error})`);
                    callback(false);
                } else {
                    log.info(userID, `sent message about changing name of category ${categoryID}`);
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
    const categoryID = typeof args.categoryID === 'number' ? args.categoryID : db.invalid_id;
    db.category_edit(categoryID, { name: message.text }, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `failed to change name of category ${categoryID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `changed name of category ${categoryID} (${categoryData.name})`);
            ActionStopCallback(message.from, userData, callback);
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const categoryID = args.categoryID;
    log.info(userID, `returning to category ${categoryID} menu`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'category', { categoryID: categoryID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to category ${categoryID} menu (${error})`);
        } else {
            log.info(userID, `returned to category ${categoryID} menu`);
        }
        callback(true);
    });
}
