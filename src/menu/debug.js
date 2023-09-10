// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var dateFormat = require('../date-format');
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
        debug: createMenuData_debug,
        debugPickDate: { shortName: 'dPD', handler: createMenuData_debugPickDate },
        debugPickTime: { shortName: 'dPT', handler: createMenuData_debugPickTime },
        debugNumpad:   { shortName: 'dN', handler: createMenu_debugNumpad },
        debugChooseAccount: { shortName: 'dChA', handler: createMenu_debugChooseAccount }
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
                },
                {
                    text: 'Numpad',
                    callback_data: menuBase.makeMenuButton('debugNumpad')
                }
            ],
            [
                {
                    text: 'Choose account',
                    callback_data: menuBase.makeMenuButton('debugChooseAccount')
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
    const dateArg = args.d;
    var dateStr = '';
    if (typeof dateArg !== 'number') {
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
                    callback_data: menuBase.makeMenuButton('pickDate', { ...args, from: walletMenu.getShortName('debugPickDate'), out: 'd' })
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
    const timeArg = args.t;
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
                    callback_data: menuBase.makeMenuButton('pickTime', { ...args, from: walletMenu.getShortName('debugPickTime'), out: 't' })
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
function createMenu_debugNumpad(user, userData, args, callback) {
    const numberArg = args.dnum;
    var numberStr = 'NONE';
    if (typeof numberArg === 'number') {
        const lastPart = numberArg % 100;
        numberStr = `${Math.floor(numberArg / 100)}.${lastPart < 10 ? '0' : ''}${lastPart}`;
    }
    callback({
        text: `*DEBUG _Numpad_*\nCurrent number: ${bot.escapeMarkdown(numberStr)}`, parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: 'Numpad',
                    callback_data: menuBase.makeMenuButton('enterNumber', { from: walletMenu.getShortName('debugNumpad'), out: 'dnum', dnum: numberArg })
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
function createMenu_debugChooseAccount(user, userData, args, callback) {
    var accountIDArg = typeof args.aID === 'number' ? args.aID : db.invalid_id;
    db.account_get(accountIDArg, (accountData, error) => {
        var menuText = '';
        if (error || !accountData) {
            menuText = `*ERROR:* ${error ? bot.escapeMarkdown(error) : 'none'}`;
            accountIDArg = db.invalid_id;
        } else {
            menuText = bot.escapeMarkdown(walletCommon.getColorMarker(accountData.color, ' ') + accountData.name);
        }
        callback({
            text: `*DEBUG _Choose account_*\n${accountIDArg}`, parseMode: 'MarkdownV2',
            keyboard: [
                [
                    {
                        text: 'Account',
                        callback_data: menuBase.makeMenuButton('chooseAccount', { from: walletMenu.getShortName('debugChooseAccount'), out: 'aID', eID: accountIDArg })
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
    });
}