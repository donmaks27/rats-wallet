// @ts-check

module.exports.duration_to_string = duration_to_string;
module.exports.to_string = date_to_string;
module.exports.to_string_short = date_to_string_short;
module.exports.from_string = string_to_date;

/**
 * @param {Date} [date] 
 * @returns {string}
 */
function date_to_string(date) {
    if (!date) {
        return date_to_string(new Date(0));
    }
    const month   = date.getUTCMonth() >= 9    ? (date.getUTCMonth() + 1) : '0' + (date.getUTCMonth() + 1);
    const day     = date.getUTCDate() >= 10    ? date.getUTCDate()        : '0' + date.getUTCDate();
    const hours   = date.getUTCHours() >= 10   ? date.getUTCHours()       : '0' + date.getUTCHours();
    const minutes = date.getUTCMinutes() >= 10 ? date.getUTCMinutes()     : '0' + date.getUTCMinutes();
    const seconds = date.getUTCSeconds() >= 10 ? date.getUTCSeconds()     : '0' + date.getUTCSeconds();
    const milliseconds = date.getUTCMilliseconds() >= 100 ? date.getUTCMilliseconds() : 
        date.getUTCMilliseconds() >= 10 ? '0' + date.getUTCMilliseconds() : '00' + date.getUTCMilliseconds();
    return `${date.getUTCFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}/**
 * @param {Date} [date] 
 * @returns {string}
 */
function date_to_string_short(date) {
    if (!date) {
        return date_to_string_short(new Date(0));
    }
    const month   = date.getUTCMonth() >= 9    ? (date.getUTCMonth() + 1) : '0' + (date.getUTCMonth() + 1);
    const day     = date.getUTCDate() >= 10    ? date.getUTCDate()        : '0' + date.getUTCDate();
    return `${date.getUTCFullYear()}-${month}-${day}`;
}

/**
 * @param {string} str 
 * @returns {Date}
 */
function string_to_date(str) {
    if (str.match(/^[0-9]{4}-(0[0-9]|1[0-2])-([0-2][0-9]|3[0-1]) ([0-1][0-9]|2[0-3]):[0-5][0-9]:[0-5][0-9]\.[0-9]{3}$/g) == null) {
        return new Date(0);
    }
    var result = new Date();
    result.setUTCFullYear(
        Number.parseInt(str.substring(0, 4)),
        Number.parseInt(str.substring(5, 7)) - 1,
        Number.parseInt(str.substring(8, 10))
    );
    result.setUTCHours(
        Number.parseInt(str.substring(11, 13)),
        Number.parseInt(str.substring(14, 16)),
        Number.parseInt(str.substring(17, 19)),
        Number.parseInt(str.substring(20))
    );
    return result;
}

/**
 * @param {number} duration 
 * @param {boolean} [allComponents] 
 * @returns {string}
 */
function duration_to_string(duration, allComponents) {
    const SecondDuration = 1000;
    const MinuteDuration = SecondDuration * 60;
    const HourDuration = MinuteDuration * 60;
    const DayDuration = HourDuration * 24;
    var days = 0, hours = 0, minutes = 0, seconds = 0, milliseconds = 0;
    while (duration >= DayDuration) {
        days++;
        duration -= DayDuration;
    }
    while (duration >= HourDuration) {
        hours++;
        duration -= HourDuration;
    }
    while (duration >= MinuteDuration) {
        minutes++;
        duration -= MinuteDuration;
    }
    while (duration >= SecondDuration) {
        seconds++;
        duration -= SecondDuration;
    }
    milliseconds = duration;
    /** @type {string[]} */
    var result = [];
    if ((days > 0) || allComponents) {
        result.push(`${days}d`);
    }
    if ((hours > 0) || allComponents) {
        result.push(`${hours}h`);
    }
    if ((minutes > 0) || allComponents) {
        result.push(`${minutes}m`);
    }
    if ((seconds > 0) || allComponents) {
        result.push(`${seconds}s`);
    }
    if (allComponents) {
        result.push(`${milliseconds}ms`);
    }
    return result.join(' ');
}