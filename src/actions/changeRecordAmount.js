// @ts-check

var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var menuBase = require('../menu/wallet-menu-base');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'changeRecordAmount';
const ACTION_SHORT_NAME = 'chRA';

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

const ARG_FROM_MENU = 'from';
const ARG_OUTPUT_ARGUMENT = 'out';

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `changing menu message...`);
    bot.editMessage({
        message: { chatID: userID, id: walletCommon.getUserMenuMessageID(userID) },
        text: `*Record amount*\nPlease, enter the amount for the record:`,
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
    const outArg = typeof args[ARG_OUTPUT_ARGUMENT] === 'string' ? args[ARG_OUTPUT_ARGUMENT] : 'amount';

    args.hadMessage = true;
    walletCommon.setUserActionArgs(userID, args);

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
        } else if (amount < 0) {
            log.warning(userID, `invalid message text, number is less then 0`);
            bot.sendMessage({ chatID: userID, text: `Amount can't be less then 0. Let's try again` });
            callback(true);
        } else {
            log.info(userID, `entered amount ${amount / 100}`);
            args[outArg] = amount;
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
    const prevMenu = typeof args[ARG_FROM_MENU] === 'string' ? args[ARG_FROM_MENU] : 'main';

    var menuMessageID = walletCommon.getUserMenuMessageID(userID);
    if (args.hadMessage) {
        if (menuMessageID != 0) {
            bot.deleteMessage({ chatID: userID, messageID: menuMessageID });
        }
        menuMessageID = 0;
    }
    delete args.hadMessage;
    delete args[ARG_OUTPUT_ARGUMENT];
    delete args[ARG_FROM_MENU];

    walletMenu.changeMenuMessage(menuMessageID, prevMenu, args, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to create record menu (${error})`);
        } else {
            log.info(userID, `returned to create record menu`);
        }
        callback(true);
    });
}
