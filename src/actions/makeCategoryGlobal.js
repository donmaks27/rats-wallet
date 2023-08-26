// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'makeCategoryGlobal';
const ACTION_SHORT_NAME = 'globCat';

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
        log.warning(userID, `invalid argument "categoryID"`);
        callback(false);
        return;
    }
    db.category_edit(categoryID, { user_id: null }, (categoryData, error) => {
        if (error) {
            log.error(userID, `failed to edit category ${categoryID} (${error})`);
        }
        const menuMessageID = walletCommon.getUserMenuMessageID(userID);
        walletCommon.setUserMenuMessageID(userID, 0);
        bot.editMessage({ 
            message: { chatID: userID, id: menuMessageID }, 
            text: error ? `_Something went wrong, failed to edit category_` : `_Category edited_`,
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
    log.info(userID, `updating menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'category', { categoryID: args.categoryID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}
