// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'archiveLabel';

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
    if (typeof args.labelID !== 'number') {
        log.error(userID, `invalid argument "labelID"`);
        callback(false);
        return;
    }
    
    const labelID = args.labelID;
    const shouldArchive = args.archive ? true : false;
    log.info(userID, `${ shouldArchive ? 'archiving' : 'unarchiving' } label ${labelID}...`);
    db.label_edit(labelID, { is_active: !shouldArchive }, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `failed to ${ shouldArchive ? 'archive' : 'unarchive' } label ${labelID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `label ${labelID} ${ shouldArchive ? 'archived' : 'unarchived' }`);
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
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'label', { labelID: args.labelID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}
