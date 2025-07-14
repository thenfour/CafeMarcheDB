
import { FormControlLabel, Popover, Tooltip } from "@mui/material";
import { assert } from "blitz";
import parse from 'parse-css-color';
import React from "react";
import { lerp } from "shared/utils";
import { CMChip, CMChipContainer } from "src/core/components/CMChip";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { gIconMap } from "src/core/db3/components/IconMap";
import { ColorPick } from "./ColorPick";
import * as libcolor from "./libcolor";
import { ColorPaletteEntry, ColorPaletteEntryVariation, ColorVariationSpec, gGeneralPaletteList, StandardVariationSpec } from "./palette";
import { GetStyleVariablesForColorVariation } from "./ColorClientUtils";

const gDarkSelectedBorderColor = "#444";
const gLightSelectedBorderColor = "#ccc";

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
export interface ColorBlenderParamsBundle {
    c: string[],
    m: string,
    z: number,
    op: string,
};

export function ParseParamBundle(x: string | null): ColorBlenderParamsBundle | null {
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

// NB: must be serializable
interface ParsedPaletteEntry {
    cssColor: string;
    bundle: ColorBlenderParamsBundle | null;
    r: ParseColorResult;
};

function ParsePaletteEntry(cssColor: string) {
    const eeep = ParseColor(cssColor);
    const eee: ParsedPaletteEntry = {
        bundle: null,
        cssColor: eeep.cssColor || "#f0f",
        r: eeep,
    };
    return eee;
}

interface ParsedPalette {
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

interface SwatchProps {
    color: ParsedPaletteEntry;

    onMouseEnter?: () => void;
    onMouseLeave?: () => void;
    onClick?: (e: ParsedPaletteEntry) => void;
    onDroppedColor?: (c: ParsedPaletteEntry) => void;
    text?: string;
    className?: string;
    selected?: boolean;
    //bundle?: ColorBlenderParamsBundle; // when copying/dragging the color, this will be attached to it.
}

const Swatch = (props: SwatchProps) => {
    const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        event.dataTransfer.setData('application/json', JSON.stringify(props.color));
        event.dataTransfer.setData('text/plain', props.color.cssColor);
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        // Allow dropping by preventing the default behavior
        event.preventDefault();
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        // Prevent default behavior to avoid unwanted actions
        event.preventDefault();
        // Get the data that was set during the drag
        const droppedData = event.dataTransfer.getData('application/json');
        try {
            const droppedEntry = JSON.parse(droppedData) as ParsedPaletteEntry;
            // sanity check.
            if (!droppedEntry.r) throw new Error(`appears to be incorrect format; r missing`);
            if (!droppedEntry.r.cmykValues) throw new Error(`appears to be incorrect format; r.cmykValues missing`);
            props.onDroppedColor!(droppedEntry);
        } catch (e) {
            console.error(e);
            alert(`failed to drop; see console`);
        }
    };

    return <div
        draggable
        onDragStart={onDragStart}
        onDragOver={props.onDroppedColor && onDragOver}
        onDrop={props.onDroppedColor && onDrop}
        className={`paletteSwatch ${props.onClick && "interactable"} ${props.className || ""} ${props.selected && "selected"}`}
        style={{
            "--swatch-color": props.color.cssColor,
            "--selected-border-color": props.color.r.cssContrastColor || "black",
        } as any}
        onClick={() => { props.onClick && props.onClick(props.color) }}
        onMouseEnter={props.onMouseEnter}
        onMouseLeave={props.onMouseLeave}
    >
        {props.text || props.color.cssColor}
    </div>;
};

interface UserPaletteGridProps {
    parsedPalette: ParsedPalette;
    onClick?: (e: ParsedPaletteEntry) => void;
    onSetBlenderParamBundle?: (pb: ColorBlenderParamsBundle) => void;
    selectedEntries: string[];
    renderPreview?: (hoveredEntry: ParsedPaletteEntry | null) => React.ReactNode;
};

export const UserPaletteGrid = (props: UserPaletteGridProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const [hoveredEntry, setHoveredEntry] = React.useState<null | ParsedPaletteEntry>(null);
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

    return <div className="UserPaletteGrid">
        {props.parsedPalette.allEntries.length} colors.
        <div className={`paletteeditor2 UserPaletteGridGrid`}>
            {props.parsedPalette.allRows.map((row, iy) => <div className="paletteRow" key={iy}>
                {row.map((c, ix) => {
                    const localC = { ...c }; // for capture; dont think this is actually necesasary though.
                    return <div key={ix} className="singleSwatchContainer">
                        <div onClick={e => handleClick(e, localC, ix, iy)}>
                            <Swatch
                                key={ix}
                                color={localC}
                                className={interactable ? "interactable" : ""}
                                selected={props.selectedEntries.some(e => e === localC.cssColor)}
                                //selectedBorderColor={localC.r.cssContrastColor || "black"}
                                onMouseEnter={() => setHoveredEntry({ ...localC })}
                                onMouseLeave={() => setHoveredEntry(null)}
                            />
                        </div>
                        <Popover
                            anchorEl={anchorEl}
                            open={isOpen}
                            onClose={() => setAnchorEl(null)}
                            className="paletteeditor2"
                        >
                            <ColorDetailControl
                                value={focusedEntry!}
                                onChange={() => console.error(`not impl`)}
                                onSetBlenderParamBundle={props.onSetBlenderParamBundle}
                            />
                        </Popover>
                    </div>
                })}
            </div>)}
        </div>
        {props.renderPreview && <div className={`paletteeditor2 UserPaletteGridPreview`}>
            {props.renderPreview(hoveredEntry)}
        </div>}
    </div>;
};


export interface UserColorPickProps {
    value: ParsedPaletteEntry;
    palette: ParsedPalette;
    onChange: (value: ParsedPaletteEntry) => void;
    selectedEntries: string[];
    renderPreview?: (hoveredEntry: ParsedPaletteEntry | null) => React.ReactNode;
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
            <Swatch color={props.value} className="interactable" onDroppedColor={(e) => {
                props.onChange(e);
            }} />
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
                renderPreview={props.renderPreview}
            />
        </Popover >
    </>;
};


interface BigSwatchProps {
    entry: ColorPaletteEntryVariation;
    className?: string;
    text: string;

    variation: ColorVariationSpec;

    onDrop?: (e: ColorPaletteEntryVariation) => void;
};
const BigSwatch = (props: BigSwatchProps) => {
    const style = GetStyleVariablesForColorVariation(props.entry, props.variation);

    const onDragStart = (event: React.DragEvent<HTMLDivElement>) => {
        // Set the data and type to be transferred during the drag
        event.dataTransfer.setData('application/json', JSON.stringify(props.entry));
    };

    const onDragOver = (event: React.DragEvent<HTMLDivElement>) => {
        // Allow dropping by preventing the default behavior
        event.preventDefault();
    };

    const onDrop = (event: React.DragEvent<HTMLDivElement>) => {
        // Prevent default behavior to avoid unwanted actions
        event.preventDefault();
        // Get the data that was set during the drag
        const droppedData = event.dataTransfer.getData('application/json');
        try {
            const droppedEntry = JSON.parse(droppedData) as ColorPaletteEntryVariation;
            // sanity check.
            if (!droppedEntry.backgroundColor) throw new Error(`appears to be incorrect format; backgroundColor missing`);
            if (!droppedEntry.foregroundColor) throw new Error(`appears to be incorrect format; foregroundColor missing`);
            props.onDrop!(droppedEntry);
        } catch (e) {
            console.error(e);
            alert(`failed to drop; see console`);
        }
    };


    return <div
        draggable
        onDragStart={onDragStart} // Event when drag starts
        onDragOver={props.onDrop && onDragOver} // Event when something is dragged over
        onDrop={props.onDrop && onDrop} // Event when something is dropped

        className={`paletteBigSwatch applyColor ${props.className} ${style.cssClass}`}
        style={style.style}
    >
        <div className={`embeddedContrastSwatch`}></div>
        <div className="embeddedText">{props.text}</div>
    </div>

};


interface FindClosestColorMatchArgs {
    value: string;
    parsedPalette: ParsedPalette;
};
export function FindClosestColorMatch(args: FindClosestColorMatchArgs): ParsedPaletteEntry | null {
    if (args.parsedPalette.allEntries.length < 2) {
        console.log(`palette not big enough.`);
        return null;
    }
    const parsedValue = ParseColor(args.value);
    if (!parsedValue) {
        console.log(`unable to parse color ${args.value}`);
        return null;
    }

    let bestDistance: number = libcolor.deltaE(args.parsedPalette.allEntries[0]!.r.labValues, parsedValue.labValues);
    let bestMatch: ParsedPaletteEntry = args.parsedPalette.allEntries[0]!;
    for (let i = 1; i < args.parsedPalette.allEntries.length; ++i) {
        const entry = args.parsedPalette.allEntries[i]!;
        const d = libcolor.deltaE(entry.r.labValues, parsedValue.labValues);
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
        return <div className="correctColorItem correctColorOK"><Tooltip title="this color is found in the text palette."><div>✅</div></Tooltip></div>;
    }

    const handleClick = () => {
        const m = FindClosestColorMatch({ value: props.value, parsedPalette: props.parsedPalette });
        if (!m) {
            console.error(`something.`);
            return;
        }
        props.onChange(m);
    };

    return <div className="correctColorItem correctColorError"><Tooltip title="This color is not found in the text palette. So probably an inconsistent look. Click to find the closest match in the text palette"><button onClick={handleClick}>😡</button></Tooltip></div>;
};


interface PaletteEntryVariationEditorProps {
    name: string;
    value: ColorPaletteEntryVariation;
    variation: ColorVariationSpec;
    //parentValue: ColorPaletteEntry;
    onChange: (newValue: ColorPaletteEntryVariation) => void;
    parsedPalette: ParsedPalette;
};

const PaletteEntryVariationEditor = (props: PaletteEntryVariationEditorProps) => {

    const selectedEntries: string[] = [
        props.value.foregroundColor,
        props.value.backgroundColor,
    ];

    return <div className="PaletteEntryVariationEditor">
        <FormControlLabel label="Show border?" control={<input type="checkbox" checked={props.value.showBorder} onChange={(e) => props.onChange({ ...props.value, showBorder: e.target.checked })} />} />
        <div className="indivColorEditPair">
            <div className="indivColorEditGroup">
                <UserColorPick
                    selectedEntries={selectedEntries}
                    value={ParsePaletteEntry(props.value.backgroundColor)}
                    palette={props.parsedPalette}
                    onChange={(e) => props.onChange({ ...props.value, backgroundColor: e.cssColor })}
                    renderPreview={(hovered) => {
                        const col: ColorPaletteEntryVariation = { ...props.value };
                        if (hovered) col.backgroundColor = hovered.cssColor;
                        return <BigSwatch entry={col} text="preview" variation={props.variation} />
                    }}
                />
                <div><input className="manualColorEntry" type="text" value={props.value.backgroundColor} onChange={(e) => props.onChange({ ...props.value, backgroundColor: e.target.value })} /></div>
                <CorrectColorButton label="" value={props.value.backgroundColor} parsedPalette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, backgroundColor: e.cssColor })} />
            </div>
            <div className="indivColorEditGroup">
                <UserColorPick
                    selectedEntries={selectedEntries}
                    value={ParsePaletteEntry(props.value.foregroundColor)}
                    palette={props.parsedPalette}
                    onChange={(e) => props.onChange({ ...props.value, foregroundColor: e.cssColor })}
                    renderPreview={(hovered) => {
                        const col: ColorPaletteEntryVariation = { ...props.value };
                        if (hovered) col.foregroundColor = hovered.cssColor;
                        return <BigSwatch entry={col} text="preview" variation={props.variation} />
                    }}
                />
                <div><input className="manualColorEntry" type="text" value={props.value.foregroundColor} onChange={(e) => props.onChange({ ...props.value, foregroundColor: e.target.value })} /></div>
                <CorrectColorButton label="" value={props.value.foregroundColor} parsedPalette={props.parsedPalette} onChange={(e) => props.onChange({ ...props.value, foregroundColor: e.cssColor })} />
            </div>
        </div>
        <BigSwatch entry={props.value} text={props.name} variation={props.variation} onDrop={(e) => {
            props.onChange(e);
        }} />

    </div>;
};


const ColorVariationExpo = (props: { value: ColorPaletteEntry }) => {
    const [interactable, setInteractable] = React.useState<boolean>(false);
    const [altColor, setAltColor] = React.useState<ColorPaletteEntry | null>(null);
    const [count, setCount] = React.useState<number>(16);
    const [shuffledIndices, setShuffledIndices] = React.useState<number[]>([]);

    const [strongParam, setStrongParam] = React.useState<number>(2);
    const [enabledParam, setEnabledParam] = React.useState<number>(1);
    const [selectedParam, setSelectedParam] = React.useState<number>(0);
    //const [invertedParam, setInvertedParam] = React.useState<number>(0);
    const [hollowParam, setHollowParam] = React.useState<number>(0);
    const [shapeParam, setShapeParam] = React.useState<number>(0);

    const Reshuffle = () => {
        const idx = Array.from({ length: count }, (_, index) => index); // generate list of indices
        idx.sort(() => Math.random() - 0.5);  // shuffle
        setShuffledIndices(idx);
    };

    React.useEffect(() => {
        Reshuffle();
    }, [count]);

    const instruments: string[] = [
        'Guitar',
        'Violin',
        'Cello',
        'Flute',
        'Saxophone',
        'Trumpet',
        'Drums',
        'Clarinet',
        'Accordion',
        'Trombone',
        'Oboe',
    ];

    const ParamToString = (p: number) => {
        if (p === 0) return `N`;
        if (p === 1) return `?`;
        if (p === 2) return `Y`;
    };

    // easiest way is to utilize the natural interlacing of bits in a mask.
    let strongBit: number = 0; // this bit determines the param
    let enabledBit: number = 0;
    let selectedBit: number = 0;
    let hollowBit: number = 0;
    //let invertedBit: number = 0;
    let shapeBit: number = 0;
    let altColorBit: number = 0;
    let bitsUsed = 0;

    const shuffleAltColor = !!altColor;

    if (strongParam === 1) strongBit = (1 << bitsUsed++);
    if (enabledParam === 1) enabledBit = (1 << bitsUsed++);
    if (selectedParam === 1) selectedBit = (1 << bitsUsed++);
    //if (invertedParam === 1) invertedBit = (1 << bitsUsed++);
    if (hollowParam === 1) hollowBit = (1 << bitsUsed++);
    if (shapeParam === 1) shapeBit = (1 << bitsUsed++);
    if (shuffleAltColor) altColorBit = (1 << bitsUsed++);

    const getCoolValue = <T,>(i: number, param: number, bit: number, valueIfTrue: T, valueIfFalse: T): T => {
        if (param === 0) return valueIfFalse;
        if (param === 2) return valueIfTrue;
        return !!(i & bit) ? valueIfTrue : valueIfFalse;
    };

    return <div className="ColorVariationExpo">
        <div className="controls">
            <div className="row">
                <button onClick={Reshuffle}>reshuffle</button>
                <FormControlLabel label="interactive" control={<input type="checkbox" checked={interactable} onChange={(e) => setInteractable(e.target.checked)} />} />
                <FormControlLabel label={`count(${count})`} control={<input type="range" min={1} max={32} value={count} onChange={e => setCount(e.target.valueAsNumber)} />} />
            </div>
            <div className="row">
                <FormControlLabel label={`strong(${ParamToString(strongParam)})`} control={<input type="range" min={0} max={2} value={strongParam} onChange={e => setStrongParam(e.target.valueAsNumber)} />} />
                <FormControlLabel label={`enabled(${ParamToString(enabledParam)})`} control={<input type="range" min={0} max={2} value={enabledParam} onChange={e => setEnabledParam(e.target.valueAsNumber)} />} />
                <FormControlLabel label={`selected(${ParamToString(selectedParam)})`} control={<input type="range" min={0} max={2} value={selectedParam} onChange={e => setSelectedParam(e.target.valueAsNumber)} />} />
                {/* <FormControlLabel label={`inverted(${ParamToString(invertedParam)})`} control={<input type="range" min={0} max={2} value={invertedParam} onChange={e => setInvertedParam(e.target.valueAsNumber)} />} /> */}
                <FormControlLabel label={`hollow(${ParamToString(hollowParam)})`} control={<input type="range" min={0} max={2} value={hollowParam} onChange={e => setHollowParam(e.target.valueAsNumber)} />} />
                <FormControlLabel label={`shape(${ParamToString(shapeParam)})`} control={<input type="range" min={0} max={2} value={shapeParam} onChange={e => setShapeParam(e.target.valueAsNumber)} />} />
                <ColorPick allowNull={true} palettes={gGeneralPaletteList} value={altColor} onChange={(c) => setAltColor(c)} />
            </div>
        </div>
        <CMChipContainer>
            {shuffledIndices.map(i => {
                return <CMChip
                    key={i}
                    color={getCoolValue(i, shuffleAltColor ? 1 : 0, altColorBit, altColor, props.value)}
                    variation={{
                        enabled: getCoolValue(i, enabledParam, enabledBit, true, false),
                        selected: getCoolValue(i, selectedParam, selectedBit, true, false),
                        variation: getCoolValue(i, strongParam, strongBit, "strong", "weak"),
                        //inverted: getCoolValue(i, invertedParam, invertedBit, true, false),
                        fillOption: getCoolValue(i, hollowParam, hollowBit, "hollow", "filled"),
                    }}
                    shape={getCoolValue(i, shapeParam, shapeBit, "rounded", "rectangle")}
                    onDelete={interactable ? () => { } : undefined}
                >
                    {gIconMap.MusicNote()} {instruments[i % instruments.length]} ({i})
                </CMChip>;
            })}
        </CMChipContainer>
    </div>;
}


const ContrastColorSwatch = (props: { text: string, backgroundColor: string, color: ParsedPaletteEntry }) => {
    return <div className="ContrastColorSwatch" style={{ backgroundColor: props.backgroundColor, color: props.color.cssColor }}>
        {props.text}
        <Swatch color={props.color} />
    </div>

}

interface PaletteEntryEditorProps {
    value: ColorPaletteEntry;
    onChange: (newValue: ColorPaletteEntry) => void;
    parsedPalette: ParsedPalette;
    onClose: () => void;
};

type TPreviewStyle = [string, string];

export const PaletteEntryEditor = (props: PaletteEntryEditorProps) => {

    const previewStyleOptions: TPreviewStyle[] = [
        ["black", "white"],
        ["#444", "white"],
        ["#888", "white"],
        ["#ccc", "black"],
        ["#ddd", "black"],
        ["#eee", "black"],
        ["white", "black"],
    ];

    const [previewStyleIndex, setPreviewStyleIndex] = React.useState<number>(previewStyleOptions.length - 1);
    const previewStyle = previewStyleOptions[previewStyleIndex]!;
    const style = {
        "--preview-bg": previewStyle[0],
        "--preview-fg": previewStyle[1],
    } as React.CSSProperties;

    const parsedColorOnBlack = ParsePaletteEntry(props.value.contrastColorOnBlack);
    const parsedColorOnWhite = ParsePaletteEntry(props.value.contrastColorOnWhite);
    const selectedContrastColors = [parsedColorOnBlack.cssColor, parsedColorOnWhite.cssColor];

    return <div className="PaletteEntryEditor" style={style}>
        <div className="controls">
            <div className="title">{props.value.label}</div>
            <button onClick={props.onClose}>close</button>

            {previewStyleOptions.map((e, i) => {
                const style = {
                    backgroundColor: e[0],
                    color: e[1],
                } as React.CSSProperties;

                return <div className={`interactable previewStyleButton ${i === previewStyleIndex ? "selected" : "notselected"}`} key={i} style={style} onClick={() => setPreviewStyleIndex(i)}>
                    {e[0]}
                </div>;
            })}


            {/* <select value={previewStyleIndex} onChange={e => {
                setPreviewStyleIndex(parseInt(e.target.value))
            }
            }>
                {previewStyleOptions.map((e, i) => {
                    const style = {
                        backgroundColor: e[0],
                        color: e[1],
                    } as React.CSSProperties;

                    return <option key={i} value={i} style={style}>
                        {e[0]}
                    </option>;
                })}
            </select> */}
        </div>

        <div className="contrastColorEntries">
            <div className="ContrastColorSwatch" style={{ backgroundColor: "black", color: parsedColorOnBlack.cssColor }}>
                FG on black

                <UserColorPick
                    selectedEntries={selectedContrastColors}
                    value={parsedColorOnBlack}
                    palette={props.parsedPalette}
                    onChange={(e) => props.onChange({ ...props.value, contrastColorOnBlack: e.cssColor })}
                    renderPreview={(hovered) => {
                        return <div className="ContrastColorSwatchPreviewContainer"><ContrastColorSwatch color={hovered || parsedColorOnBlack} text="preview" backgroundColor="black" /></div>
                    }}
                />
            </div>
            <div className="ContrastColorSwatch" style={{ backgroundColor: "white", color: parsedColorOnWhite.cssColor }}>
                FG on white

                <UserColorPick
                    selectedEntries={selectedContrastColors}
                    value={parsedColorOnWhite}
                    palette={props.parsedPalette}
                    onChange={(e) => props.onChange({ ...props.value, contrastColorOnWhite: e.cssColor })}
                    renderPreview={(hovered) => {
                        return <div className="ContrastColorSwatchPreviewContainer"><ContrastColorSwatch color={hovered || parsedColorOnWhite} text="preview" backgroundColor="white" /></div>
                    }}
                />
            </div>
        </div>

        <div className="variationEditorContainer">
            <PaletteEntryVariationEditor variation={StandardVariationSpec.StrongDisabled} name="strongDisabled" parsedPalette={props.parsedPalette} value={props.value.strongDisabled} onChange={(v) => props.onChange({ ...props.value, strongDisabled: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.StrongDisabledSelected} name="strongDisabledSelected" parsedPalette={props.parsedPalette} value={props.value.strongDisabledSelected} onChange={(v) => props.onChange({ ...props.value, strongDisabledSelected: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.Strong} name="strong" parsedPalette={props.parsedPalette} value={props.value.strong} onChange={(v) => props.onChange({ ...props.value, strong: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.StrongSelected} name="strongSelected" parsedPalette={props.parsedPalette} value={props.value.strongSelected} onChange={(v) => props.onChange({ ...props.value, strongSelected: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.WeakDisabled} name="weakDisabled" parsedPalette={props.parsedPalette} value={props.value.weakDisabled} onChange={(v) => props.onChange({ ...props.value, weakDisabled: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.WeakDisabledSelected} name="weakDisabledSelected" parsedPalette={props.parsedPalette} value={props.value.weakDisabledSelected} onChange={(v) => props.onChange({ ...props.value, weakDisabledSelected: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.WeakDisabledSelected} name="weak" parsedPalette={props.parsedPalette} value={props.value.weak} onChange={(v) => props.onChange({ ...props.value, weak: v })} />
            <PaletteEntryVariationEditor variation={StandardVariationSpec.WeakSelected} name="weakSelected" parsedPalette={props.parsedPalette} value={props.value.weakSelected} onChange={(v) => props.onChange({ ...props.value, weakSelected: v })} />
        </div>

        <ColorVariationExpo value={props.value} />
    </div>;
};

interface ColorBlenderProps {
    handleAppendToTextPalette: (txt: string) => void;
    setParamBundle: ColorBlenderParamsBundle | null;
    setParamBundleSerial: number;
    //clearParamBundleTrigger?: () => void;
};

// color blender
export const ColorBlender = (props: ColorBlenderProps) => {
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
                const rgb = libcolor.hslToRgb(h / 360, s / 100, l / 100);
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

                const rgb = libcolor.cmykToRgb(c, m, y, k);
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

                const rgb = libcolor.labToRgb([L, A, B]);
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

    const eee = ParsePaletteEntry("#eee");

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
                <option value="rgb">rgb</option>
                <option value="cmyk">cmyk</option>
                <option value="hsl">hsl</option>
            </select>
        </div>

        <div className="paletteRow">
            <Swatch className="textButton" color={eee} text={linkAD ? " " : `diag ↘`} onClick={handleClickDiagTL} />
            <Swatch className="textButton" color={eee} text="↗" onClick={handleCopyTL} />
            {grid[0] && grid[0].map((entry, ix) => <Swatch className="textButton" key={ix} onClick={() => handleCopyColumn(ix)} color={eee} text={linkAD && ix > 0 ? " " : `↓`} />)}
            <Swatch className="textButton" color={eee} text={linkAD ? " " : `↘`} onClick={handleCopyTR} />
            <Swatch className="textButton" color={eee} text="↙ diag" onClick={handleClickDiagTR} />
        </div>

        {grid.map((row, iy) => <div key={iy} className="paletteRow">
            <Swatch className="spacer" color={eee} text=" " />
            <Swatch className="textButton" onClick={() => handleCopyRow(row)} color={eee} text={linkAD && iy > 0 ? " " : `→`} />
            {row.map((c, ix) => {
                if (linkAD && (ix > colorCountX - iy + 1)) return <Swatch className="textButton" key={ix} color={eee} text=" " />;

                const parsed = ParsePaletteEntry(c);
                parsed.bundle = JSON.parse(JSON.stringify(paramsBundle));

                return <Swatch key={ix} color={parsed} onClick={() => handleClickSwatch(c)} />;
            })}
            <Swatch className="textButton" onClick={() => handleCopyRowRev(row)} color={eee} text={linkAD && iy > 0 ? " " : `←`} />
        </div>)}

        <div className="paletteRow">
            <Swatch className="textButton" color={eee} text="diag ↗" onClick={handleClickDiagBL} />
            <Swatch className="textButton" color={eee} text={linkAD ? " " : `↖`} onClick={handleCopyBL} />
            {grid[0] && grid[0].map((entry, ix) => <Swatch className="textButton" key={ix} onClick={() => handleCopyColumnRev(ix)} color={eee} text={linkAD && ix > 0 ? " " : `↑`} />)}
            <Swatch className="textButton" color={eee} text={linkAD ? " " : `↙`} onClick={handleCopyBR} />
            <Swatch className="textButton" color={eee} text={linkAD ? " " : "↖ diag"} onClick={handleClickDiagBR} />
        </div>

        {!!subSelection.length && <div>
            <div>{subSelectionDesc}</div>
            <div className="paletteRow">
                {subSelection.map((entry, ix) => {
                    const parsed = ParsePaletteEntry(entry);
                    parsed.bundle = JSON.parse(JSON.stringify(paramsBundle));
                    return <Swatch key={ix} color={parsed} />
                })}
                <Swatch className="textButton" color={eee} text="COPY" onClick={handleCopySubselection} />
                <Swatch className="textButton" color={eee} text="Cp-excl" onClick={handleCopySubselectionExcl} />
                <Swatch className="textButton" color={eee} text="append" onClick={handleAppendSubselection} />
                <Swatch className="textButton" color={eee} text="append-excl" onClick={handleAppendSubselectionExcl} />
                <Swatch className="textButton" color={eee} text="Clear" onClick={() => setSubSelection([])} />
            </div>
        </div>}

    </div>;
};


interface ColorDetailControlProps {
    onChange: (val: ParsedPaletteEntry) => void;
    value: ParsedPaletteEntry;
    onSetBlenderParamBundle?: (pb: ColorBlenderParamsBundle) => void;
}

export const ColorDetailControl = ({ value, ...props }: ColorDetailControlProps) => {
    return <div className="ColorDetail">
        <div className="nameValueTable">
            <div className="row"><div className="name">CSS</div><div className="value">{value.cssColor}</div></div>
            <div className="row"><div className="name">Contrast</div><div className="value">{value.r.cssContrastColor}</div></div>
            <div className="row"><div className="name">Alpha</div><div className="value">{(value.r.alpha01 * 100).toFixed(2)}%</div></div>
            <div className="row"><div className="name">HSL</div><div className="value">{hslToCssString(value.r.hslValues[0], value.r.hslValues[1], value.r.hslValues[2], value.r.alpha01)}</div></div>
            <div className="row"><div className="name">RGB</div><div className="value">{rgbToCssString(value.r.rgbValues[0], value.r.rgbValues[1], value.r.rgbValues[2], value.r.alpha01)}</div></div>
            <div className="row"><div className="name">LAB</div><div className="value">[{value.r.labValues[0].toFixed(1)}, {value.r.labValues[1].toFixed(1)} {value.r.labValues[2].toFixed(1)}]</div></div>
            <div className="row"><div className="name">CMYK</div><div className="value">[{value.r.cmykValues[0].toFixed(1)}, {value.r.cmykValues[1].toFixed(1)} {value.r.cmykValues[2].toFixed(1)} {value.r.cmykValues[3].toFixed(1)}]</div></div>
            <div className="row"><div className="name">Comment</div><div className="value">{value.r.comment}</div></div>
            {props.onSetBlenderParamBundle && !!value.bundle && <button onClick={() => {
                props.onSetBlenderParamBundle && props.onSetBlenderParamBundle(value.bundle!);
            }}>
                Set bundle
            </button>}

        </div>        <div className="swatchPreviewCell" style={{ "--preview-bg": "#000" } as any}>
            <Swatch color={value} />
        </div>
        <div className="swatchPreviewCell" style={{ "--preview-bg": "#444" } as any}>
            <Swatch color={value} />
        </div>
        <div className="swatchPreviewCell" style={{ "--preview-bg": "#888" } as any}>
            <Swatch color={value} />
        </div>
        <div className="swatchPreviewCell" style={{ "--preview-bg": "#ccc" } as any}>
            <Swatch color={value} />
        </div>
        <div className="swatchPreviewCell" style={{ "--preview-bg": "#eee" } as any}>
            <Swatch color={value} />
        </div>
        <div className="swatchPreviewCell" style={{ "--preview-bg": "#fff" } as any}>
            <Swatch color={value} />
        </div>

    </div>;
};

interface SwatchTempPaletteEntryProps {
    selected: boolean;
    value: ParsedPaletteEntry;
    onChange: (value: ParsedPaletteEntry) => void;
    onClick: () => void;
};

const SwatchTempPaletteEntry = (props: SwatchTempPaletteEntryProps) => {
    //const [value, setValue] = React.useState<ParsedPaletteEntry>(ParsePaletteEntry("#fff0"));
    return <div className={`SwatchTempPaletteEntry ${props.selected ? "selected" : ""}`}>
        <Swatch color={props.value} onDroppedColor={(c) => props.onChange(c)} onClick={() => props.onClick()} />
    </div>;
};

interface SwatchTempPaletteProps {
    onSetBlenderParamBundle: (pb: ColorBlenderParamsBundle) => void;
};


export const SwatchTempPalette = (props: SwatchTempPaletteProps) => {
    const gCount = 16;
    const idx = Array.from({ length: gCount }, (_, index) => index); // generate list of indices
    const [selectedIndex, setSelectedIndex] = React.useState<number | null>(null);
    const [entries, setEntries] = React.useState<ParsedPaletteEntry[]>(() => {
        return Array.from({ length: gCount }, (_, index) => ParsePaletteEntry("#0001"));
    });

    const focusedEntry = selectedIndex === null ? null : entries[selectedIndex];

    return <div className="SwatchTempPalette">
        <div className="paletteRow">
            {idx.map(i =>
                <SwatchTempPaletteEntry
                    key={i}
                    onClick={() => {
                        setSelectedIndex((i === selectedIndex) ? null : i);
                    }}
                    selected={i === selectedIndex}
                    value={entries[i]!}
                    onChange={(c) => {
                        entries[i] = c;
                        setEntries([...entries]);
                    }}
                />
            )}
        </div>
        {!!focusedEntry && <div>
            <div onClick={() => {
                setSelectedIndex(null);
            }} className="interactable" >{gIconMap.Close()}</div>

            <ColorDetailControl
                onSetBlenderParamBundle={props.onSetBlenderParamBundle}
                onChange={c => {
                    entries[selectedIndex!] = c;
                    setEntries([...entries]);
                }}
                value={focusedEntry}
            /></div>}
    </div>;
};

