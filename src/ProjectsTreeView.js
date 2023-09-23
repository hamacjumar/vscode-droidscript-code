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
            let data = await ext.listFolder("");
            if(data && data.status == "ok") {
                var folders = data.list.filter(m => {
                    if( ext.excludedFoldersAndFiles.includes(m) ) return false;
                    var ftype = m.substring(m.lastIndexOf("."));
                    if( ext.textFileExtensions.includes(ftype) ) return false;
                    if( ext.dataFileExtensions.includes(ftype) ) return false;
                    if( m.startsWith("~") ) return false;
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
    // get command() {
    //     return {
    //         command: 'droidscript-code.openProject',
    //         title: 'Open Project',
    //         arguments: [this],
    //     };
    // }
}

module.exports = {
    TreeDataProvider
}