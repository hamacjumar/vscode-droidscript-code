const vscode = require('vscode');
const ext = require('../extension');

let appName = "";

/** 
 * @param {import("../ProjectsTreeView").ProjItem} item
 * @param {import("../ProjectsTreeView").TreeDataProvider} treeView
 * @param {(appName: string) => void} callback 
 */
module.exports = async function (item, treeView, callback) {
    if (!item || !item.title) {
        return vscode.window.showWarningMessage("Selec an app in DroidScript's PROJECTS section!");
    }

    appName = item.title + '';
    const selection = await vscode.window.showWarningMessage(`Do you want to remove ${appName} app?`, "Remove", "Cancel")
    if (selection !== "Remove") return;

    let response = await ext.deleteFile(appName);
    if (response.status == "ok") {
        if (treeView) treeView.refresh();
        if (callback) callback(appName);
    }
    else {
        vscode.window.showErrorMessage(`Error removing ${appName} app!`);
    }
}

