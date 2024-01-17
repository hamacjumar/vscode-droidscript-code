const vscode = require("vscode");

module.exports = { register };

function register() {
    return vscode.languages.registerCodeActionsProvider("javascript", {
        provideCodeActions(doc, range, ctx, token) {
            const line = doc.lineAt(range.start.line);
            if (!line.text.includes("=")) return;
            if (!line.text.match(/(var\s+|let\s+|const\s+)?\b\w+\s*=[^=]/)) return;

            const wordReg = /\b(var\s+|let\s+|const\s+)?\b(\w+)/;
            const wordRange = doc.getWordRangeAtPosition(range.start, wordReg);
            const word = doc.getText(wordRange);
            if (!wordRange) return;

            const text = doc.getText().split("\n");
            for (var i = wordRange.start.line; i > 0; i--)
                if (text[i--].startsWith("function")) break;
            while (i > 0 && text[i].match(/^\s*\/\//)) i--;

            const varName = word.replace(wordReg, '$2');

            const declareLocalAction = new vscode.CodeAction("DroidScript: Declare Local", vscode.CodeActionKind.Refactor);
            declareLocalAction.edit = new vscode.WorkspaceEdit();
            declareLocalAction.edit.replace(doc.uri, wordRange, 'var ' + varName);

            const declareGlobalAction = new vscode.CodeAction("DroidScript: Declare Global", vscode.CodeActionKind.Refactor);
            declareGlobalAction.edit = new vscode.WorkspaceEdit();
            declareGlobalAction.edit.replace(doc.uri, wordRange, varName);
            declareGlobalAction.edit.insert(doc.uri, new vscode.Position(i, 0), `/** @type {} */\nvar ${varName};\n`);

            const declareAllLocalAction = new vscode.CodeAction("DroidScript: Declare All Local", vscode.CodeActionKind.Refactor);
            declareAllLocalAction.command = {
                title: "Declare Variables",
                command: "droidscript-code.declareVars",
                arguments: [doc.uri]
            };

            const actions = [declareGlobalAction];
            if (!line.text.match(/\b(var|let|const)\s+/))
                actions.unshift(declareAllLocalAction, declareLocalAction);
            return actions;
        }
    });
}