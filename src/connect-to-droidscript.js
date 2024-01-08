// function to connect a workspace to DroidScript server

const vscode = require('vscode');
const ext = require("./extension");
const fs = require("fs-extra");
const getLocalData = require("./get-local-data");
const saveLocalData = require("./save-local-data");
const CONSTANTS = require("./CONSTANTS");
const writeDocsHtmlContainer = require("./write-docs-html");

/** @type {DSCONFIG_T} */
let DSCONFIG = {};
/** @type {() => void} */
let CALLBACK;
let PASSWORD = "";
let RELOAD = false;

module.exports = function (/** @type {() => void} */ callback, /** @type {boolean} */ reload) {

    DSCONFIG = getLocalData();
    CALLBACK = callback;
    RELOAD = reload; // use DSCONFIG password

    delete DSCONFIG.version;

    if (!DSCONFIG.localProjects) DSCONFIG.localProjects = [];
    else if (DSCONFIG.localProjects && DSCONFIG.localProjects.length) {
        DSCONFIG.localProjects = DSCONFIG.localProjects.filter(m => {
            return (m && m.path && fs.existsSync(m.path));
        });
    }

    ext.setCONFIG(DSCONFIG);

    if (!DSCONFIG.serverIP) {
        showIpPopup();
    }
    else {
        getServerInfo();
    }
}

// display a popup dialog to enter ip address
function showIpPopup() {
    const options = {
        placeHolder: 'Enter IP Address: 192.168.254.112:8088',
        ignoreFocusOut: true
    };
    vscode.window.showInputBox(options).then(async value => {
        if (value !== undefined && value !== "") {
            value = value.trim();
            DSCONFIG.serverIP = "http://" + value;
            if (!DSCONFIG.serverIP.endsWith(":" + CONSTANTS.PORT)) DSCONFIG.serverIP += ":" + CONSTANTS.PORT;
            getServerInfo();
        }
        else if (value == "") {
            showIpPopup();
        }
    });
}

function getServerInfo() {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to DroidScript at ${DSCONFIG.serverIP?.replace("http://", "")}`,
        cancellable: false
    }, async () => {
        try {
            let info = await ext.getServerInfo(DSCONFIG.serverIP || '');
            if (info && info.status == "ok") {

                for (var key in info) DSCONFIG[key] = info[key];

                if (info.usepass) {
                    // use DSCONFIG password to auto reload
                    if (RELOAD) {
                        PASSWORD = DSCONFIG.password;
                        login();
                    }
                    else
                        showPasswordPopup();
                }
                else CALLBACK();
            }
            else {
                vscode.window.showErrorMessage("Make sure the DS App is running and IP Address is correct.", "Re-enter IP Address").then(() => {
                    showIpPopup();
                });
            }
        } catch (error) {
            console.log(error);
        }
    });
}

// Display a popup dialog to enter password
/**
 * @param {string} [msg]
 * @param {string} [placeHolder]
 */
function showPasswordPopup(msg, placeHolder) {
    const options = {
        prompt: msg,
        placeHolder: placeHolder || "Enter Password",
        ignoreFocusOut: true
    };
    vscode.window.showInputBox(options).then(value => {
        if (value == undefined || value == null) value = "";
        PASSWORD = value;
        login();
    });
}

// Login
async function login() {
    try {
        let response = await ext.login(PASSWORD);
        let data = response.data;

        if (data && data.status == "ok") {

            // to be use in DroidScript CLI
            DSCONFIG.password = PASSWORD;
            DSCONFIG.PORT = DSCONFIG.serverIP?.substring(DSCONFIG.serverIP.lastIndexOf(":") + 1) || '';

            saveLocalData(DSCONFIG);

            // rewrite docs html container
            writeDocsHtmlContainer();

            CALLBACK();
        }
        else if (data) {
            return showPasswordPopup("Password is incorrect.", "Re-enter password");
        }
        else {
            vscode.window.showWarningMessage("IP Address cannot be reached.", "Re-enter IP Address").then(selection => {
                if (selection == "Re-enter IP Address") {
                    showIpPopup();
                }
            });
        }
    } catch (error) {
        console.log(error);
    }
}