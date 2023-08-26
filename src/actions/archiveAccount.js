// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'archiveAccount';
const ACTION_SHORT_NAME = 'aAcc';

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
    if (typeof args.accountID !== 'number') {
        log.error(userID, `invalid argument "accountID"`);
        callback(false);
        return;
    }
    
    const accountID = args.accountID;
    const shouldArchive = args.archive ? true : false;
    log.info(userID, `${ shouldArchive ? 'archiving' : 'unarchiving' } account ${accountID}...`);
    db.account_edit(accountID, { is_active: !shouldArchive }, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `failed to ${ shouldArchive ? 'archive' : 'unarchive' } account ${accountID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `account ${accountID} ${ shouldArchive ? 'archived' : 'unarchived' }`);
            ActionStopCallback(user, userData, callback);
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.accountID !== 'number') {
        log.error(userID, `invalid argument "accountID"`);
        callback(false);
        return;
    }

    const accountID = args.accountID;
    log.info(userID, `updating menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'account', { accountID: accountID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}