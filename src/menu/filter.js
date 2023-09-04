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
        filter: { shortName: 'f', handler: createMenuData_filter }
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_filter(user, userData, args, callback) {
    const userID = user.id;
    db.filter_getTemp(userID, (filterData, error) => {
        if (error || !filterData) {
            log.error(userID, `[filter] failed to get temp filter data: ${error}`);
            onTempFilterError(user, userData, args, callback);
        } else {
            const argsKeys = Object.getOwnPropertyNames(args);
            if (argsKeys.includes('dF')) {
                const dateFrom = typeof args.dF === 'number' ? menuBase.decodeDate(args.dF) : null;
                db.filter_editTemp(userID, { date_from: dateFrom }, (filterData, error) => {
                    if (error || !filterData) {
                        log.error(userID, `[filter] failed to update field "date_from" of temp filter: ${error}`);
                        onTempFilterError(user, userData, args, callback);
                    } else {
                        delete args.dF;
                        onTempFilterUpdated(user, userData, args, filterData, callback);
                    }
                });
            } else if (argsKeys.includes('dU')) {
                const dateUntil = typeof args.dU === 'number' ? menuBase.decodeDate(args.dU) : null;
                db.filter_editTemp(userID, { date_until: dateUntil }, (filterData, error) => {
                    if (error || !filterData) {
                        log.error(userID, `[filter] failed to update field "date_until" of temp filter: ${error}`);
                        onTempFilterError(user, userData, args, callback);
                    } else {
                        delete args.dU;
                        onTempFilterUpdated(user, userData, args, filterData, callback);
                    }
                });
            } else {
                onTempFilterUpdated(user, userData, args, filterData, callback);
            }
        }
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function onTempFilterError(user, userData, args, callback) {
    const prevPage = args.pP;
    const prevFilter = args.pF;
    /** @type {walletCommon.args_data} */
    var backButtonArgs = {};
    if (prevPage) {
        backButtonArgs.page = prevPage;
    }
    if (prevFilter) {
        backButtonArgs.fID = prevFilter;
    }
    callback({
        text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
        keyboard: [[{ text: `<< Back to Records`, callback_data: menuBase.makeMenuButton('records', backButtonArgs) }]]
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {walletCommon.args_data} args 
 * @param {db.filter_data} tempFilterData 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function onTempFilterUpdated(user, userData, args, tempFilterData, callback) {
    const userID = user.id;
    
    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];

    keyboard.push([{
        text: `From: ${tempFilterData.date_from ? dateFormat.to_readable_string(tempFilterData.date_from, { date: true }) : '--'}`,
        callback_data: menuBase.makeMenuButton('pickDate', { ...args, from: walletMenu.getShortName('filter'), out: 'dF' })
    }], [{
        text: `Until: ${tempFilterData.date_until ? dateFormat.to_readable_string(tempFilterData.date_until, { date: true }) : '--'}`,
        callback_data: menuBase.makeMenuButton('pickDate', { ...args, from: walletMenu.getShortName('filter'), out: 'dU' })
    }]);

    /** @type {walletCommon.args_data} */
    var backButtonArgs = { page: (args.pP ? args.pP : 0) };
    if (args.pP) {
        backButtonArgs.page = args.pP;
    }
    if (args.pF) {
        backButtonArgs.fID = args.pF;
    }
    keyboard.push([{
        text: `<< Back to Records`,
        callback_data: menuBase.makeMenuButton('records', backButtonArgs)
    }]);
    callback({
        text: `*Records filter:*`,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}