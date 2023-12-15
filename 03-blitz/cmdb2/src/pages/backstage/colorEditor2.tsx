import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import React from "react";
import { API } from "src/core/db3/clientAPI";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { ColorPalette, ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { ColorPaletteGrid, ColorPaletteListComponent, ColorPick, ColorSwatch, ColorVariationOptions, GetStyleVariablesForColor } from "src/core/components/Color";
import { Button, FormControlLabel, Popover } from "@mui/material";
import parse from 'parse-css-color'
import { lerp } from "shared/utils";
import { CMSinglePageSurfaceCard } from "src/core/components/CMCoreComponents";
import { assert } from "blitz";

const gDarkSelectedBorderColor = "#444";
const gLightSelectedBorderColor = "#ccc";

// Function: rgbToCmyk
// Inputs:
//   - r, g, b: Integers representing the Red, Green, and Blue components of an RGB color (in the range 0-255)
// Outputs:
//   - An array containing the CMYK components of the color:
//       - C (Cyan): Value ranging from 0 to 1
//       - M (Magenta): Value ranging from 0 to 1
//       - Y (Yellow): Value ranging from 0 to 1
//       - K (Key/Black): Value ranging from 0 to 1
function rgbToCmyk(r: number, g: number, b: number): [number, number, number, number] {
    // Normalize RGB values
    var R = r / 255;
    var G = g / 255;
    var B = b / 255;

    // Calculate CMY values
    var K = 1 - Math.max(R, G, B);
    var C = (1 - R - K) / (1 - K);
    var M = (1 - G - K) / (1 - K);
    var Y = (1 - B - K) / (1 - K);

    // Ensure CMYK values are within range
    C = isNaN(C) ? 0 : Math.max(0, Math.min(1, C));
    M = isNaN(M) ? 0 : Math.max(0, Math.min(1, M));
    Y = isNaN(Y) ? 0 : Math.max(0, Math.min(1, Y));
    K = isNaN(K) ? 0 : Math.max(0, Math.min(1, K));

    return [C, M, Y, K];
}

// Function: cmykToRgb
// Inputs:
//   - c, m, y, k: Floating point numbers representing the CMYK components of a color (ranging from 0 to 1)
// Outputs:
//   - An array containing the RGB components of the color:
//       - R (Red): Integer ranging from 0 to 255
//       - G (Green): Integer ranging from 0 to 255
//       - B (Blue): Integer ranging from 0 to 255
function cmykToRgb(c: number, m: number, y: number, k: number): [number, number, number] {
    // Calculate RGB values
    var R = 255 * (1 - c) * (1 - k);
    var G = 255 * (1 - m) * (1 - k);
    var B = 255 * (1 - y) * (1 - k);

    // Round RGB values
    R = Math.round(R);
    G = Math.round(G);
    B = Math.round(B);

    return [R, G, B];
}


// https://github.com/antimatter15/rgb-lab/blob/master/color.js
// lab is [0-100, -128-127(approx), -128-127(approx)]
// outputs [0-255 rgb values]
function labToRgb(lab: [number, number, number]): [number, number, number] {
    var y = (lab[0] + 16) / 116,
        x = lab[1] / 500 + y,
        z = y - lab[2] / 200,
        r, g, b;

    x = 0.95047 * ((x * x * x > 0.008856) ? x * x * x : (x - 16 / 116) / 7.787);
    y = 1.00000 * ((y * y * y > 0.008856) ? y * y * y : (y - 16 / 116) / 7.787);
    z = 1.08883 * ((z * z * z > 0.008856) ? z * z * z : (z - 16 / 116) / 7.787);

    r = x * 3.2406 + y * -1.5372 + z * -0.4986;
    g = x * -0.9689 + y * 1.8758 + z * 0.0415;
    b = x * 0.0557 + y * -0.2040 + z * 1.0570;

    r = (r > 0.0031308) ? (1.055 * Math.pow(r, 1 / 2.4) - 0.055) : 12.92 * r;
    g = (g > 0.0031308) ? (1.055 * Math.pow(g, 1 / 2.4) - 0.055) : 12.92 * g;
    b = (b > 0.0031308) ? (1.055 * Math.pow(b, 1 / 2.4) - 0.055) : 12.92 * b;

    return [Math.max(0, Math.min(1, r)) * 255,
    Math.max(0, Math.min(1, g)) * 255,
    Math.max(0, Math.min(1, b)) * 255]
}

// rgb = [0-255 values]
// returns [0 to 100, -128 to 127 (approx), -128 to 127 (approx) ]
function rgbToLab(rgb: [number, number, number]): [number, number, number] {
    var r = rgb[0] / 255,
        g = rgb[1] / 255,
        b = rgb[2] / 255,
        x, y, z;

    r = (r > 0.04045) ? Math.pow((r + 0.055) / 1.055, 2.4) : r / 12.92;
    g = (g > 0.04045) ? Math.pow((g + 0.055) / 1.055, 2.4) : g / 12.92;
    b = (b > 0.04045) ? Math.pow((b + 0.055) / 1.055, 2.4) : b / 12.92;

    x = (r * 0.4124 + g * 0.3576 + b * 0.1805) / 0.95047;
    y = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 1.00000;
    z = (r * 0.0193 + g * 0.1192 + b * 0.9505) / 1.08883;

    x = (x > 0.008856) ? Math.pow(x, 1 / 3) : (7.787 * x) + 16 / 116;
    y = (y > 0.008856) ? Math.pow(y, 1 / 3) : (7.787 * y) + 16 / 116;
    z = (z > 0.008856) ? Math.pow(z, 1 / 3) : (7.787 * z) + 16 / 116;

    return [(116 * y) - 16, 500 * (x - y), 200 * (y - z)]
}

// calculate the perceptual distance between colors in CIELAB
// https://github.com/THEjoezack/ColorMine/blob/master/ColorMine/ColorSpaces/Comparisons/Cie94Comparison.cs

function deltaE(labA, labB) {
    var deltaL = labA[0] - labB[0];
    var deltaA = labA[1] - labB[1];
    var deltaB = labA[2] - labB[2];
    var c1 = Math.sqrt(labA[1] * labA[1] + labA[2] * labA[2]);
    var c2 = Math.sqrt(labB[1] * labB[1] + labB[2] * labB[2]);
    var deltaC = c1 - c2;
    var deltaH = deltaA * deltaA + deltaB * deltaB - deltaC * deltaC;
    deltaH = deltaH < 0 ? 0 : Math.sqrt(deltaH);
    var sc = 1.0 + 0.045 * c1;
    var sh = 1.0 + 0.015 * c1;
    var deltaLKlsl = deltaL / (1.0);
    var deltaCkcsc = deltaC / (sc);
    var deltaHkhsh = deltaH / (sh);
    var i = deltaLKlsl * deltaLKlsl + deltaCkcsc * deltaCkcsc + deltaHkhsh * deltaHkhsh;
    return i < 0 ? 0 : Math.sqrt(i);
}





// https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion
function hueToRgb(p, q, t) {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
}

/**
 * Converts an HSL color value to RGB. Conversion formula
 * adapted from https://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes h, s, and l are contained in the set [0, 1] and
 * returns r, g, and b in the set [0, 255].
 *
 * @param   {number}  h       The hue
 * @param   {number}  s       The saturation
 * @param   {number}  l       The lightness
 * @return  {Array}           The RGB representation - 0-255.
 */
function hslToRgb(h: number, s: number, l: number): [number, number, number] {
    let r, g, b;

    if (s === 0) {
        r = g = b = l; // achromatic
    } else {
        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hueToRgb(p, q, h + 1 / 3);
        g = hueToRgb(p, q, h);
        b = hueToRgb(p, q, h - 1 / 3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}

/**
 * Converts an RGB color value to HSL. Conversion formula
 * adapted from http://en.wikipedia.org/wiki/HSL_color_space.
 * Assumes r, g, and b are contained in the set [0, 255] and
 * returns h, s, and l in the set [0, 1].
 *
 * @param   {number}  r       The red color value
 * @param   {number}  g       The green color value
 * @param   {number}  b       The blue color value
 * @return  {Array}           The HSL representation
 */
function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
    (r /= 255), (g /= 255), (b /= 255);
    const vmax = Math.max(r, g, b), vmin = Math.min(r, g, b);
    let h, s, l = (vmax + vmin) / 2;

    if (vmax === vmin) {
        return [0, 0, l]; // achromatic
    }

    const d = vmax - vmin;
    s = l > 0.5 ? d / (2 - vmax - vmin) : d / (vmax + vmin);
    if (vmax === r) h = (g - b) / d + (g < b ? 6 : 0);
    if (vmax === g) h = (b - r) / d + 2;
    if (vmax === b) h = (r - g) / d + 4;
    h /= 6;

    //console.log(`${rgbToCssString(r * 255, g * 255, b * 255, 1)} = h:${h} s:${s} l:${l}`);

    return [h, s, l];
}

function ff(n: number | undefined) {
    if (n === undefined) return "00";
    return ('0' + Math.floor(n).toString(16)).slice(-2);
}

// r g b are 0-255
const rgbToCssString = (r: number, g: number, b: number, a01: number): string => {
    if (a01 >= 1.0) {
        return `#${ff(Math.round(r))}${ff(Math.round(g))}${ff(Math.round(b))}`;
    }
    return `#${ff(Math.round(r))}${ff(Math.round(g))}${ff(Math.round(b))}${ff(Math.round(a01 * 255))}`;
};

// h = 0-360
// s = 0-100
// l = 0-100
const hslToCssString = (h: number, s: number, l: number, a01: number): string => {
    if (a01 >= 1.0) {
        return `hsl(${Math.round(h)}deg ${Math.round(s)}% ${Math.round(l)}%)`;
    }
    return `hsl(${Math.round(h)}deg ${Math.round(s)}% ${Math.round(l)}% / ${Math.round(a01 * 100)}%)`;
};

// LAB colors in CSS too...
// https://developer.mozilla.org/en-US/docs/Web/CSS/color_value/lab
// lab(29.2345% 39.3825 20.0664);
// lab(52.2345% 40.1645 59.9971);
// lab(52.2345% 40.1645 59.9971 / .5);


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
    const regex = /^(.*?)\s*\/\/\s*(.*)$/;
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
const ParseColor = (line: string): ParseColorResult => {
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
            const hsl01 = rgbToHsl(values[0], values[1], values[2]);
            return {
                ...ret,
                type: "color",
                cssColor: ParseResultToString(p),
                cssContrastColor: hsl01[2] > 0.5 ? gDarkSelectedBorderColor : gLightSelectedBorderColor,
                alpha01: p.alpha,
                parseResult: p,
                rgbValues: [...values],
                hslValues: [hsl01[0] * 360, hsl01[1] * 100, hsl01[2] * 100],
                cmykValues: rgbToCmyk(values[0], values[1], values[2]),
                labValues: rgbToLab(values),
            };
        }
        if (p.type === "hsl") {
            const rgb = hslToRgb(values[0] / 360, values[1] / 100, values[2] / 100);
            return {
                ...ret,
                type: "color",
                cssColor: ParseResultToString(p),
                cssContrastColor: values[2] > 50 ? gDarkSelectedBorderColor : gLightSelectedBorderColor,
                alpha01: p.alpha,
                parseResult: p,
                rgbValues: [...rgb],
                hslValues: [...values],
                cmykValues: rgbToCmyk(rgb[0], rgb[1], rgb[2]),
                labValues: rgbToLab(rgb),
            };
        }
    }
    return ret;
};


interface ColorBlenderParamsBundle {
    c: string[],
    m: string,
    z: number,
    op: string,
};

function ParseParamBundle(x: string | null): ColorBlenderParamsBundle | null {
    if (x == null) return null;
    try {
        const parsedData = JSON.parse(x);

        if (
            Array.isArray(parsedData.c) &&
            parsedData.c.every((color) => typeof color === 'string') &&
            typeof parsedData.m === 'string' &&
            typeof parsedData.z === 'number' &&
            typeof parsedData.op === 'string'
        ) {
            return parsedData;
        } else {
            return null;
        }
    } catch (error) {
        return null;
    }
}

interface ParsedPaletteEntry {
    cssColor: string;
    bundle: ColorBlenderParamsBundle | null;
    r: ParseColorResult;
};

interface ParsedPalette {
    allRows: ParsedPaletteEntry[][];
    allEntries: ParsedPaletteEntry[];
};

const ParseTextPalette = (textPalette: string): ParsedPalette => {
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
                // console.log(`found color; thisBundle || currentBundle:`);
                // console.log(thisBundle);
                // console.log(currentBundle);
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
            // console.log(`setting current bundle to`);
            // console.log(currentBundle);
        }
    }

    // console.log(`---- end parse; result: -------`);
    // console.log(allColors);
    // console.log(`---- end parse -------`);

    if (row.length) newRows.push(row);

    return {
        allRows: newRows,
        allEntries: allColors,
    };
};

const Swatch = (props: { color: string, onClick?: (e: string) => void, text?: string, className?: string, selected?: boolean, selectedBorderColor?: string }) => {
    return <div
        className={`paletteSwatch ${props.onClick && "interactable"} ${props.className || ""} ${props.selected && "selected"}`}
        style={{
            "--swatch-color": props.color,
            "--selected-border-color": props.selectedBorderColor || "black",
        } as any}
        onClick={() => { props.onClick && props.onClick(props.color) }}
    >
        {props.text || props.color}
    </div>;
};

interface UserPaletteGridProps {
    parsedPalette: ParsedPalette;
    onClick?: (e: ParsedPaletteEntry) => void;
    onSetBlenderParamBundle?: (pb: ColorBlenderParamsBundle) => void;
    selectedEntries: string[];
};

const UserPaletteGrid = (props: UserPaletteGridProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [focusedEntry, setFocusedEntry] = React.useState<null | ParsedPaletteEntry>(null);
    const isOpen = !!anchorEl;

    const interactable = !!props.onClick || props.onSetBlenderParamBundle;

    const handleClick = (event: React.MouseEvent<HTMLElement>, entry: ParsedPaletteEntry, ix: number, iy: number) => {
        if (props.onSetBlenderParamBundle) {
            setAnchorEl(event.currentTarget);
            setFocusedEntry(entry);
        }
        if (props.onClick) {
            props.onClick(entry);
        }
    };

    return <div>
        {props.parsedPalette.allEntries.length} colors.
        <div className={`paletteeditor2`}>
            {props.parsedPalette.allRows.map((row, iy) => <div className="paletteRow" key={iy}>
                {row.map((c, ix) => {
                    const localC = { ...c }; // for capture; dont think this is actually necesasary though.
                    return <div key={ix} className="singleSwatchContainer">
                        <div onClick={e => handleClick(e, localC, ix, iy)}>
                            <Swatch key={ix} color={localC.cssColor} className={interactable ? "interactable" : ""} selected={props.selectedEntries.some(e => e === localC.cssColor)} selectedBorderColor={localC.r.cssContrastColor || "black"} />
                        </div>
                        <Popover
                            anchorEl={anchorEl}
                            open={isOpen}
                            onClose={() => setAnchorEl(null)}
                        >
                            {!!focusedEntry && !!focusedEntry.bundle && <button onClick={() => {
                                if (props.onSetBlenderParamBundle) {
                                    props.onSetBlenderParamBundle(focusedEntry.bundle!);
                                }
                                setAnchorEl(null);
                            }}>
                                click to set bundle to <br />
                                {JSON.stringify(focusedEntry.bundle.c)}
                            </button>}
                            {/* here we could show more info about the palette entry */}
                        </Popover>
                    </div>
                })}
            </div>)}
        </div>
    </div>;
};


export interface UserColorPickProps {
    value: string;
    palette: ParsedPalette;
    onChange: (value: ParsedPaletteEntry) => void;
    selectedEntries: string[];
};

// props.color can never be null.
export const UserColorPick = (props: UserColorPickProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const isOpen = Boolean(anchorEl);

    const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };

    return <>
        <div onClick={handleOpen}>
            <Swatch color={props.value} className="interactable" />
        </div>
        <Popover
            anchorEl={anchorEl}
            open={isOpen}
            onClose={() => setAnchorEl(null)}
        >
            <UserPaletteGrid
                parsedPalette={props.palette}
                selectedEntries={props.selectedEntries}
                onClick={(e: ParsedPaletteEntry) => {
                    props.onChange(e);
                    setAnchorEl(null);
                }}
            />
        </Popover >
    </>;
};


const BigSwatch = ({ entry, className, variation, text }: { entry: ColorPaletteEntry, className?: string, variation: ColorVariationOptions, text: string }) => {
    const style = GetStyleVariablesForColor(entry);
    return <div className={`paletteBigSwatch ${className} ${variation}`} style={style}>
        <div className={`embeddedContrastSwatch ${variation}`}></div>
        <div className="embeddedText">{text}</div>
    </div>

};


interface FindClosestColorMatchArgs {
    value: string;
    parsedPalette: ParsedPalette;
};
function FindClosestColorMatch(args: FindClosestColorMatchArgs): ParsedPaletteEntry | null {
    if (args.parsedPalette.allEntries.length < 2) {
        console.log(`palette not big enough.`);
        return null;
    }
    const parsedValue = ParseColor(args.value);
    if (!parsedValue) {
        console.log(`unable to parse color ${args.value}`);
        return null;
    }

    console.log(`here`);

    let bestDistance: number = deltaE(args.parsedPalette.allEntries[0]!.r.labValues, parsedValue.labValues);
    let bestMatch: ParsedPaletteEntry = args.parsedPalette.allEntries[0]!;
    for (let i = 1; i < args.parsedPalette.allEntries.length; ++i) {
        const entry = args.parsedPalette.allEntries[i]!;
        const d = deltaE(entry.r.labValues, parsedValue.labValues);
        if (d < bestDistance) {
            bestDistance = d;
            bestMatch = entry;
        }
    }
    return bestMatch;
}

interface CorrectColorButtonProps {
    label: string;
    value: string;
    parsedPalette: ParsedPalette;
    onChange: (e: ParsedPaletteEntry) => void;
};

const CorrectColorButton = (props: CorrectColorButtonProps) => {
    const f = props.parsedPalette.allEntries.find(e => e.cssColor === props.value);
    if (f) {
        return <div className="correctColorItem correctColorOK">{props.label} ✔</div>;
    }

    const handleClick = () => {
        const m = FindClosestColorMatch({ value: props.value, parsedPalette: props.parsedPalette });
        if (!m) {
            console.error(`something.`);
            return;
        }
        props.onChange(m);
    };

    return <div className="correctColorItem correctColorError"><button onClick={handleClick}>{props.label} ❌ this color is not found</button></div>;
};

interface PaletteEntryEditorProps {
    value: ColorPaletteEntry;
    onChange: (newValue: ColorPaletteEntry) => void;
    parsedPalette: ParsedPalette;
    onClose: () => void;
};

const PaletteEntryEditor = (props: PaletteEntryEditorProps) => {

    const strongSelectedEntries: string[] = [
        props.value.strongValue,
        props.value.strongContrastColor,
    ];

    const weakSelectedEntries: string[] = [
        props.value.weakValue,
        props.value.weakContrastColor,
    ];

    return <div className="PaletteEntryEditor">
        <div style={{ display: "flex" }}>
            editing: {props.value.label}
            <button onClick={props.onClose}>close</button>
        </div>
        <div style={{ display: "flex", flexDirection: "row" }}>
            <div>
                <FormControlLabel label="Strong border?" control={<input type="checkbox" checked={props.value.strongOutline} onChange={(e) => props.onChange({ ...props.value, strongOutline: e.target.checked })} />} />
                <FormControlLabel label="Weak border?" control={<input type="checkbox" checked={props.value.weakOutline} onChange={(e) => props.onChange({ ...props.value, weakOutline: e.target.checked })} />} />
                <div className="paletteRow">
                    <UserColorPick selectedEntries={strongSelectedEntries} value={props.value.strongValue} palette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, strongValue: e.cssColor })} />
                    <UserColorPick selectedEntries={strongSelectedEntries} value={props.value.strongContrastColor} palette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, strongContrastColor: e.cssColor })} />
                </div>
                <div className="paletteRow">
                    <UserColorPick selectedEntries={weakSelectedEntries} value={props.value.weakValue} palette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, weakValue: e.cssColor })} />
                    <UserColorPick selectedEntries={weakSelectedEntries} value={props.value.weakContrastColor} palette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, weakContrastColor: e.cssColor })} />
                </div>
                <div className="manualEntryRow">
                    <div><FormControlLabel label="StrongBG" control={<input className="manualColorEntry" type="text" value={props.value.strongValue} onChange={(e) => props.onChange({ ...props.value, strongValue: e.target.value })} />} /></div>
                    <div><FormControlLabel label="StrongFG" control={<input className="manualColorEntry" type="text" value={props.value.strongContrastColor} onChange={(e) => props.onChange({ ...props.value, strongContrastColor: e.target.value })} />} /></div>
                    <div><FormControlLabel label="WeakBG" control={<input className="manualColorEntry" type="text" value={props.value.weakValue} onChange={(e) => props.onChange({ ...props.value, weakValue: e.target.value })} />} /></div>
                    <div><FormControlLabel label="WeakFG" control={<input className="manualColorEntry" type="text" value={props.value.weakContrastColor} onChange={(e) => props.onChange({ ...props.value, weakContrastColor: e.target.value })} />} /></div>
                </div>
                <div className="correctColorButtonGroup">
                    <CorrectColorButton label="strong" value={props.value.strongValue} parsedPalette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, strongValue: e.cssColor })} />
                    <CorrectColorButton label="strongContrast" value={props.value.strongContrastColor} parsedPalette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, strongContrastColor: e.cssColor })} />
                    <CorrectColorButton label="weak" value={props.value.weakValue} parsedPalette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, weakValue: e.cssColor })} />
                    <CorrectColorButton label="weakContrast" value={props.value.weakContrastColor} parsedPalette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, weakContrastColor: e.cssColor })} />
                </div>
            </div>
            <div>
                <div className="paletteRow">
                    <BigSwatch entry={props.value} className="applyColor-strong-notselected-disabled" variation="strong" text="disabled" />
                    <BigSwatch entry={props.value} className="applyColor-strong-notselected-enabled" variation="strong" text="normal" />
                    <BigSwatch entry={props.value} className="applyColor-strong-selected-enabled" variation="strong" text="selected" />
                    <div>strong</div>
                </div>
                <div className="paletteRow">
                    <BigSwatch entry={props.value} className="applyColor-weak-notselected-disabled" variation="weak" text="disabled" />
                    <BigSwatch entry={props.value} className="applyColor-weak-notselected-enabled" variation="weak" text="normal" />
                    <BigSwatch entry={props.value} className="applyColor-weak-selected-enabled" variation="weak" text="selected" />
                    <div>weak</div>
                </div>
            </div>

        </div>
    </div>;
};

interface ColorBlenderProps {
    handleAppendToTextPalette: (txt: string) => void;
    setParamBundle: ColorBlenderParamsBundle | null;
    setParamBundleSerial: number;
    //clearParamBundleTrigger?: () => void;
};

// color blender
const ColorBlender = (props: ColorBlenderProps) => {
    const [colorA, setColorA] = React.useState<string>("red");
    const [colorB, setColorB] = React.useState<string>("white");
    const [colorC, setColorC] = React.useState<string>("black");
    const [colorD, setColorD] = React.useState<string>("green");
    const [method, setMethod] = React.useState<string>("lab");
    const [linkAD, setLinkAD] = React.useState<boolean>(true);
    const [colorCountX, setColorCountX] = React.useState<number>(4);
    const [subSelectionDesc, setSubSelectionDesc] = React.useState<string>("");
    const [subSelection, setSubSelection] = React.useState<string[]>([]);
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const colorCountY = colorCountX;

    const paramsBundle: ColorBlenderParamsBundle = {
        c: [colorA, colorB, colorC],
        m: method,
        z: colorCountX,
        op: "(not set)",
    };
    if (!linkAD) paramsBundle.c.push(colorD);

    const ra = ParseColor(colorA);
    const rb = ParseColor(colorB);
    const rc = ParseColor(colorC);
    const rd = ParseColor(linkAD ? colorA : colorD);

    // blend via how? hsl? rgb?
    const grid: string[][] = []; // rows / columns
    for (let iy = 0; iy <= (colorCountY + 1); ++iy) {
        const row: string[] = [];
        const ty = iy / (colorCountY + 1);
        for (let ix = 0; ix <= colorCountX + 1; ++ix) {
            const tx = ix / (colorCountX + 1);

            if (method === "hsl") {

                let h = lerp(ra.hslValues[0], rb.hslValues[0], tx);
                let s = lerp(ra.hslValues[1], rb.hslValues[1], tx);
                let l = lerp(ra.hslValues[2], rb.hslValues[2], tx);
                let a = lerp(ra.alpha01, rb.alpha01, tx);

                let h2 = lerp(rc.hslValues[0], rd.hslValues[0], tx);
                let s2 = lerp(rc.hslValues[1], rd.hslValues[1], tx);
                let l2 = lerp(rc.hslValues[2], rd.hslValues[2], tx);
                let a2 = lerp(rc.alpha01, rd.alpha01, tx);

                h = lerp(h, h2, ty);
                s = lerp(s, s2, ty);
                l = lerp(l, l2, ty);
                a = lerp(a, a2, ty);

                // convert back to RGB for prettiness.
                const rgb = hslToRgb(h / 360, s / 100, l / 100);
                //row.push(hslToCssString(h, s, l, a));
                row.push(rgbToCssString(rgb[0], rgb[1], rgb[2], a));
            }
            else if (method === "rgb") {
                let r = lerp(ra.rgbValues[0], rb.rgbValues[0], tx);
                let g = lerp(ra.rgbValues[1], rb.rgbValues[1], tx);
                let b = lerp(ra.rgbValues[2], rb.rgbValues[2], tx);
                let a = lerp(ra.alpha01, rb.alpha01, tx);

                let r2 = lerp(rc.rgbValues[0], rd.rgbValues[0], tx);
                let g2 = lerp(rc.rgbValues[1], rd.rgbValues[1], tx);
                let b2 = lerp(rc.rgbValues[2], rd.rgbValues[2], tx);
                let a2 = lerp(rc.alpha01, rd.alpha01, tx);

                r = lerp(r, r2, ty);
                g = lerp(g, g2, ty);
                b = lerp(b, b2, ty);
                a = lerp(a, a2, ty);

                row.push(rgbToCssString(r, g, b, a));
            }
            else if (method === "cmyk") {
                let c = lerp(ra.cmykValues[0], rb.cmykValues[0], tx);
                let m = lerp(ra.cmykValues[1], rb.cmykValues[1], tx);
                let y = lerp(ra.cmykValues[2], rb.cmykValues[2], tx);
                let k = lerp(ra.cmykValues[3], rb.cmykValues[3], tx);
                let a = lerp(ra.alpha01, rb.alpha01, tx);

                let c2 = lerp(rc.cmykValues[0], rd.cmykValues[0], tx);
                let m2 = lerp(rc.cmykValues[1], rd.cmykValues[1], tx);
                let y2 = lerp(rc.cmykValues[2], rd.cmykValues[2], tx);
                let k2 = lerp(rc.cmykValues[3], rd.cmykValues[3], tx);
                let a2 = lerp(rc.alpha01, rd.alpha01, tx);

                c = lerp(c, c2, ty);
                m = lerp(m, m2, ty);
                y = lerp(y, y2, ty);
                k = lerp(k, k2, ty);
                a = lerp(a, a2, ty);

                const rgb = cmykToRgb(c, m, y, k);
                row.push(rgbToCssString(rgb[0], rgb[1], rgb[2], a));
            }
            else if (method === "lab") {
                let L = lerp(ra.labValues[0], rb.labValues[0], tx);
                let A = lerp(ra.labValues[1], rb.labValues[1], tx);
                let B = lerp(ra.labValues[2], rb.labValues[2], tx);
                let a = lerp(ra.alpha01, rb.alpha01, tx);

                let L2 = lerp(rc.labValues[0], rd.labValues[0], tx);
                let A2 = lerp(rc.labValues[1], rd.labValues[1], tx);
                let B2 = lerp(rc.labValues[2], rd.labValues[2], tx);
                let a2 = lerp(rc.alpha01, rd.alpha01, tx);

                L = lerp(L, L2, ty);
                A = lerp(A, A2, ty);
                B = lerp(B, B2, ty);
                a = lerp(a, a2, ty);

                const rgb = labToRgb([L, A, B]);
                row.push(rgbToCssString(rgb[0], rgb[1], rgb[2], a));
            }
        }
        grid.push(row);
    }

    const handleCopyRow = async (row: string[]) => {
        const entries: string[] = [...row];
        setSubSelection(entries);
        paramsBundle.op = "row";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyRowRev = async (row: string[]) => {
        const entries: string[] = [...row];
        setSubSelection(entries.reverse());
        paramsBundle.op = "row rev";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyColumn = async (ix: number) => {
        const entries: string[] = grid.map(r => r[ix]!);
        setSubSelection(entries);
        paramsBundle.op = "column";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyColumnRev = async (ix: number) => {
        const entries: string[] = grid.map(r => r[ix]!);
        setSubSelection(entries.reverse());
        paramsBundle.op = "column rev";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyTL = async () => {
        const rowCount: number = grid.length;
        const colCount: number = grid[0]!.length;
        const result: string[] = [];

        // Bottom-left corner to top-left corner
        for (let i = rowCount - 1; i >= 0; i--) {
            result.push(grid[i]![0]!);
        }

        // Top-right corner excluding the first element
        for (let j = 1; j < colCount; j++) {
            result.push(grid[0]![j]!);
        }

        setSubSelection(result);
        paramsBundle.op = "TL";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyTR = async () => {
        const rowCount: number = grid.length;
        const colCount: number = grid[0]!.length;
        const result: string[] = [];

        // Top-left corner to top-right corner
        for (let j = 0; j < colCount; j++) {
            result.push(grid[0]![j]!);
        }

        // Top-right corner to bottom-right corner excluding the last element
        for (let i = 1; i < rowCount; i++) {
            result.push(grid[i]![colCount - 1]!);
        }
        setSubSelection(result);
        paramsBundle.op = "TR";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyBL = async () => {
        const rowCount: number = grid.length;
        const colCount: number = grid[0]!.length;
        const result: string[] = [];

        // Bottom-right corner to bottom-left corner
        for (let i = colCount - 1; i >= 0; i--) {
            result.push(grid[rowCount - 1]![i]!);
        }

        // Bottom-left corner to top-left corner excluding the first element
        for (let j = rowCount - 2; j >= 0; j--) {
            result.push(grid[j]![0]!);
        }
        setSubSelection(result);
        paramsBundle.op = "BL";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopyBR = async () => {
        const rowCount: number = grid.length;
        const colCount: number = grid[0]!.length;
        const result: string[] = [];

        // Top-right corner to bottom-right corner
        for (let i = 0; i < rowCount; i++) {
            result.push(grid[i]![colCount - 1]!);
        }

        // Bottom-right corner to bottom-left corner excluding the last element
        for (let j = colCount - 2; j >= 0; j--) {
            result.push(grid[rowCount - 1]![j]!);
        }
        setSubSelection(result);
        paramsBundle.op = "BR";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleCopySubselection = async () => {
        const lines: string[] = [`-- // ${subSelectionDesc}`, ...subSelection];
        const txt = lines.join(`\n`) + `\n`;
        await navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `copied ${txt.length} chars` });
    };

    const handleCopySubselectionExcl = async () => {
        const lines: string[] = [`-- // ${subSelectionDesc}`, ...subSelection.slice(1, -1)];
        const txt = lines.join(`\n`) + `\n`;
        await navigator.clipboard.writeText(txt);
        showSnackbar({ severity: "success", children: `copied ${txt.length} chars` });
    };

    const handleAppendSubselection = async () => {
        const lines: string[] = [`-- // ${subSelectionDesc}`, ...subSelection];
        const txt = lines.join(`\n`) + `\n`;
        props.handleAppendToTextPalette(txt);
    };

    const handleAppendSubselectionExcl = async () => {
        const lines: string[] = [`-- // ${subSelectionDesc}`, ...subSelection.slice(1, -1)];
        const txt = lines.join(`\n`) + `\n`;
        props.handleAppendToTextPalette(txt);
    };

    const handleClickSwatch = (c: string) => {
        setSubSelection([c]);
        paramsBundle.op = "swatch";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    }

    const handleClickDiagTL = () => {
        assert(colorCountX === colorCountY, "assumes square grid");
        const result: string[] = [];
        for (let i = 0; i < grid.length; ++i) {
            result.push(grid[i]![i]!);
        }
        setSubSelection(result);
        paramsBundle.op = "diagTL";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleClickDiagTR = () => {
        assert(colorCountX === colorCountY, "assumes square grid");
        const result: string[] = [];
        let d = grid.length - 1;
        for (let i = 0; i < grid.length; ++i) {
            result.push(grid[i]![d - i]!);
        }
        setSubSelection(result);
        paramsBundle.op = "diagTR";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleClickDiagBL = () => {
        assert(colorCountX === colorCountY, "assumes square grid");
        const result: string[] = [];
        let d = grid.length - 1;
        for (let i = 0; i < grid.length; ++i) {
            result.push(grid[d - i]![i]!);
        }
        setSubSelection(result);
        paramsBundle.op = "diagBL";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleClickDiagBR = () => {
        assert(colorCountX === colorCountY, "assumes square grid");
        const result: string[] = [];
        let d = grid.length - 1;
        for (let i = 0; i < grid.length; ++i) {
            result.push(grid[d - i]![d - i]!);
        }
        setSubSelection(result);
        paramsBundle.op = "diagBR";
        setSubSelectionDesc(JSON.stringify(paramsBundle));
    };

    const handleApplyParamBundle = (obj: ColorBlenderParamsBundle) => {
        try {
            setColorCountX(obj.z);
            setMethod(obj.m);
            setColorA(obj.c[0]!);
            setColorB(obj.c[1]!);
            setColorC(obj.c[2]!);
            if (obj.c.length > 3) {
                setLinkAD(false);
                setColorD(obj.c[3]!);
            } else {
                setLinkAD(true);
            }
        } catch (e) {
            console.log(e);
            alert(`error; see log`);
        }
    };

    const handlePasteParams = async () => {
        try {
            const txt = await navigator.clipboard.readText();
            const obj = JSON.parse(txt) as ColorBlenderParamsBundle;
            handleApplyParamBundle(obj);
        } catch (e) {
            console.log(e);
            alert(`error; see log`);
        }
    };

    React.useEffect(() => {
        if (props.setParamBundle) {
            handleApplyParamBundle(props.setParamBundle);
        }
    }, [props.setParamBundleSerial]);

    return <div className="colorBlender">
        <div className="controls">
            <div><button onClick={handlePasteParams}>paste params json</button></div>
            <div>
                A: <input type="text" value={colorA} onChange={e => setColorA(e.target.value)} />
                B: <input type="text" value={colorB} onChange={e => setColorB(e.target.value)} />
            </div>
            <div>
                C: <input type="text" value={colorC} onChange={e => setColorC(e.target.value)} />
                {/* <input type="range" value={colorCountY} min={1} max={9} onChange={e => setColorCountY(e.target.valueAsNumber)} /> */}
                D: <input type="text" disabled={linkAD} value={linkAD ? colorA : colorD} onChange={e => setColorD(e.target.value)} />
                (<FormControlLabel control={<input type="checkbox" checked={linkAD} onChange={e => setLinkAD(e.target.checked)} />} label="link with A"></FormControlLabel>)
            </div>
            <input type="range" value={colorCountX} min={1} max={9} onChange={e => setColorCountX(e.target.valueAsNumber)} />
            ({colorCountX} x {colorCountY})
            method:
            <select value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="lab">lab</option>
                <option value="cmyk">cmyk</option>
                <option value="rgb">rgb</option>
                <option value="hsl">hsl</option>
            </select>
        </div>

        <div className="paletteRow">
            <Swatch className="textButton" color="#eee" text={linkAD ? " " : `diag ↘`} onClick={handleClickDiagTL} />
            <Swatch className="textButton" color="#eee" text="↗" onClick={handleCopyTL} />
            {grid[0] && grid[0].map((entry, ix) => <Swatch className="textButton" key={ix} onClick={() => handleCopyColumn(ix)} color="#eee" text={linkAD && ix > 0 ? " " : `↓`} />)}
            <Swatch className="textButton" color="#eee" text={linkAD ? " " : `↘`} onClick={handleCopyTR} />
            <Swatch className="textButton" color="#eee" text="↙ diag" onClick={handleClickDiagTR} />
        </div>

        {grid.map((row, iy) => <div key={iy} className="paletteRow">
            <Swatch className="spacer" color="#eee" text=" " />
            <Swatch className="textButton" onClick={() => handleCopyRow(row)} color="#eee" text={linkAD && iy > 0 ? " " : `→`} />
            {row.map((c, ix) => {
                if (linkAD && (ix > colorCountX - iy + 1)) return <Swatch className="textButton" key={ix} color={"#eee"} text=" " />;
                return <Swatch key={ix} color={c} onClick={() => handleClickSwatch(c)} />;
            })}
            <Swatch className="textButton" onClick={() => handleCopyRowRev(row)} color="#eee" text={linkAD && iy > 0 ? " " : `←`} />
        </div>)}

        <div className="paletteRow">
            <Swatch className="textButton" color="#eee" text="diag ↗" onClick={handleClickDiagBL} />
            <Swatch className="textButton" color="#eee" text={linkAD ? " " : `↖`} onClick={handleCopyBL} />
            {grid[0] && grid[0].map((entry, ix) => <Swatch className="textButton" key={ix} onClick={() => handleCopyColumnRev(ix)} color="#eee" text={linkAD && ix > 0 ? " " : `↑`} />)}
            <Swatch className="textButton" color="#eee" text={linkAD ? " " : `↙`} onClick={handleCopyBR} />
            <Swatch className="textButton" color="#eee" text={linkAD ? " " : "↖ diag"} onClick={handleClickDiagBR} />
        </div>

        {!!subSelection.length && <div>
            <div>{subSelectionDesc}</div>
            <div className="paletteRow">
                {subSelection.map((entry, ix) => <Swatch key={ix} color={entry} />)}
                <Swatch className="textButton" color="#eee" text="COPY" onClick={handleCopySubselection} />
                <Swatch className="textButton" color="#eee" text="Cp-excl" onClick={handleCopySubselectionExcl} />
                <Swatch className="textButton" color="#eee" text="append" onClick={handleAppendSubselection} />
                <Swatch className="textButton" color="#eee" text="append-excl" onClick={handleAppendSubselectionExcl} />
                <Swatch className="textButton" color="#eee" text="Clear" onClick={() => setSubSelection([])} />
            </div>
        </div>}

    </div>;
};

const MyComponent = () => {
    const [textPalette, setTextPalette] = React.useState<string>("");
    const textPaletteSetting = API.settings.useSetting("textPalette");
    const updateSettingToken = API.settings.updateSetting.useToken();
    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);
    const [selectedEntryId, setSelectedEntryId] = React.useState<string | null>(null);
    const [forceRedraw, setForceRedraw] = React.useState<number>(0);

    const [showBlender, setShowBlender] = React.useState<boolean>(false);
    const [showTextPalette, setShowTextPalette] = React.useState<boolean>(false);
    const [showColorEditor, setShowColorEditor] = React.useState<boolean>(false);

    const [paramBundleToSet, setParamBundleToSet] = React.useState<null | ColorBlenderParamsBundle>(null);
    const [paramBundleSerial, setParamBundleSerial] = React.useState<number>(0);

    const handleTextPaletteChange = (val: string) => {
        setTextPalette(val);
        updateSettingToken.invoke({ name: "textPalette", value: val }).then(x => {
            showSnackbar({ severity: "success", children: "Updated palette setting" });
        }).catch(e => {
            console.log(e);
            showSnackbar({ severity: "error", children: "Error updating palette setting" });
        });
    };

    React.useEffect(() => {
        setTextPalette(textPaletteSetting || "");
    }, [textPaletteSetting]);

    const handleSwatchClick = (p: ColorPaletteEntry | null) => {
        setSelectedEntryId(p?.id || null);
    };

    const selectedEntry = gGeneralPaletteList.findEntry(selectedEntryId);

    const parsedPalette = ParseTextPalette(textPalette);

    const handleEntryChanged = (e: ColorPaletteEntry) => {
        // replace the entry in the palette.
        const f = gGeneralPaletteList.findEntry(e.id);
        if (!f) return;
        Object.assign(f, e);
        setForceRedraw(forceRedraw + 1);
    };

    const handleCopyMap = async () => {
        const allEntries: ColorPaletteEntry[] = [];
        gGeneralPaletteList.palettes.forEach(p => allEntries.push(...p.entries));

        const code: string[] = allEntries.map(e => `CreatePaletteEntry("${e.id}", ${e.strongOutline ? "true" : "false"}, "${e.strongValue}", "${e.strongContrastColor}", ${e.weakOutline ? "true" : "false"}, "${e.weakValue}", "${e.weakContrastColor}"),`);

        const txt = code.join(`\n`) + `\n`;
        await navigator.clipboard.writeText(txt);
        alert(`copied ${txt.length} chars`);
    };

    // find entries which are not part of the text palette.
    let looseCount: number = 0;
    let looseEntries: ColorPaletteEntry[] = [];
    let alphaCount: number = 0;
    let alphaEntries: ColorPaletteEntry[] = [];
    let errorCount: number = 0;
    let errorEntries: ColorPaletteEntry[] = [];
    gGeneralPaletteList.palettes.forEach(p => p.entries.forEach(e => {
        let collectLoose = 0;
        let collectError = 0;
        let collectAlpha = 0;

        const localCheck = (c: string) => {
            if (!parsedPalette.allEntries.find(pp => pp.cssColor === c)) {
                collectLoose++;
            }
            const pS = ParseColor(c);
            if (pS.type !== "color") {
                collectError++;
            } else {
                if (pS.alpha01 < 1.0) {
                    collectAlpha++;
                }
            }
        };

        localCheck(e.strongValue);
        localCheck(e.strongContrastColor);
        localCheck(e.weakValue);
        localCheck(e.weakContrastColor);

        looseCount += collectLoose;
        if (collectLoose) looseEntries.push(e);

        alphaCount += collectAlpha;
        if (collectAlpha) alphaEntries.push(e);

        errorCount += collectError;
        if (collectError) errorEntries.push(e);

    }));


    const handleMatchAllColors = () => {

        gGeneralPaletteList.palettes.forEach(p => p.entries.forEach(e => {
            // ideally i should not clobber stuff that's already matching, but if the algo works then it should not matter.
            const mS = FindClosestColorMatch({ parsedPalette, value: e.strongValue });
            if (!mS) return;
            e.strongValue = mS.cssColor;
            const mSC = FindClosestColorMatch({ parsedPalette, value: e.strongContrastColor });
            if (!mSC) return;
            e.strongContrastColor = mSC.cssColor;
            const mW = FindClosestColorMatch({ parsedPalette, value: e.weakValue });
            if (!mW) return;
            e.weakValue = mW.cssColor;
            const mWC = FindClosestColorMatch({ parsedPalette, value: e.weakContrastColor });
            if (!mWC) return;
            e.weakContrastColor = mWC.cssColor;
        }));

        showSnackbar({ severity: "success", children: "Palette updated." });
    };

    return <div className="paletteeditor2">
        {/* <div><a href="https://colordesigner.io/">tool for generating tones / tints / shades of a primary</a></div> */}

        <CMSinglePageSurfaceCard>
            <div className="header interactable" onClick={() => setShowBlender(!showBlender)}>
                Color blender tool
            </div>
            {showBlender && <div className="content">
                <ColorBlender handleAppendToTextPalette={(txt) => setTextPalette(textPalette + txt)} setParamBundle={paramBundleToSet} setParamBundleSerial={paramBundleSerial} />
            </div>}
        </CMSinglePageSurfaceCard>

        <CMSinglePageSurfaceCard>
            <div className="header interactable" onClick={() => setShowTextPalette(!showTextPalette)}>
                Text palette {parsedPalette.allEntries.length}
            </div>
            {showTextPalette && <div className="content">
                <div className="textPaletteLayout">
                    <textarea value={textPalette || ""} onChange={e => handleTextPaletteChange(e.target.value)}></textarea>
                    <UserPaletteGrid
                        parsedPalette={parsedPalette}
                        selectedEntries={[]}
                        onSetBlenderParamBundle={(pb) => {
                            //console.log(`setting trigger...`)
                            //setParamBundleTrigger(pb);
                            setParamBundleToSet(pb);
                            setParamBundleSerial(paramBundleSerial + 1);
                        }}
                    />
                </div>
            </div>}
        </CMSinglePageSurfaceCard>

        <CMSinglePageSurfaceCard>
            <div className="header interactable" onClick={() => setShowColorEditor(!showColorEditor)}>
                Edit color
            </div>
            {showColorEditor && <div className="content">

                <div>
                    <Button onClick={handleCopyMap}>copy map</Button>
                    search for `const gPaletteMap` and paste this to set this as your palette.
                </div>

                {selectedEntry && <PaletteEntryEditor onClose={() => setSelectedEntryId(null)} value={selectedEntry} onChange={handleEntryChanged} parsedPalette={parsedPalette} />}

                <ColorPaletteListComponent allowNull={true} palettes={gGeneralPaletteList} onClick={handleSwatchClick} />

                <div className={`looseColorsInfoContainer ${looseCount > 0 && "alert"}`}>
                    {looseCount} colors were found that don't have a match in your specified text palette. note: this does not work well when colors contain alpha values.
                    <Button onClick={handleMatchAllColors}>correct all {looseCount} entries</Button>
                    <div className="looseEntryList">
                        {looseEntries.map(e => <div className="looseEntry" key={e.id}>{e.label}</div>)}
                    </div>
                </div>

                <div className={`alphaColorsInfoContainer ${alphaCount > 0 && "alert"}`}>
                    {alphaCount} colors were found that have alpha; it's not going to work well in some cases. maybe it's ok?
                    {/* <Button onClick={removeAlphaAllColors}>remove alpha from all {alphaCount} entries</Button> */}
                    <div className="looseEntryList">
                        {alphaEntries.map(e => <div className="looseEntry" key={e.id}>{e.label}</div>)}
                    </div>
                </div>

                <div className={`alphaColorsInfoContainer ${errorCount > 0 && "alert"}`}>
                    {errorCount} colors failed to parse. hm?
                    <div className="looseEntryList">
                        {errorEntries.map(e => <div className="looseEntry" key={e.id}>{e.label}</div>)}
                    </div>
                </div>

            </div>}
        </CMSinglePageSurfaceCard>

    </div>;
};

const ColorEdit2Page: BlitzPage = () => {
    return (
        <DashboardLayout title="theme editor">
            <MyComponent></MyComponent>
        </DashboardLayout>
    )
}

export default ColorEdit2Page;
