

export interface ColorPaletteEntry {
    label: string;
    value: string | null;
}

export class ColorPaletteArgs {
    entries: ColorPaletteEntry[];
    columns: number;
};

export class ColorPalette extends ColorPaletteArgs {
    // entries: ColorPaletteEntry[];
    // columns: number;
    get count(): number {
        return this.entries.length;
    }
    get rows(): number {
        return Math.ceil(this.entries.length / this.columns);
    }
    getEntriesForRow = (row: number) => {
        const firstEntry = row * this.columns;
        return this.entries.slice(firstEntry, firstEntry + this.columns);
    };
    // return an array of rows
    getAllRowsAndEntries(): ColorPaletteEntry[][] {
        const rows: ColorPaletteEntry[][] = [];
        for (let i = 0; i < this.rows; ++i) {
            rows.push(this.getEntriesForRow(i));
        }
        return rows;
    }

    // undefined if doesn't exist
    findColorPaletteEntry(colorString: string | null): ColorPaletteEntry {
        let ret = this.entries.find(i => i.value === colorString);
        if (ret !== undefined) return ret;

        // not found; treat as null?
        ret = this.entries.find(i => i.value === null);
        if (ret !== undefined) return ret;
        if (this.entries.length < 1) throw new Error("palettes must have at least 1 entry or what's really the point rite??");

        // still not found; use first entry.
        return this.entries[0]!;
    }

    constructor(args: ColorPaletteArgs) {
        super();
        Object.assign(this, args);
    }
};



export const gGeneralPalette = new ColorPalette({
    columns: 4,
    entries: [
        { label: "(none)", value: null },
        { label: "Red", value: "red" },
        { label: "Green", value: "green" },
        { label: "Blue", value: "blue" },
        { label: "black", value: "black" },
        { label: "white", value: "white" },
        { label: "pink", value: "pink" },
    ],
});