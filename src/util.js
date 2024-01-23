
const fs = require("fs");
const minimatch = require("minimatch");
const os = require("os");
const path = require("path");
const dfltJSConfig = require("../definitions/default_jsconfig.json")

const HOMEPATH = os.homedir();

module.exports = {
    homePath,
    HOMEPATH,
    excludeFile,
    batchPromises,
    first,
    loadConfig
}

/** @param {string[]} paths */
function homePath(...paths) {
    return path.resolve(HOMEPATH, ...paths)
}

/**@type {<S, T>(list: S[], predicate:(v:S) => T?) => T?} */
function first(list, predicate) {
    for (const v of list) {
        const t = predicate(v);
        if (t) return t;
    }
    return null;
}

/** @type {(proj: LocalProject) => ProjConfig} */
function loadConfig(info) {
    const jsconfigPath = path.join(info.path, "jsconfig.json");
    if (!fs.existsSync(jsconfigPath)) return { ...dfltJSConfig, };

    const confStr = fs.readFileSync(jsconfigPath, "utf8");
    return JSON.parse(confStr);
}

/** @type {(conf: ProjConfig, path:string) => boolean} */
function excludeFile(conf, filePath) {
    if (filePath.split(/[/\\]/).find(p => p[0] === '.' || p[0] === '~')) return true;
    for (const glob of conf.exclude || dfltJSConfig.exclude)
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
