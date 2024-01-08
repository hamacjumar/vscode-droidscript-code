const vscode = require('vscode');

/** @typedef {{title:string, file:string}} DocItem */
/** @implements {vscode.TreeDataProvider<DocItem>} */
class TreeDataProvider {

    /** @type {{[x:string]: string}} */
    pages = {};

    /** @param {DocItem} e */
    getTreeItem(e) {
        return new TreeItem(e.title, vscode.TreeItemCollapsibleState.None, e.file);
    }

    /** @param {DocItem} element */
    getChildren(element) {
        if (!element) {
            return Object.entries({
                Documentation: 'Docs.htm'
            }).map(([title, file]) => ({ title, file }));
            // new TreeItem('Documentation', vscode.TreeItemCollapsibleState.None, 'Docs'),
            // new TreeItem('Introduction', vscode.TreeItemCollapsibleState.None, 'introduction'),
            // new TreeItem('Reference', vscode.TreeItemCollapsibleState.None, 'reference'),
            // new TreeItem('Resources', vscode.TreeItemCollapsibleState.None, 'resources'),
            // new TreeItem('Material UI (Premium)', vscode.TreeItemCollapsibleState.None, 'mui'),
            // new TreeItem('Game Engine', vscode.TreeItemCollapsibleState.None, 'game-engine'),
            // new TreeItem('Music', vscode.TreeItemCollapsibleState.None, 'music')
        }
        else {
            vscode.window.showInformationMessage(element.title);
            return [];
        }
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
        command: 'droidscript-code.openDroidScriptDocs',
        title: 'Open Docs',
        arguments: [this.args]
    };
}

module.exports = {
    TreeDataProvider, TreeItem
}