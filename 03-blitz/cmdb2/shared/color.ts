

export interface ColorPaletteEntry {
    label: string;
    value: string | null;
    contrastColor: string | null; // for text mostly
    outline: boolean;
}

// sentinel value for react components
export const gNullColorPaletteEntry: ColorPaletteEntry = {
    label: "(none)",
    value: null,
    contrastColor: null,
    outline: false,
};

export class ColorPaletteArgs {
    entries: ColorPaletteEntry[];
    columns: number;
    defaultIndex: number;
};

export class ColorPalette extends ColorPaletteArgs {

    get count(): number {
        return this.entries.length;
    }
    get rows(): number {
        return Math.ceil(this.entries.length / this.columns);
    }
    get defaultEntry(): ColorPaletteEntry {
        return this.entries[this.defaultIndex]!;
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

        // still not found; use default entry.
        return this.defaultEntry;
    }

    constructor(args: ColorPaletteArgs) {
        super();
        Object.assign(this, args);
    }
};



export const gGeneralPalette = new ColorPalette({
    columns: 4,
    defaultIndex: 0,
    entries: [
        { label: "(none)", value: null, contrastColor: null, outline: false, },
        { label: "Red", value: "#fdd", contrastColor: "black", outline: false, },
        { label: "Green", value: "#dfd", contrastColor: "black", outline: false, },
        { label: "Blue", value: "#ddf", contrastColor: "black", outline: false, },
        { label: "black", value: "black", contrastColor: "white", outline: true, },
        { label: "white", value: "white", contrastColor: "black", outline: true, },
    ],
});
