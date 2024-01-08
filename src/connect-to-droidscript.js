// function to connect a workspace to DroidScript server

const vscode = require('vscode');
const ext = require("./extension");
const fs = require("fs-extra");
const localData = require("./local-data");
const writeDocsHtmlContainer = require("./write-docs-html");

/** @type {DSCONFIG_T} */
let DSCONFIG;
/** @type {() => void} */
let CALLBACK;
let PASSWORD = "";
let RELOAD = false;

/**
 * @param {() => void} callback 
 * @param {boolean} reload 
 */
module.exports = function (callback, reload) {

    DSCONFIG = localData.load();
    console.log("DSCONFIG", DSCONFIG);
    CALLBACK = callback;
    RELOAD = reload; // use DSCONFIG password

    console.log("set DSCONFIG", DSCONFIG);
    ext.setCONFIG(DSCONFIG);

    if (!DSCONFIG.serverIP) showIpPopup();
    else getServerInfo();
}


// display a popup dialog to enter ip address
async function showIpPopup() {
    const options = {
        placeHolder: 'Enter IP Address: 192.168.254.112:8088',
        ignoreFocusOut: true
    };
    const value = await vscode.window.showInputBox(options);
    if (!value) {
        if (value !== undefined) showIpPopup();
        return;
    }

    DSCONFIG.serverIP = "http://" + value.trim();
    localData.save(DSCONFIG);
    getServerInfo();
}

function getServerInfo() {
    vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to DroidScript at ${DSCONFIG.serverIP.replace("http://", "")}`,
        cancellable: false
    }, async () => {
        let info = await ext.getServerInfo();
        if (!info || info.status !== "ok") {
            console.log("not running", info);
            await vscode.window.showErrorMessage("Make sure the DS App is running and IP Address is correct.", "Re-enter IP Address")
            showIpPopup();
            return;
        }

        Object.assign(DSCONFIG.info, info);

        if (DSCONFIG.info.usepass) {
            // use DSCONFIG password to auto reload
            if (RELOAD) return showPasswordPopup();

            PASSWORD = DSCONFIG.info.password || '';
            login();
        }
        else CALLBACK();
    });
}

// Display a popup dialog to enter password
/**
 * @param {string} msg
 * @param {string} placeHolder
 */
async function showPasswordPopup(msg = "", placeHolder = "Enter Password") {
    const options = {
        prompt: msg,
        placeHolder: placeHolder,
        ignoreFocusOut: true
    };
    const value = await vscode.window.showInputBox(options);
    if (value === undefined) return;

    PASSWORD = value || "";
    login();
}

// Login
async function login() {
    let data = await ext.login(PASSWORD);

    if (!data) {
        const selection = await vscode.window.showWarningMessage("IP Address cannot be reached.", "Re-enter IP Address")
        if (selection == "Re-enter IP Address") showIpPopup();
        return;
    }

    if (data.status !== "ok")
        return showPasswordPopup("Password is incorrect.", "Re-enter password");

    // to be use in DroidScript CLI
    DSCONFIG.info.password = PASSWORD;
    localData.save(DSCONFIG);

    // rewrite docs html container
    writeDocsHtmlContainer();
    CALLBACK();
}