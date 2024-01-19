const vscode = require("vscode");
const { scopesJson } = require("./utils");

module.exports = { register };

function register() {
    return vscode.languages.registerHoverProvider("javascript", {
        provideHover(doc, pos) {
            const range = doc.getWordRangeAtPosition(pos);
            if (!range) {
                return undefined;
            }
            const word = doc.getText(range);
            const ln = doc.lineAt(pos.line).text;
            let n1 = ln.substring(0, ln.indexOf(word)).trim();
            let n = n1.replace(/(\s{2,}|\.{2,})/g, ' ')
                .replace(/\. +|\.+/g, ' ').trim()
                .split(/[ .{}*\\+\-]/);
            const scope = n.pop();
            if (scope && scopesJson[scope]) {
                let i = scopesJson[scope].methods.findIndex((/** @type {{ name: string; }} */ m) => m.name == word);
                if (i >= 0) {
                    var m = scopesJson[scope].methods[i];
                    const hc = [
                        new vscode.MarkdownString('```javascript\n' + m.detail + '\n' + '```'),
                        m.doc
                    ];
                    return new vscode.Hover(hc);
                }
            }
            return undefined;
        }
    });
}