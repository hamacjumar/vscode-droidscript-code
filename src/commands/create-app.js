const vscode = require('vscode');
const ext = require('../extension');
const localData = require('../local-data');

/** @type {DSCONFIG_T} */
let DSCONFIG;
const TYPES = [
    { label: "Native", description: 'Build android app using native controls' },
    { label: "Html", description: 'Build android app using Html, CSS and Javascript' },
    { label: "Node", description: 'Use the power of NodeJS in your DroidScript app' },
    { label: "Hybrid", description: 'Build a multiplatform application' },
    { label: "Python", description: 'Build android app using python language.' }
];
/** @type {{[x:string]: string[]}} */
const TEMPLATES = {
    native: ["Simple", "Game", "Background Service ♦", "Background Job ♦", "Web Server ♦", "Multi-page ♦"],
    node: ["Simple", "Node Server ♦"],
    html: ["Simple"],
    hybrid: ["Simple", "AppBar and Drawer ♦", "Web App ♦", "WYSIWYG ♦"],
    python: ["Simple", "Hybrid"]
};


module.exports = async function () {
    DSCONFIG = localData.load();

    const name = await enterAppName();
    if (!name) return
    const type = await enterAppType();
    if (!type) return
    const tmpl = await showTemplates(type);
    if (!tmpl) return

    const res = await ext.createApp(name, type, tmpl);
    if (res.status !== "ok") return
    return { title: name }
}

async function enterAppName() {
    const input = await vscode.window.showInputBox({ prompt: 'Enter app name', placeHolder: 'e.g. MyNewApp' })
    if (!input) return;

    const data = await ext.listFolder("");
    if (data && data.status == "ok" && data.list.length) {
        if (data.list.includes(input)) {
            vscode.window.showWarningMessage(`${input} app already exist!`);
            return enterAppName();
        }
    }
    return input;
}

async function enterAppType() {
    const options = {
        placeHolder: 'Select app type',
        ignoreFocusOut: false
    };
    const item = await vscode.window.showQuickPick(TYPES, options);

    if (!item) return
    return item.label.toLowerCase();
}

/** @param {string} appType */
async function showTemplates(appType) {
    const options = {
        placeHolder: `Select ${appType} app template`,
        ignoreFocusOut: false
    };
    const TEMPS = TEMPLATES[appType].map(m =>
        DSCONFIG.info.premium ? m.replace("♦", "").trim() : m);

    const item = await vscode.window.showQuickPick(TEMPS, options);
    if (item) {
        if (item.includes("♦")) {
            vscode.window.showWarningMessage(`${item} is a premium feature.`);
            return showTemplates(appType);
        }
        return item;
    }
}
