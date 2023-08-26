// @ts-check

var bot = require('../telegram-bot');
var walletCommon = require('../wallet-common');
var menuBase = require('../menu/wallet-menu-base');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'changeRecordsPage';
const ACTION_SHORT_NAME = 'chPage';

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

/**
 * @type {actionBase.action_start_func}
 */
function startAction(user, userData, args, callback) {
    const userID = user.id;
    const maxPage = args.maxPage;
    if (typeof maxPage !== 'number') {
        log.error(userID, `invalid argument "maxPage"`);
        callback(false);
        return;
    }

    log.info(userID, `changing menu message...`);
    bot.editMessage({
        message: { chatID: userID, id: walletCommon.getUserMenuMessageID(userID) },
        parseMode: 'MarkdownV2',
        text: `*Records*\nPlease, enter the number of page ${bot.escapeMarkdown(`(1-${maxPage})`)}:`,
        inlineKeyboard: { inline_keyboard: [
            [
                {
                    text: '<< Back to Records',
                    callback_data: menuBase.makeMenuButton('records', { page: args.page })
                }
            ]
        ] }
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

    const maxPage = typeof args.maxPage === 'number' ? args.maxPage : 0;
    if (message.text.match(/^\+{0,1}[0-9]+$/g) == null) {
        log.warning(userID, `invalid message text, it's not a number`);
        bot.sendMessage({ chatID: userID, text: `It doesn't look like a number... Let's try again` });
        callback(true);
    } else {
        const newPage = Number.parseInt(message.text);
        if (newPage < 1) {
            log.warning(userID, `invalid message text, number less then 1`);
            bot.sendMessage({ chatID: userID, text: `Page should be more then 0. Let's try again` });
            callback(true);
        } else if (newPage > maxPage) {
            log.warning(userID, `invalid message text, number greater then max (${maxPage})`);
            bot.sendMessage({ chatID: userID, text: `Page should be less or equal then ${maxPage}. Let's try again` });
            callback(true);
        } else {
            log.info(userID, `changing page to ${newPage}`);
            args.newPage = newPage - 1;
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
    const page = typeof args.newPage === 'number' ? args.newPage : args.page;
    log.info(userID, `returning to records menu, page ${page}`);

    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    if (menuMessageID > 0) {
        bot.deleteMessage({ chatID: userID, messageID: menuMessageID });
    }
    walletMenu.sendMenuMessage('records', { page: page }, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to return to records menu (page ${page}) (${error})`);
        } else {
            log.info(userID, `returned to records menu (page ${page})`);
        }
        callback(true);
    });
}
