// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'createAccount';

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

    if (typeof args.currency !== 'string') {
        log.warning(userID, `invalid argument "currency"`);
        callback(false);
        return;
    }

    log.info(userID, `clearing menu message...`);
    const prevMenuMessageID = walletCommon.getUserMenuMessageID(userID);
    if (prevMenuMessageID == 0) {
        log.error(userID, `empty message menu ID`);
        callback(false);
    } else {
        bot.editMessage({
            message: { chatID: userID, id: prevMenuMessageID },
            text: `*Creating new account*\nPlease, enter name of the new account:`,
            parseMode: 'MarkdownV2',
            inlineKeyboard: { inline_keyboard: [] }
        }, (message, error) => {
            if (error) {
                log.error(userID, `failed to change menu message (${error})`);
                callback(false);
            } else {
                log.info(userID, `changed menu message, starting stage "enterName`);
                walletCommon.setUserMenuMessageID(userID, 0);
                walletCommon.setUserMenu(userID, 'accounts'); // Just to be sure
                args.stage = 'enterName';
                walletCommon.setUserActionArgs(userID, args);
                callback(true);
            }
        });
    }
}
/**
 * @type {actionBase.action_message_func}
 */
function onUserMessage(userMessage, userData, args, callback) {
    const userID = userMessage.from.id;

    if (!userMessage.text || (userMessage.text.length == 0)) {
        log.warning(userID, `empty message text`);
        callback(true);
        return;
    }
    log.info(userID, `handling stage "${args.stage}"...`);
    switch (args.stage) {
    case 'enterName':
        log.info(userID, `asking for initial ballance...`);
        bot.sendMessage({ chatID: userID, text: `Please, enter initial ballance:` }, (message, error) => {
            if (error) {
                log.error(userID, `failed to ask for initial ballance (${error})`);
                callback(false);
            } else {
                log.info(userID, `starting stage "enterBallance"`);
                args.accountName = userMessage.text;
                args.stage = 'enterBallance';
                walletCommon.setUserActionArgs(userID, args);
                callback(true);
            }
        });
        break;
        
    case 'enterBallance': 
        if (userMessage.text.match(/^-{0,1}[0-9]+(\.[0-9]*){0,1}$/g) == null) {
            log.warning(userID, `invalid message text, it's not a number`);
            bot.sendMessage({ chatID: userID, text: `It doesn't look like a number... Let's try again` });
            callback(true);
        } else {
            const currency = args.currency;
            const accountName = args.accountName;
            if ((typeof currency !== 'string') || (typeof accountName !== 'string')) {
                log.error(userID, `invalid arguments, this shouldn't happen!`);
                ActionStopCallback(userMessage.from, userData, callback);
            } else {
                const ballance = Math.round(Number.parseFloat(userMessage.text) * 100);
                log.info(userID, `creating account "${accountName}", currency ${currency}, initial ballance ${ballance / 100}...`);
                db.account_create({
                    user_id: userID, currency_code: currency, name: accountName, start_amount: ballance
                }, (accountData, error) => {
                    if (error || !accountData) {
                        log.error(userID, `failed to create account (${error})`);
                        bot.sendMessage({ chatID: userID, text: `Sorry, something went wrong` }, (message, error) => {
                            if (error) {
                                log.error(userID, `failed to send an apology (${error})`);
                            }
                            ActionStopCallback(userMessage.from, userData, () => { callback(false); });
                        });
                    } else {
                        log.info(userID, `account created`);
                        args.accountID = accountData.id;
                        walletCommon.setUserActionArgs(userID, args);
                        ActionStopCallback(userMessage.from, userData, callback);
                    }
                });
            }
        }
        break;

    default:
        log.error(userID, `invalid stage`);
        ActionStopCallback(userMessage.from, userData, () => { callback(false); });
        break;
    }
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;

    const accountID = args.accountID;
    const accountCreated = (typeof accountID === 'number') && (accountID != db.invalid_id);
    if (accountCreated) {
        log.info(userID, `opening account menu...`);
    } else {
        log.info(userID, `invalid account ID, restoring accounts menu...`);
    }
    walletMenu.sendMenuMessage(accountCreated ? 'account' : 'accounts', accountCreated ? { accountID: accountID } : {}, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `failed to send new menu message (${error})`);
        } else {
            log.info(userID, `new menu message sent`);
        }
        callback(true);
    });
}