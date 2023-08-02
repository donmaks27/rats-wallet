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
        labels: createMenuData_labels,
        label: createMenuData_label
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_labels(user, userData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.showAll ? true : false;
    db.label_getAllForUser(userID, (labelsData, error) => {
        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuDataKeyboard = [];
        var archivedAmount = 0;
        if (error) {
            log.error(userID, `[labels] failed to get labels list (${error})`);
        } else {
            /** @type {bot.keyboard_button_inline_data[]} */
            var menuDataKeyboardRow = [];
            for (var i = 0; i < labelsData.length; i++) {
                if (!labelsData[i].is_active) {
                    archivedAmount++;
                    if (!shouldShowArchived) {
                        continue;
                    }
                }
                menuDataKeyboardRow.push({
                    text: (labelsData[i].is_active ? '🟢 ' : '🟡 ') + labelsData[i].name,
                    callback_data: menuBase.makeMenuButton('label', { labelID: labelsData[i].id })
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
                callback_data: menuBase.makeMenuButton('labels', { showAll: !shouldShowArchived }) 
            }]);
        }
        //menuDataKeyboard.push([{ text: `Create new label >>`, callback_data: menuBase.makeMenuButton('createLabel') }]);
        menuDataKeyboard.push([{ text: `<< Back to Wallet`, callback_data: menuBase.makeMenuButton('wallet') }]);
        callback({
            text: menuBase.makeMenuMessageTitle(`Labels`) + `\nChoose a label:`,
            parseMode: 'MarkdownV2',
            keyboard: menuDataKeyboard
        });
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_label(user, userData, args, callback) {
    const userID = user.id;
    const labelID = typeof args.labelID === 'number' ? args.labelID : db.invalid_id;
    db.label_get(labelID, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `[label] failed to get data of label ${labelID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Labels`, callback_data: menuBase.makeMenuButton('labels') }]]
            });
        } else {
            /** @type {string[]} */
            var textLines = [];
            textLines.push((labelData.is_active ? '🟢' : '🟡') + ` Label *${bot.escapeMarkdown(labelData.name)}*`);
            if (!labelData.is_active) {
                textLines[0] += ` _\\[archived\\]_`;
            }
            textLines.push(`Choose what you want to do:`);
            callback({
                text: textLines.join('\n'),
                parseMode: 'MarkdownV2',
                keyboard: [
                    [
                        { 
                            text: labelData.is_active ? `Archive label` : `Unarchive label`, 
                            callback_data: menuBase.makeActionButton('archiveLabel', { labelID: labelID, archive: labelData.is_active })
                        }
                    ],
                    /*[
                        {
                            text: `Delete account`,
                            callback_data: menuBase.makeMenuButton('deleteAccount', { accountID: accountID })
                        }
                    ],*/
                    [
                        { 
                            text: `<< Back to Labels`, 
                            callback_data: menuBase.makeMenuButton('labels') 
                        }
                    ]
                ]
            });
        }
    });
}