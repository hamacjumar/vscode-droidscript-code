// modules
const vscode = require('vscode');
const fs = require("fs-extra");
const os = require("os");
const path = require("path");

const ext = require('./src/extension');
const debugServer = require('./src/websocket');
const localData = require("./src/local-data");
const connectToDroidScript = require("./src/commands/connect-to-droidscript");
const CONSTANTS = require("./src/CONSTANTS");
const { homePath, excludeFile, batchPromises, first, loadConfig } = require("./src/util");

const DocsTreeData = require("./src/DocsTreeView");
const ProjectsTreeData = require("./src/ProjectsTreeView");
const SamplesTreeData = require("./src/SamplesTreeView");

const createNewApp = require("./src/commands/create-app");
const deleteApp = require("./src/commands/delete-app");
const revealExplorer = require("./src/commands/revealExplorer");
const renameApp = require("./src/commands/rename-app");
const smartDeclare = require('./src/commands/smartDeclare');

const completionItemProvider = require("./src/providers/completionItemProvider");
const hoverProvider = require("./src/providers/hoverProvider");
const signatureHelpProvider = require("./src/providers/signatureHelperProvider");
const codeActionProvider = require("./src/providers/codeActionProvider");

// global variables
let PROJECT = "";
/** @type {DSCONFIG_T} */
let DSCONFIG;

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
let syncButton;
/** @type {vscode.StatusBarItem?} */
let playButton;
/** @type {vscode.StatusBarItem?} */
let stopButton;

/** @type {vscode.Uri} */
let folderPath;

// subscriptions for registerCommands
let subscribe = null;
let startup = true;

// This method is called to activate the extension
/** @param {vscode.ExtensionContext} context */
async function activate(context) {

    CONSTANTS.DEBUG = context.extensionMode == vscode.ExtensionMode.Development;

    DSCONFIG = localData.load();
    dbgServ = debugServer(onDebugServerStart, onDebugServerStop);

    subscribe = (/** @type {string} */ cmd, /** @type {(...args: any[]) => any} */ fnc) => {
        context.subscriptions.push(vscode.commands.registerCommand("droidscript-code." + cmd, fnc));
    }
    subscribe("connect", connectDS);
    subscribe("loadFiles", loadFiles);
    subscribe("extractAssets", extractAssets);
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
    if (CONSTANTS.VERSION > DSCONFIG.VERSION || CONSTANTS.DEBUG) {
        // extract assets
        extractAssets();
        // set the version
        DSCONFIG.VERSION = CONSTANTS.VERSION;
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
    const proj = DSCONFIG.localProjects.find(p => p.PROJECT === PROJECT);
    connectToDroidScript(dbgServ.start);
    if (proj) openProjectFolder(proj);
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
    const uris = (vscode.workspace.workspaceFolders || []).map(ws => ws.uri)
        .concat(vscode.window.visibleTextEditors.map(te => te.document.uri))
    if (!uris.length) return;
    displayConnectionStatus();

    const reload = DSCONFIG.localProjects.find(p => p.PROJECT === DSCONFIG.reload);
    const proj = reload || first(uris, uri => DSCONFIG.localProjects.find(p => uri.fsPath.startsWith(p.path)));
    if (!proj) return;

    // this is from DroidScript CLI
    if (reload || proj.reload) {
        proj.reload = false;
        delete DSCONFIG.reload;
        localData.save(DSCONFIG);
    }
    else {
        const selection = await vscode.window.showInformationMessage(proj.PROJECT + " is a DroidScript app.\nConnect to DroidScript?", "Proceed")
        if (selection !== "Proceed") return;
    }

    setProjectName(proj.PROJECT);
    vscode.commands.executeCommand("droidscript-code.connect");
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

/** @typedef {"dnlAll" | "uplAll" | "updLocal" | "updRemote" | "skip"} SyncAction */
/** @typedef {{ icon: string, text: string, desc: string }} SyncActionItem */
/** @type {{[x in SyncAction]: SyncActionItem}} */
const syncActions = {
    updLocal: { icon: '$(chevron-down)', text: 'Update Local', desc: "downloads only remote files that already exists locally" },
    dnlAll: { icon: '$(fold-down)', text: 'Download All', desc: "downloads all files from the remote" },
    updRemote: { icon: '$(chevron-up)', text: 'Update Remote', desc: "uploads only files that already exist on the remote" },
    uplAll: { icon: '$(fold-up)', text: 'Upload All', desc: "uploads all local files to the remote" },
    skip: { icon: '$(blocked)', text: 'Skip', desc: "Do not sync" }
};
/** @type {SyncAction} */
let lastSyncAction = "updLocal";

// Load all files in the selected project
/** @param {SyncAction} [action] */
async function loadFiles(action) {
    if (syncButton && syncButton.text.includes("$(sync~spin)")) return;

    if (!action) {
        /** @type {(vscode.QuickPickItem & { key: SyncAction })[]} */
        const items = Object.entries(syncActions).map(([key, a]) => ({
            label: a.icon + a.text,
            detail: a.desc,
            picked: key === lastSyncAction,
            key: /** @type {SyncAction}*/ (key)
        }));
        const selection = await vscode.window.showQuickPick(items, {
            title: `Select sync action for \`${PROJECT}\``,
            ignoreFocusOut: true
        });
        if (!selection || selection.key == "skip") return;

        action = lastSyncAction = selection.key;
        displayControlButtons();
    }

    if (PROJECT) {
        if (syncButton) syncButton.text = `$(sync~spin) ${syncActions[action].text}`
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: `${PROJECT}:${syncActions[action].text}...`,
            cancellable: false
        }, async (proc) => await getAllFiles(PROJECT, proc, action || lastSyncAction).catch(catchError));
        if (syncButton) syncButton.text = "$(sync) Sync";
    }
    else {
        vscode.window.showInformationMessage("Open an app in the DroidScript's 'PROJECT' section.");
    }
}

/**
 * @param {string} folder
 * @param {ProjConfig} conf
 * @param {vscode.Progress<{message?:string, increment?:number}>} [proc]
 */
async function indexFolder(folder, conf, proc, listFolder = ext.listFolder, root = folder) {
    folder = folder || PROJECT;
    if (!folder.startsWith('/')) root = folder += '/';
    let data = await listFolder(folder);
    proc?.report({ message: "indexing " + folder });

    if (data.status !== "ok") throw Error(data.error);
    if (!data.list.length) return [];

    /** @type {string[]} */
    const files = [];
    for (var i = 0; i < data.list.length; i++) {
        let file = data.list[i], path = folder + file;
        // ignore hidden files
        if (excludeFile(conf, path.replace(root, ''))) continue;

        if (file.indexOf('.') > 0)
            files.push(path);
        else if (!excludeFile(conf, path.replace(root, '') + '/'))
            files.push(...await indexFolder(path + '/', conf, proc, listFolder, root));
    }
    return files;
}

/** 
* @param {string} folder
* @param {vscode.Progress<{message?:string, increment?:number}>} proc
* @param {SyncAction} action Update existing files. Default is download all
*/
async function getAllFiles(folder, proc, action) {
    if (!CONNECTED) return showReloadPopup();
    const proj = DSCONFIG.localProjects.find(p => p.PROJECT === PROJECT);
    if (!proj) return;
    const conf = loadConfig(proj);

    let remoteFiles = (await indexFolder(folder, conf, proc).catch(e => (catchError(e), [])))
        .map(f => f.replace(PROJECT + '/', ''));
    let localFiles = (await indexFolder(proj.path, conf, proc,
        async p => ({ status: 'ok', list: fs.readdirSync(p) }))
        .catch(e => (catchError(e), [])))
        .map(f => f.replace(proj.path + '/', ''));

    const update = action == "updLocal" || action == "updRemote";
    if (update) {
        localFiles = localFiles.filter(file => remoteFiles.includes(file));
        remoteFiles = [...localFiles];
    }

    const download = action == "dnlAll" || action == "updLocal";
    if (download) {
        const folders = new Set(remoteFiles.map(p => path.dirname(p)));
        for (const folder of folders)
            if (folder != '.') createFolder(folder);

        await batchPromises(remoteFiles, async (file) => {
            proc.report({ message: file, increment: 100 / remoteFiles.length });
            let response = await ext.loadFile(PROJECT + '/' + file);
            if (response.status !== "ok") throw Error(`Error fetching ${file}:\n${response.error}\n${response.data || ''}`)
            writeFile(file, response.data);
        });
    } else {
        await batchPromises(localFiles, async (file) => {
            proc.report({ message: file, increment: 100 / localFiles.length });
            uploadFile(file);
        });
    }
}

async function showReloadPopup() {
    const selection = await vscode.window.showInformationMessage("You are currently disconnected!", "Reconnect");
    if (selection === "Reconnect") vscode.commands.executeCommand("droidscript-code.connect");
}

/** @param {string} filePath */
function getLocalPath(filePath) {
    if (!folderPath) throw Error("Something went wrong");
    return path.resolve(folderPath.fsPath, filePath);
}

/** Write the file to the workspace
 * @param {string} fileName
 * @param {string | NodeJS.ArrayBufferView} content
 */
function writeFile(fileName, content) {
    const filePath = getLocalPath(fileName);
    fs.writeFileSync(filePath, content, { flag: 'w' });
}

/** Create a folder in the workspace
 * @param {string} folderPath 
 */
function createFolder(folderPath) {
    const localPath = getLocalPath(folderPath);
    fs.mkdirSync(localPath, { recursive: true });
}

/** Write the file to remote project
 * @param {string} file
 */
async function uploadFile(file) {
    const localPath = getLocalPath(file);
    const dstDir = path.dirname(PROJECT + '/' + file);
    await ext.uploadFile(localPath, dstDir, path.basename(file));
}

/** 
 * @param {string} filePath
 * @param {LocalProject} [proj]
 */
function getRemotePath(filePath, proj) {
    if (!proj) proj = getFileProject(filePath);
    if (!proj) return null;

    const conf = loadConfig(proj);
    const dsFile = path.relative(proj.path, filePath);
    if (excludeFile(conf, dsFile)) return null;
    return proj.PROJECT + "/" + dsFile.replace(/\\/g, '/');
}

/** 
 * @param {string} filePath
 */
function getFileProject(filePath) {
    return DSCONFIG.localProjects.find(p => filePath.startsWith(p.path));
}

// Called when the document is save
/** @type {vscode.TextDocument[]} */
let documentsToSave = [];
/** @param {vscode.TextDocument} [doc] */
async function onDidSaveTextDocument(doc) {
    if (doc && getFileProject(doc.uri.fsPath)) documentsToSave.push(doc);
    if (documentsToSave.length) return;
    if (!CONNECTED) return showReloadPopup();

    // prevent race conditions
    const fileList = documentsToSave;
    documentsToSave = [];

    await batchPromises(fileList, async doc => {
        const dsFile = getRemotePath(doc.uri.fsPath);
        if (!dsFile) return;

        await ext.uploadFile(doc.uri.fsPath, path.dirname(dsFile), path.basename(dsFile));
    });
}

// Delete the file on the workspace
/** @type {vscode.Uri[]} */
let filesToDelete = [];
/** @param {vscode.FileDeleteEvent} [e] */
async function onDeleteFile(e) {
    if (e) filesToDelete.push(...e.files.filter(f => getFileProject(f.fsPath)));
    if (!filesToDelete.length) return;
    if (!CONNECTED) return showReloadPopup();

    // prevent race conditions
    const fileList = filesToDelete;
    filesToDelete = [];

    await batchPromises(fileList, async file => {
        const dsFile = getRemotePath(file.fsPath);
        if (!dsFile) return;
        await ext.deleteFile(dsFile).catch(catchError);
    });
}

/** @type {(error: any) => DSServerResponse<{status:"bad"}>} */
const catchError = (error) => {
    console.error(error.stack || error.message || error);
    vscode.window.showErrorMessage(error.message || error);
    return { status: "bad", error };
}

// Create files and folders on the workspace
/** @type {vscode.Uri[]} */
let filesToCreate = [];
/** @param {vscode.FileCreateEvent} [e] */
async function onCreateFile(e) {
    if (e) filesToCreate.push(...e.files.filter(f => getFileProject(f.fsPath)));
    if (!filesToCreate.length) return;
    if (!CONNECTED) return showReloadPopup();

    // prevent race conditions
    const fileList = filesToCreate;
    filesToCreate = [];

    await batchPromises(fileList, async file => {
        const dsFile = getRemotePath(file.fsPath);
        if (!dsFile) return;

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
    });
}

// Rename a files in the workspace
/** @type {{oldUri: vscode.Uri, newUri: vscode.Uri}[]} */
let filesToRename = [];
/** @param {vscode.FileRenameEvent} [e] */
async function onRenameFile(e) {
    if (e) filesToRename.push(...e.files.filter(f => getFileProject(f.oldUri.fsPath) && getFileProject(f.newUri.fsPath)));
    if (!filesToRename.length) return;
    if (!CONNECTED) return showReloadPopup();

    // prevent race conditions
    const fileList = filesToRename;
    filesToRename = [];

    await batchPromises(fileList, async file => {
        const oldDsFile = getRemotePath(file.oldUri.fsPath);
        const newDsFile = getRemotePath(file.newUri.fsPath);
        if (!oldDsFile || !newDsFile) return;

        await ext.renameFile(oldDsFile, newDsFile).catch(catchError);
    });
}

// control buttons
function displayControlButtons() {
    if (!PROJECT) return;

    if (!syncButton) {
        syncButton = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left);
        syncButton.command = 'droidscript-code.loadFiles';
        syncButton.text = '$(sync) Sync';
        syncButton.tooltip = 'Sync ' + PROJECT;
        GlobalContext.subscriptions.push(syncButton);
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

    syncButton.show();
    playButton.show();
    stopButton.show();
}

// connection status
function displayConnectionStatus() {
    if (!connectionStatusBarItem) {
        connectionStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right);
        connectionStatusBarItem.tooltip = "DroidScript Connection Status";
        connectionStatusBarItem.command = "droidscript-code.connect"; // Replace with your command ID or leave it empty
    }

    if (CONNECTED) connectionStatusBarItem.text = "$(radio-tower) Connected: " + DSCONFIG.serverIP; // Wi-Fi icon
    else connectionStatusBarItem.text = "$(circle-slash) Connect to Droidscript"; // Wi-Fi icon
    connectionStatusBarItem.show();
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
    syncButton?.hide();
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
    DSCONFIG.reload = proj.PROJECT;
    localData.save(DSCONFIG);
    openProjectFolder(proj);
}

async function downloadDefinitions() {
    let defPath, res;
    for (defPath of CONSTANTS.defPaths) {
        res = await ext.listFolder(defPath);
        if (res.status === "ok" && res.list.length) break;
    }
    if (res?.status !== "ok" || !res.list.length) return;

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
    downloadDefinitions();
    samplesTreeDataProvider.refresh();
    projectsTreeDataProvider.refresh();
    // pluginsTreeDataProvider.refresh();

    checkUnsavedChanges();
    if (!PROJECT) return;

    // Load projects
    await loadFiles();
    projectsTreeDataProvider.refresh();
}

async function checkUnsavedChanges() {
    const changes = [
        ...documentsToSave.map(f => 'save ' + getRemotePath(f.uri.fsPath)),
        ...filesToDelete.map(f => 'delete ' + getRemotePath(f.fsPath)),
        ...filesToCreate.map(f => 'create ' + getRemotePath(f.fsPath)),
        ...filesToRename.map(f => `rename ${getRemotePath(f.oldUri.fsPath)} to ${getRemotePath(f.newUri.fsPath)}`),
    ];
    if (!changes.length) return;

    const selection = await vscode.window.showWarningMessage("Apply unsaved changes to remote project?", {
        modal: true, detail: changes.join('\n')
    }, "Save");
    if (selection != "Save") return;

    if (documentsToSave.length) await onDidSaveTextDocument();
    if (filesToDelete.length) await onDeleteFile();
    if (filesToCreate.length) await onCreateFile();
    if (filesToRename.length) await onRenameFile();
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
    const SELECTED_PROJECT = item.contextValue || item.title;

    let proj = DSCONFIG.localProjects.find(m => m.PROJECT == SELECTED_PROJECT) || null;
    if (proj && !fs.existsSync(proj.path)) proj = null;

    // open existing local project
    if (proj) {
        proj.reload = true;
        DSCONFIG.reload = proj.PROJECT;
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
    await loadFiles("dnlAll");
    showStatusBarItems();
}

/** 
 * @param {LocalProject} proj
 */
async function openProjectFolder(proj) {
    folderPath = vscode.Uri.file(proj.path);
    const isOpen = vscode.workspace.workspaceFolders?.find(ws => ws.uri.fsPath === proj.path);

    if (!isOpen) {
        const selection = await vscode.window.showInformationMessage(`Open '${proj.PROJECT}'?`, {
            modal: true,
            detail: `This will add '${proj.PROJECT}' to your workspace.`
        }, "Open");
        if (selection !== "Open") return;

        const n = vscode.workspace.workspaceFolders?.length || 0;
        const success = vscode.workspace.updateWorkspaceFolders(n, 0, { uri: folderPath, name: proj.PROJECT });
        if (!success) return vscode.window.showWarningMessage("Something went wrong: Invalid Workspace State");
    }

    setProjectName(proj.PROJECT);
    showStatusBarItems();

    try {
        const info = await ext.getProjectInfo(proj.path, proj.PROJECT, async p => fs.existsSync(p));
        if (!info) return vscode.window.showErrorMessage("Couldn't fetch project info.");

        vscode.commands.executeCommand("workbench.explorer.fileView.focus");
        await openFile(vscode.Uri.file(info.file));
        if (startup) await openDocs();
        startup = false;
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
