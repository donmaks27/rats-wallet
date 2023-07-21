// @ts-check

var fs = require('fs');

var log = require('./src/log');
var db = require('./src/database');
var bot = require('./src/telegram-bot');
var report = require('./src/wallet-report');

const reportFilepath = 'data/report.json';

if (!fs.existsSync('data/report.json')) {
    report.load((data, error) => {
        if (error) {
            log.error('failed to load wallet report data: ' + error);
        } else {
            fs.writeFile(reportFilepath, JSON.stringify(data, null, 4), {
                encoding: 'utf-8'
            }, (error) => {
                if (error) {
                    log.error(`failed to save parsed wallet report data to "${reportFilepath}": ` + error);
                } else {
                    log.info(`wallet report data parsed and saved to "${reportFilepath}"`);
                }
            });
        }
    });
} else {
    var data = fs.readFileSync(reportFilepath, {
        encoding: 'utf-8'
    });
    /** @type {report.full_data | null} */
    var parsedData = null;
    try {
        parsedData = JSON.parse(data);
    } catch (error) {
        log.error(`failed to parse file "${reportFilepath}": ` + error);
    }
    if (parsedData) {
        var reportData = parsedData;
        db.open((error) => {
            if (error) {
                log.error(`failed to open database: ` + error);
                return;
            }
            db.user_get(bot.getOwnerUserID(), (userData, error) => {
                if (error || !userData) {
                    log.error(`can't find owner user data: ` + error);
                    db.close();
                } else {
                    report.apply(bot.getOwnerUserID(), reportData, (error) => {
                        if (error) {
                            log.error(`failed to apply wallet report: ` + error);
                        }
                        db.close();
                    });
                }
            });
        });
    }
}
