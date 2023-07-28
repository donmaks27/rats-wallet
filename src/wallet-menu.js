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
 * @typedef {'main'|'settings'|'wallet'|'accounts'|'account'|'createAccount_currency'|'deleteAccount'} menu_type
 */

/** @type {{ [type: string]: (user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (menuData: menu_data) => any) => void }} */
const WalletMenuConstructors = {
    main:     createMenuData_main,
    settings: createMenuData_settings,
    wallet:   createMenuData_wallet,
    accounts: createMenuData_accounts,
    account:  createMenuData_account,
    createAccount_currency: createMenuData_createAccount_currency,
    deleteAccount:          createMenuData_deleteAccount
};

/**
 * @typedef {{ text: string, parseMode?: bot.message_parse_mode, keyboard: bot.keyboard_button_inline_data[][] }} menu_data
 */

module.exports.sendMenuMessage = sendMenuMessage;
module.exports.changeMenuMessage = changeMenuMessage;

/**
 * @param {string} menu 
 * @param {walletCommon.args_data} args 
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
            if (error || !message) {
                log.error(userID, `failed to send menu message (${error})`);
                if (callback) {
                    callback(null, `failed to send menu message: ` + error);
                }
            } else {
                log.info(userID, `menu message created`);
                walletCommon.setUserMenuMessageID(userID, message.message_id);
                if (callback) {
                    callback(message);
                }
            }
        });
    });
}
/**
 * @param {number} menuMessageID 
 * @param {string} menu 
 * @param {walletCommon.args_data} args 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(message: bot.message_data | null, error?: string) => any} [callback] 
 */
function changeMenuMessage(menuMessageID, menu, args, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `changing menu message ${menuMessageID} to menu "${menu}"...`);
    if (menuMessageID == 0) {
        log.info(userID, `invalid message ID ${menuMessageID}, sending new menu "${menu}"...`);
        sendMenuMessage(menu, args, user, userData, callback);
        return;
    }

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
                chatID: userID,
                id: menuMessageID
            },
            text: menuData.text,
            parseMode: menuData.parseMode,
            inlineKeyboard: {
                inline_keyboard: menuData.keyboard
            }
        }, (message, error) => {
            if (error || !message) {
                log.error(userID, `failed to change menu message (${error})`);
                if (callback) {
                    callback(null, `failed to change menu message: ` + error);
                }
            } else {
                log.info(userID, `menu message changed`);
                walletCommon.setUserMenuMessageID(userID, message.message_id);
                if (callback) {
                    callback(message);
                }
            }
        });
    });
}

/**
 * @param {menu_type} type 
 * @param {walletCommon.args_data} [args] 
 */
function makeMenuButton(type, args) {
    return makeButton(walletCommon.MENU_BUTTON_GOTO, type, args);
}
/**
 * @param {string} action 
 * @param {walletCommon.args_data} [args] 
 */
function makeActionButton(action, args) {
    return makeButton(walletCommon.MENU_BUTTON_ACTION, action, args);
}
/**
 * @param {string} refType 
 * @param {string} refDestination 
 * @param {walletCommon.args_data} [args] 
 */
function makeButton(refType, refDestination, args) {
    return walletCommon.encodeArgs(`${refType}:${refDestination}`, args);
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
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_main(user, userData, args, callback) {
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
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_settings(user, userData, args, callback) {
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
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_wallet(user, userData, args, callback) {
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
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_accounts(user, userData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.showAll ? true : false;
    db.account_getAll(userID, (accounts, error) => {
        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuDataKeyboard = [];
        var archivedAmount = 0;
        if (error) {
            log.error(userID, `[accounts] failed to get accounts list (${error})`);
        } else {
            /** @type {bot.keyboard_button_inline_data[]} */
            var menuDataKeyboardRow = [];
            accounts.sort((v1, v2) => { 
                if (v1.is_active != v2.is_active) {
                    return v1.is_active ? -1 : 1;
                }
                if (v1.create_date != v2.create_date) {
                    return v1.create_date > v2.create_date ? -1 : 1;
                }
                return v1.name.localeCompare(v2.name);
            });
            for (var i = 0; i < accounts.length; i++) {
                if (!accounts[i].is_active) {
                    archivedAmount++;
                    if (!shouldShowArchived) {
                        continue;
                    }
                }
                menuDataKeyboardRow.push({
                    text: accounts[i].is_active ? accounts[i].name : `[${accounts[i].name}]`,
                    callback_data: makeMenuButton('account', { accountID: accounts[i].id })
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
            menuDataKeyboard.push([{ 
                text: shouldShowArchived ? `Hide archived` : `Show archived`, 
                callback_data: makeMenuButton('accounts', { showAll: !shouldShowArchived }) 
            }]);
        }
        menuDataKeyboard.push([{ text: `Create new account >>`, callback_data: makeMenuButton('createAccount_currency') }]);
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: makeMenuButton('wallet') }]);
        callback({
            text: `*Accounts*\nChoose what you want to do:`,
            parseMode: 'MarkdownV2',
            keyboard: menuDataKeyboard
        });
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_account(user, userData, args, callback) {
    const userID = user.id;
    const accountID = typeof args.accountID === 'number' ? args.accountID : db.invalid_id;
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `[account] failed to get data of account ${accountID} (${error})`);
            callback({
                text: `_${escapeMessageMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Accounts`, callback_data: makeMenuButton('accounts') }]]
            });
        } else {
            db.account_getBallance(accountID, {}, (ballance, error) => {
                if (error) {
                    log.error(userID, `[account] failed to get ballance of account "${accountData.name}" (${error})`);
                }
                /** @type {string[]} */
                var textLines = [];
                textLines.push(`Account *${escapeMessageMarkdown(accountData.name)}* ${escapeMessageMarkdown(`(${accountData.currency_code})`)}`);
                if (!accountData.is_active) {
                    textLines[0] += ` _\\[archived\\]_`;
                }
                textLines.push(`_Current ballance: ${escapeMessageMarkdown(`${Math.round(accountData.start_amount + ballance) / 100}`)}_`);
                textLines.push(`Choose what you want to do:`);

                callback({
                    text: textLines.join('\n'),
                    parseMode: 'MarkdownV2',
                    keyboard: [
                        [
                            { 
                                text: accountData.is_active ? `Archive account` : `Unarchive account`, 
                                callback_data: makeActionButton('archiveAccount', { accountID: accountID, archive: accountData.is_active })
                            }
                        ],
                        [
                            {
                                text: `Delete account`,
                                callback_data: makeMenuButton('deleteAccount', { accountID: accountID })
                            }
                        ],
                        [
                            { 
                                text: `<< Back to Accounts`, 
                                callback_data: makeMenuButton('accounts') 
                            }
                        ]
                    ]
                });
            });
        }
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_createAccount_currency(user, userData, args, callback) {
    const userID = user.id;
    db.currency_getAll((currenciesData, error) => {
        /** @type {menu_data} */
        var menuData = { text: `*Creating new account*\nChoose currency for the new account:`, parseMode: 'MarkdownV2', keyboard: [] };
        if (error) {
            log.error(userID, `[createAccount_currency] failed to get currencies data (${error})`);
            menuData.text = `_${escapeMessageMarkdown(`Hmm, something wrong...`)}_`;
        } else {
            for (var i = 0; i < currenciesData.length; i++) {
                if (!currenciesData[i].is_active) {
                    continue;
                }
                menuData.keyboard.push([{
                    text: currenciesData[i].name ? `${currenciesData[i].name} (${currenciesData[i].code})` : currenciesData[i].code,
                    callback_data: makeActionButton('createAccount', { currency: currenciesData[i].code })
                }]);
            }
            if (menuData.keyboard.length == 0) {
                log.warning(userID, `[createAccount_currency] there is no available currencies`);
                menuData.text = `_${escapeMessageMarkdown(`Can't find any active currency...`)}_`;
            }
        }
        menuData.keyboard.push([{ text: `<< Back to Accounts`, callback_data: makeMenuButton('accounts') }]);
        callback(menuData);
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_deleteAccount(user, userData, args, callback) {
    const userID = user.id;
    const accountID = typeof args.accountID === 'number' ? args.accountID : db.invalid_id;
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `[deleteAccount] failed to get data of account ${accountID} (${error})`);
            callback({
                text: `_${escapeMessageMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Accounts`, callback_data: makeMenuButton('accounts') }]]
            });
        } else {
            callback({ 
                text: `*Deleting account*\nYou are going to delete account *${escapeMessageMarkdown(accountData.name)}*` + escapeMessageMarkdown(`. Are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: makeMenuButton('account', { accountID: accountID })
                    },
                    {
                        text: 'Yes',
                        callback_data: makeActionButton('deleteAccount', { accountID: accountID })
                    }
                ]] 
            });
        }
    });
}