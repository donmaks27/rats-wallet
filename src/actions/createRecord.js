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

const ARG_RECORDS_PAGE = 'page';
const ARG_RECORDS_FILTER_ID = 'fID';
const ARG_PREV_PAGE = 'pP';
const ARG_PREV_FILTER_ID = 'pF';
const ARG_TEMP_RECORD_TYPE = 't';

const TEMP_RECORD_TYPE_EXPENSE = 'e';
const TEMP_RECORD_TYPE_INCOME = 'i';
const TEMP_RECORD_TYPE_TRANSFER = 't';

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    const tempRecordType = args[ARG_TEMP_RECORD_TYPE];
    switch (tempRecordType) {
    case TEMP_RECORD_TYPE_EXPENSE:
    case TEMP_RECORD_TYPE_INCOME:
    case TEMP_RECORD_TYPE_TRANSFER:
        break;

    default:
        log.error(userID, `invalid temp record type "${tempRecordType}"`);
        return;
    }

    log.info(userID, `getting remp record data...`);
    db.record_getTemp(userID, (tempRecordData, error) => {
        if (error || !tempRecordData) {
            log.error(userID, `failed to get temp record data (${error})`);
            callback(false);
        } else {
            db.record_getTempLabels(userID, (labels, error) => {
                if (error) {
                    log.error(userID, `failed to get temp record labels data (${error})`);
                    callback(false);
                } else {
                    /** @type {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date: Date }} */
                    var newRecordData = { category_id: tempRecordData.category_id, date: tempRecordData.date };
                    if (tempRecordType != TEMP_RECORD_TYPE_INCOME) {
                        newRecordData.src_account_id = tempRecordData.src_account_id;
                        newRecordData.src_amount = tempRecordData.src_amount;
                    }if (tempRecordType != TEMP_RECORD_TYPE_EXPENSE) {
                        newRecordData.dst_account_id = tempRecordData.dst_account_id;
                        newRecordData.dst_amount = tempRecordData.dst_amount;
                    }
                    db.record_create(newRecordData, (recordData, error) => {
                        if (error || !recordData) {
                            log.error(userID, `failed to create new record (${error})`);
                            callback(false);
                        } else {
                            log.info(userID, `new record created`);
                            if (labels.length > 0) {
                                var labelIDs = [];
                                for (var i = 0; i < labels.length; i++) {
                                    labelIDs.push(labels[i].id);
                                }
                                db.record_addLabel(recordData.id, labelIDs, (error) => {
                                    if (error) {
                                        log.error(userID, `failed to create labels for new record (${error})`);
                                    }
                                    ActionStopCallback(user, userData, callback);
                                });
                            } else {
                                ActionStopCallback(user, userData, callback);
                            }
                        }
                    });
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
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;
    log.info(userID, `updating menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
        } else {
            log.info(userID, `menu message updated`);
        }
        callback(true);
    });
}
