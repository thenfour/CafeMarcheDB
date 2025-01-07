// todo
// split into:
// - SetlistPlannerComponents
// - break out all util components
// - break out setlist planner client utils into a lib

import React from "react";
import { clamp01 } from "shared/utils";
import { CMTextInputBase } from "src/core/components/CMTextField";

export type Gradient = [string, string];

export interface SetlistPlannerColorScheme {
    songRequiredPoints: Gradient,
    songPointBalancePositive: Gradient,
    songPointBalanceNegative: Gradient,
    songSegmentPoints: Gradient,
    songTotalPoints: Gradient,
    segmentPoints: Gradient,
    segmentBalancePositive: Gradient,
    segmentBalanceNegative: Gradient,
    segmentPointsAvailable: Gradient,
    songCountPerSegment: Gradient,
    totalSongBalancePositive: string,
    totalSongBalanceNegative: string,
};

export const gSetlistPlannerDefaultColorScheme: SetlistPlannerColorScheme = {
    // Light orange -> orange
    //songRequiredPoints: ["#ff8", "#f90"],
    songRequiredPoints: ["#fef", "#b8c"],

    //songSegmentPoints: ["#cce", "#88b"], // dark purplish gray is practical but ugly.
    //songSegmentPoints: ["#fef", "#a4a"],
    songSegmentPoints: ["#cff", "#699"],
    //songSegmentPoints: ["#bdb", "#4a4"],
    // Light blue -> blue
    songTotalPoints: ["#8df", "#49f"],
    // Lighter green -> green
    songPointBalancePositive: ["#4a4", "#dfd"],
    // red -> Light red (negative gradients go opposite)
    songPointBalanceNegative: ["#f44", "#eaa"],

    // Light orange -> orange
    //segmentPoints: ["#fe7", "#f90"],
    segmentPoints: ["#8df", "#49f"], // blue

    // Light green -> green
    segmentBalancePositive: ["#dfd", "#4a4"],
    // red -> Light red (negative gradients go opposite)
    segmentBalanceNegative: ["#f44336", "#ef9a9a"],

    // Light purple -> purple
    segmentPointsAvailable: ["#fef", "#b8c"],

    songCountPerSegment: ["#fff", "#bbb"],

    // Solid greens and reds
    totalSongBalancePositive: "#4caf50",
    totalSongBalanceNegative: "#f44336",
};




// colors can be in the following forms:
// #rgb
// #rgba
// #rrggbb
// #rrggbbaa
function parseRGBA(str: string) {
    if (str.length === 4) {
        return {
            r: parseInt(str[1]! + str[1]!, 16),
            g: parseInt(str[2]! + str[2]!, 16),
            b: parseInt(str[3]! + str[3]!, 16),
            alpha: 255,
        };
    } else if (str.length === 5) {
        return {
            r: parseInt(str[1]! + str[1]!, 16),
            g: parseInt(str[2]! + str[2]!, 16),
            b: parseInt(str[3]! + str[3]!, 16),
            alpha: parseInt(str[4]! + str[4]!, 16),
        };
    } else if (str.length === 7) {
        return {
            r: parseInt(str.slice(1, 3), 16),
            g: parseInt(str.slice(3, 5), 16),
            b: parseInt(str.slice(5, 7), 16),
            alpha: 255,
        };
    } else if (str.length === 9) {
        return {
            r: parseInt(str.slice(1, 3), 16),
            g: parseInt(str.slice(3, 5), 16),
            b: parseInt(str.slice(5, 7), 16),
            alpha: parseInt(str.slice(7, 9), 16),
        };
    }
    return null;
}

// takes a value, input range, and output color range, and returns a lerp'd color.
// colors should be exactly in the form #RGBA.
export function LerpColor(value: number | null | undefined, min: number | null | undefined, max: number | null | undefined, colorGradient: [string, string]): string {
    if (value == null || min == null || max == null) return "transparent";
    if (min === max) return colorGradient[1];
    const lerpx = clamp01((value - min) / (max - min));
    const low = parseRGBA(colorGradient[0]);
    const high = parseRGBA(colorGradient[1]);
    if (!low || !high) return "transparent";
    const r = Math.round(low.r + lerpx * (high.r - low.r));
    const g = Math.round(low.g + lerpx * (high.g - low.g));
    const b = Math.round(low.b + lerpx * (high.b - low.b));
    const a = Math.round(low.alpha + lerpx * (high.alpha - low.alpha));
    const ret = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
    return ret;
}





//////////////////////////////////////////////////////////////////////////////////////////////////
// a wrapper around <input type="color"> which accepts #rgb format in addition to #rrggbb.
const ColorInput = (props: React.DetailedHTMLProps<React.InputHTMLAttributes<HTMLInputElement>, HTMLInputElement>) => {

    const value = props.value;
    let sanitizedValue = value as string;
    if (value && (value as any).length === 4) {
        const r = value[1];
        const g = value[2];
        const b = value[3];
        sanitizedValue = `#${r}${r}${g}${g}${b}${b}`;
    }

    const parsed = parseRGBA(sanitizedValue);

    let shownValue = sanitizedValue;
    if (parsed) {
        const { r, g, b, alpha } = parsed;
        const isSingleDigit = (n: number) => ((n & 0xF0) >> 4) === (n & 0x0F);

        if (alpha !== 255) {
            if (isSingleDigit(r) && isSingleDigit(g) && isSingleDigit(b) && isSingleDigit(alpha)) {
                shownValue = `#${(r >> 4).toString(16)}${(g >> 4).toString(16)}${(b >> 4).toString(16)}${(alpha >> 4).toString(16)}`;
            } else {
                shownValue = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${alpha.toString(16).padStart(2, "0")}`;
            }
        } else {
            if (isSingleDigit(r) && isSingleDigit(g) && isSingleDigit(b)) {
                shownValue = `#${(r >> 4).toString(16)}${(g >> 4).toString(16)}${(b >> 4).toString(16)}`;
            } else {
                shownValue = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
            }
        }
    }

    return <div className="ColorInputControl">
        <div className="inputWrapper"><input {...props} value={sanitizedValue} type="color" /></div>
        <div className="textValue"><CMTextInputBase
            value={shownValue}
            onChange={(e, newValue) => {
                if (newValue) {
                    props.onChange?.({ target: { value: newValue } } as any);
                }
            }}
        /></div>
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
type ColorGradientEditorProps = {
    value: Gradient;
    onChange: (newValue: Gradient) => void;
};

const ColorGradientEditor = (props: ColorGradientEditorProps) => {
    const gSampleSwatchCount = 4;
    return <div className="ColorGradientEditor">
        <ColorInput value={props.value[0]} onChange={(e) => {
            props.onChange([e.target.value, props.value[1]]);
        }} />
        <div className="ColorGradientEditorSwatches">
            {Array(gSampleSwatchCount).fill(0).map((_, i) => {
                const lerpx = i / (gSampleSwatchCount - 1);
                const color = LerpColor(lerpx, 0, 1, props.value);
                return <div key={i} className="swatch" style={{ backgroundColor: color }}><div>{i}</div></div>;
            })}
        </div>
        <ColorInput value={props.value[1]} onChange={(e) => {
            props.onChange([props.value[0], e.target.value]);
        }} />
    </div>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerColorSchemeEditorProps = {
    value: SetlistPlannerColorScheme;
    onChange: (newColorScheme: SetlistPlannerColorScheme) => void;
};

export const SetlistPlannerColorSchemeEditor = (props: SetlistPlannerColorSchemeEditorProps) => {
    return <div className="SetlistPlannerColorSchemeEditor">
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>songRequiredPoints</div>
            <ColorGradientEditor
                value={props.value.songRequiredPoints}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        songRequiredPoints: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>songSegmentPoints</div>
            <ColorGradientEditor
                value={props.value.songSegmentPoints}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        songSegmentPoints: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>songTotalPoints</div>
            <ColorGradientEditor
                value={props.value.songTotalPoints}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        songTotalPoints: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>songPointBalancePositive</div>
            <ColorGradientEditor
                value={props.value.songPointBalancePositive}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        songPointBalancePositive: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>songPointBalanceNegative</div>
            <ColorGradientEditor
                value={props.value.songPointBalanceNegative}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        songPointBalanceNegative: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>segmentPoints</div>
            <ColorGradientEditor
                value={props.value.segmentPoints}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        segmentPoints: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>segmentBalancePositive</div>
            <ColorGradientEditor
                value={props.value.segmentBalancePositive}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        segmentBalancePositive: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>segmentBalanceNegative</div>
            <ColorGradientEditor
                value={props.value.segmentBalanceNegative}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        segmentBalanceNegative: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>segmentPointsAvailable</div>
            <ColorGradientEditor
                value={props.value.segmentPointsAvailable}
                onChange={(newColor) => {
                    props.onChange({
                        ...props.value,
                        segmentPointsAvailable: newColor,
                    });
                }}
            />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>totalSongBalancePositive</div>
            <ColorInput value={props.value.totalSongBalancePositive} onChange={(e) => {
                props.onChange({ ...props.value, totalSongBalancePositive: e.target.value });
            }} />
        </div>
        <div className="SetlistPlannerColorSchemeEditorRow">
            <div>totalSongBalanceNegative</div>
            <ColorInput value={props.value.totalSongBalanceNegative} onChange={(e) => {
                props.onChange({ ...props.value, totalSongBalanceNegative: e.target.value });
            }} />
        </div>
    </div>;
};

