import { TAnyModel, clamp01, getNextSequenceId, lerp } from "./utils";

// something to consider:
// https://ageofempires.fandom.com/wiki/Player#Age_of_Empires_II
// https://starcraft.fandom.com/wiki/Colors

export interface ColorPaletteEntryVariation {
    backgroundColor: string;
    foregroundColor: string;
    showBorder: boolean;
};

// NB: serializable
export interface ColorPaletteEntry {
    id: string; // used for database match; hand-made. palettegen generates them though.
    label: string;
    strongDisabled: ColorPaletteEntryVariation;
    strongDisabledSelected: ColorPaletteEntryVariation;
    strong: ColorPaletteEntryVariation;
    strongSelected: ColorPaletteEntryVariation;
    weakDisabled: ColorPaletteEntryVariation;
    weakDisabledSelected: ColorPaletteEntryVariation;
    weak: ColorPaletteEntryVariation;
    weakSelected: ColorPaletteEntryVariation;
};

export type ColorVariationOptions = "strong" | "weak";

export interface ColorVariationSpec {
    variation: ColorVariationOptions;
    enabled: boolean;
    selected: boolean;
}

export interface GetColorVariationArgs extends ColorVariationSpec {
    color: ColorPaletteEntry;
}

export const gStrongDisabled: ColorVariationSpec = { variation: "strong", enabled: false, selected: false };
export const gStrongDisabledSelected: ColorVariationSpec = { variation: "strong", enabled: false, selected: true };
export const gStrong: ColorVariationSpec = { variation: "strong", enabled: true, selected: false };
export const gStrongSelected: ColorVariationSpec = { variation: "strong", enabled: true, selected: true };
export const gWeakDisabled: ColorVariationSpec = { variation: "weak", enabled: false, selected: false };
export const gWeakDisabledSelected: ColorVariationSpec = { variation: "weak", enabled: false, selected: true };
export const gWeak: ColorVariationSpec = { variation: "weak", enabled: true, selected: false };
export const gWeakSelected: ColorVariationSpec = { variation: "weak", enabled: true, selected: true };


export const StandardVariationSpec = {
    StrongDisabled: gStrongDisabled,
    StrongDisabledSelected: gStrongDisabledSelected,
    Strong: gStrong,
    StrongSelected: gStrongSelected,
    WeakDisabled: gWeakDisabled,
    WeakDisabledSelected: gWeakDisabledSelected,
    Weak: gWeak,
    WeakSelected: gWeakSelected,
}

export const GetColorVariation = (args: GetColorVariationArgs): ColorPaletteEntryVariation => {
    if (args.variation === "strong") {
        if (!args.enabled) {
            if (!args.selected) return args.color.strongDisabled;
            return args.color.strongDisabledSelected;
        }
        if (!args.selected) return args.color.strong;
        return args.color.strongSelected;
    }
    if (!args.enabled) {
        if (!args.selected) return args.color.weakDisabled;
        return args.color.weakDisabledSelected;
    }
    if (!args.selected) return args.color.weak;
    return args.color.weakSelected;
};

const CreatePaletteEntry = (id: string,
    label: string,

    strongDisabled_BackgroundColor: string,
    strongDisabled_ForegroundColor: string,
    strongDisabled_ShowBorder: boolean,

    strongDisabledSelected_BackgroundColor: string,
    strongDisabledSelected_ForegroundColor: string,
    strongDisabledSelected_ShowBorder: boolean,

    strongEnabled_BackgroundColor: string,
    strongEnabled_ForegroundColor: string,
    strongEnabled_ShowBorder: boolean,

    strongEnabledSelected_BackgroundColor: string,
    strongEnabledSelected_ForegroundColor: string,
    strongEnabledSelected_ShowBorder: boolean,

    weakDisabled_BackgroundColor: string,
    weakDisabled_ForegroundColor: string,
    weakDisabled_ShowBorder: boolean,

    weakDisabledSelected_BackgroundColor: string,
    weakDisabledSelected_ForegroundColor: string,
    weakDisabledSelected_ShowBorder: boolean,

    weakEnabled_BackgroundColor: string,
    weakEnabled_ForegroundColor: string,
    weakEnabled_ShowBorder: boolean,

    weakEnabledSelected_BackgroundColor: string,
    weakEnabledSelected_ForegroundColor: string,
    weakEnabledSelected_ShowBorder: boolean,

): ColorPaletteEntry => {
    return {
        id,
        label,
        strongDisabled: {
            backgroundColor: strongDisabled_BackgroundColor,
            foregroundColor: strongDisabled_ForegroundColor,
            showBorder: strongDisabled_ShowBorder,
        },
        strongDisabledSelected: {
            backgroundColor: strongDisabledSelected_BackgroundColor,
            foregroundColor: strongDisabledSelected_ForegroundColor,
            showBorder: strongDisabledSelected_ShowBorder,
        },
        strong: {
            backgroundColor: strongEnabled_BackgroundColor,
            foregroundColor: strongEnabled_ForegroundColor,
            showBorder: strongEnabled_ShowBorder,
        },
        strongSelected: {
            backgroundColor: strongEnabledSelected_BackgroundColor,
            foregroundColor: strongEnabledSelected_ForegroundColor,
            showBorder: strongEnabledSelected_ShowBorder,
        },
        weakDisabled: {
            backgroundColor: weakDisabled_BackgroundColor,
            foregroundColor: weakDisabled_ForegroundColor,
            showBorder: weakDisabled_ShowBorder,
        },
        weakDisabledSelected: {
            backgroundColor: weakDisabledSelected_BackgroundColor,
            foregroundColor: weakDisabledSelected_ForegroundColor,
            showBorder: weakDisabledSelected_ShowBorder,
        },
        weak: {
            backgroundColor: weakEnabled_BackgroundColor,
            foregroundColor: weakEnabled_ForegroundColor,
            showBorder: weakEnabled_ShowBorder,
        },
        weakSelected: {
            backgroundColor: weakEnabledSelected_BackgroundColor,
            foregroundColor: weakEnabledSelected_ForegroundColor,
            showBorder: weakEnabledSelected_ShowBorder,
        },
    };
};

function CreateSimplePaletteEntry(id: string, label: string, backgroundColor: string, foregroundColor: string) {
    return CreatePaletteEntry(id,
        label,
        backgroundColor,// strongDisabled_BackgroundColor: string,
        foregroundColor,// strongDisabled_ForegroundColor: string,
        true,// strongDisabled_ShowBorder: boolean,

        backgroundColor,// strongDisabledSelected_BackgroundColor: string,
        foregroundColor,// strongDisabledSelected_ForegroundColor: string,
        true,// strongDisabledSelected_ShowBorder: boolean,

        backgroundColor,// strongEnabled_BackgroundColor: string,
        foregroundColor,// strongEnabled_ForegroundColor: string,
        true,// strongEnabled_ShowBorder: boolean,

        backgroundColor,// strongEnabledSelected_BackgroundColor: string,
        foregroundColor,// strongEnabledSelected_ForegroundColor: string,
        true,// strongEnabledSelected_ShowBorder: boolean,

        backgroundColor,// weakDisabled_BackgroundColor: string,
        foregroundColor,// weakDisabled_ForegroundColor: string,
        true,// weakDisabled_ShowBorder: boolean,

        backgroundColor,// weakDisabledSelected_BackgroundColor: string,
        foregroundColor,// weakDisabledSelected_ForegroundColor: string,
        true,// weakDisabledSelected_ShowBorder: boolean,

        backgroundColor,// weakEnabled_BackgroundColor: string,
        foregroundColor,// weakEnabled_ForegroundColor: string,
        true,// weakEnabled_ShowBorder: boolean,

        backgroundColor,// weakEnabledSelected_BackgroundColor: string,
        foregroundColor,// weakEnabledSelected_ForegroundColor: string,
        true,// weakEnabledSelected_ShowBorder: boolean,
    );
}

// color editor outputs this.
const gPaletteMap: ColorPaletteEntry[] = [
    CreatePaletteEntry("black", "black", "#444444", "#888888", false, "#444444", "#eeeeee", false, "#000000", "#b3b5c9", true, "#000000", "#d8d9e4", true, "#444444", "#888888", false, "#444444", "#eeeeee", false, "#474a61", "#b3b5c9", false, "#474a61", "#eeeeee", false),
    CreatePaletteEntry("dark_gray", "dark_gray", "#666666", "#aaaaaa", false, "#666666", "#eeeeee", false, "#474a61", "#d8d9e4", false, "#444444", "#d7dbff", false, "#666666", "#aaaaaa", false, "#666666", "#eeeeee", false, "#6a7095", "#b3b5c9", false, "#6a7095", "#eeeeee", false),
    CreatePaletteEntry("gray", "gray", "#aaaaaa", "#dddddd", false, "#aaaaaa", "#ffffff", false, "#8e92af", "#ffffff", false, "#8e92af", "#ffffff", false, "#aaaaaa", "#dddddd", false, "#aaaaaa", "#ffffff", false, "#b3b5c9", "#eeeeee", false, "#b3b5c9", "#ffffff", false),
    CreatePaletteEntry("light_gray", "light_gray", "#cccccc", "#888888", false, "#cccccc", "#444444", false, "#b3b5c9", "#474a61", false, "#b3b5c9", "#474a61", false, "#cccccc", "#888888", false, "#cccccc", "#444444", false, "#b3b5c9", "#6a7095", false, "#b3b5c9", "#474a61", false),
    CreatePaletteEntry("white", "white", "#eeeeee", "#aaaaaa", false, "#eeeeee", "#666666", false, "#ffffff", "#474a61", true, "#ffffff", "#474a61", true, "#eeeeee", "#aaaaaa", false, "#eeeeee", "#666666", false, "#d8d9e4", "#6a7095", false, "#d8d9e4", "#000000", false),
    CreatePaletteEntry("pink", "pink", "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#ff9f88", "#eeeeee", false, "#ff9f88", "#ffffff", false, "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#ffcfc2", "#6f2013", false, "#ffcfc2", "#000000", false),
    CreatePaletteEntry("red", "red", "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#e62b19", "#ffcfc2", false, "#e62b19", "#ffffff", false, "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#ff9f88", "#eeeeee", false, "#ff9f88", "#ffffff", false),
    CreatePaletteEntry("maroon", "maroon", "#888888", "#eeeeee", false, "#888888", "#ffffff", false, "#962b49", "#f9cfd5", false, "#962b49", "#ffffff", false, "#888888", "#eeeeee", false, "#888888", "#ffffff", false, "#ee9fac", "#eeeeee", false, "#ee9fac", "#ffffff", false),
    CreatePaletteEntry("brown", "brown", "#888888", "#eeeeee", false, "#888888", "#eeeeee", false, "#886635", "#f1e1cf", false, "#886635", "#ffffff", false, "#888888", "#eeeeee", false, "#888888", "#eeeeee", false, "#cea772", "#f1e1cf", false, "#cea772", "#ffffff", false),
    CreatePaletteEntry("orange", "orange", "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#ff7700", "#ffddc4", false, "#ff7700", "#ffffff", false, "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#ffbc8a", "#ffddc4", false, "#ffbc8a", "#ffffff", false),
    CreatePaletteEntry("yellow", "yellow", "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#ffcc00", "#786117", false, "#ffcc00", "#000000", false, "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#ffe596", "#786117", false, "#ffe596", "#000000", false),
    CreatePaletteEntry("light_yellow", "light_yellow", "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#eeff00", "#71771b", false, "#eeff00", "#000000", false, "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#fdff9d", "#71771b", false, "#fdff9d", "#000000", false),
    CreatePaletteEntry("lime_green", "lime_green", "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#8fb300", "#e6ecc7", false, "#8fb300", "#ffffff", false, "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#ccd98f", "#475614", false, "#ccd98f", "#000000", false),
    CreatePaletteEntry("green", "green", "#888888", "#eeeeee", false, "#888888", "#eeeeee", false, "#00b300", "#d0edc6", false, "#00b300", "#ffffff", false, "#888888", "#eeeeee", false, "#888888", "#eeeeee", false, "#a0db8e", "#d0edc6", false, "#a0db8e", "#ffffff", false),
    CreatePaletteEntry("teal", "teal", "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#ffffff", false, "#00b39e", "#cfede6", false, "#00b39e", "#ffffff", false, "#aaaaaa", "#ffffff", false, "#aaaaaa", "#ffffff", false, "#9edacd", "#cfede6", false, "#9edacd", "#ffffff", false),
    CreatePaletteEntry("blue", "blue", "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#0077ff", "#d7dbff", false, "#0077ff", "#ffffff", false, "#aaaaaa", "#eeeeee", false, "#aaaaaa", "#eeeeee", false, "#abb8ff", "#d7dbff", false, "#abb8ff", "#ffffff", false),
    CreatePaletteEntry("purple", "purple", "#888888", "#eeeeee", false, "#888888", "#eeeeee", false, "#9922dd", "#eaccf8", false, "#9922dd", "#ffffff", false, "#888888", "#eeeeee", false, "#888888", "#eeeeee", false, "#d399f0", "#eaccf8", false, "#d399f0", "#ffffff", false),

];

export const CreateNullPaletteEntry = () => {
    const ret = CreateSimplePaletteEntry(`${getNextSequenceId()}`, "(none)", "#eee", "#888");
    return ret;
};

export const FetchColorPaletteEntry = (id: string): ColorPaletteEntry => {
    const f = gPaletteMap.find(e => e.id === id);
    if (f) {
        return { ...f };
    }
    const ret = CreateNullPaletteEntry();
    ret.id = id;
    ret.label = id;
    return ret;
}

// export interface ColorPaletteCorrection {
//     id?: string;
//     label?: string;
//     strongOutline?: boolean;
//     weakOutline?: boolean;
// };

export class ColorPaletteArgs {
    name: string;
    entries: ColorPaletteEntry[];
    columns: number;
    defaultIndex: number;
    //corrections?: ColorPaletteCorrection[];
};

export class ColorPalette extends ColorPaletteArgs {

    constructor(args: ColorPaletteArgs) {
        super();
        Object.assign(this, args);
        // apply corrections
        // if (args.corrections) {
        //     args.corrections.forEach((c, i) => {
        //         Object.assign(this.entries[i]!, c);
        //     });
        // }
    }

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

    // this must return undefined in order for palettelist to know if a match was found. don't fallback to default entry.
    findEntry(id: string | null): ColorPaletteEntry | null | undefined {
        if (id == null) return null;
        return this.entries.find(i => i.id === id);
    }
};


// export type PaletteGenValueType = "fixed" | "distX" | "distY" | "distXInv" | "distYInv" | "stepX" | "stepY";
// export type PaletteGenValueLinkage = "strong" | "strongContrast" | "weak";

// export interface PaletteGenValueArgs {
//     obj?: TAnyModel;

//     realMin: number;
//     realMax: number;

//     //inpOffset01: number; // an offset calculated before the rest
//     offset01: number;
//     type: PaletteGenValueType;
//     linkage: PaletteGenValueLinkage;
//     linkMix01: number;
// }

// // a value parameterized on x (0-1)
// export class PaletteGenValue {
//     linkage: PaletteGenValueLinkage;
//     linkMix01: number; // 0-1 mix between the linked value and our own value.

//     realMin: number;
//     realMax: number;

//     range01: number;
//     inpOffset01: number; // an offset calculated before the rest
//     offset01: number;
//     type: PaletteGenValueType;

//     constructor(args: PaletteGenValueArgs) {
//         this.linkage = args.linkage;

//         this.realMin = args.realMin;
//         this.realMax = args.realMax;

//         this.range01 = 1;
//         this.inpOffset01 = 0;
//         this.offset01 = args.offset01;
//         this.type = args.type;

//         this.linkMix01 = args.linkMix01;

//         if (args.obj) {
//             this.linkage = args.obj.linkage;
//             this.linkMix01 = args.obj.linkMix01;
//             this.realMin = args.obj.realMin;
//             this.realMax = args.obj.realMax;
//             this.range01 = args.obj.range01;
//             this.offset01 = args.obj.offset01;
//             this.type = args.obj.type;
//             this.inpOffset01 = args.obj.inpOffset01 || this.inpOffset01;
//         }
//     }

//     calculateValueFromPalettePos = (x01, y01) => {
//         let t = 0;
//         x01 += this.inpOffset01;
//         y01 += this.inpOffset01;
//         switch (this.type) {
//             case "fixed":
//                 break;
//             case "distX":
//                 t = x01; break;
//             case "distY":
//                 t = y01; break;
//             case "distXInv":
//                 t = 1.0 - x01; break;
//             case "distYInv":
//                 t = 1.0 - y01; break;
//             case "stepX":
//                 t = x01 > 0.5 ? 1 : 0; break;
//             case "stepY":
//                 t = y01 > 0.5 ? 1 : 0; break;
//         }
//         t *= this.range01;
//         t += this.offset01; // doing this after ranging allows clean wrap behavior for hue
//         return t; // 0-1 scale,may be oob
//     };
// }; // PaletteGenValue


// export interface PaletteGenColorSpec {
//     hue01: number; // 0-1, but may be oob (to be clamped by caller)
//     sat01: number; // 0-1, but may be oob (to be clamped by caller)
//     lum01: number; // 0-1, but may be oob (to be clamped by caller)
//     alpha01: number; // 0-1, but may be oob (to be clamped by caller)

//     hue: number; // 0-360
//     sat: number; // 0-100 (%)
//     lum: number; // 0-100 (%)
//     alpha: number; // 0-1

//     cssColor: string;
// };

// export interface PaletteGenColorSpecSet {
//     strong: PaletteGenColorSpec;
//     strongContrast: PaletteGenColorSpec;
//     weak: PaletteGenColorSpec;
//     weakContrast: PaletteGenColorSpec;
// };

// export class PaletteGenParamGroup {
//     hue: PaletteGenValue;
//     sat: PaletteGenValue;
//     lum: PaletteGenValue;
//     alpha: PaletteGenValue;

//     constructor(linkMix01: number, obj?: TAnyModel) {
//         this.hue = new PaletteGenValue({ obj: obj?.hue, realMin: 0, realMax: 360, linkage: "strong", offset01: 0, type: "distX", linkMix01 });
//         this.sat = new PaletteGenValue({ obj: obj?.sat, realMin: 0, realMax: 100, linkage: "strong", offset01: 1, type: "fixed", linkMix01 });
//         this.lum = new PaletteGenValue({ obj: obj?.lum, realMin: 0, realMax: 100, linkage: "strong", offset01: 0.5, type: "fixed", linkMix01 });
//         this.alpha = new PaletteGenValue({ obj: obj?.alpha, realMin: 0, realMax: 1, linkage: "strong", offset01: 1, type: "fixed", linkMix01 });
//     }

//     colorSpecFrom01 = (hue01: number, sat01: number, lum01: number, alpha01: number) => {
//         const hue = Math.round((hue01 % 1) * 360);
//         const sat = Math.round(clamp01(sat01) * 100);
//         const lum = Math.round(clamp01(lum01) * 100);
//         const alpha = clamp01(alpha01);

//         return {
//             hue01,
//             sat01,
//             lum01,
//             alpha01,

//             hue,
//             sat,
//             lum,
//             alpha,

//             cssColor: `hsla(${hue}, ${sat}%, ${lum}%, ${alpha})`,
//         };
//     }

//     calculateWithoutMix = (x01: number, y01: number): PaletteGenColorSpec => {
//         const hue01 = this.hue.calculateValueFromPalettePos(x01, y01);
//         const sat01 = this.sat.calculateValueFromPalettePos(x01, y01);
//         const lum01 = this.lum.calculateValueFromPalettePos(x01, y01);
//         const alpha01 = this.alpha.calculateValueFromPalettePos(x01, y01);

//         return this.colorSpecFrom01(hue01, sat01, lum01, alpha01);
//     };

//     calculateWithMix = (x01: number, y01: number, src: PaletteGenColorSpecSet) => {
//         const myColor = this.calculateWithoutMix(x01, y01); // only the 01 values are important here

//         const selectColor = (l: PaletteGenValueLinkage) => {
//             switch (l) {
//                 case "strong":
//                     return src.strong;
//                 case "weak":
//                     return src.weak;
//                 case "strongContrast":
//                     return src.strongContrast;
//             }
//         };

//         const hue01 = lerp(myColor.hue01, selectColor(this.hue.linkage).hue01, this.hue.linkMix01);
//         const sat01 = lerp(myColor.sat01, selectColor(this.sat.linkage).sat01, this.sat.linkMix01);
//         const lum01 = lerp(myColor.lum01, selectColor(this.lum.linkage).lum01, this.lum.linkMix01);
//         const alpha01 = lerp(myColor.alpha01, selectColor(this.alpha.linkage).alpha01, this.alpha.linkMix01);
//         return this.colorSpecFrom01(hue01, sat01, lum01, alpha01);
//     };
// };

// export class PaletteGenParams {
//     strong: PaletteGenParamGroup;
//     strongContrast: PaletteGenParamGroup;
//     weak: PaletteGenParamGroup;
//     weakContrast: PaletteGenParamGroup;

//     entryCount: number;
//     columnCount: number;

//     constructor(obj?: TAnyModel) {
//         this.strong = new PaletteGenParamGroup(0);
//         this.strongContrast = new PaletteGenParamGroup(1);
//         this.weak = new PaletteGenParamGroup(1);
//         this.weakContrast = new PaletteGenParamGroup(1);
//         this.entryCount = 6;
//         this.columnCount = 3;

//         if (obj) {
//             // enliven a json object
//             this.strong = new PaletteGenParamGroup(0, obj.strong);
//             this.strongContrast = new PaletteGenParamGroup(1, obj.strongContrast);
//             this.weak = new PaletteGenParamGroup(1, obj.weak);
//             this.weakContrast = new PaletteGenParamGroup(1, obj.weakContrast);

//             this.entryCount = obj.entryCount;
//             this.columnCount = obj.columnCount;
//         }
//     }
//     // copy = () => {
//     //     return Object.assign({}, this);
//     // }
//     generatePalette = () => {
//         const ret = new ColorPalette({ columns: this.columnCount, defaultIndex: 0, entries: [] });
//         for (let i = 0; i < this.entryCount; ++i) {
//             //const t01 = i / this.entryCount;
//             //const x01 = //
//             const { x01, y01 } = ret.getXY01ForIndex(i, this.entryCount);
//             const strong = this.strong.calculateWithoutMix(x01, y01);
//             const weak = this.weak.calculateWithoutMix(x01, y01);
//             const strongContrast = this.strongContrast.calculateWithoutMix(x01, y01); // , { strong, strongContrast, weak, weakContrast }
//             const weakContrast = this.weakContrast.calculateWithoutMix(x01, y01);

//             // do mixing
//             const strongMixed = this.strong.calculateWithMix(x01, y01, { strong, strongContrast, weak, weakContrast });
//             const strongContrastMixed = this.strongContrast.calculateWithMix(x01, y01, { strong: strongMixed, strongContrast, weak, weakContrast });
//             const weakMixed = this.weak.calculateWithMix(x01, y01, { strong: strongMixed, strongContrast: strongContrastMixed, weak, weakContrast });
//             const weakContrastMixed = this.weakContrast.calculateWithMix(x01, y01, { strong: strongMixed, strongContrast: strongContrastMixed, weak: weakMixed, weakContrast });

//             const e = CreateColorPaletteEntry();
//             e.id = `${i}`;
//             e.strongValue = strongMixed.cssColor;// `hsla(${shue}, ${ssat}, ${slum}, ${salpha})`;
//             e.strongContrastColor = strongContrastMixed.cssColor;// `black`;
//             e.weakValue = weakMixed.cssColor;//  `hsla(${shue}, ${ssat}, ${slum}, ${salpha})`;
//             e.weakContrastColor = weakContrastMixed.cssColor;// `black`;
//             ret.entries.push(e);
//         };
//         //console.log(ret.entries);
//         return ret;
//     }
// }

//
export class ColorPaletteList {
    palettes: ColorPalette[];
    constructor(palettes: ColorPalette[]) {
        this.palettes = palettes;
    }

    get defaultEntry(): ColorPaletteEntry {
        return this.palettes[0]!.defaultEntry;
    }

    findEntry(id: string | null): ColorPaletteEntry | null {
        if (id == null) return null;
        for (let i = 0; i < this.palettes.length; ++i) {
            const found = this.palettes[i]?.findEntry(id);
            if (found) return found;
        }
        return null;
    }
};

// 5x2
// const generalPaletteGenParams = { "strong": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 0.488, "inpOffset01": 0, "offset01": 0.364, "type": "distX", "linkMix01": 0 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.86, "type": "fixed", "linkMix01": 0 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 0.488, "inpOffset01": 0.022000000000000002, "offset01": 0.364, "type": "distYInv", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0 } }, "strongContrast": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 0.695, "inpOffset01": 0, "offset01": 1, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 0.5, "inpOffset01": -0.166, "offset01": 0.306, "type": "stepY", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 1 } }, "weak": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.251, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0.3956 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0.102, "offset01": -1, "type": "fixed", "linkMix01": 1 } }, "weakContrast": { "hue": { "linkage": "strongContrast", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 0.2811 }, "lum": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": -0.8, "offset01": -0.048, "type": "fixed", "linkMix01": 0 }, "alpha": { "linkage": "strongContrast", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 0.7059000000000001 } }, "entryCount": 10, "columnCount": 5 };
//const generalPaletteArgs = { "entries": [{ "id": "0", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(131, 86%, 84%, 1)", "strongContrastColor": "hsla(131, 86%, 31%, 1)", "weakValue": "hsla(131, 86%, 94%, 1)", "weakContrastColor": "hsla(131, 0%, 0%, 0.41180000000000017)" }, { "id": "1", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(175, 86%, 84%, 1)", "strongContrastColor": "hsla(175, 86%, 31%, 1)", "weakValue": "hsla(175, 86%, 94%, 1)", "weakContrastColor": "hsla(175, 0%, 0%, 0.41180000000000017)" }, { "id": "2", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(219, 86%, 84%, 1)", "strongContrastColor": "hsla(219, 86%, 31%, 1)", "weakValue": "hsla(219, 86%, 94%, 1)", "weakContrastColor": "hsla(219, 0%, 0%, 0.41180000000000017)" }, { "id": "3", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(263, 86%, 84%, 1)", "strongContrastColor": "hsla(263, 86%, 31%, 1)", "weakValue": "hsla(263, 86%, 94%, 1)", "weakContrastColor": "hsla(263, 0%, 0%, 0.41180000000000017)" }, { "id": "4", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(307, 86%, 84%, 1)", "strongContrastColor": "hsla(307, 86%, 31%, 1)", "weakValue": "hsla(307, 86%, 94%, 1)", "weakContrastColor": "hsla(307, 0%, 0%, 0.41180000000000017)" }, { "id": "5", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(131, 86%, 35%, 1)", "strongContrastColor": "hsla(131, 86%, 81%, 1)", "weakValue": "hsla(131, 86%, 74%, 1)", "weakContrastColor": "hsla(131, 0%, 0%, 0.41180000000000017)" }, { "id": "6", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(175, 86%, 35%, 1)", "strongContrastColor": "hsla(175, 86%, 81%, 1)", "weakValue": "hsla(175, 86%, 74%, 1)", "weakContrastColor": "hsla(175, 0%, 0%, 0.41180000000000017)" }, { "id": "7", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(219, 86%, 35%, 1)", "strongContrastColor": "hsla(219, 86%, 81%, 1)", "weakValue": "hsla(219, 86%, 74%, 1)", "weakContrastColor": "hsla(219, 0%, 0%, 0.41180000000000017)" }, { "id": "8", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(263, 86%, 35%, 1)", "strongContrastColor": "hsla(263, 86%, 81%, 1)", "weakValue": "hsla(263, 86%, 74%, 1)", "weakContrastColor": "hsla(263, 0%, 0%, 0.41180000000000017)" }, { "id": "9", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(307, 86%, 35%, 1)", "strongContrastColor": "hsla(307, 86%, 81%, 1)", "weakValue": "hsla(307, 86%, 74%, 1)", "weakContrastColor": "hsla(307, 0%, 0%, 0.41180000000000017)" }], "columns": 5, "defaultIndex": 0 };
// const generalPaletteManualCorrections: ColorPaletteCorrection[] = [
//     { id: "green_light", label: "Green", strongOutline: false, weakOutline: true },
//     { id: "teal_light", label: "light teal", strongOutline: false, weakOutline: true },
//     { id: "blue_light", label: "light blue", strongOutline: false, weakOutline: true },
//     { id: "purple_light", label: "light purple", strongOutline: false, weakOutline: true },
//     { id: "pink_light", label: "light pink", strongOutline: false, weakOutline: true },

//     { id: "green", label: "green", strongOutline: false, weakOutline: false },
//     { id: "teal", label: "teal", strongOutline: false, weakOutline: false },
//     { id: "blue", label: "blue", strongOutline: false, weakOutline: false },
//     { id: "purple", label: "purple", strongOutline: false, weakOutline: false },
//     { id: "pink", label: "pink", strongOutline: false, weakOutline: false },
// ];

// // 5x1
// const grayscalePaletteGenParams = { "strong": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0.435, "type": "fixed", "linkMix01": 0 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.045, "type": "fixed", "linkMix01": 0 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.115, "type": "distXInv", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0 } }, "strongContrast": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 0.536, "inpOffset01": 0.11699999999999999, "offset01": 0.376, "type": "stepX", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0 } }, "weak": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.5, "type": "fixed", "linkMix01": 1 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": -0.209, "type": "fixed", "linkMix01": 1 } }, "weakContrast": { "hue": { "linkage": "strongContrast", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.5, "type": "fixed", "linkMix01": 1 }, "alpha": { "linkage": "strongContrast", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": -0.084, "type": "fixed", "linkMix01": 0.5997 } }, "entryCount": 5, "columnCount": 5 };
//const grayscalePaletteArgs = { "entries": [{ "id": "0", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(157, 5%, 100%, 1)", "strongContrastColor": "hsla(157, 5%, 38%, 1)", "weakValue": "hsla(157, 5%, 100%, 1)", "weakContrastColor": "hsla(157, 5%, 38%, 0.5660748000000001)" }, { "id": "1", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(157, 5%, 87%, 1)", "strongContrastColor": "hsla(157, 5%, 38%, 1)", "weakValue": "hsla(157, 5%, 87%, 1)", "weakContrastColor": "hsla(157, 5%, 38%, 0.5660748000000001)" }, { "id": "2", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(157, 5%, 62%, 1)", "strongContrastColor": "hsla(157, 5%, 91%, 1)", "weakValue": "hsla(157, 5%, 62%, 1)", "weakContrastColor": "hsla(157, 5%, 91%, 0.5660748000000001)" }, { "id": "3", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(157, 5%, 37%, 1)", "strongContrastColor": "hsla(157, 5%, 91%, 1)", "weakValue": "hsla(157, 5%, 37%, 1)", "weakContrastColor": "hsla(157, 5%, 91%, 0.5660748000000001)" }, { "id": "4", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(157, 5%, 12%, 1)", "strongContrastColor": "hsla(157, 5%, 91%, 1)", "weakValue": "hsla(157, 5%, 12%, 1)", "weakContrastColor": "hsla(157, 5%, 91%, 0.5660748000000001)" }], "columns": 5, "defaultIndex": 0 };
// const grayscalePaletteManualCorrections: ColorPaletteCorrection[] = [
//     { id: "white", label: "white", strongOutline: true, weakOutline: true },
//     { id: "lightGray", label: "lightGray", strongOutline: true, weakOutline: true },
//     { id: "gray", label: "gray", strongOutline: true, weakOutline: true },
//     { id: "darkGray", label: "darkGray", strongOutline: true, weakOutline: true },
//     { id: "black", label: "black", strongOutline: true, weakOutline: true },
// ];

// // 4x1
// const attendanceResponsePaletteGenParams = { "strong": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 0.297, "inpOffset01": 0, "offset01": -0.011000000000000001, "type": "distX", "linkMix01": 0 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.86, "type": "fixed", "linkMix01": 0 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0.022000000000000002, "offset01": 0.6829999999999999, "type": "fixed", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 0 } }, "strongContrast": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 0.695, "inpOffset01": 0, "offset01": 1, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": -1, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0.06, "offset01": 0.235, "type": "fixed", "linkMix01": 0 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": 1, "type": "fixed", "linkMix01": 1 } }, "weak": { "hue": { "linkage": "strong", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.07400000000000001, "type": "fixed", "linkMix01": 0.6434000000000001 }, "lum": { "linkage": "strong", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": 0.924, "type": "fixed", "linkMix01": 0.3779 }, "alpha": { "linkage": "strong", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0.102, "offset01": -1, "type": "fixed", "linkMix01": 1 } }, "weakContrast": { "hue": { "linkage": "strongContrast", "realMin": 0, "realMax": 360, "range01": 1, "inpOffset01": 0, "offset01": 0, "type": "distX", "linkMix01": 1 }, "sat": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": 0, "offset01": -0.084, "type": "fixed", "linkMix01": 1 }, "lum": { "linkage": "strongContrast", "realMin": 0, "realMax": 100, "range01": 1, "inpOffset01": -0.8, "offset01": 0.306, "type": "fixed", "linkMix01": 0 }, "alpha": { "linkage": "strongContrast", "realMin": 0, "realMax": 1, "range01": 1, "inpOffset01": 0, "offset01": -0.332, "type": "fixed", "linkMix01": 0.9183 } }, "entryCount": 4, "columnCount": 4 };
//const attendanceResponsePaletteArgs = { "entries": [{ "id": "0", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(-4, 86%, 68%, 1)", "strongContrastColor": "hsla(-4, 86%, 24%, 1)", "weakValue": "hsla(-4, 58%, 83%, 1)", "weakContrastColor": "hsla(-4, 86%, 31%, 0.8911756)" }, { "id": "1", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(32, 86%, 68%, 1)", "strongContrastColor": "hsla(32, 86%, 24%, 1)", "weakValue": "hsla(32, 58%, 83%, 1)", "weakContrastColor": "hsla(32, 86%, 31%, 0.8911756)" }, { "id": "2", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(67, 86%, 68%, 1)", "strongContrastColor": "hsla(67, 86%, 24%, 1)", "weakValue": "hsla(67, 58%, 83%, 1)", "weakContrastColor": "hsla(67, 86%, 31%, 0.8911756)" }, { "id": "3", "label": "sample", "strongOutline": false, "weakOutline": false, "strongValue": "hsla(103, 86%, 68%, 1)", "strongContrastColor": "hsla(103, 86%, 24%, 1)", "weakValue": "hsla(103, 58%, 83%, 1)", "weakContrastColor": "hsla(103, 86%, 31%, 0.8911756)" }], "columns": 4, "defaultIndex": 0 };
// const attendancePaletteManualCorrections: ColorPaletteCorrection[] = [
//     { id: "no", strongOutline: false, weakOutline: true },
//     { id: "no_maybe", strongOutline: false, weakOutline: true },
//     { id: "yes_maybe", strongOutline: false, weakOutline: true },
//     { id: "yes", strongOutline: false, weakOutline: true },
// ];

// export const gGeneralPaletteList = new ColorPaletteList([
//     new ColorPalette({ ...grayscalePaletteArgs, corrections: grayscalePaletteManualCorrections }),
//     new ColorPalette({ ...attendanceResponsePaletteArgs, corrections: attendancePaletteManualCorrections }),
//     new ColorPalette({ ...generalPaletteArgs, corrections: generalPaletteManualCorrections }),
// ]);


const generalPaletteArgs: ColorPaletteArgs = {
    name: "General",
    columns: 5,
    defaultIndex: 0,
    entries: [
        FetchColorPaletteEntry("black"),
        FetchColorPaletteEntry("dark_gray"),
        FetchColorPaletteEntry("gray"),
        FetchColorPaletteEntry("light_gray"),
        FetchColorPaletteEntry("white"),

        FetchColorPaletteEntry("pink"),
        FetchColorPaletteEntry("red"),
        FetchColorPaletteEntry("maroon"),
        FetchColorPaletteEntry("brown"),
        FetchColorPaletteEntry("orange"),
        FetchColorPaletteEntry("yellow"), // more like yellow-ochre / one-ball yellow
        FetchColorPaletteEntry("light_yellow"),
        FetchColorPaletteEntry("lime_green"), // yellow-green
        FetchColorPaletteEntry("green"), // foresty
        FetchColorPaletteEntry("teal"), // blue-green
        FetchColorPaletteEntry("blue"),
        FetchColorPaletteEntry("purple"), // blue-red
    ]
};

// const attendanceResponsePaletteArgs: ColorPaletteArgs = {
//     name: "Attendance Responses",
//     columns: 1,
//     defaultIndex: 0,
//     entries: [
//         FetchColorPaletteEntry("no"),
//         FetchColorPaletteEntry("no_maybe"),
//         FetchColorPaletteEntry("yes_maybe"),
//         FetchColorPaletteEntry("yes"),
//     ]
// };

export const gGeneralPaletteList = new ColorPaletteList([
    //new ColorPalette({ ...grayscalePaletteArgs, corrections: grayscalePaletteManualCorrections }),
    //new ColorPalette({ ...attendanceResponsePaletteArgs }),

    // theme colors
    // special colors (like unspecified visibility)

    new ColorPalette({ ...generalPaletteArgs }),
]);

export const gPrivateVisibilityColorId = "pink";
