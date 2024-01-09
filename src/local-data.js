// module to load the local droidscript jso configuration

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const CONSTANTS = require("./CONSTANTS");
const conf = require("../package.json");

const curVer = Number(conf.version.replace(/^(\d+)\.(\d+)\.(\d+)$/, "$1.$2$3"));

/** @type {DSCONFIG_T} */
const data = {
    VERSION: curVer,
    serverIP: '',
    PORT: CONSTANTS.PORT,
    localProjects: [],
    info: {}
};

function load() {
    // @ts-ignore
    if (global._dsconf_data) return global._dsconf_data;
    const filePath = path.join(os.homedir(), CONSTANTS.DSCONFIG);

    if (fs.existsSync(filePath)) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        Object.assign(data, JSON.parse(fileData));

        if (data.VERSION != curVer) console.log("version change", data.VERSION, '->', curVer);
        adjust(data);
    }

    // @ts-ignore
    global._dsconf_data = data;
    return data;
}

/** @param {DSCONFIG_T} CONFIG */
function save(CONFIG) {
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

module.exports = { load, save };