// function to connect a workspace to DroidScript server

const vscode = require('vscode');

const ext = require("../extension");
const localData = require("../local-data");

/** @type {DSCONFIG_T} */
let DSCONFIG;
/** @type {() => void} */
let CALLBACK;

/** @param {() => void} callback */
module.exports = function (callback) {
    DSCONFIG = localData.load();
    CALLBACK = callback;

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

async function getServerInfo() {
    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: `Connecting to DroidScript at ${DSCONFIG.serverIP.replace("http://", "")}`,
        cancellable: false
    }, async (prog) => {
        let info = await ext.getServerInfo();
        if (!info || info.status !== "ok") {
            prog.report({ message: "Failed" });
            vscode.window.showErrorMessage("Make sure the DS App is running and IP Address is correct.", "Retry", "Re-enter IP Address")
                .then(res => {
                    if (res === "Retry") getServerInfo();
                    else if (res === "Re-enter IP Address") showIpPopup();
                });
            return;
        }

        Object.assign(DSCONFIG.info, info);

        if (DSCONFIG.info.usepass) {
            let ok = false;
            if (DSCONFIG.password) ok = await login(DSCONFIG.password);
            if (!ok) ok = await showPasswordPopup();
            if (!ok) return;
        }

        CALLBACK();
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
    if (value === undefined) return false;
    return await login(value);
}

// Login
/** @return {Promise<boolean>} */
async function login(pass = '') {
    let data = await ext.login(pass);

    if (!data) {
        const selection = await vscode.window.showWarningMessage("IP Address cannot be reached.", "Retry", "Re-enter IP Address")
        if (selection === "Retry") login(pass);
        else if (selection === "Re-enter IP Address") showIpPopup();
        return false;
    }

    if (data.status !== "ok")
        return await showPasswordPopup("Password is incorrect.", "Re-enter password");

    // to be use in DroidScript CLI
    DSCONFIG.password = pass;
    localData.save(DSCONFIG);
    return true;
}