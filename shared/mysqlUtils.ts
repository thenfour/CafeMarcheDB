
export function SqlCombineAndExpression(expressions: string[]): string {
    if (expressions.length === 0) return "(true)";
    if (expressions.length === 1) return expressions[0]!;
    return `(${expressions.join(`\n    AND `)})`;
};

export function SqlCombineOrExpression(expressions: string[]): string {
    if (expressions.length === 0) return "(true)";
    if (expressions.length === 1) return expressions[0]!;
    return `(${expressions.join(`\n    OR `)})`;
};


// https://stackoverflow.com/questions/7744912/making-a-javascript-string-sql-friendly
export function MysqlEscape(str) {
    return str.replace(/[\0\x08\x09\x1a\n\r"'\\\%]/g, function (char) {
        switch (char) {
            case "\0":
                return "\\0";
            case "\x08":
                return "\\b";
            case "\x09":
                return "\\t";
            case "\x1a":
                return "\\z";
            case "\n":
                return "\\n";
            case "\r":
                return "\\r";
            case "\"":
            case "'":
            case "\\":
            case "%":
                return "\\" + char; // prepends a backslash to backslash, percent,
            // and double/single quotes
            default:
                return char;
        }
    });
}

