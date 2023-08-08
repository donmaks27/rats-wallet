// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'createCategory';

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
    log.info(userID, `sending message abount new category...`);
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    walletCommon.setUserMenuMessageID(userID, 0);
    bot.editMessage({
        message: { chatID: userID, id: menuMessageID },
        text: `*Creating new category*\nPlease, enter new category name`,
        parseMode: 'MarkdownV2',
        inlineKeyboard: { inline_keyboard: [] }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to send message abount new category (${error})`);
            callback(false);
        } else {
            log.info(userID, `sent message abount new category`);
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
    const parentCategoryID = typeof args.parentCategoryID === 'number' ? args.parentCategoryID : db.invalid_id;
    const categoryName = message.text;
    log.info(userID, `creating new category "${categoryName}" (parent ID ${parentCategoryID})...`);
    var params = { user_id: userID, name: categoryName };
    if (parentCategoryID != db.invalid_id) {
        params.parent_id = parentCategoryID;
    }
    db.category_create(params, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `failed to create new category "${categoryName}" (${error})`);
            bot.sendMessage({ chatID: userID, text: `_Something went wrong, failed to create category_` }, () => {
                ActionStopCallback(message.from, userData, () => { callback(false); });
            });
        } else {
            log.info(userID, `created new category "${categoryName}"`);
            args.categoryID = categoryData.id;
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
    const categoryID = typeof args.categoryID === 'number' ? args.categoryID : db.invalid_id;
    const categoryCreated = categoryID != db.invalid_id;
    log.info(userID, `switching menu...`);
    walletMenu.sendMenuMessage(categoryCreated ? 'category' : 'categories', categoryCreated ? { categoryID: categoryID } : { 
        categoryID: args.parentCategoryID 
    }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to switch menu (${error})`);
        } else {
            log.info(userID, `menu switched`);
        }
        callback(true);
    });
}
