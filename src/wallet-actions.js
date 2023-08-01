// @ts-check

var logModule = require('./log');
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

var db  = require('./database');
var bot = require('./telegram-bot');
var walletCommon = require('./wallet-common');
var walletActionsList = require('./actions/wallet-actions-list');

walletActionsList.register(stopUserAction);

module.exports.startUserAction = startUserAction;
module.exports.handleUserActionMessage = handleUserActionMessage;
module.exports.stopUserAction = stopUserAction;

/**
 * @param {string} action 
 * @param {walletCommon.args_data} args 
 * @param {bot.user_data} user 
 * @param {db.user_data} userData 
 * @param {(success: boolean) => any} [callback] 
 */
function startUserAction(action, args, user, userData, callback) {
    const userID = user.id;
    log.info(userID, `starting action "${action}"...`);

    const actionHandlers = walletActionsList.getHandlers(action);
    if (!actionHandlers) {
        log.warning(userID, `invalid user action "${action}"`);
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
                startUserAction(action, args, user, userData, callback);
            }
        });
        return;
    }

    walletCommon.setUserAction(userID, action, args);
    actionHandlers.start(user, userData, args, (success) => {
        if (!success) {
            log.error(userID, `failed to start user action "${action}"`);
            walletCommon.clearUserAction(userID);
        } else {
            log.info(userID, `user action "${action}" started`);
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
        const actionHandlers = walletActionsList.getHandlers(currentAction.action);
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
        const actionHandlers = walletActionsList.getHandlers(currentAction.action);
        if (!actionHandlers) {
            log.warning(userID, `invalid action "${currentAction}"`);
            if (callback) {
                callback(false);
            }
        } else {
            actionHandlers.stop(user, userData, currentAction.args, (success) => {
                if (!success) {
                    log.error(userID, `failed to stop action "${currentAction}"`);
                } else {
                    log.info(userID, `stopped action "${currentAction}"`);
                    walletCommon.clearUserAction(userID);
                }
                if (callback) {
                    callback(success);
                }
            });
        }
    }
}