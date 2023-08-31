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
        debug: createMenuData_debug,
        debugPickDate: createMenuData_debugPickDate
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
                    callback_data: menuBase.makeMenuButton('debugPickDate')
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

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_debugPickDate(user, userData, args, callback) {
    const dateArg = args.date;
    var dateStr = '';
    if (typeof dateArg != 'number') {
        dateStr = 'NONE';
    } else {
        const date = menuBase.decodeDate(dateArg);
        dateStr = `${date.getUTCDate()}-${date.getUTCMonth() + 1}-${date.getUTCFullYear()}`;
    }
    callback({
        text: `*DEBUG _Date Picker_*\nCurrent date: ${bot.escapeMarkdown(dateStr)}`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: `Pick date`,
                    callback_data: menuBase.makeMenuButton('pickDate', { ...args, from: 'debugPickDate' })
                }
            ],
            [
                {
                    text: '<< DEBUG',
                    callback_data: menuBase.makeMenuButton('debug')
                }
            ]
        ]
    });
}