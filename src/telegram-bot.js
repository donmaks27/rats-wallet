// @ts-check

var fs = require('fs');
var https = require('https');
var formData = require('form-data');

var log = require('./log');

function log_debug(msg) {
    log.info('[BOT] ' + msg);
}

/** @type {{ id: number, token: string, ownerUserID: number, server: { ip: string, port: number, hostname?: string }, secretToken: string }} */
const botInfo = JSON.parse(fs.readFileSync('data/botInfo.json').toString());

module.exports.getOwnerUserID = () => botInfo.ownerUserID;
module.exports.getServerAddress = () => botInfo.server;
module.exports.getSecretToken = () => botInfo.secretToken;

module.exports.getMe = command_getMe;
module.exports.sendMessage = command_sendMessage;
module.exports.forwardMessage = command_forwardMessage;
module.exports.editMessage = command_editMessage;
module.exports.deleteMessage = command_deleteMessage;
module.exports.sendChatAction = command_sendChatAction;
module.exports.answerCallbackQuery = command_answerCallbackQuery;
module.exports.setWebhook = command_setWebhook;
module.exports.deleteWebhook = command_deleteWebhook;
module.exports.setMyCommands = command_setMyCommands;
module.exports.deleteMyCommands = command_deleteMyCommands;

/**
 * @typedef {{ ok: boolean, result?: any, description?: string }} response_data
 * @typedef {{ update_id: number, message?: message_data, callback_query?: callback_query_data }} update_data
 * 
 * @typedef {{ id: number, is_bot?: true, first_name: string, last_name?: string, username?: string, language_code?: string }} user_data
 * @typedef {{ id: number, type: 'private'|'group'|'supergroup'|'channel', username?: string, first_name?: string, last_name?: string }} chat_data
 * 
 * @typedef {{ message_id: number, from: user_data, date: number, chat: chat_data, text: string, entities: message_entity_data[], 
 *      reply_markup?: keyboard_markup_inline_data | keyboard_markup_reply_data, user_shared?: { request_id: number, user_id: number },
 *      forward_from?: user_data, forward_from_chat?: chat_data, forward_date?: number }} message_data
 * @typedef {{ type: 'mention'|'hashtag'|'cashtag'|'bot_command'|'url'|'email'|'phone_number'|'bold'|'italic'|'underline'|'strikethrough'|'spoiler'|
 *      'code'|'pre'|'text_link'|'text_mention'|'custom_emoji', offset: number, length: number, url?: string, user?: user_data, language?: string,
 *      custom_emoji_id?: string }} message_entity_data
 * @typedef {'MarkdownV2' | 'HTML' | 'Markdown'} message_parse_mode
 * 
 * @typedef {{ inline_keyboard: keyboard_button_inline_data[][] }} keyboard_markup_inline_data
 * @typedef {{ text: string, callback_data?: string }} keyboard_button_inline_data
 * @typedef {{ keyboard: keyboard_button_reply_data[][], is_persistent?: boolean, resize_keyboard?: boolean, one_time_keyboard?: boolean, 
 *      input_field_placeholder?: string }} keyboard_markup_reply_data
 * @typedef {string | { text: string, request_user?: { request_id: number, user_is_bot?: boolean } }} keyboard_button_reply_data
 * 
 * @typedef {{ id: string, from: user_data, message: message_data, inline_message_id?: string, chat_instance: string, data?: string }} callback_query_data
 */

/**
 * @param {string} command 
 * @param {Object<string, any> | null} params 
 * @param {Object<string, Buffer | fs.ReadStream> | null} fileParams 
 * @param {((response: response_data | null, error?: string) => any) | null} [callback] 
 */
function sendRequest(command, params, fileParams, callback) {
    log_debug(`sending request "${command}" (${JSON.stringify(params)})...`);

    var requestData = new formData();
    if (params) {
        for (const paramName in params) {
            if (typeof params[paramName] === 'string') {
                requestData.append(paramName, params[paramName]);
            } else {
                requestData.append(paramName, JSON.stringify(params[paramName]));
            }
        }
    }
    if (fileParams) {
        for (const paramName in fileParams) {
            requestData.append(paramName, fileParams[paramName]);
        }
    }
    var request = https.request({
        method: 'POST',
        host: 'api.telegram.org',
        path: `/bot${botInfo.token}/${command}`,
        headers: requestData.getHeaders()
    });
    request.on('error', (error) => {
        if (callback) {
            callback(null, `request "${command}" error: ` + error);
        }
    });
    request.on('response', (response) => {
        var responseData = '';
        response.on('data', (dataChunk) => { responseData += dataChunk; });
        response.on('end', () => {
            log_debug(`received response from "${command}" command: ` + responseData);
            if (callback) {
                /** @type {{ ok: boolean, result?: boolean, description?: string } | null} */
                var dataJSON = null;
                try {
                    dataJSON = JSON.parse(responseData);
                } catch (error) {
                    callback(null, `failed to parse response from "${command}" command: ` + error);
                }
                if (dataJSON) {
                    if (!dataJSON.ok) {
                        callback(null, `response from "${command}" command contains error: ` + dataJSON.description);
                    } else {
                        callback(dataJSON);
                    }
                }
            }
        });
    });
    requestData.pipe(request);
}
/**
 * @param {(success: boolean, error?: string) => void} [callback] 
 * @returns {((response: response_data | null, error?: string) => any) | null}
 */
function wrapDefaultCallback(callback) {
    if (!callback) {
        return null;
    } else {
        return (response, error) => {
            if (!response) {
                callback(false, error);
            } else {
                callback(response.result ? response.result : false);
            }
        }
    }
}

/**
 * @param {(bot_info: user_data | null, error?: string) => any} callback 
 */
function command_getMe(callback) {
    sendRequest('getMe', null, null, (response, error) => {
        if (!response) {
            callback(null, error);
        } else {
            callback(response.result);
        }
    });
}

/**
 * @param {{ chatID: number, text: string, parseMode?: 'MarkdownV2' | 'HTML' | 'Markdown', silent?: boolean, protect?: boolean, 
 *      reply?: { messageID: number, allowIfNotFound?: boolean }, inlineKeyboard?: keyboard_markup_inline_data, keyboard?: keyboard_markup_reply_data,
 *      removeKeyboard?: boolean, forceReplyPlaceholder?: string }} params 
 * @param {(message: message_data | null, error?: string) => any} [callback] 
 */
function command_sendMessage(params, callback) {
    var requestParams = {
        chat_id: params.chatID,
        text: params.text
    };
    if (params.parseMode) {
        requestParams.parse_mode = params.parseMode;
    }
    if (typeof params.silent === 'boolean') {
        requestParams.disable_notification = params.silent;
    }
    if (typeof params.protect === 'boolean') {
        requestParams.protect_content = params.protect;
    }
    if (typeof params.reply !== 'undefined') {
        requestParams.reply_to_message_id = params.reply.messageID;
        if (typeof params.reply.allowIfNotFound === 'boolean') {
            requestParams.allow_sending_without_reply = params.reply.allowIfNotFound
        }
    }
    if (typeof params.inlineKeyboard !== 'undefined') {
        requestParams.reply_markup = params.inlineKeyboard;
    } else if (typeof params.keyboard !== 'undefined') {
        requestParams.reply_markup = params.keyboard;
    } else if (typeof params.removeKeyboard !== 'undefined') {
        requestParams.reply_markup = {
            remove_keyboard: params.removeKeyboard
        };
    } else if (typeof params.forceReplyPlaceholder !== 'undefined') {
        requestParams.reply_markup = {
            force_reply: true,
            input_field_placeholder: params.forceReplyPlaceholder
        };
    }
    sendRequest('sendMessage', requestParams, null, callback ? (response, error) => {
        if (!response) {
            callback(null, `failed to send message: ` + error);
        } else {
            callback(response.result);
        }
    } : null);
}
/**
 * @param {{ chatID: number, forwardedMessage: { id: number, chatID?: number }, silent?: boolean, protect?: boolean }} params 
 * @param {(message: message_data | null, error?: string) => any} [callback] 
 */
function command_forwardMessage(params, callback) {
    var requestParams = {
        chat_id: params.chatID,
        from_chat_id: params.forwardedMessage.chatID ? params.forwardedMessage.chatID : params.chatID,
        message_id: params.forwardedMessage.id
    };
    if (typeof params.silent !== 'undefined') {
        requestParams.disable_notification = params.silent;
    }
    if (typeof params.protect !== 'undefined') {
        requestParams.protect_content = params.protect;
    }
    sendRequest('forwardMessage', requestParams, null, callback ? (response, error) => {
        if (!response) {
            callback(null, `failed to forward message: ` + error);
        } else {
            callback(response.result);
        }
    } : null);
}
/**
 * @param {{ message: { id: number, chatID: number }, text: string, parseMode?: message_parse_mode, inlineKeyboard?: keyboard_markup_inline_data }} params 
 * @param {(message: message_data | null, error?: string) => any} [callback] 
 */
function command_editMessage(params, callback) {
    var requestParams = {
        chat_id: params.message.chatID,
        message_id: params.message.id,
        text: params.text
    };
    if (typeof params.parseMode !== 'undefined') {
        requestParams.parse_mode = params.parseMode;
    }
    if (typeof params.inlineKeyboard !== 'undefined') {
        requestParams.reply_markup = params.inlineKeyboard;
    }
    sendRequest("editMessageText", requestParams, null, callback ? (response, error) => {
        if (!response) {
            callback(null, `failed to edit message: ` + error);
        } else {
            callback(response.result);
        }
    } : null);
}
/**
 * 
 * @param {{ chatID: number, messageID: number }} params 
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_deleteMessage(params, callback) {
    sendRequest("deleteMessage", {
        chat_id: params.chatID,
        message_id: params.messageID
    }, null, wrapDefaultCallback(callback));
}

/**
 * @param {{ chatID: number, action: 'typing'|'upload_photo'|'upload_video'|'upload_voice'|'upload_document'|'choose_sticker'|'upload_video_note' }} params 
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_sendChatAction(params, callback) {
    sendRequest("sendChatAction", {
        chat_id: params.chatID,
        action: params.action
    }, null, wrapDefaultCallback(callback));
}

/**
 * @param {{ queryID: string, text?: string, showAlert?: true }} params 
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_answerCallbackQuery(params, callback) {
    var requestParams = {
        callback_query_id: params.queryID
    };
    if (typeof params.text !== 'undefined') {
        requestParams.text = params.text;
    }
    if (typeof params.showAlert !== 'undefined') {
        requestParams.show_alert = params.showAlert;
    }
    sendRequest("answerCallbackQuery", requestParams, null, wrapDefaultCallback(callback));
}

/**
 * @param {{[command: string]: string}} commandsList
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_setMyCommands(commandsList, callback) {
    var params = {
        /** @type {{ command: string, description: string }[]} */
        commands: [],
        scope: {
            type: 'all_private_chats'
        }
    };
    for (const commandName in commandsList) {
        params.commands.push({
            command: commandName,
            description: commandsList[commandName]
        });
    }
    sendRequest('setMyCommands', params, null, wrapDefaultCallback(callback));
}
/**
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_deleteMyCommands(callback) {
    sendRequest('deleteMyCommands', {
        scope: {
            type: 'all_private_chats'
        }
    }, null, wrapDefaultCallback(callback));
}

/**
 * @param {string | { ip: string, port: number, hostname?: string }} url 
 * @param {string} certFilePath 
 * @param {string | null} secret 
 * @param {boolean} dropUpdates 
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_setWebhook(url, certFilePath, secret, dropUpdates, callback) {
    var params = {
        drop_pending_updates: dropUpdates
    };
    if (typeof url === 'string') {
        params.url = url;
    } else {
        params.url = `https://${url.hostname ? url.hostname : url.ip}:${url.port}`;
        params.ip_address = url.ip;
    }
    if (secret) {
        params.secret_token = secret;
    }
    sendRequest('setWebhook', params, {
        certificate: fs.createReadStream(certFilePath)
    }, wrapDefaultCallback(callback));
}
/**
 * @param {boolean} dropUpdates 
 * @param {(success: boolean, error?: string) => any} [callback] 
 */
function command_deleteWebhook(dropUpdates, callback) {
    sendRequest('deleteWebhook', {
        drop_pending_updates: dropUpdates
    }, null, wrapDefaultCallback(callback));
}