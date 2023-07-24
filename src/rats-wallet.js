// @ts-check

var logModule = require('./log');
var db = require('./database');
var bot = require('./telegram-bot');
var dateFormat = require('./date-format');

module.exports.setupBotCommands = setupBotCommands;
module.exports.onBotUpdate = onBotUpdate;

const logPrefix = '[WALLET]';
const log = {
    error: (msg) => logModule.error(logPrefix + msg),
    warning: (msg) => logModule.warning(logPrefix + msg),
    info: (msg) => logModule.info(logPrefix + msg),
};

const ERROR_MESSAGE_NOT_REGISTERED = `I can't find you in the database. Ask somebody to invite you!`;

const REQUEST_ID_INVITE_USER = 1;

/** @type {{ [command: string]: { description: string, handler: (message: bot.message_data) => any } }} */
const bot_commands = {
    start: {
        description: 'Start interaction with me',
        handler: commandHandler_start
    },
    invite: {
        description: 'Invite another user',
        handler: commandHandler_invite
    }
};

/**
 * @param {(error?: string) => any} callback 
 */
function setupBotCommands(callback) {
    /** @type {{ [command: string]: string }} */
    var commands = {};
    for (var command in bot_commands) {
        commands[command] = bot_commands[command].description;
    }
    bot.setMyCommands(commands, (success, error) => {
        if (error) {
            callback(`failed to update commands list: ` + error);
        } else if (!success) {
            callback(`failed to update commands list`);
        } else {
            callback();
        }
    });
}

/**
 * @param {bot.update_data} updateData 
 */
function onBotUpdate(updateData) {
    log.info(JSON.stringify(updateData));
    if (updateData.message && (updateData.message.chat.type == 'private')) {
        handleUserMessage(updateData.message);
    }
}
/**
 * @param {bot.message_data} message 
 */
function handleUserMessage(message) {
    var commandIndex = message.entities ? message.entities.findIndex(v => v.type == 'bot_command') : -1;
    var command = message.text && (commandIndex != -1) ? message.text.substring(
        message.entities[commandIndex].offset + 1, message.entities[commandIndex].offset + message.entities[commandIndex].length
    ) : '';
    if (bot_commands.hasOwnProperty(command)) {
        bot_commands[command].handler(message);
    } else {
        defaultUserMessageHandler(message);
    }
}
/**
 * @param {bot.message_data} message 
 */
function commandHandler_start(message) {
    log.info(`[START] searching for user ${message.from.id}...`);
    db.user_get(message.from.id, (userData, error) => {
        if (userData) {
            log.info(`[START] user ${message.from.id} found ("${userData.name}"), sending welcome message`);
            showWelcomeMessage(message.from, userData);
        } else {
            log.warning(`[START] can't find user ${message.from.id} (${error}), searching for invites...`);
            findUserInvite(message.from.id, (inviteData, error) => {
                if (inviteData) {
                    log.info(`[START] found invite for user ${message.from.id}`);
                    bot.sendMessage({ 
                        chatID: message.chat.id,
                        text: `You have an active invite${inviteData.expire_date.valueOf() == 0 ? '' : ` (expires in ${dateFormat.duration_to_string(inviteData.expire_date.valueOf() - Date.now())})`}\nPlease, enter you name`
                    });
                } else if (message.from.id == bot.getOwnerUserID()) {
                    log.warning(`[START] owner not registered and don't have invite, I should create one`);
                    db.invite_create({
                        id: message.from.id,
                        inviting_user_id: message.from.id,
                        invite_date: new Date(),
                        expire_date: new Date(0)
                    }, (error) => {
                        if (error) {
                            log.error(`[START] failed to create invite for the owner (${error})`);
                            bot.sendMessage({ chatID: message.from.id, text: `Oops, something went wrong` });
                        } else {
                            log.info(`[START] created invite for the owner, starting over...`);
                            commandHandler_start(message);
                        }
                    });
                } else {
                    log.warning(`[START] can't find invite for user ${message.from.id} (${error})`);
                    bot.sendMessage({ chatID: message.chat.id, text: ERROR_MESSAGE_NOT_REGISTERED });
                }
            });
        }
    });
}
/**
 * @param {bot.message_data} message 
 */
function commandHandler_invite(message) {
    log.info(`[INVITE] serching for user ${message.from.id}...`);
    db.user_get(message.from.id, (userData, error) => {
        if (!userData) {
            log.warning(`[INVITE] can't find user ${message.from.id} (${error}), ignoring`);
            bot.sendMessage({ chatID: message.chat.id, text: ERROR_MESSAGE_NOT_REGISTERED });
        } else {
            log.info(`[INVITE] found user data, sending invitation keyboard...`);
            bot.sendMessage({
                chatID: message.chat.id,
                text: `Please, choose the user you want to invite`,
                keyboard: {
                    is_persistent: false,
                    one_time_keyboard: true,
                    resize_keyboard: true,
                    keyboard: [[{
                        text: `Choose user...`,
                        request_user: {
                            request_id: REQUEST_ID_INVITE_USER,
                            user_is_bot: false
                        }
                    }]]
                }
            }, (keyboardMessage, error) => {
                if (error) {
                    log.error(`[INVITE] failed to send invitation keyboard to user ${message.from.id} (${error})`);
                } else {
                    log.info(`[INVITE] user ${message.from.id} received invitation keyboard`);
                }
            });
        }
    });
}
/**
 * @param {bot.message_data} message 
 */
function defaultUserMessageHandler(message) {
    if (message.user_shared) {
        log.info(`[DEFAULT] handling shared user reference...`);
        switch (message.user_shared.request_id) {
        case REQUEST_ID_INVITE_USER:
            log.info(`[DEFAULT] this is invite request, sending invite from user ${message.from.id} to ${message.user_shared.user_id}`);
            sendUserInvite(message.from, message.user_shared.user_id);
            break;
        default:
            log.warning(`[DEFAULT] unknown request ID ${message.user_shared.request_id}, ignoring`);
            break;
        }
    } else {
        log.info(`[DEFAULT] searching for user ${message.from.id}...`);
        db.user_get(message.from.id, (userData, error) => {
            if (!userData) {
                log.warning(`[DEFAULT] can't find user ${message.from.id} (${error}), searching for invite...`);
                findUserInvite(message.from.id, (inviteData, error) => {
                    if (inviteData) {
                        log.info(`[DEFAULT] found invite, probably user entered their name`);
                        onInvitedUserEnterName(message);
                    } else {
                        log.warning(`[DEFAULT] can't find invite for user ${message.from.id} (${error}), ingoring`);
                        bot.sendMessage({ chatID: message.chat.id, text: ERROR_MESSAGE_NOT_REGISTERED });
                    }
                });
            } else {
                log.info(`[DEFAULT] I found user data, but I don't know what to do next`);
                // TODO: Handle input from registered user
            }
        });
    }
}

/**
 * @param {number} userID 
 * @param {(inviteData: db.user_invite_data | null, error?: string) => any} callback 
 */
function findUserInvite(userID, callback) {
    db.invite_get(userID, (inviteData, error) => {
        if (error) {
            callback(null, error);
        } else if (!inviteData) {
            callback(null, `empty invite data`);
        } else if ((inviteData.expire_date.valueOf() > 0) && (inviteData.expire_date <= new Date())) {
            db.invite_delete(userID, (error) => {
                callback(null, `invite expired`);
            });
        } else {
            callback(inviteData);
        }
    });
}
/**
 * @param {bot.user_data} invitingUser 
 * @param {number} invitedUserID 
 */
function sendUserInvite(invitingUser, invitedUserID) {
    log.info(`[sendUserInvite] deleting inviting keyboard from user ${invitingUser.id}...`);
    bot.sendMessage({ 
        chatID: invitingUser.id, 
        text: `Sending invite...`, 
        removeKeyboard: true 
    }, (invitingUserMessage, error) => {
        if (error || !invitingUserMessage) {
            log.error(`[sendUserInvite] failed to delete inviting keyboard from user ${invitingUser.id} (${error})`);
            return;
        }
        log.info(`[sendUserInvite] searching for invited user ${invitedUserID}...`);
        db.user_get(invitedUserID, (invitedUserData, error) => {
            if (invitedUserData) {
                log.warning(`[sendUserInvite] invited user ${invitedUserID} already registered`);
                onUserSentInvite(invitingUserMessage, `User already registered, no need to invite him`);
                return;
            }
            log.info(`[sendUserInvite] didn't find invited user ${invitedUserID} in database, searching for invite...`);
            findUserInvite(invitedUserID, (inviteData, error) => {
                if (inviteData) {
                    log.warning(`[sendUserInvite] found active invitation for invited user ${invitedUserID}: ` + JSON.stringify(inviteData));
                    onUserSentInvite(invitingUserMessage, `User already have active invite, no need to invite him again`);
                    return;
                }
                log.info(`[sendUserInvite] didn't find invite for user ${invitedUserID}, creating the new one...`);
                let inviteDate = new Date();
                db.invite_create({
                    id: invitedUserID,
                    inviting_user_id: invitingUser.id,
                    invite_date: inviteDate,
                    expire_date: new Date(inviteDate.valueOf() + 24*60*60*1000)
                }, (error) => {
                    if (error) {
                        log.error(`[sendUserInvite] failed to create invite for user ${invitedUserID} (${error})`);
                        onUserSentInvite(invitingUserMessage, `Something went wrong, failed to create invite`);
                        return;
                    }
                    log.info(`[sendUserInvite] invite for user ${invitedUserID} created, sending notification...`);
                    bot.sendMessage({ 
                        chatID: invitedUserID, 
                        text: `Hello! ${invitingUser.first_name} invited you here! Invite expires in 24 hours\nPlease, enter your name`
                    }, (invitedUserMessage, error) => {
                        if (error || !invitedUserMessage) {
                            log.error(`[sendUserInvite] failed to send notification about invite to user ${invitedUserID} (${error})`);
                            onUserSentInvite(invitingUserMessage, `Something went wrong, failed to send notification about invite`);
                        } else {
                            log.info(`[sendUserInvite] notification sent`);
                            onUserSentInvite(invitingUserMessage, `Sent an invite to ${invitedUserMessage.chat.first_name}`);
                        }
                    });
                });
            });
        });
    });
}
/**
 * @param {bot.message_data} invitingUserMessage 
 * @param {string} result 
 */
function onUserSentInvite(invitingUserMessage, result) {
    bot.deleteMessage({ chatID: invitingUserMessage.chat.id, messageID: invitingUserMessage.message_id });
    bot.sendMessage({
        chatID: invitingUserMessage.chat.id,
        text: result,
        removeKeyboard: true
    });
}
/**
 * @param {bot.message_data} message 
 */
function onInvitedUserEnterName(message) {
    if (!message.text) {
        log.warning(`[onInvitedUserEnterName] empty message text`);
    } else {
        log.info(`[onInvitedUserEnterName] creating user ${message.from.id} with name "${message.text}"...`);
        db.user_create({
            id: message.from.id,
            name: message.text
        }, (userData, error) => {
            if (!userData) {
                log.error(`[onInvitedUserEnterName] failed to create user ${message.from.id} (${error})`);
                bot.sendMessage({ chatID: message.chat.id, text: `Sorry, something went wrong. Try again later.` });
            } else {
                log.info(`[onInvitedUserEnterName] user ${message.from.id} created: ` + JSON.stringify(userData));
                db.invite_delete(userData.id);
                showWelcomeMessage(message.from, userData);
            }
        });
    }
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 */
function showWelcomeMessage(user, userData) {
    log.info(`[showWelcomeMessage] sending welcome message...`);
    bot.sendMessage({
        chatID: user.id,
        text: `Welcome, ${userData.name}!`,
        removeKeyboard: true
    }, (message, error) => {
        if (error) {
            log.error(`[showWelcomeMessage] failed to send welcome message: ` + error);
        } else {
            log.info(`[showWelcomeMessage] user ${user.id} received welcome message`);
        }
    });
}