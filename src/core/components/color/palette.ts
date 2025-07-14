// 

// something to consider:
// https://ageofempires.fandom.com/wiki/Player#Age_of_Empires_II
// https://starcraft.fandom.com/wiki/Colors

import { getNextSequenceId } from "@/shared/utils";

export interface ColorPaletteEntryVariation {
    backgroundColor: string;
    foregroundColor: string;
    showBorder: boolean;
};

// NB: serializable
export interface ColorPaletteEntry {
    id: string; // used for database match; hand-made. palettegen generates them though.
    label: string;
    contrastColorOnWhite: string;
    contrastColorOnBlack: string;
    strongDisabled: ColorPaletteEntryVariation;
    strongDisabledSelected: ColorPaletteEntryVariation;
    strong: ColorPaletteEntryVariation;
    strongSelected: ColorPaletteEntryVariation;
    weakDisabled: ColorPaletteEntryVariation;
    weakDisabledSelected: ColorPaletteEntryVariation;
    weak: ColorPaletteEntryVariation;
    weakSelected: ColorPaletteEntryVariation;
};

// strong = rich color, full strength. for lots of page info, it should not be used much, even though this is the default. it's emphasized.
// weak = rich color, but in the background. the idea is to continue looking strongly like a chip
// hollow
export type ColorVariationOptions = "strong" | "weak";
export type ColorFillOption = "filled" | "hollow";

export interface ColorVariationSpec {
    variation: ColorVariationOptions;
    // functionally enabled/disabled.
    // enabled = colored, disabled = grayscale.
    enabled: boolean;

    // selected does not need to be a big contrast; it's used mainly for styling. weak chips can become a bit stronger.
    selected: boolean;

    fillOption: ColorFillOption;
}

export const gStrongDisabled: ColorVariationSpec = { variation: "strong", enabled: false, selected: false, fillOption: "filled" };
export const gStrongDisabledSelected: ColorVariationSpec = { variation: "strong", enabled: false, selected: true, fillOption: "filled" };
export const gStrong: ColorVariationSpec = { variation: "strong", enabled: true, selected: false, fillOption: "filled" };
export const gStrongSelected: ColorVariationSpec = { variation: "strong", enabled: true, selected: true, fillOption: "filled" };
export const gWeakDisabled: ColorVariationSpec = { variation: "weak", enabled: false, selected: false, fillOption: "filled" };
export const gWeakDisabledSelected: ColorVariationSpec = { variation: "weak", enabled: false, selected: true, fillOption: "filled" };
export const gWeak: ColorVariationSpec = { variation: "weak", enabled: true, selected: false, fillOption: "filled" };
export const gWeakSelected: ColorVariationSpec = { variation: "weak", enabled: true, selected: true, fillOption: "filled" };


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

export interface GetColorPaletteEntryWithVariationArgs extends ColorVariationSpec {
    color: ColorPaletteEntry;
}

export const GetColorPaletteEntryWithVariationBase = (args: GetColorPaletteEntryWithVariationArgs): ColorPaletteEntryVariation => {
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

export const GetColorPaletteEntryWithVariation = (args: GetColorPaletteEntryWithVariationArgs): ColorPaletteEntryVariation => {
    // start with getting the fundamental.
    const ret = { ...GetColorPaletteEntryWithVariationBase(args) };

    if (args.fillOption === "hollow") {
        ret.backgroundColor = "white";
        ret.foregroundColor = args.color.contrastColorOnWhite;
    }

    return ret;
};

const CreatePaletteEntry = (id: string,
    label: string,

    contrastColorOnBlack: string,
    contrastColorOnWhite: string,

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
        contrastColorOnBlack,
        contrastColorOnWhite,
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
        backgroundColor,
        foregroundColor,

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
    CreatePaletteEntry("black", "black", "#aaaaaa", "#000000", "#666666", "#aaaaaa", false, "#666666", "#aaaaaa", false, "#000000", "#b3b5c9", true, "#000000", "#d8d9e4", true, "#666666", "#aaaaaa", false, "#666666", "#aaaaaa", false, "#6a7095", "#8e92af", false, "#6a7095", "#eeeeee", false),
    CreatePaletteEntry("dark_gray", "dark_gray", "#cccccc", "#000000", "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#474a61", "#d8d9e4", false, "#444444", "#d7dbff", false, "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#8e92af", "#b3b5c9", false, "#8e92af", "#eeeeee", false),
    CreatePaletteEntry("gray", "gray", "#dddddd", "#000000", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#ffffff", false, "#8e92af", "#ffffff", false, "#8e92af", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#ffffff", false, "#b3b5c9", "#d8d9e4", false, "#b3b5c9", "#ffffff", false),
    CreatePaletteEntry("light_gray", "light_gray", "#eeeeee", "#444444", "#cccccc", "#aaaaaa", false, "#cccccc", "#666666", false, "#b3b5c9", "#474a61", false, "#b3b5c9", "#474a61", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#666666", false, "#b3b5c9", "#6a7095", false, "#b3b5c9", "#474a61", false),
    CreatePaletteEntry("lighter_gray", "lighter_gray", "#eeeeee", "#444444", "#eeeeee", "#cccccc", false, "#eeeeee", "#cccccc", false, "#ececf1", "#6a7095", false, "#ececf1", "#6a7095", false, "#eeeeee", "#cccccc", false, "#eeeeee", "#cccccc", false, "#ececf1", "#6a7095", false, "#ececf1", "#6a7095", false),
    CreatePaletteEntry("white", "white", "#ffffff", "#000000", "#eeeeee", "#aaaaaa", false, "#eeeeee", "#666666", false, "#ffffff", "#474a61", true, "#ffffff", "#474a61", true, "#eeeeee", "#aaaaaa", false, "#eeeeee", "#666666", false, "#d8d9e4", "#6a7095", false, "#d8d9e4", "#000000", false),
    CreatePaletteEntry("pink", "pink", "#ffddc4", "#ffaaaa", "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#ffaaaa", "#eeeeee", false, "#ffaaaa", "#ffffff", false, "#cccccc", "#eeeeee", false, "#cccccc", "#ffffff", false, "#ffdddd", "#ffaaaa", false, "#ffdddd", "#e00000", false),
    CreatePaletteEntry("red", "red", "#e00000", "#e00000", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#e00000", "#ffdddd", false, "#e00000", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#ffaaaa", "#ffdddd", false, "#ffaaaa", "#ffffff", false),
    CreatePaletteEntry("maroon", "maroon", "#cc3361", "#962b49", "#888888", "#aaaaaa", false, "#888888", "#ffffff", false, "#962b49", "#f9cfd5", false, "#962b49", "#ffffff", false, "#888888", "#aaaaaa", false, "#888888", "#ffffff", false, "#ee9fac", "#f9cfd5", false, "#ee9fac", "#ffffff", false),
    CreatePaletteEntry("brown", "brown", "#cea772", "#886635", "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#886635", "#f1e1cf", false, "#886635", "#ffffff", false, "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#cea772", "#f1e1cf", false, "#cea772", "#ffffff", false),
    CreatePaletteEntry("orange", "orange", "#ff7700", "#ff7700", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#ff7700", "#ffddc4", false, "#ff7700", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#ffbc8a", "#ffddc4", false, "#ffbc8a", "#ffffff", false),
    CreatePaletteEntry("gold", "gold", "#ffcc00", "#ba9415", "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#ffcc00", "#786117", false, "#ffcc00", "#000000", false, "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#ffe596", "#ffcc00", false, "#ffe596", "#000000", false),
    CreatePaletteEntry("citron", "citron", "#eeff00", "#adb918", "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#eeff00", "#71771b", false, "#eeff00", "#000000", false, "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#fdff9d", "#cccccc", false, "#fdff9d", "#000000", false),
    CreatePaletteEntry("olive", "olive", "#8fb300", "#8fb300", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#8fb300", "#e6ecc7", false, "#8fb300", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#ccd98f", "#afc657", false, "#ccd98f", "#000000", false),
    CreatePaletteEntry("green", "green", "#69c755", "#00b300", "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#00b300", "#d0edc6", false, "#00b300", "#ffffff", false, "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#a0db8e", "#d0edc6", false, "#a0db8e", "#ffffff", false),
    CreatePaletteEntry("teal", "teal", "#68c7b5", "#198374", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#ffffff", false, "#00b39e", "#cfede6", false, "#00b39e", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#ffffff", false, "#9edacd", "#cfede6", false, "#9edacd", "#ffffff", false),
    CreatePaletteEntry("blue", "blue", "#7696ff", "#0077ff", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#0077ff", "#d7dbff", false, "#0077ff", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#abb8ff", "#d7dbff", false, "#abb8ff", "#ffffff", false),
    CreatePaletteEntry("purple", "purple", "#b865e7", "#9922dd", "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#9922dd", "#eaccf8", false, "#9922dd", "#ffffff", false, "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#d399f0", "#eaccf8", false, "#d399f0", "#ffffff", false),
    CreatePaletteEntry("light_pink", "light_pink", "#ffaaaa", "#ff7777", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#ffdddd", "#e00000", false, "#ffdddd", "#e00000", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#ffdddd", "#ffaaaa", false, "#ffdddd", "#ff7777", false),
    CreatePaletteEntry("light_red", "light_red", "#ff7777", "#ff7777", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#ffdddd", "#e00000", false, "#ffdddd", "#e00000", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#ffdddd", "#ffaaaa", false, "#ffdddd", "#e00000", false),
    CreatePaletteEntry("light_maroon", "light_maroon", "#df6e86", "#cc3361", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#f9cfd5", "#cc3361", false, "#f9cfd5", "#cc3361", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#f9cfd5", "#ee9fac", false, "#f9cfd5", "#cc3361", false),
    CreatePaletteEntry("light_brown", "light_brown", "#cea772", "#cea772", "#dddddd", "#aaaaaa", false, "#dddddd", "#aaaaaa", false, "#f1e1cf", "#ba8b45", false, "#f1e1cf", "#ba8b45", false, "#dddddd", "#aaaaaa", false, "#dddddd", "#aaaaaa", false, "#f1e1cf", "#e1c3a0", false, "#f1e1cf", "#ba8b45", false),
    CreatePaletteEntry("light_orange", "light_orange", "#ff9a51", "#ff9a51", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#ffddc4", "#ff7700", false, "#ffddc4", "#ff7700", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#ffddc4", "#ffbc8a", false, "#ffddc4", "#ff7700", false),
    CreatePaletteEntry("light_gold", "light_gold", "#ffcc00", "#ffcc00", "#eeeeee", "#aaaaaa", false, "#eeeeee", "#aaaaaa", false, "#fff2cb", "#786117", false, "#fff2cb", "#786117", false, "#eeeeee", "#aaaaaa", false, "#eeeeee", "#aaaaaa", false, "#fff2cb", "#ffd85f", false, "#fff2cb", "#786117", false),
    CreatePaletteEntry("light_citron", "light_citron", "#eeff00", "#adb918", "#eeeeee", "#aaaaaa", false, "#eeeeee", "#aaaaaa", false, "#fdff9d", "#71771b", false, "#fdff9d", "#71771b", false, "#eeeeee", "#aaaaaa", false, "#eeeeee", "#aaaaaa", false, "#fdff9d", "#cccccc", false, "#fdff9d", "#71771b", false),
    CreatePaletteEntry("light_olive", "light_olive", "#ccd98f", "#afc657", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#e6ecc7", "#6a8311", false, "#e6ecc7", "#6a8311", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#e6ecc7", "#ccd98f", false, "#e6ecc7", "#6a8311", false),
    CreatePaletteEntry("light_green", "light_green", "#a0db8e", "#69c755", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#d0edc6", "#198310", false, "#d0edc6", "#198310", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#d0edc6", "#a0db8e", false, "#d0edc6", "#198310", false),
    CreatePaletteEntry("light_teal", "light_teal", "#9edacd", "#68c7b5", "#dddddd", "#aaaaaa", false, "#dddddd", "#aaaaaa", false, "#cfede6", "#198374", false, "#cfede6", "#198374", false, "#dddddd", "#aaaaaa", false, "#dddddd", "#aaaaaa", false, "#cfede6", "#9edacd", false, "#cfede6", "#198374", false),
    CreatePaletteEntry("light_blue", "light_blue", "#abb8ff", "#7696ff", "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#d7dbff", "#0077ff", false, "#d7dbff", "#0077ff", false, "#cccccc", "#aaaaaa", false, "#cccccc", "#aaaaaa", false, "#d7dbff", "#abb8ff", false, "#d7dbff", "#0077ff", false),
    CreatePaletteEntry("light_purple", "light_purple", "#eaccf8", "#d399f0", "#dddddd", "#aaaaaa", false, "#dddddd", "#aaaaaa", false, "#eaccf8", "#b865e7", false, "#eaccf8", "#b865e7", false, "#dddddd", "#aaaaaa", false, "#dddddd", "#aaaaaa", false, "#eaccf8", "#d399f0", false, "#eaccf8", "#b865e7", false),
    CreatePaletteEntry("null", "null", "#ffffff", "#000000", "#eeeeee", "#aaaaaa", false, "#eeeeee", "#666666", false, "#ffffff", "#474a61", true, "#ffffff", "#474a61", true, "#eeeeee", "#aaaaaa", false, "#eeeeee", "#666666", false, "#d8d9e4", "#6a7095", false, "#d8d9e4", "#000000", false),
    CreatePaletteEntry("private_visibility", "private_visibility", "#cc3361", "#962b49", "#888888", "#aaaaaa", false, "#888888", "#ffffff", false, "#962b49", "#f9cfd5", false, "#962b49", "#ffffff", false, "#888888", "#aaaaaa", false, "#888888", "#ffffff", false, "#ee9fac", "#f9cfd5", false, "#ee9fac", "#ffffff", false),
    CreatePaletteEntry("x1", "x1", "#ffffff", "#000000", "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true),
    CreatePaletteEntry("x2", "x2", "#ffffff", "#000000", "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true, "#eeeeee", "#888888", true),
    CreatePaletteEntry("attendance_no", "attendance_no", "#e00000", "#e00000", "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#e00000", "#ffddc4", false, "#e00000", "#ffffff", false, "#aaaaaa", "#cccccc", false, "#aaaaaa", "#eeeeee", false, "#ffaaaa", "#ffddc4", false, "#ffaaaa", "#ffffff", false),
    CreatePaletteEntry("attendance_no_maybe", "attendance_no_maybe", "#ffcc00", "#ba9415", "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#ffcc00", "#786117", false, "#ffcc00", "#000000", false, "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#ffe596", "#ffcc00", false, "#ffe596", "#000000", false),
    CreatePaletteEntry("attendance_yes_maybe", "attendance_yes_maybe", "#eeff00", "#adb918", "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#eeff00", "#71771b", false, "#eeff00", "#000000", false, "#cccccc", "#dddddd", false, "#cccccc", "#ffffff", false, "#fdff9d", "#cccccc", false, "#fdff9d", "#000000", false),
    CreatePaletteEntry("attendance_yes", "attendance_yes", "#69c755", "#00b300", "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#00b300", "#d0edc6", false, "#00b300", "#ffffff", false, "#888888", "#aaaaaa", false, "#888888", "#eeeeee", false, "#a0db8e", "#d0edc6", false, "#a0db8e", "#ffffff", false),



];

export const CreateNullPaletteEntry = () => {
    const f = gPaletteMap.find(e => e.id === "null");
    if (f) {
        return { ...f };
    }

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


export class ColorPaletteArgs {
    name: string;
    entries: ColorPaletteEntry[];
    columns: number;
    defaultIndex: number;
};

export class ColorPalette extends ColorPaletteArgs {

    constructor(args: ColorPaletteArgs) {
        super();
        Object.assign(this, args);
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

    findEntry(id: string | null | ColorPaletteEntry): ColorPaletteEntry | null {
        if (id == null) return null;
        if (typeof id === 'object') {
            if (id.id) {
                id = id.id; // assuming ColorPaletteEntry; search again.
            }
        }
        for (let i = 0; i < this.palettes.length; ++i) {
            const found = this.palettes[i]?.findEntry(id as string);
            if (found) return found;
        }
        return null;
    }

    getTotalEntryCount(): number {
        return this.palettes.reduce((sum, palette) => sum + palette.entries.length, 0);
    }

    getOrdinalEntry(i: number): ColorPaletteEntry {
        const totalEntries = this.getTotalEntryCount();

        // Wrap the index within the range of total entries
        const wrappedIndex = i % totalEntries;
        const adjustedIndex = wrappedIndex < 0 ? wrappedIndex + totalEntries : wrappedIndex;

        let currentIndex = 0;

        for (const palette of this.palettes) {
            for (const entry of palette.entries) {
                if (currentIndex === adjustedIndex) {
                    return entry;
                }
                currentIndex++;
            }
        }

        throw new Error('Index out of range, which should be impossible');
    }
};


export const gSwatchColors = {
    "black": "black",
    "dark_gray": "dark_gray",
    "gray": "gray",
    "light_gray": "light_gray",
    "lighter_gray": "lighter_gray",
    "white": "white",

    "pink": "pink",
    "red": "red",
    "maroon": "maroon",
    "brown": "brown",
    "orange": "orange",
    "gold": "gold",
    "citron": "citron",
    "olive": "olive",
    "green": "green",
    "teal": "teal",
    "blue": "blue",
    "purple": "purple",
} as const;

const swatchPaletteArgs: ColorPaletteArgs = {
    name: "Swatches",
    columns: 6,
    defaultIndex: 0,
    entries: Object.keys(gSwatchColors).map(k => FetchColorPaletteEntry(k)),
};

export const gLightSwatchColors = {
    "light_pink": "light_pink",
    "light_red": "light_red",
    "light_maroon": "light_maroon",
    "light_brown": "light_brown",
    "light_orange": "light_orange",
    "light_gold": "light_gold",
    "light_citron": "light_citron",
    "light_olive": "light_olive",
    "light_green": "light_green",
    "light_teal": "light_teal",
    "light_blue": "light_blue",
    "light_purple": "light_purple",
} as const;

const liteSwatchPaletteArgs: ColorPaletteArgs = {
    name: "Light Swatches",
    columns: 6,
    defaultIndex: 0,
    entries: Object.keys(gLightSwatchColors).map(k => FetchColorPaletteEntry(k)),
};

export const gAppColors = {
    "null": "null",
    "private_visibility": "private_visibility",
    "x1": "x1",
    "x2": "x2",
    "attendance_no": "attendance_no",
    "attendance_no_maybe": "attendance_no_maybe",
    "attendance_yes_maybe": "attendance_yes_maybe",
    "attendance_yes": "attendance_yes",
} as const;

export const gHiddenColorIds = {
    "null": "null",
    "x1": "x1",
    "x2": "x2",
} as const;

const appPaletteArgs: ColorPaletteArgs = {
    name: "Application",
    columns: 4,
    defaultIndex: 0,
    entries: Object.keys(gAppColors).map(k => FetchColorPaletteEntry(k)),
};

export const gGeneralPaletteList = new ColorPaletteList([
    new ColorPalette({ ...swatchPaletteArgs }),
    new ColorPalette({ ...liteSwatchPaletteArgs }),
    new ColorPalette({ ...appPaletteArgs }),
]);
