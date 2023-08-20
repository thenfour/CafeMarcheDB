import { TAnyModel, clamp01, getNextSequenceId, lerp } from "./utils";


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
        if (this.columns < 2) return this.entries.length;
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
    getXY01ForIndex = (i: number, theoreticalEntryCount: number) => {

        // i hate calcs like these. like you have 3 rows, indices 0, 1, 2.
        // #0        #1        #2        #3
        //  ----------
        //            ----------
        //                      ----------
        //  | 0%                          | 100%
        //            33%       66%
        // so to calc the pos in linear space of an index, you have to divide by (elements-1), otherwise the last one would be 75%
        // effectively it's "axis max extent = count - 1"

        let columnCount = this.columns;
        if (columnCount < 1) columnCount = 1;
        let rowCount = Math.ceil(theoreticalEntryCount / columnCount); // columns=3, entries=4,  4/3=1.?, ceil = 2
        if (rowCount < 1) rowCount = 1;

        const yIndex = Math.floor(i / columnCount);
        const xIndex = i - (yIndex * columnCount);

        const x01 = (columnCount < 2) ? 0 : (xIndex / (columnCount - 1));
        const y01 = (rowCount < 2) ? 0 : (yIndex / (rowCount - 1));

        return { x01, y01 };
    };

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

export type PaletteGenValueType = "fixed" | "distX" | "distY" | "distXInv" | "distYInv" | "stepX" | "stepY";
export type PaletteGenValueLinkage = "strong" | "strongContrast" | "weak";

export interface PaletteGenValueArgs {
    obj?: TAnyModel;

    realMin: number;
    realMax: number;

    //inpOffset01: number; // an offset calculated before the rest
    offset01: number;
    type: PaletteGenValueType;
    linkage: PaletteGenValueLinkage;
    linkMix01: number;
}

// a value parameterized on x (0-1) 
export class PaletteGenValue {
    linkage: PaletteGenValueLinkage;
    linkMix01: number; // 0-1 mix between the linked value and our own value.

    realMin: number;
    realMax: number;

    range01: number;
    inpOffset01: number; // an offset calculated before the rest
    offset01: number;
    type: PaletteGenValueType;

    constructor(args: PaletteGenValueArgs) {
        this.linkage = args.linkage;

        this.realMin = args.realMin;
        this.realMax = args.realMax;

        this.range01 = 1;
        this.inpOffset01 = 0;
        this.offset01 = args.offset01;
        this.type = args.type;

        this.linkMix01 = args.linkMix01;

        if (args.obj) {
            this.linkage = args.obj.linkage;
            this.linkMix01 = args.obj.linkMix01;
            this.realMin = args.obj.realMin;
            this.realMax = args.obj.realMax;
            this.range01 = args.obj.range01;
            this.offset01 = args.obj.offset01;
            this.type = args.obj.type;
            this.inpOffset01 = args.obj.inpOffset01 || this.inpOffset01;
        }
    }

    calculateValueFromPalettePos = (x01, y01) => {
        let t = 0;
        x01 += this.inpOffset01;
        y01 += this.inpOffset01;
        switch (this.type) {
            case "fixed":
                break;
            case "distX":
                t = x01; break;
            case "distY":
                t = y01; break;
            case "distXInv":
                t = 1.0 - x01; break;
            case "distYInv":
                t = 1.0 - y01; break;
            case "stepX":
                t = x01 > 0.5 ? 1 : 0; break;
            case "stepY":
                t = y01 > 0.5 ? 1 : 0; break;
        }
        t *= this.range01;
        t += this.offset01; // doing this after ranging allows clean wrap behavior for hue
        return t; // 0-1 scale,may be oob
    };
}; // PaletteGenValue


export interface PaletteGenColorSpec {
    hue01: number; // 0-1, but may be oob (to be clamped by caller)
    sat01: number; // 0-1, but may be oob (to be clamped by caller)
    lum01: number; // 0-1, but may be oob (to be clamped by caller)
    alpha01: number; // 0-1, but may be oob (to be clamped by caller)

    hue: number; // 0-360
    sat: number; // 0-100 (%)
    lum: number; // 0-100 (%)
    alpha: number; // 0-1

    cssColor: string;
};

export interface PaletteGenColorSpecSet {
    strong: PaletteGenColorSpec;
    strongContrast: PaletteGenColorSpec;
    weak: PaletteGenColorSpec;
    weakContrast: PaletteGenColorSpec;
};

export class PaletteGenParamGroup {
    hue: PaletteGenValue;
    sat: PaletteGenValue;
    lum: PaletteGenValue;
    alpha: PaletteGenValue;

    constructor(linkMix01: number, obj?: TAnyModel) {
        this.hue = new PaletteGenValue({ obj: obj?.hue, realMin: 0, realMax: 360, linkage: "strong", offset01: 0, type: "distX", linkMix01 });
        this.sat = new PaletteGenValue({ obj: obj?.sat, realMin: 0, realMax: 100, linkage: "strong", offset01: 1, type: "fixed", linkMix01 });
        this.lum = new PaletteGenValue({ obj: obj?.lum, realMin: 0, realMax: 100, linkage: "strong", offset01: 0.5, type: "fixed", linkMix01 });
        this.alpha = new PaletteGenValue({ obj: obj?.alpha, realMin: 0, realMax: 1, linkage: "strong", offset01: 1, type: "fixed", linkMix01 });
    }

    colorSpecFrom01 = (hue01: number, sat01: number, lum01: number, alpha01: number) => {
        const hue = Math.round((hue01 % 1) * 360);
        const sat = Math.round(clamp01(sat01) * 100);
        const lum = Math.round(clamp01(lum01) * 100);
        const alpha = clamp01(alpha01);

        return {
            hue01,
            sat01,
            lum01,
            alpha01,

            hue,
            sat,
            lum,
            alpha,

            cssColor: `hsla(${hue}, ${sat}%, ${lum}%, ${alpha})`,
        };
    }

    calculateWithoutMix = (x01: number, y01: number): PaletteGenColorSpec => {
        const hue01 = this.hue.calculateValueFromPalettePos(x01, y01);
        const sat01 = this.sat.calculateValueFromPalettePos(x01, y01);
        const lum01 = this.lum.calculateValueFromPalettePos(x01, y01);
        const alpha01 = this.alpha.calculateValueFromPalettePos(x01, y01);

        return this.colorSpecFrom01(hue01, sat01, lum01, alpha01);
    };

    calculateWithMix = (x01: number, y01: number, src: PaletteGenColorSpecSet) => {
        const myColor = this.calculateWithoutMix(x01, y01); // only the 01 values are important here

        const selectColor = (l: PaletteGenValueLinkage) => {
            switch (l) {
                case "strong":
                    return src.strong;
                case "weak":
                    return src.weak;
                case "strongContrast":
                    return src.strongContrast;
            }
        };

        const hue01 = lerp(myColor.hue01, selectColor(this.hue.linkage).hue01, this.hue.linkMix01);
        const sat01 = lerp(myColor.sat01, selectColor(this.sat.linkage).sat01, this.sat.linkMix01);
        const lum01 = lerp(myColor.lum01, selectColor(this.lum.linkage).lum01, this.lum.linkMix01);
        const alpha01 = lerp(myColor.alpha01, selectColor(this.alpha.linkage).alpha01, this.alpha.linkMix01);
        return this.colorSpecFrom01(hue01, sat01, lum01, alpha01);
    };
};

export class PaletteGenParams {
    strong: PaletteGenParamGroup;
    strongContrast: PaletteGenParamGroup;
    weak: PaletteGenParamGroup;
    weakContrast: PaletteGenParamGroup;

    entryCount: number;
    columnCount: number;

    constructor(obj?: TAnyModel) {
        this.strong = new PaletteGenParamGroup(0);
        this.strongContrast = new PaletteGenParamGroup(1);
        this.weak = new PaletteGenParamGroup(1);
        this.weakContrast = new PaletteGenParamGroup(1);
        this.entryCount = 6;
        this.columnCount = 3;

        if (obj) {
            // enliven a json object
            this.strong = new PaletteGenParamGroup(0, obj.strong);
            this.strongContrast = new PaletteGenParamGroup(1, obj.strongContrast);
            this.weak = new PaletteGenParamGroup(1, obj.weak);
            this.weakContrast = new PaletteGenParamGroup(1, obj.weakContrast);

            this.entryCount = obj.entryCount;
            this.columnCount = obj.columnCount;
        }
    }
    // copy = () => {
    //     return Object.assign({}, this);
    // }
    generatePalette = () => {
        const ret = new ColorPalette({ columns: this.columnCount, defaultIndex: 0, entries: [] });
        for (let i = 0; i < this.entryCount; ++i) {
            //const t01 = i / this.entryCount;
            //const x01 = //
            const { x01, y01 } = ret.getXY01ForIndex(i, this.entryCount);
            const strong = this.strong.calculateWithoutMix(x01, y01);
            const weak = this.weak.calculateWithoutMix(x01, y01);
            const strongContrast = this.strongContrast.calculateWithoutMix(x01, y01); // , { strong, strongContrast, weak, weakContrast }
            const weakContrast = this.weakContrast.calculateWithoutMix(x01, y01);

            // do mixing
            const strongMixed = this.strong.calculateWithMix(x01, y01, { strong, strongContrast, weak, weakContrast });
            const strongContrastMixed = this.strongContrast.calculateWithMix(x01, y01, { strong: strongMixed, strongContrast, weak, weakContrast });
            const weakMixed = this.weak.calculateWithMix(x01, y01, { strong: strongMixed, strongContrast: strongContrastMixed, weak, weakContrast });
            const weakContrastMixed = this.weakContrast.calculateWithMix(x01, y01, { strong: strongMixed, strongContrast: strongContrastMixed, weak: weakMixed, weakContrast });

            const e = CreateColorPaletteEntry();
            e.id = `${i}`;
            e.strongValue = strongMixed.cssColor;// `hsla(${shue}, ${ssat}, ${slum}, ${salpha})`;
            e.strongContrastColor = strongContrastMixed.cssColor;// `black`;
            e.weakValue = weakMixed.cssColor;//  `hsla(${shue}, ${ssat}, ${slum}, ${salpha})`;
            e.weakContrastColor = weakContrastMixed.cssColor;// `black`;
            ret.entries.push(e);
        };
        //console.log(ret.entries);
        return ret;
    }
}



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

const generalPaletteGenParams = { "strong": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 0.736, "inpOffset01": 0, "offset01": 0.01, "type": "distX", "linkMix01": 0 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.86, "type": "fixed", "linkMix01": 0 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 0.488, "inpOffset01": 0.022000000000000002, "offset01": 0.364, "type": "distYInv", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0 } }, "strongContrast": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 0.695, "inpOffset01": 0, "offset01": 1, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 0.5, "inpOffset01": -0.166, "offset01": 0.306, "type": "stepY", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 1 } }, "weak": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.251, "type": "fixed", "linkMix01": 0 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0.785 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0.102, "offset01": -1, "type": "fixed", "linkMix01": 1 } }, "weakContrast": { "hue": { "linkage": "strongContrast", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 0.2811 }, "lum": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": -0.8, "offset01": -0.048, "type": "fixed", "linkMix01": 0 }, "alpha": { "linkage": "strongContrast", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 0.7236 } }, "entryCount": 14, "columnCount": 7 };
const grayscalePaletteGenParams = 0;
const attendanceResponsePaletteGenParams = 0;