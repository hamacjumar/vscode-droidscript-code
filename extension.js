// modules
const vscode = require('vscode');
const fs = require("fs-extra");
const os = require("os");
const path = require("path");
const ext = require('./src/extension');
const debugServer = require('./src/websocket');
const createNewApp = require("./src/commands/create-app");
const deleteApp = require("./src/commands/delete-app");
const revealExplorer = require("./src/commands/revealExplorer");
const renameApp = require("./src/commands/rename-app");
const localData = require("./src/local-data");
const connectToDroidScript = require("./src/commands/connect-to-droidscript");
const DocsTreeData = require("./src/DocsTreeView");
const ProjectsTreeData = require("./src/ProjectsTreeView");
const SamplesTreeData = require("./src/SamplesTreeView");
const CONSTANTS = require("./src/CONSTANTS");
const { homePath, excludeFile, findGlobalVars } = require("./src/util");

const completionItemProvider = require("./src/providers/completionItemProvider");
const hoverProvider = require("./src/providers/hoverProvider");
const signatureHelpProvider = require("./src/providers/signatureHelperProvider");
const codeActionProvider = require("./src/providers/codeActionProvider");
const { smartDeclare } = require('src/commands/smartDeclare');

// global constants
const VERSION = 0.28;
const DEBUG = !false;

// global variables
let PROJECT = "";
let FOLDER_NAME = "";
let IS_DROIDSCRIPT = false;
/** @type {DSCONFIG_T} */
let DSCONFIG;
let SELECTED_PROJECT = "";

/** @type {vscode.ExtensionContext} */
let GlobalContext;
/** @type {vscode.StatusBarItem?} */
let connectionStatusBarItem;
/** @type {vscode.StatusBarItem?} */
let projectName;
let closeSamplePlay = false;
/** @type {DocsTreeData.TreeDataProvider} */
let docsTreeDataProvider;
/** @type {ProjectsTreeData.TreeDataProvider} */
let projectsTreeDataProvider;
/** @type {SamplesTreeData.TreeDataProvider} */
let samplesTreeDataProvider;
/** @type {ReturnType<debugServer>} */
let dbgServ;

/** @type {vscode.StatusBarItem?} */
let loadButton;
/** @type {vscode.StatusBarItem?} */
let playButton;
/** @type {vscode.StatusBarItem?} */
let stopButton;

/** @type {vscode.Uri} */
let folderPath;

// subscriptions for registerCommands
let subscribe = null;

// This method is called to activate the extension
/** @param {vscode.ExtensionContext} context */
async function activate(context) {

    DSCONFIG = localData.load();
    dbgServ = debugServer(onDebugServerStart, onDebugServerStop);

    subscribe = (/** @type {string} */ cmd, /** @type {(...args: any[]) => any} */ fnc) => {
        context.subscriptions.push(vscode.commands.registerCommand("droidscript-code." + cmd, fnc));
    }
    subscribe("connect", connectDS);
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
    subscribe("runApp", (/** @type {ProjectsTreeData.ProjItem?} */ treeItem) => {
        play(treeItem?.title || PROJECT)
    });
    subscribe("openApp", openProject);
    subscribe("openAppInNewWindow", openProject);
    subscribe("revealExplorer", (/** @type {ProjectsTreeData.ProjItem} */ treeItem) => {
        revealExplorer(treeItem, projectsTreeDataProvider)
    });
    subscribe("deleteApp", (/** @type {ProjectsTreeData.ProjItem} */ args) => {
        deleteApp(args, projectsTreeDataProvider, onDeleteApp);
    });
    subscribe("renameApp", (/** @type {ProjectsTreeData.ProjItem} */ args) => {
        renameApp(args, projectsTreeDataProvider, onRenameApp);
    });
    subscribe("addTypes", addTypes);
    subscribe("autoFormat", autoFormat);
    subscribe("declareVars", smartDeclareVars);
    // samples
    subscribe("openSample", openSample);
    subscribe("runSample", runSampleProgram);

    const createFile = vscode.workspace.onDidCreateFiles(onCreateFile);
    const deleteFile = vscode.workspace.onDidDeleteFiles(onDeleteFile);
    const onSave = vscode.workspace.onDidSaveTextDocument(onDidSaveTextDocument);
    const onRename = vscode.workspace.onDidRenameFiles(onRenameFile);

    // autocompletion and intellisense

    context.subscriptions.push(
        onSave,
        createFile,
        deleteFile,
        onRename,
        completionItemProvider.register(),
        codeActionProvider.register(),
        hoverProvider.register(),
        signatureHelpProvider.register()
    );

    GlobalContext = context;

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

    prepareWorkspace();

    // Version 0.2.6 and above...
    if (VERSION > DSCONFIG.VERSION || DEBUG) {
        // extract assets
        extractAssets();
        // set the version
        DSCONFIG.VERSION = VERSION;
        localData.save(DSCONFIG);
    }

    signatureHelpProvider.init();
    completionItemProvider.init();

    displayConnectionStatus();
}

// This method is called when extension is deactivated
function deactivate() {
    dbgServ.stop();
    vscode.commands.executeCommand('livePreview.end');
}

function connectDS() {
    const proj = DSCONFIG.localProjects.find(p => p.PROJECT === PROJECT)
    if (proj) openProjectFolder(proj);
    connectToDroidScript(dbgServ.start);
}

// Assets related functions
async function extractAssets() {
    try {
        // clear .droidscript folder first
        fs.removeSync(homePath(CONSTANTS.LOCALFOLDER));

        await createAssetFolder(CONSTANTS.LOCALFOLDER);
        await createAssetFolder(CONSTANTS.SAMPLES);
        await createAssetFolder(CONSTANTS.DEFINITIONS);

        const defFolder = path.join(__dirname, "definitions");
        fs.copy(defFolder, homePath(CONSTANTS.DEFINITIONS));
    } catch (e) {
        catchError(e);
    }
}

/** @param {string} paths */
async function createAssetFolder(paths) {
    fs.mkdirSync(homePath(paths), { recursive: true });
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
        localData.save(DSCONFIG);
        vscode.commands.executeCommand("droidscript-code.connect");
    }
    else {
        const selection = await vscode.window.showInformationMessage(proj.PROJECT + " is a DroidScript app.\nConnect to DroidScript?", "Proceed")
        if (selection !== "Proceed") return;
        vscode.commands.executeCommand("droidscript-code.connect");
    }
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

        if (fileName.startsWith("~")) continue;
        proc.report({ message: filePath });

        if (fileName.indexOf(".") > 0) {
            // assume its a file
            let response = await ext.loadFile(path).catch(catchError);
            if (response && response.status == "ok")
                await writeFile(filePath, response.data).catch(catchError);
        }
        else {
            // assume its a folder
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
    await fs.writeFile(path.join(folderPath.fsPath, fileName), content, { flag: 'w' }).catch(catchError);
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

/** 
 * @param {string} filePath
 * @param {LocalProject} [proj]
 */
function getProjectPath(filePath, proj) {
    if (!proj) proj = DSCONFIG.localProjects.find(p => filePath.startsWith(p.path));
    if (!proj) return null;

    const dsFile = path.relative(proj.path, filePath);
    if (excludeFile(proj, dsFile)) {
        console.log("ignored " + dsFile);
        return null;
    }
    return proj.PROJECT + "/" + dsFile.replace(/\\/g, '/');
}

// Called when the document is save
/** @type {vscode.TextDocument?} */
let documentToSave = null;
/** @param {vscode.TextDocument} [doc] */
async function onDidSaveTextDocument(doc) {
    if (!IS_DROIDSCRIPT) return;
    documentToSave = doc || documentToSave;
    if (!documentToSave) return;
    if (!CONNECTED) return showReloadPopup();

    const dsFile = getProjectPath(documentToSave.uri.fsPath);
    if (!dsFile) return;

    await ext.uploadFile(documentToSave.uri.fsPath, path.dirname(dsFile), path.basename(dsFile));
    documentToSave = null;
}

// Delete the file on the workspace
/** @type {vscode.FileDeleteEvent?} */
let filesToDelete = null;
/** @param {vscode.FileDeleteEvent} [e] */
async function onDeleteFile(e) {
    if (!IS_DROIDSCRIPT) return;
    filesToDelete = e || filesToDelete;
    if (!filesToDelete) return;
    if (!CONNECTED) return showReloadPopup();

    for (const file of filesToDelete.files) {
        const dsFile = getProjectPath(file.fsPath);
        if (!dsFile) continue;
        await ext.deleteFile(dsFile).catch(catchError);
    }
    filesToDelete = null;
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
    if (!IS_DROIDSCRIPT) return;
    filesToCreate = e || filesToCreate;
    if (!filesToCreate) return;
    if (!CONNECTED) return showReloadPopup();

    for (const file of filesToCreate.files) {
        const dsFile = getProjectPath(file.fsPath);
        if (!dsFile) continue;

        const stats = fs.statSync(file.fsPath);

        if (stats.isFile()) {
            const response = await ext.uploadFile(file.fsPath, path.dirname(dsFile), path.basename(dsFile));
            if (response.status !== "ok")
                vscode.window.showErrorMessage("An error occured while writing the file in DroidScript.");
        }
        else if (stats.isDirectory()) {
            // folder
            // const code = `app.MakeFolder("${filePath}")`;
            // response = await ext.execute("usr", code);
            // console.log( response );
        }
    }
    filesToCreate = null;
}

// Rename a files in the workspace
/** @type {vscode.FileRenameEvent?} */
let filesToRename = null;
/** @param {vscode.FileRenameEvent} [e] */
async function onRenameFile(e) {
    if (!IS_DROIDSCRIPT) return;
    filesToRename = e || filesToRename;
    if (!filesToRename) return;
    if (!CONNECTED) return showReloadPopup();

    for (const file of filesToRename.files) {
        const oldDsFile = getProjectPath(file.oldUri.fsPath);
        const newDsFile = getProjectPath(file.newUri.fsPath);
        if (!oldDsFile || !newDsFile) continue;

        await ext.renameFile(oldDsFile, newDsFile).catch(catchError);
    }
    filesToRename = null;
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
    if (connectionStatusBarItem) {
        if (CONNECTED) connectionStatusBarItem.text = "$(radio-tower) Connected: " + DSCONFIG.serverIP; // Wi-Fi icon
        else connectionStatusBarItem.text = "$(circle-slash) Connect to droidscript"; // Wi-Fi icon
    }
    else {
        connectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        connectionStatusBarItem.show();
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
    loadButton?.hide();
    playButton?.hide();
    stopButton?.hide();
    displayConnectionStatus();
}

/** @param {string} APPNAME */
function play(APPNAME) {
    if (!CONNECTED) return showReloadPopup();

    dbgServ.playApp(APPNAME || PROJECT, "app");
    ext.play(APPNAME || PROJECT);
}

/** @param {SamplesTreeData.TreeItem} treeItem */
function runSampleProgram(treeItem) {

    let title = (treeItem.label || '') + '';
    let category = treeItem.category || '';

    if (title.includes("♦")) {
        return vscode.window.showWarningMessage("PREMIUM FEATURE. Please subscribe to 'DroidScript Premium' to run this sample.");
    }

    if (!CONNECTED) return showReloadPopup();

    dbgServ.playApp(title, "sample")
    ext.runSample(title, category);
}

function stop() {
    if (!CONNECTED) return showReloadPopup();

    dbgServ.stopApp();
    ext.stop();
}

/** @param {string} appName */
function onDeleteApp(appName) {
    if (appName == PROJECT) {
        dbgServ.stop();
        setProjectName();
    }

    // remove the folder path in the localProjects array
    let i = DSCONFIG.localProjects.findIndex(m => m.path == folderPath.fsPath) || -1;
    if (i >= 0) {
        DSCONFIG.localProjects.splice(i, 1);
        localData.save(DSCONFIG);
    }
}

/** @param {ProjectsTreeData.ProjItem} item */
async function addTypes(item) {
    if (!item.path) return vscode.window.showWarningMessage("Types can be only enabled on local projects.");

    const jsconfigPath = path.join(item.path, "jsconfig.json");
    if (fs.existsSync(jsconfigPath)) return;

    const res = await vscode.window.showInformationMessage("This will add jsconfig.json to your project. Proceed?", "Ok", "Cancel");
    if (res !== "Ok") return;

    try {
        let jsconfig = fs.readFileSync(homePath(CONSTANTS.DEFINITIONS, "jsconfig.json"), "utf8");
        jsconfig = replacePaths(jsconfig, true);
        fs.writeFileSync(jsconfigPath, jsconfig);
    } catch (e) {
        catchError(e);
    }
}

/** @param {ProjectsTreeData.ProjItem} item */
async function autoFormat(item) {
    if (!item.path) return vscode.window.showWarningMessage("AutoFormat can be only enabled on local projects.");

    const settingsPath = path.join(item.path, ".vscode", "settings.json");
    if (fs.existsSync(settingsPath)) return;

    const res = await vscode.window.showInformationMessage("This will add .vscode/settings.json to your project. Proceed?", "Ok", "Cancel");
    if (res !== "Ok") return;

    try {
        fs.mkdirSync(path.dirname(settingsPath), { recursive: true });
        fs.copyFileSync(homePath(CONSTANTS.DEFINITIONS, "settings.json"), settingsPath);
    } catch (e) {
        catchError(e);
    }
}

/** @param {ProjectsTreeData.ProjItem | vscode.Uri} file */
async function smartDeclareVars(file) {
    let uri = file;
    if (!(uri instanceof vscode.Uri)) {
        const info = await ext.getProjectInfo(uri.path || '', uri.title, async p => fs.existsSync(p));
        if (!info) return vscode.window.showWarningMessage("No local project '" + uri.title + "' available.");
        if (info.ext !== "js") return vscode.window.showWarningMessage(uri.title + " is not a JavaScript project.");
        uri = vscode.Uri.file(info.file);
    }

    await smartDeclare(uri);
}

/**
 * @param {string} appName
 * @param {string} newAppName
 */
async function onRenameApp(appName, newAppName) {
    let proj = DSCONFIG.localProjects.find(m => m.PROJECT === appName);
    if (!proj) return;
    const info = await ext.getProjectInfo(proj.path, appName, async p => fs.existsSync(p));
    if (!info) return;

    fs.renameSync(info.file, path.join(proj.path, newAppName + "." + info.ext));

    proj.PROJECT = newAppName;
    proj.reload = true;
    openProjectFolder(proj);
    localData.save(DSCONFIG);
}

async function downloadDefinitions() {
    const defPath = ".edit/docs/definitions/ts/";
    const res = await ext.listFolder(defPath);
    if (res.status !== "ok") return;

    for (const file of res.list) {
        if (!file.endsWith(".d.ts")) continue;

        await createAssetFolder(CONSTANTS.DEFINITIONS).catch(catchError);
        console.log("fetching " + defPath + file);
        const content = await ext.loadFile(defPath + file).catch(catchError);
        if (content.status !== "ok") continue;

        const defFile = homePath(CONSTANTS.DEFINITIONS, "ts", file);
        fs.writeFileSync(defFile, content.data);
    }
}

async function onDebugServerStart() {
    if (documentToSave) await onDidSaveTextDocument();
    if (filesToDelete) await onDeleteFile();
    if (filesToCreate) await onCreateFile();
    if (filesToRename) await onRenameFile();

    samplesTreeDataProvider.refresh();
    // pluginsTreeDataProvider.refresh();

    showStatusBarItems();
    downloadDefinitions();

    // Load projects
    await loadFiles();
    projectsTreeDataProvider.refresh();
}

async function onDebugServerStop() {
    hideStatusBarItems();
    setProjectName();
    // pluginsTreeDataProvider.refresh();
    samplesTreeDataProvider.refresh();
    projectsTreeDataProvider.refresh();
}

// documentations
/** @type {vscode.WebviewPanel?} */
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

    let proj = DSCONFIG.localProjects.find(m => m.PROJECT == SELECTED_PROJECT) || null;
    if (proj && !fs.existsSync(proj.path)) proj = null;

    // open existing local project
    if (proj) {
        proj.reload = true;
        localData.save(DSCONFIG);
        openProjectFolder(proj);
        return;
    }

    /** @type {"Other" | "Current" | undefined} */
    let selection = "Other";
    let folder = folderPath?.fsPath || DSCONFIG.localProjects[0]?.path || "";
    if (folder) {
        folder = path.resolve(folder, "..", SELECTED_PROJECT);
        selection = await vscode.window.showInformationMessage("Open folder in current location",
            { modal: true, detail: folder }, "Current", "Other");
    }

    if (!selection) return;

    if (selection === "Other") {
        const folders = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            openLabel: "Choose Project Location",
            title: "Choose Project Folder"
        });

        if (!folders || !folders.length) return;
        folder = folders[0].fsPath;
    }
    else await fs.mkdir(folder).catch(catchError);

    if (!fs.existsSync(folder)) return vscode.window.showInformationMessage("Selected folder does not exist.");

    /** @type {LocalProject} */
    const newProj = {
        path: folder,
        PROJECT: SELECTED_PROJECT,
        created: Date.now(),
        reload: true
    }

    DSCONFIG.localProjects.push(newProj);
    localData.save(DSCONFIG);

    openProjectFolder(newProj);
    projectsTreeDataProvider.refresh();
    await loadFiles();
    showStatusBarItems();
}

/** 
 * @param {LocalProject} proj
 */
async function openProjectFolder(proj) {
    FOLDER_NAME = path.basename(proj.path);
    folderPath = vscode.Uri.file(proj.path);
    setProjectName(proj.PROJECT);
    const n = vscode.workspace.workspaceFolders?.length || 0;
    vscode.workspace.updateWorkspaceFolders(n, 0, { uri: folderPath, name: PROJECT });

    try {
        const info = await ext.getProjectInfo(proj.path, proj.PROJECT, async p => fs.existsSync(p));
        if (!info) return;

        await openFile(vscode.Uri.file(info.file));
        await openDocs();
    } catch (e) {
        catchError(e);
    }
}

/** @param {string} string */
function replacePaths(string, unix = false) {
    /** @type {{[x:string]:string}} */
    const pathDict = {
        userHome: os.homedir(),
    };

    if (folderPath) {
        pathDict.projectFolder = folderPath.fsPath;
        pathDict.projectName = PROJECT;
        pathDict.WorkspaceFolder = path.dirname(folderPath.fsPath);
    }

    /** @param {string} p */
    const norm = p => p.split(/[/\\]/).join(unix ? path.posix.sep : path.sep)

    return string
        .replace(/\$\{(\w+)\}/g, (m, v) => {
            // @ts-ignore
            if (CONSTANTS[v]) return norm(homePath(CONSTANTS[v]));
            if (pathDict[v]) return norm(pathDict[v]);
            return m;
        })
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

    const fileUri = vscode.Uri.file(homePath(CONSTANTS.SAMPLES, fileName));
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
