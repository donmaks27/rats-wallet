// @ts-check

var logModule = require('./log');
const logPrefix = '[WALLET][ACTION]';
const log = {
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    error: (userID, msg) => logModule.error(`${logPrefix}[USER ${userID}] ${msg}`),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    warning: (userID, msg) => logModule.warning(`${logPrefix}[USER ${userID}] ${msg}`),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    info: (userID, msg) => logModule.info(`${logPrefix}[USER ${userID}] ${msg}`)
};

var db  = require('./database');
var bot = require('./telegram-bot');

var walletCommon = require('./wallet-common');
var walletMenu = require('./wallet-menu');

/**
 * @typedef {(user: bot.user_data, userData: db.user_data, callback: (success: boolean) => any) => void} on_start_handler
 * @typedef {(message: bot.message_data, userData: db.user_data, callback: (success: boolean) => any) => void} on_message_handler
 * @typedef {(user: bot.user_data, userData: db.user_data, callback: (success: boolean) => any) => void} on_stop_handler
 */

/** @type {{ [action: string]: { onStart: on_start_handler, onMessage: on_message_handler, onStop: on_stop_handler } }} */
const WalletActionsHandlers = {
    invite: {
        onStart: userAction_invite_start,
        onMessage: userAction_invite_onMessage,
        onStop: userAction_invite_stop
    },
    changeName: {
        onStart: userAction_changeName_start,
        onMessage: userAction_changeName_onMessage,
        onStop: userAction_changeName_stop
    }
};

const USER_REQUEST_ID_INVITE = 1;

module.exports.startUserAction = startUserAction;
module.exports.handleUserActionMessage = handleUserActionMessage;
module.exports.stopUserAction = stopUserAction;

/**
 * @param {string} action 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} [callback] 
 */
function startUserAction(action, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `starting action "${action}"...`);

    const actionHandlers = WalletActionsHandlers[action];
    if (!actionHandlers) {
        log.warning(userID, `invalid user action "${action}"`);
        if (callback) {
            callback(false);
        }
        return;
    }
    var currentAction = walletCommon.getUserAction(userID);
    if (currentAction != walletCommon.ACTION_INVALID) {
        log.warning(userID, `found active action "${currentAction}"`);
        stopUserAction(user, userData, (success) => {
            if (!success) {
                log.error(userID, `failed to stop previous action`);
                if (callback) {
                    callback(false);
                }
            } else {
                startUserAction(action, user, userData, callback);
            }
        });
        return;
    }

    walletCommon.setUserAction(userID, action);
    actionHandlers.onStart(user, userData, (success) => {
        if (!success) {
            log.error(userID, `failed to start user action "${action}"`);
            walletCommon.clearUserAction(userID);
        } else {
            log.info(userID, `user action "${action}" started`);
        }
        if (callback) {
            callback(success);
        }
    });
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 */
function handleUserActionMessage(message, userData) {
    const userID = message.from.id;
    log.info(userID, `handling current action message...`);
    var currentAction = walletCommon.getUserAction(userID);
    if (currentAction == walletCommon.ACTION_INVALID) {
        log.info(userID, `there is no active action`);
    } else {
        const actionHandlers = WalletActionsHandlers[currentAction];
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction}"`);
        } else {
            actionHandlers.onMessage(message, userData, (success) => {
                if (!success) {
                    log.error(userID, `failed to handle message for action "${currentAction}"`);
                } else {
                    log.info(userID, `handled message for action "${currentAction}"`);
                }
            });
        }
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} [callback] 
 */
function stopUserAction(user, userData, callback) {
    const userID = user.id;
    log.info(userID, `stopping current action...`);
    var currentAction = walletCommon.getUserAction(userID);
    if (currentAction == walletCommon.ACTION_INVALID) {
        log.info(userID, `there is no active action`);
        if (callback) {
            callback(true);
        }
    } else {
        const actionHandlers = WalletActionsHandlers[currentAction];
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction}"`);
            if (callback) {
                callback(false);
            }
        } else {
            actionHandlers.onStop(user, userData, (success) => {
                if (!success) {
                    log.error(userID, `failed to stop action "${currentAction}"`);
                } else {
                    log.info(userID, `stopped action "${currentAction}"`);
                }
                if (callback) {
                    callback(success);
                }
            });
        }
    }
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} callback
 */
function userAction_invite_start(user, userData, callback) {
    const userID = user.id;
    log.info(userID, `[invite] sending invitation keyboard...`);
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
            log.error(userID, `[invite] failed to invitation keyboard (${error})`);
            callback(false);
        } else {
            log.info(userID, `[invite] user received invitation keyboard`);
            callback(true);
        }
    });
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} callback
 */
function userAction_invite_onMessage(message, userData, callback) {
    const userID = message.from.id;
    if (!message.user_shared) {
        log.warning(userID, `[invite] expected message with user link`);
        callback(false);
        return;
    }
    if (message.user_shared.request_id != USER_REQUEST_ID_INVITE) {
        log.warning(userID, `[invite] wrong request ID ${message.user_shared.request_id} (expected ${USER_REQUEST_ID_INVITE})`);
        callback(false);
        return;
    }

    const invitedUserID = message.user_shared.user_id;
    log.info(userID, `[invite] searching for invited user ${invitedUserID}...`);
    db.user_get(invitedUserID, (invitedUserData, error) => {
        if (invitedUserData) {
            log.warning(userID, `[invite] invited user ${invitedUserID} already registered`);
            bot.sendMessage({ chatID: userID, text: `User already registered, no need to invite him` });
            callback(true);
            return;
        }
        log.info(userID, `[invite] didn't find invited user ${invitedUserID} in database, searching for invite...`);
        walletCommon.findUserInvite(invitedUserID, (inviteData, error) => {
            if (inviteData) {
                log.warning(userID, `[invite] found active invitation for invited user ${invitedUserID}: ` + JSON.stringify(inviteData));
                bot.sendMessage({ chatID: userID, text: `User already have active invite, no need to invite him again` });
                callback(true);
                return;
            }
            log.info(userID, `[invite] didn't find invite for user ${invitedUserID}, creating the new one...`);
            let inviteDate = new Date();
            db.invite_create({
                id: invitedUserID,
                inviting_user_id: userID,
                invite_date: inviteDate,
                expire_date: new Date(inviteDate.valueOf() + 24*60*60*1000)
            }, (error) => {
                if (error) {
                    log.error(userID, `[invite] failed to create invite for user ${invitedUserID} (${error})`);
                    bot.sendMessage({ chatID: userID, text: `Something went wrong, failed to create invite` });
                    callback(true);
                    return;
                }
                bot.sendMessage({ 
                    chatID: invitedUserID, 
                    text: `Hello! ${message.from.first_name} invited you here! Invite expires in 24 hours\nPlease, enter your name`
                });
                log.info(userID, `[invite] invite for user ${invitedUserID} created`);
                walletCommon.setUserActionArgs(userID, { inviteSent: true });
                stopUserAction(message.from, userData, callback);
            });
        });
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} callback
 */
function userAction_invite_stop(user, userData, callback) {
    const userID = user.id;
    const actionArgs = walletCommon.getUserActionArgs(userID);
    log.info(userID, `[invite] deleting inviting keyboard...`);
    bot.sendMessage({
        chatID: userID,
        text: actionArgs && actionArgs.inviteSent ? `Invite sent` : `Operation canceled`,
        removeKeyboard: true
    }, (message, error) => {
        if (error) {
            log.error(userID, `[invite] failed to delete inviting keyboard (${error})`);
            callback(false);
        } else {
            log.info(userID, `[invite] inviting keyboard deleted, restoring menu message...`);
            walletMenu.sendMenuMessage(walletCommon.getUserMenu(userID), user, userData, (message, error) => {
                if (error) {
                    log.error(userID, `[invite] failed to restore menu message (${error})`);
                } else {
                    log.info(userID, `[invite] menu message restored`);
                }
                walletCommon.clearUserAction(userID);
                callback(true);
            });
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} callback
 */
function userAction_changeName_start(user, userData, callback) {
    const userID = user.id;
    log.info(userID, `[changeName] sending start message...`);
    bot.sendMessage({
        chatID: user.id,
        text: `*Changing user name*\nPlease, enter new name`,
        parseMode: 'MarkdownV2'
    }, (message, error) => {
        if (error) {
            log.error(userID, `[changeName] failed to send start message (${error})`);
            callback(false);
        } else {
            log.info(userID, `[changeName] sent start message`);
            callback(true);
        }
    });
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} callback
 */
function userAction_changeName_onMessage(message, userData, callback) {
    const userID = message.from.id;
    if (!message.text || (message.text.length == 0)) {
        log.error(userID, `[changeName] empty new name`);
        callback(false);
    } else {
        db.user_edit(userID, { name: message.text }, (data, error) => {
            if (error || !data) {
                log.error(userID, `[changeName] failed to update user name (${error})`);
                callback(false);
            } else {
                log.info(userID, `[changeName] name is changed`);
                bot.sendMessage({ chatID: message.from.id, text: `The name has been changed` }, (msg, error) => {
                    stopUserAction(message.from, data, callback);
                });
            }
        });
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} callback
 */
function userAction_changeName_stop(user, userData, callback) {
    const userID = user.id;
    log.info(userID, `[changeName] restoring menu message...`);
    walletMenu.sendMenuMessage(walletCommon.getUserMenu(user.id), user, userData, (message, error) => {
        if (error) {
            log.error(userID, `[changeName] failed to restore menu message (${error})`);
        } else {
            log.info(userID, `[changeName] menu message restored`);
        }
        walletCommon.clearUserAction(userID);
        callback(true);
    });
}