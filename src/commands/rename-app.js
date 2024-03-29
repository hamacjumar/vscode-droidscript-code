const vscode = require('vscode');
const ext = require('../extension');
const fs = require('fs')
const path = require('path');
const localData = require('../local-data');

/** 
 * @param {import("../ProjectsTreeView").ProjItem} item
 * @returns {Promise<{status:'ok',name:string} | {status:'error',error:any} | undefined>}
 */
module.exports = async function (item) {
    const appName = item.title;

    const newAppName = await enterAppName(appName);
    if (!newAppName) return

    let proj = localData.getProjectByName(appName);
    if (!proj) return;
    const info = await ext.getProjectInfo(appName, appName, ext.fileExist);
    if (!info) return;

    try {
        await ext.renameFile(info.file, `${appName}/${newAppName}.${info.ext}`);
        await ext.renameFile(appName, newAppName);

        fs.renameSync(info.file, path.join(proj.path, newAppName + "." + info.ext));
        return { status: 'ok', name: newAppName }
    } catch (e) {
        console.log(e);
        return { status: 'error', error: e.message || e }
    }
}

/** @param {string} appName */
async function enterAppName(appName) {
    const input = await vscode.window.showInputBox({ prompt: `Enter new app name for '${appName}'.`, placeHolder: 'e.g. MyNewApp' });
    if (!input) return;

    const data = await ext.listFolder("");
    if (data && data.status == "ok" && data.list.length) {
        if (data.list.includes(input)) {
            vscode.window.showWarningMessage(`${input} app already exist!`);
            return enterAppName(appName);
        }
    }
    return input;
}