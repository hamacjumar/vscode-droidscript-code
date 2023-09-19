const vscode = require('vscode');
const fs = require("fs");
const path = require("path");
const ext = require('./extension');
const templates = require("./templates");
const getLocalData = require('./get-local-data');

let DSCONFIG = {};
let appType = "";
let appName = "";
let appTemplate = "";
let projectsTreeView = null;
let openNewProject = null;
const TYPES = [
    {label: "Native", description: 'Build android app using native controls'},
    {label: "Html", description: 'Build android app using Html, CSS and Javascript'},
    {label: "Node", description: 'Use the power of NodeJS in your DroidScript app'},
    {label: "Hybrid", description: 'Build a multiplatform application'},
    {label: "Python", description: 'Build android app using python language.'}
];
const TEMPLATES = {
    native: ["Simple", "Game", "Background Service ♦", "Background Job ♦", "Web Server ♦", "Multi-page ♦"],
    node: ["Simple", "Node Server ♦"],
    html: ["Simple"],
    hybrid: ["Simple", "AppBar and Drawer ♦", "Web App ♦", "WYSIWYG ♦"],
    python: ["Simple", "Hybrid"]
};

module.exports = function(args, treeView, openProject) {
    
    projectsTreeView = treeView;
    openNewProject = openProject;

    DSCONFIG = getLocalData();

    const options = {
        placeHolder: 'Select app type',
        ignoreFocusOut: false
    };
    vscode.window.showQuickPick(TYPES, options).then(item => {
        if( item ) {
            appType = item.label.toLowerCase();
            enterAppName();
        }
    });
}

function enterAppName() {
    vscode.window.showInputBox({ prompt: 'Enter app name', placeHolder: 'e.g. MyNewApp' })
    .then( async input => {
        if( input ) {
            const data = await ext.listFolder("");
            if(data && data.status == "ok" && data.list.length) {
                if( data.list.includes(input) ) {
                    vscode.window.showWarningMessage(`${input} app already exist!`);
                    return enterAppName();
                }
            }
            appName = input;

            const options = {
                placeHolder: `Select ${appType} app template`,
                ignoreFocusOut: false
            };
            const TEMPS = TEMPLATES[appType].map(m => {
                return DSCONFIG.premium ? m.replace("♦", "").trim() : m;
            });5
            vscode.window.showQuickPick(TEMPS, options).then(item => {
                if( item ) {
                    appTemplate = item;
                    createApp();
                }
            });
        }
    });
}

async function createApp() {
    try {
        let response = await ext.createApp(appName, appType, appTemplate);
        if(response.status == "ok") {
            if( projectsTreeView ) projectsTreeView.refresh();
            if( openNewProject ) openNewProject( {contextValue: appName} );
        }
    }
    catch( err ) {
        console.log( err );
    }
}