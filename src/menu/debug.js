// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var dateFormat = require('../date-format');
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
        debug: createMenuData_debug
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_debug(user, userData, args, callback) {
    callback({
        text: `*DEBUG MENU*`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: 'Date picker',
                    callback_data: menuBase.makeMenuButton('pickDate', { ...args, from: 'debug' })
                }
            ],
            [
                {
                    text: '<< Main',
                    callback_data: menuBase.makeMenuButton('main')
                }
            ]
        ]
    });
}