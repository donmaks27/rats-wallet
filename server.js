// @ts-check

var fs = require('fs');
var https = require('https');

var log = require('./src/log');
var bot = require('./src/telegram-bot');
var db  = require('./src/database');
var wallet = require('./src/rats-wallet');

db.open((error) => {
    if (error) {
        log.error('[SERVER] failed to open database: ' + error);
    } else {
        log.info(`[SERVER] starting server`);
        https.createServer({
            key: fs.readFileSync('data/private.key'),
            cert: fs.readFileSync('data/public.pem')
        }, (request, response) => {
            var secretToken = request.headers['X-Telegram-Bot-Api-Secret-Token'];
            if (!secretToken || (typeof secretToken !== 'string') || (secretToken != bot.getSecretToken())) {
                log.warning(`[SERVER] received request with wrong secret token`);
                response.writeHead(200);
                response.end();
                return;
            }

            var data = '';
            request.on('data', (chunk) => {
                data += chunk;
            });
            request.on('error', (error) => {
                log.error('[SERVER] Receive request error: ' + error);
            });
            request.on('end', () => {
                log.info(`[SERVER] recieved response data: ` + data);

                response.writeHead(200);
                response.end();
        
                if (data.length > 0) {
                    var dataJSON = null;
                    try {
                        dataJSON = JSON.parse(data);
                    } catch (error) {
                        log.error('[SERVER] Parse request data error: ' + error)
                    }
                    if (dataJSON != null) {
                        wallet.onBotUpdate(dataJSON);
                    }
                }
            });
        }).listen(bot.getServerAddress().port)
    }
});