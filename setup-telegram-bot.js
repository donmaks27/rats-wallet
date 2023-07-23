// @ts-check

var log = require('./src/log');
var bot = require('./src/telegram-bot');
var wallet = require('./src/rats-wallet');

wallet.setupBotCommands((error) => {
    if (error) {
        log.error(`failed to setup bot commands list: ` + error);
    } else {
        bot.setWebhook(bot.getServerAddress(), 'data/public.pem', bot.getSecretToken(), true, (success, error) => {
            if (error) {
                log.error(`failed to update webhook: ` + error);
            } else if (!success) {
                log.error(`failed to update webhook`);
            } else {
                log.info(`success`, true);
            }
        });
    }
});

