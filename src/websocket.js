const vscode = require('vscode');
const WebSocket = require('ws');
const localData = require('./local-data');

/** @type {DSCONFIG_T} */
let DSCONFIG;

/** @type {import("ws")|null} */
let webSocket = null;
/** @type {vscode.OutputChannel} */
let Debugger;
/** @type {vscode.DiagnosticCollection} */
let diagnosticCollection;
CONNECTED = false;

let _onOpen = () => { };
let _onClose = () => { };

module.exports = function (onStart = _onOpen, onStop = _onClose) {
    DSCONFIG = localData.load();
    Debugger = vscode.window.createOutputChannel('DroidScript Logs');
    diagnosticCollection = vscode.languages.createDiagnosticCollection('DroidScript Errors');

    _onOpen = onStart;
    _onClose = onStop;

    return {
        start: () => startWebSocket(true),
        stop: () => webSocket?.close(),
        playApp,
        stopApp
    }
}

/** 
 * @param {string} appname
 * @param {"app"|"sample"} type 
 */
function playApp(appname, type) {
    startWebSocket();
    Debugger?.clear();
    diagnosticCollection?.clear();

    // Run the app
    Logger("Running " + appname + " " + type + ".");
    Logger("");
}

function stopApp() {
    startWebSocket();
    Logger("");
    Logger("Stopping app.");
}

// WebSocket
const createWebSocket = function (/** @type {(this: WebSocket) => void} */ onOpen, /** @type {(this: WebSocket, data: WebSocket.RawData, isBinary: boolean) => void} */ onMessage, /** @type {(this: WebSocket, code: number, reason: Buffer) => void} */ onClose, /** @type {(this: WebSocket, err: Error) => void} */ onError) {
    const url = DSCONFIG.serverIP.replace("http", "ws") || '';
    const socket = new WebSocket(url);
    socket.on('open', onOpen);
    socket.on('message', onMessage);
    socket.on('close', onClose);
    socket.on('error', onError);
    return socket;
}

function startWebSocket(reload = false) {
    if (webSocket) reload && wsOnOpen();
    else webSocket = createWebSocket(wsOnOpen, wsOnMessage, wsOnClose, wsOnError);
}

/** @type {NodeJS.Timer} */
let webSocketKeepAliveTimer;
async function wsOnOpen() {
    CONNECTED = true;

    Logger("Connected: " + DSCONFIG.serverIP);

    webSocket?.send("debug");
    webSocketKeepAliveTimer = setInterval(function () {
        // Debug.Log("sending keepalive");
        webSocket?.send("keepalive");
    }, 5e3);

    _onOpen();
}

/** @param {{ toString: () => any; }} message */
function wsOnMessage(message) {
    var msg = message.toString();
    msg = msg.replace(/%20/g, ' ');
    if (msg.toLowerCase().startsWith("error:") || msg.startsWith("Script Error:")) {
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
    _onClose();
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
async function highlightErrorLine(msg) {
    const str = msg.split("|");
    const err = str[0].split(":")[1];
    const line = parseInt(str[1]) - 1;
    const file = str[2].split("/").pop();

    // Search for files matching the provided pattern in the workspace
    const files = await vscode.workspace.findFiles('**/' + file, null, 1);
    if (!files.length) return;

    const fileUri = files[0];
    const doc = await vscode.workspace.openTextDocument(fileUri);
    const edt = vscode.window.visibleTextEditors.find(e => e.document === doc);

    const range = new vscode.Range(line, 0, line, doc.lineAt(line).text.length);
    edt?.revealRange(range);

    const diagnostic = new vscode.Diagnostic(range, err, vscode.DiagnosticSeverity.Error);
    diagnosticCollection.set(fileUri, [diagnostic]);
}
