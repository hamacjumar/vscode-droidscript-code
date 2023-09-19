const vscode = require('vscode');
const ext = require('./extension');

let appName = "";

module.exports = function(args, treeView) {
    if(!args || !args.label) {
        return vscode.window.showWarningMessage("Delete an app in DroidScript section under Projects view!");
    }

    appName = args.label;

    let connected = ext.getConnected();
    if( !connected ) {
        vscode.window.showWarningMessage("You are not connected to DroidScript!", "Connect", "Cancel")
            .then( selection => {
                if(selection == "Connect") vscode.commands.executeCommand("droidscript-code.connect");
            });
        return;
    }

    vscode.window.showWarningMessage(`Do you want to remove ${appName} app?`, "Remove", "Cancel")
    .then( async selection => {
        if( selection == "Remove" ) {
            try {
                let response = await ext.deleteFile( appName );
                if(response.status == "ok") {
                    if( treeView ) treeView.refresh();
                }
                else {
                    vscode.window.showErrorMessage(`Error removing ${appName} app!`);
                }
            }
            catch( error ) {
                console.log("Error: " + error );
                vscode.window.showErrorMessage(`Error removing ${appName} app!`);
            }
        }
    });
}

