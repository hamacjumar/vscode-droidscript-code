// module to save the local droidscript json configuration

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const CONSTANTS = require("./CONSTANTS")

/** @param {DSCONFIG_T} CONFIG */
module.exports = function (CONFIG) {
    CONFIG.localProjects = CONFIG.localProjects.filter(m => (m && m.path)) || [];
    const data = JSON.stringify(CONFIG, null, 2);
    const filePath = path.join(os.homedir(), CONSTANTS.DSCONFIG);
    fs.writeFileSync(filePath, data);
}