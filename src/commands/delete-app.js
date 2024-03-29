const vscode = require('vscode');
const ext = require('../dsclient');
const rimraf = require("rimraf");
const fs = require('fs');

/** @type {(error: any) => DSServerResponse<{status:"bad"}>} */
const catchError = (error) => {
    console.error(error.stack || error.message || error);
    vscode.window.showErrorMessage(error.message || error);
    return { status: "bad", error };
}

/** 
 * @param {import("../ProjectsTreeView").ProjItem} item
 * @returns {Promise<{status:'ok'|'error'} | undefined>}
 */
module.exports = async function (item) {
    const appName = item.title;

    /** @type {("Remove"|"Delete"|"Cancel")[]} */
    const actions = ["Remove", "Delete"];
    if (!item.path) actions.shift();

    const message = item.path ?
        `Remove local ${appName} app or delete on device?` :
        `Delete ${appName} on device?`;

    const selection = await vscode.window.showWarningMessage(message, { modal: true }, ...actions)

    if (selection === "Delete") {
        let response = await ext.deleteFile(appName).catch(catchError);
        if (response.status !== "ok") {
            vscode.window.showErrorMessage(`Error removing ${appName} app!`);
            return
        }
    }

    if (selection === "Remove" || selection === "Delete") {
        try {
            if (item.path) rimraf.sync(item.path);
            const n = vscode.workspace.workspaceFolders?.findIndex(f => f.uri.fsPath == item.path);
            if (n !== undefined) vscode.workspace.updateWorkspaceFolders(n, 1);
        }
        catch (e) { catchError(e); }
    }

    return { status: "ok" }
}

