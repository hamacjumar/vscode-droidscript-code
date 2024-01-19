
const fs = require("fs");
const minimatch = require("minimatch");
const os = require("os");
const path = require("path");
const dfltJSConfig = require("../definitions/jsconfig.json")

const HOMEPATH = os.homedir();

module.exports = {
    homePath,
    HOMEPATH,
    excludeFile
}

/** @param {string[]} paths */
function homePath(...paths) {
    return path.resolve(HOMEPATH, ...paths)
}

/** @typedef {{exclude?: string[]}} ProjConfig */

/** @type {(proj: LocalProject) => ProjConfig|null} */
function loadConfig(info) {
    const jsconfigPath = path.join(info.path, "jsconfig.json");
    if (!fs.existsSync(jsconfigPath)) return null;

    const confStr = fs.readFileSync(jsconfigPath, "utf8");
    return JSON.parse(confStr);
}

/** @type {(proj: LocalProject, path:string) => boolean} */
function excludeFile(proj, filePath) {
    const conf = loadConfig(proj);
    const exclude = conf?.exclude || dfltJSConfig.exclude;
    for (const glob of exclude)
        if (minimatch(filePath, glob)) return true;
    return false;
}