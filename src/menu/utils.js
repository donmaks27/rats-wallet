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
        pickDate: createMenuData_pickDate
    };
}

/**
 * @param {Date} date 
 */
function getFirstDayOfWeek(date) {
    var checkDate = new Date(date.valueOf());
    checkDate.setUTCDate(1);
    const dayOfWeek = checkDate.getUTCDay();
    return dayOfWeek != 0 ? dayOfWeek - 1 : 6;
}
/**
 * @param {Date} date 
 */
function getDaysInMonth(date) {
    var checkDate = new Date(date.valueOf());
    checkDate.setUTCDate(1);
    checkDate.setUTCMonth(date.getUTCMonth() + 1);
    checkDate.setUTCDate(0);
    return checkDate.getUTCDate();
}
/**
 * @param {number} month 
 */
function monthToString(month) {
    switch (month) {
    case 0: return 'Jan';
    case 1: return 'Feb';
    case 2: return 'Mar';
    case 3: return 'Apr';
    case 4: return 'May';
    case 5: return 'Jun';
    case 6: return 'Jul';
    case 7: return 'Aug';
    case 8: return 'Sep';
    case 9: return 'Oct';
    case 10: return 'Nov';
    case 11:
    default: return 'Dec';
    }
}
/**
 * @param {number} month 
 */
function dayOfWeekToString(month) {
    switch (month) {
    case 0: return 'Mo';
    case 1: return 'Tu';
    case 2: return 'We';
    case 3: return 'Th';
    case 4: return 'Fr';
    case 5: return 'Sa';
    case 6:
    default: return 'Su';
    }
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_pickDate(user, userData, args, callback) {
    if (!args._d) {
        args._d = menuBase.encodeDate(new Date());
    }
    if (!args._s) {
        args._s = 'd';
    }
    switch (args._s) {
    case 'd':
        createMenuData_pickDate_day(user, userData, args, callback);
        break;
        
    default: 
        break;
    }
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_pickDate_day(user, userData, args, callback) {
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const prevMenu = typeof args.from === 'string' ? args.from : 'main';
    var returnButtonArgs = { ...args };
    delete returnButtonArgs._s;
    delete returnButtonArgs._d;
    delete returnButtonArgs.from;

    var date = typeof args._d === 'number' ? menuBase.decodeDate(args._d) : new Date(0);
    date.setUTCDate(1);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    //const day = date.getUTCDate();
    const firstDayOfWeek = getFirstDayOfWeek(date);
    const daysInMonth = getDaysInMonth(date);

    var buttonPrevMonthDate = new Date(date.valueOf());
    buttonPrevMonthDate.setUTCMonth(buttonPrevMonthDate.getUTCMonth() - 1);
    var buttonNextMonthDate = new Date(date.valueOf());
    buttonNextMonthDate.setUTCMonth(buttonNextMonthDate.getUTCMonth() + 1);
    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [
        [
            {
                text: `<`,
                callback_data: menuBase.makeMenuButton('pickDate', { ...args, _d: menuBase.encodeDate(buttonPrevMonthDate) })
            },
            {
                text: monthToString(month),
                callback_data: menuBase.makeDummyButton()
            },
            {
                text: `${year}`,
                callback_data: menuBase.makeDummyButton()
            },
            {
                text: `>`,
                callback_data: menuBase.makeMenuButton('pickDate', { ...args, _d: menuBase.encodeDate(buttonNextMonthDate) })
            }
        ]
    ];

    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardWeek = [];
    for (var i = 0; i < 7; i++) {
        keyboardWeek.push({
            text: dayOfWeekToString(i),
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboard.push(keyboardWeek);

    keyboardWeek = [];
    for (var i = 0; i < firstDayOfWeek; i++) {
        keyboardWeek.push({
            text: ' ',
            callback_data: menuBase.makeDummyButton()
        });
    }
    var buttonDate = new Date(date.valueOf());
    for (var i = 0; i < daysInMonth; i++) {
        buttonDate.setUTCDate(i + 1);
        keyboardWeek.push({
            text: `${i + 1}`,
            callback_data: menuBase.makeMenuButton(prevMenu, { ...returnButtonArgs, date: menuBase.encodeDate(buttonDate) })
        });
        if (keyboardWeek.length == 7) {
            keyboard.push(keyboardWeek);
            keyboardWeek = [];
        }
    }
    if (keyboardWeek.length > 0) {
        while (keyboardWeek.length < 7) {
            keyboardWeek.push({
                text: ' ',
                callback_data: menuBase.makeDummyButton()
            });
        }
        keyboard.push(keyboardWeek);
    }

    keyboard.push([
        {
            text: `NONE`,
            callback_data: menuBase.makeMenuButton(prevMenu, { ...returnButtonArgs, date: null })
        }
    ], [
        {
            text: `<< Back`,
            callback_data: menuBase.makeMenuButton(prevMenu, returnButtonArgs)
        }
    ]);
    callback({
        text: `*Date picker*\nPlease, choose date:`,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    })
}