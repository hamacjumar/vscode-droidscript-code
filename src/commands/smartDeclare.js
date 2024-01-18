const vscode = require('vscode');

/** @param {vscode.Uri} uri */
module.exports = async function (uri) {
    const doc = await vscode.workspace.openTextDocument(uri);
    const editor = await vscode.window.showTextDocument(doc);

    const text = doc.getText();
    const globals = findGlobalVars(text);
    const lines = text.split("\n");

    const funcPos = text.match(/(\/\/.*\n)*\n\s*function/)?.index || 0;
    const globPos = doc.positionAt(funcPos);

    const regConPrefix = /^(Create|Open|Add|show)(?=\w+)/i;
    /** @type {{[x:string]: string}} */
    const objPfx = { app: "Ds", ui: "UI", MUI: "Mui", gfx: "Gfx" };
    /** @type {{[x:string]: string}} */
    const typeObj = {
        '`': 'string', '"': 'string', "'": 'string',
        '[': 'any[]', '{': '{[x:string]: any}',
        '.': 'number'
    }

    editor.edit(edt => {
        for (let i = 0; i < lines.length; i++) {
            // find undeclared assignments
            const match = lines[i].match(/(?<=^|\n|^\s+for\s*\()\s*(?<!(var\s+|let\s+|const\s+))\b(\w+)\s*=[^=]/);
            if (!match || globals.has(match[2]) || text.match(`(var|let|const)\\b[^\n(]+\\b${match[2]}\\s*[=,;\\n]`)) continue;
            // insert var to assignment
            const m = lines[i].match(`\\b${match[2]}\\s*=[^=]`);
            if (m?.index !== undefined) edt.insert(new vscode.Position(i, m.index), "var ");
        }
        if (!globals.size) return;

        let globDefs = "";
        for (const v of globals) {
            // skip already declared
            if (text.match(`\\b(var|let|const)\\b[^\n(]+${v}\\s*[=,;\\n]`)) continue;

            // try to infer type
            let type = "";
            const typeMatch = text.match(`${v}\\s*=\\s*((app|gfx|ui|mui)\\.(\\w+)|([^=;()]+))`);
            if (typeMatch && typeMatch[3]) {
                if (typeMatch[3].match(regConPrefix)) type = objPfx[typeMatch[2]] + typeMatch[3].replace(regConPrefix, '');
                else if (typeMatch[3].match(/^(is|has)/i)) type = "boolean";
            } else if (typeMatch && typeMatch[4]) {
                if (typeObj[typeMatch[4][0]]) type = typeObj[typeMatch[4][0]];
                else if (typeMatch[4].match(/^(true|false)$/)) type = "boolean";
                else if (type.match(/^[0-9.]+/)) type = "number";
            }
            globDefs += `/** @type {${type}} */\nvar ${v};\n`;
        }
        edt.insert(globPos, `\n${globDefs}\n`);
    });
}

/** @param {string} code */
function findGlobalVars(code) {
    // auto detect globals
    const defs = code.split(/(?<=\n[ \t]*)(?=function )/);
    const vars = defs.map(def => def.match(/(?<!(var|let|const)\s*)\b\w+(?=\s*=[^=])/g));

    /** @type {Set<string>} */
    const globalSet = new Set();

    for (let i = 0; i < defs.length; i++) {
        // find all assignments
        if (!vars[i]) continue;

        // find referenced in other defs
        for (let j = 0; j < defs.length; j++) {
            if (i == j) continue;
            /** @type {string[]} */
            for (const v of vars[i] || []) {
                // eslint-disable-next-line max-depth
                if (!vars[j]?.includes(v) && defs[j].match(RegExp(`\\b${v}\\b`)))
                    globalSet.add(v);
            }
        }
        // console.log(defs[i].split("\n", 1)[0], vars1, [...globalSet]);
    }
    return globalSet;
}
