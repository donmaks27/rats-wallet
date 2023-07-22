// @ts-check

var fs = require('fs');

var dateFormat = require('./date-format');

const log_filename = 'debug.log';
var log_stream = fs.createWriteStream(log_filename, {
    flags: 'a',
    encoding: 'utf8'
});

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
    log_stream.write(str + '\n');
    if (log_to_screen) {
        console.log(str);
    }
}