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
        categories: createMenuData_categories,
        category: createMenuData_category,
        deleteCategory: createMenuData_deleteCategory
    };
}

/**
 * @param {db.category_data} categoryData 
 */
function getCategorylName(categoryData) {
    return `${walletCommon.getColorMarker(categoryData.color)} ${categoryData.name}`;
}
/**
 * @param {db.category_data} categoryData 
 * @param {db.user_data} userData 
 */
function isEditAvailable(categoryData, userData) {
    if (categoryData.user_id != db.invalid_id) {
        return categoryData.user_id == userData.id;
    }
    return bot.getOwnerUserID() == userData.id;
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_categories(user, userData, args, callback) {
    const categoryID = typeof args.categoryID === 'number' ? args.categoryID : db.invalid_id;
    if (categoryID == db.invalid_id) {
        createMenuData_categoriesPrivate(user, userData, null, null, args, callback);
    } else {
        db.category_get(categoryID, (categoryData, error) => {
            if (!categoryData) {
                createMenuData_categoriesPrivate(user, userData, categoryData, null, args, callback);
            } else {
                db.category_get(categoryData.parent_id, (parentCategoryData, error) => {
                    createMenuData_categoriesPrivate(user, userData, categoryData, parentCategoryData, args, callback);
                });
            }
        });
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {db.category_data | null} categoryData 
 * @param {db.category_data | null} parentCategoryData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function createMenuData_categoriesPrivate(user, userData, categoryData, parentCategoryData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.showAll ? true : false;
    const categoryID = categoryData ? categoryData.id : db.invalid_id;
    db.category_getList(userID, categoryID, (categoriesData, error) => {
        if (error) {
            log.error(userID, `[categories] failed to get list of derrived categories from category ${categoryID} (${error})`);
        }

        var text = `*Categories*\n`;
        if (categoryData) {
            text += `${walletCommon.getCategoryStatus(categoryData)} Category *${bot.escapeMarkdown(getCategorylName(categoryData))}*\n`
        }
        text += `Choose a category:`;

        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuKeyboard = [];
        if (categoryData && isEditAvailable(categoryData, userData)) {
            menuKeyboard.push([
                {
                    text: 'Edit',
                    callback_data: menuBase.makeMenuButton('category', { categoryID: categoryID })
                },
                {
                    text: 'Create',
                    callback_data: menuBase.makeActionButton('createCategory', { parentCategoryID: categoryID })
                }
            ]);
        } else {
            menuKeyboard.push([{
                text: 'Create',
                callback_data: menuBase.makeActionButton('createCategory', { parentCategoryID: categoryID })
            }]);
        }

        /** @type {bot.keyboard_button_inline_data[]} */
        var menuDataKeyboardRow = [];
        var archivedAmount = 0;
        for (var i = 0; i < categoriesData.length; i++) {
            if (!categoriesData[i].is_active) {
                archivedAmount++;
                if (!shouldShowArchived) {
                    continue;
                }
            }
            menuDataKeyboardRow.push({
                text: `${walletCommon.getCategoryStatus(categoriesData[i])} ${getCategorylName(categoriesData[i])}`,
                callback_data: menuBase.makeMenuButton('categories', { categoryID: categoriesData[i].id })
            });
            if (menuDataKeyboardRow.length == 3) {
                menuKeyboard.push(menuDataKeyboardRow);
                menuDataKeyboardRow = [];
            }
        }
        if (menuDataKeyboardRow.length > 0) {
            menuKeyboard.push(menuDataKeyboardRow);
        }
        if (archivedAmount > 0) {
            menuKeyboard.push([{
                text: !shouldShowArchived ? `Show archived` : `Hide archived`,
                callback_data: menuBase.makeMenuButton('categories', { categoryID: categoryID, showAll: !shouldShowArchived })
            }]);
        }
        if (parentCategoryData) {
            menuKeyboard.push([{
                text: `<< Back to category ${walletCommon.getCategoryStatus(parentCategoryData)} ${getCategorylName(parentCategoryData)}`,
                callback_data: menuBase.makeMenuButton('categories', { categoryID: parentCategoryData.id })
            }]);
        } else if (categoryData) {
            menuKeyboard.push([{
                text: `<< Back to base categories`,
                callback_data: menuBase.makeMenuButton('categories')
            }]);
        }
        menuKeyboard.push([{
            text: `<< Back to Wallet`,
            callback_data: menuBase.makeMenuButton('wallet')
        }]);

        callback({ text: text, parseMode: 'MarkdownV2', keyboard: menuKeyboard });
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_category(user, userData, args, callback) {
    const userID = user.id;
    const categoryID = typeof args.categoryID === 'number' ? args.categoryID : db.invalid_id;
    db.category_get(categoryID, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `[category] failed to get data of category ${categoryID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Categories`, callback_data: menuBase.makeMenuButton('categories', { categoryID: categoryID }) }]]
            });
        } else if (!isEditAvailable(categoryData, userData)) {
            log.warning(userID, `[category] user ${userID} can't edit category ${categoryID}`);
            callback({
                text: `🛑`,
                keyboard: [[{ text: `<< Back to Categories`, callback_data: menuBase.makeMenuButton('categories', { categoryID: categoryID }) }]]
            });
        } else {
            db.category_get(categoryData.parent_id, (parentCategoryData, error) => {
                /** @type {string[]} */
                var textLines = [
                    `${walletCommon.getCategoryStatus(categoryData)} Category *${bot.escapeMarkdown(getCategorylName(categoryData))}*` + (!categoryData.is_active ? ` _\\[archived\\]_` : ''),
                    `Choose what you want to do:`
                ];
                /** @type {bot.keyboard_button_inline_data[][]} */
                var menuKeyboard = [];
                if ((categoryData.user_id != db.invalid_id) && (!parentCategoryData || (parentCategoryData.user_id == db.invalid_id))) {
                    menuKeyboard.push([
                        {
                            text: 'Make global',
                            callback_data: menuBase.makeActionButton('makeCategoryGlobal', { categoryID: categoryID })
                        }
                    ]);
                }
                menuKeyboard.push([
                    {
                        text: 'Change color',
                        callback_data: menuBase.makeActionButton('changeColor', { categoryID: categoryID })
                    },
                    {
                        text: 'Rename',
                        callback_data: menuBase.makeActionButton('renameCategory', { categoryID: categoryID })
                    }
                ]);
                menuKeyboard.push([
                    {
                        text: 'Delete',
                        callback_data: menuBase.makeMenuButton('deleteCategory', { categoryID: categoryID })
                    },
                    {
                        text: categoryData.is_active ? `Archive` : `Unarchive`, 
                        callback_data: menuBase.makeActionButton('archiveCategory', { categoryID: categoryID, archive: categoryData.is_active })
                    }
                ]);
                menuKeyboard.push([{
                    text: '<< Back to Categories',
                    callback_data: menuBase.makeMenuButton('categories', { categoryID: categoryID })
                }]);
                callback({
                    text: textLines.join('\n'), parseMode: 'MarkdownV2',
                    keyboard: menuKeyboard
                });
            });
        }
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_deleteCategory(user, userData, args, callback) {
    const userID = user.id;
    const categoryID = typeof args.categoryID === 'number' ? args.categoryID : db.invalid_id;
    db.category_get(categoryID, (categoryData, error) => {
        if (error || !categoryData) {
            log.error(userID, `[deleteCategory] failed to get data of category ${categoryID} (${error})`);
            callback({
                text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
                keyboard: [[{ text: `<< Back to Categories`, callback_data: menuBase.makeMenuButton('categories', { categoryID: categoryID }) }]]
            });
        } else {
            callback({ 
                text: menuBase.makeMenuMessageTitle(`Deleting category`) + `\nYou are going to delete category *${bot.escapeMarkdown(categoryData.name)}*` + bot.escapeMarkdown(`. Are you sure?`), 
                parseMode: 'MarkdownV2', 
                keyboard: [[
                    {
                        text: 'No',
                        callback_data: menuBase.makeMenuButton('category', { categoryID: categoryID })
                    },
                    {
                        text: 'Yes',
                        callback_data: menuBase.makeActionButton('deleteCategory', { categoryID: categoryID, parentCategoryID: categoryData.parent_id })
                    }
                ]] 
            });
        }
    });
}