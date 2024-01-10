const vscode = require('vscode');
const ext = require("./extension");
const localData = require('./local-data');

class TreeDataProvider {

    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        /** @type {AsyncReturnType<typeof ext.getSamples>} */
        this.data = { type: "array", samples: [] };
    }

    /**
     * @param {any} element
     */
    getTreeItem(element) {
        return element;
    }

    /**
     * @param {{ contextValue: string; }} element
     */
    async getChildren(element) {
        let treeItems = [];

        let DSCONFIG = localData.load();
        if (!element) {
            this.data = await ext.getSamples();
            if (this.data.type == "array") {
                treeItems = this.data.samples.map((/** @type {string} */ m) => {
                    let title = DSCONFIG.info.premium ? m.replace("♦", "") : m;
                    return new TreeItem(title.trim(), vscode.TreeItemCollapsibleState.None, m.replace("♦", ""));
                });
            }
            else if (this.data.type == "json") {
                let sampTypes = [];
                for (let type in this.data.samples) {
                    treeItems.push(new TreeItem(type.toUpperCase(), vscode.TreeItemCollapsibleState.Collapsed, type));
                    sampTypes.push(type);
                }
                vscode.commands.executeCommand('setContext', 'droidscript-code.sampleTypes', sampTypes);
            }
        }
        else {
            if (this.data.samples[element.contextValue]) {
                treeItems = this.data.samples[element.contextValue].map((/** @type {{ title: any; isPremium: any; }} */ m) => {
                    let title = m.title;
                    if (m.isPremium) {
                        title += " ♦";
                        element.contextValue += " ♦";
                    }
                    return new TreeItem(title, vscode.TreeItemCollapsibleState.None, m.title, element.contextValue);
                });
            }
        }
        return Promise.resolve(treeItems);
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
     * @param {string} [category]
     */
    constructor(label, collapsibleState, contextValue, category) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.category = category;
        Object.assign(this.args, this);
    }

    // Provide the command ID to execute when the tree item is selected
    command = {
        command: 'droidscript-code.openSample',
        title: 'Open Sample',
        arguments: [this.args]
    }
}

module.exports = {
    TreeDataProvider,
    TreeItem
}