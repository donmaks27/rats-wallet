// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'archiveCategory';
const ACTION_SHORT_NAME = 'aCat';

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
        log.error(userID, `invalid argument "categoryID"`);
        callback(false);
        return;
    }
    
    const shouldArchive = args.archive ? true : false;
    log.info(userID, `${ shouldArchive ? 'archiving' : 'unarchiving' } category ${categoryID}...`);
    db.category_edit(categoryID, { is_active: !shouldArchive }, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `failed to ${ shouldArchive ? 'archive' : 'unarchive' } category ${categoryID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `category ${categoryID} ${ shouldArchive ? 'archived' : 'unarchived' }`);
            ActionStopCallback(user, userData, callback);
        }
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
