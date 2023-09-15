const vscode = require('vscode');
const ext = require('./extension');

let sampleName = "";

module.exports = function(args, runSample) {

    if(!args || !args.label) {
        return vscode.window.showWarningMessage("Run a sample program in DroidScript section under Samples view!");
    }

    sampleName = args.contextValue;
    console.log( sampleName );

    let connected = ext.getConnected();
    if( !connected ) {
        vscode.window.showWarningMessage("You are not connected to DroidScript!", "Connect", "Cancel")
            .then( selection => {
                if(selection == "Connect") vscode.commands.executeCommand("droidscript-code.loadFiles");
            });
        return;
    }

    runSample( sampleName );
}