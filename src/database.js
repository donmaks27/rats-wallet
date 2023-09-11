// @ts-check

var fs = require('fs');
var sqlite = require('sqlite3');

var log = require('./log');

/**
 * @typedef {{ users: user_data[], currencies: currency_data[], labels: label_data[], categories: category_data[], accounts: account_data[], records: record_data[], record_labels: record_label_data[], user_invites: user_invite_data[], filters: filter_data[] }} full_data
 * @typedef {{ id: number, name: string, create_date: Date }} user_data
 * @typedef {{ code: string, name: string | null, symbol: string | null, is_active: boolean, create_date: Date }} currency_data
 * @typedef {'red'|'orange'|'yellow'|'green'|'blue'|'purple'|'black'|'white'|'brown'|null} color_type
 * @typedef {{ id: number, user_id: number, name: string, color: color_type, is_active: boolean, create_date: Date }} label_data
 * @typedef {{ id: number, user_id: number, parent_id: number, name: string, color: color_type, is_active: boolean, create_date: Date }} category_data
 * @typedef {{ id: number, user_id: number, currency_code: string, name: string, start_amount: number, color: color_type, is_active: boolean, create_date: Date }} account_data
 * @typedef {{ id: number, src_account_id: number, src_amount: number, dst_account_id: number, dst_amount: number, category_id: number, date: Date, create_date: Date }} record_data
 * @typedef {{ record_id: number, label_id: number, create_date: Date }} record_label_data
 * @typedef {{ id: number, inviting_user_id: number, invite_date: Date, expire_date: Date }} user_invite_data
 * @typedef {{ id: number, user_id: number, filter_type: number, date_from: Date | null, date_until: Date | null }} filter_data
 * @typedef {{ date_from?: Date | null, date_until?: Date | null }} filter_params
 * @typedef {{ user_id: number, src_account_id: number, src_amount: number, dst_account_id: number, dst_amount: number, category_id: number, date: Date }} temp_record_data
 */

const db_filepath = "data/database.db";
const invalid_id = 0;

const FILTER_TYPE_TEMP = 0;
const FILTER_TYPE_CUSTOM = 1;
const FILTER_TYPE_SAVED = 2;

module.exports.invalid_id = invalid_id;
module.exports.open = openDatabase;
module.exports.close = closeDatabase;
module.exports.getAllData = getAllData;
module.exports.parseColor = parseColor;

module.exports.user_create = user_create;
module.exports.user_get = user_get;
module.exports.user_getAll = user_getAll;
module.exports.user_edit = user_edit;

module.exports.currency_create = currency_create;
module.exports.currency_get = currency_get;
module.exports.currency_getAll = currency_getAll;
module.exports.currency_getAllForUser = currency_getAllForUser;
module.exports.currency_edit = currency_edit;
module.exports.currency_delete = currency_delete;

module.exports.label_create = label_create;
module.exports.label_get = label_get;
module.exports.label_getAll = label_getAll;
module.exports.label_getAllForUser = label_getAllForUser;
module.exports.label_edit = label_edit;
module.exports.label_delete = label_delete;

module.exports.category_create = category_create;
module.exports.category_get = category_get;
module.exports.category_getList = category_getList;
module.exports.category_getAll = category_getAll;
module.exports.category_edit = category_edit;
module.exports.category_delete = category_delete;

module.exports.account_create = account_create;
module.exports.account_get = account_get;
module.exports.account_getAll = account_getAll;
module.exports.account_edit = account_edit;
module.exports.account_delete = account_delete;
module.exports.account_getBallance = account_getBallance;

module.exports.record_create = record_create;
module.exports.record_get = record_get;
module.exports.record_getAmount = record_getAmount;
module.exports.record_getList = record_getList;
module.exports.record_edit = record_edit;
module.exports.record_delete = record_delete;
module.exports.record_addLabel = record_addLabel;
module.exports.record_removeLabel = record_removeLabel;
module.exports.record_clearLabels = record_clearLabels;

module.exports.record_getTemp = record_getOrCreateTemp;
module.exports.record_editTemp = record_editTemp;
module.exports.record_addTempLabel = record_addTempLabel;
module.exports.record_removeTempLabel = record_removeTempLabel;
module.exports.record_clearTempLabels = record_clearTempLabels;

module.exports.invite_create = invite_create;
module.exports.invite_get = invite_get;
module.exports.invite_delete = invite_delete;

module.exports.filter_getTemp = filter_getOrCreateTemp;
module.exports.filter_editTemp = filter_editTemp;
module.exports.filter_editCustom = filter_editCustom;
module.exports.filter_get = filter_get;



/** @type {sqlite.Database} */
var db;
var cached_data = makeEmptyCachedData();

function debug_log(msg) {
    log.info('[DB] ' + msg);
}

/**
 * @param {string} str 
 * @returns {color_type}
 */
function parseColor(str) {
    if (str) {
        switch (str) {
        case 'red': case 'orange': case 'yellow': case 'green': case 'blue': case 'purple': case 'black': case 'white': case 'brown':
            return str;
        default: break;
        }
    }
    return null;
}

/**
 * @returns {{ users: { [userID: number]: user_data | null }, currencies: { [code: string]: currency_data | null }, 
 *             labels: { [labelID: number]: label_data | null }, categories: { [categoryID: number]: category_data | null }, 
 *             accounts: { [accountID: number]: account_data | null }, user_invites: { [userID: string]: user_invite_data | null } }}
 */
function makeEmptyCachedData() {
    return { users: {}, currencies: {}, labels: {}, categories: {}, accounts: {}, user_invites: {} };
}

/**
 * @param {(error?: string) => any} callback 
 */
function openDatabase(callback) {
    cached_data = makeEmptyCachedData();

    var file_exists = fs.existsSync(db_filepath);
    debug_log('opening database...');
    db = new sqlite.Database(db_filepath, (error) => {
        if (error) {
            callback('failed to open database file: ' + error);
        } else {
            if (file_exists) {
                debug_log('database opened');
                callback();
            } else {
                debug_log('initializing database...');
                db.exec(query_initialize(), (error) => {
                    if (error) {
                        callback('failed to initialize database: ' + error);
                    } else {
                        debug_log('database initialized');
                        callback();
                    }
                });
            }
        }
    });
}
/**
 * @param {(error?: string) => any} [callback] 
 */
function closeDatabase(callback) {
    cached_data = makeEmptyCachedData();
    if (callback) {
        db.close((error) => {
            if (error) {
                callback(`failed to close database: ` + error);
            } else {
                callback();
            }
        });
    } else {
        db.close();
    }
}

/**
 * @param {(data: full_data | null, error?: string) => any} callback 
 */
function getAllData(callback) {
    /** @type {full_data} */
    var result = { users: [], currencies: [], labels: [], categories: [], accounts: [], records: [], record_labels: [], user_invites: [], filters: [] };
    user_getAll((data, error) => {
        if (error) {
            callback(null, error);
            return;
        }
        result.users = data;
        currency_getAll((data, error) => {
            if (error) {
                callback(null, error);
                return;
            }
            result.currencies = data;
            label_getAll((data, error) => {
                if (error) {
                    callback(null, error);
                    return;
                }
                result.labels = data;
                category_getAll(invalid_id, (data, error) => {
                    if (error) {
                        callback(null, error);
                        return;
                    }
                    result.categories = data;
                    account_getAll(invalid_id, (data, error) => {
                        if (error) {
                            callback(null, error);
                            return;
                        }
                        result.accounts = data;
                        db.all(query_getAllRecords(), (error, rows) => {
                            if (error) {
                                callback(null, `failed to get records list: ` + error);
                                return;
                            }
                            for (var i = 0; i < rows.length; i++) {
                                result.records.push(parseRecordRow(rows[i]));
                            }
                            db.all(query_getAllRecordLabels(), (error, rows) => {
                                if (error) {
                                    callback(null, `failed to get record labels list: ` + error);
                                    return;
                                }
                                for (var i = 0; i < rows.length; i++) {
                                    result.record_labels.push({
                                        record_id: rows[i].record_id,
                                        label_id: rows[i].label_id,
                                        create_date: new Date(rows[i].create_date)
                                    });
                                }
                                db.all(query_getAllInvites(), (error, rows) => {
                                    if (error) {
                                        callback(null, `failed to get invites list: ` + error);
                                        return;
                                    }
                                    for (var i = 0; i < rows.length; i++) {
                                        result.user_invites.push(parseInviteRow(rows[i]));
                                    }
                                    callback(result);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}

/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {user_data}
 */
function parseUserRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    return {
        id: row[prefix + 'id'],
        name: row[prefix + 'name'],
        create_date: new Date(row[prefix + 'create_date'])
    };
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {currency_data}
 */
function parseCurrencyRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    return {
        code: row[prefix + 'code'],
        name: row[prefix + 'name'],
        symbol: row[prefix + 'symbol'],
        is_active: row[prefix + 'is_active'] != 0,
        create_date: new Date(row[prefix + 'create_date'])
    };
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {label_data}
 */
function parseLabelRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    var data = {
        id: row[prefix + 'id'],
        user_id: row[prefix + 'user_id'],
        name: row[prefix + 'name'],
        color: parseColor(row[prefix + 'color']),
        is_active: row[prefix + 'is_active'] != 0,
        create_date: new Date(row[prefix + 'create_date'])
    };
    if (!data.user_id) {
        data.user_id = invalid_id;
    }
    return data;
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {category_data}
 */
function parseCategoryRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    var data = {
        id: row[prefix + 'id'],
        user_id: row[prefix + 'user_id'],
        parent_id: row[prefix + 'parent_id'],
        name: row[prefix + 'name'],
        color: parseColor(row[prefix + 'color']),
        is_active: row[prefix + 'is_active'] != 0,
        create_date: new Date(row[prefix + 'create_date'])
    };
    if (!data.user_id) {
        data.user_id = invalid_id;
    }
    if (!data.parent_id) {
        data.parent_id = invalid_id;
    }
    return data;
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {account_data}
 */
function parseAccountRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    var data = {
        id: row[prefix + 'id'],
        user_id: row[prefix + 'user_id'],
        currency_code: row[prefix + 'currency_code'],
        name: row[prefix + 'name'],
        start_amount: row[prefix + 'start_amount'],
        color: parseColor(row[prefix + 'color']),
        is_active: row[prefix + 'is_active'] != 0,
        create_date: new Date(row[prefix + 'create_date'])
    };
    return data;
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {record_data}
 */
function parseRecordRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    var data = {
        id: row[prefix + 'id'],
        src_account_id: row[prefix + 'src_account_id'],
        src_amount: row[prefix + 'src_amount'],
        dst_account_id: row[prefix + 'dst_account_id'],
        dst_amount: row[prefix + 'dst_amount'],
        category_id: row[prefix + 'category_id'],
        date: new Date(row[prefix + 'date']),
        create_date: new Date(row[prefix + 'create_date'])
    };
    if (!data.src_account_id) {
        data.src_account_id = invalid_id;
    }
    if (!data.dst_account_id) {
        data.dst_account_id = invalid_id;
    }
    if (!data.category_id) {
        data.category_id = invalid_id;
    }
    return data;
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {temp_record_data}
 */
function parseTempRecordRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    var data = {
        user_id: row[prefix + 'user_id'],
        src_account_id: row[prefix + 'src_account_id'],
        src_amount: row[prefix + 'src_amount'],
        dst_account_id: row[prefix + 'dst_account_id'],
        dst_amount: row[prefix + 'dst_amount'],
        category_id: row[prefix + 'category_id'],
        date: new Date(row[prefix + 'date'])
    };
    if (!data.src_account_id) {
        data.src_account_id = invalid_id;
    }
    if (!data.dst_account_id) {
        data.dst_account_id = invalid_id;
    }
    if (!data.category_id) {
        data.category_id = invalid_id;
    }
    return data;
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {user_invite_data}
 */
function parseInviteRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    var data = {
        id: row[prefix + 'id'],
        inviting_user_id: row[prefix + 'inviting_user_id'],
        invite_date: new Date(row[prefix + 'invite_date']),
        expire_date: new Date(row[prefix + 'expire_date'])
    };
    return data;
}
/**
 * @param {any} row 
 * @param {string} [prefix] 
 * @returns {filter_data}
 */
function parseFilterRow(row, prefix) {
    if (!prefix) {
        prefix = '';
    }
    const dateFrom = row[prefix + 'date_from'];
    const dateUntil = row[prefix + 'date_until'];
    var data = {
        id: row[prefix + 'id'],
        user_id: row[prefix + 'user_id'],
        filter_type: row[prefix + 'filter_type'],
        date_from: dateFrom ? new Date(row[prefix + 'date_from']) : null,
        date_until: dateUntil ? new Date(row[prefix + 'date_until']) : null,
        create_date: new Date(row[prefix + 'create_date'])
    };
    return data;
}

/**
 * @param {{ id: number, name: string }} params 
 * @param {(data: user_data | null, error?: string) => any} [callback] 
 */
function user_create(params, callback) {
    db.run(query_createUser(params), callback ? (error) => {
        if (error) {
            callback(null, `failed to create user (${JSON.stringify(params)}): ` + error);
        } else {
            debug_log('created user: ' + JSON.stringify(params));
            user_get(params.id, callback);
        }
    } : undefined);
}
/**
 * @param {number} id 
 * @param {(data: user_data | null, error?: string) => any} callback 
 */
function user_get(id, callback) {
    if (cached_data.users.hasOwnProperty(id)) {
        var userData = cached_data.users[id];
        if (!userData) {
            callback(null, `can't find data of user ${id}`);
        } else {
            callback(userData);
        }
        return;
    }
    db.get(query_getUser(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of user ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of user ${id}`);
        } else {
            var userData = parseUserRow(row);
            cached_data.users[id] = userData;
            callback(userData);
        }
    });
}
/**
 * @param {(data: user_data[], error?: string) => any} callback 
 */
function user_getAll(callback) {
    db.all(query_getAllUsers(), (error, rows) => {
        if (error) {
            callback([], `failed to get users list: ` + error);
        } else {
            /** @type {user_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var userData = parseUserRow(rows[i]);
                cached_data.users[userData.id] = userData;
                data.push(userData);
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ name: string }} params 
 * @param {(data: user_data | null, error?: string) => any} [callback] 
 */
function user_edit(id, params, callback) {
    db.run(query_updateUser(id, params), (error) => {
        if (error) {
            if (callback) {
                callback(null, `failed to update user ${id}: ` + error);
            }
        } else {
            debug_log(`updated user ${id}: ` + JSON.stringify(params));
            delete cached_data.users[id];
            if (callback) {
                user_get(id, callback);
            }
        }
    });
}

/**
 * @param {{ code: string, name?: string, symbol?: string }} params 
 * @param {(data: currency_data | null, error?: string) => any} [callback] 
 */
function currency_create(params, callback) {
    db.run(query_createCurrency(params), (error) => {
        if (error) {
            if (callback) {
                callback(null, `failed to create currency (${JSON.stringify(params)}): ` + error);
            }
        } else {
            debug_log('created currency: ' + JSON.stringify(params));
            delete cached_data.currencies[params.code];
            if (callback) {
                currency_get(params.code, callback);
            }
        }
    });
}
/**
 * @param {string} code 
 * @param {(data: currency_data | null, error?: string) => any} callback 
 */
function currency_get(code, callback) {
    if (cached_data.currencies.hasOwnProperty(code)) {
        var data = cached_data.currencies[code];
        if (!data) {
            callback(null, `can't find data of currency "${code}"`);
        } else {
            callback(data);
        }
        return;
    }
    db.get(query_getCurrency(code), (error, row) => {
        if (error) {
            callback(null, `failed to get data of currency "${code}": ` + error);
        } else if (!row) {
            callback(null, `can't find data of currency "${code}"`);
        } else {
            var data = parseCurrencyRow(row);
            cached_data.currencies[code] = data;
            callback(data);
        }
    });
}
/**
 * @param {(data: currency_data[], error?: string) => any} callback 
 */
function currency_getAll(callback) {
    db.all(query_getAllCurrencies(), (error, rows) => {
        if (error) {
            callback([], `failed to get currencies list: ` + error);
        } else {
            /** @type {currency_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseCurrencyRow(rows[i]);
                cached_data.currencies[rowData.code] = rowData;
                data.push(rowData);
            }
            callback(data);
        }
    });
}
/**
 * @param {number} userID 
 * @param {(data: (currency_data & { usesNumber: number })[], error?: string) => any} callback 
 */
function currency_getAllForUser(userID, callback) {
    db.all(query_getCurrenciesForUser(userID), (error, rows) => {
        if (error) {
            callback([], `failed to get currencies list: ` + error);
        } else {
            /** @type {(currency_data & { usesNumber: number })[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseCurrencyRow(rows[i]);
                cached_data.currencies[rowData.code] = rowData;
                data.push({
                    ...rowData,
                    usesNumber: rows[i].usesNumber
                });
            }
            callback(data);
        }
    });
}
/**
 * @param {string} code 
 * @param {{ name?: string | null, symbol?: string | null, is_active?: boolean }} params 
 * @param {(data: currency_data | null, error?: string) => any} [callback] 
 */
function currency_edit(code, params, callback) {
    db.run(query_updateCurrency(code, params), (error) => {
        if (error) {
            if (callback) {
                callback(null, `failed to update currency "${code}": ` + error);
            }
        } else {
            debug_log(`updated currency "${code}": ` + JSON.stringify(params));
            delete cached_data.currencies[code];
            if (callback) {
                currency_get(code, callback);
            }
        }
    });
}
/**
 * @param {string} code 
 * @param {(error?: string) => any} [callback] 
 */
function currency_delete(code, callback) {
    if (cached_data.currencies.hasOwnProperty(code)) {
        if (!cached_data.currencies[code]) {
            if (callback) {
                callback();
            }
            return;
        }
        cached_data.currencies[code] = null;
        const accountIDs = Object.getOwnPropertyNames(cached_data.accounts);
        for (var i = 0; i < accountIDs.length; i++) {
            const accountID = Number.parseInt(accountIDs[i]);
            if (cached_data.accounts[accountID]?.currency_code == code) {
                delete cached_data.accounts[accountID];
            }
        }
    }
    db.run(query_deleteCurrency(code), callback ? (error) => {
        if (error) {
            callback(`failed to delete currency "${code}": ` + error);
        } else {
            debug_log(`deleted currency "${code}"`);
            callback();
        }
    } : undefined);
}

/**
 * @param {{ user_id?: number, name: string, color?: color_type }} params 
 * @param {(data: label_data | null, error?: string) => any} [callback] 
 */
function label_create(params, callback) {
    db.run(query_createLabel(params), function(error) {
        if (error) {
            if (callback) {
                callback(null, `failed to create label (${JSON.stringify(params)}): ` + error);
            }
        } else {
            debug_log(`created label: ` + JSON.stringify(params));
            delete cached_data.labels[this.lastID];
            if (callback) {
                label_get(this.lastID, callback);
            }
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: label_data | null, error?: string) => any} callback 
 */
function label_get(id, callback) {
    if (cached_data.labels.hasOwnProperty(id)) {
        var data = cached_data.labels[id];
        if (!data) {
            callback(null, `can't find data of label ${id}`);
        } else {
            callback(data);
        }
        return;
    }
    db.get(query_getLabel(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of label ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of label ${id}`);
        } else {
            var data = parseLabelRow(row);
            cached_data.labels[id] = data;
            callback(data);
        }
    });
}
/**
 * @param {(data: label_data[], error?: string) => any} callback 
 */
function label_getAll(callback) {
    db.all(query_getAllLabels(), (error, rows) => {
        if (error) {
            callback([], `failed to get labels list: ` + error);
        } else {
            /** @type {label_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseLabelRow(rows[i]);
                cached_data.labels[rowData.id] = rowData;
                data.push(rowData);
            }
            callback(data);
        }
    });
}
/**
 * @param {number} userID 
 * @param {(data: (label_data & { usesNumber: number })[], error?: string) => any} callback 
 */
function label_getAllForUser(userID, callback) {
    db.all(query_getLabelsForUser(userID), (error, rows) => {
        if (error) {
            callback([], `failed to get labels list: ` + error);
        } else {
            /** @type {(label_data & { usesNumber: number })[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseLabelRow(rows[i]);
                cached_data.labels[rowData.id] = rowData;
                data.push({
                    ...rowData,
                    usesNumber: rows[i].usesNumber
                });
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ name?: string, color?: color_type, is_active?: boolean, user_id?: number | null }} params 
 * @param {(data: label_data | null, error?: string) => any} [callback] 
 */
function label_edit(id, params, callback) {
    db.run(query_updateLabel(id, params), (error) => {
        if (error) {
            if (callback) {
                callback(null, `failed to update label ${id}: ` + error);
            }
        } else {
            debug_log(`updated label ${id}: ` + JSON.stringify(params));
            delete cached_data.labels[id];
            if (callback) {
                label_get(id, callback);
            }
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} [callback] 
 */
function label_delete(id, callback) {
    if (cached_data.labels.hasOwnProperty(id)) {
        if (!cached_data.labels[id]) {
            if (callback) {
                callback();
            }
            return;
        }
        cached_data.labels[id] = null;
    }
    db.run(query_deleteLabel(id), callback ? (error) => {
        if (error) {
            callback(`failed to delete label ${id}: ` + error);
        } else {
            debug_log(`deleted label ${id}`);
            callback();
        }
    } : undefined);
}

/**
 * @param {{ user_id?: number, parent_id?: number, name: string, color?: color_type }} params 
 * @param {(data: category_data | null, error?: string) => any} [callback] 
 */
function category_create(params, callback) {
    db.run(query_createCategory(params), function(error) {
        if (error) {
            if (callback) {
                callback(null, `failed to create category (${JSON.stringify(params)}): ` + error);
            }
        } else {
            debug_log(`created category: ` + JSON.stringify(params));
            delete cached_data.categories[this.lastID];
            if (callback) {
                category_get(this.lastID, callback);
            }
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: category_data | null, error?: string) => any} callback 
 */
function category_get(id, callback) {
    if (cached_data.categories.hasOwnProperty(id)) {
        var data = cached_data.categories[id];
        if (!data) {
            callback(null, `can't find data of category ${id}`);
        } else {
            callback(data);
        }
        return;
    }
    db.get(query_getCategory(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of category ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of category ${id}`);
        } else {
            var data = parseCategoryRow(row);
            cached_data.categories[id] = data;
            callback(data);
        }
    });
}
/**
 * @param {number} user_id 
 * @param {number} parent_category_id 
 * @param {(data: category_data[], error?: string) => any} callback 
 */
function category_getList(user_id, parent_category_id, callback) {
    db.all(query_getCategoriesList(user_id, parent_category_id), (error, rows) => {
        if (error) {
            callback([], `failed to get categories list with parent ${parent_category_id} for user ${user_id} (${error})`);
        } else {
            /** @type {category_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseCategoryRow(rows[i]);
                cached_data.categories[rowData.id] = rowData;
                data.push(rowData);
            }
            callback(data);
        }
    });
}
/**
 * @param {number} user_id 
 * @param {(data: category_data[], error?: string) => any} callback 
 */
function category_getAll(user_id, callback) {
    db.all(query_getAllCategories(user_id), (error, rows) => {
        if (error) {
            callback([], `failed to get categories list: ` + error);
        } else {
            /** @type {category_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseCategoryRow(rows[i]);
                cached_data.categories[rowData.id] = rowData;
                data.push(rowData);
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ parent_id?: number, name?: string, is_active?: boolean, user_id?: number | null, color?: color_type }} params 
 * @param {(data: category_data | null, error?: string) => any} [callback] 
 */
function category_edit(id, params, callback) {
    db.run(query_updateCategory(id, params), (error) => {
        if (error) {
            if (callback) {
                callback(null, `failed to update category ${id}: ` + error);
            }
        } else {
            debug_log(`updated category ${id}: ` + JSON.stringify(params));
            delete cached_data.categories[id];
            if (callback) {
                category_get(id, callback);
            }
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} [callback] 
 */
function category_delete(id, callback) {
    if (cached_data.categories.hasOwnProperty(id)) {
        if (!cached_data.categories[id]) {
            if (callback) {
                callback();
            }
            return;
        }
        cached_data.categories[id] = null;
    }
    db.run(query_deleteCategory(id), callback ? (error) => {
        if (error) {
            callback(`failed to delete category ${id}: ` + error);
        } else {
            debug_log(`deleted category ${id}`);
            callback();
        }
    } : undefined);
}

/**
 * @param {{ user_id: number, currency_code: string, name: string, start_amount?: number, color?: color_type }} params 
 * @param {(data: account_data | null, error?: string) => any} [callback] 
 */
function account_create(params, callback) {
    db.run(query_createAccount(params), function(error) {
        if (error) {
            if (callback) {
                callback(null, `failed to create account (${JSON.stringify(params)}): ` + error);
            }
        } else {
            debug_log(`created account: ` + JSON.stringify(params));
            delete cached_data.accounts[this.lastID];
            if (callback) {
                account_get(this.lastID, callback);
            }
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: account_data | null, error?: string) => any} callback 
 */
function account_get(id, callback) {
    if (cached_data.accounts.hasOwnProperty(id)) {
        var data = cached_data.accounts[id];
        if (!data) {
            callback(null, `can't find data of account ${id}`);
        } else {
            callback(data);
        }
        return;
    }
    db.get(query_getAccount(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of account ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of account ${id}`);
        } else {
            var data = parseAccountRow(row);
            cached_data.accounts[id] = data;
            callback(data);
        }
    });
}
/**
 * @param {number} user_id 
 * @param {(data: account_data[], error?: string) => any} callback 
 */
function account_getAll(user_id, callback) {
    db.all(query_getAllAccounts(user_id), (error, rows) => {
        if (error) {
            callback([], `failed to get accounts list: ` + error);
        } else {
            /** @type {account_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                var rowData = parseAccountRow(rows[i]);
                cached_data.accounts[rowData.id] = rowData;
                data.push(rowData);
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ name?: string, start_amount?: number, is_active?: boolean, color?: color_type }} params 
 * @param {(data: account_data | null, error?: string) => any} [callback] 
 */
function account_edit(id, params, callback) {
    db.run(query_updateAccount(id, params), (error) => {
        if (error) {
            if (callback) {
                callback(null, `failed to update account ${id}: ` + error);
            }
        } else {
            debug_log(`updated account ${id}: ` + JSON.stringify(params));
            delete cached_data.accounts[id];
            if (callback) {
                account_get(id, callback);
            }
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} [callback] 
 */
function account_delete(id, callback) {
    if (cached_data.accounts.hasOwnProperty(id)) {
        if (!cached_data.accounts[id]) {
            if (callback) {
                callback();
            }
            return;
        }
        cached_data.accounts[id] = null;
    }
    db.run(query_deleteAccount(id), callback ? (error) => {
        if (error) {
            callback(`failed to delete account ${id}: ` + error);
        } else {
            debug_log(`deleted account ${id}`);
            callback();
        }
    } : undefined);
}
/**
 * @param {number[]} accountIDs 
 * @param {{ untilDate?: Date }} params 
 * @param {(ballances: { [accountID: number]: number }, error?: string) => any} callback 
 */
function account_getBallance(accountIDs, params, callback) {
    if (accountIDs.length == 0) {
        callback({});
        return;
    }
    db.all(query_getAccountBallance(accountIDs, params), (error, rows) => {
        if (error) {
            callback({}, `failed to get account ballance: ` + error);
        } else {
            /** @type {{ [accountID: number]: number }} */
            var result = {};
            for (var i = 0; i < rows.length; i++) {
                result[rows[i].account_id] = rows[i].ballance;
            }
            callback(result);
        }
    });
}

/**
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date: Date }} params 
 * @param {(data: record_data | null, error?: string) => any} [callback] 
 */
function record_create(params, callback) {
    db.run(query_createRecord(params), callback ? function(error) {
        if (error) {
            callback(null, `failed to create record (${JSON.stringify(params)}): ` + error);
        } else {
            //debug_log(`created record: ` + JSON.stringify(params));
            record_get(this.lastID, callback);
        }
    } : undefined);
}
/**
 * @param {number} id 
 * @param {(data: record_data | null, error?: string) => any} callback 
 */
function record_get(id, callback) {
    db.get(query_getRecord(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of record ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of record ${id}`);
        } else {
            callback(parseRecordRow(row));
        }
    });
}
/**
 * @param {number} userID 
 * @param {number | null} filterID
 * @param {(amount: number, error?: string) => any} callback 
 */
function record_getAmount(userID, filterID, callback) {
    db.get(query_getRecordsAmount(userID, filterID), (error, row) => {
        if (error) {
            callback(0, `failed to get amount of records: ` + error);
        } else {
            callback(row.amount);
        }
    });
}
/**
 * @param {number} userID 
 * @param {{ recordsPerPage: number, pageIndex: number, filterID?: number }} params 
 * @param {(records: (record_data & { src_account?: account_data, dst_account?: account_data, src_currency?: currency_data, dst_currency?: currency_data, category?: category_data, labels: label_data[] })[], error?: string) => any} callback 
 */
function record_getList(userID, params, callback) {
    db.all(query_getRecordsList(userID, params), (error, rows) => {
        if (error) {
            callback([], `failed to get records list: ` + error);
        } else {
            var result = [];
            for (var i = 0; i < rows.length; i++) {
                /** @type {record_data & { src_account?: account_data, dst_account?: account_data, src_currency?: currency_data, dst_currency?: currency_data, category?: category_data, labels: label_data[] }} */
                var rowData = {
                    ...parseRecordRow(rows[i]),
                    labels: []
                };
                if (rowData.src_account_id != invalid_id) {
                    rowData.src_account = parseAccountRow(rows[i], 'src_account.');
                    rowData.src_currency = parseCurrencyRow(rows[i], 'src_currency.');
                }
                if (rowData.dst_account_id != invalid_id) {
                    rowData.dst_account = parseAccountRow(rows[i], 'dst_account.');
                    rowData.dst_currency = parseCurrencyRow(rows[i], 'dst_currency.');
                }
                if (rowData.category_id != invalid_id) {
                    rowData.category = parseCategoryRow(rows[i], 'category.');
                }
                var labelsData = JSON.parse(rows[i].labels);
                for (var j = 0; j < labelsData.length; j++) {
                    if (labelsData[j].id) {
                        rowData.labels.push(parseLabelRow(labelsData[j]));
                    }
                }
                result.push(rowData);
            }
            callback(result);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date?: Date }} params 
 * @param {(data: record_data | null, error?: string) => any} [callback] 
 */
function record_edit(id, params, callback) {
    db.run(query_updateRecord(id, params), callback ? (error) => {
        if (error) {
            callback(null, `failed to update record ${id}: ` + error);
        } else {
            //debug_log(`updated record ${id}: ` + JSON.stringify(params));
            record_get(id, callback);
        }
    } : undefined);
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} [callback] 
 */
function record_delete(id, callback) {
    db.run(query_deleteRecord(id), callback ? (error) => {
        if (error) {
            callback(`failed to delete record ${id}: ` + error);
        } else {
            //debug_log(`deleted record ${id}`);
            callback();
        }
    } : undefined);
}

/**
 * @param {number} userID 
 * @param {(tempRecordData: (temp_record_data & { src_account?: account_data, dst_account?: account_data, src_currency?: currency_data, dst_currency?: currency_data, category?: category_data, labels: label_data[] }) | null, error?: string) => any} callback 
 */
function record_getOrCreateTemp(userID, callback) {
    record_getTemp(userID, (data, error) => {
        if (error || !data) {
            debug_log(`failed to get temp record for user ${userID} (${error}), creating the new one...`);
            db.run(query_createTempRecord(userID), (error) => {
                if (error) {
                    callback(null, `failed to create temp filter for user ${userID} (${error})`);
                } else {
                    record_getTemp(userID, callback);
                }
            });
        } else {
            callback(data);
        }
    });
}
/**
 * @param {number} userID 
 * @param {(tempRecordData: (temp_record_data & { src_account?: account_data, dst_account?: account_data, src_currency?: currency_data, dst_currency?: currency_data, category?: category_data, labels: label_data[] }) | null, error?: string) => any} callback 
 */
function record_getTemp(userID, callback) {
    db.get(query_getTempRecord(userID), (error, row) => {
        if (error || !row) {
            callback(null, `failed to get temp filter for user ${userID} (${error})`);
        } else {
            /** @type {temp_record_data & { src_account?: account_data, dst_account?: account_data, src_currency?: currency_data, dst_currency?: currency_data, category?: category_data, labels: label_data[] }} */
            var rowData = {
                ...parseTempRecordRow(row),
                labels: []
            };
            if (rowData.src_account_id != invalid_id) {
                rowData.src_account = parseAccountRow(row, 'src_account.');
                rowData.src_currency = parseCurrencyRow(row, 'src_currency.');
            }
            if (rowData.dst_account_id != invalid_id) {
                rowData.dst_account = parseAccountRow(row, 'dst_account.');
                rowData.dst_currency = parseCurrencyRow(row, 'dst_currency.');
            }
            if (rowData.category_id != invalid_id) {
                rowData.category = parseCategoryRow(row, 'category.');
            }
            var labelsData = JSON.parse(row.labels);
            for (var j = 0; j < labelsData.length; j++) {
                if (labelsData[j].id) {
                    rowData.labels.push(parseLabelRow(labelsData[j]));
                }
            }
            callback(rowData);
        }
    });
}
/**
 * @param {number} userID 
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date?: Date }} params 
 * @param {(error?: string) => any} callback 
 */
function record_editTemp(userID, params, callback) {
    db.run(query_updateTempRecord(userID, params), (error) => {
        if (error) {
            callback(`failed to edit temp record for user ${userID} (${error})`);
        } else {
            callback();
        }
    });
}
/**
 * @param {number} userID 
 * @param {number} labelID 
 * @param {(error?: string) => any} callback 
 */
function record_addTempLabel(userID, labelID, callback) {
    db.run(query_addTempLabel(userID, labelID), (error) => {
        if (error) {
            callback(`failed to add label ${labelID} to temp record of user ${userID} (${error})`);
        } else {
            callback();
        }
    });
}
/**
 * @param {number} userID 
 * @param {number} labelID 
 * @param {(error?: string) => any} callback 
 */
function record_removeTempLabel(userID, labelID, callback) {
    db.run(query_removeTempLabel(userID, labelID), (error) => {
        if (error) {
            callback(`failed to remove label ${labelID} from temp record of user ${userID} (${error})`);
        } else {
            callback();
        }
    });
}
/**
 * @param {number} userID 
 * @param {(error?: string) => any} callback 
 */
function record_clearTempLabels(userID, callback) {
    db.run(query_clearTempLabels(userID), (error) => {
        if (error) {
            callback(`failed to clear labels from temp record of user ${userID} (${error})`);
        } else {
            callback();
        }
    });
}

/**
 * @param {number} record_id 
 * @param {number} label_id 
 * @param {(error?: string) => any} [callback] 
 */
function record_addLabel(record_id, label_id, callback) {
    db.run(query_createRecordLabel(record_id, label_id), callback ? (error) => {
        if (error) {
            callback(`failed to add label ${label_id} to record ${record_id}: ` + error);
        } else {
            //debug_log(`added label ${label_id} to record ${record_id}`);
            callback();
        }
    } : undefined);
}
/**
 * @param {number} record_id 
 * @param {number} label_id 
 * @param {(error?: string) => any} [callback] 
 */
function record_removeLabel(record_id, label_id, callback) {
    db.run(query_deleteRecordLabel(record_id, label_id), callback ? (error) => {
        if (error) {
            callback(`failed to delete label ${label_id} from record ${record_id}: ` + error);
        } else {
            //debug_log(`deleted label ${label_id} from record ${record_id}`);
            callback();
        }
    } : undefined);
}
/**
 * @param {number} record_id 
 * @param {(error?: string) => any} [callback] 
 */
function record_clearLabels(record_id, callback) {
    db.run(query_deleteRecordLabels(record_id), callback ? (error) => {
        if (error) {
            callback(`failed to delete labels from record ${record_id}: ` + error);
        } else {
            //debug_log(`deleted labels from record ${record_id}`);
            callback();
        }
    } : undefined);
}

/**
 * @param {user_invite_data} data 
 * @param {(error?: string) => any} [callback] 
 */
function invite_create(data, callback) {
    db.run(query_createInvite(data), (error) => {
        if (error) {
            if (callback) {
                callback(`failed to create user invite (${JSON.stringify(data)}): ` + error);
            }
        } else {
            debug_log(`created user invite: ` + JSON.stringify(data));
            cached_data.user_invites[data.id] = data;
            if (callback) {
                callback();
            }
        }
    });
}
/**
 * @param {number} userID 
 * @param {(data: user_invite_data | null, error?: string) => any} callback 
 */
function invite_get(userID, callback) {
    if (cached_data.user_invites.hasOwnProperty(userID)) {
        var data = cached_data.user_invites[userID];
        if (!data) {
            callback(null, `can't find data of user ${userID}`);
        } else {
            callback(data);
        }
        return;
    }
    db.get(query_getInvite(userID), (error, row) => {
        if (error) {
            callback(null, `can't find invite for user ${userID}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of user ${userID}`);
        } else {
            callback(parseInviteRow(row));
        }
    });
}
/**
 * @param {number} userID 
 * @param {(error?: string) => any} [callback] 
 */
function invite_delete(userID, callback) {
    if (cached_data.user_invites.hasOwnProperty(userID)) {
        if (!cached_data.user_invites[userID]) {
            if (callback) {
                callback();
            }
            return;
        }
        cached_data.user_invites[userID] = null;
    }
    db.run(query_deleteInvite(userID), callback ? (error) => {
        if (error) {
            callback(`failed to delete invite for user ${userID}: ` + error);
        } else {
            debug_log(`deleted invite for user ${userID}`);
            callback();
        }
    } : undefined);
}

/**
 * @param {number} userID 
 * @param {(data: filter_data | null, error?: string) => any} callback 
 */
function filter_getOrCreateTemp(userID, callback) {
    filter_getTemp(userID, true, callback);
}
/**
 * @param {number} userID 
 * @param {boolean} createIfNotFound 
 * @param {(data: filter_data | null, error?: string) => any} callback 
 */
function filter_getTemp(userID, createIfNotFound, callback) {
    db.get(query_getTempFilter(userID), (error, row) => {
        if (error) {
            callback(null, `failed to get temp filter for user ${userID} (${error})`);
        } else if (!row) {
            if (createIfNotFound) {
                db.run(query_createTempFilter(userID), (error) => {
                    if (error) {
                        callback(null, `failed to create temp filter for user ${userID} (${error})`);
                    } else {
                        filter_getTemp(userID, false, callback);
                    }
                });
            } else {
                callback(null);
            }
        } else {
            callback(parseFilterRow(row));
        }
    });
}
/**
 * @param {number} userID 
 * @param {filter_params} params 
 * @param {(data: filter_data | null, error?: string) => any} callback 
 */
function filter_editTemp(userID, params, callback) {
    db.run(query_editTempFilter(userID, params), (error) => {
        if (error) {
            callback(null, `failed to update temp filter for user ${userID} (${error})`);
        } else {
            filter_getTemp(userID, false, callback);
        }
    });
}
/**
 * @param {number} userID 
 * @param {filter_params} params 
 * @param {(data: filter_data | null, error?: string) => any} callback 
 */
function filter_editCustom(userID, params, callback) {
    db.run(query_editTempFilter(userID, params, true), (error) => {
        if (error) {
            callback(null, `failed to update custom filter for user ${userID} (${error})`);
        } else {
            db.get(query_getTempFilter(userID, true), (error, row) => {
                if (error) {
                    callback(null, `failed to get custom filter for user ${userID} (${error})`);
                } else if (!row) {
                    callback(null);
                } else {
                    callback(parseFilterRow(row));
                }
            });
        }
    });
}

/**
 * @param {number} filterID 
 * @param {(filterData: filter_data | null, error?: string) => any} callback 
 */
function filter_get(filterID, callback) {
    db.get(query_getFilter(filterID), (error, row) => {
        if (error) {
            callback(null, `failed to get filter data ${filterID} (${error})`);
        } else if (!row) {
            callback(null);
        } else {
            callback(parseFilterRow(row));
        }
    });
}

/**
 * @param {string} [str] 
 */
function query_handle_string(str) {
    return str ? str.replace(/'/g, "''") : 'NULL';
}
function query_initialize() {
    return fs.readFileSync('data/database.sql', { encoding: 'utf-8' });
}
function query_getAllUsers() {
    return `SELECT * FROM users;`;
}
function query_getAllCurrencies() {
    return `SELECT * FROM currencies;`;
}
function query_getAllLabels() {
    return `SELECT * FROM labels;`;
}
/**
 * @param {number} user_id
 */
function query_getAllCategories(user_id) {
    if (user_id == invalid_id) {
        return `SELECT * FROM categories;`;
    }
    return `SELECT * FROM categories WHERE user_id IS NULL OR user_id = ${user_id};`;
}
/**
 * @param {number} user_id
 */
function query_getAllAccounts(user_id) {
    if (user_id == invalid_id) {
        return `SELECT * FROM accounts;`;
    }
    return `SELECT *
    FROM accounts 
    WHERE user_id = ${user_id}
    ORDER BY is_active DESC, id DESC;`;
}
function query_getAllRecords() {
    return `SELECT * FROM records;`;
}
function query_getAllRecordLabels() {
    return `SELECT * FROM record_labels;`;
}
function query_getAllInvites() {
    return `SELECT * FROM user_invites;`;
}
function query_getAllFilters() {
    return `SELECT * FROM filters;`;
}

/**
 * @param {{ id: number, name: string }} params
 */
function query_createUser(params) {
    return `INSERT INTO users(id, name, create_date) VALUES (${params.id}, '${query_handle_string(params.name)}', ${Date.now()});`;
}
/**
 * @param {number} id
 */
function query_getUser(id) {
    return `SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} id
 * @param {{ name: string }} params 
 */
function query_updateUser(id, params) {
    return `UPDATE users SET name = '${query_handle_string(params.name)}' WHERE id = ${id};`;
}

/**
 * @param {{ code: string, name?: string, symbol?: string }} params 
 */
function query_createCurrency(params) {
    return `INSERT INTO currencies(code, name, symbol, is_active, create_date) VALUES ('${query_handle_string(params.code)}', ${
        params.name ? `'${query_handle_string(params.name)}'` : `NULL`
    }, ${params.symbol ? `'${query_handle_string(params.symbol)}'` : `NULL`}, 1, ${Date.now()});`;
}
/**
 * @param {string} code 
 */
function query_getCurrency(code) {
    return `SELECT * FROM currencies WHERE code = '${query_handle_string(code)}' LIMIT 1;`;
}
/**
 * @param {number} userID 
 */
function query_getCurrenciesForUser(userID) {
    return `SELECT currencies.*, COUNT(userAccounts.id) AS usesNumber
    FROM currencies
        LEFT JOIN (
            SELECT *
            FROM accounts
            WHERE user_id = ${userID}
        ) userAccounts ON userAccounts.currency_code = currencies.code
    GROUP BY currencies.code
    ORDER BY currencies.is_active DESC, usesNumber DESC, currencies.create_date DESC;`;
}
/**
 * @param {string} code 
 * @param {{ name?: string | null, symbol?: string | null, is_active?: boolean }} params 
 */
function query_updateCurrency(code, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('name')) {
        if (params.name) {
            statements.push(`name = '${query_handle_string(params.name)}'`);
        } else {
            statements.push(`name = NULL`);
        }
    }
    if (properties.includes('symbol')) {
        if (params.symbol) {
            statements.push(`symbol = '${query_handle_string(params.symbol)}'`);
        } else {
            statements.push(`symbol = NULL`);
        }
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
    }
    return `UPDATE currencies SET ${statements.join(', ')} WHERE code = '${query_handle_string(code)}';`;
}
/**
 * @param {string} code 
 */
function query_deleteCurrency(code) {
    return `DELETE FROM currencies WHERE code = '${query_handle_string(code)}';`;
}

/**
 * @param {{ user_id?: number, name: string, color?: color_type }} params 
 */
function query_createLabel(params) {
    return `INSERT INTO labels(user_id, name, color, is_active, create_date) VALUES (
        ${params.user_id ? params.user_id : 'NULL'}, '${query_handle_string(params.name)}', ${params.color ? `'${params.color}'` : 'NULL'}, 1, ${Date.now()}
    );`;
}
/**
 * @param {number} id 
 */
function query_getLabel(id) {
    return `SELECT * FROM labels WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} userID 
 */
function query_getLabelsForUser(userID) {
    return `SELECT labels.*, COUNT(record_labels.record_id) AS usesNumber
    FROM labels
        LEFT JOIN record_labels ON labels.id = record_labels.label_id
    WHERE labels.user_id = ${userID} OR labels.user_id IS NULL
    GROUP BY labels.id
    ORDER BY labels.is_active DESC, usesNumber DESC, labels.id DESC;`;
}
/**
 * @param {number} id 
 * @param {{ name?: string, color?: color_type, is_active?: boolean, user_id?: number | null }} params 
 */
function query_updateLabel(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('name')) {
        statements.push(`name = '${query_handle_string(params.name)}'`);
    }
    if (properties.includes('color')) {
        if (params.color) {
            statements.push(`color = '${params.color}'`);
        } else {
            statements.push(`color = NULL`);
        }
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
    }
    if (properties.includes('user_id')) {
        statements.push(`user_id = ${params.user_id ? params.user_id : 'NULL'}`);
    }
    return `UPDATE labels SET ${statements.join(', ')} WHERE id = ${id};`;
}
/**
 * @param {number} id 
 */
function query_deleteLabel(id) {
    return `DELETE FROM labels WHERE id = ${id};`;
}

/**
 * @param {{ user_id?: number, parent_id?: number, name: string, color?: color_type }} params
 */
function query_createCategory(params) {
    return `INSERT INTO categories(user_id, parent_id, name, color, is_active, create_date) VALUES (
        ${params.user_id ? params.user_id : 'NULL'}, ${params.parent_id ? params.parent_id : 'NULL'}, '${query_handle_string(params.name)}', ${params.color ? `'${params.color}'` : 'NULL'}, 1, ${Date.now()}
    );`;
}
/**
 * @param {number} id 
 */
function query_getCategory(id) {
    return `SELECT * FROM categories WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} user_id 
 * @param {number} parent_category_id 
 */
function query_getCategoriesList(user_id, parent_category_id) {
    return `SELECT *
    FROM categories
    WHERE (user_id = ${user_id} OR user_id IS NULL) AND parent_id ${parent_category_id != invalid_id ? `= ${parent_category_id}` : `IS NULL`}
    ORDER BY is_active DESC, id ASC;`;
}
/**
 * @param {number} id 
 * @param {{ parent_id?: number, name?: string, is_active?: boolean, user_id?: number | null, color?: color_type }} params 
 */
function query_updateCategory(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('parent_id')) {
        statements.push(`parent_id = ${params.parent_id ? params.parent_id : 'NULL'}`);
    }
    if (properties.includes('name')) {
        statements.push(`name = '${query_handle_string(params.name)}'`);
    }
    if (properties.includes('color')) {
        if (params.color) {
            statements.push(`color = '${params.color}'`);
        } else {
            statements.push(`color = NULL`);
        }
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
    }
    if (properties.includes('user_id')) {
        statements.push(`user_id = ${params.user_id ? params.user_id : 'NULL'}`);
    }
    return `UPDATE categories SET ${statements.join(', ')} WHERE id = ${id};`;
}
/**
 * @param {number} id 
 */
function query_deleteCategory(id) {
    return `DELETE FROM categories WHERE id = ${id};`;
}

/**
 * @param {{ user_id: number, currency_code: string, name: string, start_amount?: number, color?: color_type }} params 
 */
function query_createAccount(params) {
    return `INSERT INTO accounts(user_id, currency_code, name, start_amount, color, is_active, create_date) VALUES (
        ${params.user_id}, '${query_handle_string(params.currency_code)}', '${query_handle_string(params.name)}', ${params.start_amount ? params.start_amount : 0}, ${params.color ? `'${params.color}'` : 'NULL'}, 1, ${Date.now()}
    );`;
}
/**
 * @param {number} id 
 */
function query_getAccount(id) {
    return `SELECT * FROM accounts WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} id 
 * @param {{ name?: string, start_amount?: number, is_active?: boolean, color?: color_type }} params 
 */
function query_updateAccount(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('name')) {
        statements.push(`name = '${query_handle_string(params.name)}'`);
    }
    if (properties.includes('start_amount')) {
        statements.push(`start_amount = ${params.start_amount ? params.start_amount : 0}`);
    }
    if (properties.includes('color')) {
        if (params.color) {
            statements.push(`color = '${params.color}'`);
        } else {
            statements.push(`color = NULL`);
        }
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
    }
    return `UPDATE accounts SET ${statements.join(', ')} WHERE id = ${id};`;
}
/**
 * @param {number} id 
 */
function query_deleteAccount(id) {
    return `DELETE FROM accounts WHERE id = ${id};`;
}
/**
 * @param {number[]} accountIDs 
 * @param {{ untilDate?: Date }} params 
 */
function query_getAccountBallance(accountIDs, params) {
    var accountConditions = [];
    for (var i = 0; i < accountIDs.length; i++) {
        accountConditions.push(`account_id = ${accountIDs[i]}`);
    }
    const accountConditionsStr = accountConditions.join(' OR ');

    /** @type {string[]} */
    var conditions = [ `(${accountConditionsStr})` ];
    if (params.untilDate && params.untilDate.valueOf() > 0) {
        conditions.push(`date <= ${params.untilDate.valueOf()}`);
    }
    const conditionsStr = conditions.join(' AND ');

    return `SELECT accounts.id AS account_id, accounts.start_amount + SUM(t.amount) AS ballance
    FROM accounts
        LEFT JOIN (
            SELECT dst_account_id AS account_id, SUM(dst_amount) AS amount
            FROM records
            WHERE ${conditionsStr}
            GROUP BY account_id

            UNION ALL

            SELECT src_account_id AS account_id, -SUM(src_amount) AS amount
            FROM records
            WHERE ${conditionsStr}
            GROUP BY account_id
        ) AS t ON accounts.id = t.account_id
    WHERE ${accountConditionsStr}
    GROUP BY t.account_id;`;
}

/**
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date: Date }} params
 */
function query_createRecord(params) {
    return `INSERT INTO records(src_account_id, src_amount, dst_account_id, dst_amount, category_id, date, create_date) VALUES (
        ${params.src_account_id ? params.src_account_id : 'NULL'}, ${params.src_amount ? params.src_amount : 0},
        ${params.dst_account_id ? params.dst_account_id : 'NULL'}, ${params.dst_amount ? params.dst_amount : 0},
        ${params.category_id ? params.category_id : 'NULL'}, ${params.date.valueOf()}, ${Date.now()}
    );`;
}
/**
 * @param {number} id 
 */
function query_getRecord(id) {
    return `SELECT * FROM records WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} userID 
 * @param {number | null} filterID
 */
function query_getRecordsAmount(userID, filterID) {
    return `SELECT COUNT(records.id) AS amount
    FROM ${filterID != null ? `filters CROSS JOIN` : ''} records
        LEFT JOIN accounts AS src_account ON records.src_account_id = src_account.id
        LEFT JOIN accounts AS dst_account ON records.dst_account_id = dst_account.id
    WHERE ${filterID != null ? `(filters.id = ${filterID}) AND 
            (filters.date_from IS NULL OR (records.date >= filters.date_from)) AND 
            (filters.date_until IS NULL OR (records.date <= filters.date_until)) AND` : ''} 
        ((src_account.user_id = ${userID}) OR (dst_account.user_id = ${userID}))
    LIMIT 1;`;
}
/**
 * @param {number} userID 
 * @param {{ recordsPerPage: number, pageIndex: number, filterID?: number }} params 
 */
function query_getRecordsList(userID, params) {
    const useFilter = typeof params.filterID === 'number';
    const recordsPerPage = Math.max(1, params.recordsPerPage);
    const pageIndex = Math.max(0, params.pageIndex);
    /** @type {string[]} */
    var srcAccountColumns = [], dstAccountColumns = [], srcCurrencyColumns = [], dstCurrencyColumns = [], categoryColumns = [], labelColumns = [];
    const accountColumnNames = Object.getOwnPropertyNames(parseAccountRow({}));
    for (var i = 0; i < accountColumnNames.length; i++) {
        srcAccountColumns.push(`src_account.${accountColumnNames[i]} AS 'src_account.${accountColumnNames[i]}'`);
        dstAccountColumns.push(`dst_account.${accountColumnNames[i]} AS 'dst_account.${accountColumnNames[i]}'`);
    }
    const currencyColumnNames = Object.getOwnPropertyNames(parseCurrencyRow({}));
    for (var i = 0; i < currencyColumnNames.length; i++) {
        srcCurrencyColumns.push(`src_currency.${currencyColumnNames[i]} AS 'src_currency.${currencyColumnNames[i]}'`);
        dstCurrencyColumns.push(`dst_currency.${currencyColumnNames[i]} AS 'dst_currency.${currencyColumnNames[i]}'`);
    }
    const categoryColumnNames = Object.getOwnPropertyNames(parseCategoryRow({}));
    for (var i = 0; i < categoryColumnNames.length; i++) {
        categoryColumns.push(`categories.${categoryColumnNames[i]} AS 'category.${categoryColumnNames[i]}'`);
    }
    const labelColumnNames = Object.getOwnPropertyNames(parseLabelRow({}));
    for (var i = 0; i < labelColumnNames.length; i++) {
        labelColumns.push(`'${labelColumnNames[i]}', labels.${labelColumnNames[i]}`);
    }
    return `SELECT records.*, ${srcAccountColumns.join(', ')}, ${dstAccountColumns.join(', ')}, 
        ${srcCurrencyColumns.join(', ')}, ${dstCurrencyColumns.join(', ')}, ${categoryColumns.join(', ')}, 
        JSON_GROUP_ARRAY(JSON_OBJECT(${labelColumns.join(', ')})) AS labels
    FROM ${useFilter ? `filters CROSS JOIN` : ''} records
        LEFT JOIN accounts AS src_account ON records.src_account_id = src_account.id
        LEFT JOIN accounts AS dst_account ON records.dst_account_id = dst_account.id
        LEFT JOIN currencies AS src_currency ON src_account.currency_code = src_currency.code
        LEFT JOIN currencies AS dst_currency ON dst_account.currency_code = dst_currency.code
        LEFT JOIN categories ON records.category_id = categories.id
        LEFT JOIN record_labels ON records.id = record_labels.record_id
        LEFT JOIN labels ON record_labels.label_id = labels.id
    WHERE ${useFilter ? `(filters.id = ${params.filterID}) AND 
            (filters.date_from IS NULL OR (records.date >= filters.date_from)) AND 
            (filters.date_until IS NULL OR (records.date <= filters.date_until)) AND` : ''} 
        ((src_account.user_id = ${userID}) OR (dst_account.user_id = ${userID}))
    GROUP BY records.id
    ORDER BY records.date DESC, records.create_date DESC
    LIMIT ${pageIndex * recordsPerPage}, ${recordsPerPage};`;
}
/**
 * @param {number} id 
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date?: Date }} params 
 */
function query_updateRecord(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('src_account_id')) {
        if (params.src_account_id) {
            statements.push(`src_account_id = ${params.src_account_id}`);
        } else {
            statements.push(`src_account_id = NULL`);
        }
    }
    if (properties.includes('src_amount')) {
        statements.push(`src_amount = ${params.src_amount ? params.src_amount : 0}`);
    }
    if (properties.includes('dst_account_id')) {
        if (params.dst_account_id) {
            statements.push(`dst_account_id = ${params.dst_account_id}`);
        } else {
            statements.push(`dst_account_id = NULL`);
        }
    }
    if (properties.includes('dst_amount')) {
        statements.push(`dst_amount = ${params.dst_amount ? params.dst_amount : 0}`);
    }
    if (properties.includes('category_id')) {
        if (params.category_id) {
            statements.push(`category_id = ${params.category_id}`);
        } else {
            statements.push(`category_id = NULL`);
        }
    }
    if (properties.includes('date')) {
        statements.push(`date = ${params.date ? params.date.valueOf() : 0}`);
    }
    return `UPDATE records SET ${statements.join(', ')} WHERE id = ${id};`;
}
/**
 * @param {number} id 
 */
function query_deleteRecord(id) {
    return `DELETE FROM records WHERE id = ${id};`;
}

/**
 * @param {number} userID 
 */
function query_createTempRecord(userID) {
    return `INSERT INTO temp_records(user_id, src_account_id, src_amount, dst_account_id, dst_amount, category_id, date)
    VALUES (${userID}, NULL, 0, NULL, 0, NULL, 0);`;
}
/**
 * @param {number} userID 
 */
function query_getTempRecord(userID) {
    /** @type {string[]} */
    var srcAccountColumns = [], dstAccountColumns = [], srcCurrencyColumns = [], dstCurrencyColumns = [], categoryColumns = [], labelColumns = [];
    const accountColumnNames = Object.getOwnPropertyNames(parseAccountRow({}));
    for (var i = 0; i < accountColumnNames.length; i++) {
        srcAccountColumns.push(`src_account.${accountColumnNames[i]} AS 'src_account.${accountColumnNames[i]}'`);
        dstAccountColumns.push(`dst_account.${accountColumnNames[i]} AS 'dst_account.${accountColumnNames[i]}'`);
    }
    const currencyColumnNames = Object.getOwnPropertyNames(parseCurrencyRow({}));
    for (var i = 0; i < currencyColumnNames.length; i++) {
        srcCurrencyColumns.push(`src_currency.${currencyColumnNames[i]} AS 'src_currency.${currencyColumnNames[i]}'`);
        dstCurrencyColumns.push(`dst_currency.${currencyColumnNames[i]} AS 'dst_currency.${currencyColumnNames[i]}'`);
    }
    const categoryColumnNames = Object.getOwnPropertyNames(parseCategoryRow({}));
    for (var i = 0; i < categoryColumnNames.length; i++) {
        categoryColumns.push(`categories.${categoryColumnNames[i]} AS 'category.${categoryColumnNames[i]}'`);
    }
    const labelColumnNames = Object.getOwnPropertyNames(parseLabelRow({}));
    for (var i = 0; i < labelColumnNames.length; i++) {
        labelColumns.push(`'${labelColumnNames[i]}', labels.${labelColumnNames[i]}`);
    }
    return `SELECT temp_records.*, ${srcAccountColumns.join(', ')}, ${dstAccountColumns.join(', ')}, 
        ${srcCurrencyColumns.join(', ')}, ${dstCurrencyColumns.join(', ')}, ${categoryColumns.join(', ')}, 
        JSON_GROUP_ARRAY(JSON_OBJECT(${labelColumns.join(', ')})) AS labels
    FROM temp_records
        LEFT JOIN accounts AS src_account ON temp_records.src_account_id = src_account.id
        LEFT JOIN accounts AS dst_account ON temp_records.dst_account_id = dst_account.id
        LEFT JOIN currencies AS src_currency ON src_account.currency_code = src_currency.code
        LEFT JOIN currencies AS dst_currency ON dst_account.currency_code = dst_currency.code
        LEFT JOIN categories ON temp_records.category_id = categories.id
        LEFT JOIN temp_record_labels ON temp_records.user_id = temp_record_labels.user_id
        LEFT JOIN labels ON temp_record_labels.label_id = labels.id
    WHERE temp_records.user_id = ${userID}
    GROUP BY temp_records.user_id
    LIMIT 1;`;
}
/**
 * @param {number} userID 
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date?: Date }} params 
 */
function query_updateTempRecord(userID, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('src_account_id')) {
        if (params.src_account_id) {
            statements.push(`src_account_id = ${params.src_account_id}`);
        } else {
            statements.push(`src_account_id = NULL`);
        }
    }
    if (properties.includes('src_amount')) {
        statements.push(`src_amount = ${params.src_amount ? params.src_amount : 0}`);
    }
    if (properties.includes('dst_account_id')) {
        if (params.dst_account_id) {
            statements.push(`dst_account_id = ${params.dst_account_id}`);
        } else {
            statements.push(`dst_account_id = NULL`);
        }
    }
    if (properties.includes('dst_amount')) {
        statements.push(`dst_amount = ${params.dst_amount ? params.dst_amount : 0}`);
    }
    if (properties.includes('category_id')) {
        if (params.category_id) {
            statements.push(`category_id = ${params.category_id}`);
        } else {
            statements.push(`category_id = NULL`);
        }
    }
    if (properties.includes('date')) {
        statements.push(`date = ${params.date ? params.date.valueOf() : 0}`);
    }
    return `UPDATE temp_records SET ${statements.join(', ')} WHERE user_id = ${userID};`;
}
/**
 * @param {number} userID 
 * @param {number} labelID 
 */
function query_addTempLabel(userID, labelID) {
    return `INSERT INTO temp_record_labels(user_id, label_id) VALUES (${userID}, ${labelID});`;
}
/**
 * @param {number} userID 
 * @param {number} labelID 
 */
function query_removeTempLabel(userID, labelID) {
    return `DELETE FROM temp_record_labels WHERE (user_id = ${userID}) AND (label_id = ${labelID});`;
}
/**
 * @param {number} userID 
 */
function query_clearTempLabels(userID) {
    return `DELETE FROM temp_record_labels WHERE user_id = ${userID};`;
}

/**
 * @param {number} record_id 
 * @param {number} label_id 
 */
function query_createRecordLabel(record_id, label_id) {
    return `INSERT INTO record_labels(record_id, label_id, create_date) VALUES (${record_id}, ${label_id}, ${Date.now()});`;
}
/**
 * @param {number} record_id 
 * @param {number} label_id 
 */
function query_deleteRecordLabel(record_id, label_id) {
    return `DELETE FROM record_labels WHERE record_id = ${record_id} AND ${label_id};`;
}
/**
 * @param {number} record_id 
 */
function query_deleteRecordLabels(record_id) {
    return `DELETE FROM record_labels WHERE record_id = ${record_id};`;
}

/**
 * @param {user_invite_data} params 
 */
function query_createInvite(params) {
    return `INSERT INTO user_invites(id, inviting_user_id, invite_date, expire_date) VALUES (${params.id}, ${params.inviting_user_id}, ${params.invite_date.valueOf()}, ${params.expire_date.valueOf()});`;
}
/**
 * @param {number} userID 
 */
function query_getInvite(userID) {
    return `SELECT * FROM user_invites WHERE id = ${userID};`;
}
/**
 * @param {number} userID 
 */
function query_deleteInvite(userID) {
    return `DELETE FROM user_invites WHERE id = ${userID};`;
}

/**
 * @param {number} userID 
 */
function query_createTempFilter(userID) {
    return `INSERT INTO filters(user_id, filter_type, date_from, date_until, create_date)
    VALUES (${userID}, ${FILTER_TYPE_TEMP}, NULL, NULL, ${Date.now()}),
        (${userID}, ${FILTER_TYPE_CUSTOM}, NULL, NULL, ${Date.now()});`;
}
/**
 * @param {number} userID 
 * @param {boolean} [customType] 
 */
function query_getTempFilter(userID, customType) {
    return `SELECT * 
    FROM filters 
    WHERE (user_id = ${userID}) AND (filter_type = ${customType ? FILTER_TYPE_CUSTOM : FILTER_TYPE_TEMP}) 
    LIMIT 1;`;
}
/**
 * @param {number} userID 
 * @param {filter_params} params 
 * @param {boolean} [customType] 
 */
function query_editTempFilter(userID, params, customType) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('date_from')) {
        if (params.date_from) {
            statements.push(`date_from = ${params.date_from.valueOf()}`);
        } else {
            statements.push(`date_from = NULL`);
        }
    }
    if (properties.includes('date_until')) {
        if (params.date_until) {
            statements.push(`date_until = ${params.date_until.valueOf()}`);
        } else {
            statements.push(`date_until = NULL`);
        }
    }
    return `UPDATE filters SET ${statements.join(', ')} WHERE (user_id = ${userID}) AND (filter_type = ${customType ? FILTER_TYPE_CUSTOM : FILTER_TYPE_TEMP});`;
}

/**
 * @param {number} filterID 
 */
function query_getFilter(filterID) {
    return `SELECT * 
    FROM filters 
    WHERE id = ${filterID} 
    LIMIT 1;`;
}
