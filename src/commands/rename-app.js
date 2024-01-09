const vscode = require('vscode');
const ext = require('../extension');
const { TreeDataProvider } = require('../ProjectsTreeView');

let appName = "";
let newAppName = "";
/**
 * @type {TreeDataProvider}
 */
let projectsTreeView;
/**
 * @type {((name: string, newname: string) => void) | null}
 */
let CALLBACK = null;

/** 
 * @param {import("../ProjectsTreeView").ProjItem} item
 * @param {import("../ProjectsTreeView").TreeDataProvider} treeView
 * @param {(appName: string, newName: string) => void} callback 
 */
module.exports = function (item, treeView, callback) {
    if (!item || !item.title) {
        return vscode.window.showWarningMessage("Rename an app in DroidScript section under Projects view!");
    }

    appName = item.title + '';
    projectsTreeView = treeView;
    CALLBACK = callback;

    enterAppName();
}

async function enterAppName() {
    const input = await vscode.window.showInputBox({ prompt: "Enter new app name for '" + appName + "'.", placeHolder: 'e.g. MyNewApp' });
    if (!input) return;

    const data = await ext.listFolder("");
    if (data && data.status == "ok" && data.list.length) {
        if (data.list.includes(input)) {
            vscode.window.showWarningMessage(`${input} app already exist!`);
            return enterAppName();
        }
    }
    newAppName = input;
    renameApp();
}

async function renameApp() {
    try {
        const info = await ext.getProjectInfo(appName, appName, ext.fileExist);
        if (!info) return;
        await ext.renameFile(info.file, `${appName}/${newAppName}.${info.ext}`);
        await ext.renameFile(appName, newAppName);

        projectsTreeView.refresh();
        if (CALLBACK) CALLBACK(appName, newAppName);
        vscode.window.showInformationMessage(`${appName} successfully renamed to ${newAppName}.`);
    }
    catch (error) {
        console.log(error);
    }
}