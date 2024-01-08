const vscode = require('vscode');
const ext = require('./extension');
const { TreeDataProvider } = require('./ProjectsTreeView');

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
 * @param {import("./ProjectsTreeView").TreeItem} args
 * @param {import("./ProjectsTreeView").TreeDataProvider} treeView
 * @param {(appName: string, newName: string) => void} callback 
 */
module.exports = function (args, treeView, callback) {
    if (!args || !args.label) {
        return vscode.window.showWarningMessage("Rename an app in DroidScript section under Projects view!");
    }

    appName = args.label + '';
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
        await ext.renameFile(appName, newAppName);

        let htmlAppFile = await ext.fileExist(newAppName + "/" + appName + ".html");
        let jsAppFile = await ext.fileExist(newAppName + "/" + appName + ".js");
        let pyAppFile = await ext.fileExist(newAppName + "/" + appName + ".py");

        if (htmlAppFile) {
            await ext.renameFile(newAppName + "/" + appName + ".html", newAppName + "/" + newAppName + ".html");
        }
        else if (jsAppFile) {
            await ext.renameFile(newAppName + "/" + appName + ".js", newAppName + "/" + newAppName + ".js");
        }
        else if (pyAppFile) {
            await ext.renameFile(newAppName + "/" + appName + ".py", newAppName + "/" + newAppName + ".py");
        }

        projectsTreeView.refresh();

        if (CALLBACK) CALLBACK(appName, newAppName);

        vscode.window.showInformationMessage(`${appName} successfully renamed to ${newAppName}.`);
    }
    catch (error) {
        console.log(error);
    }
}