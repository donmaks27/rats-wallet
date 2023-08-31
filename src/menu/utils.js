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
function encodeDate(date) {
    return (date.getUTCFullYear() * 12 + date.getUTCMonth()) * 31 + (date.getUTCDate() - 1);
}
/**
 * @param {number} encodedDate 
 */
function decodeDate(encodedDate) {
    const day = encodedDate % 31;
    const monthAndYear = Math.floor((encodedDate - day) / 31);
    const month = monthAndYear % 12;
    const year = Math.floor((monthAndYear - month) / 12);
    var date = new Date(0);
    date.setUTCFullYear(year);
    date.setUTCMonth(month);
    date.setUTCDate(day + 1);
    return date;
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
        args._d = encodeDate(new Date());
    }
    switch (args._s) {
    case 'd':
    default:
        createMenuData_pickDate_day(user, userData, args, callback);
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
    const date = decodeDate(typeof args._d === 'number' ? args._d : encodeDate(new Date(0)));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth();
    //const day = date.getUTCDate();
    const firstDayOfWeek = getFirstDayOfWeek(date);
    const daysInMonth = getDaysInMonth(date);

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [
        [
            {
                text: `<`,
                callback_data: menuBase.makeDummyButton()
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
                callback_data: menuBase.makeDummyButton()
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
    for (var i = 0; i < daysInMonth; i++) {
        keyboardWeek.push({
            text: `${i + 1}`,
            callback_data: menuBase.makeDummyButton()
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

    var backButtonArgs = { ...args };
    delete backButtonArgs._s;
    delete backButtonArgs._d;
    delete backButtonArgs.from;
    keyboard.push([{
        text: `<< Back`,
        callback_data: menuBase.makeMenuButton(prevMenu, backButtonArgs)
    }]);
    callback({
        text: `*Date picker*\nPlease, choose date:`,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    })
}