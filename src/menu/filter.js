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

const ARG_PREV_PAGE = 'pP';
const ARG_PREV_FILTER_ID = 'pF';
const ARG_RESET_TEMP_FILTER = 'reset';
const ARG_DATE_FROM = 'dF';
const ARG_DATE_UNTIL = 'dU';
const ARG_RECORDS_PAGE = 'page';
const ARG_RECORDS_FILTER_ID = 'fID';

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_filter(user, userData, args, callback) {
    const userID = user.id;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : null;
    const shouldResetTempFilter = args[ARG_RESET_TEMP_FILTER] ? true : false;
    delete args[ARG_RESET_TEMP_FILTER];
    db.filter_getTemp(userID, (filterData, error) => {
        if (error || !filterData) {
            log.error(userID, `[filter] failed to get temp filter data: ${error}`);
            onTempFilterError(user, userData, args, callback);
        } else {
            const argsKeys = Object.getOwnPropertyNames(args);
            if (shouldResetTempFilter) {
                if (prevFilterID == null) {
                    db.filter_editTemp(userID, { date_from: null, date_until: null }, (filterData, error) => {
                        if (error || !filterData) {
                            log.error(userID, `[filter] failed to clear temp filter: ${error}`);
                            onTempFilterError(user, userData, args, callback);
                        } else {
                            onTempFilterUpdated(user, userData, args, filterData, callback);
                        }
                    });
                } else {
                    db.filter_get(prevFilterID, (filterData, error) => {
                        if (error || !filterData) {
                            log.error(userID, `[filter] failed to get previous filter: ${error}`);
                            onTempFilterError(user, userData, args, callback);
                        } else {
                            db.filter_editTemp(userID, filterData, (filterData, error) => {
                                if (error || !filterData) {
                                    log.error(userID, `[filter] failed to reset temp filter: ${error}`);
                                    onTempFilterError(user, userData, args, callback);
                                } else {
                                    onTempFilterUpdated(user, userData, args, filterData, callback);
                                }
                            });
                        }
                    });
                }
            } else if (argsKeys.includes(ARG_DATE_FROM)) {
                const dateFrom = typeof args[ARG_DATE_FROM] === 'number' ? menuBase.decodeDate(args[ARG_DATE_FROM]) : null;
                db.filter_editTemp(userID, { date_from: dateFrom ? dateFormat.utc_date(dateFrom, userData.timezone) : null }, (filterData, error) => {
                    if (error || !filterData) {
                        log.error(userID, `[filter] failed to update field "date_from" of temp filter: ${error}`);
                        onTempFilterError(user, userData, args, callback);
                    } else {
                        delete args[ARG_DATE_FROM];
                        onTempFilterUpdated(user, userData, args, filterData, callback);
                    }
                });
            } else if (argsKeys.includes(ARG_DATE_UNTIL)) {
                var dateUntil = typeof args[ARG_DATE_UNTIL] === 'number' ? menuBase.decodeDate(args[ARG_DATE_UNTIL]) : null;
                if (dateUntil != null) {
                    dateUntil.setUTCHours(23, 59, 59, 999);
                }
                db.filter_editTemp(userID, { date_until: dateUntil ? dateFormat.utc_date(dateUntil, userData.timezone) : null }, (filterData, error) => {
                    if (error || !filterData) {
                        log.error(userID, `[filter] failed to update field "date_until" of temp filter: ${error}`);
                        onTempFilterError(user, userData, args, callback);
                    } else {
                        delete args[ARG_DATE_UNTIL];
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
    const prevPage = args[ARG_PREV_PAGE];
    const prevFilter = args[ARG_PREV_FILTER_ID];
    /** @type {walletCommon.args_data} */
    var backButtonArgs = { [ARG_RECORDS_PAGE]: (prevPage ? prevPage : 0) };
    if (prevFilter) {
        backButtonArgs[ARG_RECORDS_FILTER_ID] = prevFilter;
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
    callback({
        text: `*Records filter:*`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: `From: ${tempFilterData.date_from ? dateFormat.to_readable_string(tempFilterData.date_from, { date: true, timezone: userData.timezone }) : '--'}`,
                    callback_data: menuBase.makeMenuButton('pickDate', { 
                        ...args, 
                        fr: walletMenu.getShortName('filter'), 
                        out: ARG_DATE_FROM, 
                        max: tempFilterData.date_until ? menuBase.encodeDate(dateFormat.timezone_date(tempFilterData.date_until, userData.timezone)) : null,
                        _d: menuBase.encodeDate(dateFormat.timezone_date(tempFilterData.date_from ? tempFilterData.date_from : new Date(), userData.timezone))
                    })
                }
            ], [
                {
                    text: `Until: ${tempFilterData.date_until ? dateFormat.to_readable_string(tempFilterData.date_until, { date: true, timezone: userData.timezone }) : '--'}`,
                    callback_data: menuBase.makeMenuButton('pickDate', { 
                        ...args, 
                        fr: walletMenu.getShortName('filter'), 
                        out: ARG_DATE_UNTIL, 
                        min: tempFilterData.date_from ? menuBase.encodeDate(dateFormat.timezone_date(tempFilterData.date_from, userData.timezone)) : null,
                        _d: menuBase.encodeDate(dateFormat.timezone_date(tempFilterData.date_until ? tempFilterData.date_until : new Date(), userData.timezone))
                    })
                }
            ], [
                {
                    text: `<< Back to Records`,
                    callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: (args[ARG_PREV_PAGE] ? args[ARG_PREV_PAGE] : 0), [ARG_RECORDS_FILTER_ID]: args[ARG_PREV_FILTER_ID] })
                },
                {
                    text: `Apply filter`,
                    callback_data: menuBase.makeActionButton('applyTempFilter')
                }
            ]
        ]
    });
}