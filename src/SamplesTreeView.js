const vscode = require('vscode');
const ext = require("./extension");
const { DSCONFIG } = require('./CONSTANTS');

class TreeDataProvider {

    constructor() {
        this._onDidChangeTreeData = new vscode.EventEmitter();
        this.onDidChangeTreeData = this._onDidChangeTreeData.event;

        this.data = {};
    }

    getTreeItem(element) {
      return element;
    }
  
    async getChildren(element) {
        let treeItems = [];
        if( !element ) {
            this.data = await ext.getSamples();
            if(this.data.type == "array") {
                treeItems = this.data.samples.map(m => {
                    let title = DSCONFIG.premium ? m.replace("♦", "") : m;
                    return new TreeItem(title.trim(), vscode.TreeItemCollapsibleState.None, m.replace("♦", ""));
                });
            }
            else if(this.data.type == "json") {
                let sampTypes = [];
                for(let type in this.data.samples) {
                    treeItems.push(new TreeItem(type.toUpperCase(), vscode.TreeItemCollapsibleState.Collapsed, type));
                    sampTypes.push( type );
                }
                vscode.commands.executeCommand('setContext', 'droidscript-code.sampleTypes', sampTypes);
            }
        }
        else {
            if( this.data.samples[element.contextValue] ) {
                treeItems = this.data.samples[element.contextValue].map(m => {
                    let title = m.title;
                    if( m.isPremium ) {
                        title += " ♦";
                        element.contextValue += " ♦";
                    }
                    return new TreeItem(title, vscode.TreeItemCollapsibleState.None, m.title, element.contextValue);
                });
            }
        }
        return Promise.resolve( treeItems );
    }

    refresh() {
        this._onDidChangeTreeData.fire();
    }
}

class TreeItem extends vscode.TreeItem {
    constructor(label, collapsibleState, contextValue, category) {
        super(label, collapsibleState);
        this.contextValue = contextValue;
        this.category = category;
    }

    // Provide the command ID to execute when the tree item is selected
    // get command() {
    //     return {
    //         command: 'droidscript-code.openDroidScriptSample',
    //         title: 'Open Sample',
    //         arguments: [this],
    //     };
    // }
}

module.exports = {
    TreeDataProvider
}