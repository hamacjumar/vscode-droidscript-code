
const scopes = ["app", "MUI", "ui"];

/** @type {{[x:string]: import("../../completions/app.json")}} */
const scopesJson = {};
scopes.forEach(m => {
    scopesJson[m] = require("../../completions/" + m + ".json");
});

module.exports = { scopes, scopesJson };
