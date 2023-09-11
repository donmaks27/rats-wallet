// @ts-check

var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var menuBase = require('../menu/wallet-menu-base');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'enterRecordAmount';
const ACTION_SHORT_NAME = 'eA';

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

const ARG_PREV_PAGE = 'pP';
const ARG_PREV_FILTER_ID = 'pF';
const ARG_RECORD_AMOUNT = 'rA';

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : null;

    log.info(userID, `changing menu message...`);
    bot.editMessage({
        message: { chatID: userID, id: walletCommon.getUserMenuMessageID(userID) },
        text: `*Record amount*\nPlease, enter the amount for the new record:`,
        parseMode: 'MarkdownV2',
        inlineKeyboard: { inline_keyboard: [[{
            text: `Cancel`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID })
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
    if (!message.text || (message.text.length == 0)) {
        log.warning(userID, `empty message text`);
        callback(true);
        return;
    }
    if (message.text.match(/^(-|\+){0,1}([0-9]+|[0-9]*\.[0-9]+)$/g) == null) {
        log.warning(userID, `invalid message text, it's not a number`);
        bot.sendMessage({ chatID: userID, text: `It doesn't look like a number... Let's try again` });
        callback(true);
    } else {
        const amount = Math.floor(Number.parseFloat(message.text) * 100);
        if (amount == 0) {
            log.warning(userID, `invalid message text, number is 0`);
            bot.sendMessage({ chatID: userID, text: `Amount can't be 0. Let's try again` });
            callback(true);
        } else {
            log.info(userID, bot.escapeMarkdown(`entered amount ${amount / 100}`));
            args.amount = amount;
            walletCommon.setUserActionArgs(userID, args);
            ActionStopCallback(message.from, userData, callback);
        }
    }
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : null;
    const amount = args.amount;

    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    if (menuMessageID > 0) {
        bot.deleteMessage({ chatID: userID, messageID: menuMessageID });
    }
    var menuArgs = { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID };
    if (typeof amount === 'number') {
        menuArgs[ARG_RECORD_AMOUNT] = amount;
    }
    walletMenu.sendMenuMessage('createRecord', menuArgs, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to create record menu (${error})`);
        } else {
            log.info(userID, `returned to create record menu`);
        }
        callback(true);
    });
}
