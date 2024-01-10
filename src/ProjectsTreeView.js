const vscode = require('vscode');
const ext = require("./extension");
const localData = require('./local-data');
const { existsSync } = require('fs');

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

        if (!DSCONFIG) DSCONFIG = localData.load();

        let data = await ext.listFolder("");
        if (data.status !== "ok") return [];

        var folders = data.list.filter(m => {
            if (ext.excludedFoldersAndFiles.includes(m)) return false;
            if (m.includes(".")) {
                var ftype = m.substring(m.lastIndexOf("."));
                if (ext.textFileExtensions.includes(ftype))
                    console.log("textfile", m)
                if (ext.dataFileExtensions.includes(ftype))
                    console.log("datafile", m)
            }
            if (m.startsWith("~")) return false;
            return true;
        });

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