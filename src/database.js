// @ts-check

var fs = require('fs');
var sqlite = require('sqlite3');

var dateFormat = require('./date-format');
var log = require('./log');

/**
 * @typedef {{ users: user_data[], currencies: currency_data[], labels: label_data[], categories: category_data[], accounts: account_data[], records: record_data[], record_labels: record_label_data[], user_invites: user_invite_data[] }} full_data
 * @typedef {{ id: number, name: string, create_date: Date }} user_data
 * @typedef {{ code: string, name: string, is_active: boolean, create_date: Date }} currency_data
 * @typedef {{ id: number, user_id: number, name: string, is_active: boolean, create_date: Date }} label_data
 * @typedef {{ id: number, user_id: number, parent_id: number, name: string, is_active: boolean, create_date: Date }} category_data
 * @typedef {{ id: number, user_id: number, currency_code: string, name: string, start_amount: number, is_active: boolean, create_date: Date }} account_data
 * @typedef {{ id: number, src_account_id: number, src_amount: number, dst_account_id: number, dst_amount: number, category_id: number, date: Date, create_date: Date }} record_data
 * @typedef {{ record_id: number, label_id: number, create_date: Date }} record_label_data
 * @typedef {{ id: number, inviting_user_id: number, invite_date: Date, expire_date: Date }} user_invite_data
 */

const db_filepath = "data/database.db";
const invalid_id = 0;

module.exports.invalid_id = invalid_id;
module.exports.open = openDatabase;
module.exports.close = closeDatabase;
module.exports.getAllData = getAllData;

module.exports.user_create = user_create;
module.exports.user_get = user_get;
module.exports.user_getAll = user_getAll;

module.exports.currency_create = currency_create;
module.exports.currency_get = currency_get;
module.exports.currency_get_all = currency_getAll;
module.exports.currency_edit = currency_edit;
module.exports.currency_delete = currency_delete;

module.exports.label_create = label_create;
module.exports.label_get = label_get;
module.exports.label_getAll = label_getAll;
module.exports.label_edit = label_edit;
module.exports.label_delete = label_delete;

module.exports.category_create = category_create;
module.exports.category_get = category_get;
module.exports.category_getAll = category_getAll;
module.exports.category_edit = category_edit;
module.exports.category_delete = category_delete;

module.exports.account_create = account_create;
module.exports.account_get = account_get;
module.exports.account_getAll = account_getAll;
module.exports.account_edit = account_edit;
module.exports.account_delete = account_delete;

module.exports.record_create = record_create;
module.exports.record_get = record_get;
module.exports.record_edit = record_edit;
module.exports.record_delete = record_delete;

module.exports.addLabelToRecord = addLabelToRecord;
module.exports.getRecordLabels = getRecordLabels;
module.exports.deleteRecordLabel = deleteRecordLabel;
module.exports.clearRecordLabels = clearRecordLabels;

module.exports.invite_create = invite_create;
module.exports.invite_get = invite_get;
module.exports.invite_delete = invite_delete;



/** @type {sqlite.Database} */
var db;

function debug_log(msg) {
    log.info('[DB] ' + msg);
}

/**
 * @param {(error?: string) => any} callback 
 */
function openDatabase(callback) {
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
    var result = { users: [], currencies: [], labels: [], categories: [], accounts: [], records: [], record_labels: [], user_invites: [] };
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
            label_getAll(invalid_id, (data, error) => {
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
                                result.records.push({
                                    id: rows[i].id,
                                    src_account_id: rows[i].src_account_id ? rows[i].src_account_id : invalid_id,
                                    src_amount: rows[i].src_amount,
                                    dst_account_id: rows[i].dst_account_id ? rows[i].dst_account_id : invalid_id,
                                    dst_amount: rows[i].dst_amount,
                                    category_id: rows[i].category_id ? rows[i].category_id : invalid_id,
                                    date: dateFormat.from_string(rows[i].date),
                                    create_date: dateFormat.from_string(rows[i].create_date)
                                });
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
                                        create_date: dateFormat.from_string(rows[i].create_date)
                                    });
                                }
                                db.all(query_getAllInvites(), (error, rows) => {
                                    if (error) {
                                        callback(null, `failed to get invites list: ` + error);
                                        return;
                                    }
                                    for (var i = 0; i < rows.length; i++) {
                                        result.user_invites.push({
                                            id: rows[i].id,
                                            inviting_user_id: rows[i].inviting_user_id,
                                            invite_date: dateFormat.from_string(rows[i].invite_date),
                                            expire_date: dateFormat.from_string(rows[i].expire_date)
                                        });
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
 * @param {{ id: number, name: string }} params 
 * @param {(data: user_data | null, error?: string) => any} callback 
 */
function user_create(params, callback) {
    db.run(query_createUser(params), (error) => {
        if (error) {
            callback(null, `failed to create user (${JSON.stringify(params)}): ` + error);
        } else {
            debug_log('created user: ' + JSON.stringify(params));
            user_get(params.id, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: user_data | null, error?: string) => any} callback 
 */
function user_get(id, callback) {
    db.get(query_getUser(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of user ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of user ${id}`);
        } else {
            callback({
                id: row.id,
                name: row.name,
                create_date: dateFormat.from_string(row.create_date)
            });
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
                data.push({
                    id: rows[i].id,
                    name: rows[i].name,
                    create_date: dateFormat.from_string(rows[i].create_date)
                });
            }
            callback(data);
        }
    });
}

/**
 * @param {{ code: string, name: string }} params 
 * @param {(data: currency_data | null, error?: string) => any} callback 
 */
function currency_create(params, callback) {
    db.run(query_createCurrency(params), (error) => {
        if (error) {
            callback(null, `failed to create currency (${JSON.stringify(params)}): ` + error);
        } else {
            debug_log('created currency: ' + JSON.stringify(params));
            currency_get(params.code, callback);
        }
    });
}
/**
 * @param {string} code 
 * @param {(data: currency_data | null, error?: string) => any} callback 
 */
function currency_get(code, callback) {
    db.get(query_getCurrency(code), (error, row) => {
        if (error) {
            callback(null, `failed to get data of currency "${code}": ` + error);
        } else if (!row) {
            callback(null, `can't find data of currency "${code}"`);
        } else {
            callback({
                code: row.code,
                name: row.name,
                is_active: row.is_active != 0,
                create_date: dateFormat.from_string(row.create_date)
            });
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
                data.push({
                    code: rows[i].code,
                    name: rows[i].name,
                    is_active: rows[i].is_active != 0,
                    create_date: dateFormat.from_string(rows[i].create_date)
                });
            }
            callback(data);
        }
    });
}
/**
 * @param {string} code 
 * @param {{ name?: string, is_active?: boolean }} params 
 * @param {(data: currency_data | null, error?: string) => any} callback 
 */
function currency_edit(code, params, callback) {
    db.run(query_updateCurrency(code, params), (error) => {
        if (error) {
            callback(null, `failed to update currency "${code}": ` + error);
        } else {
            debug_log(`updated currency "${code}": ` + JSON.stringify(params));
            currency_get(code, callback);
        }
    });
}
/**
 * @param {string} code 
 * @param {(error?: string) => any} callback 
 */
function currency_delete(code, callback) {
    db.run(query_deleteCurrency(code), (error) => {
        if (error) {
            callback(`failed to delete currency "${code}": ` + error);
        } else {
            debug_log(`deleted currency "${code}"`);
            callback();
        }
    });
}

/**
 * @param {{ user_id?: number, name: string }} params 
 * @param {(data: label_data | null, error?: string) => any} callback 
 */
function label_create(params, callback) {
    db.run(query_createLabel(params), function(error) {
        if (error) {
            callback(null, `failed to create label (${JSON.stringify(params)}): ` + error);
        } else {
            debug_log(`created label: ` + JSON.stringify(params));
            label_get(this.lastID, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: label_data | null, error?: string) => any} callback 
 */
function label_get(id, callback) {
    db.get(query_getLabel(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of label ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of label ${id}`);
        } else {
            callback({
                id: row.id,
                user_id: row.user_id ? row.user_id : invalid_id,
                name: row.name,
                is_active: row.is_active != 0,
                create_date: dateFormat.from_string(row.create_date)
            });
        }
    });
}
/**
 * @param {number} user_id 
 * @param {(data: label_data[], error?: string) => any} callback 
 */
function label_getAll(user_id, callback) {
    db.all(query_getAllLabels(user_id), (error, rows) => {
        if (error) {
            callback([], `failed to get labels list: ` + error);
        } else {
            /** @type {label_data[]} */
            var data = [];
            for (var i = 0; i < rows.length; i++) {
                data.push({
                    id: rows[i].id,
                    user_id: rows[i].user_id ? rows[i].user_id : invalid_id,
                    name: rows[i].name,
                    is_active: rows[i].is_active != 0,
                    create_date: dateFormat.from_string(rows[i].create_date)
                });
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ name?: string, is_active?: boolean }} params 
 * @param {(data: label_data | null, error?: string) => any} callback 
 */
function label_edit(id, params, callback) {
    db.run(query_updateLabel(id, params), (error) => {
        if (error) {
            callback(null, `failed to update label ${id}: ` + error);
        } else {
            debug_log(`updated label ${id}: ` + JSON.stringify(params));
            label_get(id, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} callback 
 */
function label_delete(id, callback) {
    db.run(query_deleteLabel(id), (error) => {
        if (error) {
            callback(`failed to delete label ${id}: ` + error);
        } else {
            debug_log(`deleted label ${id}`);
            callback();
        }
    });
}

/**
 * @param {{ user_id?: number, parent_id?: number, name: string }} params 
 * @param {(data: category_data | null, error?: string) => any} callback 
 */
function category_create(params, callback) {
    db.run(query_createCategory(params), function(error) {
        if (error) {
            callback(null, `failed to create category (${JSON.stringify(params)}): ` + error);
        } else {
            debug_log(`created category: ` + JSON.stringify(params));
            category_get(this.lastID, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: category_data | null, error?: string) => any} callback 
 */
function category_get(id, callback) {
    db.get(query_getCategory(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of category ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of category ${id}`);
        } else {
            callback({
                id: row.id,
                user_id: row.user_id ? row.user_id : invalid_id,
                parent_id: row.parent_id ? row.parent_id : invalid_id,
                name: row.name,
                is_active: row.is_active != 0,
                create_date: dateFormat.from_string(row.create_date)
            });
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
                data.push({
                    id: rows[i].id,
                    user_id: rows[i].user_id ? rows[i].user_id : invalid_id,
                    parent_id: rows[i].parent_id ? rows[i].parent_id : invalid_id,
                    name: rows[i].name,
                    is_active: rows[i].is_active != 0,
                    create_date: dateFormat.from_string(rows[i].create_date)
                });
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ parent_id?: number, name?: string, is_active?: boolean }} params 
 * @param {(data: category_data | null, error?: string) => any} callback 
 */
function category_edit(id, params, callback) {
    db.run(query_updateCategory(id, params), (error) => {
        if (error) {
            callback(null, `failed to update category ${id}: ` + error);
        } else {
            debug_log(`updated category ${id}: ` + JSON.stringify(params));
            category_get(id, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} callback 
 */
function category_delete(id, callback) {
    db.run(query_deleteCategory(id), (error) => {
        if (error) {
            callback(`failed to delete category ${id}: ` + error);
        } else {
            debug_log(`deleted category ${id}`);
            callback();
        }
    });
}

/**
 * @param {{ user_id: number, currency_code: string, name: string, start_amount?: number }} params 
 * @param {(data: account_data | null, error?: string) => any} callback 
 */
function account_create(params, callback) {
    db.run(query_createAccount(params), function(error) {
        if (error) {
            callback(null, `failed to create account (${JSON.stringify(params)}): ` + error);
        } else {
            debug_log(`created account: ` + JSON.stringify(params));
            account_get(this.lastID, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(data: account_data | null, error?: string) => any} callback 
 */
function account_get(id, callback) {
    db.get(query_getAccount(id), (error, row) => {
        if (error) {
            callback(null, `failed to get data of account ${id}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of account ${id}`);
        } else {
            callback({
                id: row.id,
                user_id: row.user_id,
                currency_code: row.currency_code,
                name: row.name,
                start_amount: row.start_amount,
                is_active: row.is_active != 0,
                create_date: dateFormat.from_string(row.create_date)
            });
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
                data.push({
                    id: rows[i].id,
                    user_id: rows[i].user_id,
                    currency_code: rows[i].currency_code,
                    name: rows[i].name,
                    start_amount: rows[i].start_amount,
                    is_active: rows[i].is_active != 0,
                    create_date: dateFormat.from_string(rows[i].create_date)
                });
            }
            callback(data);
        }
    });
}
/**
 * @param {number} id 
 * @param {{ name?: string, start_amount?: number, is_active?: boolean }} params 
 * @param {(data: account_data | null, error?: string) => any} callback 
 */
function account_edit(id, params, callback) {
    db.run(query_updateAccount(id, params), (error) => {
        if (error) {
            callback(null, `failed to update account ${id}: ` + error);
        } else {
            debug_log(`updated account ${id}: ` + JSON.stringify(params));
            account_get(id, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} callback 
 */
function account_delete(id, callback) {
    db.run(query_deleteAccount(id), (error) => {
        if (error) {
            callback(`failed to delete account ${id}: ` + error);
        } else {
            debug_log(`deleted account ${id}`);
            callback();
        }
    });
}

/**
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date: Date }} params 
 * @param {(data: record_data | null, error?: string) => any} callback 
 */
function record_create(params, callback) {
    db.run(query_createRecord(params), function(error) {
        if (error) {
            callback(null, `failed to create record (${JSON.stringify(params)}): ` + error);
        } else {
            //debug_log(`created record: ` + JSON.stringify(params));
            record_get(this.lastID, callback);
        }
    });
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
            callback({
                id: row.id,
                src_account_id: row.src_account_id ? row.src_account_id : invalid_id,
                src_amount: row.src_amount,
                dst_account_id: row.dst_account_id ? row.dst_account_id : invalid_id,
                dst_amount: row.dst_amount,
                category_id: row.category_id ? row.category_id : invalid_id,
                date: dateFormat.from_string(row.date),
                create_date: dateFormat.from_string(row.create_date)
            });
        }
    });
}
/**
 * 
 * @param {number} id 
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date?: Date }} params 
 * @param {(data: record_data | null, error?: string) => any} callback 
 */
function record_edit(id, params, callback) {
    db.run(query_updateRecord(id, params), (error) => {
        if (error) {
            callback(null, `failed to update record ${id}: ` + error);
        } else {
            //debug_log(`updated record ${id}: ` + JSON.stringify(params));
            record_get(id, callback);
        }
    });
}
/**
 * @param {number} id 
 * @param {(error?: string) => any} callback 
 */
function record_delete(id, callback) {
    db.run(query_deleteRecord(id), (error) => {
        if (error) {
            callback(`failed to delete record ${id}: ` + error);
        } else {
            //debug_log(`deleted record ${id}`);
            callback();
        }
    });
}

/**
 * @param {number} record_id 
 * @param {number} label_id 
 * @param {(error?: string) => any} callback 
 */
function addLabelToRecord(record_id, label_id, callback) {
    db.run(query_createRecordLabel(record_id, label_id), (error) => {
        if (error) {
            callback(`failed to add label ${label_id} to record ${record_id}: ` + error);
        } else {
            //debug_log(`added label ${label_id} to record ${record_id}`);
            callback();
        }
    });
}
/**
 * @param {number} record_id 
 * @param {(label_ids: number[], error?: string) => any} callback 
 */
function getRecordLabels(record_id, callback) {
    db.all(query_getRecordLabels(record_id), (error, rows) => {
        if (error) {
            callback([], `failed to get labels of record ${record_id}: ` + error);
        } else {
            var label_ids = [];
            for (var i = 0; i < rows.length; i++) {
                label_ids.push(rows[i].label_id);
            }
            callback(label_ids);
        }
    });
}
/**
 * @param {number} record_id 
 * @param {number} label_id 
 * @param {(error?: string) => any} callback 
 */
function deleteRecordLabel(record_id, label_id, callback) {
    db.run(query_deleteRecordLabel(record_id, label_id), (error) => {
        if (error) {
            callback(`failed to delete label ${label_id} from record ${record_id}: ` + error);
        } else {
            //debug_log(`deleted label ${label_id} from record ${record_id}`);
            callback();
        }
    });
}
/**
 * @param {number} record_id 
 * @param {(error?: string) => any} callback 
 */
function clearRecordLabels(record_id, callback) {
    db.run(query_deleteRecordLabels(record_id), (error) => {
        if (error) {
            callback(`failed to delete labels from record ${record_id}: ` + error);
        } else {
            //debug_log(`deleted labels from record ${record_id}`);
            callback();
        }
    });
}

/**
 * @param {user_invite_data} data 
 * @param {(error?: string) => any} callback 
 */
function invite_create(data, callback) {
    db.run(query_createInvite(data), (error) => {
        if (error) {
            callback(`failed to create user invite (${JSON.stringify(data)}): ` + error);
        } else {
            debug_log(`created user invite: ` + JSON.stringify(data));
            callback();
        }
    });
}
/**
 * @param {number} userID 
 * @param {(data: user_invite_data | null, error?: string) => any} callback 
 */
function invite_get(userID, callback) {
    db.get(query_getInvite(userID), (error, row) => {
        if (error) {
            callback(null, `can't find invite for user ${userID}: ` + error);
        } else if (!row) {
            callback(null, `can't find data of user ${userID}`);
        } else {
            callback({
                id: row.id,
                inviting_user_id: row.inviting_user_id,
                invite_date: dateFormat.from_string(row.invite_date),
                expire_date: dateFormat.from_string(row.expire_date)
            });
        }
    });
}
/**
 * @param {number} userID 
 * @param {(error?: string) => any} callback 
 */
function invite_delete(userID, callback) {
    db.run(query_deleteInvite(userID), (error) => {
        if (error) {
            callback(`failed to delete invite for user ${userID}: ` + error);
        } else {
            debug_log(`deleted invite for user ${userID}`);
            callback();
        }
    });
}

function query_initialize() {
    return `CREATE TABLE users(id INTEGER PRIMARY KEY NOT NULL, name TEXT, create_date TEXT NOT NULL);
    CREATE TABLE currencies(code TEXT NOT NULL PRIMARY KEY, name TEXT, is_active INTEGER NOT NULL, create_date TEXT NOT NULL);
    CREATE TABLE labels(
        id INTEGER PRIMARY KEY, user_id INTEGER, name TEXT, is_active INTEGER NOT NULL, create_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE TABLE categories(
        id INTEGER PRIMARY KEY, user_id INTEGER, parent_id INTEGER, name TEXT, is_active INTEGER NOT NULL, create_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (parent_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL
    );
    CREATE TABLE accounts(
        id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, currency_code TEXT NOT NULL, name TEXT, start_amount INTEGER NOT NULL, is_active INTEGER NOT NULL, create_date TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (currency_code) REFERENCES currencies(code) ON UPDATE CASCADE ON DELETE CASCADE
    );
    CREATE TABLE records(
        id INTEGER PRIMARY KEY, src_account_id INTEGER, src_amount INTEGER NOT NULL, dst_account_id INTEGER, dst_amount INTEGER NOT NULL, category_id INTEGER, date TEXT NOT NULL, create_date TEXT NOT NULL,
        FOREIGN KEY (src_account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
        FOREIGN KEY (dst_account_id) REFERENCES accounts(id) ON UPDATE CASCADE ON DELETE SET NULL,
        FOREIGN KEY (category_id) REFERENCES categories(id) ON UPDATE CASCADE ON DELETE SET NULL
    );
    CREATE TABLE record_labels(
        record_id INTEGER NOT NULL, label_id INTEGER NOT NULL, create_date TEXT NOT NULL,
        FOREIGN KEY (record_id) REFERENCES records(id) ON UPDATE CASCADE ON DELETE CASCADE,
        FOREIGN KEY (label_id) REFERENCES labels(id) ON UPDATE CASCADE ON DELETE CASCADE,
        PRIMARY KEY (record_id, label_id)
    );
    CREATE TABLE user_invites(
        id INTEGER PRIMARY KEY NOT NULL, inviting_user_id INTEGER NOT NULL, invite_date TEXT NOT NULL, expire_date TEXT NOT NULL,
        FOREIGN KEY (inviting_user_id) REFERENCES users(id) ON UPDATE CASCADE ON DELETE CASCADE
    );`;
}
function query_getAllUsers() {
    return `SELECT * FROM users;`;
}
function query_getAllCurrencies() {
    return `SELECT * FROM currencies;`;
}
/**
 * @param {number} user_id 
 */
function query_getAllLabels(user_id) {
    if (user_id == invalid_id) {
        return `SELECT * FROM labels;`;
    }
    return `SELECT * FROM labels WHERE user_id = NULL OR user_id = ${user_id};`;
}
/**
 * @param {number} user_id
 */
function query_getAllCategories(user_id) {
    if (user_id == invalid_id) {
        return `SELECT * FROM categories;`;
    }
    return `SELECT * FROM categories WHERE user_id = NULL OR user_id = ${user_id};`;
}
/**
 * @param {number} user_id
 */
function query_getAllAccounts(user_id) {
    if (user_id == invalid_id) {
        return `SELECT * FROM accounts;`;
    }
    return `SELECT * FROM accounts WHERE user_id = NULL OR user_id = ${user_id};`;
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

/**
 * @param {{ id: number, name: string }} params
 */
function query_createUser(params) {
    return `INSERT INTO users(id, name, create_date) VALUES (${params.id}, '${params.name}', '${dateFormat.to_string(new Date())}');`;
}
/**
 * @param {number} id
 */
function query_getUser(id) {
    return `SELECT * FROM users WHERE id = ${id} LIMIT 1;`;
}

/**
 * @param {{ code: string, name: string }} params 
 */
function query_createCurrency(params) {
    return `INSERT INTO currencies(code, name, is_active, create_date) VALUES ('${params.code}', '${params.name}', 1, '${dateFormat.to_string(new Date())}');`;
}
/**
 * @param {string} code 
 */
function query_getCurrency(code) {
    return `SELECT * FROM currencies WHERE code = '${code}' LIMIT 1;`;
}
/**
 * @param {string} code 
 * @param {{ name?: string, is_active?: boolean }} params 
 */
function query_updateCurrency(code, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('name')) {
        statements.push(`name = '${params.name}'`);
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
    }
    return `UPDATE currencies SET ${statements.join(', ')} WHERE code = '${code}';`;
}
/**
 * @param {string} code 
 */
function query_deleteCurrency(code) {
    return `DELETE FROM currencies WHERE code = '${code}';`;
}

/**
 * @param {{ user_id?: number, name: string }} params 
 */
function query_createLabel(params) {
    return `INSERT INTO labels(user_id, name, is_active, create_date) VALUES (
        ${params.user_id ? params.user_id : 'NULL'}, '${params.name}', 1, '${dateFormat.to_string(new Date())}'
    );`;
}
/**
 * @param {number} id 
 */
function query_getLabel(id) {
    return `SELECT * FROM labels WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} id 
 * @param {{ name?: string, is_active?: boolean }} params 
 */
function query_updateLabel(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('name')) {
        statements.push(`name = '${params.name}'`);
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
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
 * @param {{ user_id?: number, parent_id?: number, name: string }} params
 */
function query_createCategory(params) {
    return `INSERT INTO categories(user_id, parent_id, name, is_active, create_date) VALUES (
        ${params.user_id ? params.user_id : 'NULL'}, ${params.parent_id ? params.parent_id : 'NULL'}, '${params.name}', 1, '${dateFormat.to_string(new Date())}'
    );`;
}
/**
 * @param {number} id 
 */
function query_getCategory(id) {
    return `SELECT * FROM categories WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} id 
 * @param {{ parent_id?: number, name?: string, is_active?: boolean }} params 
 */
function query_updateCategory(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('parent_id')) {
        statements.push(`parent_id = ${params.parent_id ? params.parent_id : 'NULL'}`);
    }
    if (properties.includes('name')) {
        statements.push(`name = '${params.name}'`);
    }
    if (properties.includes('is_active')) {
        statements.push(`is_active = ${params.is_active ? 1 : 0}`);
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
 * @param {{ user_id: number, currency_code: string, name: string, start_amount?: number }} params 
 */
function query_createAccount(params) {
    return `INSERT INTO accounts(user_id, currency_code, name, start_amount, is_active, create_date) VALUES (
        ${params.user_id}, '${params.currency_code}', '${params.name}', ${params.start_amount ? params.start_amount : 0}, 1, '${dateFormat.to_string(new Date())}'
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
 * @param {{ name?: string, start_amount?: number, is_active?: boolean }} params 
 */
function query_updateAccount(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('name')) {
        statements.push(`name = '${params.name}'`);
    }
    if (properties.includes('start_amount')) {
        statements.push(`start_amount = ${params.start_amount ? params.start_amount : 0}`);
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
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date: Date }} params
 */
function query_createRecord(params) {
    return `INSERT INTO records(src_account_id, src_amount, dst_account_id, dst_amount, category_id, date, create_date) VALUES (
        ${params.src_account_id ? params.src_account_id : 'NULL'}, ${params.src_amount ? params.src_amount : 0},
        ${params.dst_account_id ? params.dst_account_id : 'NULL'}, ${params.dst_amount ? params.dst_amount : 0},
        ${params.category_id ? params.category_id : 'NULL'}, '${dateFormat.to_string(params.date)}', '${dateFormat.to_string(new Date())}'
    );`;
}
/**
 * @param {number} id 
 */
function query_getRecord(id) {
    return `SELECT * FROM records WHERE id = ${id} LIMIT 1;`;
}
/**
 * @param {number} id 
 * @param {{ src_account_id?: number, src_amount?: number, dst_account_id?: number, dst_amount?: number, category_id?: number, date?: Date }} params 
 */
function query_updateRecord(id, params) {
    var statements = [];
    const properties = Object.getOwnPropertyNames(params);
    if (properties.includes('src_account_id')) {
        statements.push(`src_account_id = ${params.src_account_id ? params.src_account_id : 'NULL'}`);
    }
    if (properties.includes('src_amount')) {
        statements.push(`src_amount = ${params.src_amount ? params.src_amount : 0}`);
    }
    if (properties.includes('dst_account_id')) {
        statements.push(`dst_account_id = ${params.dst_account_id ? params.dst_account_id : 'NULL'}`);
    }
    if (properties.includes('dst_amount')) {
        statements.push(`dst_amount = ${params.dst_amount ? params.dst_amount : 0}`);
    }
    if (properties.includes('category_id')) {
        statements.push(`category_id = ${params.category_id ? params.category_id : 'NULL'}`);
    }
    if (properties.includes('date')) {
        statements.push(`date = '${dateFormat.to_string(params.date)}'`);
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
 * @param {number} record_id 
 * @param {number} label_id 
 */
function query_createRecordLabel(record_id, label_id) {
    return `INSERT INTO record_labels(record_id, label_id, create_date) VALUES (${record_id}, ${label_id}, '${dateFormat.to_string(new Date())}');`;
}
/**
 * @param {number} record_id 
 */
function query_getRecordLabels(record_id) {
    return `SELECT label_id, create_date FROM record_labels WHERE record_id = ${record_id};`;
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
    return `INSERT INTO user_invites(id, inviting_user_id, invite_date, expire_date) VALUES (${params.id}, ${params.inviting_user_id}, '${dateFormat.to_string(params.invite_date)}', '${dateFormat.to_string(params.expire_date)}');`;
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
