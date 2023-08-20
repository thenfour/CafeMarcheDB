import { getNextSequenceId } from "./utils";


export interface ColorPaletteEntry {
    id: string; // used for database match
    label: string;
    outline: boolean; // for black / white, this is useful

    // normal filled chip type
    strongValue: string;
    strongContrastColor: string; // for text mostly

    //  for de-emphasized we need an inverted value
    weakValue: string;
    weakContrastColor: string; // for text mostly
};

// // sentinel value for react components
// export const gNullColorPaletteEntry: ColorPaletteEntry = {
//     id: null, // used for database match
//     label: "(none)",
//     outline: false,
//     strongValue: null,
//     strongContrastColor: null,
//     weakValue: null,
//     weakContrastColor: null,
// };

// sentinel value for react components
// export const gDefaultColorPaletteEntry: ColorPaletteEntry = {
//     id: "", // used for database match
//     label: "(none)",
//     outline: false,
//     strongValue: null,
//     strongContrastColor: null,
//     weakValue: null,
//     weakContrastColor: null,
// } as const;

export const CreateColorPaletteEntry = () => {
    const ret: ColorPaletteEntry = {
        id: `${getNextSequenceId()}`,
        label: "sample",
        outline: false,
        strongValue: "#f00",
        strongContrastColor: "white",
        weakValue: "#f002",
        weakContrastColor: "#f008",
    };
    return ret;
}
export const CreateNullPaletteEntry = () => {
    const ret: ColorPaletteEntry = {
        id: `${getNextSequenceId()}`,
        label: "(none)",
        outline: false,
        strongValue: "#0002",
        strongContrastColor: "black",
        weakValue: "#0002",
        weakContrastColor: "black",
    };
    return ret;
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
        let ret = this.entries.find(i => i.id === colorString);
        if (ret !== undefined) return ret;

        // not found; treat as null?
        ret = this.entries.find(i => i.id === null);
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
        { id: "Red", label: "Red", strongValue: "#fdd", strongContrastColor: "black", outline: false, weakValue: "#fee", weakContrastColor: "#c88", },
        { id: "Green", label: "Green", strongValue: "#dfd", strongContrastColor: "black", outline: false, weakValue: "#fee", weakContrastColor: "#c88", },
        { id: "Blue", label: "Blue", strongValue: "#ddf", strongContrastColor: "black", outline: false, weakValue: "#fee", weakContrastColor: "#c88", },
        { id: "black", label: "black", strongValue: "black", strongContrastColor: "white", outline: true, weakValue: "#fee", weakContrastColor: "#c88", },
        { id: "white", label: "white", strongValue: "white", strongContrastColor: "black", outline: true, weakValue: "#fee", weakContrastColor: "#c88", },
    ],
});
