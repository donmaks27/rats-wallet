// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var menuBase = require('./wallet-menu-base');

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
        currencies:     createMenuData_currencies,
        currency:       createMenuData_currency,
        deleteCurrency: createMenuData_deleteCurrency
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_currencies(user, userData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.showAll ? true : false;
    db.currency_getAllForUser(userID, (currenciesData, error) => {
        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuDataKeyboard = [];
        if (error) {
            log.error(userID, `[currencies] failed to get currencies list (${error})`);
        } else {
            var archivedAmount = 0;
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
                    text: (currenciesData[i].is_active ? '🟢 ' : '🟡 ') + currencyTitle,
                    callback_data: menuBase.makeMenuButton('currency', { currency: currenciesData[i].code })
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
                    callback_data: menuBase.makeMenuButton('currencies', { showAll: !shouldShowArchived }) 
                }]);
            }
        }
        if (userID == bot.getOwnerUserID()) {
            menuDataKeyboard.push([{ text: `Create new currency >>`, callback_data: menuBase.makeActionButton('createCurrency') }]);
        }
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: menuBase.makeMenuButton('wallet') }]);
        callback({
            text: menuBase.makeMenuMessageTitle(`Currencies`) + `\nChoose a currency:`,
            parseMode: 'MarkdownV2',
            keyboard: menuDataKeyboard
        });
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_currency(user, userData, args, callback) {
    const userID = user.id;
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    db.currency_get(currencyCode, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `[currency] failed to get data of currency ${currencyCode} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Currencies`, callback_data: menuBase.makeMenuButton('currencies') }]]
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
                        callback_data: menuBase.makeActionButton('renameCurrency', { currency: currencyCode, clearName: true })
                    });
                }
                menuDataKeyboeardRenameButtons.push({
                    text: 'Rename',
                    callback_data: menuBase.makeActionButton('renameCurrency', { currency: currencyCode, clearName: false })
                });
                menuDataKeyboard.push(menuDataKeyboeardRenameButtons, [
                    { 
                        text: currencyData.is_active ? `Archive currency` : `Unarchive currency`, 
                        callback_data: menuBase.makeActionButton('archiveCurrency', { currency: currencyCode, archive: currencyData.is_active })
                    }
                ], [
                    {
                        text: `Delete currency`,
                        callback_data: menuBase.makeMenuButton('deleteCurrency', { currency: currencyCode })
                    }
                ]);
            }
            menuDataKeyboard.push([
                {
                    text: `<< Back to Currencies`,
                    callback_data: menuBase.makeMenuButton('currencies')
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
 * @type {menuBase.menu_create_func}
 */
function createMenuData_deleteCurrency(user, userData, args, callback) {
    const userID = user.id;
    const currencyCode = typeof args.currency === 'string' ? args.currency : '';
    db.currency_get(currencyCode, (currencyData, error) => {
        if (error || !currencyData) {
            log.error(userID, `[deleteCurrency] failed to get data of currency ${currencyCode} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Currencies`, callback_data: menuBase.makeMenuButton('currencies') }]]
            });
        } else {
            callback({ 
                text: menuBase.makeMenuMessageTitle(`Deleting currency`) + `\nYou are going to delete currency *${bot.escapeMarkdown(currencyCode)}*` + bot.escapeMarkdown(`. Are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: menuBase.makeMenuButton('currency', { currency: currencyCode })
                    },
                    {
                        text: 'Yes',
                        callback_data: menuBase.makeActionButton('deleteCurrency', { currency: currencyCode })
                    }
                ]] 
            });
        }
    });
}