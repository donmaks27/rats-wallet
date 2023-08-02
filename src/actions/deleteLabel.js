// @ts-check

var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'deleteLabel';

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
    const labelID = args.labelID;
    if (typeof labelID !== 'number') {
        log.warning(userID, `invalid argument "labelID"`);
        callback(false);
        return;
    }
    db.label_delete(labelID, (error) => {
        if (error) {
            log.error(userID, `failed to delete label ${labelID} (${error})`);
        }
        ActionStopCallback(user, userData, callback);
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `switching to labels menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'labels', {}, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to switch to labels menu (${error})`);
        } else {
            log.info(userID, `switched to labels menu`);
        }
        callback(true);
    });
}
