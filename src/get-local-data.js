// module to get the local droidscript jso configuration

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const CONSTANTS = require("./CONSTANTS");
const conf = require("../package.json");

module.exports = function () {
    var filePath = path.join(os.homedir(), CONSTANTS.DSCONFIG);
    var curVer = Number(conf.version.replace(/^(\d+)\.(\d+)\.(\d+)$/, "$1.$2$3"));
    /** @type {DSCONFIG_T} */
    let data = {
        VERSION: curVer,
        serverIP: '',
        PORT: CONSTANTS.PORT,
        localProjects: []
    };

    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        Object.assign(data, JSON.parse(fileData));

        if (data.VERSION != curVer) console.log("version change", data.VERSION, '->', curVer);
        // normalize serverIP
        data.serverIP = data.serverIP.replace(/(https?:\/\/)?([^:]+)(:(\d+))?/,
            (_, r = "http://", u = "", _p, p = data.PORT) => r + u + (data.PORT = p, _p));
    }

    return data;
}