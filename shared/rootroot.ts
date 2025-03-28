// 0-dependency file.

export type SortDirection = "asc" | "desc";

export function OpposingSortDirection(x: SortDirection) {
    return x === "asc" ? "desc" : "asc";
}

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////
// slug field is calculated from another field.
// it is calculated live during creation, but afterwards it's user-editable.
// https://gist.github.com/codeguy/6684588
// this function must be idempotent for wikis in order to support slugifying user-input URLs.
export const slugify = (...args: (string | number)[]): string => {
    const value = args.join(' ');

    return value
        .normalize('NFD') // Split an accented letter into the base letter and the accent
        .replace(/[\u0300-\u036f]/g, '') // Remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 _-]/g, '') // Allow single hyphens and spaces, disallow other characters
        .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
        .replace(/-+/g, '-'); // Replace multiple hyphens with a single hyphen
}

export const unslugify = (slug: string): string => {
    return slug
        .replace(/[-_]+/g, ' ') // Replace all hyphens or underscores with spaces
        .split(' ')
        .filter(s => s.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1))
        .join(' ');
}

export const slugifyWithDots = (...args: (string | number)[]): string => {
    const value = args.join(' ');

    return value
        .normalize('NFD') // Split an accented letter into the base letter and the accent
        .replace(/[\u0300-\u036f]/g, '') // Remove all previously split accents
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9 _.-]/g, '') // Allow single hyphens, dots, spaces, underscores, disallow other characters
        .replace(/[\s_-]+/g, '-') // Replace spaces, underscores, and hyphens with a single hyphen
        .replace(/-+/g, '-'); // Replace multiple hyphens with a single hyphen
};



export function formatFileSize(bytes: number): string {
    if (bytes < 1024) {
        return bytes + ' Bytes';
    }
    if (bytes < 1024 * 1024) {
        return (bytes / 1024).toFixed(2) + ' KB';
    }
    if (bytes < 1024 * 1024 * 1024) {
        return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
    }
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
}


export class Stopwatch {
    startTime: number;
    constructor() {
        this.startTime = Date.now();
    }
    get ElapsedMillis() {
        return Date.now() - this.startTime;
    }
    reset() {
        this.startTime = Date.now();
    }

    loghelper(prefix: string, obj?: any) {
        const elapsed = this.ElapsedMillis;
        const payloadSize = JSON.stringify(obj).length;
        console.log(`${prefix}: elapsed: ${elapsed} ms, size:${formatFileSize(payloadSize)}`);
    }

    loghelperAndReset(prefix: string, obj?: any) {
        this.loghelper(prefix, obj);
        this.reset();
    };
};



export class TableAccessor<TRow extends { id: number }> {
    private rows: Map<TRow['id'], TRow>;
    private asArray: TRow[];

    constructor(rows: TRow[]) {
        this.asArray = rows;
        this.rows = new Map(rows.map(row => [row.id, row]));
    }

    public get items() {
        return [...this.asArray];
    }

    public getById(id: TRow['id'] | null | undefined): TRow | null {
        if (id == null) return null;
        return this.rows.get(id) || null;
    }

    public map<T>(callback: (row: TRow, index: number, array: TRow[]) => T): T[] {
        return Array.from(this.rows.values()).map(callback);
    }

    public find(predicate: (row: TRow) => boolean): TRow | undefined {
        for (let row of this.rows.values()) {
            if (predicate(row)) {
                return row;
            }
        }
        return undefined;
    }

    public filter(predicate: (row: TRow) => boolean): TRow[] {
        return Array.from(this.rows.values()).filter(predicate);
    }

    public some(predicate: (row: TRow) => boolean): boolean {
        return Array.from(this.rows.values()).some(predicate);
    }

    public every(predicate: (row: TRow) => boolean): boolean {
        return Array.from(this.rows.values()).every(predicate);
    }

    // applies this to a collection of rows.
    public populateTags<T, TKey extends keyof T>(
        items: T[],
        tagIdField: TKey,
        tagField: TKey
    ): T[] {
        return items.map(item => ({
            ...item,
            [tagField]: this.getById(item[tagIdField] as unknown as TRow['id'])
        })) as T[];
    }

};

// https://stackoverflow.com/questions/53807517/how-to-test-if-two-types-are-exactly-the-same
export type IfEquals<T, U, Y = unknown, N = never> =
    (<G>() => G extends T ? 1 : 2) extends
    (<G>() => G extends U ? 1 : 2) ? Y : N;

// Compile-time check that the schema matches the original type
/** Trigger a compiler error when a value is _not_ an exact type. */
export declare const exactType: <T, U>(
    draft: T & IfEquals<T, U>,
    expected: U & IfEquals<T, U>
) => IfEquals<T, U>

export const AssertEqualTypes = <T, U>() => (true as IfEquals<T, U>);

// like filter() but
// returns both matching & nonmatching items.
export function partition<TRow>(
    array: TRow[],
    predicate: (row: TRow) => boolean
): [TRow[], TRow[]] {
    const matching: TRow[] = [];
    const notMatching: TRow[] = [];

    for (const item of array) {
        if (predicate(item)) {
            matching.push(item);
        } else {
            notMatching.push(item);
        }
    }

    return [matching, notMatching];
}

export function calculateMatchStrength(text: string, keyword: string): number {
    // Return 0 for empty or whitespace-only keywords.
    if (!keyword.trim()) return 0;

    const lowerText = text.toLowerCase();
    const lowerKeyword = keyword.toLowerCase();
    const index = lowerText.indexOf(lowerKeyword);
    if (index === -1) return 0;

    // Base score: 1 for at least one match.
    let score = 1;

    // Bonus if the match occurs at a word boundary.
    if (/\W/.test(lowerText.charAt(index - 1))) {
        score += 1;
    }

    // bonus if the match occurs at the start of the text.
    if (index === 0) {
        score += 2;
    }

    // Bonus for additional occurrences (each extra occurrence adds 0.5).
    const occurrences = lowerText.split(lowerKeyword).length - 1;
    score += (occurrences - 1) * 0.5;

    // scale by keyword length. short keywords (1 & 2 chars) are less strong
    if (keyword.length < 3) {
        score *= 0.7; // reduce score for short keywords
    }
    else if (keyword.length > 5) {
        score *= 1.5; // increase score for long keywords
    }
    return score;
}

export function calculateMatchStrengthAllKeywordsRequired(text: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
        const matchStrength = calculateMatchStrength(text, keyword);
        if (matchStrength === 0) return 0; // if any keyword doesn't match, return 0
        score += matchStrength;
    }
    return score;
}

export function calculateMatchStrengthAnyKeyword(text: string, keywords: string[]): number {
    let score = 0;
    for (const keyword of keywords) {
        const matchStrength = calculateMatchStrength(text, keyword);
        score += matchStrength;
    }
    return score;
}