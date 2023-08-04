// @ts-check

var fs = require('fs');

var dateFormat = require('./date-format');

var logFileDate = new Date(0);
/** @type {fs.WriteStream | null} */
var logFileStream = null;

module.exports.error = log_error;
module.exports.warning = log_warn;
module.exports.info = log_info;

/**
 * @param {string} msg
 * @param {boolean} [logToScreen]
 */
function log_error(msg, logToScreen) {
    log_msg('[ERR]  ' + msg, typeof logToScreen !== 'undefined' ? logToScreen : true);
}
/**
 * @param {string} msg 
 * @param {boolean} [logToScreen]
 */
function log_warn(msg, logToScreen) {
    log_msg('[WARN] ' + msg, logToScreen);
}
/**
 * @param {string} msg 
 * @param {boolean} [logToScreen]
 */
function log_info(msg, logToScreen) {
    log_msg('[INFO] ' + msg, logToScreen);
}
/**
 * @param {string} msg
 * @param {boolean} [log_to_screen]
 */
function log_msg(msg, log_to_screen) {
    const str = `[${dateFormat.to_string(new Date())}] ${msg}`;
    getLogFileStream().write(str + '\n');
    if (log_to_screen) {
        console.log(str);
    }
}

/**
 * @returns {fs.WriteStream}
 */
function getLogFileStream() {
    var currentDate = new Date();
    currentDate.setUTCHours(0, 0, 0, 0);
    if (logFileStream && (currentDate > logFileDate)) {
        logFileStream.close();
        logFileStream = null;
    }

    if (logFileStream) {
        return logFileStream;
    }
    logFileDate = currentDate;
    if (!fs.existsSync(`log/`)) {
        fs.mkdirSync(`log`);
    }
    logFileStream = fs.createWriteStream(`log/debug_${dateFormat.to_string_short(logFileDate)}.log`, {
        flags: 'a',
        encoding: 'utf-8' 
    });
    return logFileStream;
}