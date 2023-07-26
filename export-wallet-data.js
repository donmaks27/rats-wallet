// @ts-check

var fs = require('fs');

var log = require('./src/log');
var db = require('./src/database');

db.open((error) => {
    if (error) {
        log.error(`failed to open database: ` + error);
    } else {
        db.getAllData((data, error) => {
            if (error) {
                log.error(`failed to get all data: ` + error);
            } else {
                fs.writeFileSync('./data/database.json', JSON.stringify(data, null, 4), { encoding: 'utf-8' });
            }
            db.close();
        });
    }
});