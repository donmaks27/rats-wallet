// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'archiveCurrency';

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
        start: startAction,
        stop: stopAction
    };
}

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.currency !== 'string') {
        log.error(userID, `invalid argument "currency"`);
        callback(false);
        return;
    }
    
    const currencyCode = args.currency;
    const shouldArchive = args.archive ? true : false;
    log.info(userID, `${ shouldArchive ? 'archiving' : 'unarchiving' } currency ${currencyCode}...`);
    db.currency_edit(currencyCode, { is_active: !shouldArchive }, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `failed to ${ shouldArchive ? 'archive' : 'unarchive' } currency ${currencyCode} (${error})`);
            callback(false);
        } else {
            log.info(userID, `currency ${currencyCode} ${ shouldArchive ? 'archived' : 'unarchived' }`);
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
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'currency', { currency: args.currency }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}
