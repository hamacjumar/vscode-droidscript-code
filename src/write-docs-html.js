/* 

    Module to save the html container for the docs.

    Called in:
        connect-to-droidscript.js
*/

const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const CONSTANTS = require("./CONSTANTS")
const getLocalData = require("./get-local-data");

/** @type {DSCONFIG_T} */
let DSCONFIG = {};

module.exports = function () {

    DSCONFIG = getLocalData();

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Documentation</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        body {
            height: 100vh;
            overflow: hidden;
        }
        iframe {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <iframe src="${DSCONFIG.serverIP}/.edit/docs/Docs.html?ds=true" frameborder="0"></iframe>
</body>
</html>`;

    // write to local file
    if (!fs.existsSync(path.join(os.homedir(), CONSTANTS.DOCS))) {
        fs.mkdirSync(path.join(os.homedir(), CONSTANTS.DOCS));
    }
    const filePath = path.join(os.homedir(), CONSTANTS.DOCS_FILE);
    fs.writeFileSync(filePath, html, { flag: "w" });
}