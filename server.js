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
        wallet.onBotStart((error) => {
            if (error) {
                log.error(`[SERVER] failed to start bot logic: ` + error);
                db.close();
            } else {
                https.createServer({
                    key: fs.readFileSync('data/private.key'),
                    cert: fs.readFileSync('data/public.pem')
                }, (request, response) => {
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
                
                        var dataJSON = null;
                        try {
                            dataJSON = JSON.parse(data);
                        } catch (error) {
                            log.error('[SERVER] Parse request data error: ' + error)
                        }
                        if (dataJSON != null) {
                            wallet.onBotUpdate(dataJSON);
                        }
                    });
                }).listen(bot.getServerAddress().port);
            }
        });
    }
});