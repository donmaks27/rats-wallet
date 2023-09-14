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
        categories: createMenuData_categories,
        category: createMenuData_category,
        deleteCategory: createMenuData_deleteCategory,
        chooseCategory: { shortName: 'chC', handler: createMenuData_chooseCategory }
    };
}

/**
 * @param {db.category_data} categoryData 
 */
function getCategoryName(categoryData) {
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
    db.category_getList(userID, { parent_category_id: categoryID }, (categoriesData, error) => {
        if (error) {
            log.error(userID, `[categories] failed to get list of derrived categories from category ${categoryID} (${error})`);
        }

        var text = `*Categories*\n`;
        if (categoryData) {
            text += `${walletCommon.getCategoryStatus(categoryData)} Category *${bot.escapeMarkdown(getCategoryName(categoryData))}*\n`
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
                text: `${walletCommon.getCategoryStatus(categoriesData[i])} ${getCategoryName(categoriesData[i])}`,
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
                text: `<< Back to category ${walletCommon.getCategoryStatus(parentCategoryData)} ${getCategoryName(parentCategoryData)}`,
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
                    `${walletCommon.getCategoryStatus(categoryData)} Category *${bot.escapeMarkdown(getCategoryName(categoryData))}*` + (!categoryData.is_active ? ` _\\[archived\\]_` : ''),
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
                        callback_data: menuBase.makeMenuButton('changeColor', { categoryID: categoryID })
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

const ARG_CHOOSE_PREV_CATEGORY = 'pID';
const CHOOSE_CATEGORY_PAGE_SIZE = 3;

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_chooseCategory(user, userData, args, callback) {
    const userID = user.id;
    const prevCategoryID = args[ARG_CHOOSE_PREV_CATEGORY];
    if (typeof prevCategoryID === 'number') {
        db.category_get(prevCategoryID, (prevCatergoryData, error) => {
            if (error || !prevCatergoryData) {
                log.warning(userID, `[chooseCategory] failed to get data of previous category ${prevCategoryID} (${error})`);
                onChooseCategory_prevCategoryReady(user, userData, null, args, callback);
            } else {
                onChooseCategory_prevCategoryReady(user, userData, prevCatergoryData, args, callback);
            }
        });
    } else {
        onChooseCategory_prevCategoryReady(user, userData, null, args, callback);
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {db.category_data | null} prevCatergoryData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function onChooseCategory_prevCategoryReady(user, userData, prevCatergoryData, args, callback) {
    const userID = user.id;
    const parentCategoryID = typeof args._c === 'number' ? args._c : (prevCatergoryData ? prevCatergoryData.parent_id : db.invalid_id);
    if (!prevCatergoryData || (parentCategoryID != prevCatergoryData.id)) {
        db.category_get(parentCategoryID, (parentCategoryData, error) => {
            if (error || !parentCategoryData) {
                log.warning(userID, `[chooseCategory] failed to get data of parent category ${parentCategoryID} (${error})`);
                onChooseCategory_ready(user, userData, prevCatergoryData, null, args, callback);
            } else {
                onChooseCategory_ready(user, userData, prevCatergoryData, parentCategoryData, args, callback);
            }
        });
    } else {
        onChooseCategory_ready(user, userData, prevCatergoryData, prevCatergoryData, args, callback);
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {db.category_data | null} prevCatergoryData 
 * @param {db.category_data | null} parentCategoryData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function onChooseCategory_ready(user, userData, prevCatergoryData, parentCategoryData, args, callback) {
    const userID = user.id;
    const parentCategoryID = parentCategoryData ? parentCategoryData.id : db.invalid_id;
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const fromMenu = typeof args.from === 'string' ? walletMenu.getNameByShortName(args.from) : 'main';
    const outArg = typeof args.out === 'string' ? args.out : 'id';
    const currentPage = typeof args._p === 'number' ? args._p : 0;

    var backButtonArgs = { ...args };
    delete backButtonArgs.from;
    delete backButtonArgs.out;
    delete backButtonArgs[ARG_CHOOSE_PREV_CATEGORY];
    delete backButtonArgs._c;
    delete backButtonArgs._p;

    db.category_getList(userID, { parent_category_id: parentCategoryID, include_children: true, exclude_archived: true }, (categories, error) => {
        if (error) {
            log.error(userID, `[chooseCategory] failed to get child categories list from ${parentCategoryID} (${error})`);
        } else if (categories.length == 0) {
            log.warning(userID, `[chooseCategory] empty list of categories from ${parentCategoryID}`);
        }

        var menuText = `*Choose a category*`;
        if (prevCatergoryData) {
            menuText += `\n_${bot.escapeMarkdown(`Prev. category:`)}_ ${bot.escapeMarkdown(getCategoryName(prevCatergoryData))}`;
        }
        if (parentCategoryData) {
            menuText += `\n*Parent category:* ${bot.escapeMarkdown(getCategoryName(parentCategoryData))}`;
        }

        const firstCategoryIndex = categories.length <= CHOOSE_CATEGORY_PAGE_SIZE ? 0 : CHOOSE_CATEGORY_PAGE_SIZE * currentPage;
        const lastCategoryIndex = Math.min(categories.length, firstCategoryIndex + CHOOSE_CATEGORY_PAGE_SIZE) - 1;

        /** @type {bot.keyboard_button_inline_data[][]} */
        var keyboard = [];
        if (parentCategoryData) {
            keyboard.push([{
                text: `<< Parent category`,
                callback_data: menuBase.makeMenuButton('chooseCategory', { ...args, _c: parentCategoryData.parent_id, _p: 0 })
            }]);
        }
        for (var i = firstCategoryIndex; i <= lastCategoryIndex; i++) {
            /** @type {bot.keyboard_button_inline_data[]} */
            var categoryKeyboardRow = [{
                text: getCategoryName(categories[i]),
                callback_data: menuBase.makeMenuButton(fromMenu, { ...backButtonArgs, [outArg]: categories[i].id })
            }];
            const childrenAmount = categories[i].childrenAmount;
            if (childrenAmount && (childrenAmount > 0)) {
                categoryKeyboardRow.push({
                    text: `Open >>`,
                    callback_data: menuBase.makeMenuButton('chooseCategory', { ...args, _c: categories[i].id, _p: 0 })
                });
            }
            keyboard.push(categoryKeyboardRow);
        }
        if (categories.length > CHOOSE_CATEGORY_PAGE_SIZE) {
            /** @type {bot.keyboard_button_inline_data[]} */
            var controlKeyboardRow = [];
            if (currentPage > 0) {
                controlKeyboardRow.push({
                    text: `< ${currentPage}`,
                    callback_data: menuBase.makeMenuButton('chooseCategory', { ...args, _c: parentCategoryID, _p: currentPage - 1 })
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
            if (lastCategoryIndex < categories.length - 1) {
                controlKeyboardRow.push({
                    text: `${currentPage + 2} >`,
                    callback_data: menuBase.makeMenuButton('chooseCategory', { ...args, _c: parentCategoryID, _p: currentPage + 1 })
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
            text: '<< Back',
            callback_data: menuBase.makeMenuButton(fromMenu, backButtonArgs)
        }]);
        callback({
            text: menuText, parseMode: 'MarkdownV2',
            keyboard: keyboard
        });
    });
}