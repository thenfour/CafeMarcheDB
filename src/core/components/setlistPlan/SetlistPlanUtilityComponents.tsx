
import { DialogContent } from "@mui/material";
import React from "react";
import * as ReactSmoothDnd from "react-smooth-dnd";
import { ColorPaletteEntry, gGeneralPaletteList } from "shared/color";
import { generateFibonacci, toSorted } from "shared/utils";
import { ColorPaletteListComponent, GetStyleVariablesForColor } from "src/core/components/Color";
import { ReactiveInputDialog } from "src/core/components/ReactiveInputDialog";
import * as db3 from "src/core/db3/db3";
import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";

const FIBONACCI_SEQUENCE = [0, ...generateFibonacci(10000)];
//const FIBONACCI_SEQUENCE_REVERSED = [...FIBONACCI_SEQUENCE].reverse();

const MAX_POINTS_PER_REHEARSAL = 8;

export interface SetlistPlanMutator {
    setDoc: (doc: SetlistPlan) => void;
    autoCompletePlan: () => void;
    clearAllocation: () => void;

    undo: () => void;
    redo: () => void;

    setName: (name: string) => void;
    setDescription: (description: string) => void;
    setAutocompleteMaxPointsPerRehearsal: (maxPoints: number) => void;
    setNotes: (notes: string) => void;

    addSong: (songId: number) => void;
    addAndRemoveSongs: (add: number[], remove: number[]) => void;
    addDivider: () => void;
    deleteRow: (rowId: string) => void;
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

export interface SetlistPlanStats {
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

    maxSongsInSegment: number;
    totalSongSegmentCells: number;

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
        countOfSongsAllocated: number;
    }[];
};

export function CalculateSetlistPlanStats(doc: SetlistPlan, allSongs: db3.SongPayload[]): SetlistPlanStats {
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
            countOfSongsAllocated: doc.payload.cells.filter((x) => x.columnId === segment.columnId && !!x.pointsAllocated).length,
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

    const maxSongsInSegment = segmentStats.reduce((acc, x) => {
        return Math.max(x.countOfSongsAllocated, acc);
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

        maxSongsInSegment,
        totalSongSegmentCells: doc.payload.cells.filter(cell => !!cell.pointsAllocated).length,

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

export const NumberField = (props: NumberFieldProps) => {
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



//////////////////////////////////////////////////////////////////////////////////////////////////
type AutoSelectingNumberFieldProps = {
    value: number | null;
    onChange?: (e: React.ChangeEvent<HTMLInputElement> | React.KeyboardEvent<HTMLInputElement>, newValue: number | null) => void;
    className?: string;
    readonly?: boolean;
    inert?: boolean;
    style?: React.CSSProperties;
};

export const AutoSelectingNumberField = (props: AutoSelectingNumberFieldProps) => {
    const inputRef = React.useRef<HTMLInputElement>(null);
    const [internalValue, setInternalValue] = React.useState<string>(props.value == null ? "" : props.value.toString());

    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
        e.target.select();
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setInternalValue(e.target.value);
        const newValue = e.target.value ? parseFloat(e.target.value) : null;
        props.onChange && props.onChange(e, isNaN(newValue as number) ? null : newValue);
    };

    return <div className="AutoSelectingNumberField">
        <input
            type="text"
            ref={inputRef}
            value={internalValue}
            onChange={handleChange}
            onFocus={handleFocus}
            className={`NumberField ${props.readonly ? "readonly" : "editable"} ${props.inert ? "inert" : "notinert"} ${props.className}`}
            inert={props.inert}
            readOnly={props.readonly}
            disabled={props.inert}
            style={props.style}
        />
        <span>{props.value}</span>
    </div>;
};




//////////////////////////////////////////////////////////////////////////////////////////////////
interface LedProps {
    value: string | null;
    onChange: (newValue: string | null) => void;
}
export const SetlistPlannerLed = (props: LedProps) => {
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

interface CostResult {
    totalCost: number;
    breakdown: { explanation: string, cost: number }[];
};

type Penalty = {
    mul: number;
    add: number;
}

export function GetSetlistPlanStats(plan: SetlistPlan) {

    const songStats = plan.payload.rows
        .filter(row => row.type === "song" && row.pointsRequired)
        .map(row => {
            const allRowCells = plan.payload.cells
                .filter(cell => cell.rowId === row.rowId)
                .map(cell => ({
                    cell,
                    columnIndex: plan.payload.columns.findIndex(col => col.columnId === cell.columnId),
                    allocation: cell.pointsAllocated || 0, // coalesced for convenience.
                }));
            // match the sorting of plan.payload.columns.
            allRowCells.sort((a, b) => a.columnIndex - b.columnIndex);

            const occupiedRowCells = allRowCells.filter(cell => !!cell.cell.pointsAllocated);
            const earliestAllocatedColumnIndex = occupiedRowCells[0]?.columnIndex;
            const totalPointsAllocated = occupiedRowCells.reduce((acc, cell) => acc + cell.allocation, 0);
            const pointsRequired = row.pointsRequired || 0;
            const idealRehearsalCount = Math.max(1, Math.ceil(pointsRequired / MAX_POINTS_PER_REHEARSAL));
            const pointsStillNeeded = pointsRequired - totalPointsAllocated;
            return {
                allRowCells,
                occupiedRowCells,
                rowId: row.rowId,
                pointsRequired,
                earliestAllocatedColumnIndex,
                totalPointsAllocated,
                idealRehearsalCount,
                pointsStillNeeded,
            };
        });

    const columnStats = plan.payload.columns.map(col => {
        const totalPointsAllocated = plan.payload.cells
            .filter(cell => cell.columnId === col.columnId)
            .reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
        const allocatedSongs = plan.payload.cells
            .filter(cell => cell.columnId === col.columnId && cell.pointsAllocated)
            .map(cell => {
                const rowIndex = plan.payload.rows.findIndex(row => row.rowId === cell.rowId);
                const row = plan.payload.rows[rowIndex]!;
                return {
                    cell,
                    rowIndex,
                    row,
                };
            });
        // const colors = allocatedSongs.map(allocatedSong => allocatedSong.row.color!);
        // const uniqueColors = new Set(colors);

        return {
            col,
            allocatedSongs,
            columnId: col.columnId,
            pointsAvailable: col.pointsAvailable || 0,
            totalPointsAllocated,
            //uniqueColors,
        };
    });
    return { songStats, columnStats };
};

export interface SetlistPlanCostPenalties {
    underRehearsedSong: Penalty; // 0-1 input
    overRehearsedSong: Penalty; // 0-1 input (could be >1 though for example if a song is rehearsed 3 points but only requires 1)

    overAllocatedSegment: Penalty; // 0-1
    underAllocatedSegment: Penalty; // 0-1
    maxPointsPerRehearsal: Penalty; // 0-1 but can be >1

    nonClusteredAllocation: Penalty; // 0-1
    increasingAllocation: Penalty; // 0-1
    delayedRehearsal: Penalty; // 0-1 input
    segmentUnderUtilized: Penalty; // always 1
    fragmentedSong: Penalty; // 0-1 // this is arguably not something to penalize. songs with more points required will naturally span more rehearsals and even benefit from that. the point is really to avoid many tiny allocations.

    lighterSongRehearsedBeforeHeavierSong: Penalty; // 0-1 euclidian distance accounting for the difference in song weight, and X distance across columns)

    // this is not really correct. it should actually be "number of incomplete color groups". this does'nt account for when entire color groups are present in a rehearsal (which should not be penalized!)
    //rehearsalSongColorDiversity: Penalty; // 0-1, can be >1 when you really violate this.. // absolute number of colors used in a segment minus 1.
};

export const CalculateSetlistPlanCost = (plan: SetlistPlan, config: SetlistPlanCostPenalties): CostResult => {
    const ret: CostResult = {
        totalCost: 0,
        breakdown: [],
    };

    const addCost = (val: number, penalty: Penalty, explanation: string) => {
        const calculatedCost = val * penalty.mul + penalty.add;
        ret.breakdown.push({ explanation, cost: calculatedCost });
        ret.totalCost += calculatedCost;
    };

    const { songStats, columnStats } = GetSetlistPlanStats(plan);

    // in order to satisfy A* requirement that the cost function be admissible (never over-estimate the cost to reach the goal),
    // we need to:
    // - never reward (negative cost), always penalize.
    // - penalize for each point we have allocated, so even in e perfect scenario the cost will still be never less than the estimate.
    //const allocatedPoints = plan.payload.cells.reduce((acc, x) => acc + (x.pointsAllocated || 0), 0);
    //addCost(allocatedPoints, { mul: 1, add: 0 }, `Points allocated`);

    // penalize for points required but not allocated, per song.
    songStats.forEach(songStat => {
        const balance = songStat.pointsRequired - songStat.totalPointsAllocated;
        if (balance > 0) {
            const underrunFactor01 = balance / songStat.pointsRequired;
            addCost(underrunFactor01, config.underRehearsedSong, `Under-rehearsed song`);
        } else if (balance < 0) {
            const overrunFactor01 = -balance / songStat.pointsRequired;
            addCost(overrunFactor01, config.overRehearsedSong, `Over-rehearsed song`);
        }
    });

    // Clustering: Penalize sporadic allocation.
    // penalize each instance of empty cells between allocated cells.
    // we have to walk through each occupied cell and find breaks in the column index.
    songStats.forEach(songStat => {
        for (let i = 1; i < songStat.occupiedRowCells.length; i++) {
            const thisColIndex = songStat.occupiedRowCells[i]!.columnIndex;
            const prevColIndex = songStat.occupiedRowCells[i - 1]!.columnIndex;
            const diff = thisColIndex - prevColIndex;
            if (diff > 1) {
                // worst offense would be columncount - 2 (because 1st & last are allocated).
                const factor01 = (diff - 1) / (plan.payload.columns.length - 2);
                addCost(factor01, config.nonClusteredAllocation, `Non-clustered allocation`);
            }
        }
    });

    // penalize for earliest allocation being later in the plan. favor rehearsing songs earlier, the idea is to reduce uncertainty.
    for (const songStat of songStats) {
        if (!songStat.earliestAllocatedColumnIndex) continue;
        const delay01 = songStat.earliestAllocatedColumnIndex / plan.payload.columns.length;
        addCost(delay01, config.delayedRehearsal, `Delayed rehearsal`);
    }

    // Decreasing Allocation: Penalize non-decreasing allocation
    for (const songStat of songStats) {
        for (let i = 1; i < songStat.occupiedRowCells.length; i++) {
            const thisAlloc = songStat.occupiedRowCells[i]!.allocation;
            const prevAlloc = songStat.occupiedRowCells[i - 1]!.allocation;
            const maxIncrease = songStat.pointsRequired - 2; // for example requiring 7 points, 1->6 is the max increase (diff of 5)
            if (thisAlloc > prevAlloc) {
                // each instance of increasing allocation is penalized.
                // the larger the increase, the larger the penalty.
                const diff = thisAlloc - prevAlloc;
                const increasingFactor01 = diff / maxIncrease;
                addCost(increasingFactor01, config.increasingAllocation, `Increasing allocation`);
            }
        }
    }

    // penalize for the # of rehearsals per song.
    // better to spend big chunks of time on a song than fragment across many rehearsals. used to be measured by "small allocations" but this is more to the point.
    for (const songStat of songStats) {
        if (songStat.idealRehearsalCount < 1) continue;
        if (songStat.occupiedRowCells.length > songStat.idealRehearsalCount) {
            // heavier songs we expect to span more columns, so scale back by the points required.
            const fragFactor01 = songStat.occupiedRowCells.length / songStat.idealRehearsalCount;
            addCost(fragFactor01, config.fragmentedSong, `Fragmented song`);
        }
    }

    // penalize for exceeding max points per rehearsal
    for (const cell of plan.payload.cells) {
        if (cell.pointsAllocated && cell.pointsAllocated > MAX_POINTS_PER_REHEARSAL) {
            const factor01 = (cell.pointsAllocated - MAX_POINTS_PER_REHEARSAL) / MAX_POINTS_PER_REHEARSAL;
            addCost(factor01, config.maxPointsPerRehearsal, `Exceeded max points per rehearsal`);
        }
    }

    // penalize for a lighter song (requiring less rehearsal) starting rehearsal before a heavier song.
    // the idea is that heavier (more points required) songs have more uncertainty, so they should be rehearsed first.
    // lighter songs are less risky, so they can be rehearsed later, if possible.
    songStats
        .filter(s => s.earliestAllocatedColumnIndex !== undefined)
        .forEach((songStat, songIndex) => {
            for (let i = 0; i < songIndex; i++) {
                const otherSongStat = songStats[i]!;
                // if this song is heavier than the other,
                // and this song was rehearsed after the other,
                // penalize.
                const thisWeight = songStat.pointsRequired;
                const otherWeight = otherSongStat.pointsRequired;
                const thisSongIsHeavier = thisWeight > otherWeight;
                if (thisSongIsHeavier) {
                    const thisEarliestRehearsedIndex = songStat.earliestAllocatedColumnIndex!;
                    const otherEarliestRehearsedIndex = otherSongStat.earliestAllocatedColumnIndex!;
                    const thisSongRehearsedAfter = thisEarliestRehearsedIndex > otherEarliestRehearsedIndex;
                    if (thisSongRehearsedAfter) {
                        // calculate the penalty.
                        const distanceX = thisEarliestRehearsedIndex - otherEarliestRehearsedIndex - 1; // minimum 1, maximum (columns.length - 2)
                        const distanceX01 = distanceX / (plan.payload.columns.length - 1);
                        const distanceY = thisWeight - otherWeight; // minimum 1, maximum (thisWeight - 1)
                        const distanceY01 = distanceY / Math.max(1, (thisWeight - 1)); // 0-1 inclusive
                        const distanceSquared = distanceX01 * distanceX01 + distanceY01 * distanceY01;
                        const distance = Math.sqrt(distanceSquared);
                        addCost(distance, config.lighterSongRehearsedBeforeHeavierSong, `Lighter song rehearsed before heavier song`);
                    }
                }
            }
        });

    // penalize for column under and over allocation.
    columnStats.forEach(colStat => {
        const balance = colStat.totalPointsAllocated - colStat.pointsAvailable;
        if (balance > 0) {
            const overrunFactor01 = balance / colStat.pointsAvailable;
            addCost(overrunFactor01, config.overAllocatedSegment, `Over-allocated segment`);
        } else if (balance < 0) {
            const underrunFactor01 = -balance / colStat.pointsAvailable;
            addCost(underrunFactor01, config.underAllocatedSegment, `Under-allocated segment`);
        }

        // penalize for exceeding max points per rehearsal
        // if (colStat.totalPointsAllocated > MAX_POINTS_PER_REHEARSAL) {
        //     const factor01 = (colStat.totalPointsAllocated - MAX_POINTS_PER_REHEARSAL) / MAX_POINTS_PER_REHEARSAL;
        //     addCost(factor01, config.maxPointsPerRehearsal, `Exceeded max points per rehearsal`);
        // }
    });

    // penalize for a segment containing only 1 song. the penalty is the greater the more points are allocated.
    // the idea is just to nudge otherwise-equal positions to favor segments with more diversity.
    columnStats.forEach(colStat => {
        if (colStat.allocatedSongs.length === 1) {
            addCost(1, config.segmentUnderUtilized, `Segment under-utilized`);
        }
    });

    // console.log({
    //     columnStats,
    //     songStats,
    // });

    // // penalize for each unique color allocated to a segment.
    // // the idea is that colors represent related songs, and rehearsals are more efficient when rehearsing related songs together
    // columnStats.forEach(colStat => {
    //     if (colStat.uniqueColors.size > 1) {
    //         // color penalty is the number of unique colors minus 1.
    //         // assuming 2 colors is the lowest nonzero penalty, and 4 colors is the maximum.
    //         const factor01 = (colStat.uniqueColors.size - 1) / 3;
    //         addCost(factor01, config.rehearsalSongColorDiversity, `Song Color diversity in rehearsal`);
    //     }
    // });

    return ret;
};


export function GetSetlistPlanPointsRemaining(plan: SetlistPlan): number {
    //return 0;
    const allocated = plan.payload.cells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
    const required = plan.payload.rows.reduce((acc, row) => acc + (row.pointsRequired || 0), 0);
    return (required - allocated);
}

export function GetSetlistPlanPointsRequired(plan: SetlistPlan): number {
    const required = plan.payload.rows.reduce((acc, row) => acc + (row.pointsRequired || 0), 0);
    return required;
}


export function GetSetlistPlanPointsAllocated(plan: SetlistPlan): number {
    const allocated = plan.payload.cells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
    return allocated;
}

/**
 * Get a unique key for a plan, based on the cells that have points allocated.
 * can probably be optimized.
 */
export function GetSetlistPlanKey(plan: SetlistPlan): string {
    // prettier output:
    // const outpStructured: (number[])[] = [];
    // plan.payload.rows.filter(r => r.type === "song").forEach(r => {
    //     const row = plan.payload.columns.map(c => {
    //         const cell = plan.payload.cells.find(cell => cell.rowId === r.rowId && cell.columnId === c.columnId);
    //         return cell?.pointsAllocated || 0;
    //     });
    //     outpStructured.push(row);
    // });
    // return JSON.stringify(outpStructured);

    // less pretty output but faster:
    const sortedCells = toSorted(plan.payload.cells.filter(x => !!x.pointsAllocated), (a, b) => {
        if (a.rowId === b.rowId) {
            return a.columnId.localeCompare(b.columnId);
        }
        return a.rowId.localeCompare(b.rowId);
    });

    return sortedCells.map(cell => `${cell.rowId}/${cell.columnId}/${cell.pointsAllocated}`).join(',');
}
