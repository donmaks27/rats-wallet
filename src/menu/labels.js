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
        labels: createMenuData_labels,
        label: createMenuData_label,
        deleteLabel: createMenuData_deleteLabel,
        makeLabelGlobal: createMenuData_makeLabelGlobal,
        chooseLabel: { shortName: 'chL', handler: createMenuData_chooseLabel }
    };
}

const CHOOSE_LABEL_ROW_SIZE = 3;
const CHOOSE_LABEL_ROWS = 10;
const CHOOSE_LABEL_PAGE_SIZE = CHOOSE_LABEL_ROW_SIZE * CHOOSE_LABEL_ROWS;

/**
 * @param {db.label_data} labelData 
 */
function getLabelName(labelData) {
    return walletCommon.getColorMarker(labelData.color, ' ') + labelData.name;
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
                    text: `${walletCommon.getLabelStatus(labelsData[i])} ${getLabelName(labelsData[i])}`,
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
                `${walletCommon.getLabelStatus(labelData)} Label *${bot.escapeMarkdown(getLabelName(labelData))}*` + (!labelData.is_active ? ` _\\[archived\\]_` : ''),
                `Choose what you want to do:`
            ];
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
                        text: 'Change color',
                        callback_data: menuBase.makeMenuButton('changeColor', { labelID: labelID })
                    },
                    {
                        text: `Rename`,
                        callback_data: menuBase.makeActionButton('renameLabel', { labelID: labelID })
                    }
                ],[
                    {
                        text: `Delete`,
                        callback_data: menuBase.makeMenuButton('deleteLabel', { labelID: labelID })
                    },
                    { 
                        text: labelData.is_active ? `Archive` : `Unarchive`, 
                        callback_data: menuBase.makeActionButton('archiveLabel', { labelID: labelID, archive: labelData.is_active })
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
                text: menuBase.makeMenuMessageTitle(`Deleting label`) + `\nYou are going to delete label *${bot.escapeMarkdown(getLabelName(labelData))}*` + bot.escapeMarkdown(`. Are you sure?`), 
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
        log.error(userID, `[makeLabelGlobal] unauthorized access`);
        callback({
            text: `🛑`, parseMode: 'MarkdownV2',
            keyboard: [[{ text: `<< Back to Labels`, callback_data: menuBase.makeMenuButton('labels') }]]
        });
        return;
    }

    const labelID = typeof args.labelID === 'number' ? args.labelID : db.invalid_id;
    db.label_get(labelID, (labelData, error) => {
        if (error || !labelData) {
            log.error(userID, `[makeLabelGlobal] failed to get data of label ${labelID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Labels`, callback_data: menuBase.makeMenuButton('labels') }]]
            });
        } else {
            callback({ 
                text: menuBase.makeMenuMessageTitle(`Making label global`) + `\nYou are going to make label *${bot.escapeMarkdown(getLabelName(labelData))}* global` + bot.escapeMarkdown(`. This action is irreversible, are you sure?`), 
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

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_chooseLabel(user, userData, args, callback) {
    const userID = user.id;
    db.label_getAllForUser(userID, (labels, error) => {
        if (error) {
            log.error(userID, `[chooseLabel] failed to get list of user's labels (${error})`);
        }
        if (labels.length == 0) {
            onChooseLabelReady(user, userData, [], args, callback);
        } else {
            db.record_getTempLabels(userID, (tempLabels, error) => {
                if (error) {
                    log.error(userID, `[chooseLabel] failed to get list of temp user's labels (${error})`);
                }
                onChooseLabelReady(user, userData, labels.filter(v => v.is_active && !tempLabels.some(v1 => v.id == v1.id)), args, callback);
            });
        }
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {db.label_data[]} labels 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function onChooseLabelReady(user, userData, labels, args, callback) {
    const userID = user.id;
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const fromMenu = typeof args.from === 'string' ? walletMenu.getNameByShortName(args.from) : 'main';
    const outArg = typeof args.out === 'string' ? args.out : 'id';
    const requiredValidID = typeof args.r === 'boolean' ? args.r : false;
    const currentPage = typeof args._p === 'number' ? args._p : 0;

    var backButtonArgs = { ...args };
    delete backButtonArgs.from;
    delete backButtonArgs.out;
    delete backButtonArgs._p;

    const firstCategoryIndex = labels.length <= CHOOSE_LABEL_PAGE_SIZE ? 0 : CHOOSE_LABEL_PAGE_SIZE * currentPage;
    const lastCategoryIndex = Math.min(labels.length, firstCategoryIndex + CHOOSE_LABEL_PAGE_SIZE) - 1;

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardRow = [];
    for (var i = firstCategoryIndex; i <= lastCategoryIndex; i++) {
        keyboardRow.push({
            text: getLabelName(labels[i]),
            callback_data: menuBase.makeMenuButton(fromMenu, { ...backButtonArgs, [outArg]: labels[i].id })
        });
        if (keyboardRow.length >= CHOOSE_LABEL_ROW_SIZE) {
            keyboard.push(keyboardRow);
            keyboardRow = [];
        }
    }
    if (keyboardRow.length > 0) {
        keyboard.push(keyboardRow);
        keyboardRow = [];
    }
    if (labels.length > CHOOSE_LABEL_PAGE_SIZE) {
        if (currentPage > 0) {
            keyboardRow.push({
                text: `< ${currentPage}`,
                callback_data: menuBase.makeMenuButton('chooseLabel', { ...args, _p: currentPage - 1 })
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
        if (lastCategoryIndex < labels.length - 1) {
            keyboardRow.push({
                text: `${currentPage + 2} >`,
                callback_data: menuBase.makeMenuButton('chooseCategory', { ...args, _p: currentPage + 1 })
            });
        } else {
            keyboardRow.push({
                text: ` `,
                callback_data: menuBase.makeDummyButton()
            });
        }
        keyboard.push(keyboardRow);
    }
    if (!requiredValidID) {
        keyboard.push([{
            text: 'NONE',
            callback_data: menuBase.makeMenuButton(fromMenu, { ...backButtonArgs, [outArg]: db.invalid_id })
        }]);
    }
    keyboard.push([{
        text: '<< Back',
        callback_data: menuBase.makeMenuButton(fromMenu, backButtonArgs)
    }]);
    callback({
        text: `*Choose a label:*`, parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}