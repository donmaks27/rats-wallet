// @ts-check

var logModule = require('./log');
var db  = require('./database');
var bot = require('./telegram-bot');
var walletCommon = require('./wallet-common');

const log = {
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    error: (userID, msg) => logModule.error(`[WALLET][ACTION][USER ${userID}] ${msg}`),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    warning: (userID, msg) => logModule.warning(`[WALLET][ACTION][USER ${userID}] ${msg}`),
    /**
     * @param {number} userID 
     * @param {string} msg 
     */
    info: (userID, msg) => logModule.info(`[WALLET][ACTION][USER ${userID}] ${msg}`)
};
const WalletActionsHandlers = {
    ...require('./actions/invite').register(stopUserAction),
    ...require('./actions/renameUser').register(stopUserAction),
    ...require('./actions/changeColor').register(stopUserAction),
    ...require('./actions/changeTimezone').register(stopUserAction),

    ...require('./actions/renameAccount').register(stopUserAction),
    ...require('./actions/archiveAccount').register(stopUserAction),
    ...require('./actions/createAccount').register(stopUserAction),
    ...require('./actions/deleteAccount').register(stopUserAction),

    ...require('./actions/renameCurrency').register(stopUserAction),
    ...require('./actions/archiveCurrency').register(stopUserAction),
    ...require('./actions/createCurrency').register(stopUserAction),
    ...require('./actions/deleteCurrency').register(stopUserAction),

    ...require('./actions/renameLabel').register(stopUserAction),
    ...require('./actions/archiveLabel').register(stopUserAction),
    ...require('./actions/createLabel').register(stopUserAction),
    ...require('./actions/deleteLabel').register(stopUserAction),
    ...require('./actions/makeLabelGlobal').register(stopUserAction),

    ...require('./actions/renameCategory').register(stopUserAction),
    ...require('./actions/archiveCategory').register(stopUserAction),
    ...require('./actions/createCategory').register(stopUserAction),
    ...require('./actions/deleteCategory').register(stopUserAction),
    ...require('./actions/makeCategoryGlobal').register(stopUserAction),

    ...require('./actions/changeRecordsPage').register(stopUserAction),
    ...require('./actions/applyTempFilter').register(stopUserAction),
    ...require('./actions/changeRecordAmount').register(stopUserAction),
    ...require('./actions/changeRecordNote').register(stopUserAction),
    ...require('./actions/createRecord').register(stopUserAction),
    ...require('./actions/deleteRecord').register(stopUserAction),
};
const WalletActionsMap = makeWalletActionsMap(WalletActionsHandlers);

/**
 * @param {string} action 
 */
module.exports.getActionShortName = function(action) {
    const actionHandler = WalletActionsHandlers[action];
    return actionHandler && actionHandler.shortName ? actionHandler.shortName : action;
}
module.exports.startUserAction = startUserAction;
module.exports.handleUserActionMessage = handleUserActionMessage;
module.exports.stopUserAction = stopUserAction;

/**
 * @param {{ [actionName: string]: { shortName?: string } }} actions 
 */
function makeWalletActionsMap(actions) {
    /** @type {{ [shortName: string]: string }} */
    var result = {};
    const actionNames = Object.getOwnPropertyNames(actions);
    for (var i = 0; i < actionNames.length; i++) {
        const actionName = actionNames[i];
        const shortName = actions[actionName].shortName;
        if (shortName) {
            if (result[shortName]) {
                console.log(`[DEBUG ERROR] dublicate action short name '${shortName}', action '${actionName}'`);
            }
            result[shortName] = actionName;
        }
    }
    return result;
}

/**
 * @param {string} action 
 * @param {walletCommon.args_data} args 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} [callback] 
 */
function startUserAction(action, args, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `starting action "${action}" (args: ${JSON.stringify(args)})...`);

    var actualActionName = WalletActionsMap[action];
    if (!actualActionName) {
        actualActionName = action;
    }
    const actionHandlers = WalletActionsHandlers[actualActionName];
    if (!actionHandlers) {
        log.warning(userID, `invalid user action "${actualActionName}"`);
        if (callback) {
            callback(false);
        }
        return;
    }

    var currentAction = walletCommon.getUserAction(userID).action;
    if (currentAction != walletCommon.ACTION_INVALID) {
        log.warning(userID, `found active action "${currentAction}"`);
        stopUserAction(user, userData, (success) => {
            if (!success) {
                log.error(userID, `failed to stop previous action`);
                if (callback) {
                    callback(false);
                }
            } else {
                startUserAction(actualActionName, args, user, userData, callback);
            }
        });
        return;
    }

    walletCommon.setUserAction(userID, actualActionName, args);
    actionHandlers.start(user, userData, args, (success) => {
        if (!success) {
            log.error(userID, `failed to start user action "${actualActionName}"`);
            walletCommon.clearUserAction(userID);
        } else {
            log.info(userID, `user action "${actualActionName}" started`);
        }
        if (callback) {
            callback(success);
        }
    });
}
/**
 * @param {bot.message_data} message 
 * @param {db.user_data} userData 
 */
function handleUserActionMessage(message, userData) {
    const userID = message.from.id;
    log.info(userID, `handling current action message...`);
    var currentAction = walletCommon.getUserAction(userID);
    if (currentAction.action == walletCommon.ACTION_INVALID) {
        log.info(userID, `there is no active action`);
    } else {
        const actionHandlers = WalletActionsHandlers[currentAction.action];
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction.action}"`);
        } else if (actionHandlers.onMessage) {
            actionHandlers.onMessage(message, userData, currentAction.args, (success) => {
                if (!success) {
                    log.error(userID, `failed to handle message for action "${currentAction.action}"`);
                } else {
                    log.info(userID, `handled message for action "${currentAction.action}"`);
                }
            });
        } else {
            log.info(userID, `empty onMessage handler, ignoring`);
        }
    }
}
/**
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} [callback] 
 */
function stopUserAction(user, userData, callback) {
    const userID = user.id;
    log.info(userID, `stopping current action...`);
    var currentAction = walletCommon.getUserAction(userID);
    if (currentAction.action == walletCommon.ACTION_INVALID) {
        log.info(userID, `there is no active action`);
        if (callback) {
            callback(true);
        }
    } else {
        const actionHandlers = WalletActionsHandlers[currentAction.action];
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction}"`);
            if (callback) {
                callback(false);
            }
        } else {
            log.info(userID, `found active action "${currentAction.action}" (args: ${JSON.stringify(currentAction.args)})`);
            actionHandlers.stop(user, userData, currentAction.args, (success) => {
                if (!success) {
                    log.error(userID, `failed to stop action "${currentAction.action}"`);
                } else {
                    log.info(userID, `stopped action "${currentAction.action}"`);
                    walletCommon.clearUserAction(userID);
                }
                if (callback) {
                    callback(success);
                }
            });
        }
    }
}