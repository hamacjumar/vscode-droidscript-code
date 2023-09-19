
const vscode = require('vscode');
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const ext = require('./src/extension');
const createNewApp = require("./src/create-app");
const deleteApp = require("./src/delete-app");
const renameApp = require("./src/rename-app");
const runSample = require("./src/run-sample");
const stringHelpers = require("./src/string-helpers");
const getLocalData = require("./src/get-local-data");
const saveLocalData = require("./src/save-local-data");
const connectToDroidScript = require("./src/connect-to-droidscript");
const DocsTreeData = require("./src/DocsTreeView");
// const PluginsTreeData = require("./src/PluginsTreeView");
const ProjectsTreeData = require("./src/ProjectsTreeView")
const SamplesTreeData = require("./src/SamplesTreeView");
const CONSTANTS = require("./src/CONSTANTS");

const VERSION = 0.27;
const DOCS_VERSION = "v257";
const DEBUG = false;

let PROJECT = "";
let FOLDER_NAME = "";
let VSFOLDERS = [];
let IS_DROIDSCRIPT = false;
let DSCONFIG = {};
let SELECTED_PROJECT = "";
let RELOAD_PROJECT = false;
let GlobalContext = null;
let actionButtonShown = false;
let webSocket = null;
let lastActivity = "";
let CONNECTED = false;
let connectionStatusBarItem, connectionStatusShown = false, projectName = null;
let Debugger = null, diagnosticCollection = null;
let dsFolders = "Html,Misc,Snd,Img";
let closeSamplePlay = false;
let docsTreeDataProvider = null,
    // pluginsTreeDataProvider = null,
    projectsTreeDataProvider = null,
    samplesTreeDataProvider = null;
let isLivePreviewActive = false;
let loadButton, playButton, stopButton;
let folderPath = "";

const scopes = ["app", "MUI", "ui"];
const scopesJson = {};
scopes.forEach(m => {
    scopesJson[m] = require("./completions/"+m+".json");
});

// create signatures for all scopes
const signatures = {};
function initSignatures() {
    scopes.forEach(m => {
        signatures[m] = new vscode.SignatureHelp();
        signatures[m].signatures = scopesJson[m].methods.map(n => {
            const o = new vscode.SignatureInformation( n.call );
            o.parameters = n.params.map(q => {
                let doc = new vscode.MarkdownString();
                doc.supportHtml = true;
                doc.value = q.desc;
                let parInfo = new vscode.ParameterInformation(q.name);
                parInfo.documentation = doc;
                return parInfo;
            });
            return o;
        });
    });
}

// create completion items for all scopes
const completions = {};
function initCompletion() {
    scopes.forEach(m => {
        completions[m] = scopesJson[m].methods.map(n => {
            const o = new vscode.CompletionItem( n.name );
            o.kind = vscode.CompletionItemKind[ n.kind ];
            o.detail = `(${n.kind.toLowerCase()}) ${m}.${n.detail}`;
            o.documentation = new vscode.MarkdownString( n.doc + "\n" + n.param);
            return o;
        });
    });
}

// subscriptions for registerCommands
let subscribe = null;

function activate( context ) {

    DSCONFIG = getLocalData();

    VSFOLDERS = vscode.workspace.workspaceFolders;
    if(VSFOLDERS && VSFOLDERS.length) {
        FOLDER_NAME = VSFOLDERS[0].name;
        folderPath = VSFOLDERS[0].uri.fsPath;
    }

    subscribe = (cmd, fnc) => {
        context.subscriptions.push( vscode.commands.registerCommand("droidscript-code."+cmd, fnc) );
    }
    subscribe("loadFiles", loadFiles);
    subscribe("runApp", play);
    subscribe("stopApp", stop);
    subscribe("addNewApp", args => {
        if( CONNECTED ) createNewApp(args, projectsTreeDataProvider, openProject);
        else showReloadPopup();
    });
    subscribe("deleteApp", args => { deleteApp(args, projectsTreeDataProvider); });
    subscribe("renameApp", args => { renameApp(args, projectsTreeDataProvider); });
    subscribe("runSample", args => { runSample(args, runSampleProgram); });
    subscribe("openDroidScriptDocs", openDocs);
    // subscribe("openDroidScriptPlugin", openPlugin);
    subscribe("openDroidScriptSample", openSample);
    subscribe("openProject", openProject);
    subscribe("learnToConnect", openConnectTutorial);
    subscribe("play", play);
    subscribe("stop", stop);
    // this is a sample
    subscribe("connect", () => { connectToDroidScript(startWebSocket, RELOAD_PROJECT); });

    let createFile = vscode.workspace.onDidCreateFiles(onCreateFile);
    let deleteFile = vscode.workspace.onDidDeleteFiles(onDeleteFile);
    let onSave = vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument);
    let onRename = vscode.workspace.onDidRenameFiles(onRenameFile);

    // autocompletion and intellisense
    let completionItemProvider = vscode.languages.registerCompletionItemProvider("javascript", {
        provideCompletionItems(doc, pos) {
            const ln = doc.lineAt(pos.line).text;
            const s = ln.substring(0, pos.e-1).trim().split(" ").pop();
            if( completions[s] ) return completions[s];
            return [];
        }
    }, ".");

    let hoverProvider = vscode.languages.registerHoverProvider("javascript", {
            provideHover(doc, pos) {
                const range = doc.getWordRangeAtPosition(pos);
                if (!range) {
                    return undefined;
                }
                const word = doc.getText(range);
                const ln = doc.lineAt(pos.line).text;
                let n = ln.substring(0, ln.indexOf(word)).trim();
                n = n.replace(/(\s{2,}|\.{2,})/g, ' ')
                    .replace(/\. +|\.+/g, ' ').trim()
                    .split(/[ .{}*\\+\-]/);
                const scope = n.pop();
                if( scopesJson[scope] ) {
                    let i = scopesJson[scope].methods.findIndex(m => m.name == word);
                    if(i >= 0) {
                        var m = scopesJson[scope].methods[i];
                        const hc = [
                            new vscode.MarkdownString( '```javascript\n' + m.detail+'\n' + '```' ),
                            m.doc
                        ];
                        return new vscode.Hover( hc );
                    }
                }
                return undefined;
            }
        }
    );

    let signatureHelpProvider = vscode.languages.registerSignatureHelpProvider("javascript", {
        provideSignatureHelp(doc, pos) {
            const ln = doc.lineAt(pos.line).text;
            let s = stringHelpers.getFncCall(ln, pos.e);
            let n = ln.substring(0, pos.e - s.length).trim();
            n = n.replace(/(\s{2,}|\.{2,})/g, ' ')
                .replace(/\. +|\.+/g, ' ')
                .split(/[ .{}*\\+\-]/);
            let w = n.pop(), scope = null, json = null;
            if(n.length >= 1) {
                scope = n.pop();
                if( !scopes.includes(scope) ) return null;
                json = scopesJson[scope];
            }
            if( !json ) return null;

            let i = json.methods.findIndex(m => m.name == w);
            if(i < 0) return null;

            signatures[scope].activeSignature = i;
            signatures[scope].activeParameter = stringHelpers.countCommas(s);

            return signatures[scope];
        }
    }, ["(", ",", " "]);

	context.subscriptions.push(
        onSave,
        createFile,
        deleteFile,
        onRename,
        completionItemProvider,
        hoverProvider,
        signatureHelpProvider
    );

    GlobalContext = context;

    Debugger = vscode.window.createOutputChannel('DroidScript Logs');
    diagnosticCollection = vscode.languages.createDiagnosticCollection('DroidScript Errors');

    // Create the TreeDataProvider for the new View

    projectsTreeDataProvider = new ProjectsTreeData.TreeDataProvider();
    let projectsTreeView = vscode.window.createTreeView('droidscript-projects', {
        treeDataProvider: projectsTreeDataProvider,
        showCollapseAll: false // Optional: Show a collapse all button in the new TreeView
    });

    docsTreeDataProvider = new DocsTreeData.TreeDataProvider();
    let docsTreeView = vscode.window.createTreeView('droidscript-docs', {
        treeDataProvider: docsTreeDataProvider,
        showCollapseAll: false // Optional: Show a collapse all button in the new TreeView
    });

    // pluginsTreeDataProvider = new PluginsTreeData.TreeDataProvider();
    // let pluginsTreeView = vscode.window.createTreeView('droidscript-plugins', {
    //     treeDataProvider: pluginsTreeDataProvider,
    //     showCollapseAll: true // Optional: Show a collapse all button in the new TreeView
    // });

    samplesTreeDataProvider = new SamplesTreeData.TreeDataProvider();
    let samplesTreeView = vscode.window.createTreeView('droidscript-samples', {
        treeDataProvider: samplesTreeDataProvider,
        showCollapseAll: false // Optional: Show a collapse all button in the new TreeView
    });

    if(DSCONFIG.localProjects && DSCONFIG.localProjects.length && VSFOLDERS.length) {
        let ndx = DSCONFIG.localProjects.findIndex(m => m.path == folderPath)
        if(ndx >= 0) {

            PROJECT = DSCONFIG.localProjects[ndx].PROJECT;

            displayProjectName();

            // this is from DroidScript CLI
            if( DSCONFIG.localProjects[ndx].reload ) {
                RELOAD_PROJECT = true;
                DSCONFIG.localProjects[ndx].reload = false;
                saveLocalData( DSCONFIG );
                vscode.commands.executeCommand("droidscript-code.connect");
            }
            else {
                vscode.window.showInformationMessage("DroidScript Project detected. Do you want to connect and reload?", "Connect & Reload").then( selection => {
                    if(selection == "Connect & Reload")
                        vscode.commands.executeCommand("droidscript-code.connect");
                });
            }
        }
    }

    // Version 0.2.6 and above...
    if(VERSION > DSCONFIG.VERSION || DEBUG) {
        // extract assets
        extractAssets();
        // set the version
        DSCONFIG.VERSION = VERSION;

        saveLocalData( DSCONFIG );
    }

    // initialize signatures
    initSignatures();
    // initialize completions
    initCompletion();
    // initialize window
    initWindow();

    displayConnectionStatus()
}

// This method is called when your extension is deactivated
function deactivate() {
    webSocket = null;
    vscode.commands.executeCommand('livePreview.end');
}

// Assets related functions
async function extractAssets() {
    try {
        // clear .droidscript folder first
        await deleteAssetFolder();

        await createAssetFolder( CONSTANTS.LOCALFOLDER );
        await createAssetFolder( CONSTANTS.SAMPLES );
        await createAssetFolder( CONSTANTS.SRC );
        await createAssetFolder( CONSTANTS.DOCS );

        // copy docs folder
        let srcDir = path.join(__dirname, "docs");
        let destDir = path.join(os.homedir(), CONSTANTS.DOCS);
        await fs.copySync(srcDir, destDir, {overwrite: true});
    } catch( err ) {
        console.log( err );
    }
}

async function createAssetFolder( folder ) {
    try {
        const filePath = path.join(os.homedir(), folder);
        await fs.mkdirSync(filePath, { recursive: true });
    } catch( err ) {
        console.log( err );
    }
}

async function deleteAssetFolder() {
    try {
        const lca = path.join(os.homedir(), ".droidscript");
        await fs.removeSync( lca );
    } catch( err ) {
        console.log( err );
    }
}

async function initWindow() {
    let fp = folderPath, appName = "";
    if(DSCONFIG.localProjects && DSCONFIG.localProjects.length) {
        let idx = DSCONFIG.localProjects.findIndex(m => m.path == fp);
        IS_DROIDSCRIPT = idx >= 0;
        if( IS_DROIDSCRIPT ) appName = DSCONFIG.localProjects[idx].PROJECT;
    }
    else return;
    if( !IS_DROIDSCRIPT ) return;
    
    let hasFile = false;
    try {
        if(vscode.window.visibleTextEditors == 0) {
            let rootFile1 = path.join(fp, appName+".js");
            let rootFile2 = path.join(fp, appName+".html");
            let rootFile3 = path.join(fp, appName+".py");
            if( fs.existsSync(rootFile1) ) { await openFile( rootFile1 ); hasFile = true; }
            else if( fs.existsSync(rootFile2) ) { await openFile( rootFile2 ); hasFile = true; }
            else if( fs.existsSync(rootFile3) ) { await openFile( rootFile3 ); hasFile = true; }
            else return;
        }
        if( hasFile ) {
            await openDocs();
        }
    } catch( err ) {
        console.log( err );
    }
}

async function openFile( filePath ) {
    try {
        // Open the text document
        const document = await vscode.workspace.openTextDocument(filePath);
        // Show the document in the editor
        await vscode.window.showTextDocument(document);
    } catch (error) {
        vscode.window.showErrorMessage(`Error opening file: ${error.message}`);
    }
}

// Load all files in the selected project
async function loadFiles() {
    if( PROJECT ) {
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching files from ${PROJECT} app`,
            cancellable: false
        }, async () => {
            try {
                if( loadButton ) loadButton.text  = "$(sync~spin) Downloading..."
                await getAllFiles( PROJECT );
                if( loadButton ) loadButton.text  = "$(sync) Reload"
            } catch(error) {
                vscode.window.showErrorMessage(error.message);
            }
        });
    }
    else {
        vscode.window.showInformationMessage("This folder is not associated with any DroidScript project. Open a project in the DroidScript's Project is section.");
    }
}

async function getAllFiles( folder ) {
    folder = folder || PROJECT;
    try {
        let data = await ext.listFolder( folder );
        if( data.status == "ok" && data.list.length ) {

            IS_DROIDSCRIPT = true;

            let fileName = "", response = {}, path = "", filePath = "";
            for(var i=0; i<data.list.length; i++) {
                fileName = data.list[i], path = folder+"/"+fileName;
                filePath = path.replace(PROJECT+"/", "");
                if(!fileName.startsWith("~") && fileName.includes(".")) {
                    try {
                        response = await ext.loadFile(path);
                        if(response.status == "ok") {
                            try {
                                await writeFile(filePath, response.data);
                            } catch(error) {
                                console.log("Error writing the content of "+fileName);5
                            }
                        }
                    } catch(err) {
                        console.log("Error getting the content of "+fileName);
                    }
                }
                else if(dsFolders.includes(fileName) || !fileName.includes(".")) {
                    var created = await createFolder( filePath );
                    if( created ) await getAllFiles( path );
                    else vscode.window.showErrorMessage("Error creating "+fileName+" folder");
                }
            }
        }
    } catch( err ) {
        console.log( err );
    }
}

function showReloadPopup() {
    vscode.window.showInformationMessage("You are currently disconnected!", "Reconnect").then( selection => {
        if(selection == "Reconnect") {
            vscode.commands.executeCommand("droidscript-code.connect");
        }
    });
}

// Write the file to the workspace
async function writeFile(fileName, content) {

    if( !FOLDER_NAME ) return;

    const fileUri = vscode.Uri.joinPath(VSFOLDERS[0].uri, fileName);
    try {
        await fs.writeFileSync(fileUri.fsPath, content, { flag: 'w' });
    } catch( error ) {
        console.log("Error writing "+error.message);
    }
}

// Create a folder in the workspace
async function createFolder( path ) {
    const workspacePath = vscode.workspace.workspaceFolders[0].uri;
    const fileUri = vscode.Uri.joinPath(workspacePath, path);
    try {
        await fs.mkdirSync(fileUri.fsPath, { recursive: true });
        return true;
    } catch( error ) {
        return false;
    }
}

// Called when the document is save
let documentToSave = null;
async function onDidSaveTextDocument( doc ) {
    if( !IS_DROIDSCRIPT ) return;
    // restartWebsocket()
    lastActivity = "";
    documentToSave = doc || documentToSave;
    if(CONNECTED && documentToSave) {
        if( documentToSave.uri.fsPath.includes(FOLDER_NAME+"/.droidscript") ) return;
        var file = documentToSave.uri.fsPath.split( FOLDER_NAME + "/" )[1];
        var filePath = PROJECT + "/" + file; // file path on DroidScript server
        let fileName = documentToSave.fileName;
        let folderName = filePath.substring(0, filePath.lastIndexOf("/"));
        let fileContent = documentToSave.getText();
        try {
            if(fileName !== CONSTANTS.DSCONFIG) {
                await ext.updateFile(fileContent, folderName, fileName);
            }
        } catch( error ) {
            console.log(error.message);
        }
        documentToSave = null;
    }
    else {
        lastActivity = "save";
        showReloadPopup();
    }
}

// Delete the file on the workspace
let filesToDelete = null;
async function onDeleteFile( e ) {
    if( !IS_DROIDSCRIPT ) return;
    // restartWebsocket()
    lastActivity = "";
    filesToDelete = e || filesToDelete;
    if(CONNECTED && filesToDelete) {
        let fileName, path, file, filePath;
        for(var i=0; i<filesToDelete.files.length; i++) {
            path = filesToDelete.files[i].path;
            if( !path.includes(FOLDER_NAME+"/.droidscript") ) {
                file = path.split( FOLDER_NAME + "/" )[1];
                filePath = PROJECT + "/" + file; // file path on DroidScript
                fileName = path.split("/").pop();
                if(fileName !== "dsconfig.json") {
                    try {
                        await ext.deleteFile( filePath );
                    } catch( error ) {
                        console.log(error.message);
                    }
                }
            }
        }
        filesToDelete = null;
    }
    else {
        lastActivity = "delete";
        showReloadPopup();
    }
}

// Create files and folders on the workspace
let filesToCreate = null;
async function onCreateFile( e ) {
    if( !IS_DROIDSCRIPT ) return;
    // restartWebsocket()
    lastActivity = "";
    filesToCreate = e || filesToCreate;
    if(CONNECTED && filesToCreate) {
        let fileName, path, file, filePath, folderName, fileExt, fileContent, response, stats, isFile;
        for(var i=0; i<filesToCreate.files.length; i++) {
            path = filesToCreate.files[i].path;
            if( !path.includes(FOLDER_NAME+"/.droidscript") ) {
                isFile = !fs.existsSync( path );
                stats = fs.statSync( path );
                isFile = stats.isFile( path );
                file = path.split( FOLDER_NAME + "/" )[1];
                filePath = PROJECT + "/" + file;
                fileName = path.split("/").pop();
                folderName = filePath.substring(0, filePath.lastIndexOf("/"));
                if(fileName !== "dsconfig.json") {
                    if( isFile ) {
                        try {
                            fileExt = fileName.split(".").pop();
                            if( ext.textFileExtensions.includes(fileExt) ) {
                                fileContent = await fs.readFileSync(path, 'utf-8');
                                response = await ext.updateFile(fileContent, folderName, fileName);
                            }
                            else response = await ext.uploadFile(path, folderName, fileName);

                            if(response.status !== "ok") {
                                vscode.window.showErrorMessage("An error occured while writing the file in DroidScript.");
                            }
                        } catch( error ) {
                            console.log(error.message);
                        }
                    }
                    else {
                        // folder
                        // const code = `app.MakeFolder("${filePath}")`;
                        // response = await ext.execute("usr", code);
                        // console.log( response );
                    }
                }
            }
        }
        filesToCreate = null;
    }
    else {
        lastActivity = "create";
        showReloadPopup();
    }
}

// Rename a files in the workspace
let filesToRename = null;
async function onRenameFile( e ) {
    if( !IS_DROIDSCRIPT ) return;
    // restartWebsocket()
    lastActivity = "";
    filesToRename = e || filesToRename;
    if(CONNECTED && filesToRename) {
        let fileName, path1, path2, file1, file2, filePath1, filePath2;
        for(var i=0; i<filesToRename.files.length; i++) {
            path1 = filesToRename.files[i].oldUri.path;
            if( !path1.includes(FOLDER_NAME+"/.droidscript") ) {
                path2 = filesToRename.files[i].newUri.path;
                file1 = path1.split( FOLDER_NAME + "/" )[1];
                file2 = path2.split( FOLDER_NAME + "/" )[1];
                filePath1 = PROJECT + "/" + file1;
                filePath2 = PROJECT + "/" + file2;
                fileName = path1.split("/").pop();
                if(fileName !== "dsconfig.json") {
                    try {
                        await ext.renameFile(filePath1, filePath2);
                    } catch(error) {
                        console.log(error);
                    }
                }
            }
        }
        filesToRename = null;
    }
    else {
        lastActivity = "rename";
        showReloadPopup();
    }
}

// control buttons
function displayControlButtons() {

    if( !PROJECT ) return;

    if( !loadButton ) {
        loadButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        loadButton.command = 'droidscript-code.loadFiles';
        loadButton.text = '$(sync) Reload';
        loadButton.tooltip = 'DroidScript: Reload';
        GlobalContext.subscriptions.push(loadButton);
    }

    if( !playButton ) {
        playButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        playButton.command = 'droidscript-code.play';
        playButton.text = '$(run) Run';
        playButton.tooltip = 'DroidScript: Run';
        GlobalContext.subscriptions.push(playButton);
    }

    if( !stopButton ) {
        stopButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        stopButton.command = 'droidscript-code.stop';
        stopButton.text = '$(debug-stop) Stop';
        stopButton.tooltip = 'DroidScript: Stop';
        GlobalContext.subscriptions.push(stopButton);
    }

    loadButton.show();
    playButton.show();
    stopButton.show();
}
// connection status
function displayConnectionStatus() {
    if( connectionStatusShown ) {
        if( CONNECTED ) connectionStatusBarItem.text = "$(radio-tower) Connected: "+DSCONFIG.serverIP; // Wi-Fi icon
        else connectionStatusBarItem.text = "$(circle-slash) Connect to droidscript"; // Wi-Fi icon
    }
    else {
        connectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        connectionStatusBarItem.show();
        connectionStatusShown = true;
        connectionStatusBarItem.tooltip = "DroidScript Connection Status";
        connectionStatusBarItem.command = "droidscript-code.connect"; // Replace with your command ID or leave it empty
        if( CONNECTED ) connectionStatusBarItem.text = "$(radio-tower) Connected: "+DSCONFIG.serverIP; // Wi-Fi icon
        else connectionStatusBarItem.text = "$(circle-slash) Connect to Droidscript"; // Wi-Fi icon
    }
}
// display project name
function displayProjectName() {

    if( !PROJECT ) return;

    if( !projectName ) projectName = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
    projectName.text = "DroidScript(" + PROJECT + ")";
    projectName.show();
}

function showStatusBarItems() {
    displayProjectName();
    displayControlButtons();
    displayConnectionStatus();
}

function hideStatusBarItems() {
    loadButton.hide();
    playButton.hide();
    stopButton.hide();
    displayConnectionStatus();
}

function play() {

    if( !webSocket ) {
        showReloadPopup();
        return;
    }

    const activeTextEditor = vscode.window.activeTextEditor;
    if( activeTextEditor ) {
        const filePath = activeTextEditor.document.fileName;
        let fileName = "";
        if( filePath.includes( ".droidscript/samples/" ) ) {
            // Run the sample
            fileName = filePath.split("/").pop();
            fileName = fileName.substring(0, fileName.lastIndexOf("."));
            return runSampleProgram( fileName );
        }
    }

    restartWebsocket();
    if( Debugger ) Debugger.clear();
    if( diagnosticCollection ) diagnosticCollection.clear();

    // Run the app
    Logger("Running " + PROJECT + " app.");
    Logger("");
    ext.play(PROJECT);
}

function runSampleProgram( name ) {
    restartWebsocket();
    if( Debugger ) Debugger.clear();
    if( diagnosticCollection ) diagnosticCollection.clear();
    Logger("Running " + name + " sample.");
    Logger("");
    ext.runSample( name );
}

function stop() {
    if( !webSocket ) {
        showReloadPopup();
        return;
    }
    restartWebsocket();
    Logger("");
    Logger("Stopping " + PROJECT + " app.");
    ext.stop();
}

function restartWebsocket() {
    if( !webSocket ) {
        startWebSocket();
    }
}

function startWebSocket() {
    if( !webSocket ) {
        webSocket = ext.startWebSocket(wsOnOpen, wsOnMessage, wsOnClose, wsOnError);
    }
}

let webSocketKeepAliveTimer = null;
async function wsOnOpen() {

    DSCONFIG = getLocalData();

    // get the project associated with DroidScript
    let i = DSCONFIG.localProjects.findIndex(m => m.path == folderPath);
    if(i >= 0) {
        PROJECT = DSCONFIG.localProjects[i].PROJECT;
    }

    CONNECTED = true;
    ext.setConnected(true);
    showStatusBarItems();
    Logger("Connected: "+DSCONFIG.serverIP);

    webSocket.send("debug");
    webSocketKeepAliveTimer = setInterval(function() {
        // Debug.Log("sending keepalive");
        webSocket.send("keepalive")
    }, 5e3);

    switch( lastActivity ) {
        case "save": await onDidSaveTextDocument(); break;
        case "delete": await onDeleteFile(); break;
        case "create": await onCreateFile(); break;
        case "rename": await onRenameFile(); break;
    }

    // Load projects
    await loadFiles();

    // open docs to the side
    await initWindow();

    // pluginsTreeDataProvider.refresh();
    samplesTreeDataProvider.refresh();
    projectsTreeDataProvider.refresh();
}

function wsOnMessage( message ) {
    var msg = message.toString();
    msg = msg.replace(/%20/g, ' ');
    if(msg.startsWith("Error:") || msg.startsWith("Script Error:")) {
        msg = '❌ ' + msg;
        highlightErrorLine( msg );
    }
    Logger( msg );
}

function wsOnClose() {
    CONNECTED = false;
    Logger("Disconnected");
    if( webSocketKeepAliveTimer ) {
        clearInterval( webSocketKeepAliveTimer );
    }
    webSocket = null;
    hideStatusBarItems();
    // pluginsTreeDataProvider.refresh();
    samplesTreeDataProvider.refresh();
    projectsTreeDataProvider.refresh();
}

function wsOnError( error ) {
    Logger("Connection Error: "+error);
    console.log( error );
}

function Logger( log ) {
    if( Debugger ) {
        Debugger.show(true); // Show the output channel in the OUTPUT panel
        Debugger.appendLine(log); // Append the log message to the output channel
    }
}

function highlightErrorLine( msg ) {
    const str = msg.split("|");
    let err = str[0].split(":")[1];
    let line = parseInt( str[1] );
    let file = str[2].split("/").pop();

    // Search for files matching the provided pattern in the workspace
    vscode.workspace.findFiles('**/' + file, null, 1).then((files) => {
        if (files.length > 0) {
            const fileUri = files[0];
            const range = new vscode.Range(line - 1, 0, line - 1, 0);
            const diagnostic = new vscode.Diagnostic(range, err, vscode.DiagnosticSeverity.Error);
            // diagnosticCollection.set(editor.document.uri, [diagnostic]);
            diagnosticCollection.set(fileUri, [diagnostic]);
        }
    });
}

// documentations
async function openDocs( treeItem ) {
    if( isLivePreviewActive ) return;
    const docsPath = path.join(os.homedir(), ".droidscript", "docs", "Docs.htm");
    const fileUri = vscode.Uri.file(docsPath);
    try {
        await vscode.commands.executeCommand('livePreview.start.preview.atFile', fileUri);
        isLivePreviewActive = true;
    } catch( err ) {
        console.log( err );
    }
}

// This function is the starting point on displaying Plugin docs
let pluginPanels = {};
async function openPlugin( treeItem ) {
    let name = treeItem.contextValue;
    const title = name+" Plugin";

    if( pluginPanels[name] ) {
        // console.log( docsPanels[name].visible, docsPanels[name].active );
        pluginPanels[name].reveal();
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        'webviewPanel_'+name,
        title,
        vscode.ViewColumn.One,
        {
            enableScripts: true, // Enable script execution
        }
    );

    try {
        var data = await ext.listFolder(".edit/docs/plugins/"+name);
        if(data && data.status=="ok" && data.list.length) {
            var i = data.list.findIndex( m => {
                return m.toLowerCase() == name+".html";
            });

            if(i < 0) return;

            let url = DSCONFIG.serverIP+"/.edit/docs/plugins/"+name+"/"+data.list[i];

            console.log( url );

            panel.webview.html = `
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <title>Layout</title>
                    <style>
                        * {
                            padding: 0;
                            margin: 0;
                        }
                        body, html {
                            height: 100%;
                            margin: 0;
                            overflow: hidden;
                            background-color: white;
                        }
                        iframe {
                            width: 100%;
                            height: 100%;
                            border: none;
                        }
                        iframe {
                            width: 100%;
                            height: 100%;
                        }
                    </style>
                </head>
                <body>
                    
                    <iframe id="myIframe" sandbox="allow-scripts allow-same-origin" src="${url}"></iframe>
                    
                </body>
                </html>
            `;
            pluginPanels[name] = panel;

            panel.onDidDispose( () => {
                    pluginPanels[name] = null;
                },
                null,
                GlobalContext.subscriptions
            );
        }
        else return;
    } catch( err ) {
        console.log( err );
    }
}

async function openProject( treeItem ) {

    SELECTED_PROJECT = treeItem.contextValue;

    if(SELECTED_PROJECT == PROJECT) {
        vscode.window.showInformationMessage(`Current folder is already ${SELECTED_PROJECT} app.`)
        return;
    }

    let n = -1;
    let folderUri = null;

    if(DSCONFIG.localProjects && DSCONFIG.localProjects.length) {
        n = DSCONFIG.localProjects.findIndex(m => m.PROJECT == SELECTED_PROJECT);
        if(n >= 0 && !fs.existsSync( DSCONFIG.localProjects[n].path )) {
            n = -1;
            delete DSCONFIG.localProjects[n];
            saveLocalData( DSCONFIG );
        }
    }

    if(n >= 0) {
        vscode.window.showInformationMessage("Do you want to open '"+SELECTED_PROJECT+"' app?", "Open", "Cancel").then(async selection => {
            if(selection == "Open") {
                // This will auto reload the folder when opened
                DSCONFIG.localProjects[n].reload = true;
                saveLocalData( DSCONFIG );

                folderUri = vscode.Uri.file( DSCONFIG.localProjects[n].path );
                await vscode.commands.executeCommand('vscode.openFolder', folderUri);
            }
        });
    }
    else if(!PROJECT && VSFOLDERS[0]) {
        vscode.window.showInformationMessage("Do you want to associate this folder as '"+SELECTED_PROJECT+"' app?", "Proceed", "Cancel").then(async selection => {
            if(selection == "Proceed") {
                const newAppFolder = folderPath;
                try {
                    DSCONFIG.localProjects.push({
                        path: newAppFolder,
                        PROJECT: SELECTED_PROJECT,
                        created: new Date().getTime(),
                        reload: false
                    });
                    saveLocalData( DSCONFIG );
                    PROJECT = SELECTED_PROJECT;
                    await loadFiles();
                    showStatusBarItems();
                } catch( error ) {
                    console.log( error )
                }
            }
        });
    }
    else if(PROJECT && n < 0) {
        vscode.window.showInformationMessage("Do you want to open '"+SELECTED_PROJECT+"' app?", "Open", "Cancel").then(async selection => {
            if(selection == "Open") {
                const currFolder = folderPath;
                const parentDir = currFolder.substring(0, currFolder.lastIndexOf("/"))
                const newAppFolder = parentDir + "/" + SELECTED_PROJECT;

                try {
                    fs.mkdirSync(newAppFolder, { recursive: true });
                    DSCONFIG.localProjects.push({
                        path: newAppFolder,
                        PROJECT: SELECTED_PROJECT,
                        created: new Date().getTime(),
                        reload: true
                    });
                    saveLocalData( DSCONFIG );
                    folderUri = vscode.Uri.file( newAppFolder );
                    await vscode.commands.executeCommand('vscode.openFolder', folderUri);
                } catch( error ) {
                    console.log( error )
                }
            }
        });
    }
    else if( !VSFOLDERS.length ) {
        vscode.window.showWarningMessage("There is no open workspace");
    }
}

async function openSample( treeItem ) {
    let name = treeItem.contextValue;

    if( name.includes("\u2666") ) {
        if( !DSCONFIG.premium ) {
            vscode.window.showWarningMessage("PREMIUM FEATURE. Please subscribe to 'DroidScript Premium' to access this sample.");
            return;
        }
        name = name.replace("\u2666", "").trim();
    }
    try {
        const res = await ext.getSampleFile( name );

        if(typeof res.data == "string") {
            res.data = res.data.replace(/\\\'/g, "");
            res.data = JSON.parse(res.data);
        }
        if(res && res.data && res.data.file) {
            let code = res.data.file;
            const fileUri = vscode.Uri.joinPath( vscode.Uri.file(os.homedir()), ".droidscript", "samples", name+".js");
            fs.writeFileSync(fileUri.fsPath, code, { flag: 'w' });
            const document = await vscode.workspace.openTextDocument( fileUri );
            await vscode.window.showTextDocument( document );
            if( !closeSamplePlay ) {
                // vscode.window.showInformationMessage(`Click PLAY button to run the ${name} sample`);
                vscode.window.showInformationMessage(`Editing sample programs won't be saved!`);
                closeSamplePlay = true;
            }
        }
        else {
            vscode.window.showInformationMessage(`Error getting ${name} sample`);
        }
    } catch( err ) {
        vscode.window.showWarningMessage( err );
    }
}

let learnToConnectPanel = null;
async function openConnectTutorial() {

    if( learnToConnectPanel ) {
        learnToConnectPanel.reveal(vscode.ViewColumn.One);
        return;
    }

    const panel = vscode.window.createWebviewPanel(
        'webviewPanel_learnMore',
        "Learn more",
        vscode.ViewColumn.One,
        {
            enableScripts: true, // Enable script execution
        }
    );

    panel.webview.html = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Layout</title>
            <style>
                * {
                    padding: 0;
                    margin: 0;
                    box-sizing: border-box;
                }
                body {
                    padding: 2rem;
                }
                h4 {
                    margin: 1.5rem 0;
                }
                li {
                    margin-top: 1rem;
                    padding: 0px 1rem;
                }
            </style>
        </head>
        <body>
            
            <h1>How to connect to DroidScript?</h1>

            <ol>
                <li>Open DroidScript app on your phone and press the WiFi icon to start the DS WiFi IDE server. You should be able to see the IP Address on the popup message.</li>
                <li>Click the <strong>"Connect"</strong> button in the Projects section or in the Samples section. You can also click the <strong>"Connect to DroidScript"</strong> button in the bottom right corner.</li>
                <li>A popup will be displayed where to enter <strong>"IP Address"</strong> and <strong>"Password"</strong> if necessary.</li>
            </ol>

            <br>
            <br>
            <br>
            
            <h1>How to open an app?</h1>

            <ol>
                <li>If you are successfully connected, expand the <strong>"PROJECTS"</strong> section and select the project you want to open.</li>
                <li>A popup message will open on the bottom right for confirmation.</li>
            </ol>
            
        </body>
        </html>
    `;
    learnToConnectPanel = panel;

    panel.onDidDispose( () => {
            learnToConnectPanel = null;
        },
        null,
        GlobalContext.subscriptions
    );
}

module.exports = {
	activate,
	deactivate
}
