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
                    text: `${page}`, 
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
            callback({
                text: `*Records*\nPage _${page + 1}_ of _${pagesCount}_\nAmount of records: *${records.length}*`, 
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