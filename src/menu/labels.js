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
        label: createMenuData_label,
        deleteLabel: createMenuData_deleteLabel,
        makeLabelGlobal: createMenuData_makeLabelGlobal
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
                const isGlobal = labelsData[i].user_id == db.invalid_id;
                menuDataKeyboardRow.push({
                    text: (labelsData[i].is_active ? (isGlobal ? '🟣' : '🟢') : '🟡') + ' ' + labelsData[i].name,
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
        menuDataKeyboard.push([{ text: `Create new label >>`, callback_data: menuBase.makeActionButton('createLabel') }]);
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
            const isGlobal = labelData.user_id == db.invalid_id;
            /** @type {string[]} */
            var textLines = [
                ` Label *${bot.escapeMarkdown(labelData.name)}*`,
                `Choose what you want to do:`
            ];
            if (labelData.is_active) {
                textLines[0] = (!isGlobal ? '🟢' : '🟣') + textLines[0];
            } else {
                textLines[0] = '🟡' + textLines[0] + ` _\\[archived\\]_`;
            }
            /** @type {bot.keyboard_button_inline_data[][]} */
            var menuKeyboard = [];
            if (!isGlobal || (userID == bot.getOwnerUserID())) {
                if (!isGlobal && (userID == bot.getOwnerUserID())) {
                    menuKeyboard.push([
                        {
                            text: `Make global`,
                            callback_data: menuBase.makeMenuButton('makeLabelGlobal', { labelID: labelID })
                        }
                    ]);
                }
                menuKeyboard.push([
                    { 
                        text: labelData.is_active ? `Archive label` : `Unarchive label`, 
                        callback_data: menuBase.makeActionButton('archiveLabel', { labelID: labelID, archive: labelData.is_active })
                    }
                ], [
                    {
                        text: `Delete label`,
                        callback_data: menuBase.makeMenuButton('deleteLabel', { labelID: labelID })
                    }
                ]);
            }
            menuKeyboard.push([{ 
                text: `<< Back to Labels`, 
                callback_data: menuBase.makeMenuButton('labels') 
            }]);
            callback({
                text: textLines.join('\n'),
                parseMode: 'MarkdownV2',
                keyboard: menuKeyboard
            });
        }
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_deleteLabel(user, userData, args, callback) {
    const userID = user.id;
    const labelID = typeof args.labelID === 'number' ? args.labelID : db.invalid_id;
    db.label_get(labelID, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `[deleteLabel] failed to get data of label ${labelID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Labels`, callback_data: menuBase.makeMenuButton('labels') }]]
            });
        } else {
            callback({ 
                text: menuBase.makeMenuMessageTitle(`Deleting label`) + `\nYou are going to delete label *${bot.escapeMarkdown(labelData.name)}*` + bot.escapeMarkdown(`. Are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: menuBase.makeMenuButton('label', { labelID: labelID })
                    },
                    {
                        text: 'Yes',
                        callback_data: menuBase.makeActionButton('deleteLabel', { labelID: labelID })
                    }
                ]] 
            });
        }
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_makeLabelGlobal(user, userData, args, callback) {
    const userID = user.id;
    if (bot.getOwnerUserID() != userID) {
        callback({
            text: `🛑`, parseMode: 'MarkdownV2',
            keyboard: [[{ text: `<< Back to Labels`, callback_data: menuBase.makeMenuButton('labels') }]]
        });
        return;
    }

    const labelID = typeof args.labelID === 'number' ? args.labelID : db.invalid_id;
    db.label_get(labelID, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `[deleteLabel] failed to get data of label ${labelID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Labels`, callback_data: menuBase.makeMenuButton('labels') }]]
            });
        } else {
            callback({ 
                text: menuBase.makeMenuMessageTitle(`Making label global`) + `\nYou are going to make label *${bot.escapeMarkdown(labelData.name)}* global` + bot.escapeMarkdown(`. This action is irreversible, are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: menuBase.makeMenuButton('label', { labelID: labelID })
                    },
                    {
                        text: 'Yes',
                        callback_data: menuBase.makeActionButton('makeLabelGlobal', { labelID: labelID })
                    }
                ]] 
            });
        }
    });
}