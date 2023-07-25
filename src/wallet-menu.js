// @ts-check

var logModule = require('./log');
const logPrefix = '[WALLET][MENU] ';
const log = {
    error: (msg) => logModule.error(logPrefix + msg),
    warning: (msg) => logModule.warning(logPrefix + msg),
    info: (msg) => logModule.info(logPrefix + msg)
};

var db  = require('./database');
var bot = require('./telegram-bot');
var walletCommon = require('./wallet-common');

/**
 * @typedef {{ type: 'main'|'settings', userData: db.user_data }} menu_params
 * @typedef {{ text: string, parseMode?: bot.message_parse_mode, keyboard: bot.keyboard_button_inline_data[][] }} menu_data
 */

module.exports.sendMenuMessage = sendMenuMessage;
module.exports.changeMenuMessage = changeMenuMessage;
module.exports.createMenuData = createMenuData;

/**
 * @param {bot.user_data} user 
 * @param {menu_data} menuData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function sendMenuMessage(user, menuData, callback) {
    log.info(`sending menu message...`);
    bot.sendMessage({
        chatID: user.id,
        text: menuData.text,
        inlineKeyboard: {
            inline_keyboard: menuData.keyboard
        }
    }, callback ? (message, error) => {
        if (error) {
            log.error(`failed to send menu message (${error})`);
            callback(null, `failed to send menu message: ` + error);
        } else {
            log.info(`menu message created`);
            callback(message);
        }
    } : undefined);
}
/**
 * @param {bot.message_data} menuMessage 
 * @param {menu_data} menuData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function changeMenuMessage(menuMessage, menuData, callback) {
    log.info(`changing menu message...`);
    bot.editMessage({
        message: {
            chatID: menuMessage.chat.id,
            id: menuMessage.message_id
        },
        text: menuData.text,
        parseMode: menuData.parseMode,
        inlineKeyboard: {
            inline_keyboard: menuData.keyboard
        }
    }, callback ? (message, error) => {
        if (error) {
            log.error(`failed to change menu message (${error})`);
            callback(null, `failed to change menu message: ` + error);
        } else {
            log.info(`menu message changed`);
            callback(message);
        }
    } : undefined);
}

/** @type {{ [type: string]: (params: menu_params) => menu_data }} */
const menuConstructors = {
    main: createMenuData_MainMenu,
    settings: createMenuData_Settings
};
/**
 * @param {menu_params} params
 * @returns {menu_data}
 */
function createMenuData(params) {
    const constructor = menuConstructors[params.type];
    if (!constructor) {
        return { text: 'none', keyboard: [] };
    }
    return constructor(params);
}
/**
 * @param {menu_params} params 
 * @returns {menu_data}
 */
function createMenuData_MainMenu(params) {
    return {
        text: `Welcome, ${params.userData.name}!\nChoose an action:`,
        keyboard: [
            [
                {
                    text: 'Settings',
                    callback_data: walletCommon.MENU_BUTTON_GOTO + ';settings'
                }
            ]
        ]
    };
}
/**
 * @param {menu_params} params 
 * @returns {menu_data}
 */
function createMenuData_Settings(params) {
    return {
        text: `Welcome, ${params.userData.name}!\nChoose an action:`,
        keyboard: [
            [
                {
                    text: '<< Back to Main',
                    callback_data: walletCommon.MENU_BUTTON_GOTO + ';main'
                }
            ]
        ]
    };
}