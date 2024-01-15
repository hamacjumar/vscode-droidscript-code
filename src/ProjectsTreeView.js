const vscode = require('vscode');
const ext = require("./extension");
const localData = require('./local-data');
const { existsSync } = require('fs');


const excludedFoldersAndFiles = ["AABs", "APKs", "SPKs", "PPKs", "Plugins", "Extensions", ".edit", ".node", "~DocSamp", ".redirect.html", "index.html", "_sdk_", ".license.txt"];
const textFileExtensions = 'html, js, css, txt, md, json, xml, csv, yaml, yml, sql, php, py, rb, java, c, cpp, h, cs, pl, sh, ps1'.split(", ");
const dataFileExtensions = '.mp4, .mp3, .ppk, .apk, .spk, .png, .jpg, .jpeg, .pdf, .docx, .xlsx, .pptx, .zip'.split(", ");

/** @type {DSCONFIG_T} */
let DSCONFIG;

/** @typedef {{title:string, path?:string}} ProjItem */
/** @implements {vscode.TreeDataProvider<ProjItem>} */
class TreeDataProvider {

    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    /** @param {ProjItem} e */
    getTreeItem(e) {
        return new TreeItem(e);
    }

    /** @param {ProjItem} element */
    async getChildren(element) {
        if (element) {
            vscode.window.showInformationMessage("Fetching Projects");
            return [];
        }

        DSCONFIG = localData.load();

        let data = await ext.listFolder("");
        if (data.status !== "ok") return [];

        /** @type {string[]} */
        const folders = [];
        for (const title of data.list) {
            if (title.startsWith("~")) continue;
            if (excludedFoldersAndFiles.includes(title)) continue;
            if (title.includes(".")) {
                var ftype = title.substring(title.lastIndexOf("."));
                if (textFileExtensions.includes(ftype))
                    continue; // console.log("textfile", m)
                if (dataFileExtensions.includes(ftype))
                    continue; // console.log("datafile", m)
            }
            folders.push(title);

            // const info = await ext.getProjectInfo(m, m, ext.fileExist);
            // if (info) folders.push(info.title);
        };

        const samples = folders.map(title => {
            const proj = DSCONFIG.localProjects.find(e => e.PROJECT === title);

            /** @type {ProjItem} */
            const treeItem = { title };
            if (proj?.path) {
                treeItem.path = proj.path;
                //treeItem.iconPath = vscode.Uri.parse();
            }
            return treeItem;
        });

        return samples;
    }

    refresh() {
        this._onDidChangeTreeData.fire(null);
    }
}

class TreeItem extends vscode.TreeItem {
    /** @type {vscode.TreeItem} */
    args = {};
    /** @param {ProjItem} item */
    constructor(item) {
        super(item.title, vscode.TreeItemCollapsibleState.None);
        this.contextValue = item.title;
        this.description = item.path && existsSync(item.path) ? item.path : '';

        this.iconPath = item.path + `/Img/${item.title}.png`;
        if (this.description && !existsSync(this.iconPath))
            this.iconPath = __dirname + "/../images/Icon.png";

        Object.assign(this.args, this);
    }

    // Provide the command ID to execute when the tree item is selected
    command = {
        command: 'droidscript-code.openApp',
        title: 'Open Project',
        arguments: [this.args]
    }
}

module.exports = {
    TreeDataProvider, TreeItem
}