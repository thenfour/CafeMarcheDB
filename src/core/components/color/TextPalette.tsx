
import parse from 'parse-css-color';
import * as libcolor from "./libcolor";

import { hslToCssString, rgbToCssString } from './ColorEditorBaseUtils';
import { type ColorBlenderParamsBundle, ParseParamBundle } from './ColorBlender';

const gDarkSelectedBorderColor = "#444";
const gLightSelectedBorderColor = "#ccc";

// in general we're ignoring alpha
const ParseResultToString = (r: parse.Result) => {
    if (r.type === "rgb") {
        // values are [r0-255, g0-255, b0-255], alpha 0-1.0
        return rgbToCssString(r.values[0]!, r.values[1]!, r.values[2]!, r.alpha);
    }
    if (r.type === "hsl") {
        return hslToCssString(r.values[0]!, r.values[1]!, r.values[2]!, r.alpha);
    }
    return "! invalid";
};


// NB: must be serializable
interface ParseColorResult {
    type: "linesep" | "color" | "invalid";
    cssColor: string | null;
    cssContrastColor: string | null;
    parseResult: parse.Result | null;
    alpha01: number;
    comment: string | null;
    rgbValues: [number, number, number]; // 0-255
    hslValues: [number, number, number]; // 0-360deg, 0-100p, 0-100p
    labValues: [number, number, number]; // 0-100p, 0-100p, -100-100p
    cmykValues: [number, number, number, number]; // 0-1 all
};

function separateCppComment(line: string): { text: string, comment: string | null } {
    if (line.startsWith("//")) { // the text capture won't work when it's 0-length. check for that scenario specifically.
        return { text: "", comment: line.substring(2) };
    }
    const regex = /^(.*?)\/\/(.*)$/;
    const match = line.match(regex);
    if (match && match[1] && match[2]) {
        return { text: match[1].trim(), comment: match[2].trim() };
    }
    // If no comment is found, return the original line and null for the comment
    return { text: line.trim(), comment: null };
}


// lines may have C++ style comments (// like this)
// whitespace is trimmed.
// lines beginning with `-` are considered line breaks
// CSS RGB and HSL colors are parsed
// anything else is ignored.
export const ParseColor = (line: string): ParseColorResult => {
    const ret: ParseColorResult = {
        type: "invalid",
        parseResult: null,
        alpha01: 1,
        comment: null,
        cssColor: "#000",
        cssContrastColor: "#fff",
        rgbValues: [0, 0, 0],
        hslValues: [0, 0, 0],
        labValues: [0, 0, 0],
        cmykValues: [0, 0, 0, 0],
    };

    // remove trailing comments
    //line = line.replace(/\/\/(.*)$/, '').trim();
    const cp = separateCppComment(line);
    line = cp.text;
    ret.comment = cp.comment;

    if (/^([0-9A-Fa-f]{6})$/.test(line)) {
        // RRGGBB color. just convert to a parseable format and continue to parse.
        line = `#${line}`;
    }
    if (/^([0-9A-Fa-f]{8})$/.test(line)) {
        // RRGGBBAA color. just convert to a parseable format and continue to parse.
        line = `#${line}`;
    }
    if (/^([0-9A-Fa-f]{3})$/.test(line)) {
        // RGB color. just convert to a parseable format and continue to parse.
        line = `#${line}`;
    }
    if (/^([0-9A-Fa-f]{4})$/.test(line)) {
        // RGBA color. just convert to a parseable format and continue to parse.
        line = `#${line}`;
    }
    if (/^-/.test(line)) {
        return { ...ret, type: "linesep" };
    }
    const p: parse.Result | null = parse(line);
    if (p) {
        const values = p.values as [number, number, number];
        // convert the parsed result to a CSS-compat color
        if (p.type === "rgb") {
            const hsl01 = libcolor.rgbToHsl(values[0], values[1], values[2]);
            return {
                ...ret,
                type: "color",
                cssColor: ParseResultToString(p),
                cssContrastColor: hsl01[2] > 0.4 ? gDarkSelectedBorderColor : gLightSelectedBorderColor,
                alpha01: p.alpha,
                parseResult: p,
                rgbValues: [...values],
                hslValues: [hsl01[0] * 360, hsl01[1] * 100, hsl01[2] * 100],
                cmykValues: libcolor.rgbToCmyk(values[0], values[1], values[2]),
                labValues: libcolor.rgbToLab(values),
            };
        }
        if (p.type === "hsl") {
            const rgb = libcolor.hslToRgb(values[0] / 360, values[1] / 100, values[2] / 100);
            return {
                ...ret,
                type: "color",
                cssColor: ParseResultToString(p),
                cssContrastColor: values[2] > 40 ? gDarkSelectedBorderColor : gLightSelectedBorderColor,
                alpha01: p.alpha,
                parseResult: p,
                rgbValues: [...rgb],
                hslValues: [...values],
                cmykValues: libcolor.rgbToCmyk(rgb[0], rgb[1], rgb[2]),
                labValues: libcolor.rgbToLab(rgb),
            };
        }
    }
    return ret;
};

// NB: must be serializable
export interface ParsedPaletteEntry {
    cssColor: string;
    bundle: ColorBlenderParamsBundle | null;
    r: ParseColorResult;
};

export function ParsePaletteEntry(cssColor: string) {
    const eeep = ParseColor(cssColor);
    const eee: ParsedPaletteEntry = {
        bundle: null,
        cssColor: eeep.cssColor || "#f0f",
        r: eeep,
    };
    return eee;
}

export interface ParsedPalette {
    allRows: ParsedPaletteEntry[][];
    allEntries: ParsedPaletteEntry[];
};

export const ParseTextPalette = (textPalette: string): ParsedPalette => {
    //console.log(`---- begin parse -------`);
    const lines = textPalette.split('\n');// split into lines
    const newRows: ParsedPaletteEntry[][] = [];
    const allColors: ParsedPaletteEntry[] = [];
    let row: ParsedPaletteEntry[] = [];
    let currentBundle: ColorBlenderParamsBundle | null = null;

    for (let iLine = 0; iLine < lines.length; ++iLine) {
        const line = lines[iLine]!;
        const r = ParseColor(line);

        // does the line contain a param bundle?
        const thisBundle: ColorBlenderParamsBundle | null = ParseParamBundle(r.comment);

        switch (r.type) {
            case "color":
                const e: ParsedPaletteEntry = {
                    cssColor: r.cssColor!,
                    r,
                    bundle: thisBundle || currentBundle, // favor a comment right on this line; otherwise continue prev
                };
                row.push(e);
                allColors.push(e);
                break;
            case "linesep":
                newRows.push(row);
                currentBundle = null; // generally useful to consider a linebreak as a clear of params
                row = [];
                break;
            case "invalid":
                break;
        }

        // do after processing to account for newline behavior (newline + bundle comment clears the current one, THEN we should replace)
        if (thisBundle) {
            currentBundle = thisBundle;
        }
    }

    if (row.length) newRows.push(row);

    return {
        allRows: newRows,
        allEntries: allColors,
    };
};
