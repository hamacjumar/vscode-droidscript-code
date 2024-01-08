/*
    Author: Jumar B. Hamac
    Contact: hamacjumar@gmail.com

    This is a wrapper to the DS Code extension.
*/

const axios = require('axios').default;
const querystring = require('querystring');
const FormData = require('form-data');
const WebSocket = require('ws');
const fs = require('fs');
const CONSTANTS = require("./CONSTANTS");

let CONNECTED = false;
/** @type {DSCONFIG_T} */
let DSCONFIG = {};

const excludedFoldersAndFiles = ["AABs", "APKs", "SPKs", "PPKs", "Plugins", "Extensions", ".edit", ".node", "~DocSamp", ".redirect.html", "index.html"];
const textFileExtensions = 'html, js, css, txt, md, json, xml, csv, yaml, yml, sql, php, py, rb, java, c, cpp, h, cs, pl, sh, ps1';
const dataFileExtensions = '.mp4, .mp3, .ppk, .apk, .spk, .png, .jpg, .jpeg, .pdf, .docx, .xlsx, .pptx, .zip';

/** @type {(IP: string) => Promise<DSCONFIG_T|{status:"bad",data:any}>} */
async function getServerInfo(IP) {
    const url = `${(IP || DSCONFIG.serverIP)}/ide?cmd=getinfo`;
    try {
        let response = await axios.get(url, { timeout: 5000 });
        if (response.status == 200 && response.data && response.data.status == "ok") {
            return response.data
        } else {
            return { status: "bad", data: response.data }
        }
    } catch (error) {
        return { status: "bad", data: error }
    }
}

/**
 * @param {string} password
 */
async function login(password) {
    const pass = Buffer.from(password, "utf-8").toString("base64");
    const url = `${DSCONFIG.serverIP}/ide?cmd=login&pass=${pass}`;
    try {
        let response = await axios.get(url);
        return response;
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

/**
 * @param {string} folder
 */
async function listFolder(folder) {

    if (!CONNECTED) return null;

    const url = `${DSCONFIG.serverIP}/ide?cmd=list&dir=${querystring.escape(folder)}`;
    try {
        const response = await axios.get(url);
        return /** @type {{status:"ok", list:string[]}} */ (response.data);
    }
    catch (error) {
        return /** @type {{status:"bad", error:any}} */ ({ status: "bad", error: error })
    }
}

/**
 * @param {string} name
 * @param {any} type
 * @param {string} template
 */
async function createApp(name, type, template) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=add&prog=${querystring.escape(name)}&type=${type}&template=${querystring.escape(template)}`;
    try {
        const response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error }
    }
}

/**
 * @param {string} path
 */
async function loadFile(path) {
    const url = `${DSCONFIG.serverIP}/${querystring.escape(path)}`;
    const fileExt = path.split('.').pop() || '';
    /** @type {import('axios').AxiosRequestConfig} */
    let options = { responseType: 'arraybuffer' };
    if (textFileExtensions.includes(fileExt)) options = { responseType: 'text' };
    try {
        const response = await axios.get(url, options);
        return { status: "ok", data: response.data }
    }
    catch (error) {
        return { status: "bad", error: error }
    }
}

/**
 * @param {any} text
 * @param {string} folder
 * @param {any} file
 */
async function updateFile(text, folder, file) {
    const url = `${DSCONFIG.serverIP}/upload`;
    const formData = new FormData();
    formData.append(folder, text, { filename: file });
    try {
        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });
        return { status: "ok", data: response.data }
    } catch (error) {
        console.error(error);
        return { status: "bad", message: error }
    }
}

// Rename the file in the project's folder
/**
 * @param {string} file
 * @param {string} newname
 */
async function renameFile(file, newname) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=rename&file=${querystring.escape(file)}&newname=${querystring.escape(newname)}`;
    try {
        await axios.get(url);
        return { status: "ok" };
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

// Delete a file in the project's folder
/**
 * @param {string} file
 */
async function deleteFile(file) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=delete&file=${querystring.escape(file)}`;
    try {
        let response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

async function getSamples(type = "js") {
    /** @type {{type:"array",samples:string[]} | {type:"json",samples:any}} */
    let data = { type: "array", samples: [] };

    if (!CONNECTED) return data;

    if ((DSCONFIG.version || 0) < 3) {
        const url = `${DSCONFIG.serverIP}/ide?cmd=getsamples&type=${type}`;
        try {
            const response = await axios.get(url);
            if (response && response.status == 200 && response.data.status == "ok") {
                const files = response.data.samples.split("|");
                const samples = files.map((/** @type {string} */ m) => {
                    var line = m.split(":");
                    return line[0].replace("&#9830;", " ♦").trim();
                });
                data = {
                    type: "array",
                    samples
                }
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    else {
        let serverIP = DSCONFIG.serverIP?.replace(DSCONFIG.PORT || '', CONSTANTS.SAMPLE_PORT);
        const url = `${serverIP}/getAllSamples`;
        try {
            const response = await axios.get(url);
            if (response && response.status == 200 && response.data.status) {
                data = {
                    type: "json",
                    samples: response.data.message
                }
            }
        }
        catch (error) {
            console.log(error);
        }
    }

    return data;
}

/**
 * @param {string} name
 * @param {any} category
 */
async function getSampleFile(name, category) {
    // NetUtils.getServerUrl("ide?cmd=get&file=" + u + currentSampleFile)

    let code = "";
    const title = name.split(" ").join("_");

    if (category) {
        let serverIP = DSCONFIG.serverIP?.replace(DSCONFIG.PORT || '', CONSTANTS.SAMPLE_PORT);
        const url = `${serverIP}/getSample?category=${category}&title=${name}`;
        try {
            const res = await axios.get(url);
            if (res && res.data && res.data.status) {
                code = res.data.message;
            }
        }
        catch (error) {
            console.log(error);
        }
    }
    else {
        const url = `${DSCONFIG.serverIP}/ide?cmd=get&file=/assets/samples/${title}.js`;
        try {
            const res = await axios.get(url);
            if (typeof res.data == "string") {
                res.data = res.data.replace(/\\\'/g, "");
                res.data = JSON.parse(res.data);
            }
            if (res && res.data && res.data.file) {
                code = res.data.file;
            }
        }
        catch (error) {
            console.log(error);
        }
    }

    console.log(code);

    return code;
}

/**
 * @param {string} name
 * @param {any} category
 */
async function runSample(name, category) {

    if (category) {
        let code = await getSampleFile(name, category);
        const regex1 = /import\s*app/;
        const regex2 = /import\s*ui/;
        if (regex1.test(code) || regex2.test(code)) code = "python:" + code;
        return execute("app", code);
    }

    const n = name.split(" ").join("_");
    let url = `${DSCONFIG.serverIP}/ide?cmd=sample&name=${n}`;

    try {
        await axios.get(url);
    }
    catch (error) {
        console.log(error);
    }
}

/**
 * @param {string} appName
 */
async function play(appName) {
    const dummyUrl = `${DSCONFIG.serverIP}/ide?cmd=dummy`;
    const playUrl = `${DSCONFIG.serverIP}/ide?cmd=run&prog=${querystring.escape(appName)}`;
    try {
        await axios.get(dummyUrl);
        await axios.get(playUrl);
        return { status: "ok" };
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

async function stop() {
    const url = `${DSCONFIG.serverIP}/ide?cmd=stop`;
    try {
        await axios.get(url);
        return { status: "ok" };
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

/**
 * @param {string} filePath
 */
async function fileExist(filePath) {
    const url = `${DSCONFIG.serverIP}/${querystring.escape(filePath)}`;
    try {
        let res = await axios.get(url);
        if (res && res.status == 200 && res.statusText == "OK") return true;
        return false;
    }
    catch (err) {
        return false;
    }
}

const setCONFIG = function (/** @type {DSCONFIG_T} */ config) {
    DSCONFIG = config;
}

const getCONFIG = function () {
    return DSCONFIG;
}

// WebSocket
const startWebSocket = function (/** @type {(this: WebSocket) => void} */ onOpen, /** @type {(this: WebSocket, data: WebSocket.RawData, isBinary: boolean) => void} */ onMessage, /** @type {(this: WebSocket, code: number, reason: Buffer) => void} */ onClose, /** @type {(this: WebSocket, err: Error) => void} */ onError) {
    const url = DSCONFIG.serverIP?.replace("http", "ws") || '';
    const socket = new WebSocket(url);
    socket.on('open', onOpen);
    socket.on('message', onMessage);
    socket.on('close', onClose);
    socket.on('error', onError);
    return socket;
}

/**
 * @param {fs.PathLike} filePath
 * @param {string} folder
 * @param {any} fileName
 */
async function uploadFile(filePath, folder, fileName) {
    const url = `${DSCONFIG.serverIP}/upload`;
    const formData = new FormData();
    formData.append(folder, fs.createReadStream(filePath), { filename: fileName });
    try {
        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });
        return { status: "ok", data: response.data }
    } catch (error) {
        console.error(error);
        return { status: "bad", message: error }
    }
}

const setConnected = function (/** @type {boolean} */ value) {
    CONNECTED = value;
}

const getConnected = function () {
    return CONNECTED;
}

//Execute code on the device.
//'app' mode runs as a stand-alone app.
//'ide' mode runs inside ide.
//'usr' mode runs inside current user app.
/**
 * @param {string} mode
 * @param {(string | { valueOf(): string; }) | { [Symbol.toPrimitive](hint: "string"): string; }} code
 */
async function execute(mode, code) {
    // xmlHttp = new XMLHttpRequest();
    // xmlHttp.open( "get", "/ide?cmd=execute&mode="+mode+"&code="+encodeURIComponent(btoa(code)), true );
    // xmlHttp.send();
    const encodedData = Buffer.from(code, 'utf8').toString('base64');
    const url = `${DSCONFIG.serverIP}/ide?cmd=execute&mode=${mode}&code=${querystring.escape(encodedData)}`;
    try {
        const response = await axios.get(url);
        return response;
    }
    catch (error) {
        console.log(error);
        return null;
    }
}

/**
 * @param {string} cmd
 */
async function executeCommand(cmd) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=execute&code=${querystring.escape(cmd)}`;
    try {
        const response = await axios.get(url);
        return response;
    }
    catch (error) {
        console.log(error);
        return null;
    }
}

module.exports = {
    DSCONFIG,
    listFolder,
    createApp,
    loadFile,
    updateFile,
    deleteFile,
    renameFile,
    getSamples,
    getSampleFile,
    runSample,
    excludedFoldersAndFiles,
    textFileExtensions,
    dataFileExtensions,
    play,
    stop,
    fileExist,
    setCONFIG,
    getCONFIG,
    login,
    startWebSocket,
    getServerInfo,
    uploadFile,
    setConnected,
    getConnected,
    execute,
    executeCommand
}
