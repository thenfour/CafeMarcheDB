import type { CMServerAuthorization } from "src/auth/server/serverAuthorization";
import type { CMDBTableFilterModel } from "../apiTypes";
import type { xTable } from "../db3core";

//----------------------------------------------------------------------
// in-memory querying for db3.
// band catalog tables (instruments, songtags, et al...) may need to appear in
// quick filters / searches / autocompletes
// but the matching text is not simple database rows -- they are localized strings
// resolved in code.
//
// fortunately these tables are expected to be small and the simplest approach is
// to just bring them in memory and evaluate the query there.
//----------------------------------------------------------------------


type QueryRow = Readonly<Record<string, unknown>>;
const isObject = (value: unknown): value is QueryRow => {
    return value !== null && typeof value === "object" && !Array.isArray(value);
};
const matchingCollator = new Intl.Collator("en-US", { usage: "search", sensitivity: "base" });

function equal(left: unknown, right: unknown): boolean {
    if (typeof left === "string" && typeof right === "string") {
        // MySQL PAD SPACE removes ordinary trailing spaces, not tabs or other whitespace.
        return matchingCollator.compare(left.replace(/ +$/u, ""), right.replace(/ +$/u, "")) === 0;
    }
    return left instanceof Date && right instanceof Date ? left.getTime() === right.getTime() : left === right;
}

/** MySQL LIKE compares one character at a time; unlike equality, ligature expansions do not match multiple characters. */
export function matchesDB3Like(value: string, pattern: string): boolean {
    const characters = Array.from(value);
    const patternCharacters = Array.from(pattern);
    const tokens: Array<{ kind: "many" | "one" | "text"; value: string }> = [];
    for (let index = 0; index < patternCharacters.length; index++) {
        const character = patternCharacters[index]!;
        if (character === "\\" && index + 1 < patternCharacters.length) {
            tokens.push({ kind: "text", value: patternCharacters[++index]! });
        } else {
            tokens.push({ kind: character === "%" ? "many" : character === "_" ? "one" : "text", value: character });
        }
    }
    let positions = new Set([0]);
    for (const token of tokens) {
        const next = new Set<number>();
        if (token.kind === "many" && positions.size) {
            const first = Math.min(...positions);
            for (let end = first; end <= characters.length; end++) {
                next.add(end);
            }
        } else {
            for (const start of positions) {
                if (start < characters.length && (token.kind === "one"
                    || matchingCollator.compare(characters[start]!, token.value) === 0)) {
                    next.add(start + 1);
                }
            }
        }
        positions = next;
    }
    return positions.has(characters.length);
}

// SQL comparisons against NULL remain unknown under NOT, rather than becoming a match.
type Truth = boolean | null;
function all(values: Truth[]): Truth {
    return values.includes(false) ? false : values.includes(null) ? null : true;
}
function any(values: Truth[]): Truth {
    return values.includes(true) ? true : values.includes(null) ? null : false;
}
function negate(value: Truth): Truth {
    return value === null ? null : !value;
}
function compareValue(value: unknown, expected: unknown): Truth {
    return expected === null ? value == null : value == null ? null : equal(value, expected);
}
function matchesValue(value: unknown, condition: unknown): Truth {
    if (!isObject(condition)) {
        return compareValue(value, condition);
    }
    return all(Object.entries(condition).map(([operator, expected]): Truth => {
        switch (operator) {
            case "equals":
                return compareValue(value, expected);
            case "in":
            case "notIn": {
                if (!Array.isArray(expected)) {
                    throw new Error(`Expected an array for DB3 '${operator}'.`);
                }
                const match = expected.length === 0 ? false : value == null ? null : any(expected.map(candidate => compareValue(value, candidate)));
                return operator === "in" ? match : negate(match);
            }
            case "not":
                return negate(matchesValue(value, expected));
            case "is":
                return expected === null ? value == null : isObject(value) ? evaluateWhere(value, expected) : null;
            case "contains":
            case "startsWith":
            case "endsWith": {
                if (value == null) {
                    return null;
                }
                const pattern = operator === "contains" ? `%${String(expected)}%`
                    : operator === "startsWith" ? `${String(expected)}%` : `%${String(expected)}`;
                return typeof value === "string" && typeof expected === "string" && matchesDB3Like(value, pattern);
            }
            default:
                throw new Error(`Unsupported in-memory DB3 operator '${operator}'.`);
        }
    }));
}
function evaluateWhere(row: QueryRow, where: unknown): Truth {
    if (where === undefined) {
        return true;
    }
    if (!isObject(where)) {
        throw new Error("Expected a DB3 where object.");
    }
    return all(Object.entries(where).map(([member, condition]) => {
        const conditions = Array.isArray(condition) ? condition : [condition];
        if (member === "AND") {
            return all(conditions.map(clause => evaluateWhere(row, clause)));
        }
        if (member === "OR") {
            return any(conditions.map(clause => evaluateWhere(row, clause)));
        }
        if (member === "NOT") {
            return all(conditions.map(clause => negate(evaluateWhere(row, clause))));
        }
        return matchesValue(row[member], condition);
    }));
}
export function matchesDB3Where(row: QueryRow, where: unknown): boolean {
    return evaluateWhere(row, where) === true;
}

export function queryDB3Memory<T extends QueryRow>(
    table: xTable,
    rows: readonly T[],
    filter: CMDBTableFilterModel,
    auth: CMServerAuthorization,
    orderBy: Readonly<Record<string, "asc" | "desc">> | undefined,
    formattingLocale: string,
    skip: number,
    take?: number,
): { items: T[]; count: number } {
    const clauses = table.getUserFilterWhereClauses(filter, auth);
    const matches = rows.filter(row => clauses.every(clause => matchesDB3Where(row, clause))
        && (!filter.publicIds || filter.publicIds.includes(String(row[table.publicIdMember!]))));
    const collator = new Intl.Collator(formattingLocale, { sensitivity: "base", numeric: true });
    const order = Object.entries(orderBy ?? table.naturalOrderBy ?? {});
    matches.sort((left, right) => {
        for (const [member, direction] of order) {
            const a = left[member], b = right[member];
            const comparison = a == null ? (b == null ? 0 : 1) : b == null ? -1
                : typeof a === "number" && typeof b === "number" ? a - b : collator.compare(String(a), String(b));
            if (comparison) {
                return comparison * (direction === "desc" ? -1 : 1);
            }
        }
        const a = String(left[table.clientIdMember]), b = String(right[table.clientIdMember]);
        return a < b ? -1 : a > b ? 1 : 0;
    });
    return { items: matches.slice(skip, take === undefined ? undefined : skip + take), count: matches.length };
}
