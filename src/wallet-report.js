// @ts-check

var fs = require('fs');

var log = require('./log');
var db = require('./database');

const report_filepath = 'data/report.csv';

/**
 * @typedef {{ currencies: string[], labels: label_data[], categories: category_data[], accounts: account_data[], records: record_data[] }} full_data
 * @typedef {{ name: string, global: boolean }} label_data
 * @typedef {{ name: string, parent: string, global: boolean }} category_data
 * @typedef {{ currency: string, name: string, start_amount: number, archived: boolean }} account_data
 * @typedef {{ src_account?: string, src_amount?: number, dst_account?: string, dst_amount?: number, category?: string, note: string, date: string, labels: string[] }} record_data
 */

module.exports.load = load_report;
module.exports.apply = apply_report;

/**
 * @param {(data: full_data | null, error?: string) => any} callback 
 */
function load_report(callback) {
    fs.readFile(report_filepath, {
        encoding: 'utf8'
    }, (error, data) => {
        if (error) {
            callback(null, `failed to read report file "${report_filepath}": ` + error);
        } else {
            callback(parse_report_data(data));
        }
    });
}
/**
 * @param {string} data 
 * @returns {full_data}
 */
function parse_report_data(data) {
    const dataLines = data.split('\n');
    const header = dataLines[0].split(';');
    /** @type {string[][]} */
    var recordsTable = [];
    var recordsTableRowLine = '';
    for (var i = 1; i < dataLines.length; i++) {
        recordsTableRowLine += dataLines[i];
        var matchResults = recordsTableRowLine.match(/"/g);
        if (matchResults && (matchResults.length % 2 != 0)) {
            recordsTableRowLine += '\n';
        } else {
            if (recordsTableRowLine.includes(';')) {
                var tableRow = [];
                for (var i1 = 0; i1 < header.length; i1++) {
                    var startIndex = 0, endIndex = 0, nextIndex = 0;
                    if (recordsTableRowLine[0] == '"') {
                        startIndex = 1;
                        endIndex = recordsTableRowLine.indexOf('"', startIndex);
                        nextIndex = endIndex + 1;
                    } else {
                        startIndex = 0;
                        endIndex = recordsTableRowLine.indexOf(';');
                        nextIndex = endIndex;
                    }
                    tableRow.push(recordsTableRowLine.substring(startIndex, endIndex));
                    recordsTableRowLine = recordsTableRowLine.substring(nextIndex + 1);
                }
                recordsTable.push(tableRow);
            }
            recordsTableRowLine = '';
        }
    }
    
    const columns = {
        account: header.indexOf('account'),
        category: header.indexOf('category'),
        currency: header.indexOf('currency'),
        amount: header.indexOf('amount'),
        refAmount: header.indexOf('ref_currency_amount'),
        type: header.indexOf('type'),
        method: header.indexOf('payment_type'),
        note: header.indexOf('note'),
        date: header.indexOf('date'),
        transfer: header.indexOf('transfer'),
        labels: header.indexOf('labels')
    };
    /** @type {full_data} */
    var result = { currencies: [], labels: [], categories: [], accounts: [], records: [] };
    var markedRecords = [];
    for (var recordIndex = 0; recordIndex < recordsTable.length; recordIndex++) {
        const record = recordsTable[recordIndex];

        if (!result.currencies.includes(record[columns.currency])) {
            result.currencies.push(record[columns.currency]);
        }
        if (result.accounts.findIndex( v => v.name == record[columns.account] ) == -1) {
            result.accounts.push({
                name: record[columns.account],
                currency: record[columns.currency],
                start_amount: 0,
                archived: false
            });
        }
        if (result.categories.findIndex(v => v.name == record[columns.category]) == -1) {
            result.categories.push({
                name: record[columns.category],
                parent: '',
                global: false
            });
        }
        const recordLabels = record[columns.labels].length > 0 ? record[columns.labels].split('|') : [];
        for (var labelIndex = 0; labelIndex < recordLabels.length; labelIndex++) {
            if (result.labels.findIndex(v => v.name == recordLabels[labelIndex]) == -1) {
                result.labels.push({
                    name: recordLabels[labelIndex],
                    global: false
                });
            }
        }

        if (markedRecords.includes(recordIndex)) {
            continue;
        }
        markedRecords.push(recordIndex);

        /** @type {record_data} */
        var newRecord = {
            labels: recordLabels,
            note: record[columns.note],
            date: parseDate(record[columns.date]).toString()
        };
        if (record[columns.type] == 'Expenses') {
            newRecord.src_account = record[columns.account];
            newRecord.src_amount = -parseAmount(record[columns.amount]);
        } else {
            newRecord.dst_account = record[columns.account];
            newRecord.dst_amount = parseAmount(record[columns.amount]);
        }
        if (record[columns.transfer] != 'true') {
            newRecord.category = record[columns.category];
        } else {
            const pairRecordIndex = recordsTable.findIndex((v, i) => {
                return !markedRecords.includes(i) && (v[columns.transfer] == 'true') && (v[columns.type] != record[columns.type])
                    && (v[columns.date] == record[columns.date]) && (v[columns.method] == record[columns.method])
                    && (Number.parseFloat(v[columns.refAmount]) == -Number.parseFloat(record[columns.refAmount]));
            });
            if (pairRecordIndex != -1) {
                markedRecords.push(pairRecordIndex);
                const pairRecord = recordsTable[pairRecordIndex];
                if (record[columns.type] == 'Expenses') {
                    newRecord.dst_account = pairRecord[columns.account];
                    newRecord.dst_amount = parseAmount(pairRecord[columns.amount]);
                } else {
                    newRecord.src_account = pairRecord[columns.account];
                    newRecord.src_amount = -parseAmount(pairRecord[columns.amount]);
                }
            }
        }
        result.records.push(newRecord);
    }
    return result;
}
function parseAmount(str) {
    return Math.round(Number.parseFloat(str) * 100) / 100;
}
function parseDate(str) {
    var result = new Date();
    result.setUTCFullYear(
        Number.parseInt(str.substring(0, 4)),
        Number.parseInt(str.substring(5, 7)) - 1,
        Number.parseInt(str.substring(8, 10))
    );
    result.setUTCHours(
        Number.parseInt(str.substring(11, 13)),
        Number.parseInt(str.substring(14, 16)),
        Number.parseInt(str.substring(17, 19))
    );
    return result;
}

var tasks_queue = {
    /** @type {((callback: (error?: string) => any) => void)[]} */
    queue: [],
    /**
     * @param {(callback: (error?: string) => any) => void} task 
     */
    add: function(task) {
        this.queue.push(task);
        return this;
    },
    /**
     * @param {(error?: string) => any} callback 
     */
    run: function(callback) {
        var resultCallback = (error) => {
            tasks_queue.queue = [];
            callback(error);
        }
        var runNextTaskFromTaskQueue = () => {
            if (tasks_queue.queue.length > 0) {
                let task = tasks_queue.queue.splice(0, 1)[0];
                task((error) => {
                    if (error) {
                        resultCallback(error);
                    } else {
                        runNextTaskFromTaskQueue();
                    }
                });
            } else {
                resultCallback();
            }
        };
        runNextTaskFromTaskQueue();
    }
};

/**
 * @typedef {{ labels: db.label_data[], categories: db.category_data[], accounts: db.account_data[] }} report_db_data
 */

/**
 * @param {number} user_id 
 * @param {full_data} data 
 * @param {(error?: string) => any} callback 
 */
function apply_report(user_id, data, callback) {
    /** @type {report_db_data} */
    var db_data = { labels: [], categories: [], accounts: [] };
    tasks_queue.add(task_checkUserExists(user_id));
    for (var i = 0; i < data.currencies.length; i++) {
        tasks_queue.add(task_addCurrency(data.currencies[i]));
    }
    for (var i = 0; i < data.labels.length; i++) {
        tasks_queue.add(task_addLabel(user_id, data.labels[i], db_data));
    }
    for (var i = 0; i < data.categories.length; i++) {
        tasks_queue.add(task_addCategory(user_id, data.categories[i], db_data));
    }
    for (var i = 0; i < data.accounts.length; i++) {
        tasks_queue.add(task_addAccount(user_id, data.accounts[i], db_data));
    }
    for (var i = 0; i < data.records.length; i++) {
        tasks_queue.add(task_addRecord(data.records[i], db_data));
    }
    tasks_queue.run(callback);
}
/**
 * @param {number} user_id
 */
function task_checkUserExists(user_id) {
    return (callback) => {
        db.user_get(user_id, (data, error) => {
            if (error) {
                callback(`failed to get user ${user_id}: ` + error);
            } else {
                callback();
            }
        });
    };
}
/**
 * @param {string} currency_code
 */
function task_addCurrency(currency_code) {
    return (callback) => {
        db.currency_create({
            code: currency_code,
            name: ''
        }, (data, error) => {
            callback(error);
        });
    };
}
/**
 * @param {number} user_id 
 * @param {label_data} label 
 * @param {report_db_data} db_data 
 */
function task_addLabel(user_id, label, db_data) {
    return (callback) => {
        if (label.name.includes("'")) {
            label.name = label.name.replace("'", "''");
        }
        var params = { name: label.name };
        if (!label.global) {
            params.user_id = user_id;
        }
        db.label_create(params, (data, error) => {
            if (error) {
                callback(error);
            } else if (data) {
                db_data.labels.push(data);
                callback();
            }
        });
    };
}
/**
 * @param {number} user_id 
 * @param {category_data} category 
 * @param {report_db_data} db_data 
 */
function task_addCategory(user_id, category, db_data) {
    return (callback) => {
        var params = { name: category.name };
        if (!category.global) {
            params.user_id = user_id;
        }
        const parentIndex = db_data.categories.findIndex(v => v.name == category.parent);
        if (parentIndex != -1) {
            params.parent_id = db_data.categories[parentIndex].id;
        }
        db.category_create(params, (data, error) => {
            if (error) {
                callback(error);
            } else if (data) {
                db_data.categories.push(data);
                callback();
            }
        });
    };
}
/**
 * @param {number} user_id 
 * @param {account_data} account 
 * @param {report_db_data} db_data 
 */
function task_addAccount(user_id, account, db_data) {
    return (callback) => {
        db.account_create({
            name: account.name,
            user_id: user_id,
            currency_code: account.currency,
            start_amount: account.start_amount * 100
        }, (data, error) => {
            if (error) {
                callback(error);
            } else if (data) {
                db_data.accounts.push(data);
                callback();
            }
        });
    };
}
/**
 * @param {record_data} record 
 * @param {report_db_data} db_data 
 */
function task_addRecord(record, db_data) {
    return (callback) => {
        const srcAccountIndex = record.src_account ? db_data.accounts.findIndex(v => v.name == record.src_account) : -1;
        const dstAccountIndex = record.dst_account ? db_data.accounts.findIndex(v => v.name == record.dst_account) : -1;
        const categoryIndex = db_data.categories.findIndex(v => v.name == record.category);
        var params = { date: new Date(record.date) };
        if (srcAccountIndex != -1) {
            params.src_account_id = db_data.accounts[srcAccountIndex].id;
            params.src_amount = record.src_amount ? record.src_amount * 100 : 0;
        }
        if (dstAccountIndex != -1) {
            params.dst_account_id = db_data.accounts[dstAccountIndex].id;
            params.dst_amount = record.dst_amount ? record.dst_amount * 100 : 0;
        }
        if (categoryIndex != -1) {
            params.category_id = db_data.categories[categoryIndex].id
        }
        db.record_create(params, (data, error) => {
            if (error) {
                callback(error);
            } else if (data) {
                for (var i = 0; i < record.labels.length; i++) {
                    const labelIndex = db_data.labels.findIndex(v => v.name == record.labels[i]);
                    if (labelIndex != -1) {
                        tasks_queue.add(task_addRecordLabel(data.id, db_data.labels[labelIndex].id));
                    }
                }
                callback();
            }
        });
    };
}
/**
 * @param {number} record_id 
 * @param {number} label_id 
 */
function task_addRecordLabel(record_id, label_id) {
    return (callback) => {
        db.addLabelToRecord(record_id, label_id, (error) => {
            if (error) {
                callback(error);
            } else {
                callback();
            }
        });
    };
}