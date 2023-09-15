const vscode = require('vscode');
const ext = require("./extension");

class TreeDataProvider {

    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;
    }

    getTreeItem(element) {
      return element;
    }
  
    async getChildren(element) {
        if( !element ) {
            let res = await ext.getSamples("js");
            if(res && res.status == 200 && res.data.status=="ok") {
                const files = res.data.samples.split("|");
                const samples = files.map(m => {
                    var line = m.split(":");
                    var title = line[0].replace("&#9830;", "\u2666");
                    return new TreeItem(title, vscode.TreeItemCollapsibleState.None, title);
                });
                return Promise.resolve(samples);
            }
            else {
                return Promise.resolve([]);
            }
        }
        else {
            vscode.window.showInformationMessage(element.label);
        }
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
    }

    // Provide the command ID to execute when the tree item is selected
    get command() {
        return {
            command: 'droidscript-code.openDroidScriptSample',
            title: 'Open Sample',
            arguments: [this],
        };
    }
}

module.exports = {
    TreeDataProvider
}