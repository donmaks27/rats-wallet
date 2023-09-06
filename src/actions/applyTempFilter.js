// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'applyTempFilter';
const ACTION_SHORT_NAME = 'apTF';

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
    db.filter_getTemp(userID, (filterData, error) => {
        if (error || !filterData) {
            log.error(userID, `failed to get temp filter data`);
            callback(false);
        } else {
            db.filter_editCustom(userID, filterData, (filterData, error) => {
                if (error || !filterData) {
                    log.error(userID, `failed to update custom filter data`);
                    callback(false);
                } else {
                    args.filterID = filterData.id;
                    walletCommon.setUserActionArgs(userID, args);
                    ActionStopCallback(user, userData, callback);
                }
            });
        }
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    var recordsArgs = { page: 0 };
    if (typeof args.filterID === 'number') {
        recordsArgs.fID = args.filterID;
    }
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'records', recordsArgs, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}