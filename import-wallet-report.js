// @ts-check

var fs = require('fs');

var log = require('./src/log');
var db = require('./src/database');
var bot = require('./src/telegram-bot');
var report = require('./src/wallet-report');

const reportFilepath = 'data/report.json';
if (!fs.existsSync(reportFilepath)) {
    log.error(`failed to find wallet report data`);
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
                    db.user_create({ id: bot.getOwnerUserID(), name: bot.getOwnerName() }, (userData, error) => {
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
