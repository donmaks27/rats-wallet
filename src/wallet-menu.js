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
 * @typedef {'main'|'settings'|'wallet'|'accounts'|'account'|'createAccount'|'deleteAccount'|'currencies'|'currency'|'deleteCurrency'} menu_type
 */

/** @type {{ [type: string]: (user: bot.user_data, userData: db.user_data, args: walletCommon.args_data, callback: (menuData: menu_data) => any) => void }} */
const WalletMenuConstructors = {
    main:           createMenuData_main,
    settings:       createMenuData_settings,
    wallet:         createMenuData_wallet,
    accounts:       createMenuData_accounts,
    account:        createMenuData_account,
    createAccount:  createMenuData_createAccount,
    deleteAccount:  createMenuData_deleteAccount,
    currencies:     createMenuData_currencies,
    currency:       createMenuData_currency,
    deleteCurrency: createMenuData_deleteCurrency
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
    changeMenuMessage(0, menu, args, user, userData, callback);
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
 * @param {string} str 
 */
function makeMenuMessageTitle(str) {
    return `*${bot.escapeMarkdown(str)}*`;
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
        text: makeMenuMessageTitle(`This is your wallet`) + `\nChoose what you want to do:`,
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
                    callback_data: makeMenuButton('currencies')
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
                    text: (accounts[i].is_active ? '🟢' : '🟡') + accounts[i].name,
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
        menuDataKeyboard.push([{ text: `Create new account >>`, callback_data: makeMenuButton('createAccount') }]);
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: makeMenuButton('wallet') }]);
        callback({
            text: makeMenuMessageTitle(`Accounts`) + `\nChoose an account:`,
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
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Accounts`, callback_data: makeMenuButton('accounts') }]]
            });
        } else {
            db.account_getBallance(accountID, {}, (ballance, error) => {
                if (error) {
                    log.error(userID, `[account] failed to get ballance of account "${accountData.name}" (${error})`);
                }
                /** @type {string[]} */
                var textLines = [];
                textLines.push((accountData.is_active ? '🟢' : '🟡') + ` Account *${bot.escapeMarkdown(accountData.name)}* ${bot.escapeMarkdown(`(${accountData.currency_code})`)}`);
                if (!accountData.is_active) {
                    textLines[0] += ` _\\[archived\\]_`;
                }
                textLines.push(`_Current ballance: ${bot.escapeMarkdown(`${Math.round(accountData.start_amount + ballance) / 100}`)}_`);
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
function createMenuData_createAccount(user, userData, args, callback) {
    const userID = user.id;
    db.currency_getAll((currenciesData, error) => {
        /** @type {menu_data} */
        var menuData = { text: makeMenuMessageTitle(`Creating new account`) + `\nChoose currency for the new account:`, parseMode: 'MarkdownV2', keyboard: [] };
        if (error) {
            log.error(userID, `[createAccount_currency] failed to get currencies data (${error})`);
            menuData.text = `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`;
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
                menuData.text = `_${bot.escapeMarkdown(`Can't find any active currency...`)}_`;
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
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Accounts`, callback_data: makeMenuButton('accounts') }]]
            });
        } else {
            callback({ 
                text: makeMenuMessageTitle(`Deleting account`) + `\nYou are going to delete account *${bot.escapeMarkdown(accountData.name)}*` + bot.escapeMarkdown(`. Are you sure?`), 
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

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menu_data) => any} callback 
 */
function createMenuData_currencies(user, userData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.showAll ? true : false;
    db.currency_getAll((currenciesData, error) => {
        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuDataKeyboard = [];
        if (error) {
            log.error(userID, `[currencies] failed to get currencies list (${error})`);
        } else {
            var archivedAmount = 0;
            currenciesData.sort((v1, v2) => {
                if (v1.is_active != v2.is_active) {
                    return v1.is_active ? -1 : 1;
                }
                if (v1.create_date != v2.create_date) {
                    return v1.create_date < v2.create_date ? -1 : 1;
                }
                return 0;
            });
            /** @type {bot.keyboard_button_inline_data[]} */
            var menuDataKeyboardRow = [];
            for (var i = 0; i < currenciesData.length; i++) {
                if (!currenciesData[i].is_active) {
                    archivedAmount++;
                    if (!shouldShowArchived) {
                        continue;
                    }
                }
                var currencyTitle = currenciesData[i].name ? `${currenciesData[i].name} (${currenciesData[i].code})` : currenciesData[i].code;
                menuDataKeyboardRow.push({
                    text: (currenciesData[i].is_active ? '🟢' : '🟡') + currencyTitle,
                    callback_data: makeMenuButton('currency', { currency: currenciesData[i].code })
                });
                if (menuDataKeyboardRow.length == 2) {
                    menuDataKeyboard.push(menuDataKeyboardRow);
                    menuDataKeyboardRow = [];
                }
            }
            if (menuDataKeyboardRow.length > 0) {
                menuDataKeyboard.push(menuDataKeyboardRow);
            }
            if (archivedAmount > 0) {
                menuDataKeyboard.push([{
                    text: shouldShowArchived ? `Hide archived` : `Show archived`, 
                    callback_data: makeMenuButton('currencies', { showAll: !shouldShowArchived }) 
                }]);
            }
        }
        if (userID == bot.getOwnerUserID()) {
            menuDataKeyboard.push([{ text: `Create new currency >>`, callback_data: makeActionButton('createCurrency') }]);
        }
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: makeMenuButton('wallet') }]);
        callback({
            text: makeMenuMessageTitle(`Currencies`) + `\nChoose a currency:`,
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
function createMenuData_currency(user, userData, args, callback) {
    const userID = user.id;
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    db.currency_get(currencyCode, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `[currency] failed to get data of currency ${currencyCode} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Currencies`, callback_data: makeMenuButton('currencies') }]]
            });
        } else {
            var menuText = (currencyData.is_active ? '🟢' : '🟡') + ` Currency *${bot.escapeMarkdown(currencyData.name ? `${currencyData.name} (${currencyCode})` : `${currencyCode}`)}*`;
            if (!currencyData.is_active) {
                menuText += ` _${bot.escapeMarkdown(`[archived]`)}_`;
            }
            /** @type {bot.keyboard_button_inline_data[][]} */
            var menuDataKeyboard = [];
            if (userID == bot.getOwnerUserID()) {
                /** @type {bot.keyboard_button_inline_data[]} */
                var menuDataKeyboeardRenameButtons = [];
                if (currencyData.name) {
                    menuDataKeyboeardRenameButtons.push({
                        text: `Clear name`,
                        callback_data: makeActionButton('renameCurrency', { currency: currencyCode, clearName: true })
                    });
                }
                menuDataKeyboeardRenameButtons.push({
                    text: 'Rename',
                    callback_data: makeActionButton('renameCurrency', { currency: currencyCode, clearName: false })
                });
                menuDataKeyboard.push(menuDataKeyboeardRenameButtons, [
                    { 
                        text: currencyData.is_active ? `Archive currency` : `Unarchive currency`, 
                        callback_data: makeActionButton('archiveCurrency', { currency: currencyCode, archive: currencyData.is_active })
                    }
                ], [
                    {
                        text: `Delete currency`,
                        callback_data: makeMenuButton('deleteCurrency', { currency: currencyCode })
                    }
                ]);
            }
            menuDataKeyboard.push([
                {
                    text: `<< Back to Currencies`,
                    callback_data: makeMenuButton('currencies')
                }
            ]);
            callback({
                text: menuText + `\nChoose what you want to do:`,
                parseMode: 'MarkdownV2',
                keyboard: menuDataKeyboard
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
function createMenuData_deleteCurrency(user, userData, args, callback) {
    const userID = user.id;
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    db.currency_get(currencyCode, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `[deleteCurrency] failed to get data of currency ${currencyCode} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Currencies`, callback_data: makeMenuButton('currencies') }]]
            });
        } else {
            callback({ 
                text: makeMenuMessageTitle(`Deleting currency`) + `\nYou are going to delete currency *${bot.escapeMarkdown(currencyCode)}*` + bot.escapeMarkdown(`. Are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: makeMenuButton('currency', { currency: currencyCode })
                    },
                    {
                        text: 'Yes',
                        callback_data: makeActionButton('currency', { currency: currencyCode })
                    }
                ]] 
            });
        }
    });
}