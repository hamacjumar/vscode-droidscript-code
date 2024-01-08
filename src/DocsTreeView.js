const vscode = require('vscode');

class TreeDataProvider {
    getTreeItem(element) {
        return element;
    }

    getChildren(element) {
        if (!element) {
            return Promise.resolve([
                new TreeItem('Documentation', vscode.TreeItemCollapsibleState.None, 'droidscript-documentation'),
                // new TreeItem('Introduction', vscode.TreeItemCollapsibleState.None, 'introduction'),
                // new TreeItem('Reference', vscode.TreeItemCollapsibleState.None, 'reference'),
                // new TreeItem('Resources', vscode.TreeItemCollapsibleState.None, 'resources'),
                // new TreeItem('Material UI (Premium)', vscode.TreeItemCollapsibleState.None, 'mui'),
                // new TreeItem('Game Engine', vscode.TreeItemCollapsibleState.None, 'game-engine'),
                // new TreeItem('Music', vscode.TreeItemCollapsibleState.None, 'music')
            ]);
        }
        else {
            vscode.window.showInformationMessage(element.label);
        }
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
            command: 'droidscript-code.openDroidScriptDocs',
            title: 'Open Docs',
            arguments: [this],
        };
    }
}

module.exports = {
    TreeDataProvider
}