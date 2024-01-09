const fs = require('fs');
const vscode = require('vscode');

/** 
 * @param {import("../ProjectsTreeView").ProjItem} item
 * @param {import("../ProjectsTreeView").TreeDataProvider} treeView
 */
module.exports = async function (item, treeView) {
    if (!item) return vscode.window.showWarningMessage("Select an app in DroidScript's PROJECTS section!");
    if (!item.path) return vscode.window.showErrorMessage("No associated local path.");

    let dir = item.path + '';
    if (!dir || !fs.existsSync(dir))
        return vscode.window.showErrorMessage("Path " + item.path + " doesn't exist!");

    const uri = vscode.Uri.file(dir);
    vscode.commands.executeCommand("revealFileInOS", uri);
}

