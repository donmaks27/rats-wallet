// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var menuBase = require('../menu/wallet-menu-base');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'changeRecordNote';
const ACTION_SHORT_NAME = 'chRN';

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
            onMessage: onUserMessage,
            stop: stopAction
        }
    };
}

const ARG_RECORD_ID = 'rID';
const ARG_CLEAR = 'cl';

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    const recordID = typeof args[ARG_RECORD_ID] === 'number' ? args[ARG_RECORD_ID] : db.invalid_id;
    const shouldClearNote = args[ARG_CLEAR] ? true : false;

    if (shouldClearNote) {
        log.info(userID, `clearing record's note...`);
        if (recordID == db.invalid_id) {
            db.record_editTemp(userID, { note: '' }, (error) => {
                if (error) {
                    log.error(userID, `failed to clear note of temp record (${error})`);
                } else {
                    log.info(userID, `temp record's note cleared`);
                }
                ActionStopCallback(user, userData, callback);
            });
        } else {
            db.record_edit(recordID, { note: '' }, (recordData, error) => {
                if (error || !recordData) {
                    log.error(userID, `failed to clear note of record ${recordID} (${error})`);
                } else {
                    log.info(userID, `cleared note of record ${recordID}`);
                }
                ActionStopCallback(user, userData, callback);
            });
        }
        return;
    }

    log.info(userID, `changing menu message...`);
    bot.editMessage({
        message: { chatID: userID, id: walletCommon.getUserMenuMessageID(userID) },
        text: `*Record note*\nPlease, enter the note for the record:`,
        parseMode: 'MarkdownV2',
        inlineKeyboard: { inline_keyboard: [[{
            text: `Cancel`,
            callback_data: menuBase.makeCancelButton()
        }]] }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to update menu message (${error})`);
            callback(false);
        } else {
            log.info(userID, `menu message updated`);
            callback(true);
        }
    });
}
/**
 * @type {actionBase.action_message_func}
 */
function onUserMessage(message, userData, args, callback) {
    const userID = message.from.id;
    const recordID = typeof args[ARG_RECORD_ID] === 'number' ? args[ARG_RECORD_ID] : db.invalid_id;

    args.hadMessage = true;
    walletCommon.setUserActionArgs(userID, args);

    if (!message.text || (message.text.length == 0)) {
        log.warning(userID, `empty message text`);
        callback(true);
    } else {
        log.info(userID, `entered note "${message.text}"`);
        if (recordID == db.invalid_id) {
            db.record_editTemp(userID, { note: message.text }, (error) => {
                if (error) {
                    log.error(userID, `failed to change note of temp record (${error})`);
                    bot.sendMessage({ chatID: userID, text: `Failed to updated record's note` });
                    callback(false);
                } else {
                    log.info(userID, `temp record's note updated`);
                    ActionStopCallback(message.from, userData, callback);
                }
            });
        } else {
            db.record_edit(recordID, { note: message.text }, (recordData, error) => {
                if (error || !recordData) {
                    log.error(userID, `failed to change note of record ${recordID} (${error})`);
                    bot.sendMessage({ chatID: userID, text: `Failed to updated record's note` });
                    callback(false);
                } else {
                    log.info(userID, `updated note of record ${recordID}`);
                    ActionStopCallback(message.from, userData, callback);
                }
            });
        }
    }
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const recordID = typeof args[ARG_RECORD_ID] === 'number' ? args[ARG_RECORD_ID] : db.invalid_id;

    var menuMessageID = walletCommon.getUserMenuMessageID(userID);
    if (args.hadMessage) {
        if (menuMessageID != 0) {
            bot.deleteMessage({ chatID: userID, messageID: menuMessageID });
        }
        menuMessageID = 0;
    }
    delete args[ARG_CLEAR];
    delete args.hadMessage;

    walletMenu.changeMenuMessage(menuMessageID, recordID == db.invalid_id ? 'createRecord' : 'record', args, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to create record menu (${error})`);
        } else {
            log.info(userID, `returned to create record menu`);
        }
        callback(true);
    });
}
