
const fs = require("fs");
const minimatch = require("minimatch");
const os = require("os");
const path = require("path");
const dfltJSConfig = require("../definitions/jsconfig.json")

const HOMEPATH = os.homedir();

module.exports = {
    homePath,
    HOMEPATH,
    excludeFile,
    batchPromises
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

/** @type {<T>(data:T[], handler:(o:T, i:number, l:T[]) => Promise<any>, batchSize?:number) => Promise<void>} */
async function batchPromises(data, handler, batchSize = 10) {
    /** @type {Promise<[Promise<any>]>[]} */
    let promises = [], i = 0;
    while (i < data.length) {
        while (promises.length < batchSize && i < data.length) {
            let promise = handler(data[i], i++, data);
            promises.push(promise = promise.then(res => [promise]));
        }
        const p = await Promise.race(promises);
        promises.splice(promises.indexOf(p[0]), 1);
    }
}
