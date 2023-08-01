// @ts-check

var actionBase = require('./wallet-action-base');

/** @type {{ [action: string]: actionBase.action_handlers }} */
var WalletActionsHandlers = {};

/**
 * @param {actionBase.action_stop_callback} stopCallback 
 */
module.exports.register = (stopCallback) => {
    WalletActionsHandlers = {
        invite:             require('./invite').register(stopCallback),
        changeUserName:     require('./changeUserName').register(stopCallback),
        archiveAccount:     require('./archiveAccount').register(stopCallback),
        deleteAccount:      require('./deleteAccount').register(stopCallback),
        createAccount:      require('./createAccount').register(stopCallback),
        archiveCurrency:    require('./archiveCurrency').register(stopCallback),
        changeCurrencyName: require('./changeCurrencyName').register(stopCallback),
        createCurrency:     require('./createCurrency').register(stopCallback),
        deleteCurrency:     require('./deleteCurrency').register(stopCallback),
    };
}
/**
 * @param {string} action 
 * @returns {actionBase.action_handlers | null}
 */
module.exports.getHandlers = (action) => {
    if (!WalletActionsHandlers[action]) {
        return null;
    }
    return WalletActionsHandlers[action];
}