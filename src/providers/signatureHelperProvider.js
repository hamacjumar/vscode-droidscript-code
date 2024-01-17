const vscode = require("vscode");
const { scopes, scopesJson } = require("./utils");
const stringHelpers = require("../string-helpers");

module.exports = { register, init }

// create signatures for all scopes
/** @type {{[x:string]: vscode.SignatureHelp}} */
const signatures = {};

function init() {
    scopes.forEach(m => {
        signatures[m] = new vscode.SignatureHelp();
        signatures[m].signatures = scopesJson[m].methods.map((/** @type {{ call: string; params: any[]; }} */ n) => {
            const o = new vscode.SignatureInformation(n.call);
            o.parameters = n.params.map((/** @type {{ desc: string; name: string | [number, number]; }} */ q) => {
                let doc = new vscode.MarkdownString();
                doc.supportHtml = true;
                doc.value = q.desc;
                let parInfo = new vscode.ParameterInformation(q.name);
                parInfo.documentation = doc;
                return parInfo;
            });
            return o;
        });
    });
}

function register() {
    return vscode.languages.registerSignatureHelpProvider("javascript", {
        provideSignatureHelp(doc, pos) {
            const ln = doc.lineAt(pos.line).text;
            let s = stringHelpers.getFncCall(ln, pos.character) || '';
            let n1 = ln.substring(0, pos.character - s.length).trim();
            let n = n1.replace(/(\s{2,}|\.{2,})/g, ' ')
                .replace(/\. +|\.+/g, ' ')
                .split(/[ .{}*\\+\-]/);
            let w = n.pop(), scope = null, json = null;
            if (n.length >= 1) {
                scope = n.pop();
                if (!scope || !scopes.includes(scope)) return null;
                json = scopesJson[scope];
            }
            if (!json || !scope) return null;

            let i = json.methods.findIndex((/** @type {{ name: any; }} */ m) => m.name == w);
            if (i < 0) return null;

            signatures[scope].activeSignature = i;
            signatures[scope].activeParameter = stringHelpers.countCommas(s);

            return signatures[scope];
        }
    }, ["(", ",", " "]);
}

