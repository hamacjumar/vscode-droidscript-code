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

let connected = false;
let CONFIG = {
    serverIP: ""
}

const excludedFoldersAndFiles = ["AABs", "APKs", "SPKs", "PPKs", "Plugins", "Extensions", ".edit", ".node", "~DocSamp", ".redirect.html", "index.html"];
const textFileExtensions = 'html, js, css, txt, md, json, xml, csv, yaml, yml, sql, php, py, rb, java, c, cpp, h, cs, pl, sh, ps1';
const dataFileExtensions = '.mp4, .mp3, .ppk, .apk, .spk, .png, .jpg, .jpeg, .pdf, .docx, .xlsx, .pptx, .zip';

const getServerInfo = async function() {
    const url = `${CONFIG.serverIP}/ide?cmd=getinfo`;
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

const listFolder = async function( folder ) {
    const url = `${CONFIG.serverIP}/ide?cmd=list&dir=${querystring.escape(folder)}`;
    try {
        const response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error }
    }
}

const loadFile = async function( path ) {
    const url = `${CONFIG.serverIP}/${querystring.escape(path)}`;
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
    const url = `${CONFIG.serverIP}/upload`;
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
    const url = `${CONFIG.serverIP}/ide?cmd=rename&file=${querystring.escape(file)}&newname=${querystring.escape(newname)}`;
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
    const url = `${CONFIG.serverIP}/ide?cmd=delete&file=${querystring.escape(file)}`;
    try {
        let response = await axios.get(url);
        return response.data;
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

const getSamples = async function( type="js" ) {
    // if( !connected ) {
    //     return null;
    // }
    const url = `${CONFIG.serverIP}/ide?cmd=getsamples&type=${type}`;
    try {
        const response = await axios.get(url);
        return response;
    }
    catch( error ) {
        console.log( error );
    }
}

const getSampleFile = async function( name ) {
    // NetUtils.getServerUrl("ide?cmd=get&file=" + u + currentSampleFile)

    const n = name.split(" ").join("_");
    const url = `${CONFIG.serverIP}/ide?cmd=get&file=/assets/samples/${n}.js`;
    try {
        const res = await axios.get( url );
        return res;
    }
    catch( error ) {
        console.log( error );
    }
}

const runSample = async function( name ) {
    const n = name.split(" ").join("_");
    const url = `${CONFIG.serverIP}/ide?cmd=sample&name=${n}`;
    try {
        await axios.get( url );
    }
    catch( error ) {
        console.log( error );
    }
}

const play = async function(appName) {
    const dummyUrl = `${CONFIG.serverIP}/ide?cmd=dummy`;
    const playUrl = `${CONFIG.serverIP}/ide?cmd=run&prog=${querystring.escape(appName)}`;
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
    const url = `${CONFIG.serverIP}/ide?cmd=stop`;
    try {
        await axios.get(url);
        return { status: "ok" };
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

const login = async function( password ) {
    const pass = Buffer.from(password, "utf-8").toString("base64");
    const url = `${CONFIG.serverIP}/ide?cmd=login&pass=${pass}`;
    try {
        let response = await axios.get(url);
        return response;
    }
    catch (error) {
        return { status: "bad", error: error };
    }
}

const setCONFIG = function( config ) {
    CONFIG = config;
}

const getCONFIG = function() {
    return CONFIG;
}

// WebSocket
const startWebSocket = function(onOpen, onMessage, onClose, onError) {
    const url = CONFIG.serverIP.replace("http", "ws");
    const socket = new WebSocket(url);
    socket.on('open', onOpen);
    socket.on('message', onMessage);
    socket.on('close', onClose);
    socket.on('error', onError);
    return socket;
}

const uploadFile = async function(filePath, folder, fileName) {
    const url = `${CONFIG.serverIP}/upload`;
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
    connected = value;
}
const getConnected = function() {
    return connected;
}

//Execute code on the device.
//'app' mode runs as a stand-alone app.
//'ide' mode runs inside ide.
//'usr' mode runs inside current user app.
const execute = async function( mode, code ) {
    // xmlHttp = new XMLHttpRequest();
    // xmlHttp.open( "get", "/ide?cmd=execute&mode="+mode+"&code="+encodeURIComponent(btoa(code)), true );
    // xmlHttp.send();
    const encodedData = Buffer.from(code, 'utf8').toString('base64');
    const url = `${CONFIG.serverIP}/ide?cmd=execute&mode=${mode}&code=${querystring.escape(encodedData)}`;
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
    CONFIG,
    listFolder,
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
    setCONFIG,
    getCONFIG,
    login,
    startWebSocket,
    getServerInfo,
    uploadFile,
    setConnected,
    getConnected,
    execute
}
