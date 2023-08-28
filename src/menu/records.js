// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
var dateFormat = require('../date-format');
var menuBase = require('./wallet-menu-base');
var walletCommon = require('../wallet-common');

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
        records: createMenuData_records
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_records(user, userData, args, callback) {
    const userID = user.id;
    const pageSize = 10;
    const page = typeof args.page === 'number' ? args.page : 0;
    db.record_getAmount(userID, (recordsAmount, error) => {
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
        db.record_getList(userID, pageSize, page, (records, error) => {
            if (error) {
                log.error(userID, `[records] failed to get records list (${error})`);
            }
            var messageText = '*Records*\n\n';
            for (var i = 0; i < records.length; i++) {
                const record = records[i];

                if (i < 9) {
                    messageText += `\`${bot.escapeMarkdown(`${i+1}.`)} \``;
                } else {
                    messageText += `\`${bot.escapeMarkdown(`${i+1}.`)}\``;
                }

                if (record.src_account && record.dst_account) {
                    messageText += `${walletCommon.getColorMarker(record.src_account.color, ' ')}${bot.escapeMarkdown(record.src_account.name)} ➤ `;
                    messageText += `${walletCommon.getColorMarker(record.dst_account.color, ' ')}${bot.escapeMarkdown(record.dst_account.name)}\n`;
                    if ((record.src_amount != record.dst_amount) || (record.src_account.currency_code != record.dst_account.currency_code)) {
                        const src_symbol = record.src_currency?.symbol ? record.src_currency.symbol : record.src_account.currency_code;
                        const dst_symbol = record.dst_currency?.symbol ? record.dst_currency.symbol : record.dst_account.currency_code;
                        messageText += `\`   \`*${bot.escapeMarkdown(`${record.src_amount / 100} ${src_symbol}`)}* ➤ *${bot.escapeMarkdown(`${record.dst_amount / 100} ${dst_symbol}`)}*\n`;
                    } else {
                        const symbol = record.src_currency?.symbol ? record.src_currency.symbol : record.src_account.currency_code;
                        messageText += `\`   \`*${bot.escapeMarkdown(`${record.src_amount / 100} ${symbol}`)}*\n`;
                    }
                } else if (record.src_account) {
                    messageText += `${walletCommon.getColorMarker(record.src_account.color, ' ')}${bot.escapeMarkdown(record.src_account.name)}\n`;
                    const symbol = record.src_currency?.symbol ? record.src_currency.symbol : record.src_account.currency_code;
                    messageText += `\`   \`*${bot.escapeMarkdown(`-${record.src_amount / 100} ${symbol}`)}*\n`;
                } else if (record.dst_account) {
                    messageText += `${walletCommon.getColorMarker(record.dst_account.color, ' ')}${bot.escapeMarkdown(record.dst_account.name)}\n`;
                    const symbol = record.dst_currency?.symbol ? record.dst_currency.symbol : record.dst_account.currency_code;
                    messageText += `\`   \`*${bot.escapeMarkdown(`+${record.dst_amount / 100} ${symbol}`)}*\n`;
                }

                if (record.category) {
                    messageText += `\`   \`_Category_: ${walletCommon.getColorMarkerCircle(record.category.color, ' ')}${bot.escapeMarkdown(record.category.name)}\n`;
                }

                if (record.labels.length > 0) {
                    var labelsNames = [];
                    for (var j = 0; j < record.labels.length; j++) {
                        labelsNames.push(`${walletCommon.getColorMarkerCircle(record.labels[j].color, ' ')}${bot.escapeMarkdown(record.labels[j].name)}`);
                    }
                    messageText += `\`   \`_Labels_: ${labelsNames.join(', ')}\n`;
                }

                messageText += `\`   \`_Date_: ${bot.escapeMarkdown(dateFormat.to_string(record.date))}\n`;
            }
            messageText += `\nChoose what you want to do:`
            const dummyButton = { text: ` `, callback_data: menuBase.makeDummyButton() };
            /** @type {bot.keyboard_button_inline_data[]} */
            var controlButtons = [
                page > 1 ? { 
                    text: `<< 1`, 
                    callback_data: menuBase.makeMenuButton('records', { page: 0 }) 
                } : dummyButton,
                page > 0 ? { 
                    text: `< ${page}`, 
                    callback_data: menuBase.makeMenuButton('records', { page: page - 1 }) 
                } : dummyButton,
                { 
                    text: `${page + 1}`, 
                    callback_data: menuBase.makeActionButton('changeRecordsPage', { page: page, maxPage: pagesCount })
                },
                page < pagesCount - 1 ? { 
                    text: `${page + 2} >`, 
                    callback_data: menuBase.makeMenuButton('records', { page: page + 1 }) 
                } : dummyButton,
                page < pagesCount - 2 ? { 
                    text: `${pagesCount} >>`, 
                    callback_data: menuBase.makeMenuButton('records', { page: pagesCount - 1 }) 
                } : dummyButton
            ];
            // TODO: Add buttons for every record
            callback({
                text: messageText, 
                parseMode: 'MarkdownV2',
                keyboard: [ controlButtons, [
                    {
                        text: '<< Back to Wallet',
                        callback_data: menuBase.makeMenuButton('wallet')
                    }
                ]]
            });
        });
    });
}