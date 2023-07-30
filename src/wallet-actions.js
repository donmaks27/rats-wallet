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
 * @typedef {(user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (success: boolean) => any) => void} on_start_handler
 * @typedef {(message: bot.message_data, userData: db.user_data, args: walletCommon.args_data, callback: (success: boolean) => any) => void} on_message_handler
 * @typedef {(user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (success: boolean) => any) => void} on_stop_handler
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
    },
    archiveAccount: {
        onStart: userAction_archiveAccount_start,
        onMessage: userAction_onMessage_empty,
        onStop: userAction_archiveAccount_stop
    },
    createAccount: {
        onStart: userAction_createAccount_start,
        onMessage: userAction_createAccount_onMessage,
        onStop: userAction_createAccount_stop
    },
    deleteAccount: {
        onStart: userAction_deleteAccount_start,
        onMessage: userAction_onMessage_empty,
        onStop: userAction_deleteAccount_stop
    },
    archiveCurrency: {
        onStart: userAction_archiveCurrency_start,
        onMessage: userAction_onMessage_empty,
        onStop: userAction_archiveCurrency_stop
    },
    renameCurrency: {
        onStart: userAction_renameCurrency_start,
        onMessage: userAction_renameCurrency_onMessage,
        onStop: userAction_renameCurrency_stop
    },
    createCurrency: {
        onStart: userAction_createCurrency_start,
        onMessage: userAction_createCurrency_onMessage,
        onStop: userAction_createCurrency_stop
    }
};

const USER_REQUEST_ID_INVITE = 1;

module.exports.startUserAction = startUserAction;
module.exports.handleUserActionMessage = handleUserActionMessage;
module.exports.stopUserAction = stopUserAction;

/**
 * @param {string} action 
 * @param {walletCommon.args_data} args 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} [callback] 
 */
function startUserAction(action, args, user, userData, callback) {
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
    var currentAction = walletCommon.getUserAction(userID).action;
    if (currentAction != walletCommon.ACTION_INVALID) {
        log.warning(userID, `found active action "${currentAction}"`);
        stopUserAction(user, userData, (success) => {
            if (!success) {
                log.error(userID, `failed to stop previous action`);
                if (callback) {
                    callback(false);
                }
            } else {
                startUserAction(action, args, user, userData, callback);
            }
        });
        return;
    }

    walletCommon.setUserAction(userID, action, args);
    actionHandlers.onStart(user, userData, args, (success) => {
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
    if (currentAction.action == walletCommon.ACTION_INVALID) {
        log.info(userID, `there is no active action`);
    } else {
        const actionHandlers = WalletActionsHandlers[currentAction.action];
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction.action}"`);
        } else {
            actionHandlers.onMessage(message, userData, currentAction.args, (success) => {
                if (!success) {
                    log.error(userID, `failed to handle message for action "${currentAction.action}"`);
                } else {
                    log.info(userID, `handled message for action "${currentAction.action}"`);
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
    if (currentAction.action == walletCommon.ACTION_INVALID) {
        log.info(userID, `there is no active action`);
        if (callback) {
            callback(true);
        }
    } else {
        const actionHandlers = WalletActionsHandlers[currentAction.action];
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction}"`);
            if (callback) {
                callback(false);
            }
        } else {
            actionHandlers.onStop(user, userData, currentAction.args, (success) => {
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
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_onMessage_empty(message, userData, args, callback) {
    callback(true);
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_invite_start(user, userData, args, callback) {
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
            const menuMessageID = walletCommon.getUserMenuMessageID(userID);
            walletCommon.setUserMenuMessageID(userID, 0);
            if (menuMessageID != 0) {
                bot.deleteMessage({ chatID: userID, messageID: menuMessageID });
            }

            log.info(userID, `[invite] user received invitation keyboard`);
            callback(true);
        }
    });
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_invite_onMessage(message, userData, args, callback) {
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
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_invite_stop(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `[invite] deleting inviting keyboard...`);
    bot.sendMessage({
        chatID: userID,
        text: args.inviteSent ? `Invite sent` : `Operation canceled`,
        removeKeyboard: true
    }, (message, error) => {
        if (error) {
            log.error(userID, `[invite] failed to delete inviting keyboard (${error})`);
            callback(false);
        } else {
            log.info(userID, `[invite] inviting keyboard deleted, restoring menu message...`);
            const currentMenu = walletCommon.getUserMenu(userID);
            walletMenu.sendMenuMessage(currentMenu.menu, currentMenu.args, user, userData, (message, error) => {
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
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_changeName_start(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `[changeName] sending start message...`);
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    walletCommon.setUserMenuMessageID(userID, 0);
    bot.editMessage({
        message: { chatID: userID, id: menuMessageID },
        text: `*Changing user name*\nPlease, enter new name`, 
        parseMode: 'MarkdownV2',
        inlineKeyboard: {
            inline_keyboard: []
        }
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
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_changeName_onMessage(message, userData, args, callback) {
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
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_changeName_stop(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `[changeName] restoring menu message...`);
    const currentMenu = walletCommon.getUserMenu(userID);
    walletMenu.sendMenuMessage(currentMenu.menu, currentMenu.args, user, userData, (message, error) => {
        if (error) {
            log.error(userID, `[changeName] failed to restore menu message (${error})`);
        } else {
            log.info(userID, `[changeName] menu message restored`);
        }
        walletCommon.clearUserAction(userID);
        callback(true);
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_archiveAccount_start(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.accountID !== 'number') {
        log.error(userID, `[archiveAccount] invalid argument "accountID"`);
        callback(false);
        return;
    }
    
    const accountID = args.accountID;
    const shouldArchive = args.archive ? true : false;
    log.info(userID, `[archiveAccount] ${ shouldArchive ? 'archiving' : 'unarchiving' } account ${accountID}...`);
    db.account_edit(accountID, { is_active: !shouldArchive }, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `[archiveAccount] failed to ${ shouldArchive ? 'archive' : 'unarchive' } account ${accountID} (${error})`);
            callback(false);
        } else {
            log.info(userID, `[archiveAccount] account ${accountID} ${ shouldArchive ? 'archived' : 'unarchived' }`);
            stopUserAction(user, userData, callback);
        }
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_archiveAccount_stop(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.accountID !== 'number') {
        log.error(userID, `[archiveAccount] invalid argument "accountID"`);
        callback(false);
        return;
    }

    const accountID = args.accountID;
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    log.info(userID, `[archiveAccount] updating menu...`);
    walletMenu.changeMenuMessage(menuMessageID, 'account', { accountID: accountID }, user, userData, (message, error) => {
        walletCommon.clearUserAction(userID);
        if (error) {
            log.error(userID, `[archiveAccount] failed to update menu message (${error})`);
            callback(false);
        } else {
            log.info(userID, `[archiveAccount] menu message updated`);
            callback(true);
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_createAccount_start(user, userData, args, callback) {
    const userID = user.id;

    if (typeof args.currency !== 'string') {
        log.warning(userID, `[createAccount] invalid argument "currency"`);
        callback(false);
        return;
    }

    log.info(userID, `[createAccount] clearing menu message...`);
    const prevMenuMessageID = walletCommon.getUserMenuMessageID(userID);
    if (prevMenuMessageID == 0) {
        log.error(userID, `[createAccount] empty message menu ID`);
        callback(false);
    } else {
        bot.editMessage({
            message: { chatID: userID, id: prevMenuMessageID },
            text: `*Creating new account*\nPlease, enter name of the new account:`,
            parseMode: 'MarkdownV2',
            inlineKeyboard: { inline_keyboard: [] }
        }, (message, error) => {
            if (error) {
                log.error(userID, `[createAccount] failed to change menu message (${error})`);
                callback(false);
            } else {
                log.info(userID, `[createAccount] changed menu message, starting stage "enterName`);
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
 * @param {bot.message_data} userMessage 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_createAccount_onMessage(userMessage, userData, args, callback) {
    const userID = userMessage.from.id;

    if (!userMessage.text || (userMessage.text.length == 0)) {
        log.warning(userID, `[createAccount] empty message text`);
        callback(true);
        return;
    }
    log.info(userID, `[createAccount] handling stage "${args.stage}"...`);
    switch (args.stage) {
    case 'enterName':
        log.info(userID, `[createAccount] asking for initial ballance...`);
        bot.sendMessage({ chatID: userID, text: `Please, enter initial ballance:` }, (message, error) => {
            if (error) {
                log.error(userID, `[createAccount] failed to ask for initial ballance (${error})`);
                callback(false);
            } else {
                log.info(userID, `[createAccount] starting stage "enterBallance"`);
                args.accountName = userMessage.text;
                args.stage = 'enterBallance';
                walletCommon.setUserActionArgs(userID, args);
                callback(true);
            }
        });
        break;
        
    case 'enterBallance': 
        if (userMessage.text.match(/^-{0,1}[0-9]+(\.[0-9]*){0,1}$/g) == null) {
            log.warning(userID, `[createAccount] invalid message text, it's not a number`);
            bot.sendMessage({ chatID: userID, text: `It doesn't look like a number... Let's try again` });
            callback(true);
        } else {
            const currency = args.currency;
            const accountName = args.accountName;
            if ((typeof currency !== 'string') || (typeof accountName !== 'string')) {
                log.error(userID, `[createAccount] invalid arguments, this shouldn't happen!`);
                stopUserAction(userMessage.from, userData, callback);
            } else {
                const ballance = Math.round(Number.parseFloat(userMessage.text) * 100);
                log.info(userID, `[createAccount] creating account "${accountName}", currency ${currency}, initial ballance ${ballance / 100}...`);
                db.account_create({
                    user_id: userID, currency_code: currency, name: accountName, start_amount: ballance
                }, (accountData, error) => {
                    if (error || !accountData) {
                        log.error(userID, `[createAccount] failed to create account (${error})`);
                        bot.sendMessage({ chatID: userID, text: `Sorry, something went wrong` }, (message, error) => {
                            if (error) {
                                log.error(userID, `[createAccount] failed to send an apology (${error})`);
                            }
                            stopUserAction(userMessage.from, userData, () => { callback(false); });
                        });
                    } else {
                        log.info(userID, `[createAccount] account created`);
                        args.accountID = accountData.id;
                        walletCommon.setUserActionArgs(userID, args);
                        stopUserAction(userMessage.from, userData, callback);
                    }
                });
            }
        }
        break;

    default:
        log.error(userID, `[createAccount] invalid value of argument "stage"`);
        stopUserAction(userMessage.from, userData, () => { callback(false); });
        break;
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_createAccount_stop(user, userData, args, callback) {
    const userID = user.id;

    const accountID = args.accountID;
    const accountCreated = (typeof accountID === 'number') && (accountID != db.invalid_id);
    if (accountCreated) {
        log.info(userID, `[createAccount] opening account menu...`);
    } else {
        log.info(userID, `[createAccount] invalid account ID, restoring accounts menu...`);
    }
    walletMenu.sendMenuMessage(accountCreated ? 'account' : 'accounts', accountCreated ? { accountID: accountID } : {}, user, userData, (message, error) => {
        walletCommon.clearUserAction(userID);
        if (error) {
            log.error(userID, `[createAccount] failed to send new menu message (${error})`);
            callback(false);
        } else {
            log.info(userID, `[archiveAccount] new menu message sent`);
            callback(true);
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_deleteAccount_start(user, userData, args, callback) {
    const userID = user.id;
    const accountID = args.accountID;
    if (typeof accountID !== 'number') {
        log.warning(userID, `[deleteAccount] invalid argument "accountID"`);
        callback(false);
        return;
    }
    db.account_delete(accountID, (error) => {
        if (error) {
            log.error(userID, `[deleteAccount] failed to delete account ${accountID} (${error})`);
        }
        stopUserAction(user, userData, callback);
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_deleteAccount_stop(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `[deleteAccount] switching to accounts menu...`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'accounts', {}, user, userData, (message, error) => {
        walletCommon.clearUserAction(userID);
        if (error) {
            log.error(userID, `[deleteAccount] failed switch to accounts menu (${error})`);
            callback(false);
        } else {
            log.info(userID, `[deleteAccount] switched to accounts menu`);
            callback(true);
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_archiveCurrency_start(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.currency !== 'string') {
        log.error(userID, `[archiveCurrency] invalid argument "currency"`);
        callback(false);
        return;
    }
    
    const currencyCode = args.currency;
    const shouldArchive = args.archive ? true : false;
    log.info(userID, `[archiveCurrency] ${ shouldArchive ? 'archiving' : 'unarchiving' } currency ${currencyCode}...`);
    db.currency_edit(currencyCode, { is_active: !shouldArchive }, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `[archiveCurrency] failed to ${ shouldArchive ? 'archive' : 'unarchive' } currency ${currencyCode} (${error})`);
            callback(false);
        } else {
            log.info(userID, `[archiveCurrency] currency ${currencyCode} ${ shouldArchive ? 'archived' : 'unarchived' }`);
            stopUserAction(user, userData, callback);
        }
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_archiveCurrency_stop(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.currency !== 'string') {
        log.error(userID, `[archiveCurrency] invalid argument "currency"`);
        callback(false);
        return;
    }

    const currencyCode = args.currency;
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    log.info(userID, `[archiveCurrency] updating menu...`);
    walletMenu.changeMenuMessage(menuMessageID, 'currency', { currency: currencyCode }, user, userData, (message, error) => {
        walletCommon.clearUserAction(userID);
        if (error) {
            log.error(userID, `[archiveCurrency] failed to update menu message (${error})`);
            callback(false);
        } else {
            log.info(userID, `[archiveCurrency] menu message updated`);
            callback(true);
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_renameCurrency_start(user, userData, args, callback) {
    const userID = user.id;
    if (typeof args.currency !== 'string') {
        log.error(userID, `[renameCurrency] invalid argument "currency"`);
        callback(false);
        return;
    }
    const currencyCode = args.currency;
    const shouldClearName = args.clearName ? true : false;
    if (shouldClearName) {
        log.info(userID, `[renameCurrency] clearing name of currency ${currencyCode}...`);
        db.currency_edit(currencyCode, { name: null }, (currencyData, error) => {
            if (error) {
                log.error(userID, `[renameCurrency] failed to clear name of currency ${currencyCode} (${error})`);
                callback(false);
            } else {
                log.info(userID, `[renameCurrency] currency name of ${currencyCode} cleared`);
                stopUserAction(user, userData, callback);
            }
        });
    } else {
        log.info(userID, `[renameCurrency] changing name of currency ${currencyCode}...`);
        const menuMessageID = walletCommon.getUserMenuMessageID(userID);
        walletCommon.setUserMenuMessageID(userID, 0);
        bot.editMessage({ 
            message: { chatID: userID, id: menuMessageID }, 
            text: `*Renaming currency ${bot.escapeMarkdown(currencyCode)}*\nPlease, enter new currency name`, 
            parseMode: 'MarkdownV2',
            inlineKeyboard: { inline_keyboard:[] } 
        }, (message, error) => {
            if (error) {
                log.error(userID, `[renameCurrency] failed to send message about changing name of currency ${currencyCode} (${error})`);
                callback(false);
            } else {
                log.info(userID, `[renameCurrency] sent message about changing name of currency ${currencyCode}`);
                callback(true);
            }
        });
    }
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_renameCurrency_onMessage(message, userData, args, callback) {
    const userID = message.from.id;
    const shouldClearName = args.clearName ? true : false;
    if (shouldClearName) {
        log.warning(userID, `[renameCurrency] shouldClearName is true, it shouldn't happen, action should be stopped already`);
        callback(true);
        return;
    }
    if (!message.text || (message.text.length == 0)) {
        log.warning(userID, `[renameCurrency] empty message text`);
        callback(true);
        return;
    }
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    db.currency_edit(currencyCode, { name: message.text }, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `[renameCurrency] failed to change name of currency ${currencyCode} (${error})`);
            callback(false);
        } else {
            log.info(userID, `[renameCurrency] changed name of currency ${currencyCode} (${currencyData.name})`);
            stopUserAction(message.from, userData, (success) => { callback(true); });
        }
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_renameCurrency_stop(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `[renameCurrency] returning to currency ${args.currency} menu`);
    walletMenu.changeMenuMessage(walletCommon.getUserMenuMessageID(userID), 'currency', { currency: args.currency }, user, userData, (message, error) => {
        walletCommon.clearUserAction(userID);
        if (error) {
            log.error(userID, `[renameCurrency] failed to return to currency ${args.currency} menu (${error})`);
            callback(false);
        } else {
            log.info(userID, `[renameCurrency] returned to currency ${args.currency} menu`);
            callback(true);
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_createCurrency_start(user, userData, args, callback) {
    const userID = user.id;
    log.info(userID, `[createCurrency] sending message abount new currency code...`);
    const menuMessageID = walletCommon.getUserMenuMessageID(userID);
    walletCommon.setUserMenuMessageID(userID, 0);
    bot.editMessage({
        message: { chatID: userID, id: menuMessageID },
        text: `*Creating new currency*\nPlease, enter new currency code`,
        parseMode: 'MarkdownV2',
        inlineKeyboard: { inline_keyboard: [] }
    }, (message, error) => {
        if (error) {
            log.error(userID, `[createCurrency] failed to send message abount new currency code (${error})`);
            callback(false);
        } else {
            log.info(userID, `[createCurrency] sent message abount new currency code`);
            callback(true);
        }
    });
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_createCurrency_onMessage(message, userData, args, callback) {
    const userID = message.from.id;
    if (!message.text || (message.text.length == 0)) {
        log.warning(userID, `[createCurrency] empty message text`);
        callback(true);
        return;
    }
    const currencyCode = message.text;
    log.info(userID, `[createCurrency] searching currency ${currencyCode}...`);
    db.currency_get(currencyCode, (currencyData, error) => {
        if (currencyData) {
            log.warning(userID, `[createCurrency] currency ${currencyCode} already created`);
            bot.sendMessage({ chatID: userID, text: `Such currency already exists, try again` });
            callback(true);
        } else {
            log.info(userID, `[createCurrency] didn't find currency ${currencyCode}, creating new currency...`);
            db.currency_create({ code: currencyCode }, (currencyData, error) => {
                if (error) {
                    log.error(userID, `[createCurrency] failed to create currency ${currencyCode} (${error})`);
                    stopUserAction(message.from, userData, () => callback(false));
                } else {
                    log.info(userID, `[createCurrency] created currency ${currencyCode}`);
                    args.currency = currencyCode;
                    walletCommon.setUserActionArgs(userID, args);
                    stopUserAction(message.from, userData, callback);
                }
            });
        }
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(success: boolean) => any} callback
 */
function userAction_createCurrency_stop(user, userData, args, callback) {
    const userID = user.id;
    const currencyCreated = typeof args.currency === 'string' ? true : false;
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    if (!currencyCreated) {
        log.info(userID, `[createCurrency] switching to currencies menu...`);
        walletMenu.sendMenuMessage('currencies', {}, user, userData, (message, error) => {
            walletCommon.clearUserAction(userID);
            if (error) {
                log.error(userID, `[createCurrency] failed to switch to currencies menu (${error})`);
                callback(false);
            } else {
                log.info(userID, `[createCurrency] switched to currencies menu`);
                callback(true);
            }
        });
    } else {
        log.info(userID, `[createCurrency] switching to currency menu ${currencyCode}...`);
        walletMenu.sendMenuMessage('currency', { currency: currencyCode }, user, userData, (message, error) => {
            walletCommon.clearUserAction(userID);
            if (error) {
                log.error(userID, `[createCurrency] failed to switch to currency menu ${currencyCode} (${error})`);
                callback(false);
            } else {
                log.info(userID, `[createCurrency] switched to currency menu ${currencyCode}`);
                callback(true);
            }
        });
    }
}