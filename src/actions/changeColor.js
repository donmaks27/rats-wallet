// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'changeColor';

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
    const color = db.parseColor(typeof args.color === 'string' ? args.color : '');
    if (typeof args.labelID === 'number') {
        changeLabelColor(user, userData, args, args.labelID, color, callback);
    } else if (typeof args.categoryID === 'number') {
        changeCategoryColor(user, userData, args, args.categoryID, color, callback);
    } else {
        log.error(userID, `don't have any ID in the args`);
        callback(false);
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {number} labelID 
 * @param {db.color_type} color 
 * @param {(success: boolean) => any} callback 
 */
function changeLabelColor(user, userData, args, labelID, color, callback) {
    const userID = user.id;
    log.info(userID, `changing color of label ${labelID} to '${color}'...`);
    db.label_edit(labelID, { color: color }, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `failed to change color of label ${labelID} to '${color}' (${error})`);
            callback(false);
        } else {
            log.info(userID, `changed color of label ${labelID} to '${color}'`);
            ActionStopCallback(user, userData, callback);
        }
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {number} categoryID 
 * @param {db.color_type} color 
 * @param {(success: boolean) => any} callback 
 */
function changeCategoryColor(user, userData, args, categoryID, color, callback) {
    const userID = user.id;
    log.info(userID, `changing color of category ${categoryID} to '${color}'...`);
    db.category_edit(categoryID, { color: color }, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `failed to change color of category ${categoryID} to '${color}' (${error})`);
            callback(false);
        } else {
            log.info(userID, `changed color of category ${categoryID} to '${color}'`);
            ActionStopCallback(user, userData, callback);
        }
    });
}

/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    /** @type {walletCommon.menu_type} */
    var menu = 'main';
    /** @type {walletCommon.args_data} */
    var menuArgs = {};
    if (typeof args.labelID === 'number') {
        menu = 'label';
        menuArgs = { labelID: args.labelID };
    } else if (typeof args.categoryID === 'number') {
        menu = 'category';
        menuArgs = { categoryID: args.categoryID };
    }
    log.info(userID, `updating menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), menu, menuArgs, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}
