// @ts-check

var bot = require('../telegram-bot');
var db  = require('../database');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');
var actionBase = require('./wallet-action-base');

const ACTION_NAME = 'invite';
const USER_REQUEST_ID_INVITE = 1;

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

    log.info(userID, `sending invitation keyboard...`);
    bot.sendMessage({
        chatID: user.id,
        text: `*Send invite*\nPlease, choose the user you want to invite`,
        parseMode: 'MarkdownV2',
        keyboard: {
            is_persistent: false,
            one_time_keyboard: true,
            resize_keyboard: true,
            keyboard: [[{
                text: `Choose user...`,
                request_user: {
                    request_id: USER_REQUEST_ID_INVITE,
                    user_is_bot: false
                }
            }]]
        }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to send invitation keyboard (${error})`);
            callback(false);
        } else {
            const menuMessageID = walletCommon.getUserMenuMessageID(userID);
            walletCommon.setUserMenuMessageID(userID, 0);
            if (menuMessageID != 0) {
                bot.deleteMessage({ chatID: userID, messageID: menuMessageID });
            }
            log.info(userID, `user received invitation keyboard`);
            callback(true);
        }
    });
}
/**
 * @type {actionBase.action_message_func}
 */
function onUserMessage(message, userData, args, callback) {
    const userID = message.from.id;
    if (!message.user_shared) {
        log.warning(userID, `expected message with user link`);
        callback(true);
        return;
    }
    if (message.user_shared.request_id != USER_REQUEST_ID_INVITE) {
        log.warning(userID, `wrong request ID ${message.user_shared.request_id} (expected ${USER_REQUEST_ID_INVITE})`);
        callback(true);
        return;
    }

    const invitedUserID = message.user_shared.user_id;
    log.info(userID, `searching for invited user ${invitedUserID}...`);
    db.user_get(invitedUserID, (invitedUserData, error) => {
        if (invitedUserData) {
            log.warning(userID, `invited user ${invitedUserID} already registered`);
            bot.sendMessage({ chatID: userID, text: `User already registered, no need to invite him` });
            callback(true);
            return;
        }
        log.info(userID, `didn't find invited user ${invitedUserID} in database, searching for invite...`);
        walletCommon.findUserInvite(invitedUserID, (inviteData, error) => {
            if (inviteData) {
                log.warning(userID, `found active invitation for invited user ${invitedUserID}: ` + JSON.stringify(inviteData));
                bot.sendMessage({ chatID: userID, text: `User already have active invite, no need to invite him again` });
                callback(true);
                return;
            }
            log.info(userID, `didn't find invite for user ${invitedUserID}, creating the new one...`);
            let inviteDate = new Date();
            db.invite_create({
                id: invitedUserID,
                inviting_user_id: userID,
                invite_date: inviteDate,
                expire_date: new Date(inviteDate.valueOf() + 24*60*60*1000)
            }, (error) => {
                if (error) {
                    log.error(userID, `failed to create invite for user ${invitedUserID} (${error})`);
                    bot.sendMessage({ chatID: userID, text: `Something went wrong, failed to create invite` });
                    callback(false);
                    return;
                }
                bot.sendMessage({ 
                    chatID: invitedUserID, 
                    text: `Hello! ${message.from.first_name} invited you here! Invite expires in 24 hours\nPlease, enter your name`
                });
                log.info(userID, `invite for user ${invitedUserID} created`);
                walletCommon.setUserActionArgs(userID, { inviteSent: true });
                ActionStopCallback(message.from, userData, callback);
            });
        });
    });
}
/**
 * @type {actionBase.action_stop_func}
 */
function stopAction(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `deleting inviting keyboard...`);
    bot.sendMessage({
        chatID: userID,
        text: args.inviteSent ? `Invite sent` : `Operation canceled`,
        removeKeyboard: true
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to delete inviting keyboard (${error})`);
            callback(false);
        } else {
            log.info(userID, `inviting keyboard deleted, restoring menu message...`);
            const currentMenu = walletCommon.getUserMenu(userID);
            walletMenu.sendMenuMessage(currentMenu.menu, currentMenu.args, user, userData, (message, error) => {
                if (error) {
                    log.error(userID, `failed to restore menu message (${error})`);
                } else {
                    log.info(userID, `menu message restored`);
                }
                callback(true);
            });
        }
    });
}