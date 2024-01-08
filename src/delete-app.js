const vscode = require('vscode');
const ext = require('./extension');
const { TreeItem } = require('./ProjectsTreeView');

let appName = "";

/** 
 * @param {import("./ProjectsTreeView").TreeItem} args
 * @param {import("./ProjectsTreeView").TreeDataProvider} treeView
 * @param {(appName: string) => void} callback 
 */
module.exports = async function (args, treeView, callback) {
    if (!args || !args.label) {
        return vscode.window.showWarningMessage("Delete an app in DroidScript's PROJECTS section!");
    }

    appName = args.label + '';
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

