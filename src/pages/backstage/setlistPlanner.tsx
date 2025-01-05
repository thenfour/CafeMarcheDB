import { BlitzPage } from "@blitzjs/next";
import { useMutation, useQuery } from "@blitzjs/rpc";
import { Button, ButtonGroup, Tooltip } from "@mui/material";
import { nanoid } from "nanoid";
import React from "react";
import { Permission } from "shared/permissions";
import { Clamp, clamp01, getUniqueNegativeID, lerp, moveItemInArray } from "shared/utils";
import { CMStandardDBChip } from "src/core/components/CMChip";
import { InspectObject } from "src/core/components/CMCoreComponents";
import { KeyValueTable } from "src/core/components/CMCoreComponents2";
import { CMNumericTextField, CMTextInputBase } from "src/core/components/CMTextField";
import { useConfirm } from "src/core/components/ConfirmationDialog";
import { useDashboardContext } from "src/core/components/DashboardContext";
import { Markdown3Editor } from "src/core/components/MarkdownControl3";
import { Markdown } from "src/core/components/RichTextEditor";
import { useSnackbar } from "src/core/components/SnackbarContext";
import { SongAutocomplete } from "src/core/components/SongAutocomplete";
import { SongsProvider, useSongsContext } from "src/core/components/SongsContext";
import { CMTab, CMTabPanel } from "src/core/components/TabPanel";
import { gIconMap } from "src/core/db3/components/IconMap";
import deleteSetlistPlan from "src/core/db3/mutations/deleteSetlistPlan";
import upsertSetlistPlan from "src/core/db3/mutations/upsertSetlistPlan";
import getSetlistPlans from "src/core/db3/queries/getSetlistPlans";
import { CreateNewSetlistPlan, SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { ReactSmoothDndContainer, ReactSmoothDndDraggable } from "src/core/components/CMCoreComponents";
import * as ReactSmoothDnd from "react-smooth-dnd";

type Gradient = [string, string];

const gColors: {
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
} = {
    // Light orange -> orange
    songRequiredPoints: ["#ff8", "#f90"],

    // Light green -> green
    songSegmentPoints: ["#dfd", "#4a4"],
    // Light blue -> blue
    songTotalPoints: ["#8df", "#49f"],
    // Lighter green -> green
    songPointBalancePositive: ["#4a4", "#dfd"],
    // red -> Light red (negative gradients go opposite)
    songPointBalanceNegative: ["#f44", "#eaa"],

    // Light orange -> orange
    segmentPoints: ["#fe7", "#f90"],

    // Light green -> green
    segmentBalancePositive: ["#dfd", "#4a4"],
    // red -> Light red (negative gradients go opposite)
    segmentBalanceNegative: ["#f44336", "#ef9a9a"],

    // Light purple -> purple
    segmentPointsAvailable: ["#f3e5f5", "#9c27b0"],

    // Solid greens and reds
    totalSongBalancePositive: "#4caf50",
    totalSongBalanceNegative: "#f44336",
};

interface SetlistPlanMutator {
    setName: (name: string) => void;
    setDescription: (description: string) => void;

    addSong: (songId: number) => void;
    deleteSong: (songId: number) => void;
    setSongMeasureRequired: (songId: number, measure: number | undefined) => void;
    setSongComment: (songId: number, comment: string) => void;
    reorderSongs: (args: ReactSmoothDnd.DropResult) => void;

    addSegment: () => void;
    deleteSegment: (segmentId: number) => void;
    setSegmentName: (segmentId: number, name: string) => void;
    setSegmentComment: (segmentId: number, comment: string) => void;
    setSegmentMeasureTotal: (segmentId: number, total: number | undefined) => void;

    setSongSegmentMeasure: (songId: number, segmentId: number, measure: number | undefined) => void;
}

interface SetlistPlanStats {
    totalPointsRequired: number;
    totalPointsUsed: number;
    totalPlanSongBalance: number;
    totalPlanSegmentBalance: number;
    songsPerSegment: number;
    songStats: {
        songId: number;
        requiredPoints: number | undefined;
        totalRehearsalPoints: number;
        balance: number | undefined;
    }[];
    segmentStats: {
        segmentId: number;
        totalPoints: number;
        balance: number;
    }[];
};

function CalculateSetlistPlanStats(doc: SetlistPlan): SetlistPlanStats {
    const totalPointsRequired = doc.payload.songs.reduce((acc, song) => song.measureRequired ? acc + song.measureRequired : acc, 0);
    const totalPointsUsed = doc.payload.segmentSongs.reduce((acc, x) => acc + (x.measureUsage || 0), 0);
    const totalPlanBalance = totalPointsUsed - totalPointsRequired;
    const songsPerSegment = doc.payload.segmentSongs.filter(ss => !!ss.measureUsage).length / doc.payload.segments.length;

    const songStats = doc.payload.songs.map(song => {
        const segMeasures = doc.payload.segmentSongs.filter((x) => x.songId === song.songId && !!x.measureUsage);
        const totalRehearsalPoints = segMeasures.reduce((acc, x) => acc + x.measureUsage!, 0);
        const balance = song.measureRequired ? totalRehearsalPoints - song.measureRequired : undefined;
        return {
            songId: song.songId,
            requiredPoints: song.measureRequired,
            totalRehearsalPoints,
            balance,
        };
    });

    const segmentStats = doc.payload.segments.map(segment => {
        const segmentMeasureTotal = segment.measureTotal || 0;
        const segmentMeasureUsed = doc.payload.segmentSongs.filter((x) => x.segmentId === segment.segmentId && !!x.measureUsage).reduce((acc, x) => acc + x.measureUsage!, 0);
        const balance = segmentMeasureTotal - segmentMeasureUsed;
        return {
            segmentId: segment.segmentId,
            totalPoints: segmentMeasureUsed,
            balance,
        };
    });

    return {
        totalPointsRequired,
        totalPointsUsed,
        totalPlanSegmentBalance: segmentStats.reduce((acc, x) => acc + x.balance, 0),
        totalPlanSongBalance: totalPlanBalance,
        songsPerSegment,
        songStats,
        segmentStats,
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
type SetlistPlannerMatrixRowProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    songId: number;
    stats: SetlistPlanStats;
};

const SetlistPlannerMatrixRow = (props: SetlistPlannerMatrixRowProps) => {
    const allSongs = useSongsContext().songs;
    let songStats = props.stats.songStats.find((x) => x.songId === props.songId);
    if (!songStats) {
        // in intermediate contexts this can happen; use an empty stat object
        songStats = {
            songId: props.songId,
            requiredPoints: 0,
            totalRehearsalPoints: 0,
            balance: 0,
        };
    };

    const maxSongBalance = props.stats.songStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.max(x.balance, acc);
    }, 0);

    const minSongBalance = props.stats.songStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.min(x.balance, acc);
    }, maxSongBalance);

    const maxSongRequiredPoints = props.stats.songStats.reduce((acc, x) => {
        if (x.requiredPoints == null) return acc;
        return Math.max(x.requiredPoints, acc);
    }, 0);

    const minSongRequiredPoints = props.stats.songStats.reduce((acc, x) => {
        if (x.requiredPoints == null) return acc;
        return Math.min(x.requiredPoints, acc);
    }, maxSongRequiredPoints);

    const maxSongTotalPoints = props.stats.songStats.reduce((acc, x) => {
        if (x.totalRehearsalPoints == null) return acc;
        return Math.max(x.totalRehearsalPoints, acc);
    }, 0);

    const minSongTotalPoints = props.stats.songStats.reduce((acc, x) => {
        if (x.totalRehearsalPoints == null) return acc;
        return Math.min(x.totalRehearsalPoints, acc);
    }, maxSongTotalPoints);


    // if balance is negative, use a gradient.
    // if balance is 0 or positive, use a solid green.
    let balanceColor = "transparent";
    if (songStats.balance != null && songStats.balance < 0) {
        balanceColor = LerpColor(songStats.balance, minSongBalance, 0, gColors.songPointBalanceNegative);
    } else if (songStats.balance != null && songStats.balance >= 0) {
        balanceColor = LerpColor(songStats.balance, maxSongBalance, 0, gColors.songPointBalancePositive);
    }

    const song = allSongs.find((x) => x.id === props.songId)!;

    return <div className="tr">
        <div className="td songName">

            <div className="dragHandle draggable">
                ☰
            </div>

            <Tooltip title={`Amount of rehearsal points this song needs`} disableInteractive>
                <div className="numberCell" style={{ backgroundColor: LerpColor(songStats.requiredPoints, minSongRequiredPoints, maxSongRequiredPoints, gColors.songRequiredPoints) }}>
                    <NumberField
                        value={songStats.requiredPoints || null}
                        onChange={(e, newValue) => { props.mutator.setSongMeasureRequired(props.songId, newValue || undefined) }}
                    />
                </div>
            </Tooltip>
            <div>{song.name}</div>
        </div>
        {props.doc.payload.segments.map((segment, index) => {
            // if no measureUsage, use transparent color
            // otherwise 
            const measureUsage = props.doc.payload.segmentSongs.find((x) => x.segmentId === segment.segmentId && x.songId === props.songId)?.measureUsage;
            const bgColor = measureUsage ? LerpColor(
                measureUsage,
                0,
                maxSongTotalPoints,
                gColors.songSegmentPoints
            ) : "white";
            return <div key={index} className="td segment numberCell" style={{ backgroundColor: bgColor }}>
                <NumberField
                    value={measureUsage || null}
                    onChange={(e, newValue) => {
                        props.mutator.setSongSegmentMeasure(props.songId, segment.segmentId, newValue || undefined);
                    }}
                />
            </div>;
        })}
        <Tooltip title={`Total points this song will be rehearsed`} disableInteractive>
            <div className="td rehearsalTime numberCell" style={{ backgroundColor: LerpColor(songStats.totalRehearsalPoints, minSongTotalPoints, maxSongTotalPoints, gColors.songTotalPoints) }}>
                <NumberField inert value={songStats.totalRehearsalPoints} />
            </div>
        </Tooltip>
        <Tooltip title={`Rehearsal points remaining to finish rehearsing this song. ${(songStats.balance || 0) >= 0 ? `You have allocated enough time to rehearse this song` : `You need to allocate ${-(songStats.balance || 0)} more points to finish rehearsing ${song.name}`}`} disableInteractive>
            <div className={`td balance numberCell`} style={{ backgroundColor: balanceColor }}>
                <NumberField inert value={songStats.balance || null} showPositiveSign />
            </div>
        </Tooltip>
    </div>;
}



//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerMatrixProps = {
    doc: SetlistPlan;
    mutator: SetlistPlanMutator;
    stats: SetlistPlanStats;
};

const SetlistPlannerMatrix = (props: SetlistPlannerMatrixProps) => {

    const onDrop = (args: ReactSmoothDnd.DropResult) => {
        props.mutator.reorderSongs(args);
    };

    const maxSegmentPointsAvailable = props.doc.payload.segments.reduce((acc, x) => {
        if (x.measureTotal == null) return acc;
        return acc + x.measureTotal;
    }, 0);

    const maxSegPointsUsed = props.stats.segmentStats.reduce((acc, x) => {
        if (x.totalPoints == null) return acc;
        return Math.max(x.totalPoints, acc);
    }, 0);

    const minSegPointsUsed = props.stats.segmentStats.reduce((acc, x) => {
        if (x.totalPoints == null) return acc;
        return Math.min(x.totalPoints, acc);
    }, maxSegPointsUsed);

    const maxSegmentBalance = props.stats.segmentStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.max(x.balance, acc);
    }, 0);

    const minSegmentBalance = props.stats.segmentStats.reduce((acc, x) => {
        if (x.balance == null) return acc;
        return Math.min(x.balance, acc);
    }, maxSegmentBalance);

    return <div className="SetlistPlannerMatrix">
        <div className="tr header">
            <div className="td songName"></div>
            {props.doc.payload.segments.map((segment, index) => <div key={index} className="td segment">
                <div>{segment.name}</div>
                <div className="numberCell" style={{ backgroundColor: LerpColor(segment.measureTotal, 0, maxSegmentPointsAvailable, gColors.segmentPointsAvailable) }}>
                    <NumberField
                        value={segment.measureTotal || null}
                        onChange={(e, newValue) => {
                            props.mutator.setSegmentMeasureTotal(segment.segmentId, newValue || undefined);
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
                {props.doc.payload.songs.map((song, index) => <ReactSmoothDndDraggable key={index}>
                    <SetlistPlannerMatrixRow
                        mutator={props.mutator}
                        stats={props.stats}
                        key={index}
                        doc={props.doc}
                        songId={song.songId}
                    />
                </ReactSmoothDndDraggable>
                )}
            </ReactSmoothDndContainer>
        </div>

        <div className="footerContainer">
            <div className="tr footer">
                <Tooltip disableInteractive title={`Total required rehearsal points for all songs`}>
                    <div className="td songName numberCell">
                        <NumberField inert value={props.stats.totalPointsRequired} style={{ backgroundColor: gColors.songRequiredPoints[1] }} />
                    </div>
                </Tooltip>
                {props.doc.payload.segments.map((segment, index) => {
                    const segStats = props.stats.segmentStats.find((x) => x.segmentId === segment.segmentId)!;
                    const bgColor = LerpColor(segStats.totalPoints, minSegPointsUsed, maxSegPointsUsed, gColors.segmentPoints);
                    return <Tooltip key={index} disableInteractive title={`Total rehearsal points you've allocated for ${segment.name}`}>
                        <div key={index} className="td segment numberCell" style={{ backgroundColor: bgColor }}>
                            <NumberField inert value={segStats.totalPoints} />
                        </div>
                    </Tooltip>;
                })}
                <Tooltip disableInteractive title={`total rehearsal points allocated for the whole plan`}>
                    <div className="td rehearsalTime numberCell" style={{ backgroundColor: gColors.songTotalPoints[1] }}>
                        <NumberField inert value={props.stats.totalPointsUsed} />
                    </div>
                </Tooltip>
                <Tooltip disableInteractive title={`total song balance for the whole plan. ${props.stats.totalPlanSongBalance >= 0 ? `you have allocated enough to rehearse all songs fully` : `you need to allocate ${Math.abs(props.stats.totalPlanSongBalance)} more points to rehearse all songs`}`}>
                    <div className="td balance numberCell totalPlanBalance" style={{ backgroundColor: props.stats.totalPlanSongBalance >= 0 ? gColors.totalSongBalancePositive : gColors.totalSongBalanceNegative }}>
                        <NumberField inert value={props.stats.totalPlanSongBalance} showPositiveSign />
                    </div>
                </Tooltip>
            </div>

            <div className="tr footer">
                <div className="td songName"></div>
                {props.doc.payload.segments.map((segment, index) => {
                    const segStats = props.stats.segmentStats.find((x) => x.segmentId === segment.segmentId)!;
                    const balanceColor = segStats.balance >= 0 ?
                        LerpColor(segStats.balance, 0, maxSegmentBalance, gColors.segmentBalancePositive)
                        : LerpColor(segStats.balance, minSegmentBalance, 0, gColors.segmentBalanceNegative);
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
                    <div className="td rehearsalTime" style={{ backgroundColor: props.stats.totalPlanSegmentBalance >= 0 ? gColors.segmentBalancePositive[1] : gColors.segmentBalanceNegative[0] }}>
                        <NumberField inert value={props.stats.totalPlanSegmentBalance} showPositiveSign />
                    </div>
                </Tooltip>
                <div className="td balance"></div>
            </div>
        </div >

        <KeyValueTable
            data={{
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
        </div>

    </div >;
}

//////////////////////////////////////////////////////////////////////////////////////////////////
type SetlistPlannerDocumentEditorProps = {
    isModified: boolean;
    initialValue: SetlistPlan;
    mutator: SetlistPlanMutator;
    onSave: (doc: SetlistPlan) => void;
    onCancel: () => void;
    onDelete: () => void;
};

type TTabId = "plan" | "segments" | "songs" | "matrix";

const SetlistPlannerDocumentEditor = (props: SetlistPlannerDocumentEditorProps) => {
    const [doc, setDoc] = React.useState<SetlistPlan>(props.initialValue);
    const [selectedTab, setSelectedTab] = React.useState<TTabId>("matrix");
    const [stats, setStats] = React.useState<SetlistPlanStats>(() => CalculateSetlistPlanStats(doc));
    const allSongs = useSongsContext().songs;
    React.useEffect(() => {
        setDoc(props.initialValue);
    }, [props.initialValue]);

    React.useEffect(() => {
        setStats(CalculateSetlistPlanStats(doc));
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
            <InspectObject src={doc} />
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
                    beginInPreview={true}
                />
            </CMTab>

            <CMTab thisTabId="segments" summaryTitle={"segments"}>

                <div className="SetlistPlannerDocumentEditorSegments">
                    {doc.payload.segments.map((segment) => {
                        return <div key={segment.segmentId} className="SetlistPlannerDocumentEditorSegment">
                            <CMTextInputBase
                                className="segmentName"
                                value={segment.name}
                                onChange={(e, newName) => {
                                    props.mutator.setSegmentName(segment.segmentId, newName);
                                }}
                            />
                            <NumberField
                                value={segment.measureTotal || null}
                                onChange={(e, newTotal) => {
                                    props.mutator.setSegmentMeasureTotal(segment.segmentId, newTotal || undefined);
                                }} />
                            <Markdown3Editor
                                onChange={(newMarkdown) => {
                                    props.mutator.setSegmentComment(segment.segmentId, newMarkdown);
                                }}
                                value={segment.commentMarkdown || ""}
                                beginInPreview={true}
                            />
                            <Button startIcon={gIconMap.Delete()} onClick={() => {
                                props.mutator.deleteSegment(segment.segmentId);
                            }}
                            ></Button>
                        </div>
                    })}
                </div>

                <Button startIcon={gIconMap.Add()} onClick={() => {
                    props.mutator.addSegment();
                }}>Add Segment</Button>

            </CMTab>
            <CMTab thisTabId="songs" summaryTitle={"songs"}>
                <div className="SetlistPlannerDocumentEditorSongs">
                    {doc.payload.songs.map((song) => {
                        return <div key={song.songId} className="SetlistPlannerDocumentEditorSong">
                            <div className="name">{allSongs.find((x) => x.id === song.songId)?.name}</div>
                            <NumberField
                                value={song.measureRequired || null}
                                onChange={(e, newMeasure) => {
                                    props.mutator.setSongMeasureRequired(song.songId, newMeasure || undefined);
                                }}
                            />
                            <Markdown3Editor
                                onChange={(newMarkdown) => {
                                    props.mutator.setSongComment(song.songId, newMarkdown);
                                }}
                                value={song.commentMarkdown || ""}
                                beginInPreview={true}
                            />
                            <Button startIcon={gIconMap.Delete()} onClick={() => {
                                props.mutator.deleteSong(song.songId);
                            }}
                            ></Button>
                        </div>
                    })}
                </div>

                <div className="SetlistPlannerDocumentEditorAddSong">
                    Add...
                    <SongAutocomplete
                        value={null}
                        onChange={(newSong) => {
                            if (newSong) {
                                props.mutator.addSong(newSong.id);
                            }
                        }}
                    />
                </div>

            </CMTab>
            <CMTab thisTabId="matrix" summaryTitle={"Matrix"}>
                <SetlistPlannerMatrix
                    stats={stats!}
                    doc={doc}
                    mutator={props.mutator}
                />
            </CMTab>
        </CMTabPanel>
    </div>
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
    const confirm = useConfirm();

    if (!dashboardContext.currentUser) return <div>you must be logged in to use this feature</div>;
    const [doc, setDoc] = React.useState<SetlistPlan | null>(null);
    const [modified, setModified] = React.useState(false);

    const mutator = React.useMemo(() => {
        const ret: SetlistPlanMutator = {
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
                            songs: [...doc.payload.songs, {
                                songId,
                                measureRequired: 0,
                                commentMarkdown: "",
                            }],
                        },
                    });
                }
            },
            deleteSong: (songId: number) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: doc.payload.songs.filter((x) => x.songId !== songId),
                        },
                    });
                }
            },
            setSongMeasureRequired: (songId: number, measure: number | undefined) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: doc.payload.songs.map((x) => {
                                if (x.songId === songId) {
                                    return {
                                        ...x,
                                        measureRequired: measure,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            setSongComment: (songId: number, comment: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: doc.payload.songs.map((x) => {
                                if (x.songId === songId) {
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
            addSegment: () => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: [...doc.payload.segments, {
                                segmentId: doc.payload.segments.length + 1,
                                measureTotal: 0,
                                name: `New Segment ${nanoid(3)}`,
                                commentMarkdown: "",
                            }],
                        },
                    });
                }
            },
            deleteSegment: (segmentId: number) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.filter((x) => x.segmentId !== segmentId),
                        },
                    });
                }
            },
            setSegmentName: (segmentId: number, name: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.map((x) => {
                                if (x.segmentId === segmentId) {
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
            setSegmentComment: (segmentId: number, comment: string) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.map((x) => {
                                if (x.segmentId === segmentId) {
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
            setSongSegmentMeasure: (songId: number, segmentId: number, measure: number | undefined) => {
                if (doc) {
                    setModified(true);
                    const exists = doc.payload.segmentSongs.find((x) => x.segmentId === segmentId && x.songId === songId);
                    const newSegmentSongs = doc.payload.segmentSongs.map((x) => {
                        if (x.segmentId === segmentId && x.songId === songId) {
                            return {
                                ...x,
                                measureUsage: measure,
                            };
                        }
                        return x;
                    });

                    // if there's no entry in segmentSongs yet, create one.
                    if (!exists) {
                        newSegmentSongs.push({
                            segmentId,
                            songId,
                            measureUsage: measure,
                            commentMarkdown: "",
                        });
                    }

                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segmentSongs: newSegmentSongs,
                        },
                    });
                }
            },
            setSegmentMeasureTotal: (segmentId: number, total: number | undefined) => {
                if (doc) {
                    setModified(true);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            segments: doc.payload.segments.map((x) => {
                                if (x.segmentId === segmentId) {
                                    return {
                                        ...x,
                                        measureTotal: total,
                                    };
                                }
                                return x;
                            }),
                        },
                    });
                }
            },
            reorderSongs: (args: ReactSmoothDnd.DropResult) => {
                if (doc) {
                    setModified(true);
                    // removedIndex is the previous index; the original item to be moved
                    // addedIndex is the new index where it should be moved to.
                    if (args.addedIndex == null || args.removedIndex == null) throw new Error(`why are these null?`);
                    const newSongs = moveItemInArray(doc.payload.songs, args.removedIndex, args.addedIndex);
                    setDoc({
                        ...doc,
                        payload: {
                            ...doc.payload,
                            songs: newSongs,
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
