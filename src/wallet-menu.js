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

/**
 * @typedef {'main'|'settings'|'wallet'|'accounts'} menu_type
 */

/** @type {{ [type: string]: (user: bot.user_data, userData: db.user_data, callback: (menuData: menu_data) => any) => void }} */
const WalletMenuConstructors = {
    main: createMenuData_MainMenu,
    settings: createMenuData_Settings,
    wallet: createMenuData_Wallet,
    accounts: createMenuData_Accounts
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
    menuConstructor(user, userData, (menuData) => {
        bot.sendMessage({
            chatID: userID,
            text: menuData.text,
            parseMode: menuData.parseMode,
            protect: true,
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
    menuConstructor(user, userData, (menuData) => {
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
    });
}

/**
 * @param {menu_type} type 
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
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_MainMenu(user, userData, callback) {
    callback({
        text: `Welcome, ${userData.name}!\nChoose an action:`,
        keyboard: [
            [
                {
                    text: 'Wallet >>',
                    callback_data: makeMenuButton('wallet')
                }
            ],
            [
                {
                    text: 'Invite user',
                    callback_data: makeActionButton('invite')
                }
            ],
            [
                {
                    text: 'Settings >>',
                    callback_data: makeMenuButton('settings')
                }
            ]
        ]
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Settings(user, userData, callback) {
    callback({
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
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Wallet(user, userData, callback) {
    callback({
        text: `*This is your wallet*\nChoose what you want to do:`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: 'Accounts >>',
                    callback_data: makeMenuButton('accounts')
                }
            ],
            [
                {
                    text: 'Currencies >>',
                    callback_data: makeMenuButton('wallet')
                },
                {
                    text: 'Labels >>',
                    callback_data: makeMenuButton('wallet')
                },
                {
                    text: 'Categories >>',
                    callback_data: makeMenuButton('wallet')
                }
            ],
            [
                {
                    text: '<< Back to Main',
                    callback_data: makeMenuButton('main')
                }
            ]
        ]
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Accounts(user, userData, callback) {
    const userID = user.id;
    db.account_getAll(userID, (accounts, error) => {
        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuDataKeyboard = [];
        if (error) {
            log.error(userID, `failed to get accounts list (${error})`);
        } else {
            /** @type {bot.keyboard_button_inline_data[]} */
            var menuDataKeyboardRow = [];
            for (var i = 0; i < accounts.length; i++) {
                menuDataKeyboardRow.push({
                    text: accounts[i].name,
                    callback_data: makeMenuButton('accounts')
                });
                if (i % 3 == 2) {
                    menuDataKeyboard.push(menuDataKeyboardRow);
                    menuDataKeyboardRow = [];
                }
            }
            if (menuDataKeyboardRow.length > 0) {
                menuDataKeyboard.push(menuDataKeyboardRow);
            }
        }
        menuDataKeyboard.push([{ text: `Create new account >>`, callback_data: makeMenuButton('accounts') }]);
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: makeMenuButton('wallet') }]);
        callback({
            text: `*Your accounts:*`,
            parseMode: 'MarkdownV2',
            keyboard: menuDataKeyboard
        });
    });
}