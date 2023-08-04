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
    ...require('./menu/main').get(),
    ...require('./menu/account').get(),
    ...require('./menu/currency').get(),
    ...require('./menu/labels').get(),
    ...require('./menu/category').get(),
};

module.exports.sendMenuMessage = sendMenuMessage;
module.exports.changeMenuMessage = changeMenuMessage;

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

    const menuConstructor = WalletMenuConstructors[menu];
    if (!menuConstructor) {
        log.warning(userID, `invalid menu type "${menu}"`);
        if (callback) {
            callback(null, `invalid menu type "${menu}"`);
        }
        return;
    }

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
