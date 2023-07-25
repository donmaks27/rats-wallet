// @ts-check

var logModule = require('./log');
const logPrefix = '[WALLET][MENU]';
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

/** @type {{ [type: string]: (user: bot.user_data, userData: db.user_data) => menu_data }} */
const WalletMenuConstructors = {
    main: createMenuData_MainMenu,
    settings: createMenuData_Settings
};

/**
 * @typedef {{ text: string, parseMode?: bot.message_parse_mode, keyboard: bot.keyboard_button_inline_data[][] }} menu_data
 */

module.exports.sendMenuMessage = sendMenuMessage;
module.exports.changeMenuMessage = changeMenuMessage;

/**
 * @param {string} type
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function sendMenuMessage(type, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `sending menu message "${type}"...`);

    const menuConstructor = WalletMenuConstructors[type];
    if (!menuConstructor) {
        log.warning(userID, `invalid menu type "${type}"`);
        if (callback) {
            callback(null, `invalid menu type "${type}"`);
        }
        return;
    }

    walletCommon.setUserMenu(userID, type);
    const menuData = menuConstructor(user, userData);
    bot.sendMessage({
        chatID: userID,
        text: menuData.text,
        inlineKeyboard: {
            inline_keyboard: menuData.keyboard
        }
    }, (message, error) => {
        if (error) {
            log.error(userID, `failed to send menu message (${error})`);
            if (callback) {
                callback(null, `failed to send menu message: ` + error);
            }
        } else {
            log.info(userID, `menu message created`);
            if (callback) {
                callback(message);
            }
        }
    });
}
/**
 * @param {bot.message_data} menuMessage 
 * @param {string} type
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function changeMenuMessage(menuMessage, type, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `changing menu message "${type}"...`);

    const menuConstructor = WalletMenuConstructors[type];
    if (!menuConstructor) {
        log.warning(userID, `invalid menu type "${type}"`);
        if (callback) {
            callback(null, `invalid menu type "${type}"`);
        }
        return;
    }

    walletCommon.setUserMenu(userID, type);
    const menuData = menuConstructor(user, userData);
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
            log.error(userID, `failed to change menu message (${error})`);
            callback(null, `failed to change menu message: ` + error);
        } else {
            log.info(userID, `menu message changed`);
            callback(message);
        }
    } : undefined);
}

/**
 * @param {'main'|'settings'} type 
 */
function makeMenuButton(type) {
    return `${walletCommon.MENU_BUTTON_GOTO};${type}`;
}
/**
 * @param {string} action 
 */
function makeActionButton(action) {
    return `${walletCommon.MENU_BUTTON_ACTION};${action}`;
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @returns {menu_data}
 */
function createMenuData_MainMenu(user, userData) {
    return {
        text: `Welcome, ${userData.name}!\nChoose an action:`,
        keyboard: [
            [
                {
                    text: 'Settings',
                    callback_data: makeMenuButton('settings')
                }
            ]
        ]
    };
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @returns {menu_data}
 */
function createMenuData_Settings(user, userData) {
    return {
        text: `Welcome, ${userData.name}!\nChoose an action:`,
        keyboard: [
            [
                {
                    text: 'Change name',
                    callback_data: makeActionButton('changeName')
                }
            ],
            [
                {
                    text: '<< Back to Main',
                    callback_data: makeMenuButton('main')
                }
            ]
        ]
    };
}