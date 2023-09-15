const vscode = require('vscode');
const fs = require("fs");
const os = require("os");
const path = require("path");
const ext = require('./extension');
const templates = require("./templates");

let appType = "";
let appName = "";
let CONFIG = {};
let projectsTreeView = null;
let openNewProject = null;

module.exports = function(args, treeView, openProject) {
    let connected = ext.getConnected();
    if( !connected ) {
        vscode.window.showWarningMessage("You are not connected to DroidScript!", "Connect", "Cancel")
            .then( selection => {
                if(selection == "Connect") vscode.commands.executeCommand("droidscript-code.loadFiles");
            });
        return;
    }
    projectsTreeView = treeView;
    openNewProject = openProject;

    CONFIG = getLocalData();
    if( !CONFIG.localProjects ) CONFIG.localProjects = [];

    showAppTypes();
}

function showAppTypes() {
    const appTypes = [
        {label: "Native", description: 'Build android app using native controls'},
        {label: "Html", description: 'Build android app using Html, CSS and Javascript'},
        {label: "Node", description: 'Use the power of NodeJS in your DroidScript app'},
        {label: "Hybrid", description: 'Build a multiplatform application'},
        {label: "MUI", description: 'Build android app using native controls with material ui design'}
    ];
    const options = {
        placeHolder: 'Select app type',
        ignoreFocusOut: false
    };
    vscode.window.showQuickPick(appTypes, options).then(item => {
        if (item !== undefined) {
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
            createApp();
        }
    });
}

function createApp() {
    // Just making this a bunch of if-else condition to have a correct type.
    if(appType == "mui") createDSApp("mui");
    else if(appType == "hybrid") createHybridApp();
    else if(appType == "html") createDSApp("html", "html");
    else if(appType == "node") createDSApp("node");
    else createDSApp( "native" );
}

async function createDSApp( type, fileExt="js" ) {
    const workspace = vscode.workspace.workspaceFolders[0];
    const currDir = workspace.uri.fsPath;
    const newAppDir = currDir.substring(0, currDir.lastIndexOf("/")+1) + appName;

    const filePath = path.join(newAppDir, appName+"."+fileExt);

    try {
        // create the new folder associated with the new app
        createFolder( newAppDir );

        // write the code template for the corresponding apptype
        fs.writeFileSync(filePath, templates[type]);

        let response = await ext.updateFile(templates[type], appName, appName+"."+fileExt);
        
        if(response.status == "ok") {
            if( projectsTreeView ) projectsTreeView.refresh();

            if( openNewProject ) openNewProject( {contextValue: appName} );

            // CONFIG.localProjects.push({
            //     path: newAppDir,
            //     PROJECT: appName,
            //     created: new Date().getTime(),
            //     reload: true
            // });
            // await saveLocalData();

            // vscode.window.showInformationMessage(`${appName} app is created successfully!`, `Open ${appName}`)
            // .then( action => {
            //     if( action.includes("Open") ) openNewAppInVSCode( newAppDir );
            // });
        }
        else {
            vscode.window.showErrorMessage(`Error creating ${appName} app!`);
        }
    } catch (err) {
        console.error('Error:', err);
        vscode.window.showErrorMessage(`Error creating ${appName} app!`);
    }
}

async function createHybridApp() {
    const workspace = vscode.workspace.workspaceFolders[0];
    const currDir = workspace.uri.fsPath;
    const dir = currDir.substring(0, currDir.lastIndexOf("/"));
    let newAppDir = path.join(dir, appName);

    try {

        createFolder( newAppDir );

        let filePath = "";
        const files = templates.hybrid;
        for(let i=0; i<files.length; i++) {
            files[i].fileName = files[i].fileName.replace("<appname>", appName);
            files[i].code = files[i].code.replace("<appname>", appName);
            filePath = path.join(newAppDir, files[i].fileName);
            if(files[i].fileName == appName+".js") fs.writeFileSync(filePath, files[i].code);
            await ext.updateFile(files[i].code, appName, files[i].fileName);
        }

        if( projectsTreeView ) projectsTreeView.refresh();

        if( openNewProject ) openNewProject( {contextValue: appName} );

        // CONFIG.localProjects.push({
        //     path: newAppDir,
        //     PROJECT: appName,
        //     created: new Date().getTime(),
        //     reload: true
        // });
        // await saveLocalData();

        // vscode.window.showInformationMessage(`${appName} app is created successfully!`, `Open ${appName}`)
        // .then( action => {
        //     if( action.includes("Open") )  openNewAppInVSCode( newAppDir );
        // });
    } catch ( err ) {
        console.error('Error:', err);
        vscode.window.showErrorMessage(`Error creating ${appName} app!`);
    }
}

async function openNewAppInVSCode( folder ) {
    try {
        const folderUri = vscode.Uri.file( folder );
        await vscode.commands.executeCommand('vscode.openFolder', folderUri);
    }
    catch( error ) {
        console.log( error );
    }
}

function createFolder( folder ) {
    if( !fs.existsSync(folder) ) {
        fs.mkdirSync( folder, { recursive: true } );
    }
}


function getLocalData() {
    var filePath = path.join(os.homedir(), "dsconfig.json");
    if( fs.existsSync(filePath) ) {
        const fileData = fs.readFileSync(filePath, 'utf8');
        var DSCONFIG = JSON.parse( fileData );
        return DSCONFIG;
    }
    return {};
}

async function saveLocalData() {
    try {
        const data = JSON.stringify(CONFIG, null, 2);
        const filePath = path.join(os.homedir(), "dsconfig.json");
        fs.writeFileSync(filePath, data);
    }
    catch( error ) {
        console.log( error );
    }
}