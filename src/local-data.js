// module to load the local droidscript jso configuration

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const CONSTANTS = require("./CONSTANTS");

/** @type {DSCONFIG_T} */
const data = {
    VERSION: CONSTANTS.VERSION,
    serverIP: '',
    reload: '',
    PORT: CONSTANTS.PORT,
    localProjects: [],
    info: {}
};

function load() {
    if (global._dsconf_data) return global._dsconf_data;
    const filePath = path.join(os.homedir(), CONSTANTS.DSCONFIG);

    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        Object.assign(data, JSON.parse(fileData));

        if (data.VERSION != CONSTANTS.VERSION) console.log("version change", data.VERSION, '->', CONSTANTS.VERSION);
        adjust(data);
    }

    return global._dsconf_data = data;
}

/** @param {DSCONFIG_T} CONFIG */
function save(CONFIG = data) {
    if (CONFIG != data) console.error("invalid data");
    const strdata = JSON.stringify(adjust(CONFIG), null, 2);
    const filePath = path.join(os.homedir(), CONSTANTS.DSCONFIG);
    fs.writeFileSync(filePath, strdata);
}

/** @param {DSCONFIG_T} config */
function adjust(config) {
    if (!config.localProjects) config.localProjects = [];
    if (!config.info) config.info = {};

    // normalize serverIP
    config.serverIP = data.serverIP.replace(/(https?:\/\/)?([^:]+)(:(\d+))?/,
        (_, r = "http://", u = "", _p, p = data.PORT) => r + u + (data.PORT = p, _p));

    config.localProjects = config.localProjects.filter(m => m?.path && fs.existsSync(m.path));
    for (const p of config.localProjects) p.path = path.resolve(p.path);
    return config;
}

/** 
 * @param {Parameters<LocalProject[]['find']>[0]} filter
 * @param {DSCONFIG_T} CONFIG
 */
const getProject = (filter, CONFIG = data) => CONFIG.localProjects.find(filter)

/** 
 * @param {string} name
 * @param {DSCONFIG_T} CONFIG
 */
const getProjectByName = (name, CONFIG = data) => CONFIG.localProjects.find(p => p.PROJECT == name)

/** 
 * @param {string} file
 * @param {DSCONFIG_T} CONFIG
 */
const getProjectByFile = (file, CONFIG = data) => CONFIG.localProjects.find(p => file.startsWith(p.path + path.sep))

module.exports = { load, save, getProject, getProjectByName, getProjectByFile };