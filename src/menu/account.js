// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var menuBase = require('./wallet-menu-base');
var walletCommon = require('../wallet-common');
var walletMenu = require('../wallet-menu');

const log = {
    info: menuBase.info,
    warning: menuBase.warning,
    error: menuBase.error,
};

/**
 * @type {menuBase.menu_get_func}
 */
module.exports.get = () => {
    return {
        accounts:      createMenuData_accounts,
        account:       createMenuData_account,
        createAccount: createMenuData_createAccount,
        deleteAccount: createMenuData_deleteAccount,
        chooseAccount: { shortName: 'chA', handler: createMenuData_chooseAccount }
    };
}

const ARG_ACCOUNTS_SHOW_ARCHIVED = 'all';
const ARG_ACCOUNTS_PAGE = 'p';

const ARG_ACCOUNT_ACCOUNT_ID = 'id';

const ACCOUNT_ROW_SIZE = 2;
const ACCOUNT_MAX_ROWS = 10;
const ACCOUNT_PAGE_SIZE = ACCOUNT_ROW_SIZE * ACCOUNT_MAX_ROWS;
const CHOOSE_ACCOUNT_PAGE_SIZE = 10;

/**
 * @param {db.account_data} accountData 
 */
function getAccountName(accountData) {
    return walletCommon.getColorMarker(accountData.color, ' ') + accountData.name;
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_accounts(user, userData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = typeof args[ARG_ACCOUNTS_SHOW_ARCHIVED] === 'boolean' ? args[ARG_ACCOUNTS_SHOW_ARCHIVED] : false;
    const currentPage = typeof args[ARG_ACCOUNTS_PAGE] === 'number' ? args[ARG_ACCOUNTS_PAGE] : 0;
    db.account_getAll(userID, (accounts, error) => {
        if (error) {
            log.error(userID, `[accounts] failed to get accounts list (${error})`);
        }

        const activeAccounts = accounts.filter(v => v.is_active);
        const archivedAccountsAmount = accounts.length - activeAccounts.length;
        const filteredAccounts = shouldShowArchived ? accounts : activeAccounts;
        const firstAccountIndex = filteredAccounts.length > ACCOUNT_PAGE_SIZE ? ACCOUNT_PAGE_SIZE * currentPage : 0;
        const lastAccountIndex = Math.min(filteredAccounts.length, firstAccountIndex + ACCOUNT_PAGE_SIZE) - 1;

        /** @type {bot.keyboard_button_inline_data[][]} */
        var keyboard = [];
        if (archivedAccountsAmount > 0) {
            keyboard.push([{
                text: !shouldShowArchived ? `Show archived` : `Hide archived`,
                callback_data: menuBase.makeMenuButton('accounts', { [ARG_ACCOUNTS_SHOW_ARCHIVED]: !shouldShowArchived, [ARG_ACCOUNTS_PAGE]: 0 })
            }]);
        }
        /** @type {bot.keyboard_button_inline_data[]} */
        var keyboardRow = [];
        for (var i = firstAccountIndex; i <= lastAccountIndex; i++) {
            const accountData = filteredAccounts[i];
            keyboardRow.push({
                text: `${walletCommon.getAccountStatus(accountData)} ${getAccountName(accountData)}`,
                callback_data: menuBase.makeMenuButton('account', { [ARG_ACCOUNT_ACCOUNT_ID]: accountData.id })
            });
            if (keyboardRow.length >= ACCOUNT_ROW_SIZE) {
                keyboard.push(keyboardRow);
                keyboardRow = [];
            }
        }
        if (keyboardRow.length > 0) {
            while (keyboardRow.length < ACCOUNT_ROW_SIZE) {
                keyboardRow.push({
                    text: ` `,
                    callback_data: menuBase.makeDummyButton()
                });
            }
            keyboard.push(keyboardRow);
            keyboardRow = [];
        }
        if (filteredAccounts.length > ACCOUNT_PAGE_SIZE) {
            if (currentPage > 0) {
                keyboardRow.push({
                    text: `<< ${currentPage}`,
                    callback_data: menuBase.makeMenuButton('accounts', { ...args, [ARG_ACCOUNTS_PAGE]: currentPage - 1 })
                });
            } else {
                keyboardRow.push({
                    text: ` `,
                    callback_data: menuBase.makeDummyButton()
                });
            }
            keyboardRow.push({
                text: `${currentPage + 1}`,
                callback_data: menuBase.makeDummyButton()
            });
            if (lastAccountIndex < filteredAccounts.length - 1) {
                keyboardRow.push({
                    text: `${currentPage + 2} >>`,
                    callback_data: menuBase.makeMenuButton('accounts', { ...args, [ARG_ACCOUNTS_PAGE]: currentPage + 1 })
                });
            } else {
                keyboardRow.push({
                    text: ` `,
                    callback_data: menuBase.makeDummyButton()
                });
            }
            keyboard.push(keyboardRow);
        }
        keyboard.push([{ 
            text: `Create new account >>`, 
            callback_data: menuBase.makeMenuButton('createAccount') 
        }], [{ 
            text: `<< Back to Wallet`, 
            callback_data: menuBase.makeMenuButton('wallet') 
        }]);
        callback({
            text: `*Accounts*\nChoose an account:`,
            parseMode: 'MarkdownV2',
            keyboard: keyboard
        });
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_account(user, userData, args, callback) {
    const userID = user.id;
    const accountID = typeof args[ARG_ACCOUNT_ACCOUNT_ID] === 'number' ? args[ARG_ACCOUNT_ACCOUNT_ID] : db.invalid_id;
    /** @type {walletCommon.args_data} */
    const backButtonArgs = {};
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `[account] failed to get data of account ${accountID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ 
                    text: `<< Back to Accounts`, 
                    callback_data: menuBase.makeMenuButton('accounts', backButtonArgs) 
                }]]
            });
        } else {
            db.account_getBallance([ accountID ], {}, (ballances, error) => {
                const ballance = ballances[accountID];
                if (error || (typeof ballance === 'undefined')) {
                    log.error(userID, `[account] failed to get ballance of account ${accountData.id} "${accountData.name}" (${error})`);
                }
                /** @type {string[]} */
                var textLines = [];
                textLines.push(`${walletCommon.getAccountStatus(accountData)} Account *${bot.escapeMarkdown(getAccountName(accountData))}* ${bot.escapeMarkdown(`(${accountData.currency_code})`)}`);
                if (!accountData.is_active) {
                    textLines[0] += ` _\\[archived\\]_`;
                }
                textLines.push(`_Current ballance: ${bot.escapeMarkdown(`${Math.round(ballance) / 100}`)}_`);
                textLines.push(`Choose what you want to do:`);

                callback({
                    text: textLines.join('\n'),
                    parseMode: 'MarkdownV2',
                    keyboard: [
                        [
                            {
                                text: `Change color`,
                                callback_data: menuBase.makeMenuButton('changeColor', { accountID: accountID })
                            },
                            {
                                text: `Rename`,
                                callback_data: menuBase.makeActionButton('renameAccount', { accountID: accountID })
                            }
                        ],
                        [
                            {
                                text: `Delete`,
                                callback_data: menuBase.makeMenuButton('deleteAccount', { accountID: accountID })
                            },
                            { 
                                text: accountData.is_active ? `Archive` : `Unarchive`, 
                                callback_data: menuBase.makeActionButton('archiveAccount', { accountID: accountID, archive: accountData.is_active })
                            }
                        ],
                        [
                            { 
                                text: `<< Back to Accounts`, 
                                callback_data: menuBase.makeMenuButton('accounts', backButtonArgs) 
                            }
                        ]
                    ]
                });
            });
        }
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_createAccount(user, userData, args, callback) {
    const userID = user.id;
    db.currency_getAllForUser(userID, (currenciesData, error) => {
        /** @type {menuBase.menu_data} */
        var menuData = { text: menuBase.makeMenuMessageTitle(`Creating new account`) + `\nChoose currency for the new account:`, parseMode: 'MarkdownV2', keyboard: [] };
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
                    callback_data: menuBase.makeActionButton('createAccount', { currency: currenciesData[i].code })
                }]);
            }
            if (menuData.keyboard.length == 0) {
                log.warning(userID, `[createAccount_currency] there is no available currencies`);
                menuData.text = `_${bot.escapeMarkdown(`Can't find any active currency...`)}_`;
            }
        }
        menuData.keyboard.push([{ text: `<< Back to Accounts`, callback_data: menuBase.makeMenuButton('accounts') }]);
        callback(menuData);
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_deleteAccount(user, userData, args, callback) {
    const userID = user.id;
    const accountID = typeof args.accountID === 'number' ? args.accountID : db.invalid_id;
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `[deleteAccount] failed to get data of account ${accountID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Accounts`, callback_data: menuBase.makeMenuButton('accounts') }]]
            });
        } else {
            callback({ 
                text: menuBase.makeMenuMessageTitle(`Deleting account`) + `\nYou are going to delete account *${bot.escapeMarkdown(getAccountName(accountData))}*` + bot.escapeMarkdown(`. Are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: menuBase.makeMenuButton('account', { [ARG_ACCOUNT_ACCOUNT_ID]: accountID })
                    },
                    {
                        text: 'Yes',
                        callback_data: menuBase.makeActionButton('deleteAccount', { accountID: accountID })
                    }
                ]] 
            });
        }
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_chooseAccount(user, userData, args, callback) {
    const userID = user.id;
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const fromMenu = typeof args.from ==='string' ? walletMenu.getNameByShortName(args.from) : 'main';
    const outArg = typeof args.out === 'string' ? args.out : 'id';
    const excludeID = typeof args.eID === 'number' ? args.eID : db.invalid_id;
    const currentPage = typeof args._p === 'number' ? args._p : 0;
    var backButtonArgs = { ...args };
    delete backButtonArgs.from;
    delete backButtonArgs.out;
    delete backButtonArgs.eID;
    db.account_getAll(userID, (accounts, error) => {
        if (error) {
            log.error(userID, `[chooseAccount] failed to get list of accounts (${error})`);
        }

        const activeAccounts = accounts.filter(v => v.is_active);
        const firstAccountIndex = activeAccounts.length <= CHOOSE_ACCOUNT_PAGE_SIZE ? 0 : currentPage * CHOOSE_ACCOUNT_PAGE_SIZE;
        const lastAccountIndex = Math.min(activeAccounts.length, firstAccountIndex + CHOOSE_ACCOUNT_PAGE_SIZE) - 1;

        /** @type {bot.keyboard_button_inline_data[][]} */
        var keyboard = [];
        for (var i = firstAccountIndex; i <= lastAccountIndex; i++) {
            const accountData = activeAccounts[i];
            if (accountData.is_active && (accountData.id != excludeID)) {
                keyboard.push([{
                    text: getAccountName(accountData),
                    callback_data: menuBase.makeMenuButton(fromMenu, { ...backButtonArgs, [outArg]: accountData.id })
                }]);
            }
        }
        if (activeAccounts.length > CHOOSE_ACCOUNT_PAGE_SIZE) {
            /** @type {bot.keyboard_button_inline_data[]} */
            var controlKeyboardRow = [];
            if (currentPage > 0) {
                controlKeyboardRow.push({
                    text: `< ${currentPage}`,
                    callback_data: menuBase.makeMenuButton('chooseAccount', { ...args, _p: currentPage - 1 })
                });
            } else {
                controlKeyboardRow.push({
                    text: ` `,
                    callback_data: menuBase.makeDummyButton()
                });
            }
            controlKeyboardRow.push({
                text: `${currentPage + 1}`,
                callback_data: menuBase.makeDummyButton()
            });
            if (lastAccountIndex < activeAccounts.length - 1) {
                controlKeyboardRow.push({
                    text: `${currentPage + 2} >`,
                    callback_data: menuBase.makeMenuButton('chooseAccount', { ...args, _p: currentPage + 1 })
                });
            } else {
                controlKeyboardRow.push({
                    text: ` `,
                    callback_data: menuBase.makeDummyButton()
                });
            }
            keyboard.push(controlKeyboardRow);
        }
        keyboard.push([{
            text: 'NONE',
            callback_data: menuBase.makeMenuButton(fromMenu, { ...backButtonArgs, [outArg]: db.invalid_id })
        }], [{
            text: `<< Back`,
            callback_data: menuBase.makeMenuButton(fromMenu, backButtonArgs)
        }]);
        callback({
            text: `*Choose an account:*`, parseMode: 'MarkdownV2',
            keyboard: keyboard
        });
    });
}