// modules
const vscode = require('vscode');
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const ext = require('./src/extension');
const createNewApp = require("./src/commands/create-app");
const deleteApp = require("./src/commands/delete-app");
const revealExplorer = require("./src/commands/revealExplorer");
const renameApp = require("./src/commands/rename-app");
const stringHelpers = require("./src/string-helpers");
const localData = require("./src/local-data");
const connectToDroidScript = require("./src/commands/connect-to-droidscript");
const DocsTreeData = require("./src/DocsTreeView");
const ProjectsTreeData = require("./src/ProjectsTreeView");
const SamplesTreeData = require("./src/SamplesTreeView");
const CONSTANTS = require("./src/CONSTANTS");

// global constants
const VERSION = 0.28;
const DEBUG = !false;
const scopes = ["app", "MUI", "ui"];

// global variables
let PROJECT = "";
let FOLDER_NAME = "";
let IS_DROIDSCRIPT = false;
/** @type {DSCONFIG_T} */
let DSCONFIG;
let SELECTED_PROJECT = "";

/** @type {vscode.ExtensionContext} */
let GlobalContext;
/** @type {import("ws")|null} */
let webSocket = null;
let lastActivity = "";
/** @type {vscode.StatusBarItem} */
let connectionStatusBarItem;
let connectionStatusShown = false;
/** @type {vscode.StatusBarItem} */
let projectName;
/** @type {vscode.OutputChannel} */
let Debugger;
/** @type {vscode.DiagnosticCollection} */
let diagnosticCollection;
let dsFolders = "Html,Misc,Snd,Img";
let closeSamplePlay = false;
/** @type {DocsTreeData.TreeDataProvider} */
let docsTreeDataProvider;
/** @type {ProjectsTreeData.TreeDataProvider} */
let projectsTreeDataProvider;
/** @type {SamplesTreeData.TreeDataProvider} */
let samplesTreeDataProvider;

/** @type {vscode.StatusBarItem} */
let loadButton;
/** @type {vscode.StatusBarItem} */
let playButton;
/** @type {vscode.StatusBarItem} */
let stopButton;

/** @type {vscode.Uri} */
let folderPath;

/** @type {{[x:string]: import("./completions/app.json")}} */
const scopesJson = {};
scopes.forEach(m => {
    scopesJson[m] = require("./completions/" + m + ".json");
});

// create signatures for all scopes
/** @type {{[x:string]: vscode.SignatureHelp}} */
const signatures = {};
function initSignatures() {
    scopes.forEach(m => {
        signatures[m] = new vscode.SignatureHelp();
        signatures[m].signatures = scopesJson[m].methods.map((/** @type {{ call: string; params: any[]; }} */ n) => {
            const o = new vscode.SignatureInformation(n.call);
            o.parameters = n.params.map((/** @type {{ desc: string; name: string | [number, number]; }} */ q) => {
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
/** @type {{[x:string]: vscode.CompletionItem[]}} */
const completions = {};
function initCompletion() {
    scopes.forEach(m => {
        completions[m] = scopesJson[m].methods.map((n) => {
            const o = new vscode.CompletionItem(n.name);
            const kind = /** @type {keyof typeof vscode.CompletionItemKind}*/ (n.kind);
            o.kind = vscode.CompletionItemKind[kind];
            o.detail = `(${n.kind.toLowerCase()}) ${m}.${n.detail}`;
            o.documentation = new vscode.MarkdownString(n.doc + "\n" + n.param);
            return o;
        });
    });
}

// subscriptions for registerCommands
let subscribe = null;

// This method is called to activate the extension
/** @param {vscode.ExtensionContext} context */
async function activate(context) {

    DSCONFIG = localData.load();
    ext.setCONFIG(DSCONFIG);

    subscribe = (/** @type {string} */ cmd, /** @type {(...args: any[]) => any} */ fnc) => {
        context.subscriptions.push(vscode.commands.registerCommand("droidscript-code." + cmd, fnc));
    }
    subscribe("connect", () => { connectToDroidScript(startWebSocket); });
    subscribe("loadFiles", loadFiles);
    subscribe("stopApp", stop);
    subscribe("addNewApp", () => {
        if (CONNECTED) createNewApp(projectsTreeDataProvider, openProject);
        else showReloadPopup();
    });
    subscribe("refreshProjects", () => {
        if (CONNECTED) projectsTreeDataProvider.refresh();
        else showReloadPopup();
    });
    subscribe("openDroidScriptDocs", openDocs);
    subscribe("learnToConnect", openConnectTutorial);
    // projects
    subscribe("play", play);
    subscribe("stop", stop);
    subscribe("runApp", (/** @type {ProjectsTreeData.TreeItem} */ treeItem) => { play(treeItem.label) });
    subscribe("openApp", openProject);
    subscribe("openAppInNewWindow", openProject);
    subscribe("revealExplorer", (/** @type {ProjectsTreeData.ProjItem} */ treeItem) => { revealExplorer(treeItem, projectsTreeDataProvider) });
    subscribe("deleteApp", (/** @type {ProjectsTreeData.ProjItem} */ args) => { deleteApp(args, projectsTreeDataProvider, onDeleteApp); });
    subscribe("renameApp", (/** @type {ProjectsTreeData.ProjItem} */ args) => { renameApp(args, projectsTreeDataProvider, onRenameApp); });
    // samples
    subscribe("openSample", openSample);
    subscribe("runSample", runSampleProgram);

    let createFile = vscode.workspace.onDidCreateFiles(onCreateFile);
    let deleteFile = vscode.workspace.onDidDeleteFiles(onDeleteFile);
    let onSave = vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument);
    let onRename = vscode.workspace.onDidRenameFiles(onRenameFile);

    // autocompletion and intellisense
    let completionItemProvider = vscode.languages.registerCompletionItemProvider("javascript", {
        provideCompletionItems(doc, pos) {
            const ln = doc.lineAt(pos.line).text;
            const s = ln.substring(0, pos.character - 1).trim().split(" ").pop();
            if (s && completions[s]) return completions[s];
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
            let n1 = ln.substring(0, ln.indexOf(word)).trim();
            let n = n1.replace(/(\s{2,}|\.{2,})/g, ' ')
                .replace(/\. +|\.+/g, ' ').trim()
                .split(/[ .{}*\\+\-]/);
            const scope = n.pop();
            if (scope && scopesJson[scope]) {
                let i = scopesJson[scope].methods.findIndex((/** @type {{ name: string; }} */ m) => m.name == word);
                if (i >= 0) {
                    var m = scopesJson[scope].methods[i];
                    const hc = [
                        new vscode.MarkdownString('```javascript\n' + m.detail + '\n' + '```'),
                        m.doc
                    ];
                    return new vscode.Hover(hc);
                }
            }
            return undefined;
        }
    }
    );

    let signatureHelpProvider = vscode.languages.registerSignatureHelpProvider("javascript", {
        provideSignatureHelp(doc, pos) {
            const ln = doc.lineAt(pos.line).text;
            let s = stringHelpers.getFncCall(ln, pos.character) || '';
            let n1 = ln.substring(0, pos.character - s.length).trim();
            let n = n1.replace(/(\s{2,}|\.{2,})/g, ' ')
                .replace(/\. +|\.+/g, ' ')
                .split(/[ .{}*\\+\-]/);
            let w = n.pop(), scope = null, json = null;
            if (n.length >= 1) {
                scope = n.pop();
                if (!scope || !scopes.includes(scope)) return null;
                json = scopesJson[scope];
            }
            if (!json || !scope) return null;

            let i = json.methods.findIndex((/** @type {{ name: any; }} */ m) => m.name == w);
            if (i < 0) return null;

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

    samplesTreeDataProvider = new SamplesTreeData.TreeDataProvider();
    let samplesTreeView = vscode.window.createTreeView('droidscript-samples', {
        treeDataProvider: samplesTreeDataProvider,
        showCollapseAll: false // Optional: Show a collapse all button in the new TreeView
    });

    setProjectName();
    prepareWorkspace();

    // Version 0.2.6 and above...
    if (VERSION > DSCONFIG.VERSION || DEBUG) {
        // extract assets
        extractAssets();
        // set the version
        DSCONFIG.VERSION = VERSION;

        ext.setCONFIG(DSCONFIG);
        localData.save(DSCONFIG);
    }

    // initialize signatures
    initSignatures();
    // initialize completions
    initCompletion();

    displayConnectionStatus();
}

// This method is called when extension is deactivated
function deactivate() {
    webSocket = null;
    vscode.commands.executeCommand('livePreview.end');
}

// Assets related functions
async function extractAssets() {
    try {
        const homeDir = os.homedir();
        // clear .droidscript folder first
        fs.removeSync(CONSTANTS.LOCALFOLDER);

        await createAssetFolder(CONSTANTS.LOCALFOLDER);
        await createAssetFolder(CONSTANTS.SAMPLES);
        await createAssetFolder(CONSTANTS.SRC);
    } catch (err) {
        console.log(err);
    }
}

/** @param {string} paths */
async function createAssetFolder(paths) {
    try {
        const filePath = path.resolve(os.homedir(), paths);
        fs.mkdirSync(filePath, { recursive: true });
    } catch (err) {
        console.log(err);
    }
}
async function prepareWorkspace() {

    const VSFOLDERS = vscode.workspace.workspaceFolders || [];
    if (!VSFOLDERS || !VSFOLDERS.length) return;

    /** @type {vscode.WorkspaceFolder | undefined} */
    let folder;
    const proj = DSCONFIG.localProjects.find(p =>
        folder = VSFOLDERS.find(ws => ws.uri.fsPath === p.path))
    if (!proj || !folder) return;

    setProjectName(proj.PROJECT);

    // this is from DroidScript CLI
    if (proj.reload) {
        proj.reload = false;

        ext.setCONFIG(DSCONFIG);
        localData.save(DSCONFIG);

        await vscode.commands.executeCommand("droidscript-code.connect");
    }
    else {
        const selection = await vscode.window.showInformationMessage("This folder is a DroidScript app.\nConnect to DroidScript?", "Proceed")
        if (selection !== "Proceed") return;
        await vscode.commands.executeCommand("droidscript-code.connect");
    }

    openProjectFolder(proj);
}

/** @param {vscode.Uri} filePath */
async function openFile(filePath) {
    try {
        // Open the text document
        const document = await vscode.workspace.openTextDocument(filePath);
        // Show the document in the editor
        await vscode.window.showTextDocument(document, vscode.ViewColumn.One);
    } catch (error) {
        vscode.window.showErrorMessage(`Error opening file: ${error.message}`);
    }
}

// Load all files in the selected project
async function loadFiles() {
    if (loadButton && loadButton.text.includes("$(sync~spin)")) return;
    if (PROJECT) {
        if (loadButton) loadButton.text = "$(sync~spin) Downloading..."
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `Fetching files from ${PROJECT} app`,
            cancellable: false
        }, async (proc) => await getAllFiles(PROJECT, proc).catch(catchError));
        if (loadButton) loadButton.text = "$(sync) Reload";
    }
    else {
        vscode.window.showInformationMessage("Open an app in the DroidScript's 'PROJECT' section.");
    }
}

/** 
 * @param {string} folder
 * @param {vscode.Progress<{message?:string, increment?:number}>} proc
 */
async function getAllFiles(folder, proc) {
    folder = folder || PROJECT;
    let data = await ext.listFolder(folder).catch(catchError);
    proc.report({ increment: 0 });

    if (data.status !== "ok") return data.error;
    if (!data.list.length) return "";

    IS_DROIDSCRIPT = true;

    let fileName = "", path = "", filePath = "";
    for (var i = 0; i < data.list.length; i++) {
        fileName = data.list[i], path = folder + "/" + fileName;
        filePath = path.replace(PROJECT + "/", "");
        proc.report({ message: filePath });
        if (!fileName.startsWith("~") && fileName.includes(".")) {
            let response = await ext.loadFile(path).catch(catchError);

            if (response && response.status == "ok") {
                await writeFile(filePath, response.data).catch(catchError);
            }
        }
        else if (dsFolders.includes(fileName) || !fileName.includes(".")) {
            var created = await createFolder(filePath);
            if (created) await getAllFiles(path, proc);
            else vscode.window.showErrorMessage("Error creating " + fileName + " folder");
        }
        proc.report({ increment: 100 * (i + 1) / data.list.length });
    }
}

async function showReloadPopup() {
    const selection = await vscode.window.showInformationMessage("You are currently disconnected!", "Reconnect");
    if (selection === "Reconnect") vscode.commands.executeCommand("droidscript-code.connect");
}

// Write the file to the workspace
/**
 * @param {string} fileName
 * @param {string | NodeJS.ArrayBufferView} content
 */
async function writeFile(fileName, content) {
    if (!FOLDER_NAME) return;
    fs.writeFile(path.join(folderPath.fsPath, fileName), content, { flag: 'w' }).catch(catchError);
}

// Create a folder in the workspace
/** @param {string} path */
async function createFolder(path) {
    if (!vscode.workspace.workspaceFolders) return;
    const workspacePath = vscode.workspace.workspaceFolders[0].uri;
    const fileUri = vscode.Uri.joinPath(workspacePath, path);
    try {
        fs.mkdirSync(fileUri.fsPath, { recursive: true });
        return true;
    } catch (error) {
        return false;
    }
}

// Called when the document is save
/** @type {vscode.TextDocument?} */
let documentToSave = null;
/** @param {vscode.TextDocument} [doc] */
async function onDidSaveTextDocument(doc) {
    if (!IS_DROIDSCRIPT || !PROJECT) return;
    // restartWebsocket()
    lastActivity = "";
    documentToSave = doc || documentToSave;
    if (CONNECTED && documentToSave) {
        if (documentToSave.uri.fsPath.includes(FOLDER_NAME + "/.droidscript")) return;
        var file = documentToSave.uri.fsPath.split(FOLDER_NAME + "/")[1];
        var filePath = PROJECT + "/" + file; // file path on DroidScript server
        let fileName = documentToSave.fileName;
        let folderName = filePath.substring(0, filePath.lastIndexOf("/"));
        let fileContent = documentToSave.getText();

        if (fileName !== CONSTANTS.DSCONFIG) {
            await ext.updateFile(fileContent, folderName, fileName);
        }
        documentToSave = null;
    }
    else {
        lastActivity = "save";
        showReloadPopup();
    }
}

// Delete the file on the workspace
/** @type {vscode.FileDeleteEvent?} */
let filesToDelete = null;
/** @param {vscode.FileDeleteEvent} [e] */
async function onDeleteFile(e) {
    if (!IS_DROIDSCRIPT || !PROJECT) return;
    // restartWebsocket()
    lastActivity = "";
    filesToDelete = e || filesToDelete;
    if (CONNECTED && filesToDelete) {
        let fileName, path, file, filePath;
        for (var i = 0; i < filesToDelete.files.length; i++) {
            path = filesToDelete.files[i].path;
            if (!path.includes(FOLDER_NAME + "/.droidscript")) {
                file = path.split(FOLDER_NAME + "/")[1];
                filePath = PROJECT + "/" + file; // file path on DroidScript
                fileName = path.split("/").pop();
                if (fileName !== "dsconfig.json") {
                    try {
                        await ext.deleteFile(filePath);
                    } catch (error) {
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

/** @type {(error: any) => DSServerResponse<{status:"bad"}>} */
const catchError = (error) => {
    console.error(error);
    vscode.window.showErrorMessage(error.message || error);
    return { status: "bad", error };
}

// Create files and folders on the workspace
/** @type {vscode.FileCreateEvent?} */
let filesToCreate = null;
/** @param {vscode.FileCreateEvent} [e] */
async function onCreateFile(e) {
    if (!IS_DROIDSCRIPT || !PROJECT) return;
    // restartWebsocket()
    lastActivity = "";
    filesToCreate = e || filesToCreate;
    if (CONNECTED && filesToCreate) {
        let fileName, path, file, filePath, folderName, fileExt, fileContent, response, stats, isFile;
        for (var i = 0; i < filesToCreate.files.length; i++) {
            path = filesToCreate.files[i].path;
            if (!path.includes(FOLDER_NAME + "/.droidscript")) {
                isFile = !fs.existsSync(path);
                stats = fs.statSync(path);
                isFile = stats.isFile();
                file = path.split(FOLDER_NAME + "/")[1];
                filePath = PROJECT + "/" + file;
                fileName = path.split("/").pop();
                folderName = filePath.substring(0, filePath.lastIndexOf("/"));
                if (fileName && fileName !== "dsconfig.json") {
                    if (isFile) {
                        fileExt = fileName.split(".").pop();
                        if (fileExt && ext.textFileExtensions.includes(fileExt)) {
                            fileContent = fs.readFileSync(path, 'utf-8');
                            response = await ext.updateFile(fileContent, folderName, fileName);
                        }
                        else response = await ext.uploadFile(path, folderName, fileName);

                        if (response.status !== "ok") {
                            vscode.window.showErrorMessage("An error occured while writing the file in DroidScript.");
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
/** @type {vscode.FileRenameEvent?} */
let filesToRename = null;
/** @param {vscode.FileRenameEvent} [e] */
async function onRenameFile(e) {
    if (!IS_DROIDSCRIPT || !PROJECT) return;
    // restartWebsocket()
    lastActivity = "";
    filesToRename = e || filesToRename;
    if (CONNECTED && filesToRename) {
        let fileName, path1, path2, file1, file2, filePath1, filePath2;
        for (var i = 0; i < filesToRename.files.length; i++) {
            path1 = filesToRename.files[i].oldUri.path;
            if (!path1.includes(FOLDER_NAME + "/.droidscript")) {
                path2 = filesToRename.files[i].newUri.path;
                file1 = path1.split(FOLDER_NAME + "/")[1];
                file2 = path2.split(FOLDER_NAME + "/")[1];
                filePath1 = PROJECT + "/" + file1;
                filePath2 = PROJECT + "/" + file2;
                fileName = path1.split("/").pop();
                if (fileName !== "dsconfig.json") {
                    try {
                        await ext.renameFile(filePath1, filePath2);
                    } catch (error) {
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

    if (!PROJECT) return;

    if (!loadButton) {
        loadButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        loadButton.command = 'droidscript-code.loadFiles';
        loadButton.text = '$(sync) Reload';
        loadButton.tooltip = 'DroidScript: Reload';
        GlobalContext.subscriptions.push(loadButton);
    }

    if (!playButton) {
        playButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        playButton.command = 'droidscript-code.play';
        playButton.text = '$(run) Run';
        playButton.tooltip = 'DroidScript: Run';
        GlobalContext.subscriptions.push(playButton);
    }

    if (!stopButton) {
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
    if (connectionStatusShown) {
        if (CONNECTED) connectionStatusBarItem.text = "$(radio-tower) Connected: " + DSCONFIG.serverIP; // Wi-Fi icon
        else connectionStatusBarItem.text = "$(circle-slash) Connect to droidscript"; // Wi-Fi icon
    }
    else {
        connectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        connectionStatusBarItem.show();
        connectionStatusShown = true;
        connectionStatusBarItem.tooltip = "DroidScript Connection Status";
        connectionStatusBarItem.command = "droidscript-code.connect"; // Replace with your command ID or leave it empty
        if (CONNECTED) connectionStatusBarItem.text = "$(radio-tower) Connected: " + DSCONFIG.serverIP; // Wi-Fi icon
        else connectionStatusBarItem.text = "$(circle-slash) Connect to Droidscript"; // Wi-Fi icon
    }
}

/** 
 * display project name 
 * @param {string} project
 */
function setProjectName(project = "") {
    if (project) PROJECT = project;
    if (!projectName) projectName = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);

    projectName.text = "DroidScript";
    if (PROJECT) projectName.text += ` (${PROJECT})`;
    projectName.command = CONNECTED ? undefined : "droidscript-code.connect";
    projectName.tooltip = CONNECTED ? PROJECT : "Connect";
    projectName.show();
}

function showStatusBarItems() {
    displayControlButtons();
    displayConnectionStatus();
}

function hideStatusBarItems() {
    loadButton.hide();
    playButton.hide();
    stopButton.hide();
    displayConnectionStatus();
}

/** @param {any} APPNAME */
function play(APPNAME) {

    if (!webSocket) return showReloadPopup();

    restartWebsocket();
    if (Debugger) Debugger.clear();
    if (diagnosticCollection) diagnosticCollection.clear();

    // Run the app
    Logger("Running " + (APPNAME || PROJECT) + " app.");
    Logger("");
    ext.play(APPNAME || PROJECT);
}

/** @param {{ label: any; category: any; }} treeItem */
function runSampleProgram(treeItem) {

    let title = treeItem.label;
    let category = treeItem.category;

    if (title.includes("♦")) {
        return vscode.window.showWarningMessage("PREMIUM FEATURE. Please subscribe to 'DroidScript Premium' to run this sample.");
    }

    restartWebsocket();
    if (Debugger) Debugger.clear();
    if (diagnosticCollection) diagnosticCollection.clear();
    Logger("Running " + title + " sample.");
    Logger("");
    ext.runSample(title, category);
}

function stop() {
    if (!webSocket) {
        showReloadPopup();
        return;
    }
    restartWebsocket();
    Logger("");
    Logger("Stopping app.");
    ext.stop();
}

/** @param {string} appName */
function onDeleteApp(appName) {
    if (appName == PROJECT) {
        // stop the websocket the deleted app is the current project
        if (webSocket && webSocket.close) webSocket.close();
        if (projectName) projectName.hide();
    }

    // remove the folder path in the localProjects array
    let i = DSCONFIG.localProjects.findIndex((/** @type {{ path: string; }} */ m) => m.path == folderPath.fsPath) || -1;
    if (i >= 0) {
        DSCONFIG.localProjects.splice(i, 1);
        ext.setCONFIG(DSCONFIG);
        localData.save(DSCONFIG);
    }
}

/**
 * @param {string} appName
 * @param {string} newAppName
 */
async function onRenameApp(appName, newAppName) {
    if (appName == PROJECT) {
        const info = await ext.getProjectInfo(folderPath.fsPath, appName, async p => fs.existsSync(p));
        if (!info) return;
        fs.renameSync(info.file, path.join(folderPath.fsPath, newAppName + "." + ext));

        let proj = DSCONFIG.localProjects.find(m => m.path == folderPath.fsPath);
        if (!proj) return;
        proj.PROJECT = PROJECT;
        proj.reload = true;
        setProjectName(newAppName);

        ext.setCONFIG(DSCONFIG);
        localData.save(DSCONFIG);
    }
}

function restartWebsocket() {
    if (!webSocket) {
        startWebSocket();
    }
}

function startWebSocket() {
    if (!webSocket) {
        webSocket = ext.startWebSocket(wsOnOpen, wsOnMessage, wsOnClose, wsOnError);
    }
}

/** @type {NodeJS.Timer} */
let webSocketKeepAliveTimer;
async function wsOnOpen() {

    DSCONFIG = localData.load();
    ext.setCONFIG(DSCONFIG);
    CONNECTED = true;

    showStatusBarItems();
    Logger("Connected: " + DSCONFIG.serverIP);

    webSocket?.send("debug");
    webSocketKeepAliveTimer = setInterval(function () {
        // Debug.Log("sending keepalive");
        webSocket?.send("keepalive");
    }, 5e3);

    switch (lastActivity) {
        case "save": await onDidSaveTextDocument(); break;
        case "delete": await onDeleteFile(); break;
        case "create": await onCreateFile(); break;
        case "rename": await onRenameFile(); break;
    }

    // Load projects
    await loadFiles();

    // pluginsTreeDataProvider.refresh();
    samplesTreeDataProvider.refresh();
    projectsTreeDataProvider.refresh();
}

/** @param {{ toString: () => any; }} message */
function wsOnMessage(message) {
    var msg = message.toString();
    msg = msg.replace(/%20/g, ' ');
    if (msg.startsWith("Error:") || msg.startsWith("Script Error:")) {
        msg = '❌ ' + msg;
        highlightErrorLine(msg);
    }
    Logger(msg);
}

function wsOnClose() {
    CONNECTED = false;
    Logger("Disconnected");
    if (webSocketKeepAliveTimer) {
        // @ts-ignore
        clearInterval(webSocketKeepAliveTimer);
    }
    webSocket = null;
    hideStatusBarItems();
    setProjectName();
    // pluginsTreeDataProvider.refresh();
    samplesTreeDataProvider.refresh();
    projectsTreeDataProvider.refresh();
}

/** @param {Error} error */
function wsOnError(error) {
    Logger("Connection Error: " + error);
    console.log(error);
}

/** @param {string} log */
function Logger(log) {
    if (Debugger) {
        Debugger.show(true); // Show the output channel in the OUTPUT panel
        Debugger.appendLine(log); // Append the log message to the output channel
    }
}

/** @param {string} msg */
function highlightErrorLine(msg) {
    const str = msg.split("|");
    let err = str[0].split(":")[1];
    let line = parseInt(str[1]);
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
/** @type {vscode.WebviewPanel | null} */
let docsPanel;
/** @param {DocsTreeData.TreeItem} [item] */
async function openDocs(item) {

    if (!docsPanel) {
        docsPanel = vscode.window.createWebviewPanel('dsDocs',
            'Documentation', vscode.ViewColumn.Two,
            { enableScripts: true }
        );
        docsPanel.onDidDispose(e => {
            docsPanel = null;
        });
    }

    const url = DocsTreeData.getUrl(item ? item.contextValue : "Docs.htm");
    console.log("Doc Page: " + url, item);

    docsPanel.webview.html = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>body,html,iframe {width:100%;height:100%;margin:0;padding:0;border:none}</style>
    </head>
    <body><iframe src=${JSON.stringify(url)}></body>
    </html>`;
}

/**
 * @param {ProjectsTreeData.ProjItem & vscode.TreeItem} item
 */
async function openProject(item) {
    SELECTED_PROJECT = item.contextValue || item.title;

    if (SELECTED_PROJECT == PROJECT) {
        return vscode.window.showInformationMessage(`Current folder is already ${SELECTED_PROJECT} app.`);
    }

    const proj = DSCONFIG.localProjects.find(m => m.PROJECT == SELECTED_PROJECT);
    if (proj && !fs.existsSync(proj.path)) {
        return vscode.window.showInformationMessage(`Project has moved or has been deleted`);
    }

    // open existing local project
    if (proj) {
        proj.reload = true;
        ext.setCONFIG(DSCONFIG);
        localData.save(DSCONFIG);
        openProjectFolder(proj);
        return;
    }

    const curPath = path.resolve(folderPath.fsPath, "..", SELECTED_PROJECT);
    const selection = await vscode.window.showInformationMessage("Open folder in current location",
        { modal: true, detail: curPath }, "Current", "Other");

    if (!selection) return;
    let folder = curPath;

    if (selection == "Other") {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: "Choose Project Location",
            title: "Choose Project Folder"
        });

        if (!folders || !folders.length) return;
        folder = folders[0].fsPath;
    }
    else await fs.mkdir(curPath).catch(catchError);

    if (!fs.existsSync(folder)) return vscode.window.showInformationMessage("Selected folder does not exist.");

    /** @type {DSCONFIG_T["localProjects"][number]} */
    const newProj = {
        path: folder,
        PROJECT: SELECTED_PROJECT,
        created: Date.now(),
        reload: false
    }

    DSCONFIG.localProjects.push(newProj);
    ext.setCONFIG(DSCONFIG);
    localData.save(DSCONFIG);

    openProjectFolder(newProj);
    projectsTreeDataProvider.refresh();
    await loadFiles();
    showStatusBarItems();
}

/** 
 * @param {DSCONFIG_T["localProjects"][number]} proj
 */
async function openProjectFolder(proj) {
    FOLDER_NAME = path.basename(proj.path);
    folderPath = vscode.Uri.file(proj.path);
    setProjectName(proj.PROJECT);
    vscode.workspace.updateWorkspaceFolders(Infinity, 0, { uri: folderPath, name: PROJECT })

    const info = await ext.getProjectInfo(proj.path, proj.PROJECT, async p => fs.existsSync(p));
    if (!info) return;

    await openFile(vscode.Uri.file(info.file)).catch(catchError);
    await openDocs().catch(catchError);
}

/** @param {SamplesTreeData.TreeItem} treeItem */
async function openSample(treeItem) {

    let name = treeItem.label + '';
    let code = "";
    let category = treeItem.category;

    if (name.includes("♦")) {
        return vscode.window.showWarningMessage("PREMIUM FEATURE. Please subscribe to 'DroidScript Premium' to open this sample.");
    }

    if (category) code = await ext.getSampleFile(name, category);
    else code = await ext.getSampleFile(name);

    const fileName = category == "python" ? name + ".py" : name + ".js";

    const fileUri = vscode.Uri.joinPath(vscode.Uri.file(os.homedir()), CONSTANTS.SAMPLES, fileName);
    fs.writeFileSync(fileUri.fsPath, code, { flag: 'w' });
    const document = await vscode.workspace.openTextDocument(fileUri);
    await vscode.window.showTextDocument(document);
    if (!closeSamplePlay) {
        // vscode.window.showInformationMessage(`Click PLAY button to run the ${name} sample`);
        vscode.window.showInformationMessage(`Editing sample programs won't be saved!`);
        closeSamplePlay = true;
    }
}

async function openConnectTutorial() {
    const readmePath = path.join(__dirname, "README.md");
    const fileUri = vscode.Uri.file(readmePath);
    await vscode.commands.executeCommand("markdown.showPreview", fileUri);
}

module.exports = {
    activate,
    deactivate
}
