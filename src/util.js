
const os = require("os");
const path = require("path");

const HOMEPATH = os.homedir();

module.exports = {
    homePath,
    HOMEPATH
}

/** @param {string[]} paths */
function homePath(...paths) {
    return path.resolve(HOMEPATH, ...paths)
}