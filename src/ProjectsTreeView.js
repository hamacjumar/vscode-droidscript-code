const vscode = require('vscode');
const ext = require("./extension");

class TreeDataProvider {

    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    /** @param {TreeItem} element */
    getTreeItem(element) {
        return element;
    }

    /** @param {TreeItem} element */
    async getChildren(element) {
        if (!element) {
            let data = await ext.listFolder("");
            if (data && data.status === "ok") {
                var folders = data.list.filter(m => {
                    if (ext.excludedFoldersAndFiles.includes(m)) return false;
                    var ftype = m.substring(m.lastIndexOf("."));
                    if (ext.textFileExtensions.includes(ftype)) return false;
                    if (ext.dataFileExtensions.includes(ftype)) return false;
                    if (m.startsWith("~")) return false;
                    return true;
                });
                const samples = folders.map(m => {
                    var title = m;
                    const treeItem = new TreeItem(title, vscode.TreeItemCollapsibleState.None, title);
                    // treeItem.iconPath = vscode.Uri.parse();
                    return treeItem;
                });
                return Promise.resolve(samples);
            }
            else {
                return Promise.resolve([]);
            }
        }
        else {
            vscode.window.showInformationMessage(element.label + '');
        }
    }

    refresh() {
        this._onDidChangeTreeData.fire(null);
    }
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