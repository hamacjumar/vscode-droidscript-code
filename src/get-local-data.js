// module to get the local droidscript jso configuration

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const CONSTANTS = require("./CONSTANTS");

module.exports = function() {
    var filePath = path.join(os.homedir(), CONSTANTS.DSCONFIG);
    if( fs.existsSync(filePath) ) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        return JSON.parse( fileData );
    }
    return {};
}