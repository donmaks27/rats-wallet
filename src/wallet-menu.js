// @ts-check


var db  = require('./database');
var bot = require('./telegram-bot');
var walletCommon = require('./wallet-common');
var menuBase = require('./menu/wallet-menu-base');

const log = {
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    error: (userID, msg) => menuBase.error(userID, msg),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    warning: (userID, msg) => menuBase.warning(userID, msg),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    info: (userID, msg) => menuBase.info(userID, msg)
};
const WalletMenuConstructors = {
    ...require('./menu/debug').get(),
    ...require('./menu/utils').get(),
    ...require('./menu/main').get(),
    ...require('./menu/account').get(),
    ...require('./menu/currency').get(),
    ...require('./menu/labels').get(),
    ...require('./menu/category').get(),
    ...require('./menu/records').get(),
};
const WalletMenusMap = makeWalletMenusMap(WalletMenuConstructors);

/**
 * @param {walletCommon.menu_type} menu 
 */
module.exports.getShortName = function(menu) {
    const menuHandler = WalletMenuConstructors[menu];
    return menuHandler && (typeof menuHandler !== 'function') ? menuHandler.shortName : menu;
}
/**
 * @param {string} shortName 
 */
module.exports.getNameByShortName = function(shortName) {
    const menuName = WalletMenusMap[shortName];
    return menuName ? menuName : shortName;
}
module.exports.sendMenuMessage = sendMenuMessage;
module.exports.changeMenuMessage = changeMenuMessage;

/**
 * @param {{ [menu: string]: menuBase.menu_create_func | { shortName: string, handler: menuBase.menu_create_func } }} menus 
 */
function makeWalletMenusMap(menus) {
    /** @type {{ [shortName: string]: string }} */
    var result = {};
    const menuNames = Object.getOwnPropertyNames(menus);
    for (var i = 0; i < menuNames.length; i++) {
        const menuName = menuNames[i];
        const menuData = menus[menuName];
        if (menuData && (typeof menuData !== 'function')) {
            if (result[menuData.shortName]) {
                console.log(`[DEBUG ERROR] dublicate menu short name '${menuData.shortName}', menu '${menuName}'`);
            }
            result[menuData.shortName] = menuName;
        }
    }
    return result;
}

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

    const menuHandler = WalletMenuConstructors[menu];
    if (!menuHandler) {
        log.warning(userID, `invalid menu type "${menu}"`);
        if (callback) {
            callback(null, `invalid menu type "${menu}"`);
        }
        return;
    }
    const menuConstructor = typeof menuHandler !== 'function' ? menuHandler.handler : menuHandler;

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
