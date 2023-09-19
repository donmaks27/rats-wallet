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
        records: createMenuData_records,
        record: { shortName: 'r', handler: createMenuData_record },
        createRecord: { shortName: 'crR', handler: createMenuData_createRecord }
    };
}

const ARG_RECORDS_PAGE = 'page';
const ARG_RECORDS_FILTER_ID = 'fID';
const RECORDS_PAGE_SIZE = 10;
const RECORDS_RECORD_BUTTONS_ROW_SIZE = 6;
const RECORD_LABELS_MAX = 5;

const ARG_PREV_PAGE = 'pP';
const ARG_PREV_FILTER_ID = 'pF';

const ARG_TEMP_RESET = 'r';
const ARG_TEMP_RECORD_TYPE = 't';
const ARG_TEMP_SRC_ACCOUNT_ID = 'sID';
const ARG_TEMP_SRC_AMOUNT = 'sA';
const ARG_TEMP_DST_ACCOUNT_ID = 'dID';
const ARG_TEMP_DST_AMOUNT = 'dA';
const ARG_TEMP_CATEGORY_ID = 'cID';
const ARG_TEMP_DATE = 'rD';
const ARG_TEMP_TIME = 'rT';
const ARG_TEMP_ADD_LABEL = 'la';
const ARG_TEMP_REMOVE_LABEL = 'lr';

const ARG_RECORD_ID = 'id';
const ARG_RECORD_SRC_ACCOUNT_ID = 'sID';
const ARG_RECORD_SRC_AMOUNT = 'sA';
const ARG_RECORD_DST_ACCOUNT_ID = 'dID';
const ARG_RECORD_DST_AMOUNT = 'dA';
const ARG_RECORD_CATEGORY_ID = 'cID';
const ARG_RECORD_DATE = 'rD';
const ARG_RECORD_TIME = 'rT';
const ARG_RECORD_ADD_LABEL = 'la';
const ARG_RECORD_REMOVE_LABEL = 'lr';

const RECORD_TYPE_EXPENSE = 'e';
const RECORD_TYPE_INCOME = 'i';
const RECORD_TYPE_TRANSFER = 't';


/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_records(user, userData, args, callback) {
    const userID = user.id;
    const pageSize = RECORDS_PAGE_SIZE;
    const currentPage = typeof args[ARG_RECORDS_PAGE] === 'number' ? args[ARG_RECORDS_PAGE] : 0;
    const currentFilterID = typeof args[ARG_RECORDS_FILTER_ID] === 'number' ? args[ARG_RECORDS_FILTER_ID] : db.invalid_id;
    db.record_getAmount(userID, currentFilterID, (recordsAmount, error) => {
        if (error) {
            log.error(userID, `[records] failed to get amount of records (${error})`);
        }
        if (recordsAmount <= 0) {
            callback({
                text: `*Records*\nFound 0 records`, parseMode: 'MarkdownV2',
                keyboard: [[{
                    text: '<< Back to Wallet',
                    callback_data: menuBase.makeMenuButton('wallet')
                }]]
            });
            return;
        }

        const pagesCount = Math.floor(recordsAmount / pageSize) + ( (recordsAmount % pageSize) != 0 ? 1 : 0 );
        var recordParams = { recordsPerPage: pageSize, pageIndex: currentPage };
        if (currentFilterID != db.invalid_id) {
            recordParams.filterID = currentFilterID;
        }
        db.record_getList(userID, recordParams, (records, error) => {
            if (error) {
                log.error(userID, `[records] failed to get records list (${error})`);
            }
            /** @type {number[]} */
            var accountIDs = [];
            var lastDate = new Date(0);
            for (var i = 0; i < records.length; i++) {
                const record = records[i];
                if ((record.src_account_id != db.invalid_id) && !accountIDs.includes(record.src_account_id)) {
                    accountIDs.push(record.src_account_id);
                }
                if ((record.dst_account_id != db.invalid_id) && !accountIDs.includes(record.dst_account_id)) {
                    accountIDs.push(record.dst_account_id);
                }
                if (record.date > lastDate) {
                    lastDate = record.date;
                }
            }
            db.account_getBallance(accountIDs, { untilDate: lastDate }, (ballances, error) => {
                if (error) {
                    log.error(userID, `[records] failed to get ballances for accounts (${error})`);
                }
                /** @type {{ [accountID: number]: number }} */
                var accountBallances = {};
                for (var i = 0; i < accountIDs.length; i++) {
                    const ballance = ballances[accountIDs[i]];
                    accountBallances[accountIDs[i]] = ballance ? ballance : 0;
                }

                /** @type {bot.keyboard_button_inline_data[][]} */
                var keyboard = [];
                /** @type {bot.keyboard_button_inline_data[]} */
                var keyboardRow = [];

                var messageText = '*Records*\n\n';
                for (var i = 0; i < records.length; i++) {
                    const record = records[i];

                    if (i < 9) {
                        messageText += `${bot.escapeMarkdown(`${i+1}.`)}   `;
                    } else {
                        messageText += `${bot.escapeMarkdown(`${i+1}.`)} `;
                    }

                    if (record.src_account && record.dst_account) {
                        messageText += `${walletCommon.getColorMarker(record.src_account.color, ' ')}${bot.escapeMarkdown(record.src_account.name)} ➤ `;
                        messageText += `${walletCommon.getColorMarker(record.dst_account.color, ' ')}${bot.escapeMarkdown(record.dst_account.name)}\n`;
                        
                        const src_symbol = record.src_currency?.symbol ? record.src_currency.symbol : record.src_account.currency_code;
                        const dst_symbol = record.dst_currency?.symbol ? record.dst_currency.symbol : record.dst_account.currency_code;
                        messageText += `      *${bot.escapeMarkdown(`${record.src_amount / 100} ${src_symbol}`)}* ${bot.escapeMarkdown(`(${accountBallances[record.src_account_id] / 100} ${src_symbol})`)} ➤ ` +
                                             `*${bot.escapeMarkdown(`${record.dst_amount / 100} ${dst_symbol}`)}* ${bot.escapeMarkdown(`(${accountBallances[record.dst_account_id] / 100} ${dst_symbol})`)}\n`;
                    } else if (record.src_account) {
                        messageText += `${walletCommon.getColorMarker(record.src_account.color, ' ')}${bot.escapeMarkdown(record.src_account.name)}\n`;
                        const symbol = record.src_currency?.symbol ? record.src_currency.symbol : record.src_account.currency_code;
                        messageText += `      *${bot.escapeMarkdown(`-${record.src_amount / 100} ${symbol}`)}* ${bot.escapeMarkdown(`(${accountBallances[record.src_account_id] / 100} ${symbol})`)}\n`;
                    } else if (record.dst_account) {
                        messageText += `${walletCommon.getColorMarker(record.dst_account.color, ' ')}${bot.escapeMarkdown(record.dst_account.name)}\n`;
                        const symbol = record.dst_currency?.symbol ? record.dst_currency.symbol : record.dst_account.currency_code;
                        messageText += `      *${bot.escapeMarkdown(`+${record.dst_amount / 100} ${symbol}`)}* ${bot.escapeMarkdown(`(${accountBallances[record.dst_account_id] / 100} ${symbol})`)}\n`;
                    }

                    if (record.note.length > 0) {
                        messageText += `      _Note_: "${bot.escapeMarkdown(record.note)}"\n`;
                    }
                    if (record.category) {
                        messageText += `      _Category_: ${walletCommon.getColorMarkerCircle(record.category.color, ' ')}${bot.escapeMarkdown(record.category.name)}\n`;
                    }

                    if (record.labels.length > 0) {
                        var labelsNames = [];
                        for (var j = 0; j < record.labels.length; j++) {
                            labelsNames.push(`${walletCommon.getColorMarkerCircle(record.labels[j].color, ' ')}${bot.escapeMarkdown(record.labels[j].name)}`);
                        }
                        messageText += `      _Labels: ${labelsNames.join(', ')}_\n`;
                    }

                    messageText += `      _Date_: __${bot.escapeMarkdown(dateFormat.to_readable_string(record.date, { date: true, time: true, timezone: userData.timezone }))}__\n`;

                    if (record.src_account) {
                        accountBallances[record.src_account_id] += record.src_amount;
                    }
                    if (record.dst_account) {
                        accountBallances[record.dst_account_id] -= record.dst_amount;
                    }

                    keyboardRow.push({
                        text: `${i + 1}`, 
                        callback_data: menuBase.makeMenuButton('record', { [ARG_PREV_PAGE]: currentPage, [ARG_PREV_FILTER_ID]: currentFilterID, [ARG_RECORD_ID]: record.id })
                    });
                    if (keyboardRow.length >= RECORDS_RECORD_BUTTONS_ROW_SIZE) {
                        keyboard.push(keyboardRow);
                        keyboardRow = [];
                    }
                }
                if (keyboardRow.length > 0) {
                    while (keyboardRow.length < RECORDS_RECORD_BUTTONS_ROW_SIZE) {
                        keyboardRow.push({
                            text: ` `, callback_data: menuBase.makeDummyButton()
                        });
                    }
                    keyboard.push(keyboardRow);
                    keyboardRow = [];
                }
                messageText += `\nChoose what you want to do:`

                if (pagesCount > 1) {
                    const dummyButton = { text: ` `, callback_data: menuBase.makeDummyButton() };
                    keyboard.push([
                        currentPage > 1 ? { 
                            text: `<< 1`, 
                            callback_data: menuBase.makeMenuButton('records', { page: 0, fID: currentFilterID }) 
                        } : dummyButton,
                        currentPage > 0 ? { 
                            text: `< ${currentPage}`, 
                            callback_data: menuBase.makeMenuButton('records', { page: currentPage - 1, fID: currentFilterID }) 
                        } : dummyButton,
                        { 
                            text: `${currentPage + 1}`, 
                            callback_data: menuBase.makeActionButton('changeRecordsPage', { page: currentPage, maxPage: pagesCount, fID: currentFilterID })
                        },
                        currentPage < pagesCount - 1 ? { 
                            text: `${currentPage + 2} >`, 
                            callback_data: menuBase.makeMenuButton('records', { page: currentPage + 1, fID: currentFilterID }) 
                        } : dummyButton,
                        currentPage < pagesCount - 2 ? { 
                            text: `${pagesCount} >>`, 
                            callback_data: menuBase.makeMenuButton('records', { page: pagesCount - 1, fID: currentFilterID }) 
                        } : dummyButton
                    ]);
                }

                keyboard.push([{
                    text: `Filter`,
                    callback_data: menuBase.makeMenuButton('filter', { [ARG_PREV_PAGE]: currentPage, [ARG_PREV_FILTER_ID]: currentFilterID, reset: true })
                }], [{
                    text: 'Create new record',
                    callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: currentPage, [ARG_PREV_FILTER_ID]: currentFilterID, [ARG_TEMP_RESET]: true, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_EXPENSE })
                }], [{
                    text: '<< Back to Wallet',
                    callback_data: menuBase.makeMenuButton('wallet')
                }]);
                // TODO: Add buttons for every record
                callback({
                    text: messageText, 
                    parseMode: 'MarkdownV2',
                    keyboard: keyboard
                });
            });
        });
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_createRecord(user, userData, args, callback) {
    const userID = user.id;
    const argRecordType = typeof args[ARG_TEMP_RECORD_TYPE] === 'string' ? args[ARG_TEMP_RECORD_TYPE] : '';
    const argReset = typeof args[ARG_TEMP_RESET] === 'boolean' ? args[ARG_TEMP_RESET] : false;
    switch (argRecordType) {
    case RECORD_TYPE_EXPENSE:
    case RECORD_TYPE_INCOME:
    case RECORD_TYPE_TRANSFER:
        break;
    default: 
        log.error(userID, `[createRecord] invalid record type "${argRecordType}"`);
        onTempRecordError(user, userData, args, callback);
        return;
    }

    if (argReset) {
        db.record_clearTempLabels(userID, (error) => {
            if (error) {
                log.error(userID, `[createRecord] failed to clear temp labels (${error})`);
                onTempRecordError(user, userData, args, callback);
            } else {
                createMenuData_createRecord_onLabelsCleared(user, userData, args, callback);
            }
        });
    } else {
        createMenuData_createRecord_onLabelsCleared(user, userData, args, callback);
    }
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_createRecord_onLabelsCleared(user, userData, args, callback) {
    const userID = user.id;
    const argLebelID_add    = typeof args[ARG_TEMP_ADD_LABEL] === 'number' ? args[ARG_TEMP_ADD_LABEL] : db.invalid_id;
    const argLebelID_remove = typeof args[ARG_TEMP_REMOVE_LABEL] === 'number' ? args[ARG_TEMP_REMOVE_LABEL] : db.invalid_id;
    delete args[ARG_TEMP_ADD_LABEL];
    delete args[ARG_TEMP_REMOVE_LABEL];

    if (argLebelID_add != db.invalid_id) {
        db.record_addTempLabel(userID, argLebelID_add, (error) => {
            if (error) {
                log.error(userID, `[createRecord] failed to add label to temp record (${error})`);
                onTempRecordError(user, userData, args, callback);
            } else {
                createMenuData_createRecord_onLabelsUpdated(user, userData, args, callback);
            }
        });
    } else if (argLebelID_remove != db.invalid_id) {
        db.record_removeTempLabel(userID, argLebelID_remove, (error) => {
            if (error) {
                log.error(userID, `[createRecord] failed to remove label from temp record (${error})`);
                onTempRecordError(user, userData, args, callback);
            } else {
                createMenuData_createRecord_onLabelsUpdated(user, userData, args, callback);
            }
        });
    } else {
        createMenuData_createRecord_onLabelsUpdated(user, userData, args, callback);
    }
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_createRecord_onLabelsUpdated(user, userData, args, callback) {
    const userID = user.id;
    const argReset        = typeof args[ARG_TEMP_RESET] === 'boolean' ? args[ARG_TEMP_RESET] : false;
    const argSrcAccountID = args[ARG_TEMP_SRC_ACCOUNT_ID];
    const argSrcAmount    = args[ARG_TEMP_SRC_AMOUNT];
    const argDstAccountID = args[ARG_TEMP_DST_ACCOUNT_ID];
    const argDstAmount    = args[ARG_TEMP_DST_AMOUNT];
    const argCategoryID   = args[ARG_TEMP_CATEGORY_ID];
    const argDate         = args[ARG_TEMP_DATE];
    const argTime         = args[ARG_TEMP_TIME];
    delete args[ARG_TEMP_RESET];
    delete args[ARG_TEMP_SRC_ACCOUNT_ID];
    delete args[ARG_TEMP_SRC_AMOUNT];
    delete args[ARG_TEMP_DST_ACCOUNT_ID];
    delete args[ARG_TEMP_DST_AMOUNT];
    delete args[ARG_TEMP_CATEGORY_ID];
    delete args[ARG_TEMP_DATE];
    delete args[ARG_TEMP_TIME];

    /** @type {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, note?: string, category_id?: number, date?: Date }} */
    var newTempRecordData = {};
    var shouldUpdateTempRecord = false;
    if (argReset) {
        newTempRecordData = { src_account_id: db.invalid_id, src_amount: 0, dst_account_id: db.invalid_id, dst_amount: 0, note: '', category_id: db.invalid_id, date: new Date() };
        shouldUpdateTempRecord = true;
    }
    if (typeof argSrcAccountID === 'number') {
        newTempRecordData.src_account_id = argSrcAccountID; shouldUpdateTempRecord = true;
    }
    if (typeof argSrcAmount === 'number') {
        newTempRecordData.src_amount = argSrcAmount; shouldUpdateTempRecord = true;
    }
    if (typeof argDstAccountID === 'number') {
        newTempRecordData.dst_account_id = argDstAccountID; shouldUpdateTempRecord = true;
    }
    if (typeof argDstAmount === 'number') {
        newTempRecordData.dst_amount = argDstAmount; shouldUpdateTempRecord = true;
    }
    if (typeof argCategoryID === 'number') {
        newTempRecordData.category_id = argCategoryID; shouldUpdateTempRecord = true;
    }
    if ((typeof argDate === 'number') || (typeof argTime === 'number')) {
        db.record_getTemp(userID, (tempRecordData, error) => {
            if (error || !tempRecordData) {
                log.error(userID, `[createRecord] failed to get temp record for updating date (${error})`);
                onTempRecordError(user, userData, args, callback);
            } else {
                var newRecordDateTime = dateFormat.timezone_date(tempRecordData.date, userData.timezone);
                if (typeof argDate === 'number') {
                    const newRecordDate = menuBase.decodeDate(argDate);
                    newRecordDateTime.setUTCFullYear(newRecordDate.getUTCFullYear(), newRecordDate.getUTCMonth(), newRecordDate.getUTCDate());
                }
                if (typeof argTime === 'number') {
                    const newRecordTime = menuBase.decodeTime(argTime);
                    newRecordDateTime.setUTCHours(newRecordTime.getUTCHours(), newRecordTime.getUTCMinutes(), 0, 0);
                }
                newTempRecordData.date = dateFormat.utc_date(newRecordDateTime, userData.timezone);
                db.record_editTemp(userID, newTempRecordData, (error) => {
                    if (error) {
                        log.error(userID, `[createRecord] failed to edit temp record (${error})`);
                        onTempRecordError(user, userData, args, callback);
                    } else {
                        createMenuData_createRecord_onTempRecordUpdated(user, userData, args, callback);
                    }
                });
            }
        });
    } else if (shouldUpdateTempRecord) {
        db.record_editTemp(userID, newTempRecordData, (error) => {
            if (error) {
                log.error(userID, `[createRecord] failed to edit temp record (${error})`);
                onTempRecordError(user, userData, args, callback);
            } else {
                createMenuData_createRecord_onTempRecordUpdated(user, userData, args, callback);
            }
        });
    } else {
        createMenuData_createRecord_onTempRecordUpdated(user, userData, args, callback);
    }
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_createRecord_onTempRecordUpdated(user, userData, args, callback) {
    const userID = user.id;
    const argRecordType = typeof args[ARG_TEMP_RECORD_TYPE] === 'string' ? args[ARG_TEMP_RECORD_TYPE] : RECORD_TYPE_EXPENSE;
    db.record_getTemp(userID, (tempRecordData, error) => {
        if (error || !tempRecordData) {
            log.error(userID, `[createRecord] failed to get temp record data (${error})`);
            onTempRecordError(user, userData, args, callback);
        } else {
            db.record_getTempLabels(userID, (labels, error) => {
                if (error) {
                    log.error(userID, `[createRecord] failed to get temp labels list (${error})`);
                    onTempRecordError(user, userData, args, callback);
                } else {
                    switch (argRecordType) {
                    case RECORD_TYPE_EXPENSE:
                        createMenuData_createRecord_expense(user, userData, tempRecordData, labels, args, callback);
                        break;
                    case RECORD_TYPE_INCOME:
                        createMenuData_createRecord_income(user, userData, tempRecordData, labels, args, callback);
                        break;
                    case RECORD_TYPE_TRANSFER:
                        createMenuData_createRecord_transfer(user, userData, tempRecordData, labels, args, callback);
                        break;
                    }
                }
            });
        }
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function onTempRecordError(user, userData, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;
    callback({
        text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
        keyboard: [
            [
                { 
                    text: `<< Back to Records`, 
                    callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID }) 
                }
            ]
        ]
    });
}

/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(db.temp_record_data & { src_account?: db.account_data, dst_account?: db.account_data, src_currency?: db.currency_data, dst_currency?: db.currency_data, category?: db.category_data })} tempRecordData 
 * @param {db.label_data[]} tempRecordLabels 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function createMenuData_createRecord_expense(user, userData, tempRecordData, tempRecordLabels, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;

    const currentMenu = walletMenu.getShortName('createRecord');
    const currencySymbol = tempRecordData.src_currency && tempRecordData.src_currency.symbol ? tempRecordData.src_currency.symbol : (tempRecordData.src_account ? tempRecordData.src_account.currency_code : '');
    const labelsAmount = Math.min(RECORD_LABELS_MAX, tempRecordLabels.length);
    const tempRecordValid = tempRecordData.src_account && (tempRecordData.src_amount != 0);

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    keyboard.push([
        {
            text: `☑️ Expense`,
            callback_data: menuBase.makeDummyButton()
        },
        {
            text: `Income`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_INCOME })
        },
        {
            text: `Transfer`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_TRANSFER })
        }
    ]);
    keyboard.push([{
        text: `Account*: ` + (tempRecordData.src_account ? (walletCommon.getColorMarker(tempRecordData.src_account.color, ' ') + tempRecordData.src_account.name) : '--'),
        callback_data: menuBase.makeMenuButton('chooseAccount', { 
            ...args, 
            from: currentMenu, out: ARG_TEMP_SRC_ACCOUNT_ID
        })
    }], [{
        text: `Amount*: ${tempRecordData.src_amount != 0 ? tempRecordData.src_amount / 100 : '--'} ${currencySymbol}`,
        callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: walletMenu.getShortName('createRecord'), out: ARG_TEMP_SRC_AMOUNT })
    }], [
        {
            text: `Clear note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', { ...args, cl: true })
        },
        {
            text: `Edit note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', args)
        }
    ], [{
        text: `Category: ` + (tempRecordData.category ? (walletCommon.getColorMarker(tempRecordData.category.color, ' ') + tempRecordData.category.name) : '--'),
        callback_data: menuBase.makeMenuButton('chooseCategory', { 
            ...args, 
            from: currentMenu, out: ARG_TEMP_CATEGORY_ID, 
            pID: tempRecordData.category_id 
        })
    }], [
        {
            text: dateFormat.to_readable_string(tempRecordData.date, { date: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickDate', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_DATE, 
                _d: menuBase.encodeDate(dateFormat.timezone_date(tempRecordData.date, userData.timezone)) 
            })
        },
        {
            text: dateFormat.to_readable_string(tempRecordData.date, { time: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickTime', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_TIME, 
                _t: menuBase.encodeTime(dateFormat.timezone_date(tempRecordData.date, userData.timezone))
            })
        }
    ]);
    for (var i = 0; i < labelsAmount; i++) {
        const labelData = tempRecordLabels[i];
        keyboard.push([
            {
                text: walletCommon.getColorMarker(labelData.color, ' ') + labelData.name,
                callback_data: menuBase.makeDummyButton()
            },
            {
                text: `✖️ Remove label`,
                callback_data: menuBase.makeMenuButton('createRecord', { 
                    ...args, [ARG_TEMP_REMOVE_LABEL]: labelData.id 
                })
            }
        ]);
    }
    if (labelsAmount < RECORD_LABELS_MAX) {
        keyboard.push([{
            text: `➕ Add label`,
            callback_data: menuBase.makeMenuButton('chooseLabel', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_ADD_LABEL 
            })
        }]);
    }
    if (tempRecordValid) {
        keyboard.push([{
            text: `Add record`,
            callback_data: menuBase.makeActionButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_EXPENSE, [ARG_PREV_FILTER_ID]: prevFilterID })
        }]);
    } else {
        keyboard.push([{
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        }]);
    }
    keyboard.push([{
        text: `<< Back to Records`, 
        callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID })
    }]);
    var menuText = `*Creating new record*\n*Type:* Expense`;
    if (tempRecordData.note.length > 0) {
        menuText += `\n_Note:_ "${bot.escapeMarkdown(tempRecordData.note)}"`;
    }
    callback({
        text: menuText, parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(db.temp_record_data & { src_account?: db.account_data, dst_account?: db.account_data, src_currency?: db.currency_data, dst_currency?: db.currency_data, category?: db.category_data })} tempRecordData 
 * @param {db.label_data[]} tempRecordLabels 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function createMenuData_createRecord_income(user, userData, tempRecordData, tempRecordLabels, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;

    const currentMenu = walletMenu.getShortName('createRecord');
    const currencySymbol = tempRecordData.dst_currency && tempRecordData.dst_currency.symbol ? tempRecordData.dst_currency.symbol : (tempRecordData.dst_account ? tempRecordData.dst_account.currency_code : '');
    const labelsAmount = Math.min(RECORD_LABELS_MAX, tempRecordLabels.length);
    const tempRecordValid = tempRecordData.dst_account && (tempRecordData.dst_amount != 0);

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    keyboard.push([
        {
            text: `Expense`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_EXPENSE })
        },
        {
            text: `☑️ Income`,
            callback_data: menuBase.makeDummyButton()
        },
        {
            text: `Transfer`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_TRANSFER })
        }
    ]);
    keyboard.push([{
        text: `Account*: ` + (tempRecordData.dst_account ? (walletCommon.getColorMarker(tempRecordData.dst_account.color, ' ') + tempRecordData.dst_account.name) : '--'),
        callback_data: menuBase.makeMenuButton('chooseAccount', { 
            ...args, 
            from: currentMenu, out: ARG_TEMP_DST_ACCOUNT_ID
        })
    }], [{
        text: `Amount*: ${tempRecordData.dst_amount != 0 ? tempRecordData.dst_amount / 100 : '--'} ${currencySymbol}`,
        callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: walletMenu.getShortName('createRecord'), out: ARG_TEMP_DST_AMOUNT })
    }], [
        {
            text: `Clear note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', { ...args, cl: true })
        },
        {
            text: `Edit note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', args)
        }
    ], [{
        text: `Category: ` + (tempRecordData.category ? (walletCommon.getColorMarker(tempRecordData.category.color, ' ') + tempRecordData.category.name) : '--'),
        callback_data: menuBase.makeMenuButton('chooseCategory', { 
            ...args, 
            from: currentMenu, out: ARG_TEMP_CATEGORY_ID, 
            pID: tempRecordData.category_id 
        })
    }], [
        {
            text: dateFormat.to_readable_string(tempRecordData.date, { date: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickDate', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_DATE, 
                _d: menuBase.encodeDate(dateFormat.timezone_date(tempRecordData.date, userData.timezone)) 
            })
        },
        {
            text: dateFormat.to_readable_string(tempRecordData.date, { time: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickTime', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_TIME, 
                _t: menuBase.encodeTime(dateFormat.timezone_date(tempRecordData.date, userData.timezone))
            })
        }
    ]);
    for (var i = 0; i < labelsAmount; i++) {
        const labelData = tempRecordLabels[i];
        keyboard.push([
            {
                text: walletCommon.getColorMarker(labelData.color, ' ') + labelData.name,
                callback_data: menuBase.makeDummyButton()
            },
            {
                text: `✖️ Remove label`,
                callback_data: menuBase.makeMenuButton('createRecord', { 
                    ...args, [ARG_TEMP_REMOVE_LABEL]: labelData.id 
                })
            }
        ]);
    }
    if (labelsAmount < RECORD_LABELS_MAX) {
        keyboard.push([{
            text: `➕ Add label`,
            callback_data: menuBase.makeMenuButton('chooseLabel', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_ADD_LABEL 
            })
        }]);
    }
    if (tempRecordValid) {
        keyboard.push([{
            text: `Add record`,
            callback_data: menuBase.makeActionButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_INCOME, [ARG_PREV_FILTER_ID]: prevFilterID })
        }]);
    } else {
        keyboard.push([{
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        }]);
    }
    keyboard.push([{
        text: `<< Back to Records`, 
        callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID })
    }]);
    var menuText = `*Creating new record*\n*Type:* Income`;
    if (tempRecordData.note.length > 0) {
        menuText += `\n_Note:_ "${bot.escapeMarkdown(tempRecordData.note)}"`;
    }
    callback({
        text: menuText, parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(db.temp_record_data & { src_account?: db.account_data, dst_account?: db.account_data, src_currency?: db.currency_data, dst_currency?: db.currency_data, category?: db.category_data })} tempRecordData 
 * @param {db.label_data[]} tempRecordLabels 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function createMenuData_createRecord_transfer(user, userData, tempRecordData, tempRecordLabels, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;

    const currentMenu = walletMenu.getShortName('createRecord');
    const srcCurrencySymbol = tempRecordData.src_currency && tempRecordData.src_currency.symbol ? tempRecordData.src_currency.symbol : (tempRecordData.src_account ? tempRecordData.src_account.currency_code : '');
    const dstCurrencySymbol = tempRecordData.dst_currency && tempRecordData.dst_currency.symbol ? tempRecordData.dst_currency.symbol : (tempRecordData.dst_account ? tempRecordData.dst_account.currency_code : '');
    const labelsAmount = Math.min(RECORD_LABELS_MAX, tempRecordLabels.length);
    const tempRecordValid = tempRecordData.src_account && tempRecordData.dst_account && (tempRecordData.src_account.id != tempRecordData.dst_account.id) && 
        (tempRecordData.src_amount != 0) && (tempRecordData.dst_amount != 0);

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    keyboard.push([
        {
            text: `Expense`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_EXPENSE })
        },
        {
            text: `Income`,
            callback_data: menuBase.makeMenuButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_PREV_FILTER_ID]: prevFilterID, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_INCOME })
        },
        {
            text: `☑️ Transfer`,
            callback_data: menuBase.makeDummyButton()
        }
    ]);
    keyboard.push([
        {
            text: `From*: ` + (tempRecordData.src_account ? (walletCommon.getColorMarker(tempRecordData.src_account.color, ' ') + tempRecordData.src_account.name) : '--'),
            callback_data: menuBase.makeMenuButton('chooseAccount', { 
                ...args, 
                from: currentMenu, out: ARG_TEMP_SRC_ACCOUNT_ID, 
                eID: tempRecordData.dst_account_id 
            })
        },
        {
            text: `To*: ` + (tempRecordData.dst_account ? (walletCommon.getColorMarker(tempRecordData.dst_account.color, ' ') + tempRecordData.dst_account.name) : '--'),
            callback_data: menuBase.makeMenuButton('chooseAccount', { 
                ...args, 
                from: currentMenu, out: ARG_TEMP_DST_ACCOUNT_ID, 
                eID: tempRecordData.src_account_id 
            })
        }
    ], [
        {
            text: `Amount*: ${tempRecordData.src_amount != 0 ? tempRecordData.src_amount / 100 : '--'} ${srcCurrencySymbol}`,
            callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: walletMenu.getShortName('createRecord'), out: ARG_TEMP_SRC_AMOUNT })
        },
        {
            text: `Amount*: ${tempRecordData.dst_amount != 0 ? tempRecordData.dst_amount / 100 : '--'} ${dstCurrencySymbol}`,
            callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: walletMenu.getShortName('createRecord'), out: ARG_TEMP_DST_AMOUNT })
        }
    ], [
        {
            text: `Clear note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', { ...args, cl: true })
        },
        {
            text: `Edit note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', args)
        }
    ], [{
        text: `Category: ` + (tempRecordData.category ? (walletCommon.getColorMarker(tempRecordData.category.color, ' ') + tempRecordData.category.name) : '--'),
        callback_data: menuBase.makeMenuButton('chooseCategory', { 
            ...args, 
            from: currentMenu, out: ARG_TEMP_CATEGORY_ID, 
            pID: tempRecordData.category_id 
        })
    }], [
        {
            text: dateFormat.to_readable_string(tempRecordData.date, { date: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickDate', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_DATE, 
                _d: menuBase.encodeDate(dateFormat.timezone_date(tempRecordData.date, userData.timezone)) 
            })
        },
        {
            text: dateFormat.to_readable_string(tempRecordData.date, { time: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickTime', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_TIME, 
                _t: menuBase.encodeTime(dateFormat.timezone_date(tempRecordData.date, userData.timezone))
            })
        }
    ]);
    for (var i = 0; i < labelsAmount; i++) {
        const labelData = tempRecordLabels[i];
        keyboard.push([
            {
                text: walletCommon.getColorMarker(labelData.color, ' ') + labelData.name,
                callback_data: menuBase.makeDummyButton()
            },
            {
                text: `✖️ Remove label`,
                callback_data: menuBase.makeMenuButton('createRecord', { 
                    ...args, [ARG_TEMP_REMOVE_LABEL]: labelData.id 
                })
            }
        ]);
    }
    if (labelsAmount < RECORD_LABELS_MAX) {
        keyboard.push([{
            text: `➕ Add label`,
            callback_data: menuBase.makeMenuButton('chooseLabel', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_TEMP_ADD_LABEL 
            })
        }]);
    }
    if (tempRecordValid) {
        keyboard.push([{
            text: `Add record`,
            callback_data: menuBase.makeActionButton('createRecord', { [ARG_PREV_PAGE]: prevPage, [ARG_TEMP_RECORD_TYPE]: RECORD_TYPE_TRANSFER, [ARG_PREV_FILTER_ID]: prevFilterID })
        }]);
    } else {
        keyboard.push([{
            text: ` `,
            callback_data: menuBase.makeDummyButton()
        }]);
    }
    keyboard.push([{
        text: `<< Back to Records`, 
        callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID })
    }]);
    var menuText = `*Creating new record*\n*Type:* Transfer`;
    if (tempRecordData.note.length > 0) {
        menuText += `\n*Note:* "${bot.escapeMarkdown(tempRecordData.note)}"`;
    }
    callback({
        text: menuText, parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_record(user, userData, args, callback) {
    const userID = user.id;
    const recordID = typeof args[ARG_RECORD_ID] === 'number' ? args[ARG_RECORD_ID] : db.invalid_id;
    db.record_get(recordID, (recordData, error) => {
        if (error || !recordData) {
            log.error(userID, `[record] failed to get data of record ${recordID} (${error})`);
            createMenuData_record_error(user, userData, args, callback);
        } else {
            createMenuData_record_recordReady(user, userData, recordData, args, callback);
        }
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_record_error(user, userData, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;
    callback({
        text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
        keyboard: [
            [
                { 
                    text: `<< Back to Records`, 
                    callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID }) 
                }
            ]
        ]
    });
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(db.record_data & { src_account?: db.account_data, dst_account?: db.account_data, src_currency?: db.currency_data, dst_currency?: db.currency_data, category?: db.category_data, labels: db.label_data[] })} recordData 
 * @param {walletCommon.args_data} args 
 * @param {(menuData: menuBase.menu_data) => any} callback 
 */
function createMenuData_record_recordReady(user, userData, recordData, args, callback) {
    const userID = user.id;
    const prevPage = typeof args[ARG_PREV_PAGE] === 'number' ? args[ARG_PREV_PAGE] : 0;
    const prevFilterID = typeof args[ARG_PREV_FILTER_ID] === 'number' ? args[ARG_PREV_FILTER_ID] : db.invalid_id;

    const currentMenu = walletMenu.getShortName('record');
    const recordType = !recordData.dst_account ? RECORD_TYPE_EXPENSE : (!recordData.src_account ? RECORD_TYPE_INCOME : RECORD_TYPE_TRANSFER);
    const srcCurrencySymbol = recordData.src_currency && recordData.src_currency.symbol ? recordData.src_currency.symbol : (recordData.src_account ? recordData.src_account.currency_code : '');
    const dstCurrencySymbol = recordData.dst_currency && recordData.dst_currency.symbol ? recordData.dst_currency.symbol : (recordData.dst_account ? recordData.dst_account.currency_code : '');
    const labelsAmount = Math.min(RECORD_LABELS_MAX, recordData.labels.length);

    var menuText = `*Record*\n*Type:* `;
    switch (recordType) {
    case RECORD_TYPE_EXPENSE:  menuText += `Expense`;  break;
    case RECORD_TYPE_INCOME:   menuText += `Income`;   break;
    case RECORD_TYPE_TRANSFER: menuText += `Transfer`; break;
    }
    if (recordData.note) {
        menuText += `\n*Note:* "${recordData.note}"`;
    }
    menuText += `\nChoose what you want to do:`;

    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    switch (recordType) {
    case RECORD_TYPE_EXPENSE:
        keyboard.push([{
            text: `Account: ` + (recordData.src_account ? (walletCommon.getColorMarker(recordData.src_account.color, ' ') + recordData.src_account.name) : '--'),
            callback_data: menuBase.makeMenuButton('chooseAccount', { ...args, from: currentMenu, out: ARG_RECORD_SRC_ACCOUNT_ID, req: true })
        }], [{
            text: `Amount: ${recordData.src_amount != 0 ? recordData.src_amount / 100 : '--'} ${srcCurrencySymbol}`,
            callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: currentMenu, out: ARG_RECORD_SRC_AMOUNT })
        }]);
        break;
    case RECORD_TYPE_INCOME:
        keyboard.push([{
            text: `Account: ` + (recordData.dst_account ? (walletCommon.getColorMarker(recordData.dst_account.color, ' ') + recordData.dst_account.name) : '--'),
            callback_data: menuBase.makeMenuButton('chooseAccount', { ...args, from: currentMenu, out: ARG_RECORD_DST_ACCOUNT_ID, req: true })
        }], [{
            text: `Amount: ${recordData.dst_amount != 0 ? recordData.dst_amount / 100 : '--'} ${dstCurrencySymbol}`,
            callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: currentMenu, out: ARG_RECORD_DST_AMOUNT })
        }]);
        break;
    case RECORD_TYPE_TRANSFER:
        keyboard.push([
            {
                text: `From: ` + (recordData.src_account ? (walletCommon.getColorMarker(recordData.src_account.color, ' ') + recordData.src_account.name) : '--'),
                callback_data: menuBase.makeMenuButton('chooseAccount', { 
                    ...args, from: currentMenu, out: ARG_RECORD_SRC_ACCOUNT_ID, req: true, eID: recordData.dst_account_id
                })
            },
            {
                text: `To: ` + (recordData.dst_account ? (walletCommon.getColorMarker(recordData.dst_account.color, ' ') + recordData.dst_account.name) : '--'),
                callback_data: menuBase.makeMenuButton('chooseAccount', { 
                    ...args, from: currentMenu, out: ARG_RECORD_DST_ACCOUNT_ID, req: true, eID: recordData.src_account_id
                })
            }
        ], [
            {
                text: `Amount: ${recordData.src_amount != 0 ? recordData.src_amount / 100 : '--'} ${srcCurrencySymbol}`,
                callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: currentMenu, out: ARG_RECORD_SRC_AMOUNT })
            },
            {
                text: `Amount: ${recordData.dst_amount != 0 ? recordData.dst_amount / 100 : '--'} ${dstCurrencySymbol}`,
                callback_data: menuBase.makeActionButton('changeRecordAmount', { ...args, from: currentMenu, out: ARG_RECORD_DST_AMOUNT })
            }
        ]);
        break;
    }
    keyboard.push([
        {
            text: `Clear note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', { ...args, cl: true })
        },
        {
            text: `Edit note`,
            callback_data: menuBase.makeActionButton('changeRecordNote', args)
        }
    ], [{
        text: `Category: ` + (recordData.category ? (walletCommon.getColorMarker(recordData.category.color, ' ') + recordData.category.name) : '--'),
        callback_data: menuBase.makeMenuButton('chooseCategory', { 
            ...args, 
            from: currentMenu, out: ARG_RECORD_CATEGORY_ID, 
            pID: recordData.category_id 
        })
    }], [
        {
            text: dateFormat.to_readable_string(recordData.date, { date: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickDate', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_RECORD_DATE, 
                _d: menuBase.encodeDate(dateFormat.timezone_date(recordData.date, userData.timezone)) 
            })
        },
        {
            text: dateFormat.to_readable_string(recordData.date, { time: true, timezone: userData.timezone }),
            callback_data: menuBase.makeMenuButton('pickTime', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_RECORD_TIME, 
                _t: menuBase.encodeTime(dateFormat.timezone_date(recordData.date, userData.timezone))
            })
        }
    ]);
    for (var i = 0; i < labelsAmount; i++) {
        const labelData = recordData.labels[i];
        keyboard.push([
            {
                text: walletCommon.getColorMarker(labelData.color, ' ') + labelData.name,
                callback_data: menuBase.makeDummyButton()
            },
            {
                text: `✖️ Remove label`,
                callback_data: menuBase.makeMenuButton('record', { 
                    ...args, [ARG_RECORD_REMOVE_LABEL]: labelData.id 
                })
            }
        ]);
    }
    if (labelsAmount < RECORD_LABELS_MAX) {
        keyboard.push([{
            text: `➕ Add label`,
            callback_data: menuBase.makeMenuButton('chooseLabel', { 
                ...args, 
                req: true, from: currentMenu, out: ARG_RECORD_ADD_LABEL 
            })
        }]);
    }
    keyboard.push([{
        text: `Delete record`,
        callback_data: menuBase.makeDummyButton()
    }], [{
        text: `<< Back to Records`, 
        callback_data: menuBase.makeMenuButton('records', { [ARG_RECORDS_PAGE]: prevPage, [ARG_RECORDS_FILTER_ID]: prevFilterID })
    }]);

    callback({
        text: menuText,
        parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}