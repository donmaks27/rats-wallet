// @ts-check

module.exports.duration_to_string = duration_to_string;
module.exports.to_string = date_to_string;
module.exports.to_readable_string = date_to_readable_string;
module.exports.to_string_short = date_to_string_short;
module.exports.from_string = string_to_date;

module.exports.timezone_offset = getTimezoneOffset;
module.exports.timezone_date = getTimezoneDate;
module.exports.utc_date = getUTCDate;

/**
 * @param {Date | null} [date] 
 * @param {string | null} [timezone]
 * @returns {string}
 */
function date_to_string(date, timezone) {
    if (!date) {
        return date_to_string(new Date(0), timezone);
    }
    const timezoneDate = timezone !== undefined ? getTimezoneDate(date, timezone) : date;
    const month   = timezoneDate.getUTCMonth() >= 9    ? (timezoneDate.getUTCMonth() + 1) : '0' + (timezoneDate.getUTCMonth() + 1);
    const day     = timezoneDate.getUTCDate() >= 10    ?  timezoneDate.getUTCDate()       : '0' +  timezoneDate.getUTCDate();
    const hours   = timezoneDate.getUTCHours() >= 10   ?  timezoneDate.getUTCHours()      : '0' +  timezoneDate.getUTCHours();
    const minutes = timezoneDate.getUTCMinutes() >= 10 ?  timezoneDate.getUTCMinutes()    : '0' +  timezoneDate.getUTCMinutes();
    const seconds = timezoneDate.getUTCSeconds() >= 10 ?  timezoneDate.getUTCSeconds()    : '0' +  timezoneDate.getUTCSeconds();
    const milliseconds = timezoneDate.getUTCMilliseconds() >= 100 ? timezoneDate.getUTCMilliseconds() : 
        timezoneDate.getUTCMilliseconds() >= 10 ? '0' + timezoneDate.getUTCMilliseconds() : '00' + timezoneDate.getUTCMilliseconds();
    return `${timezoneDate.getUTCFullYear()}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`;
}
/**
 * @param {Date} [date] 
 * @param {{ timezone?: string | null, date?: boolean, time?: boolean }} [params] 
 * @returns {string}
 */
function date_to_readable_string(date, params) {
    if (!date) {
        return date_to_readable_string(new Date(0), params);
    }
    const timezoneDate = params && (params.timezone !== undefined) ? getTimezoneDate(date, params.timezone) : date;
    var result = '';
    if (!params || params.date) {
        const month = timezoneDate.getUTCMonth() >= 9 ? (timezoneDate.getUTCMonth() + 1) : '0' + (timezoneDate.getUTCMonth() + 1);
        const day   = timezoneDate.getUTCDate() >= 10 ?  timezoneDate.getUTCDate()       : '0' +  timezoneDate.getUTCDate();
        result += `${day}-${month}-${timezoneDate.getUTCFullYear()}`;
    }
    if (!params || params.time) {
        const hours   = timezoneDate.getUTCHours() >= 10   ? timezoneDate.getUTCHours()   : '0' + timezoneDate.getUTCHours();
        const minutes = timezoneDate.getUTCMinutes() >= 10 ? timezoneDate.getUTCMinutes() : '0' + timezoneDate.getUTCMinutes();
        if (result.length != 0) {
            result += ' ';
        }
        result += `${hours}:${minutes}`;
    }
    return result;
}
/**
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

/**
 * @param {string | null} [timezone] 
 */
function getTimezoneOffset(timezone) {
    if (!timezone) {
        return 0;
    }
    var date = new Date();
    date.setUTCMilliseconds(0);
    const utcDate = date.toLocaleString('en-US', { timeZone: 'UTC' });
    const timezoneDate = date.toLocaleString('en-US', { timeZone: timezone });
    return (new Date(timezoneDate)).valueOf() - (new Date(utcDate)).valueOf()
}
/**
 * @param {Date} date
 * @param {string | null} [timezone] 
 */
function getTimezoneDate(date, timezone) {
    return new Date(date.valueOf() + getTimezoneOffset(timezone));
}
/**
 * @param {Date} date
 * @param {string | null} [timezone] 
 */
function getUTCDate(date, timezone) {
    return new Date(date.valueOf() - getTimezoneOffset(timezone));
}