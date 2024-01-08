
const vscode = require("vscode");

let appName = "";
let CALLBACK = null;
let packageName = "";
let version = "1.0";
let obfuscate = true;

module.exports = function (treeItem, callback) {

    appName = treeItem.label;
    CALLBACK = callback;

    enterPackageName();
}

async function enterPackageName() {
    const userInput = await vscode.window.showInputBox({
        placeHolder: "com.mycompany." + appName.toLowerCase(),
        prompt: 'Enter package name',
    });

    if (!userInput) return enterPackageName();

    packageName = userInput;

    enterVersion();
}

async function enterVersion() {
    const userInput = await vscode.window.showInputBox({
        placeHolder: version,
        prompt: 'Enter build version',
    });

    if (!userInput) return enterVersion();

    version = userInput;

    CALLBACK(`!buildapk ${packageName} ${version} ${obfuscate}`);
}