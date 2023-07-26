// @ts-check

var logModule = require('./log');
const logPrefix = '[WALLET]';
const log = {
    error: (msg) => logModule.error(logPrefix + msg),
    warning: (msg) => logModule.warning(logPrefix + msg),
    info: (msg) => logModule.info(logPrefix + msg),
};

var db = require('./database');
var bot = require('./telegram-bot');
var dateFormat = require('./date-format');

var walletCommon  = require('./wallet-common');
var walletMenu    = require('./wallet-menu');
var walletActions = require('./wallet-actions');

const COMMAND_ERROR_MESSAGE_NOT_REGISTERED = `I can't find you in the database. Ask somebody to invite you!`;

/** @type {{ [command: string]: { description: string, handler: (message: bot.message_data) => any } }} */
const bot_commands = {
    start: {
        description: 'Start interaction with me',
        handler: commandHandler_start
    },
    cancel: {
        description: 'Cancel current operation',
        handler: commandHandler_cancel
    }
};

module.exports.setupBotCommands = setupBotCommands;
module.exports.onBotUpdate = onBotUpdate;

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
    } else if (updateData.callback_query && updateData.callback_query.message && (updateData.callback_query.message.chat.type == 'private')) {
        handleMenuButton(updateData.callback_query);
    }
}
/**
 * @param {bot.message_data} message 
 */
function handleUserMessage(message) {
    var commandIndex = message.entities ? message.entities.findIndex(v => v.type == 'bot_command') : -1;
    if (commandIndex != -1) {
        var command = message.text ? message.text.substring(
            message.entities[commandIndex].offset + 1, message.entities[commandIndex].offset + message.entities[commandIndex].length
        ) : '';
        if (bot_commands.hasOwnProperty(command)) {
            bot_commands[command].handler(message);
        } else {
            log.warning('invalid bot command');
        }
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
            log.info(`[START] user ${message.from.id} found ("${userData.name}"), sending main menu message`);
            if (walletCommon.getUserAction(message.from.id) == walletCommon.ACTION_INVALID) {
                walletMenu.sendMenuMessage({ type: 'main' }, message.from, userData);
            } else {
                walletCommon.setUserMenu(message.from.id, 'main');
                walletActions.stopUserAction(message.from, userData);
            }
        } else {
            log.warning(`[START] can't find user ${message.from.id} (${error}), searching for invites...`);
            walletCommon.findUserInvite(message.from.id, (inviteData, error) => {
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
                    bot.sendMessage({ chatID: message.chat.id, text: COMMAND_ERROR_MESSAGE_NOT_REGISTERED });
                }
            });
        }
    });
}
/**
 * @param {bot.message_data} message 
 */
function commandHandler_cancel(message) {
    log.info(`[CANCEL] searching for user ${message.from.id}...`);
    db.user_get(message.from.id, (userData, error) => {
        if (!userData) {
            log.warning(`[CANCEL] can't find user ${message.from.id} (${error}), ignoring`);
            bot.sendMessage({ chatID: message.chat.id, text: COMMAND_ERROR_MESSAGE_NOT_REGISTERED });
        } else {
            log.info(`[CANCEL] found user data, canceling current action...`);
            walletActions.stopUserAction(message.from, userData);
        }
    });
}
/**
 * @param {bot.message_data} message 
 */
function defaultUserMessageHandler(message) {
    log.info(`[DEFAULT] searching for user ${message.from.id}...`);
    db.user_get(message.from.id, (userData, error) => {
        if (!userData) {
            log.warning(`[DEFAULT] can't find user ${message.from.id} (${error}), searching for invite...`);
            walletCommon.findUserInvite(message.from.id, (inviteData, error) => {
                if (inviteData) {
                    log.info(`[DEFAULT] found invite for user ${message.from.id}, probably user entered the name`);
                    onInvitedUserEnterName(message);
                } else {
                    log.warning(`[DEFAULT] can't find invite for user ${message.from.id} (${error}), ingoring`);
                }
            });
        } else {
            log.info(`[DEFAULT] found data for user ${message.from.id}, handling user message`);
            walletActions.handleUserActionMessage(message, userData);
        }
    });
}

/**
 * @param {bot.callback_query_data} callbackQuery 
 */
function handleMenuButton(callbackQuery) {
    bot.answerCallbackQuery({ queryID: callbackQuery.id });

    log.info(`[MENU BUTTON] searching for user ${callbackQuery.from.id}...`);
    db.user_get(callbackQuery.from.id, (userData, error) => {
        if (error || !userData) {
            log.warning(`[MENU BUTTON] can't find data for user ${callbackQuery.from.id} in database`);
        } else if (!callbackQuery.data) {
            log.warning(`[MENU BUTTON] empty callback query data`);
        } else {
            log.info(`[MENU BUTTON] found data for user ${callbackQuery.from.id}, handling callback query...`);
            const buttonData = callbackQuery.data.split(';');
            switch (buttonData[0]) {
            case walletCommon.MENU_BUTTON_GOTO:
                if (buttonData.length == 1) {
                    log.warning(`[MENU BUTTON] invalid goto button params`);
                } else {
                    const destination = buttonData[1];
                    log.info(`[MENU BUTTON] goto menu "${destination}"...`);
                    walletMenu.changeMenuMessage(callbackQuery.message, { type: destination, args: buttonData.slice(2) }, callbackQuery.from, userData);
                }
                break;
            case walletCommon.MENU_BUTTON_ACTION:
                if (buttonData.length == 1) {
                    log.warning(`[MENU BUTTON] invalid action button params`);
                } else {
                    const action = buttonData[1];
                    log.info(`[MENU BUTTON] starting action "${action}"...`);
                    walletActions.startUserAction(action, callbackQuery.from, userData);
                }
                break;
            
            default: 
                log.warning(`[MENU BUTTON] invalid callback query data "${callbackQuery.data}"`);
                break;
            }
        }
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
                walletMenu.sendMenuMessage({ type: 'main' }, message.from, userData);
            }
        });
    }
}