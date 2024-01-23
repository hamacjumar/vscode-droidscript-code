const vscode = require('vscode');
const ext = require('../extension');
const rimraf = require("rimraf");


/** @type {(error: any) => DSServerResponse<{status:"bad"}>} */
const catchError = (error) => {
    console.error(error.stack || error.message || error);
    vscode.window.showErrorMessage(error.message || error);
    return { status: "bad", error };
}

/** 
 * @param {import("../ProjectsTreeView").ProjItem} item
 * @param {import("../ProjectsTreeView").TreeDataProvider} treeView
 * @param {(appName: string) => void} callback 
 */
module.exports = async function (item, treeView, callback) {
    if (!item || !item.title)
        return vscode.window.showWarningMessage("Selec an app in DroidScript's PROJECTS section!");

    const appName = item.title;
    /** @type {("Remove"|"Delete"|"Cancel")[]} */
    const actions = ["Remove", "Delete", "Cancel"];
    if (!item.path) actions.shift();

    const message = item.path ?
        `Remove local ${appName} app or delete on device?` :
        `Delete ${appName} on device?`;

    const selection = await vscode.window.showWarningMessage(message, ...actions)

    if (selection === "Delete") {
        let response = await ext.deleteFile(appName).catch(catchError);
        if (response.status !== "ok") return vscode.window.showErrorMessage(`Error removing ${appName} app!`);
    }

    if (selection === "Remove" || selection === "Delete") {
        try {
            rimraf.sync(item.path);
            const n = vscode.workspace.workspaceFolders?.findIndex(f => f.uri.fsPath == item.path);
            if (n !== undefined) vscode.workspace.updateWorkspaceFolders(n, 1);
        }
        catch (e) { catchError(e); }
    }

    if (treeView) treeView.refresh();
    if (callback) callback(appName);
}

