const { default: axios } = require('axios');
const vscode = require('vscode');
const localData = require('./local-data');
const path = require("path");

/** @type {DSCONFIG_T} */
let DSCONFIG;

/** @type {{[x:string]: DocItem[]}} */
const cache = {};

/** @typedef {{title:string, file:string, hasNavs?: boolean}} DocItem */
/** @implements {vscode.TreeDataProvider<DocItem>} */
class TreeDataProvider {

    /** @type {{[x:string]: string}} */
    pages = {};

    /** @type {vscode.EventEmitter<DocItem>} */
    _onDidChangeTreeData = new vscode.EventEmitter();
    onDidChangeTreeData = this._onDidChangeTreeData.event;

    /** @param {DocItem} e */
    getTreeItem(e) {
        const state = !cache[e.file] || cache[e.file].length ?
            vscode.TreeItemCollapsibleState.Collapsed :
            vscode.TreeItemCollapsibleState.None;
        return new TreeItem(e.title, state, e.file);
    }

    /** @type {(element: DocItem) => Promise<DocItem[]>} */
    async getChildren(element) {
        if (!element) return [{ title: "Documentation", file: "Docs.htm" }];
        const navs = await getNavs(element, this._onDidChangeTreeData);
        element.hasNavs = navs.length > 0;
        return navs;
    }
}

/** 
 * @param {DocItem} item
 * @param {vscode.EventEmitter<DocItem>} onEmpty
 */
async function getNavs(item, onEmpty) {
    const file = getFile(item.file);
    DSCONFIG = localData.load();
    const dir1 = path.dirname(file);
    const dir = dir1 === "." ? "" : dir1 + "/";

    /** @type {DocItem[]} */
    let data = [];
    try {
        const res = await axios.get(getUrl(file));
        const navsHtml = res.data;
        if (res.status !== 200 || typeof navsHtml !== "string") return data;

        const navs = navsHtml.matchAll(/<li><a [^>]*\bhref="([^"]+)"[^>]*>([^<]+)<\/a><\/li>/g);
        for (const [_, file, title] of navs) data.push({ title, file: dir + file });

        if (data[0]?.title?.startsWith("Version ")) {
            const fwd = data[data.length - 1];
            fwd.file = getFile(fwd.file, true);
            data = await getNavs(fwd, onEmpty);
            setTimeout(() => onEmpty.fire(item), 50);
        }
    } catch (e) { }
    if (!data.length) onEmpty.fire(item);
    return cache[file] = data;
}

class TreeItem extends vscode.TreeItem {
    /** @type {vscode.TreeItem} */
    args = {};
    /**
     * @param {string | vscode.TreeItemLabel} label
     * @param {vscode.TreeItemCollapsibleState | undefined} collapsibleState
     * @param {string} contextValue
     */
    constructor(label, collapsibleState, contextValue) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.description = contextValue;
        Object.assign(this.args, this);
    }

    // Provide the command ID to execute when the tree item is selected
    command = {
        command: 'droidscript-code.openDroidScriptDocs',
        title: 'Open Docs',
        arguments: [this.args]
    };
}

let latestVer = "";
/** @param {string} file */
function getUrl(file) {
    DSCONFIG = localData.load();
    const host = CONNECTED ?
        DSCONFIG.serverIP + "/.edit/docs/" :
        "https://droidscript.github.io/Docs/docs/" + latestVer;
    return host + getFile(file);
}

/** @param {string} file */
function getFile(file, latest = false) {
    if (latest) latestVer = path.dirname(file).replace('../docs/', '') + "/";;
    return file.replace('../docs/' + latestVer, '');
}

module.exports = {
    TreeDataProvider, TreeItem, getUrl
}