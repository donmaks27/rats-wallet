// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var menuBase = require('./wallet-menu-base');
var walletCommon = require('../wallet-common');

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
    };
}

/**
 * @param {db.account_data} accountData 
 */
function getAccountName(accountData) {
    return `${walletCommon.getColorMarker(accountData.color)} ${accountData.name}`;
}

/**
 * @type {menuBase.menu_create_func}
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
            for (var i = 0; i < accounts.length; i++) {
                if (!accounts[i].is_active) {
                    archivedAmount++;
                    if (!shouldShowArchived) {
                        continue;
                    }
                }
                menuDataKeyboardRow.push({
                    text: `${walletCommon.getAccountStatus(accounts[i])} ${getAccountName(accounts[i])}`,
                    callback_data: menuBase.makeMenuButton('account', { accountID: accounts[i].id })
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
                callback_data: menuBase.makeMenuButton('accounts', { showAll: !shouldShowArchived }) 
            }]);
        }
        menuDataKeyboard.push([{ text: `Create new account >>`, callback_data: menuBase.makeMenuButton('createAccount') }]);
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: menuBase.makeMenuButton('wallet') }]);
        callback({
            text: menuBase.makeMenuMessageTitle(`Accounts`) + `\nChoose an account:`,
            parseMode: 'MarkdownV2',
            keyboard: menuDataKeyboard
        });
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_account(user, userData, args, callback) {
    const userID = user.id;
    const accountID = typeof args.accountID === 'number' ? args.accountID : db.invalid_id;
    db.account_get(accountID, (accountData, error) => {
        if (error || !accountData) {
            log.error(userID, `[account] failed to get data of account ${accountID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Accounts`, callback_data: menuBase.makeMenuButton('accounts') }]]
            });
        } else {
            db.account_getBallance(accountID, {}, (ballance, error) => {
                if (error) {
                    log.error(userID, `[account] failed to get ballance of account "${accountData.name}" (${error})`);
                }
                /** @type {string[]} */
                var textLines = [];
                textLines.push(`${walletCommon.getAccountStatus(accountData)} Account *${bot.escapeMarkdown(getAccountName(accountData))}* ${bot.escapeMarkdown(`(${accountData.currency_code})`)}`);
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
                                callback_data: menuBase.makeMenuButton('accounts') 
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
                        callback_data: menuBase.makeMenuButton('account', { accountID: accountID })
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