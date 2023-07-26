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
 * @typedef {'main'|'settings'|'wallet'|'accounts'|'account'} menu_type
 */

/** @type {{ [type: string]: (user: bot.user_data, userData: db.user_data, args: string[], callback: (menuData: menu_data) => any) => void }} */
const WalletMenuConstructors = {
    main: createMenuData_MainMenu,
    settings: createMenuData_Settings,
    wallet: createMenuData_Wallet,
    accounts: createMenuData_Accounts,
    account: createMenuData_Account
};

/**
 * @typedef {{ text: string, parseMode?: bot.message_parse_mode, keyboard: bot.keyboard_button_inline_data[][] }} menu_data
 */

module.exports.sendMenuMessage = sendMenuMessage;
module.exports.changeMenuMessage = changeMenuMessage;

/**
 * @param {string} menu 
 * @param {string[]} args 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function sendMenuMessage(menu, args, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `sending menu message "${menu}"...`);

    const menuConstructor = WalletMenuConstructors[menu];
    if (!menuConstructor) {
        log.warning(userID, `invalid menu type "${menu}"`);
        if (callback) {
            callback(null, `invalid menu type "${menu}"`);
        }
        return;
    }

    walletCommon.setUserMenu(userID, menu, args);
    menuConstructor(user, userData, args, (menuData) => {
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
 * @param {string} menu 
 * @param {string[]} args 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function changeMenuMessage(menuMessage, menu, args, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `changing menu message "${menu}"...`);

    const menuConstructor = WalletMenuConstructors[menu];
    if (!menuConstructor) {
        log.warning(userID, `invalid menu type "${menu}"`);
        if (callback) {
            callback(null, `invalid menu type "${menu}"`);
        }
        return;
    }

    walletCommon.setUserMenu(userID, menu, args);
    menuConstructor(user, userData, args, (menuData) => {
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
 * @param {string[]} [args] 
 */
function makeMenuButton(type, args) {
    var result = `${walletCommon.MENU_BUTTON_GOTO};${type}`;
    if (args && (args.length > 0)) {
        result += ';' + args.join(';');
    }
    return result;
}
/**
 * @param {string} action 
 */
function makeActionButton(action) {
    return `${walletCommon.MENU_BUTTON_ACTION};${action}`;
}

/**
 * @param {string} msg 
 */
function escapeMessageMarkdown(msg) {
    return msg.replace(/(?=[\_\*\[\]\(\)\~\`\>\#\+\-\=\|\{\}\.\!])/g, '\\');
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {string[]} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_MainMenu(user, userData, args, callback) {
    callback({
        text: `Welcome, ${userData.name}!\nChoose what you want to do:`,
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
 * @param {string[]} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Settings(user, userData, args, callback) {
    callback({
        text: `Welcome, ${userData.name}!\nChoose what you want to do:`,
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
 * @param {string[]} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Wallet(user, userData, args, callback) {
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
 * @param {string[]} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Accounts(user, userData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.includes('showAll');
    db.account_getAll(userID, (accounts, error) => {
        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuDataKeyboard = [];
        var archivedAmount = 0;
        if (error) {
            log.error(userID, `failed to get accounts list (${error})`);
        } else {
            /** @type {bot.keyboard_button_inline_data[]} */
            var menuDataKeyboardRow = [];
            for (var i = 0; i < accounts.length; i++) {
                if (!accounts[i].is_active) {
                    archivedAmount++;
                    if (!shouldShowArchived) {
                        continue;
                    }
                }
                menuDataKeyboardRow.push({
                    text: accounts[i].name,
                    callback_data: makeMenuButton('account', [ `${accounts[i].id}` ])
                });
                if (menuDataKeyboardRow.length == 3) {
                    menuDataKeyboard.push(menuDataKeyboardRow);
                    menuDataKeyboardRow = [];
                }
            }
            if (menuDataKeyboardRow.length > 0) {
                menuDataKeyboard.push(menuDataKeyboardRow);
            }
        }
        if (archivedAmount > 0) {
            if (!shouldShowArchived) {
                menuDataKeyboard.push([{ text: `Show archived`, callback_data: makeMenuButton('accounts', [ 'showAll' ]) }]);
            } else {
                menuDataKeyboard.push([{ text: `Hide archived`, callback_data: makeMenuButton('accounts') }]);
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
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {string[]} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_Account(user, userData, args, callback) {
    const userID = user.id;
    const accountID = args.length > 0 ? Number.parseInt(args[0]) : db.invalid_id;
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `failed to get data of account ${accountID} (${error})`);
            callback({
                text: `_${escapeMessageMarkdown(`Hmm, something wrong...`)}_`,
                parseMode: 'MarkdownV2',
                keyboard: [[{
                    text: `<< Back to Accounts`,
                    callback_data: makeMenuButton('accounts')
                }]]
            });
        } else {
            db.account_getBallance(accountID, {}, (ballance, error) => {
                if (error) {
                    log.error(userID, `failed to get ballance of account "${accountData.name}" (${error})`);
                }
                /** @type {string[]} */
                var textLines = [];
                textLines.push(`Account *${escapeMessageMarkdown(accountData.name)}* ${escapeMessageMarkdown(`(${accountData.currency_code})`)}`);
                textLines.push(`_Current ballance: ${escapeMessageMarkdown(`${Math.round(ballance) / 100}`)}_`);
                textLines.push(`Choose what you want to do:`);

                /** @type {bot.keyboard_button_inline_data[][]} */
                var menuDataKeyboard = [];
                menuDataKeyboard.push([{ text: `<< Back to Accounts`, callback_data: makeMenuButton('accounts') }]);
                callback({
                    text: textLines.join('\n'),
                    parseMode: 'MarkdownV2',
                    keyboard: menuDataKeyboard
                });
            });
        }
    });
}