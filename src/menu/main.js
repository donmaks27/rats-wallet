// @ts-check

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
        main: createMenuData_main,
        wallet: createMenuData_wallet,
        changeColor: createMenuData_changeColor,
        settings: createMenuData_settings,
        changeTimeZone: { shortName: 'chTZ', handler: createMenuData_changeTimeZone }
    };
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_main(user, userData, args, callback) {
    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [
        [
            {
                text: 'Wallet >>',
                callback_data: menuBase.makeMenuButton('wallet')
            }
        ],
        [
            {
                text: 'Invite user',
                callback_data: menuBase.makeActionButton('invite')
            }
        ],
        [
            {
                text: 'Settings >>',
                callback_data: menuBase.makeMenuButton('settings')
            }
        ]
    ];
    if (user.id == bot.getOwnerUserID()) {
        keyboard.push([{
            text: 'DEBUG >>',
            callback_data: menuBase.makeMenuButton('debug')
        }]);
    }
    callback({
        text: `Welcome, ${userData.name}!\nChoose what you want to do:`,
        keyboard: keyboard
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_wallet(user, userData, args, callback) {
    callback({
        text: menuBase.makeMenuMessageTitle(`This is your wallet`) + `\nChoose what you want to do:`,
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: 'Accounts >>',
                    callback_data: menuBase.makeMenuButton('accounts')
                },
                {
                    text: 'Records >>',
                    callback_data: menuBase.makeMenuButton('records')
                }
            ],
            [
                {
                    text: 'Currencies >>',
                    callback_data: menuBase.makeMenuButton('currencies')
                },
                {
                    text: 'Labels >>',
                    callback_data: menuBase.makeMenuButton('labels')
                },
                {
                    text: 'Categories >>',
                    callback_data: menuBase.makeMenuButton('categories')
                }
            ],
            [
                {
                    text: '<< Back to Main',
                    callback_data: menuBase.makeMenuButton('main')
                }
            ]
        ]
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_changeColor(user, userData, args, callback) {
    var text  = '';
    /** @type {bot.keyboard_button_inline_data} */
    var backButton = { text: '', callback_data: '' };
    if (typeof args.labelID === 'number') {
        text = `*Label color*\nPlease, choose the color:`;
        backButton = { text: `<< Back to label`, callback_data: menuBase.makeMenuButton('label', { labelID: args.labelID }) };
    } else if (typeof args.categoryID === 'number') {
        text = `*Category color*\nPlease, choose the color:`;
        backButton = { text: `<< Back to category`, callback_data: menuBase.makeMenuButton('category', { categoryID: args.categoryID }) };
    } else if (typeof args.accountID === 'number') {
        text = `*Account color*\nPlease, choose the color:`;
        backButton = { text: `<< Back to account`, callback_data: menuBase.makeMenuButton('account', { accountID: args.accountID }) };
    } else {
        callback({
            text: `_${bot.escapeMarkdown(`Hmm, something wrong...`)}_`, parseMode: 'MarkdownV2',
            keyboard: [[{ text: `<< Back to Wallet`, callback_data: menuBase.makeMenuButton('wallet') }]]
        });
        return;
    }
    callback({
        text: text, 
        parseMode: 'MarkdownV2',
        keyboard: [
            [
                {
                    text: `${walletCommon.getColorMarker('red')} Red`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'red' })
                },
                {
                    text: `${walletCommon.getColorMarker('orange')} Orange`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'orange' })
                },
                {
                    text: `${walletCommon.getColorMarker('yellow')} Yellow`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'yellow' })
                }
            ],
            [
                {
                    text: `${walletCommon.getColorMarker('green')} Green`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'green' })
                },
                {
                    text: `${walletCommon.getColorMarker('blue')} Blue`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'blue' })
                },
                {
                    text: `${walletCommon.getColorMarker('purple')} Purple`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'purple' })
                }
            ],
            [
                {
                    text: `${walletCommon.getColorMarker('black')} Black`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'black' })
                },
                {
                    text: `${walletCommon.getColorMarker('white')} White`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'white' })
                },
                {
                    text: `${walletCommon.getColorMarker('brown')} Brown`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: 'brown' })
                }
            ],
            [
                {
                    text: `None`,
                    callback_data: menuBase.makeActionButton('changeColor', { ...args, color: null })
                }
            ],
            [ backButton ]
        ]
    });
}

/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_settings(user, userData, args, callback) {
    callback({
        text: `Welcome, ${userData.name}!\nChoose what you want to do:`,
        keyboard: [
            [
                {
                    text: 'Change name',
                    callback_data: menuBase.makeActionButton('renameUser')
                }
            ],
            [
                {
                    text: 'Change time zone',
                    callback_data: menuBase.makeMenuButton('changeTimeZone')
                }
            ],
            [
                {
                    text: '<< Back to Main',
                    callback_data: menuBase.makeMenuButton('main')
                }
            ]
        ]
    });
}
/**
 * @type {menuBase.menu_create_func}
 */
function createMenuData_changeTimeZone(user, userData, args, callback) {
    const MAX_ROWS = 8;
    const ROW_SIZE = 3;

    const userID = user.id;
    const currentRegion = typeof args._r === 'string' ? args._r : null;
    const currentPage = typeof args._p === 'number' ? args._p : 0;
    
    /** @type {string[]} */
    // @ts-ignore
    const timeZones = Intl.supportedValuesOf('timeZone');
    /** @type {{ [region: string]: string[] }} */
    var timeZonesMap = {};
    for (var i = 0; i < timeZones.length; i++) {
        const components = timeZones[i].split('/');
        if (components.length != 2) {
            continue;
        }
        const region = components[0];
        const location = components[1];
        if (!timeZonesMap[region]) {
            timeZonesMap[region] = [ location ];
        } else {
            timeZonesMap[region].push(location);
        }
    }

    var menuText = `*Changing time zone*\n_Current timezone: ${userData.timezone ? bot.escapeMarkdown(userData.timezone.replace(/\_/g, ' '). replace('/', ' / ')) : 'UTC'}_`;
    /** @type {bot.keyboard_button_inline_data[][]} */
    var keyboard = [];
    if (currentRegion == null) {
        menuText += `\nPlease, choose your region:`;
        /** @type {bot.keyboard_button_inline_data[]} */
        var keyboardRow = [];
        const regions = Object.getOwnPropertyNames(timeZonesMap);
        const firstRegionIndex = regions.length <= (ROW_SIZE * MAX_ROWS) ? 0 : currentPage * ROW_SIZE * MAX_ROWS;
        const lastRegionIndex = Math.min(regions.length, firstRegionIndex + ROW_SIZE * MAX_ROWS) - 1;
        for (var i = firstRegionIndex; i <= lastRegionIndex; i++) {
            keyboardRow.push({
                text: regions[i].replace(/\_/g, ' '),
                callback_data: menuBase.makeMenuButton('changeTimeZone', { _r: regions[i] })
            });
            if (keyboardRow.length == ROW_SIZE) {
                keyboard.push(keyboardRow);
                keyboardRow = [];
            }
        }
        if (keyboardRow.length > 0) {
            keyboard.push(keyboardRow);
            keyboardRow = [];
        }
        if (regions.length > (ROW_SIZE * MAX_ROWS)) {
            /** @type {bot.keyboard_button_inline_data[]} */
            var controlRow = [];
            if (currentPage > 0) {
                controlRow.push({
                    text: `<`,
                    callback_data: menuBase.makeMenuButton('changeTimeZone', { _p: currentPage - 1 })
                });
            } else {
                controlRow.push({
                    text: ' ',
                    callback_data: menuBase.makeDummyButton()
                });
            }
            if (lastRegionIndex < regions.length - 1) {
                controlRow.push({
                    text: `>`,
                    callback_data: menuBase.makeMenuButton('changeTimeZone', { _p: currentPage + 1 })
                });
            } else {
                controlRow.push({
                    text: ' ',
                    callback_data: menuBase.makeDummyButton()
                });
            }
            keyboard.push(controlRow);
        }
        keyboard.push([{
            text: 'UTC',
            callback_data: menuBase.makeActionButton('changeTimezone', { tz: null })
        }]);
    } else {
        menuText += `\n*Region:* ${bot.escapeMarkdown(currentRegion)}\nPlease, choose your location:`;
        const locations = timeZonesMap[currentRegion];
        if (locations && (locations.length > 0)) {
            /** @type {bot.keyboard_button_inline_data[]} */
            var keyboardRow = [];
            const firstLocationIndex = locations.length <= (ROW_SIZE * MAX_ROWS) ? 0 : currentPage * ROW_SIZE * MAX_ROWS;
            const lastLocationIndex = Math.min(locations.length, firstLocationIndex + ROW_SIZE * MAX_ROWS) - 1;
            for (var i = firstLocationIndex; i <= lastLocationIndex; i++) {
                const timezone = `${currentRegion}/${locations[i]}`;
                keyboardRow.push({
                    text: locations[i].replace(/\_/g, ' '),
                    callback_data: timezone == userData.timezone ? menuBase.makeDummyButton() : menuBase.makeActionButton('changeTimezone', { tz: timezone })
                });
                if (keyboardRow.length == ROW_SIZE) {
                    keyboard.push(keyboardRow);
                    keyboardRow = [];
                }
            }
            if (keyboardRow.length > 0) {
                keyboard.push(keyboardRow);
                keyboardRow = [];
            }
            if (locations.length > (ROW_SIZE * MAX_ROWS)) {
                /** @type {bot.keyboard_button_inline_data[]} */
                var controlRow = [];
                if (currentPage > 0) {
                    controlRow.push({
                        text: `<`,
                        callback_data: menuBase.makeMenuButton('changeTimeZone', { _r: currentRegion, _p: currentPage - 1 })
                    });
                } else {
                    controlRow.push({
                        text: ' ',
                        callback_data: menuBase.makeDummyButton()
                    });
                }
                if (lastLocationIndex < locations.length - 1) {
                    controlRow.push({
                        text: `>`,
                        callback_data: menuBase.makeMenuButton('changeTimeZone', { _r: currentRegion, _p: currentPage + 1 })
                    });
                } else {
                    controlRow.push({
                        text: ' ',
                        callback_data: menuBase.makeDummyButton()
                    });
                }
                keyboard.push(controlRow);
            }
        }
        keyboard.push([{
            text: `<< Change region`,
            callback_data: menuBase.makeMenuButton('changeTimeZone')
        }, {
            text: 'UTC',
            callback_data: menuBase.makeActionButton('changeTimezone', { tz: null })
        }]);
    }
    keyboard.push([{
        text: `<< Back to Settings`,
        callback_data: menuBase.makeMenuButton('settings')
    }]);
    callback({
        text: menuText, parseMode: 'MarkdownV2',
        keyboard: keyboard
    });
}