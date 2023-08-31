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

const MIN_YEAR = 1970;
const MAX_YEAR = 2169;

/**
 * @type {menuBase.menu_get_func}
 */
module.exports.get = () => {
    return {
        pickDate: createMenuData_pickDate,
        pickTime: createMenuData_pickTime
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
    checkDate.setUTCMonth(date.getUTCMonth() + 1, 0);
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
        args._d = (typeof args.date === 'number') ? args.date : menuBase.encodeDate(new Date());
    }
    if (!args._s) {
        args._s = 'd';
    }
    switch (args._s) {
    case 'd':
        createMenuData_pickDate_day(user, userData, args, callback);
        break;
    case 'm':
        createMenuData_pickDate_month(user, userData, args, callback);
        break;
    case 'y':
        createMenuData_pickDate_year(user, userData, args, callback);
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
    var year = date.getUTCFullYear();
    if (year > MAX_YEAR) {
        date.setFullYear(MAX_YEAR);
        year = date.getUTCFullYear();
    } else if (year < MIN_YEAR) {
        date.setFullYear(MIN_YEAR);
        year = date.getUTCFullYear();
    }
    const month = date.getUTCMonth();
    const firstDayOfWeek = getFirstDayOfWeek(date);
    const daysInMonth = getDaysInMonth(date);

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    
    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardHeader = [];
    if ((year > MIN_YEAR) || (month > 0)) {
        var buttonPrevMonthDate = new Date(date.valueOf());
        buttonPrevMonthDate.setUTCMonth(month - 1);
        keyboardHeader.push({
            text: `<`,
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'd', _d: menuBase.encodeDate(buttonPrevMonthDate) })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboardHeader.push({
        text: monthToString(month),
        callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'm', _d: menuBase.encodeDate(date) })
    }, {
        text: `${year}`,
        callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'y', _d: menuBase.encodeDate(date) })
    });
    if ((year < MAX_YEAR) || (month < 11))
    {
        var buttonNextMonthDate = new Date(date.valueOf());
        buttonNextMonthDate.setUTCMonth(month + 1);
        keyboardHeader.push({
            text: `>`,
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'd', _d: menuBase.encodeDate(buttonNextMonthDate) })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboard.push(keyboardHeader);

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

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_pickDate_month(user, userData, args, callback) {
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const prevMenu = typeof args.from === 'string' ? args.from : 'main';
    var returnButtonArgs = { ...args };
    delete returnButtonArgs._s;
    delete returnButtonArgs._d;
    delete returnButtonArgs.from;

    var date = typeof args._d === 'number' ? menuBase.decodeDate(args._d) : new Date(0);
    date.setUTCMonth(0, 1);
    var year = date.getUTCFullYear();
    if (year > MAX_YEAR) {
        date.setFullYear(MAX_YEAR);
        year = date.getUTCFullYear();
    } else if (year < MIN_YEAR) {
        date.setFullYear(MIN_YEAR);
        year = date.getUTCFullYear();
    }

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];

    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardHeader = [];
    if (year > MIN_YEAR) {
        var buttonPrevYearDate = new Date(date.valueOf());
        buttonPrevYearDate.setUTCFullYear(year - 1);
        keyboardHeader.push({
            text: `<`,
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'm', _d: menuBase.encodeDate(buttonPrevYearDate) })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboardHeader.push({
        text: `${year}`,
        callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'y', _d: menuBase.encodeDate(date) })
    });
    if (year < MAX_YEAR)
    {
        var buttonNextYearDate = new Date(date.valueOf());
        buttonNextYearDate.setUTCFullYear(year + 1);
        keyboardHeader.push({
            text: `>`,
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'm', _d: menuBase.encodeDate(buttonNextYearDate) })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboard.push(keyboardHeader);

    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardMonthes = [];
    var buttonDate = new Date(date.valueOf());
    for (var i = 0; i < 12; i++) {
        buttonDate.setUTCMonth(i, 1);
        keyboardMonthes.push({
            text: monthToString(i),
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'd', _d: menuBase.encodeDate(buttonDate) })
        });
        if (keyboardMonthes.length == 6) {
            keyboard.push(keyboardMonthes);
            keyboardMonthes = [];
        }
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
        text: `*Date picker*\nPlease, choose month:`,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    })
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_pickDate_year(user, userData, args, callback) {
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const prevMenu = typeof args.from === 'string' ? args.from : 'main';
    var returnButtonArgs = { ...args };
    delete returnButtonArgs._s;
    delete returnButtonArgs._d;
    delete returnButtonArgs.from;

    var date = typeof args._d === 'number' ? menuBase.decodeDate(args._d) : new Date(0);
    date.setUTCMonth(0, 1);
    var year = date.getUTCFullYear();
    if (year > MAX_YEAR) {
        date.setFullYear(MAX_YEAR);
        year = date.getUTCFullYear();
    } else if (year < MIN_YEAR) {
        date.setFullYear(MIN_YEAR);
        year = date.getUTCFullYear();
    }
    const minYear = year - 12;
    const maxYear = year + 12;

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];

    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardHeader = [];
    if (minYear > MIN_YEAR) {
        var nextPageDate = new Date(date.valueOf());
        nextPageDate.setUTCFullYear(Math.max(MIN_YEAR, year - 25));
        keyboardHeader.push({
            text: `<`,
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'y', _d: menuBase.encodeDate(nextPageDate) })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    if (maxYear < MAX_YEAR) {
        var nextPageDate = new Date(date.valueOf());
        nextPageDate.setUTCFullYear(Math.min(MAX_YEAR, year + 25));
        keyboardHeader.push({
            text: `>`,
            callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'y', _d: menuBase.encodeDate(nextPageDate) })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboard.push(keyboardHeader);

    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardYears = [];
    var buttonDate = new Date(date.valueOf());
    for (var i = minYear; i <= maxYear; i++) {
        if ((i < MIN_YEAR) || (i > MAX_YEAR)) {
            keyboardYears.push({
                text: ` `,
                callback_data: menuBase.makeDummyButton()
            });
        } else {
            buttonDate.setUTCFullYear(i);
            keyboardYears.push({
                text: `${i}`,
                callback_data: menuBase.makeMenuButton('pickDate', { ...args, _s: 'm', _d: menuBase.encodeDate(buttonDate) })
            });
        }
        if (keyboardYears.length == 5) {
            keyboard.push(keyboardYears);
            keyboardYears = [];
        }
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
        text: `*Date picker*\nPlease, choose month:`,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    })
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_pickTime(user, userData, args, callback) {
    /** @type {walletCommon.menu_type} */
    // @ts-ignore
    const prevMenu = typeof args.from === 'string' ? args.from : 'main';
    var returnButtonArgs = { ...args };
    delete returnButtonArgs._c;
    delete returnButtonArgs._t;
    delete returnButtonArgs.from;

    const cursor = typeof args._c === 'number' ? Math.max(0, Math.min(3, args._c)) : 0;
    const currentEncodedTime = typeof args._t === 'number' ? args._t : (typeof args.time === 'number' ? args.time : menuBase.encodeTime(new Date()));
    const currentTime = menuBase.decodeTime(currentEncodedTime);
    const hours = currentTime.getUTCHours();
    const hours0 = Math.floor(hours / 10);
    const hours1 = hours % 10;
    const minutes = currentTime.getUTCMinutes();
    const minutes0 = Math.floor(minutes / 10);
    const minutes1 = minutes % 10;

    var timeText = '';
    switch (cursor) {
    case 0:
        timeText = `__* ${hours0} *__${hours1} : ${minutes0} ${minutes1} `;
        break;
    case 1:
        timeText = ` ${hours0}__* ${hours1} *__: ${minutes0} ${minutes1} `;
        break;
    case 2:
        timeText = ` ${hours0} ${hours1} :__* ${minutes0} *__${minutes1} `;
        break;
    default:
        timeText = ` ${hours0} ${hours1} : ${minutes0}__* ${minutes1} *__`;
        break;
    }

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];

    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardHeader = [];
    if (cursor > 0) {
        keyboardHeader.push({
            text: `<`,
            callback_data: menuBase.makeMenuButton('pickTime', { ...args, _c: cursor - 1 })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    if (cursor < 3) {
        keyboardHeader.push({
            text: `<`,
            callback_data: menuBase.makeMenuButton('pickTime', { ...args, _c: cursor + 1 })
        });
    } else {
        keyboardHeader.push({
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        });
    }
    keyboard.push(keyboardHeader);

    var maxNumber = 9;
    switch (cursor) {
    case 0:
        maxNumber = 2;
        break;
    case 1:
        if (hours0 == 2) {
            maxNumber = 3;
        }
        break;
    case 2:
        maxNumber = 6;
        break;
    default: 
        break;
    }
    /** @type {bot.keyboard_button_inline_data[]} */
    var keyboardNumbers = [];
    var buttonTime = new Date(currentTime.valueOf());
    for (var i = 0; i <= 9; i++) {
        if (i <= maxNumber) {
            switch (cursor) {
            case 0:
                buttonTime.setUTCHours(Math.min(i*10 + hours1, 23), minutes);
                break;
            case 1:
                buttonTime.setUTCHours(Math.min(hours0*10 + i, 23), minutes);
                break;
            case 2:
                buttonTime.setUTCHours(hours, Math.min(i*10 + minutes1, 59));
                break;
            default:
                buttonTime.setUTCHours(hours, Math.min(minutes0*10 + i, 59));
                break;
            }
            if (cursor < 3) {
                keyboardNumbers.push({
                    text: `${i}`,
                    callback_data: menuBase.makeMenuButton('pickTime', { ...args, _c: cursor + 1, _t: menuBase.encodeTime(buttonTime) })
                });
            } else {
                keyboardNumbers.push({
                    text: `${i}`,
                    callback_data: menuBase.makeMenuButton(prevMenu, { ...returnButtonArgs, time: menuBase.encodeTime(buttonTime) })
                });
            }
        } else {
            keyboardNumbers.push({
                text: ` `,
                callback_data: menuBase.makeDummyButton()
            });
        }
    }
    keyboard.push(keyboardNumbers);

    keyboard.push([
        {
            text: `NONE`,
            callback_data: menuBase.makeMenuButton(prevMenu, { ...returnButtonArgs, time: null })
        },
        {
            text: `Done`,
            callback_data: menuBase.makeMenuButton(prevMenu, { ...returnButtonArgs, time: menuBase.encodeTime(currentTime) })
        }
    ], [
        {
            text: `<< Back`,
            callback_data: menuBase.makeMenuButton(prevMenu, returnButtonArgs)
        }
    ]);
    callback({
        text: `*Time picker*\n${timeText}\nPlease, choose month:`,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    })
}