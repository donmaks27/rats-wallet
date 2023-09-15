// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'createRecord';
const ACTION_SHORT_NAME = 'crR';

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

const ARG_RECORDS_FILTER_ID = 'fID';
const ARG_PREV_FILTER_ID = 'pF';

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `getting remp record data...`);
    db.record_getTemp(userID, (tempRecordData, error) => {
        if (error || !tempRecordData) {
            log.error(userID, `failed to get temp record data (${error})`);
            callback(false);
        } else if (!tempRecordData.src_account) {
            log.error(userID, `invalid src account of temp record data`);
            callback(false);
        } else {
            log.info(userID, `creating new record...`);
            db.record_create({
                src_account_id: tempRecordData.dst_account || (tempRecordData.src_amount < 0) ? tempRecordData.src_account_id : db.invalid_id,
                src_amount:     tempRecordData.dst_account ? tempRecordData.src_amount : (tempRecordData.src_amount < 0 ? -tempRecordData.src_amount : 0),
                dst_account_id: tempRecordData.dst_account ? tempRecordData.dst_account_id : (tempRecordData.src_amount >= 0 ? tempRecordData.src_account_id : db.invalid_id),
                dst_amount:     tempRecordData.dst_account ? tempRecordData.dst_amount : (tempRecordData.src_amount >= 0 ? tempRecordData.src_amount : 0),
                category_id:    tempRecordData.category_id,
                date:           tempRecordData.date
            }, (recordData, error) => {
                if (error || !recordData) {
                    log.error(userID, `failed to create new record (${error})`);
                    callback(false);
                } else {
                    log.info(userID, `new record created`);
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
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;
    log.info(userID, `updating menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'records', { [ARG_RECORDS_FILTER_ID]: prevFilterID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}
