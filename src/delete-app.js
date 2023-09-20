const vscode = require('vscode');
const ext = require('./extension');

let appName = "";
let CALLBACK = null;

module.exports = function(args, treeView, callback) {
    if(!args || !args.label) {
        return vscode.window.showWarningMessage("Delete an app in DroidScript's PROJECTS section!");
    }

    appName = args.label;
    CALLBACK = callback;

    vscode.window.showWarningMessage(`Do you want to remove ${appName} app?`, "Remove", "Cancel")
    .then( async selection => {
        if( selection == "Remove" ) {
            try {
                let response = await ext.deleteFile( appName );
                if(response.status == "ok") {
                    if( treeView ) treeView.refresh();
                    if( CALLBACK ) CALLBACK( appName );
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

