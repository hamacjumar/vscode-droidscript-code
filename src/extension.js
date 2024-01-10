/*
    Author: Jumar B. Hamac
    Contact: hamacjumar@gmail.com

    This is a wrapper to the DS Code extension.
*/

const _axios = require('axios').default;
const querystring = require('querystring');
const FormData = require('form-data');
const fs = require('fs');
const CONSTANTS = require("./CONSTANTS");

CONNECTED = false;
/** @type {DSCONFIG_T} */
let DSCONFIG;

const excludedFoldersAndFiles = ["AABs", "APKs", "SPKs", "PPKs", "Plugins", "Extensions", ".edit", ".node", "~DocSamp", ".redirect.html", "index.html", "_sdk_", ".license.txt"];
const textFileExtensions = 'html, js, css, txt, md, json, xml, csv, yaml, yml, sql, php, py, rb, java, c, cpp, h, cs, pl, sh, ps1'.split(", ");
const dataFileExtensions = '.mp4, .mp3, .ppk, .apk, .spk, .png, .jpg, .jpeg, .pdf, .docx, .xlsx, .pptx, .zip'.split(", ");

const axios = {
    /** @type {<T>(url: string, res:T) => T} */
    intercept: (url, res) => {
        // @ts-ignore
        if (typeof res.data !== "string") console.log(url, res.data);
        // @ts-ignore
        else console.log(url, JSON.stringify(res.data.slice(0, 100)));
        return res;
    },

    /** @type {typeof _axios.get} */
    get: async (url, config) => axios.intercept(url, await _axios.get(url, config)),

    /** @type {typeof _axios.post} */
    post: async (url, data, config) => await _axios.post(url, data, config),
}

/** @type {(error: any) => {status: undefined, data: DSServerResponse<{status:"bad"}>}} */
const catchError = (error) => {
    console.error(error);
    return { status: undefined, data: { status: "bad", error } };
}

/** @type {(IP?: string) => Promise<DSServerResponse<DSCONFIG_T>>} */
async function getServerInfo(IP = '') {
    const url = `${(IP || DSCONFIG.serverIP)}/ide?cmd=getinfo`;
    let response = await axios.get(url, { timeout: 5000 }).catch(catchError);
    return response.data;
}

/** @type {(password: string) => Promise<DSServerResponse>} */
async function login(password) {
    const pass = Buffer.from(password, "utf-8").toString("base64");
    const url = `${DSCONFIG.serverIP}/ide?cmd=login&pass=${pass}`;
    try {
        let response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return /** @type {{status:"bad", error:any}} */ ({ status: "bad", error: error });
    }
}

/** @type {(password: string) => Promise<DSServerResponse<{list:string[]}>>} */
async function listFolder(folder) {

    if (!CONNECTED) return { status: "bad", error: "not connected" };

    const url = `${DSCONFIG.serverIP}/ide?cmd=list&dir=${querystring.escape(folder)}`;
    const response = await axios.get(url).catch(catchError);
    return response.data;
}

/**
 * @param {string} name
 * @param {any} type
 * @param {string} template
 * @return {Promise<DSServerResponse>}
 */
async function createApp(name, type, template) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=add&prog=${querystring.escape(name)}&type=${type}&template=${querystring.escape(template)}`;
    const response = await axios.get(url).catch(catchError);
    return response.data;
}

/**
 * @param {string} path
 * @return {Promise<DSServerResponse<{data:string|NodeJS.ArrayBufferView}>>}
 */
async function loadFile(path) {
    const url = `${DSCONFIG.serverIP}/${querystring.escape(path)}`;
    const fileExt = path.split('.').pop() || '';

    /** @type {import('axios').AxiosRequestConfig} */
    let options = { responseType: 'arraybuffer' };
    if (textFileExtensions.includes(fileExt)) options = { responseType: 'text' };
    const response = await axios.get(url, options).catch(catchError);

    if (typeof response.status === "undefined") return response.data;
    return { status: "ok", data: response.data }
}

/**
 * @param {any} text
 * @param {string} folder
 * @param {any} file
 * @return {Promise<DSServerResponse<{data:any}>>}
 */
async function updateFile(text, folder, file) {
    const url = `${DSCONFIG.serverIP}/upload`;
    const formData = new FormData();
    formData.append(folder, text, { filename: file });

    const response = await axios.post(url, formData, {
        headers: formData.getHeaders()
    }).catch(catchError);

    if (typeof response.status === "undefined") return response.data;
    return { status: "ok", data: response.data }
}

// Rename the file in the project's folder
/**
 * @param {string} file
 * @param {string} newname
 */
async function renameFile(file, newname) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=rename&file=${querystring.escape(file)}&newname=${querystring.escape(newname)}`;
    const response = await axios.get(url).catch(catchError);
    if (typeof response.status === "undefined") return response.data;
    return { status: "ok" };
}

// Delete a file in the project's folder
/**
 * @param {string} file
 */
async function deleteFile(file) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=delete&file=${querystring.escape(file)}`;
    let response = await axios.get(url).catch(catchError);
    return response.data;
}

async function getSamples(type = "js") {
    /** @type {{type:"array",samples:string[]} | {type:"json",samples:any}} */
    let data = { type: "array", samples: [] };

    if (!CONNECTED) return data;

    if ((DSCONFIG.info.version || 0) < 3) {
        const url = `${DSCONFIG.serverIP}/ide?cmd=getsamples&type=${type}`;

        const response = await axios.get(url).catch(catchError);
        if (typeof response.status === "undefined") return data;

        if (response && response.status == 200) {
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
    else {
        let serverIP = DSCONFIG.serverIP.replace(DSCONFIG.PORT, CONSTANTS.SAMPLE_PORT);
        const url = `${serverIP}/getAllSamples`;

        const response = await axios.get(url).catch(catchError);
        if (typeof response.status === "undefined") return data;
        if (response && response.status == 200 && response.data.status) {
            data = {
                type: "json",
                samples: response.data.message
            }
        }
    }

    return data;
}

/**
 * @param {string} name
 * @param {string} [category]
 */
async function getSampleFile(name, category = '') {
    // NetUtils.getServerUrl("ide?cmd=get&file=" + u + currentSampleFile)

    let code = "";
    const title = name.split(" ").join("_");

    if (category) {
        let serverIP = DSCONFIG.serverIP.replace(DSCONFIG.PORT, CONSTANTS.SAMPLE_PORT);
        const url = `${serverIP}/getSample?category=${category}&title=${name}`;

        const res = await axios.get(url).catch(catchError);
        if (res.data.status !== "bad") code = res.data.message;
    }
    else {
        const url = `${DSCONFIG.serverIP}/ide?cmd=get&file=/assets/samples/${title}.js`;

        const res = await axios.get(url).catch(catchError);
        if (typeof res.status === "undefined") return code;

        if (typeof res.data === "string") {
            res.data = res.data.replace(/\\\'/g, "");
            res.data = JSON.parse(res.data);
        }
        if (res.data.file) code = res.data.file;
    }

    // console.log(code);
    return code;
}

/**
 * @param {string} name
 * @param {string} category
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

    await axios.get(url).catch(catchError);
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
    const res = await axios.get(url).catch(catchError);
    if (typeof res.status === "undefined") return res.data;
    return { status: "ok" };
}

/**
 * @param {string} filePath
 */
async function fileExist(filePath) {
    const url = `${DSCONFIG.serverIP}/${querystring.escape(filePath)}`;
    let res = await axios.get(url).catch(catchError);
    return res.status === 200;
}

/** 
 * @param {string} dir 
 * @param {string} title 
 * @param {(path:string) => Promise<boolean>} existFn
 */
async function getProjectInfo(dir, title, existFn) {
    /** @type {("py"|"html"|"js"|"")[]} */
    const types = ["py", "html", "js"];

    /** @type {(typeof types)[number]} */
    let projType = "";

    for (const type of types) {
        if (await existFn(`${dir}/${title}.${type}`))
            projType = type;
    }

    if (!projType) return null;
    return { title, file: `${dir}/${title}.${projType}`, ext: projType }
}

const setCONFIG = (/** @type {DSCONFIG_T} */ config) => { DSCONFIG = config; }
const getCONFIG = () => DSCONFIG;

/**
 * @param {fs.PathLike} filePath
 * @param {string} folder
 * @param {string} fileName
 */
async function uploadFile(filePath, folder, fileName) {
    const url = `${DSCONFIG.serverIP}/upload`;
    const formData = new FormData();
    formData.append(folder, fs.createReadStream(filePath), { filename: fileName });

    const response = await axios.post(url, formData, {
        headers: formData.getHeaders()
    }).catch(catchError);

    if (typeof response.status === "undefined") return response.data;
    return { status: "ok", data: response.data }
}

//Execute code on the device.
//'app' mode runs as a stand-alone app.
//'ide' mode runs inside ide.
//'usr' mode runs inside current user app.
/**
 * @param {string} mode
 * @param {string} code
 */
async function execute(mode, code) {
    // xmlHttp = new XMLHttpRequest();
    // xmlHttp.open( "get", "/ide?cmd=execute&mode="+mode+"&code="+encodeURIComponent(btoa(code)), true );
    // xmlHttp.send();
    const encodedData = Buffer.from(code, 'utf8').toString('base64');
    const url = `${DSCONFIG.serverIP}/ide?cmd=execute&mode=${mode}&code=${querystring.escape(encodedData)}`;

    const response = await axios.get(url).catch(catchError);
    if (typeof response.status === "undefined") return null;
    return response;
}

/**
 * @param {string} cmd
 */
async function executeCommand(cmd) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=execute&code=${querystring.escape(cmd)}`;
    const response = await axios.get(url).catch(catchError);

    if (typeof response.status === "undefined") return null;
    return response;
}

module.exports = {
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
    getProjectInfo,
    setCONFIG,
    getCONFIG,
    login,
    getServerInfo,
    uploadFile,
    execute,
    executeCommand
}
