// 0-dependency file.


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
