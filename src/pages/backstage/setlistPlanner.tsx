import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Button, ButtonGroup, DialogContent, Divider, FormControlLabel, Menu, MenuItem, Switch, Tooltip } from "@mui/material";
import { nanoid } from "nanoid";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { ColorPaletteEntry, gGeneralPaletteList, gLightSwatchColors } from "shared/color";
import { Permission } from "shared/permissions";
import { formatSongLength } from "shared/time";
import { clamp01, getHashedColor, getUniqueNegativeID, moveItemInArray } from "shared/utils";
import { CMChip } from "src/core/components/CMChip";
import { InspectObject, ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import { CMSmallButton, KeyValueTable } from "src/core/components/CMCoreComponents2";
import { CMTextInputBase } from "src/core/components/CMTextField";
import { ColorPaletteListComponent, ColorPick, GetStyleVariablesForColor } from "src/core/components/Color";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { Markdown3Editor } from "src/core/components/MarkdownControl3";
import { ReactiveInputDialog } from "src/core/components/ReactiveInputDialog";
import { Markdown } from "src/core/components/RichTextEditor";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { SongsProvider, useSongsContext } from "src/core/components/SongsContext";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { getURIForSong } from "src/core/db3/clientAPILL";
import { gCharMap, gIconMap } from "src/core/db3/components/IconMap";
import deleteSetlistPlan from "src/core/db3/mutations/deleteSetlistPlan";
import upsertSetlistPlan from "src/core/db3/mutations/upsertSetlistPlan";
import getSetlistPlans from "src/core/db3/queries/getSetlistPlans";
import { CreateNewSetlistPlan, SetlistPlan, SetlistPlanCell, SetlistPlanColumn, SetlistPlanRow } from "src/core/db3/shared/setlistPlanTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import * as db3 from "src/core/db3/db3";
import { getClipboardSongList, PortableSongList } from "src/core/components/EventSongListComponents";

// songs = rows
// segments = columns

type Gradient = [string, string];

interface SetlistPlannerColorScheme {
    songRequiredPoints: Gradient,
    songPointBalancePositive: Gradient,
    songPointBalanceNegative: Gradient,
    songSegmentPoints: Gradient,
    songTotalPoints: Gradient,
    segmentPoints: Gradient,
    segmentBalancePositive: Gradient,
    segmentBalanceNegative: Gradient,
    segmentPointsAvailable: Gradient,
    totalSongBalancePositive: string,
    totalSongBalanceNegative: string,
};

const gDefaultColors: SetlistPlannerColorScheme = {
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

    // Solid greens and reds
    totalSongBalancePositive: "#4caf50",
    totalSongBalanceNegative: "#f44336",
};




interface SetlistPlanMutator {
    setDoc: (doc: SetlistPlan) => void;

    setName: (name: string) => void;
    setDescription: (description: string) => void;

    addSong: (songId: number) => void;
    //addSongs: (songIds: number[]) => void;
    addAndRemoveSongs: (add: number[], remove: number[]) => void;
    addDivider: () => void;
    deleteRow: (rowId: string) => void;
    //removeSongs: (songIds: number[]) => void;
    setRowPointsRequired: (rowId: string, points: number | undefined) => void;
    setRowComment: (rowId: string, comment: string) => void;
    reorderRows: (args: ReactSmoothDnd.DropResult) => void;
    setRowColor: (rowId: string, color: string | undefined) => void;

    addColumn: () => void;
    deleteColumn: (columnId: string) => void;
    setColumnName: (columnId: string, name: string) => void;
    setColumnComment: (columnId: string, comment: string) => void;
    setColumnAvailablePoints: (columnId: string, total: number | undefined) => void;

    clearColumnAllocation: (columnId: string) => void;
    swapColumnAllocation: (columnId1: string, columnId2: string) => void;

    setCellPoints: (rowId: string, columnId: string, points: number | undefined) => void;
}

interface SetlistPlanStats {
    totalPointsRequired: number;
    totalPointsUsed: number;
    totalPointsInThePool: number;
    totalPlanSongBalance: number;
    totalPlanSegmentBalance: number;
    songsPerSegment: number;

    minSegmentPointsAvailable: number,
    maxSegmentPointsAvailable: number,
    maxSegPointsUsed: number,
    minSegPointsUsed: number,
    maxSegmentBalance: number,
    minSegmentBalance: number,
    maxSongBalance: number,
    minSongBalance: number,
    maxSongRequiredPoints: number,
    minSongRequiredPoints: number,
    maxSongTotalPoints: number,
    minSongTotalPoints: number,
    totalSongLengthSeconds: number,

    minCellAllocatedPoints: number,
    maxCellAllocatedPoints: number,

    songStats: {
        rowId: string;
        songId: number;
        requiredPoints: number | undefined;
        totalRehearsalPoints: number;
        balance: number | undefined;
    }[];
    segmentStats: {
        columnId: string;
        totalPointsAllocatedToSongs: number;
        balance: number;
    }[];
};

function CalculateSetlistPlanStats(doc: SetlistPlan, allSongs: db3.SongPayload[]): SetlistPlanStats {
    const totalPointsRequired = doc.payload.rows.reduce((acc, song) => song.pointsRequired ? acc + song.pointsRequired : acc, 0);
    const totalPointsUsed = doc.payload.cells.reduce((acc, x) => acc + (x.pointsAllocated || 0), 0);
    const totalPlanBalance = totalPointsUsed - totalPointsRequired;
    const songsPerSegment = doc.payload.cells.filter(ss => !!ss.pointsAllocated).length / doc.payload.columns.length;
    const totalPointsInThePool = doc.payload.columns.reduce((acc, x) => acc + (x.pointsAvailable || 0), 0);

    const songStats = doc.payload.rows.filter(song => song.type === "song").map(song => {
        const segMeasures = doc.payload.cells.filter((x) => x.rowId === song.rowId && !!x.pointsAllocated);
        const totalRehearsalPoints = segMeasures.reduce((acc, x) => acc + x.pointsAllocated!, 0);
        const balance = song.pointsRequired ? totalRehearsalPoints - song.pointsRequired : undefined;
        return {
            rowId: song.rowId,
            songId: song.songId!,
            requiredPoints: song.pointsRequired,
            totalRehearsalPoints,
            balance,
        };
    });

    const segmentStats = doc.payload.columns.map(segment => {
        const segmentMeasureTotal = segment.pointsAvailable || 0;
        const segmentMeasureUsed = doc.payload.cells.filter((x) => x.columnId === segment.columnId && !!x.pointsAllocated).reduce((acc, x) => acc + x.pointsAllocated!, 0);
        const balance = segmentMeasureTotal - segmentMeasureUsed;
        return {
            columnId: segment.columnId,
            totalPointsAllocatedToSongs: segmentMeasureUsed,
            balance,
        };
    });

    // maximum cell value points allocated
    const maxSegmentPointsAllocated = doc.payload.cells.reduce((acc, x) => {
        if (x.pointsAllocated == null) return acc;
        return Math.max(acc, x.pointsAllocated);
    }, 0);

    const minSegmentPointsAllocated = doc.payload.cells.reduce((acc, x) => {
        if (x.pointsAllocated == null) return acc;
        return Math.min(acc, x.pointsAllocated);
    }, maxSegmentPointsAllocated);

    const maxSegmentPointsAvailable = doc.payload.columns.reduce((acc, x) => {
        if (x.pointsAvailable == null) return acc;
        return Math.max(acc, x.pointsAvailable);
    }, 0);

    const minSegmentPointsAvailable = doc.payload.columns.reduce((acc, x) => {
        if (x.pointsAvailable == null) return acc;
        return Math.min(acc, x.pointsAvailable);
    }, maxSegmentPointsAvailable);

    const maxSegPointsUsed = segmentStats.reduce((acc, x) => {
        if (x.totalPointsAllocatedToSongs == null) return acc;
        return Math.max(x.totalPointsAllocatedToSongs, acc);
    }, 0);

    const minSegPointsUsed = segmentStats.reduce((acc, x) => {
        if (x.totalPointsAllocatedToSongs == null) return acc;
        return Math.min(x.totalPointsAllocatedToSongs, acc);
    }, maxSegPointsUsed);

    const maxSegmentBalance = segmentStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.max(x.balance, acc);
    }, 0);

    const minSegmentBalance = segmentStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.min(x.balance, acc);
    }, maxSegmentBalance);


    const maxSongBalance = songStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.max(x.balance, acc);
    }, 0);

    const minSongBalance = songStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.min(x.balance, acc);
    }, maxSongBalance);

    const maxSongRequiredPoints = songStats.reduce((acc, x) => {
        if (x.requiredPoints == null) return acc;
        return Math.max(x.requiredPoints, acc);
    }, 0);

    const minSongRequiredPoints = songStats.reduce((acc, x) => {
        if (x.requiredPoints == null) return acc;
        return Math.min(x.requiredPoints, acc);
    }, maxSongRequiredPoints);

    const maxSongTotalPoints = songStats.reduce((acc, x) => {
        if (x.totalRehearsalPoints == null) return acc;
        return Math.max(x.totalRehearsalPoints, acc);
    }, 0);

    const minSongTotalPoints = songStats.reduce((acc, x) => {
        if (x.totalRehearsalPoints == null) return acc;
        return Math.min(x.totalRehearsalPoints, acc);
    }, maxSongTotalPoints);

    const totalSongLengthSeconds = songStats.reduce((acc, x) => {
        const song = allSongs.find(s => s.id === x.songId);
        if (!song) return acc;
        return acc + (song.lengthSeconds || 0);
    }, 0);

    return {
        totalSongLengthSeconds,
        totalPointsRequired,
        totalPointsUsed,
        totalPlanSegmentBalance: segmentStats.reduce((acc, x) => acc + x.balance, 0),
        totalPlanSongBalance: totalPlanBalance,
        songsPerSegment,
        songStats,
        segmentStats,
        totalPointsInThePool,

        maxCellAllocatedPoints: maxSegmentPointsAllocated,
        minCellAllocatedPoints: minSegmentPointsAllocated,

        minSegmentPointsAvailable,
        maxSegmentPointsAvailable,
        maxSegPointsUsed,
        minSegPointsUsed,
        maxSegmentBalance,
        minSegmentBalance,
        maxSongBalance,
        minSongBalance,
        maxSongRequiredPoints,
        minSongRequiredPoints,
        maxSongTotalPoints,
        minSongTotalPoints,
    };
};

//////////////////////////////////////////////////////////////////////////////////////////////////



//////////////////////////////////////////////////////////////////////////////////////////////////
// specific input control which
// - allows null values (appears empty)
// - clicking in the field selects all of its text, for 1-keypress single-digit entry.
// - up/down arrow keys will incrument / decrement the value to the nearest fibonnaci number.

// i'm thinking:
// 1 point = just playing through a song once, probably 8 minutes total
// 2 points = playing through a song twice, or needing some brush up. ~16 minutes
// 3 points = a pretty quick runthrough, 24 minutes
// 5 points = a strong rehearsal, 40 minutes
// 8 points = a long rehearsal, 64 minutes
// 13 = effectively an entire rehearsal, 104 minutes. (1 hour 44 minutes).

// a 2-hour rehearsal supports about 15 points

type NumberFieldProps = {
    value: number | null;
    onChange?: (e: React.ChangeEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, newValue: number | null) => void;
    className?: string;
    readonly?: boolean;
    inert?: boolean;
    style?: React.CSSProperties;
    showPositiveSign?: boolean;
};

// Pre-generate Fibonacci numbers up to a certain max (adjust as needed)
const generateFibonacci = (max: number): number[] => {
    const fibs = [0, 1];
    while (true) {
        const next = fibs[fibs.length - 2]! + fibs[fibs.length - 1]!;
        if (next > max) break;
        fibs.push(next);
    }
    return fibs;
};

// For demonstration, we go up to 100000
const FIBONACCI_SEQUENCE = generateFibonacci(100000);

const NumberField = (props: NumberFieldProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        // If there's no numeric value, treat it like 0 for arrow handling
        const currentValue = props.value ?? 0;

        if (e.key === "ArrowUp") {
            e.preventDefault();
            // Find first Fibonacci number that is strictly greater than currentValue
            const nextFib = FIBONACCI_SEQUENCE.find((fib) => fib > currentValue);
            if (nextFib != null && props.onChange) {
                props.onChange(e, nextFib);
            } else {
                // If currentValue is already above our max precomputed Fibonacci,
                // do nothing or handle it in another way
            }
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            // Find the largest Fibonacci <= currentValue (previous Fib)
            // One approach is to find the index of the first Fibonacci that is >= currentValue,
            // then take one step back
            const idx = FIBONACCI_SEQUENCE.findIndex((fib) => fib >= currentValue);
            if (idx > 0 && props.onChange) {
                props.onChange(e, FIBONACCI_SEQUENCE[idx - 1]!);
            }
        }
    };

    // Standard onChange text -> number (or null) logic
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newValue = e.target.value ? parseInt(e.target.value) : null;
        props.onChange && props.onChange(e, isNaN(newValue as number) ? null : newValue);
    };

    const valueAsText = props.value == null ? "" : (props.showPositiveSign && props.value > 0 ? `+${props.value}` : props.value.toString());

    return (
        <input
            type="text"
            ref={inputRef}
            value={valueAsText}
            onChange={handleChange}
            onFocus={handleFocus}
            onKeyDown={handleKeyDown}
            className={`NumberField ${props.readonly ? "readonly" : "editable"} ${props.inert ? "inert" : "notinert"} ${props.className}`}
            inert={props.inert}
            readOnly={props.readonly}
            disabled={props.inert}
            style={props.style}
        />
    );
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
function LerpColor(value: number | null | undefined, min: number | null | undefined, max: number | null | undefined, colorGradient: [string, string]): string {
    if (value == null || min == null || max == null) return "transparent";
    if (min === max) return "transparent";
    const lerpx = clamp01((value - min) / (max - min));
    //const lerpx = ((value - min) / (max - min));
    //const lerpx = lerp(min, max, value);
    const low = parseRGBA(colorGradient[0]);
    const high = parseRGBA(colorGradient[1]);
    if (!low || !high) return "transparent";
    const r = Math.round(low.r + lerpx * (high.r - low.r));
    const g = Math.round(low.g + lerpx * (high.g - low.g));
    const b = Math.round(low.b + lerpx * (high.b - low.b));
    const a = Math.round(low.alpha + lerpx * (high.alpha - low.alpha));
    const ret = `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}${a.toString(16).padStart(2, "0")}`;
    //console.log(`lerp = ${lerp}, value=${value} min=${min} max:${max} low = ${lowColor}, high = ${highColor}, ret = ${ret}`);
    //console.log(ret);
    //return "#f80";
    return ret;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
interface LedProps {
    value: string | null;
    onChange: (newValue: string | null) => void;
}
const Led = (props: LedProps) => {
    const [open, setOpen] = React.useState<boolean>(false);

    const style = GetStyleVariablesForColor({
        color: props.value,
        enabled: true,
        fillOption: "filled",
        selected: false,
        variation: "strong",
    });
    return <>
        <div
            className={`applyColor interactable ${style.cssClass}`}
            onClick={() => setOpen(true)}
            style={{
                ...style.style,
                "--dim": "14px",
                width: "var(--dim)",
                height: "var(--dim)",
                margin: "4px",
            } as any}
        >
        </div>
        {open && (
            <ReactiveInputDialog onCancel={() => setOpen(false)}>
                <DialogContent>
                    <ColorPaletteListComponent allowNull={true} palettes={gGeneralPaletteList} onClick={(e: ColorPaletteEntry | null) => {
                        props.onChange(e?.id || null);
                        //props.onChange(e);
                        setOpen(false);
                    }}
                    />
                </DialogContent>
            </ReactiveInputDialog >
        )}
    </>;
};

//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    stats: SetlistPlanStats;
    colorScheme: SetlistPlannerColorScheme;
};

const SetlistPlannerMatrixSongRow = (props: SetlistPlannerMatrixRowProps) => {
    const allSongs = useSongsContext().songs;
    let songStats = props.stats.songStats.find((x) => x.rowId === props.rowId);
    if (!songStats) {
        // in intermediate contexts this can happen; use an empty stat object
        return null;
    };

    // if balance is negative, use a gradient.
    // if balance is 0 or positive, use a solid green.
    let balanceColor = "transparent";
    if (songStats.balance != null && songStats.balance < 0) {
        balanceColor = LerpColor(songStats.balance, props.stats.minSongBalance, 0, props.colorScheme.songPointBalanceNegative);
    } else if (songStats.balance != null && songStats.balance >= 0) {
        balanceColor = LerpColor(songStats.balance, props.stats.maxSongBalance, 0, props.colorScheme.songPointBalancePositive);
    }

    const songRow = props.doc.payload.rows.find((x) => x.rowId === props.rowId)!;
    const song = allSongs.find((x) => x.id === songRow.songId!)!;
    const songLengthFormatted = song.lengthSeconds === null ? null : formatSongLength(song.lengthSeconds);

    return <div className="tr">
        <div className="td songName">

            <div className="dragHandle draggable">
                ☰
            </div>

            <Tooltip title={`Amount of rehearsal points this song needs`} disableInteractive>
                <div className="numberCell" style={{ backgroundColor: LerpColor(songStats.requiredPoints, props.stats.minSongRequiredPoints, props.stats.maxSongRequiredPoints, props.colorScheme.songRequiredPoints) }}>
                    <NumberField
                        value={songStats.requiredPoints || null}
                        onChange={(e, newValue) => { props.mutator.setRowPointsRequired(props.rowId, newValue || undefined) }}
                    />
                </div>
            </Tooltip>

            <div style={{ display: "flex", alignItems: "center" }}>
                <Tooltip disableInteractive title={songRow.commentMarkdown ? <Markdown markdown={songRow.commentMarkdown || null} /> : null}>
                    <div>
                        <Led value={songRow.color || null} onChange={(newColor) => {
                            props.mutator.setRowColor(props.rowId, newColor || undefined);
                        }} />
                    </div>
                </Tooltip>
                <div>
                    <a href={getURIForSong(song)} target="_blank" rel="noreferrer" style={{
                        "--song-hash-color": getHashedColor(song.name),
                        color: `var(--song-hash-color)`,
                    } as any}>{song.name}</a>
                </div>
            </div>
        </div>
        <div className="td songLength">
            {songLengthFormatted}
        </div>
        {
            props.doc.payload.columns.map((segment, index) => {
                // if no measureUsage, use transparent color
                // otherwise 
                const pointsAllocated = props.doc.payload.cells.find((x) => x.columnId === segment.columnId && x.rowId === props.rowId)?.pointsAllocated;
                const bgColor = pointsAllocated ? LerpColor(
                    pointsAllocated,
                    props.stats.minCellAllocatedPoints,
                    props.stats.maxCellAllocatedPoints,
                    props.colorScheme.songSegmentPoints
                ) : "white";
                return <div key={index} className={`td segment numberCell ${pointsAllocated ? "" : "hatch"}`} style={{ backgroundColor: bgColor }}>
                    <NumberField
                        value={pointsAllocated || null}
                        onChange={(e, newValue) => {
                            props.mutator.setCellPoints(props.rowId, segment.columnId, newValue || undefined);
                        }}
                    />
                </div>;
            })
        }
        <Tooltip title={`Total points this song will be rehearsed`} disableInteractive>
            <div className="td rehearsalTime numberCell" style={{ backgroundColor: LerpColor(songStats.totalRehearsalPoints, props.stats.minSongTotalPoints, props.stats.maxSongTotalPoints, props.colorScheme.songTotalPoints) }}>
                <NumberField inert value={songStats.totalRehearsalPoints} />
            </div>
        </Tooltip>
        <Tooltip title={`Rehearsal points remaining to finish rehearsing this song. ${(songStats.balance || 0) >= 0 ? `You have allocated enough time to rehearse this song` : `You need to allocate ${-(songStats.balance || 0)} more points to finish rehearsing ${song.name}`}`} disableInteractive>
            <div className={`td balance numberCell`} style={{ backgroundColor: balanceColor }}>
                <NumberField inert value={songStats.balance || null} showPositiveSign />
            </div>
        </Tooltip>
    </div >;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDividerRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    rowId: string;
    stats: SetlistPlanStats;
};

const SetlistPlannerDividerRow = (props: SetlistPlannerDividerRowProps) => {

    const row = props.doc.payload.rows.find((x) => x.rowId === props.rowId)!;

    return <div className="tr divider">
        <div className="td songName">
            <div className="dragHandle draggable">
                ☰
            </div>

            <div className="numberCell">
                <NumberField
                    style={{ visibility: "hidden" }}
                    value={0}
                    onChange={(e, newValue) => { props.mutator.setRowPointsRequired(props.rowId, newValue || undefined) }}
                />
            </div>

            <div style={{ display: "flex", alignItems: "center" }}>
                <div>
                    <Led value={row.color || null} onChange={(newColor) => {
                        props.mutator.setRowColor(props.rowId, newColor || undefined);
                    }} />
                </div>
                <Markdown compact markdown={row.commentMarkdown || ""} />
            </div>
        </div>
    </div>;
}


//////////////////////////////////////////////////////////////////////////////////////////////////
type ColumnHeaderDropdownMenuProps = {
    columnId: string;
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
};

const ColumnHeaderDropdownMenu = (props: ColumnHeaderDropdownMenuProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const column = props.doc.payload.columns.find((x) => x.columnId === props.columnId)!;
    const allSongs = useSongsContext().songs;
    const snackbar = useSnackbar();

    const handleCopySongNames = async () => {
        snackbar.invokeAsync(async () => {
            const songNames = props.doc.payload.rows
                .filter((x) => x.type === "song" && props.doc.payload.cells.some((c) => c.rowId === x.rowId && c.columnId === column.columnId && c.pointsAllocated))
                .map((x) => allSongs.find((s) => s.id === x.songId)!.name);
            await navigator.clipboard.writeText(songNames.join("\n"));
            setAnchorEl(null);
        }, "Copied song names to clipboard");
    };

    const handleClearAllocation = async () => {
        snackbar.invokeAsync(async () => {
            props.mutator.clearColumnAllocation(column.columnId);
            setAnchorEl(null);
        }, `Cleared allocation for ${column.name}`);
    };

    const handleSwapAllocationWith = async (otherColumnId: string) => {
        snackbar.invokeAsync(async () => {
            props.mutator.swapColumnAllocation(column.columnId, otherColumnId);
            setAnchorEl(null);
        }, `Swapped allocation with ${props.doc.payload.columns.find((x) => x.columnId === otherColumnId)!.name}`);
    };

    const columnToSetlist = (column: SetlistPlanColumn): PortableSongList => {
        // ignores dividers, and picks only songs for which cells have allocated points.
        const cells = props.doc.payload.cells.filter((x) => x.columnId === column.columnId && x.pointsAllocated).map((x) => x.rowId);
        const songIds = props.doc.payload.rows.filter((x) => x.type === "song" && cells.includes(x.rowId)).map(row => row.songId);
        const songs = allSongs.filter((x) => songIds.includes(x.id));
        return songs.map((s, index) => ({
            sortOrder: index,
            comment: "",
            song: s,
            type: 'song',
        }));
    };

    const handleCopyAsSetlist = async () => {
        snackbar.invokeAsync(async () => {
            const setlist = columnToSetlist(column);
            await navigator.clipboard.writeText(JSON.stringify(setlist, null, 2));
            setAnchorEl(null);
        }, `Copied ${column.name} as setlist`);
    };

    return <>
        <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{column.name}{gCharMap.VerticalEllipses()}</CMSmallButton>
        <Menu
            id="menu-setlistplannercolumn"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            <MenuItem onClick={handleCopySongNames}>
                Copy song names
            </MenuItem>

            <MenuItem onClick={handleCopyAsSetlist}>
                Copy as setlist
            </MenuItem>

            <Divider />
            <MenuItem onClick={handleClearAllocation}>
                Clear allocation for {column.name}
            </MenuItem>
            <Divider />
            {
                props.doc.payload.columns.filter(c => c.columnId != props.columnId).map((c, index) => (
                    <MenuItem key={index} onClick={() => handleSwapAllocationWith(c.columnId)}>
                        Swap allocation with {c.name}
                    </MenuItem>
                ))
            }
        </Menu >
    </>;
};



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    stats: SetlistPlanStats;
    colorScheme: SetlistPlannerColorScheme;
};

const SetlistPlannerMatrix = (props: SetlistPlannerMatrixProps) => {

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        props.mutator.reorderRows(args);
    };

    return <div className="SetlistPlannerMatrix">
        <div className="tr header">
            <div className="td songName"></div>
            <div className="td songLength">
            </div>
            {props.doc.payload.columns.map((segment, index) => <div key={index} className="td segment">
                <div><ColumnHeaderDropdownMenu columnId={segment.columnId} doc={props.doc} mutator={props.mutator} /></div>
                <div className="numberCell" style={{ backgroundColor: LerpColor(segment.pointsAvailable, props.stats.minSegmentPointsAvailable, props.stats.maxSegmentPointsAvailable, props.colorScheme.segmentPointsAvailable) }}>
                    <NumberField
                        value={segment.pointsAvailable || null}
                        onChange={(e, newValue) => {
                            props.mutator.setColumnAvailablePoints(segment.columnId, newValue || undefined);
                        }}
                    />
                </div>
            </div>)}
            <div className="td rehearsalTime">total</div>
            <div className="td balance">bal</div>
        </div>
        <div className="matrix">
            <ReactSmoothDndContainer
                dragHandleSelector=".dragHandle"
                lockAxis="y"
                onDrop={onDrop}
            >
                {props.doc.payload.rows.map((song, index) => <ReactSmoothDndDraggable key={index}>
                    {song.type === "divider" ? <SetlistPlannerDividerRow
                        mutator={props.mutator}
                        stats={props.stats}
                        key={index}
                        doc={props.doc}
                        rowId={song.rowId}
                    /> :
                        <SetlistPlannerMatrixSongRow
                            mutator={props.mutator}
                            stats={props.stats}
                            key={index}
                            doc={props.doc}
                            colorScheme={props.colorScheme}
                            rowId={song.rowId}
                        />
                    }
                </ReactSmoothDndDraggable>
                )}
            </ReactSmoothDndContainer>
        </div>

        <div className="footerContainer">
            <div className="tr footer">
                {/* <Tooltip disableInteractive title={`Total required rehearsal points for all songs`}> */}
                <div className="td songName numberCell">
                    {/* <NumberField inert value={props.stats.totalPointsRequired} style={{ backgroundColor: gColors.songRequiredPoints[1] }} /> */}
                </div>
                <Tooltip disableInteractive title={`Total song length for all songs`}>
                    <div className="td songLength">
                        {formatSongLength(props.stats.totalSongLengthSeconds)}
                    </div>
                </Tooltip>
                {/* </Tooltip> */}
                {props.doc.payload.columns.map((segment, index) => {
                    const segStats = props.stats.segmentStats.find((x) => x.columnId === segment.columnId) || { totalPointsAllocatedToSongs: 0, balance: 0 };
                    const bgColor = LerpColor(segStats.totalPointsAllocatedToSongs, props.stats.minSegPointsUsed, props.stats.maxSegPointsUsed, props.colorScheme.segmentPoints);
                    return <Tooltip key={index} disableInteractive title={`Total rehearsal points you've allocated for ${segment.name}`}>
                        <div key={index} className="td segment numberCell" style={{ backgroundColor: bgColor }}>
                            <NumberField inert value={segStats.totalPointsAllocatedToSongs} />
                        </div>
                    </Tooltip>;
                })}
                <Tooltip disableInteractive title={`total rehearsal points allocated for the whole plan`}>
                    <div className="td rehearsalTime numberCell" style={{ backgroundColor: props.colorScheme.songTotalPoints[1] }}>
                        <NumberField inert value={props.stats.totalPointsUsed} />
                    </div>
                </Tooltip>
                <Tooltip disableInteractive title={`total song balance for the whole plan. ${props.stats.totalPlanSongBalance >= 0 ? `you have allocated enough to rehearse all songs fully` : `you need to allocate ${Math.abs(props.stats.totalPlanSongBalance)} more points to rehearse all songs`}`}>
                    <div className="td balance numberCell totalPlanBalance" style={{ backgroundColor: props.stats.totalPlanSongBalance >= 0 ? props.colorScheme.totalSongBalancePositive : props.colorScheme.totalSongBalanceNegative }}>
                        <NumberField inert value={props.stats.totalPlanSongBalance} showPositiveSign />
                    </div>
                </Tooltip>
            </div>

            <div className="tr footer">
                <div className="td songName"></div>
                <div className="td songLength">
                </div>
                {props.doc.payload.columns.map((segment, index) => {
                    const segStats = props.stats.segmentStats.find((x) => x.columnId === segment.columnId) || { totalPointsAllocatedToSongs: 0, balance: 0 };
                    const balanceColor = segStats.balance >= 0 ?
                        LerpColor(segStats.balance, 0, props.stats.maxSegmentBalance, props.colorScheme.segmentBalancePositive)
                        : LerpColor(segStats.balance, props.stats.minSegmentBalance, 0, props.colorScheme.segmentBalanceNegative);
                    return <Tooltip disableInteractive title={`Rehearsal points left unallocated ${segment.name}`}>
                        <div key={index} className="td segment numberCell" style={{ backgroundColor: balanceColor }}>
                            <NumberField inert value={segStats.balance} showPositiveSign />
                        </div>
                    </Tooltip>;
                })}
                <Tooltip disableInteractive title={
                    <div>
                        <div>total rehearsal point balance for the whole plan</div>
                        <div>{props.stats.totalPlanSegmentBalance >= 0 ? `you have ${props.stats.totalPlanSegmentBalance} points left to allocate` : `you have over-allocated by ${-props.stats.totalPlanSegmentBalance} points.`}</div>
                    </div>}>
                    <div className="td rehearsalTime" style={{ backgroundColor: props.stats.totalPlanSegmentBalance >= 0 ? props.colorScheme.segmentBalancePositive[1] : props.colorScheme.segmentBalanceNegative[0] }}>
                        <NumberField inert value={props.stats.totalPlanSegmentBalance} showPositiveSign />
                    </div>
                </Tooltip>
                <div className="td balance"></div>
            </div>
        </div >

        <KeyValueTable
            data={{
                "required points to rehearse all songs": props.stats.totalPointsRequired,
                "rehearsal points in the pool": props.stats.totalPointsInThePool,
                "": (props.stats.totalPointsInThePool >= props.stats.totalPointsRequired ?
                    <CMChip color={gLightSwatchColors.light_green}>You have enough rehearsal points to rehearse all songs</CMChip> :
                    <CMChip color={gLightSwatchColors.light_orange}>You don't have enough rehearsal time to rehearse all songs ({props.stats.totalPointsRequired - props.stats.totalPointsInThePool} short)</CMChip>),
                "Song points you still need to allocate": props.stats.totalPlanSongBalance,
                //"total rehearsal points allocated": props.stats.totalPointsUsed,
                "Rehearsal points still available": props.stats.totalPlanSegmentBalance,
                "songs per rehearsal": props.stats.songsPerSegment.toFixed(2),
            }} />

        <div className="SetlistPlannerDocumentEditorAddSong">
            Add song...
            <SongAutocomplete
                value={null}
                onChange={(newSong) => {
                    if (newSong) {
                        props.mutator.addSong(newSong.id);
                    }
                }}
            />

            <Button startIcon={gIconMap.Add()} onClick={() => {
                props.mutator.addDivider();
            }}>Add Divider</Button>
        </div>

    </div >;
}




//////////////////////////////////////////////////////////////////////////////////////////////////
type MainDropdownMenuProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
};

const MainDropdownMenu = (props: MainDropdownMenuProps) => {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const allSongs = useSongsContext().songs;
    const snackbar = useSnackbar();
    const confirm = useConfirm();

    const handleCopyToClipboard = () => {
        snackbar.invokeAsync(async () => {
            await navigator.clipboard.writeText(JSON.stringify(props.doc, null, 2));
            setAnchorEl(null);
        }, "Copied plan to clipboard");
    };
    const handlePasteFromClipboard = async () => {
        const text = await navigator.clipboard.readText()
        let newDoc: any

        try {
            newDoc = JSON.parse(text)
        } catch (e) {
            console.error(e)
            snackbar.showError("Failed to parse clipboard contents")
            return
        }

        if (await confirm({ title: "Paste from clipboard", description: "This will replace the current document. Are you sure?" })) {
            snackbar.invokeAsync(async () => {
                props.mutator.setDoc(newDoc)
                setAnchorEl(null)
            }, "Pasted from clipboard")
        }
    }

    const handleAddSongsFromClipboardSetlist = async () => {
        // deserialize the clipboard setlist.
        const setlist = await getClipboardSongList();
        if (!setlist) {
            snackbar.showError("Clipboard does not contain a valid setlist");
            return;
        }
        // find songs that are in the setlist but not in the current plan document.
        const missingSongs = setlist
            .filter(row => row.type === "song")
            .map(x => x.song.id)
            .filter(x => !props.doc.payload.rows.some(s => s.songId === x))
            .map(songId => allSongs.find(s => s.id === songId));

        // add these songs to the plan.
        props.mutator.addAndRemoveSongs(missingSongs.map(x => x!.id), []);
        setAnchorEl(null);
        console.log(`Adding ${missingSongs.length} songs...`);
        console.log(missingSongs.map(x => x?.name));
        snackbar.showSuccess(`Added ${missingSongs.length} songs from clipboard setlist`);
    };

    const handleSyncWithClipboardSetlist = async () => {
        // first gather lists of songs to be added & removed,
        // use confirm() to ask the user if they want to proceed,
        // then perform the operations and report the results to the console & snackbar.
        const setlist = await getClipboardSongList();
        if (!setlist) {
            snackbar.showError("Clipboard does not contain a valid setlist");
            return;
        }
        const existing = new Set<number>(
            props.doc.payload.rows
                .filter((r) => r.type === "song")
                .map((r) => r.songId!)
        );
        const incoming = new Set<number>(
            setlist
                .filter((item) => item.type === "song")
                .map((item) => item.song.id)
        );
        const toAdd = [...incoming].filter((id) => !existing.has(id));
        const toRemove = [...existing].filter((id) => !incoming.has(id));

        if (!toAdd.length && !toRemove.length) {
            snackbar.showSuccess("Already synced with the setlist. No changes.");
            setAnchorEl(null);
            return;
        }

        console.log(toAdd);
        console.log(toRemove);

        const toAddComponents = toAdd.map((id) => <CMChip>{allSongs.find((s) => s.id === id)!.name}</CMChip>);
        const toRemoveComponents = toRemove.map((id) => <CMChip>{allSongs.find((s) => s.id === id)!.name}</CMChip>);

        if (await confirm({
            title: "Sync with clipboard setlist", description: <div>
                <div>{toAdd.length ? `Add: ${toAdd.length}` : null}</div>
                <div>{toAddComponents}</div>
                <div>{toRemove.length ? `Remove: ${toRemove.length}` : null}</div>
                <div>{toRemoveComponents}</div>
            </div>
        })) {
            props.mutator.addAndRemoveSongs(toAdd, toRemove);
            //if (toRemove.length) props.mutator.removeSongs(toRemove);
            snackbar.showSuccess(`Synced: ${toAdd.length} added, ${toRemove.length} removed`);
            setAnchorEl(null);
        }

    };

    return <>
        <CMSmallButton className='DotMenu' onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>{gCharMap.VerticalEllipses()}</CMSmallButton>
        <Menu
            id="menu-setlistplannermain"
            anchorEl={anchorEl}
            keepMounted
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            <MenuItem
                onClick={handleCopyToClipboard}
            >
                Copy plan to clipboard
            </MenuItem>
            <MenuItem
                onClick={handlePasteFromClipboard}
            >
                Paste plan from clipboard
            </MenuItem>
            <MenuItem onClick={handleAddSongsFromClipboardSetlist}>
                Add songs from copied setlist
            </MenuItem>
            <MenuItem onClick={handleSyncWithClipboardSetlist}>
                Sync (add & remove) songs with clipboard setlist
            </MenuItem>
        </Menu >
    </>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDocumentEditorProps = {
    isModified: boolean;
    initialValue: SetlistPlan;
    mutator: SetlistPlanMutator;
    colorScheme: SetlistPlannerColorScheme;
    onSave: (doc: SetlistPlan) => void;
    onCancel: () => void;
    onDelete: () => void;
};

type TTabId = "plan" | "segments" | "songs" | "matrix";

const SetlistPlannerDocumentEditor = (props: SetlistPlannerDocumentEditorProps) => {
    const [doc, setDoc] = React.useState<SetlistPlan>(props.initialValue);
    const [selectedTab, setSelectedTab] = React.useState<TTabId>("matrix");
    const allSongs = useSongsContext().songs;
    const snackbar = useSnackbar();
    const confirm = useConfirm();
    const [stats, setStats] = React.useState<SetlistPlanStats>(() => CalculateSetlistPlanStats(doc, allSongs));
    React.useEffect(() => {
        setDoc(props.initialValue);
    }, [props.initialValue]);

    React.useEffect(() => {
        setStats(CalculateSetlistPlanStats(doc, allSongs));
    }, [doc]);

    return <div className="SetlistPlannerDocumentEditor">
        <div className="toolbar">
            <ButtonGroup>
                <Button
                    startIcon={gIconMap.Save()}
                    onClick={() => {
                        props.onSave(doc);
                    }}
                    disabled={!props.isModified}
                >
                    Save
                </Button>
                <Button startIcon={gIconMap.Cancel()} onClick={() => {
                    props.onCancel();
                }}>Cancel</Button>
                <Button
                    startIcon={gIconMap.Delete()}
                    onClick={() => {
                        props.onDelete();
                    }}
                    disabled={doc.id < 0}
                >
                    Delete
                </Button>
            </ButtonGroup>
            <MainDropdownMenu doc={doc} mutator={props.mutator} />
            <InspectObject src={doc} label="doc" />
            <InspectObject src={stats} label="stats" />
            <div className="nameHeader">{doc.name}</div>
        </div>
        <CMTabPanel
            className="SetlistPlannerDocumentEditorTabPanel"
            handleTabChange={(x, newId) => setSelectedTab(newId as TTabId || "matrix")}
            selectedTabId={selectedTab}
        >
            <CMTab thisTabId="plan" summaryTitle={"plan"}>
                <CMTextInputBase
                    className="name"
                    value={doc.name}
                    onChange={(e, newName) => {
                        props.mutator.setName(newName);
                    }}
                />
                <Markdown3Editor
                    onChange={(newMarkdown) => {
                        props.mutator.setDescription(newMarkdown);
                    }}
                    value={doc.description}
                    minHeight={75}
                //beginInPreview={true}
                />
            </CMTab>

            <CMTab thisTabId="segments" summaryTitle={"segments"}>

                <div className="SetlistPlannerDocumentEditorSegments">
                    {doc.payload.columns.map((segment) => {
                        return <div key={segment.columnId} className="SetlistPlannerDocumentEditorSegment">
                            <CMTextInputBase
                                className="segmentName"
                                value={segment.name}
                                onChange={(e, newName) => {
                                    props.mutator.setColumnName(segment.columnId, newName);
                                }}
                            />
                            <NumberField
                                value={segment.pointsAvailable || null}
                                onChange={(e, newTotal) => {
                                    props.mutator.setColumnAvailablePoints(segment.columnId, newTotal || undefined);
                                }} />
                            <Markdown3Editor
                                onChange={(newMarkdown) => {
                                    props.mutator.setColumnComment(segment.columnId, newMarkdown);
                                }}
                                value={segment.commentMarkdown || ""}
                            //beginInPreview={true}
                            />
                            <Button startIcon={gIconMap.Delete()} onClick={() => {
                                props.mutator.deleteColumn(segment.columnId);
                            }}
                            ></Button>
                        </div>
                    })}
                </div>

                <Button startIcon={gIconMap.Add()} onClick={() => {
                    props.mutator.addColumn();
                }}>Add Segment</Button>

            </CMTab>
            <CMTab thisTabId="songs" summaryTitle={"Rows"}>
                <div className="SetlistPlannerDocumentEditorSongs">
                    {doc.payload.rows.map((song) => {
                        return <div key={song.rowId} className="SetlistPlannerDocumentEditorSong">
                            <div style={{ display: "flex", alignItems: "center" }}>
                                <div className="type">{song.type}</div>
                                <ColorPick
                                    value={song.color || null}

                                    onChange={(newColor) => {
                                        props.mutator.setRowColor(song.rowId, newColor?.id || undefined);
                                    }}
                                />
                                <Button startIcon={gIconMap.Delete()} onClick={() => {
                                    props.mutator.deleteRow(song.rowId);
                                }}
                                ></Button>
                            </div>

                            {song.type === "song" && <>
                                <div className="name">{allSongs.find((x) => x.id === song.songId)?.name}</div>
                                <NumberField
                                    value={song.pointsRequired || null}
                                    onChange={(e, newMeasure) => {
                                        props.mutator.setRowPointsRequired(song.rowId, newMeasure || undefined);
                                    }}
                                />
                                <span>rehearsal points required</span>
                            </>}
                            <Markdown3Editor
                                minHeight={75}
                                onChange={(newMarkdown) => {
                                    props.mutator.setRowComment(song.rowId, newMarkdown);
                                }}
                                value={song.commentMarkdown || ""}
                            //beginInPreview={true}
                            />
                        </div>
                    })}
                </div>

                <div className="SetlistPlannerDocumentEditorAddSong">
                    Add a song...
                    <SongAutocomplete
                        value={null}
                        onChange={(newSong) => {
                            if (newSong) {
                                props.mutator.addSong(newSong.id);
                            }
                        }}
                    />

                    <Button startIcon={gIconMap.Add()} onClick={() => {
                        props.mutator.addDivider();
                    }}>Add Divider</Button>
                </div>

            </CMTab>
            <CMTab thisTabId="matrix" summaryTitle={"Matrix"}>
                <SetlistPlannerMatrix
                    stats={stats!}
                    colorScheme={props.colorScheme}
                    doc={doc}
                    mutator={props.mutator}
                />
            </CMTab>
        </CMTabPanel>
    </div>
};

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

const SetlistPlannerColorSchemeEditor = (props: SetlistPlannerColorSchemeEditorProps) => {
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


//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDocumentOverviewProps = {
    onSelect: (doc: SetlistPlan) => void;
};

const SetlistPlannerDocumentOverview = (props: SetlistPlannerDocumentOverviewProps) => {
    const dashboardContext = useDashboardContext();
    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;

    const [plans, { refetch }] = useQuery(getSetlistPlans, { userId: dashboardContext.currentUser.id });

    return <div className="SetlistPlannerDocumentOverviewList">
        {plans.map((dbPlan) => {
            return <div
                key={dbPlan.id}
                className="SetlistPlannerDocumentOverviewItem"
                onClick={() => {
                    props.onSelect(dbPlan);
                }}
            >
                <div className="name">{dbPlan.name}</div>
                <Markdown markdown={dbPlan.description} />
            </div>
        })}
    </div>;
};


//////////////////////////////////////////////////////////////////////////////////////////////////
const SetlistPlannerPageContent = () => {
    const dashboardContext = useDashboardContext();
    const snackbar = useSnackbar();
    const [upsertSetlistPlanToken] = useMutation(upsertSetlistPlan);
    const [deleteSetlistPlanToken] = useMutation(deleteSetlistPlan);
    const [showColorSchemeEditor, setShowColorSchemeEditor] = React.useState(false);
    const confirm = useConfirm();

    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;
    const [doc, setDoc] = React.useState<SetlistPlan | null>(null);
    const [modified, setModified] = React.useState(false);

    const [colorScheme, setColorScheme] = React.useState<SetlistPlannerColorScheme>(gDefaultColors);

    const mutator = React.useMemo(() => {
        const ret: SetlistPlanMutator = {
            setDoc: (newDoc: SetlistPlan) => {
                // do not clobber the existing document's id.
                setDoc({ ...newDoc, id: doc?.id || getUniqueNegativeID() });
                //setDoc(newDoc);
                setModified(true);
            },
            setName: (name: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        name,
                    });
                }
            },
            setDescription: (description: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        description,
                    });
                }
            },
            addSong: (songId: number) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, {
                                rowId: nanoid(),
                                songId,
                                commentMarkdown: "",
                                type: "song",
                                pointsRequired: 0,
                            }],
                        },
                    });
                }
            },
            // addSongs: (songIds: number[]) => {
            //     if (doc) {
            //         setModified(true);
            //         const newRows: SetlistPlanRow[] = songIds.map(songId => ({
            //             rowId: nanoid(),
            //             songId,
            //             commentMarkdown: "",
            //             type: "song",
            //             pointsRequired: 0,
            //         }));
            //         setDoc({
            //             ...doc,
            //             payload: {
            //                 ...doc.payload,
            //                 rows: [...doc.payload.rows, ...newRows],
            //             },
            //         });
            //     }
            // },
            addAndRemoveSongs: (add: number[], remove: number[]) => {
                if (doc) {
                    setModified(true);
                    const newRows: SetlistPlanRow[] = add.map(songId => ({
                        rowId: nanoid(),
                        songId,
                        commentMarkdown: "",
                        type: "song",
                        pointsRequired: 0,
                    }));
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, ...newRows].filter((x) => !remove.includes(x.songId!)),
                        },
                    });
                }
            },
            addDivider: () => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: [...doc.payload.rows, {
                                rowId: nanoid(),
                                type: "divider",
                            }],
                        },
                    });
                }
            },
            deleteRow: (rowId: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.filter((x) => x.rowId !== rowId),
                        },
                    });
                }
            },
            // removeSongs: (songIds: number[]) => {
            //     if (doc) {
            //         setModified(true);
            //         setDoc({
            //             ...doc,
            //             payload: {
            //                 ...doc.payload,
            //                 rows: doc.payload.rows.filter((x) => x.type === "divider" || !songIds.includes(x.songId!)),
            //             },
            //         });
            //     }
            // },
            setRowPointsRequired: (rowId: string, measure: number | undefined) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.map((x) => {
                                if (x.rowId === rowId) {
                                    return {
                                        ...x,
                                        pointsRequired: measure,
                                        //measureRequired: measure,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setRowComment: (rowId: string, comment: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.map((x) => {
                                if (x.rowId === rowId) {
                                    return {
                                        ...x,
                                        commentMarkdown: comment,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            addColumn: () => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: [...doc.payload.columns, {
                                columnId: nanoid(),
                                pointsAvailable: 0,
                                name: `New Segment ${nanoid(3)}`,
                                commentMarkdown: "",
                            }],
                        },
                    });
                }
            },
            deleteColumn: (columnId: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.filter((x) => x.columnId !== columnId),
                        },
                    });
                }
            },
            setColumnName: (columnId: string, name: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        name,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setColumnComment: (columnId: string, comment: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        commentMarkdown: comment,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setCellPoints: (rowId: string, columnId: string, measure: number | undefined) => {
                if (doc) {
                    setModified(true);
                    const exists = doc.payload.cells.find((x) => x.columnId === columnId && x.rowId === rowId);
                    const newSegmentSongs: SetlistPlanCell[] = doc.payload.cells.map((x) => {
                        if (x.columnId === columnId && x.rowId === rowId) {
                            return {
                                ...x,
                                //measureUsage: measure,
                                pointsAllocated: measure,
                            };
                        }
                        return x;
                    });

                    // if there's no entry in segmentSongs yet, create one.
                    if (!exists) {
                        newSegmentSongs.push({
                            columnId,
                            rowId,
                            pointsAllocated: measure,
                            commentMarkdown: "",
                        });
                    }

                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: newSegmentSongs,
                        },
                    });
                }
            },
            setColumnAvailablePoints: (columnId: string, total: number | undefined) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            columns: doc.payload.columns.map((x) => {
                                if (x.columnId === columnId) {
                                    return {
                                        ...x,
                                        pointsAvailable: total,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            reorderRows: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    setModified(true);
                    // removedIndex is the previous index; the original item to be moved
                    // addedIndex is the new index where it should be moved to.
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    const newSongs = moveItemInArray(doc.payload.rows, args.removedIndex, args.addedIndex);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: newSongs,
                        },
                    });
                }
            },
            setRowColor: (rowId: string, color: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            rows: doc.payload.rows.map((x) => {
                                if (x.rowId === rowId) {
                                    return {
                                        ...x,
                                        color,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            clearColumnAllocation: (columnId: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: doc.payload.cells.filter((x) => x.columnId !== columnId),
                        },
                    });
                }
            },
            swapColumnAllocation: (columnId: string, otherColumnId: string) => {
                if (doc) {
                    setModified(true);
                    //const columnSongs = doc.payload.cells.filter((x) => x.columnId === columnId);
                    //const otherColumnSongs = doc.payload.cells.filter((x) => x.columnId === otherColumnId);
                    const newCells = doc.payload.cells.map((x) => {
                        if (x.columnId === columnId) {
                            return {
                                ...x,
                                columnId: otherColumnId,
                            };
                        }
                        if (x.columnId === otherColumnId) {
                            return {
                                ...x,
                                columnId: columnId,
                            };
                        }
                        return x;
                    });
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            cells: newCells,
                        },
                    });
                }
            },
        };
        return ret;
    }, [doc]);



    return <div className="SetlistPlannerPageContent">
        {doc ? <SetlistPlannerDocumentEditor
            initialValue={doc}
            mutator={mutator}
            colorScheme={colorScheme}
            isModified={modified}
            onSave={async (doc) => {
                snackbar.invokeAsync(async () => {
                    const newDoc = await upsertSetlistPlanToken(doc);
                    // because PKs change
                    setDoc(newDoc);
                    setModified(false);
                },
                    "Setlist plan saved",
                    "Error saving setlist plan",
                );
            }}
            onCancel={() => {
                setModified(false);
                setDoc(null);
            }}
            onDelete={async () => {
                if (await confirm({ title: "Are you sure you want to delete this setlist plan?" })) {
                    snackbar.invokeAsync(async () => {
                        await deleteSetlistPlanToken({ id: doc.id });
                        setModified(false);
                        setDoc(null);
                    },
                        "Setlist plan deleted",
                        "Error deleting setlist plan",
                    );
                }
            }}
        /> : <div>
            <SetlistPlannerDocumentOverview onSelect={(doc) => {
                setModified(false);
                setDoc(doc);
            }}
            />
            <Button onClick={() => {
                setModified(true);
                setDoc(CreateNewSetlistPlan(getUniqueNegativeID(), `Setlist plan ${nanoid(3)}`, dashboardContext.currentUser!.id));
            }}>Create New Plan</Button>
        </div>
        }

        <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <FormControlLabel control={<Switch checked={showColorSchemeEditor} onChange={(e) => setShowColorSchemeEditor(e.target.checked)} />} label="Edit Color Scheme" />
            {showColorSchemeEditor &&
                <SetlistPlannerColorSchemeEditor value={colorScheme} onChange={(newScheme) => setColorScheme(newScheme)} />
            }
        </div>
    </div>
};

const SetlistPlannerPage: BlitzPage = (props) => {
    return (
        <DashboardLayout title="Setlist Planner" basePermission={Permission.sysadmin}>
            <SongsProvider>
                <SetlistPlannerPageContent />
            </SongsProvider>
        </DashboardLayout>
    )
}

export default SetlistPlannerPage;
