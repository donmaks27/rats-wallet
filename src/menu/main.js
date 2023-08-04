// @ts-check

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
        main: createMenuData_main,
        settings: createMenuData_settings,
        wallet: createMenuData_wallet
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_main(user, userData, args, callback) {
    callback({
        text: `Welcome, ${userData.name}!\nChoose what you want to do:`,
        keyboard: [
            [
                {
                    text: 'Wallet >>',
                    callback_data: menuBase.makeMenuButton('wallet')
                }
            ],
            [
                {
                    text: 'Invite user',
                    callback_data: menuBase.makeActionButton('invite')
                }
            ],
            [
                {
                    text: 'Settings >>',
                    callback_data: menuBase.makeMenuButton('settings')
                }
            ]
        ]
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_settings(user, userData, args, callback) {
    callback({
        text: `Welcome, ${userData.name}!\nChoose what you want to do:`,
        keyboard: [
            [
                {
                    text: 'Change name',
                    callback_data: menuBase.makeActionButton('renameUser')
                }
            ],
            [
                {
                    text: '<< Back to Main',
                    callback_data: menuBase.makeMenuButton('main')
                }
            ]
        ]
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_wallet(user, userData, args, callback) {
    callback({
        text: menuBase.makeMenuMessageTitle(`This is your wallet`) + `\nChoose what you want to do:`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: 'Accounts >>',
                    callback_data: menuBase.makeMenuButton('accounts')
                }
            ],
            [
                {
                    text: 'Currencies >>',
                    callback_data: menuBase.makeMenuButton('currencies')
                },
                {
                    text: 'Labels >>',
                    callback_data: menuBase.makeMenuButton('labels')
                },
                {
                    text: 'Categories >>',
                    callback_data: menuBase.makeMenuButton('categories')
                }
            ],
            [
                {
                    text: '<< Back to Main',
                    callback_data: menuBase.makeMenuButton('main')
                }
            ]
        ]
    });
}