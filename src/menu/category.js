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
        categories: createMenuData_categories
    };
}

/**
 * @param {db.category_data} categoryData 
 */
function getColorMark(categoryData) {
    const isGlobal = categoryData.user_id == db.invalid_id;
    if (categoryData.is_active) {
        return !isGlobal ? '🟢' : '🟣';
    }
    return !isGlobal ? '🟡' : '🟠';
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_categories(user, userData, args, callback) {
    const categoryID = typeof args.categoryID === 'number' ? args.categoryID : db.invalid_id;
    if (categoryID == db.invalid_id) {
        createMenuData_categoriesForCategory(user, userData, null, null, args, callback);
    } else {
        db.category_get(categoryID, (categoryData, error) => {
            if (!categoryData) {
                createMenuData_categoriesForCategory(user, userData, categoryData, null, args, callback);
            } else {
                db.category_get(categoryData.parent_id, (parentCategoryData, error) => {
                    createMenuData_categoriesForCategory(user, userData, categoryData, parentCategoryData, args, callback);
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
function createMenuData_categoriesForCategory(user, userData, categoryData, parentCategoryData, args, callback) {
    const userID = user.id;
    const shouldShowArchived = args.showAll ? true : false;
    const categoryID = categoryData ? categoryData.id : db.invalid_id;
    db.category_getList(userID, categoryID, (categoriesData, error) => {
        if (error) {
            log.error(userID, `[categories] failed to get list of derrived categories from category ${categoryID} (${error})`);
        }

        var text = `*Categories*\n`;
        if (categoryData) {
            text += `Category *${bot.escapeMarkdown(categoryData.name)}*\n`
        }
        text += `Choose a category:`;

        /** @type {bot.keyboard_button_inline_data[][]} */
        var menuKeyboard = [];
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
                text: `${getColorMark(categoriesData[i])} ${categoriesData[i].name}`,
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
        if (parentCategoryData) {
            menuKeyboard.push([{
                text: `<< Back to category ${getColorMark(parentCategoryData)} ${parentCategoryData.name}`,
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