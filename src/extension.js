/*
    Author: Jumar B. Hamac
    Contact: hamacjumar@gmail.com

    This is a wrapper to the DS Code extension.
*/

const axios = require('axios');
const querystring = require('querystring');
const FormData = require('form-data');
const WebSocket = require('ws');
const fs = require('fs');
const CONSTANTS = require("./CONSTANTS");

let CONNECTED = false;
let DSCONFIG = {};

const excludedFoldersAndFiles = ["AABs", "APKs", "SPKs", "PPKs", "Plugins", "Extensions", ".edit", ".node", "~DocSamp", ".redirect.html", "index.html"];
const textFileExtensions = 'html, js, css, txt, md, json, xml, csv, yaml, yml, sql, php, py, rb, java, c, cpp, h, cs, pl, sh, ps1';
const dataFileExtensions = '.mp4, .mp3, .ppk, .apk, .spk, .png, .jpg, .jpeg, .pdf, .docx, .xlsx, .pptx, .zip';

const getServerInfo = async function( IP ) {
    const url = `${(IP || DSCONFIG.serverIP)}/ide?cmd=getinfo`;
    try {
        let response = await axios.get(url, {timeout: 5000});
        if(response.status == 200 && response.data && response.data.status=="ok") {
            return response.data
        } else {
            return {status: "bad", data: response.data }
        }
    } catch(error) {
        return {status: "bad", data: error }
    }
}

const login = async function( password ) {
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

const listFolder = async function( folder ) {

    if( !CONNECTED ) return;

    const url = `${DSCONFIG.serverIP}/ide?cmd=list&dir=${querystring.escape(folder)}`;
    try {
        const response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error }
    }
}

const createApp = async function(name, type, template) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=add&prog=${querystring.escape(name)}&type=${type}&template=${querystring.escape(template)}`;
    try {
        const response = await axios.get(url);   
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error }
    }
}

const loadFile = async function( path ) {
    const url = `${DSCONFIG.serverIP}/${querystring.escape(path)}`;
    const fileExt = path.split('.').pop();
    let options = {responseType: 'arraybuffer'};
    if( textFileExtensions.includes(fileExt) ) options = { responseType: 'text' };
    try {
        const response = await axios.get(url, options);
        return { status: "ok", data: response.data }
    }
    catch (error) {
        return { status: "bad", error: error }
    }
}

const updateFile = async function(text, folder, file) {
    const url = `${DSCONFIG.serverIP}/upload`;
    const formData = new FormData();
    formData.append(folder, text, { filename: file });
    try {
        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });
        return {status: "ok", data: response.data}
    } catch (error) {
        console.error(error);
        return {status: "bad", message: error}
    }
}

// Rename the file in the project's folder
const renameFile = async function(file, newname) {
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
const deleteFile = async function(file) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=delete&file=${querystring.escape(file)}`;
    try {
        let response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

const getSamples = async function( type="js" ) {
    
    let data = {};

    if( !CONNECTED ) return data;

    if(DSCONFIG.version < 3) {
        const url = `${DSCONFIG.serverIP}/ide?cmd=getsamples&type=${type}`;
        try {
            const response = await axios.get(url);
            if(response && response.status == 200 && response.data.status=="ok") {
                const files = response.data.samples.split("|");
                const samples = files.map(m => {
                    var line = m.split(":");
                    return line[0].replace("&#9830;", " ♦").trim();
                });
                data = {
                    type: "array",
                    samples
                }
            }
        }
        catch( error ) {
            console.log( error );
        }
    }
    else {
        let serverIP = DSCONFIG.serverIP.replace(DSCONFIG.PORT, CONSTANTS.SAMPLE_PORT);
        const url = `${serverIP}/getAllSamples`;
        try {
            const response = await axios.get(url);
            if(response && response.status == 200 && response.data.status) {
                data = {
                    type: "json",
                    samples: response.data.message
                }
            }
        }
        catch( error ) {
            console.log( error );
        }
    }

    return data;
}

const getSampleFile = async function(name, category) {
    // NetUtils.getServerUrl("ide?cmd=get&file=" + u + currentSampleFile)

    let code = "";
    const title = name.split(" ").join("_");

    if( category ) {
        let serverIP = DSCONFIG.serverIP.replace(DSCONFIG.PORT, CONSTANTS.SAMPLE_PORT);
        const url = `${serverIP}/getSample?category=${category}&title=${name}`;
        try {
            const res = await axios.get(url);
            if(res && res.data && res.data.status) {
                code = res.data.message;
            }
        }
        catch( error ) {
            console.log( error );
        }
    }
    else {
        const url = `${DSCONFIG.serverIP}/ide?cmd=get&file=/assets/samples/${title}.js`;
        try {
            const res = await axios.get( url );
            if(typeof res.data == "string") {
                res.data = res.data.replace(/\\\'/g, "");
                res.data = JSON.parse(res.data);
            }
            if(res && res.data && res.data.file) {
                code = res.data.file;
            }
        }
        catch( error ) {
            console.log( error );
        }
    }

    console.log( code );

    return code;
}

const runSample = async function(name, category) {
    
    if( category ) {
        let code = await getSampleFile(name, category);
        const regex1 = /import\s*app/;
        const regex2 = /import\s*ui/;
        if(regex1.test(code) || regex2.test(code)) code = "python:"+code;
        return execute("app", code);
    }

    const n = name.split(" ").join("_");
    let url = `${DSCONFIG.serverIP}/ide?cmd=sample&name=${n}`;

    try {
        await axios.get( url );
    }
    catch( error ) {
        console.log( error );
    }
}

const play = async function(appName) {
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

const stop = async function() {
    const url = `${DSCONFIG.serverIP}/ide?cmd=stop`;
    try {
        await axios.get(url);
        return { status: "ok" };
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

const fileExist = async function( filePath ) {
    const url = `${DSCONFIG.serverIP}/${querystring.escape(filePath)}`;
    try {
        let res = await axios.get( url );
        if(res && res.status == 200 && res.statusText == "OK") return true;
        return false;
    }
    catch( err ) {
        return false;
    }
}

const setCONFIG = function( config ) {
    DSCONFIG = config;
}

const getCONFIG = function() {
    return DSCONFIG;
}

// WebSocket
const startWebSocket = function(onOpen, onMessage, onClose, onError) {
    const url = DSCONFIG.serverIP.replace("http", "ws");
    const socket = new WebSocket(url);
    socket.on('open', onOpen);
    socket.on('message', onMessage);
    socket.on('close', onClose);
    socket.on('error', onError);
    return socket;
}

const uploadFile = async function(filePath, folder, fileName) {
    const url = `${DSCONFIG.serverIP}/upload`;
    const formData = new FormData();
    formData.append(folder, fs.createReadStream(filePath), {filename: fileName});
    try {
        const response = await axios.post(url, formData, {
            headers: formData.getHeaders()
        });
        return {status: "ok", data: response.data}
    } catch (error) {
        console.error(error);
        return {status: "bad", message: error}
    }
}

const setConnected = function( value ) {
    CONNECTED = value;
}

const getConnected = function() {
    return CONNECTED;
}

//Execute code on the device.
//'app' mode runs as a stand-alone app.
//'ide' mode runs inside ide.
//'usr' mode runs inside current user app.
const execute = async function(mode, code) {
    // xmlHttp = new XMLHttpRequest();
    // xmlHttp.open( "get", "/ide?cmd=execute&mode="+mode+"&code="+encodeURIComponent(btoa(code)), true );
    // xmlHttp.send();
    const encodedData = Buffer.from(code, 'utf8').toString('base64');
    const url = `${DSCONFIG.serverIP}/ide?cmd=execute&mode=${mode}&code=${querystring.escape(encodedData)}`;
    try {
        const response = await axios.get( url );
        return response;
    }
    catch( error ) {
        console.log( error );
        return null;
    }
}

const executeCommand = async function( cmd ) {
    const url = `${DSCONFIG.serverIP}/ide?cmd=execute&code=${querystring.escape( cmd )}`;
    try {
        const response = await axios.get( url );
        return response;
    }
    catch( error ) {
        console.log( error );
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
