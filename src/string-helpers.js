const f = function(inputString, index) {
    let openParenCount = 0;

    // Start searching from the index towards the beginning of the string
    for (let i = index-1; i >= 0; i--) {
        const char = inputString[i];

        if (char === ')') {
            openParenCount++;
        } else if (char === '(') {
            if (openParenCount === 0) {
                // Found the opening parenthesis of a function call
                return inputString.slice(i, index);
            } else {
                openParenCount--;
            }
        }
    }

    // If no function call is found, return null or handle it as needed
    return null;
}

function countCommas( str ) {
    str = str.trim();
    if (str.charAt(0) === '(') str = str.substring(1);
    if (str.charAt(str.length - 1) === ')') str = str.slice(0, -1);
    const parts = []; let cnt = 0;
    let crp = '';
    let instr = false;
    for (let i = 0; i < str.length; i++) {
        const char = str[i];
  
        if (char === '(' || char === '{') instr = true;
        else if (char === ')' || char === '}') instr = false;
  
        if (char === ',' && !instr) {
            parts.push(crp.trim());
            crp = '';
            cnt += 1;
        } else crp += char;
    }

    if (crp.trim() !== '') parts.push(crp.trim());
    return cnt;
}

module.exports = {
    getFncCall: f,
    countCommas: countCommas
}