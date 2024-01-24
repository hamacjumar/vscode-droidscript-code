
const conf = require("../package.json");
const curVer = Number(conf.version.replace(/^(\d+)\.(\d+)\.(\d+)$/, "$1.$2$3"));

// path to local files and folders
module.exports = {
    VERSION: curVer,
    DEBUG: false,
    LOCALFOLDER: ".droidscript",
    DSCONFIG: "dsconfig.json",
    SAMPLES: ".droidscript/samples",
    DEFINITIONS: ".droidscript/definitions",
    PORT: "8088",
    SAMPLE_PORT: "8018",
    defPaths: [
        ".edit/docs/definitions/ts/",
        ".edit/docs/definitions/",
        ".edit/definitions/ts/",
        ".edit/definitions/"
    ]
};