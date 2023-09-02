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
        debugPickDate: createMenuData_debugPickDate,
        debugPickTime: createMenuData_debugPickTime
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
                },
                {
                    text: 'Time picker',
                    callback_data: menuBase.makeMenuButton('debugPickTime')
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
    const dateArg = args.currDate;
    var dateStr = '';
    if (typeof dateArg !== 'string') {
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
                    callback_data: menuBase.makeMenuButton('uPickD', { ...args, from: 'debugPickDate', out: 'currDate' })
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

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_debugPickTime(user, userData, args, callback) {
    const timeArg = args.currTime;
    var timeStr = '';
    if (typeof timeArg !== 'number') {
        timeStr = 'NONE';
    } else {
        const time = menuBase.decodeTime(timeArg);
        timeStr = `${time.getUTCHours()}:${time.getUTCMinutes()}`;
    }
    callback({
        text: `*DEBUG _Time Picker_*\nCurrent time: ${bot.escapeMarkdown(timeStr)}`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: `Pick time`,
                    callback_data: menuBase.makeMenuButton('uPickT', { ...args, from: 'debugPickTime', out: 'currTime' })
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