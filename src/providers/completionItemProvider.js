const vscode = require("vscode");
const { scopes, scopesJson } = require("./utils");

module.exports = { register, init };

// create completion items for all scopes
/** @type {{[x:string]: vscode.CompletionItem[]}} */
const completions = {};
function init() {
    scopes.forEach(m => {
        completions[m] = scopesJson[m].methods.map((n) => {
            const o = new vscode.CompletionItem(n.name);
            const kind = /** @type {keyof typeof vscode.CompletionItemKind}*/ (n.kind);
            o.kind = vscode.CompletionItemKind[kind];
            o.detail = `(${n.kind.toLowerCase()}) ${m}.${n.detail}`;
            o.documentation = new vscode.MarkdownString(n.doc + "\n" + n.param);
            return o;
        });
    });
}

function register() {
    return vscode.languages.registerCompletionItemProvider("javascript", {
        provideCompletionItems(doc, pos) {
            const ln = doc.lineAt(pos.line).text;
            const s = ln.substring(0, pos.character - 1).trim().split(" ").pop();
            if (s && completions[s]) return completions[s];
            return [];
        }
    }, ".");
}
