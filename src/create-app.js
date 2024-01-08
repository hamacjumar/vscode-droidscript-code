const vscode = require('vscode');
const ext = require('./extension');
const localData = require('./local-data');
const { TreeDataProvider } = require('./ProjectsTreeView');

/** @type {DSCONFIG_T} */
let DSCONFIG;
let appType = "";
let appName = "";
let appTemplate = "";
/**
 * @type {TreeDataProvider}
 */
let projectsTreeView;
/**
 * @type {((arg0: { contextValue: string; }, arg1: boolean) => void) | null}
 */
let openNewProject = null;
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

module.exports = function (/** @type {any} */ args, /** @type {TreeDataProvider} */ treeView, /** @type {any} */ openProject) {

    projectsTreeView = treeView;
    openNewProject = openProject;

    DSCONFIG = localData.load();

    const options = {
        placeHolder: 'Select app type',
        ignoreFocusOut: false
    };
    vscode.window.showQuickPick(TYPES, options).then(item => {
        if (item) {
            appType = item.label.toLowerCase();
            enterAppName();
        }
    });
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
    appName = input;
    showTemplates();
}

async function showTemplates() {
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
            return showTemplates();
        }
        appTemplate = item;
        createApp();
    }
}

async function createApp() {
    let response = await ext.createApp(appName, appType, appTemplate);
    if (response.status == "ok") {
        if (projectsTreeView) projectsTreeView.refresh();
        if (openNewProject) openNewProject({ contextValue: appName }, true);
    }
}