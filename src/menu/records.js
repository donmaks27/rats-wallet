// @ts-check

var db  = require('../database');
var bot = require('../telegram-bot');
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
            var messageTextHTML = `<b>Records</b><br /><table>`;
            for (var i = 0; i < records.length; i++) {
                const record = records[i];
                
                var descriptionStrings = [];
                var amountString = '';
                if (record.src_account && record.dst_account) {
                    descriptionStrings.push(`${walletCommon.getColorMarker(record.src_account.color, ' ')}${record.src_account.name} ➤ ` +
                                            `${walletCommon.getColorMarker(record.dst_account.color, ' ')}${record.dst_account.name}`);
                    amountString = `${record.src_amount / 100}`;
                    // TODO: Add both src and dst amount
                    // TODO: Add currency symbol
                } else if (record.src_account) {
                    descriptionStrings.push(`${walletCommon.getColorMarker(record.src_account.color, ' ')}${record.src_account.name}`);
                    amountString = `-${record.src_amount / 100}`;
                } else if (record.dst_account) {
                    descriptionStrings.push(`${walletCommon.getColorMarker(record.dst_account.color, ' ')}${record.dst_account.name}`);
                    amountString = `+${record.dst_amount / 100}`;
                }

                if (record.category) {
                    descriptionStrings.push(`<i>Category:</i> ${walletCommon.getColorMarkerCircle(record.category.color, ' ')}${record.category.name}`);
                }

                if (record.labels.length > 0) {
                    var labelsNames = [];
                    for (var j = 0; j < record.labels.length; j++) {
                        labelsNames.push(`${walletCommon.getColorMarkerCircle(record.labels[j].color, ' ')}<i>${record.labels[j].name}</i>`);
                    }
                    descriptionStrings.push(`<i>Labels:</i> ${labelsNames.join(', ')}`);
                }

                messageTextHTML += `<tr><th>${i + 1}. </th><th>${descriptionStrings.join('<br />')}</th><th>${amountString}</th></tr>`;
            }
            messageTextHTML += `</table><br />Choose what you want to do:`;
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
                    callback_data: menuBase.makeDummyButton() 
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
                text: messageTextHTML, 
                parseMode: 'HTML',
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