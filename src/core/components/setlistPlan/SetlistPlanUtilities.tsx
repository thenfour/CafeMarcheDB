
import * as ReactSmoothDnd from "react-smooth-dnd";
import { toSorted } from "shared/arrayUtils";
import { generateFibonacci } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { SetlistPlan, SetlistPlanAssociatedItem, SetlistPlanColumn, SetlistPlanLedDef, SetlistPlanLedValue } from "src/core/db3/shared/setlistPlanTypes";

const FIBONACCI_SEQUENCE = [...generateFibonacci(100)]; // for calculating possibilities. don't include 0.
const FIBONACCI_SEQUENCE_REVERSED = [...FIBONACCI_SEQUENCE].reverse();

const MAX_POINTS_PER_REHEARSAL = 8;


/**
 * Priority Queue / Min-Heap interface:
 * You can use a library like "mnemonist" or "fastpriorityqueue".
 * For simplicity, a basic array-based approach is shown (not fully optimized).
 */
export class MinPriorityQueue<T> {
    private data: { element: T; priority: number }[] = [];

    push(element: T, priority: number) {
        this.data.push({ element, priority });
    }

    pop(): { element: T; priority: number } | undefined {
        if (this.isEmpty()) return undefined;
        // Find the item with the smallest priority
        let bestIndex = 0;
        let bestPriority = this.data[0]!.priority;
        for (let i = 1; i < this.data.length; i++) {
            if (this.data[i]!.priority < bestPriority) {
                bestIndex = i;
                bestPriority = this.data[i]!.priority;
            }
        }
        const [element] = this.data.splice(bestIndex, 1);
        return element!;
    }

    isEmpty(): boolean {
        return this.data.length === 0;
    }
}


export type SetlistPlanSearchState = {
    plan: SetlistPlan;
    stats: SetlistPlanStatsForCostCalc;
    cost: CostResult;
    totalCost: number;
    stateId: string;
};

export interface AStarSearchProgressState<S> {
    elapsedMillis: number;
    bestState?: S;
    currentState: S;
    depth: number;
    iteration: number;
}
export interface SetlistPlanSearchProgressState extends AStarSearchProgressState<SetlistPlanSearchState> {
    // iteration: number;
    // depth: number;
    // elapsedMillis: number;
    // currentState: SetlistPlanSearchState;
    // bestState?: SetlistPlanSearchState | undefined;
    iterationsPerSecond?: number | undefined;
};


export interface SetlistPlanMutator {
    setDoc: (doc: SetlistPlan) => void;
    autoCompletePlanSA: () => void;
    autoCompletePlanAStar: () => void;
    autoCompletePlanAStar2: () => void;
    autoCompletePlanDag: () => void;
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
    //setRowColor: (rowId: string, color: string | undefined) => void;

    addColumn: () => void;
    deleteColumn: (columnId: string) => void;
    setColumnName: (columnId: string, name: string) => void;
    setColumnColor: (columnId: string, color: string | undefined | null) => void;
    setColumnComment: (columnId: string, comment: string) => void;
    setColumnAssociatedItem: (columnId: string, associatedItem: SetlistPlanAssociatedItem | null) => void;
    setColumnAvailablePoints: (columnId: string, total: number | undefined) => void;
    reorderColumns: (args: ReactSmoothDnd.DropResult) => void;

    clearColumnAllocation: (columnId: string) => void;
    swapColumnAllocation: (columnId1: string, columnId2: string) => void;

    setManualCellPoints: (rowId: string, columnId: string, points: number | undefined) => void;

    addRowLedDef: () => void;
    updateRowLedDef: (ledId: string, def: SetlistPlanLedDef) => void;
    deleteRowLedDef: (ledId: string) => void;
    reorderRowLeds: (args: ReactSmoothDnd.DropResult) => void;
    setRowLedValue: (rowId: string, ledId: string, val: SetlistPlanLedValue | null) => void;

    addColumnLedDef: () => void;
    updateColumnLedDef: (ledId: string, def: SetlistPlanLedDef) => void;
    deleteColumnLedDef: (ledId: string) => void;
    reorderColumnLeds: (args: ReactSmoothDnd.DropResult) => void;
    setColumnLedValue: (rowId: string, ledId: string, val: SetlistPlanLedValue | null) => void;
}

export type SetlistPlanStats = ReturnType<typeof CalculateSetlistPlanStats>;


interface SetlistPlanCellForCostCalc {
    autoFilled: boolean;
    pointsAllocated: number | undefined;
    columnIndex: number;
    rowIndex: number;
};
interface SetlistPlanStatsForCostCalcSongStat {
    totalPointsAllocated: number;
    requiredPoints: number;
    rowIndex: number;
    rowId: string;
    firstAllocatedColumnIndex: number | undefined;
    songAllocatedCells: SetlistPlanCellForCostCalc[];
    idealRehearsalCount: number;
    pointsStillNeeded: number;
};
interface SetlistPlanSegmentStatForCostCalc {
    poolPointsAvailable: number;
    segmentIndex: number;
    totalPointsAllocated: number;
    segmentAllocatedCells: SetlistPlanCellForCostCalc[];
    pointsStillAvailable: number;
    segment: SetlistPlanColumn;
};
interface SetlistPlanStatsForCostCalc {
    songStats: SetlistPlanStatsForCostCalcSongStat[];
    segmentStats: SetlistPlanSegmentStatForCostCalc[];
    allocatedCells: SetlistPlanCellForCostCalc[];
    totalPlanSongBalance: number;
    totalPlanSegmentBalance: number;
    totalPointsAllocated: number;
    getIdealValueForCell: (columnIndex: number, rowIndex: number) => number | undefined;
};



export function CalculateSetlistPlanStatsForCostCalc(doc: SetlistPlan): SetlistPlanStatsForCostCalc {
    const totalPointsRequired = doc.payload.rows.reduce((acc, song) => song.pointsRequired ? acc + song.pointsRequired : acc, 0);
    const planTotalPointsAllocated = doc.payload.cells.reduce((acc, x) => acc + (x.pointsAllocated || 0), 0);
    const totalPlanBalance = planTotalPointsAllocated - totalPointsRequired;
    // const songsPerSegment = doc.payload.cells.filter(ss => !!ss.pointsAllocated).length / doc.payload.columns.length;
    // const totalPointsInThePool = doc.payload.columns.reduce((acc, x) => acc + (x.pointsAvailable || 0), 0);

    const columnIdToColumnIndexMap = Object.fromEntries(doc.payload.columns.map((col, index) => [col.columnId, index]));
    const rowIdToRowIndexMap = Object.fromEntries(doc.payload.rows.map((row, index) => [row.rowId, index]));

    const allocatedCells = doc.payload.cells
        .filter(cell => !!cell.pointsAllocated)
        .map(cell => {
            //const songId = doc.payload.rows.find(row => row.rowId === cell.rowId)?.songId;
            //const song = allSongs.find(s => s.id === songId);
            const rowIndex = rowIdToRowIndexMap[cell.rowId]!;
            const columnIndex = columnIdToColumnIndexMap[cell.columnId]!;
            return {
                autoFilled: cell.autoFilled || false,
                rowIndex,
                columnIndex,
                linearIndex: rowIndex * doc.payload.columns.length + columnIndex,
                // songId,
                // song,
                pointsAllocated: cell.pointsAllocated,
            }
        });


    // // make sure sorted in a way that makes linear access predictable.
    // allocatedCells.sort((a, b) => {
    //     if (a.rowIndex === b.rowIndex) {
    //         return a.columnIndex - b.columnIndex;
    //     }
    //     return a.rowIndex - b.rowIndex;
    // });

    // const cellIndexToColumnRow = (index: number) => {
    //     const columnIndex = index % doc.payload.columns.length;
    //     const rowIndex = Math.floor(index / doc.payload.columns.length);
    //     return { columnIndex, rowIndex };
    // };

    // // find the last cell that was auto-filled.
    // const linearIndexOfLastAutoFillCell = allocatedCells.findLast(cell => cell.autoFilled)?.linearIndex;
    // const firstAvailableAutoFillCellIndex = linearIndexOfLastAutoFillCell !== undefined ? linearIndexOfLastAutoFillCell + 1 : 0;
    // //const firstAvailableAutoFillColumnIndex = firstAvailableAutoFillCellIndex % doc.payload.columns.length;
    // //const firstAvailableAutoFillRowIndex = Math.floor(firstAvailableAutoFillCellIndex / doc.payload.columns.length);

    const songStats = doc.payload.rows
        .map((row, rowIndex) => {
            const songAllocatedCells = allocatedCells
                .filter(cell => cell.rowIndex === rowIndex);
            // match the sorting of plan.payload.columns.
            songAllocatedCells.sort((a, b) => a.columnIndex - b.columnIndex);
            const totalPointsAllocated = songAllocatedCells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
            return {

                // row,
                rowIndex,
                rowId: row.rowId,
                // songId: row.songId,
                // song: allSongs.find(s => s.id === row.songId),
                songAllocatedCells,
                requiredPoints: row.pointsRequired || 0,
                totalPointsAllocated,
                // balance: row.pointsRequired ? totalPointsAllocated - row.pointsRequired : 0,
                pointsStillNeeded: row.pointsRequired ? row.pointsRequired - totalPointsAllocated : 0,
                firstAllocatedColumnIndex: songAllocatedCells[0]?.columnIndex,
                // lastAllocatedColumnIndex: songAllocatedCells[songAllocatedCells.length - 1]?.columnIndex,
                idealRehearsalCount: row.pointsRequired ? Math.max(1, Math.ceil(row.pointsRequired / MAX_POINTS_PER_REHEARSAL)) : 0,
            };
        });

    const segmentStats = doc.payload.columns
        .map((segment, segmentIndex) => {
            const segmentAllocatedCells = allocatedCells.filter(cell => cell.columnIndex === segmentIndex);
            const totalPointsAllocated = segmentAllocatedCells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
            return {
                segment,
                segmentIndex,
                segmentAllocatedCells,
                poolPointsAvailable: segment.pointsAvailable || 0,
                totalPointsAllocated,
                balance: totalPointsAllocated - (segment.pointsAvailable || 0),
                pointsStillAvailable: (segment.pointsAvailable || 0) - totalPointsAllocated,
            };
        });

    // // maximum cell value points allocated
    // const maxSegmentPointsAllocated = doc.payload.cells.reduce((acc, x) => {
    //     if (x.pointsAllocated == null) return acc;
    //     return Math.max(acc, x.pointsAllocated);
    // }, 0);

    // const minSegmentPointsAllocated = doc.payload.cells.reduce((acc, x) => {
    //     if (x.pointsAllocated == null) return acc;
    //     return Math.min(acc, x.pointsAllocated);
    // }, maxSegmentPointsAllocated);

    // const maxSegmentPointsAvailable = doc.payload.columns.reduce((acc, x) => {
    //     if (x.pointsAvailable == null) return acc;
    //     return Math.max(acc, x.pointsAvailable);
    // }, 0);

    // const minSegmentPointsAvailable = doc.payload.columns.reduce((acc, x) => {
    //     if (x.pointsAvailable == null) return acc;
    //     return Math.min(acc, x.pointsAvailable);
    // }, maxSegmentPointsAvailable);

    // const maxSegPointsUsed = segmentStats.reduce((acc, x) => {
    //     if (x.totalPointsAllocated == null) return acc;
    //     return Math.max(x.totalPointsAllocated, acc);
    // }, 0);

    // const minSegPointsUsed = segmentStats.reduce((acc, x) => {
    //     if (x.totalPointsAllocated == null) return acc;
    //     return Math.min(x.totalPointsAllocated, acc);
    // }, maxSegPointsUsed);

    // const maxSegmentBalance = segmentStats.reduce((acc, x) => {
    //     if (x.balance == null) return acc;
    //     return Math.max(x.balance, acc);
    // }, 0);

    // const minSegmentBalance = segmentStats.reduce((acc, x) => {
    //     if (x.balance == null) return acc;
    //     return Math.min(x.balance, acc);
    // }, maxSegmentBalance);


    // const maxSongBalance = songStats.reduce((acc, x) => {
    //     if (x.balance == null) return acc;
    //     return Math.max(x.balance, acc);
    // }, 0);

    // const minSongBalance = songStats.reduce((acc, x) => {
    //     if (x.balance == null) return acc;
    //     return Math.min(x.balance, acc);
    // }, maxSongBalance);

    // const maxSongRequiredPoints = songStats.reduce((acc, x) => {
    //     if (x.requiredPoints == null) return acc;
    //     return Math.max(x.requiredPoints, acc);
    // }, 0);

    // const minSongRequiredPoints = songStats.reduce((acc, x) => {
    //     if (x.requiredPoints == null) return acc;
    //     return Math.min(x.requiredPoints, acc);
    // }, maxSongRequiredPoints);

    // const maxSongTotalPoints = songStats.reduce((acc, x) => {
    //     if (x.totalPointsAllocated == null) return acc;
    //     return Math.max(x.totalPointsAllocated, acc);
    // }, 0);

    // const minSongTotalPoints = songStats.reduce((acc, x) => {
    //     if (x.totalPointsAllocated == null) return acc;
    //     return Math.min(x.totalPointsAllocated, acc);
    // }, maxSongTotalPoints);

    // const totalSongLengthSeconds = songStats.reduce((acc, x) => {
    //     const song = allSongs.find(s => s.id === x.songId);
    //     if (!song) return acc;
    //     return acc + (song.lengthSeconds || 0);
    // }, 0);

    // const maxSongsInSegment = segmentStats.reduce((acc, x) => {
    //     return Math.max(x.segmentAllocatedCells.length, acc);
    // }, 0);

    return {
        allocatedCells,
        // columnIdToColumnIndexMap,
        // rowIdToRowIndexMap,

        // totalSongLengthSeconds,
        // totalPointsRequired,
        totalPointsAllocated: planTotalPointsAllocated,
        totalPlanSegmentBalance: segmentStats.reduce((acc, x) => acc + (x.balance || 0), 0),
        totalPlanSongBalance: totalPlanBalance,
        // songsPerSegment,
        songStats,
        segmentStats,
        // totalPointsInThePool,
        // linearIndexOfLastAutoFillCell,
        // firstAvailableAutoFillCellIndex,
        // cellIndexToColumnRow,

        // maxCellAllocatedPoints: maxSegmentPointsAllocated,
        // minCellAllocatedPoints: minSegmentPointsAllocated,

        // maxSongsInSegment,
        // totalSongSegmentCells: doc.payload.cells.filter(cell => !!cell.pointsAllocated).length,

        // minSegmentPointsAvailable,
        // maxSegmentPointsAvailable,
        // maxSegPointsUsed,
        // minSegPointsUsed,
        // maxSegmentBalance,
        // minSegmentBalance,
        // maxSongBalance,
        // minSongBalance,
        // maxSongRequiredPoints,
        // minSongRequiredPoints,
        // maxSongTotalPoints,
        // minSongTotalPoints,

        getIdealValueForCell: (columnIndex: number, rowIndex: number): number | undefined => {
            const columnStat = segmentStats[columnIndex]!;
            const rowStat = songStats[rowIndex]!;
            const linearIndex = rowIndex * doc.payload.columns.length + columnIndex;
            const cell = allocatedCells.find(cell => cell.linearIndex === linearIndex);
            const isAlreadyOccupied = cell && (cell.pointsAllocated !== undefined) && !cell.autoFilled;
            if (isAlreadyOccupied) {
                return undefined;
            }

            // all fib numbers from 1 to either the max points available in the column, or the points still needed for the song.
            const maxPointsAvailable = Math.min(Math.max(0, columnStat.pointsStillAvailable), Math.max(0, rowStat.pointsStillNeeded));
            const maxPointsToAllocate = Math.min(MAX_POINTS_PER_REHEARSAL, maxPointsAvailable);
            return FIBONACCI_SEQUENCE_REVERSED.find(fib => fib <= maxPointsToAllocate) || maxPointsToAllocate;
        },
    };
};



export function CalculateSetlistPlanStats(doc: SetlistPlan, allSongs: db3.SongPayload[]) {
    const totalPointsRequired = doc.payload.rows.reduce((acc, song) => song.pointsRequired ? acc + song.pointsRequired : acc, 0);
    const totalPointsAllocated = doc.payload.cells.reduce((acc, x) => acc + (x.pointsAllocated || 0), 0);
    const totalPlanBalance = totalPointsAllocated - totalPointsRequired;
    const songsPerSegment = doc.payload.cells.filter(ss => !!ss.pointsAllocated).length / doc.payload.columns.length;
    const totalPointsInThePool = doc.payload.columns.reduce((acc, x) => acc + (x.pointsAvailable || 0), 0);

    const columnIdToColumnIndexMap = Object.fromEntries(doc.payload.columns.map((col, index) => [col.columnId, index]));
    const rowIdToRowIndexMap = Object.fromEntries(doc.payload.rows.map((row, index) => [row.rowId, index]));

    const allocatedCells = doc.payload.cells
        .filter(cell => !!cell.pointsAllocated)
        .map(cell => {
            const songId = doc.payload.rows.find(row => row.rowId === cell.rowId)?.songId;
            const song = allSongs.find(s => s.id === songId);
            const rowIndex = rowIdToRowIndexMap[cell.rowId]!;
            const columnIndex = columnIdToColumnIndexMap[cell.columnId]!;
            return {
                ...cell,
                rowIndex,
                columnIndex,
                linearIndex: rowIndex * doc.payload.columns.length + columnIndex,
                songId,
                song,
                pointsAllocated: cell.pointsAllocated,
            }
        });


    // make sure sorted in a way that makes linear access predictable.
    allocatedCells.sort((a, b) => {
        if (a.rowIndex === b.rowIndex) {
            return a.columnIndex - b.columnIndex;
        }
        return a.rowIndex - b.rowIndex;
    });

    const cellIndexToColumnRow = (index: number) => {
        const columnIndex = index % doc.payload.columns.length;
        const rowIndex = Math.floor(index / doc.payload.columns.length);
        return { columnIndex, rowIndex };
    };

    // find the last cell that was auto-filled.
    const linearIndexOfLastAutoFillCell = allocatedCells.findLast(cell => cell.autoFilled)?.linearIndex;
    const firstAvailableAutoFillCellIndex = linearIndexOfLastAutoFillCell !== undefined ? linearIndexOfLastAutoFillCell + 1 : 0;
    //const firstAvailableAutoFillColumnIndex = firstAvailableAutoFillCellIndex % doc.payload.columns.length;
    //const firstAvailableAutoFillRowIndex = Math.floor(firstAvailableAutoFillCellIndex / doc.payload.columns.length);

    const songStats = doc.payload.rows
        .map((row, rowIndex) => {
            const songAllocatedCells = allocatedCells
                .filter(cell => cell.rowIndex === rowIndex);
            // match the sorting of plan.payload.columns.
            songAllocatedCells.sort((a, b) => a.columnIndex - b.columnIndex);
            const totalPointsAllocated = songAllocatedCells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
            return {
                row,
                rowIndex,
                rowId: row.rowId,
                songId: row.songId,
                song: allSongs.find(s => s.id === row.songId),
                songAllocatedCells,
                requiredPoints: row.pointsRequired || 0,
                totalPointsAllocated,
                balance: row.pointsRequired ? totalPointsAllocated - row.pointsRequired : 0,
                pointsStillNeeded: row.pointsRequired ? row.pointsRequired - totalPointsAllocated : 0,
                firstAllocatedColumnIndex: songAllocatedCells[0]?.columnIndex,
                lastAllocatedColumnIndex: songAllocatedCells[songAllocatedCells.length - 1]?.columnIndex,
                idealRehearsalCount: row.pointsRequired ? Math.max(1, Math.ceil(row.pointsRequired / MAX_POINTS_PER_REHEARSAL)) : 0,
            };
        });

    const segmentStats = doc.payload.columns
        .map((segment, segmentIndex) => {
            const segmentAllocatedCells = allocatedCells.filter(cell => cell.columnIndex === segmentIndex);
            const totalPointsAllocated = segmentAllocatedCells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
            return {
                segment,
                segmentIndex,
                segmentAllocatedCells,
                poolPointsAvailable: segment.pointsAvailable || 0,
                totalPointsAllocated,
                balance: totalPointsAllocated - (segment.pointsAvailable || 0),
                pointsStillAvailable: (segment.pointsAvailable || 0) - totalPointsAllocated,
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
        if (x.totalPointsAllocated == null) return acc;
        return Math.max(x.totalPointsAllocated, acc);
    }, 0);

    const minSegPointsUsed = segmentStats.reduce((acc, x) => {
        if (x.totalPointsAllocated == null) return acc;
        return Math.min(x.totalPointsAllocated, acc);
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
        if (x.totalPointsAllocated == null) return acc;
        return Math.max(x.totalPointsAllocated, acc);
    }, 0);

    const minSongTotalPoints = songStats.reduce((acc, x) => {
        if (x.totalPointsAllocated == null) return acc;
        return Math.min(x.totalPointsAllocated, acc);
    }, maxSongTotalPoints);

    const totalSongLengthSeconds = songStats.reduce((acc, x) => {
        const song = allSongs.find(s => s.id === x.songId);
        if (!song) return acc;
        return acc + (song.lengthSeconds || 0);
    }, 0);

    const maxSongsInSegment = segmentStats.reduce((acc, x) => {
        return Math.max(x.segmentAllocatedCells.length, acc);
    }, 0);

    return {
        allocatedCells,
        columnIdToColumnIndexMap,
        rowIdToRowIndexMap,

        totalSongLengthSeconds,
        totalPointsRequired,
        totalPointsAllocated,
        totalPlanSegmentBalance: segmentStats.reduce((acc, x) => acc + (x.balance || 0), 0),
        totalPlanSongBalance: totalPlanBalance,
        songsPerSegment,
        songStats,
        segmentStats,
        totalPointsInThePool,
        linearIndexOfLastAutoFillCell,
        firstAvailableAutoFillCellIndex,
        cellIndexToColumnRow,
        //firstAvailableAutoFillColumnIndex,
        //firstAvailableAutoFillRowIndex,

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

        // // for search
        // getPossibleValuesForCell: (columnIndex: number, rowIndex: number): number[] => {
        //     const columnStat = segmentStats[columnIndex]!;
        //     const rowStat = songStats[rowIndex]!;
        //     const isAlreadyOccupied = rowStat?.songAllocatedCells.some(cell => cell.columnIndex === columnIndex && cell.pointsAllocated);
        //     if (isAlreadyOccupied) return [];

        //     // all fib numbers from 1 to either the max points available in the column, or the points still needed for the song.
        //     const maxPointsAvailable = columnStat.pointsStillAvailable || 0;
        //     const pointsStillNeeded = rowStat.pointsStillNeeded || 0;
        //     //const maxAllocation = Math.min(maxPointsAvailable, pointsStillNeeded);
        //     const maxAllocation = maxPointsAvailable;
        //     if (maxAllocation < 1) return [];

        //     const allValues = new Set<number>([...FIBONACCI_SEQUENCE.filter(fib => fib < maxAllocation), maxAllocation]);
        //     return [...allValues];
        // },

        // allows overwriting cells 
        getPossibleValuesForCell: (columnIndex: number, rowIndex: number): number[] => {
            const columnStat = segmentStats[columnIndex]!;
            const rowStat = songStats[rowIndex]!;
            const linearIndex = rowIndex * doc.payload.columns.length + columnIndex;
            const cell = allocatedCells.find(cell => cell.linearIndex === linearIndex);
            const isAlreadyOccupied = cell && cell.pointsAllocated && !cell.autoFilled;
            if (isAlreadyOccupied) {
                //console.log(`is already occupied: ${rowIndex}/${columnIndex}`);
                return [];
            }

            // refund points allocated for this cell.
            const pointsAllocated = cell?.pointsAllocated || 0;
            const columnPointsAvailable = columnStat.pointsStillAvailable + pointsAllocated;
            const songPointsRequired = (rowStat.pointsStillNeeded || 0) + pointsAllocated;

            // all fib numbers from 1 to either the max points available in the column, or the points still needed for the song.
            const maxPointsAvailable = Math.min(columnPointsAvailable, songPointsRequired);
            //const maxAllocation = maxPointsAvailable;
            if (maxPointsAvailable < 1) {
                //console.log(`maxAllocation < 1: ${rowIndex}/${columnIndex}; pointsallocated: ${pointsAllocated}; columnPointsAvailable: ${columnPointsAvailable}; songPointsRequired: ${songPointsRequired}`);
                return [];
            }
            // console.log(`-> pointsAllocated:${pointsAllocated};  columnPointsAvailable: ${columnStat.pointsStillAvailable} => ${columnPointsAvailable}`);
            // console.log(`   songPointsRequired: ${rowStat.pointsStillNeeded} => ${songPointsRequired}`);
            // console.log(`   maxpointsavailable: ${maxPointsAvailable};`);

            const maxPointsToAllocate = Math.min(MAX_POINTS_PER_REHEARSAL, maxPointsAvailable);
            return [FIBONACCI_SEQUENCE_REVERSED.find(fib => fib <= maxPointsToAllocate) || maxPointsToAllocate];
            //return [maxPointsToAllocate];
            //const allValues = new Set<number>([...FIBONACCI_SEQUENCE.filter(fib => fib < maxPointsToAllocate), maxPointsToAllocate]);
            //return [...allValues].sort();


            //const allValues = new Set<number>([...FIBONACCI_SEQUENCE.filter(fib => fib < maxPointsAvailable), maxPointsAvailable]);
            //console.log(`   possible values for ${rowIndex}/${columnIndex}: ${[...allValues]};`);
            //return [...allValues].sort();
        },
        getIdealValueForCell: (columnIndex: number, rowIndex: number): number | undefined => {
            const columnStat = segmentStats[columnIndex]!;
            const rowStat = songStats[rowIndex]!;
            const linearIndex = rowIndex * doc.payload.columns.length + columnIndex;
            const cell = allocatedCells.find(cell => cell.linearIndex === linearIndex);
            const isAlreadyOccupied = cell && (cell.pointsAllocated !== undefined) && !cell.autoFilled;
            if (isAlreadyOccupied) {
                return undefined;
            }

            // all fib numbers from 1 to either the max points available in the column, or the points still needed for the song.
            const maxPointsAvailable = Math.min(Math.max(0, columnStat.pointsStillAvailable), Math.max(0, rowStat.pointsStillNeeded));
            const maxPointsToAllocate = Math.min(MAX_POINTS_PER_REHEARSAL, maxPointsAvailable);
            return FIBONACCI_SEQUENCE_REVERSED.find(fib => fib <= maxPointsToAllocate) || maxPointsToAllocate;
        },
    };
};

type CostResultBreakdownItem = {
    explanation: string;
    factor01: number;
    cost: number;
    beginRowIndex: undefined | number;
    columnIndex: undefined | number;
};

type CostResultGridContext = {
    beginRowIndex: undefined | number;
    columnIndex: undefined | number;
};

export interface CostResult {
    totalCost: number;
    breakdown: CostResultBreakdownItem[];
};

type Penalty = {
    mul: number;
    add: number;
}


export interface SetlistPlanCostPenalties {
    underRehearsedSong: Penalty; // 0-1 input
    overRehearsedSong: Penalty; // 0-1 input (could be >1 though for example if a song is rehearsed 3 points but only requires 1)

    overAllocatedSegment: Penalty; // 0-1
    underAllocatedSegment: Penalty; // 0-1
    maxPointsPerRehearsal: Penalty; // 0-1 but can be >1

    //nonClusteredAllocation: Penalty; // 0-1
    increasingAllocation: Penalty; // 0-1
    delayedRehearsal: Penalty; // 0-1 input
    segmentUnderUtilized: Penalty; // always 1
    fragmentedSong: Penalty; // 0-1 // this is arguably not something to penalize. songs with more points required will naturally span more rehearsals and even benefit from that. the point is really to avoid many tiny allocations.

    lighterSongRehearsedBeforeHeavierSong: Penalty; // 0-1 euclidian distance accounting for the difference in song weight, and X distance across columns)

    // this is not really correct. it should actually be "number of incomplete color groups". this does'nt account for when entire color groups are present in a rehearsal (which should not be penalized!)
    //rehearsalSongColorDiversity: Penalty; // 0-1, can be >1 when you really violate this.. // absolute number of colors used in a segment minus 1.
};



export const CalculateSetlistPlanCost = ({ plan, stats }: { plan: SetlistPlan, stats: SetlistPlanStatsForCostCalc }, config: SetlistPlanCostPenalties): CostResult => {
    const ret: CostResult = {
        totalCost: 0,
        breakdown: [],
    };

    const SongCost = (beginRowIndex: number): CostResultGridContext => {
        return {
            beginRowIndex,
            columnIndex: undefined,
            // width: undefined,
            // height: undefined,
        };
    }

    const ColumnCost = (beginColumnIndex: number): CostResultGridContext => {
        return {
            beginRowIndex: undefined,
            columnIndex: beginColumnIndex,
        };
    }

    const CellCost = (beginRowIndex: number, beginColumnIndex: number): CostResultGridContext => {
        return {
            beginRowIndex,
            columnIndex: beginColumnIndex,
        };
    }

    const addCost = (val: number, penalty: Penalty, ctx: CostResultGridContext, explanation: string) => {
        const calculatedCost = val * penalty.mul + penalty.add;
        if (calculatedCost < 0.000001) return;
        ret.breakdown.push({
            explanation,
            cost: calculatedCost,
            factor01: val,
            ...(ctx || {}),
        });

        ret.totalCost += calculatedCost;
    };

    //const stats = CalculateSetlistPlanStats(plan, allSongs);

    addCost(stats.totalPointsAllocated, { mul: 1, add: 0 }, { beginRowIndex: undefined, columnIndex: undefined }, `Point traversal penalty`);

    //const { songStats, columnStats } = GetSetlistPlanStats(plan);

    // in order to satisfy A* requirement that the cost function be admissible (never over-estimate the cost to reach the goal),
    // we need to:
    // - never reward (negative cost), always penalize.
    // - penalize for each point we have allocated, so even in e perfect scenario the cost will still be never less than the estimate.
    //const allocatedPoints = plan.payload.cells.reduce((acc, x) => acc + (x.pointsAllocated || 0), 0);
    //addCost(allocatedPoints, { mul: 1, add: 0 }, `Points allocated`);

    // penalize for points required but not allocated, per song.
    stats.songStats.forEach(songStat => {
        const balance = songStat.requiredPoints - songStat.totalPointsAllocated;
        if (balance > 0) {
            const underrunFactor01 = balance / songStat.requiredPoints;
            addCost(underrunFactor01, config.underRehearsedSong, SongCost(songStat.rowIndex), `Under-rehearsed song`);
        } else if (balance < 0) {
            const overrunFactor01 = -balance / songStat.requiredPoints;
            addCost(overrunFactor01, config.overRehearsedSong, SongCost(songStat.rowIndex), `Over-rehearsed song`);
        }
    });

    // // Clustering: Penalize sporadic allocation.
    // // penalize each instance of empty cells between allocated cells.
    // // we have to walk through each occupied cell and find breaks in the column index.
    // stats.songStats.forEach(songStat => {
    //     for (let i = 1; i < songStat.songAllocatedCells.length; i++) {
    //         const thisColIndex = songStat.songAllocatedCells[i]!.columnIndex;
    //         const prevColIndex = songStat.songAllocatedCells[i - 1]!.columnIndex;
    //         const diff = thisColIndex - prevColIndex;
    //         if (diff > 1) {
    //             // worst offense would be columncount - 2 (because 1st & last are allocated).
    //             const factor01 = (diff - 1) / (plan.payload.columns.length - 2);
    //             addCost(factor01, config.nonClusteredAllocation, CellCost(songStat.rowIndex, thisColIndex), `Non-clustered allocation`);
    //         }
    //     }
    // });

    // penalize for earliest allocation being later in the plan. favor rehearsing songs earlier, the idea is to reduce uncertainty.
    for (const songStat of stats.songStats) {
        if (!songStat.firstAllocatedColumnIndex) continue;
        const delay01 = songStat.firstAllocatedColumnIndex / plan.payload.columns.length;
        addCost(delay01, config.delayedRehearsal, CellCost(songStat.rowIndex, songStat.firstAllocatedColumnIndex), `Delayed rehearsal`);
    }

    // Decreasing Allocation: Penalize non-decreasing allocation
    for (const songStat of stats.songStats) {
        for (let i = 1; i < songStat.songAllocatedCells.length; i++) {
            const thisCell = songStat.songAllocatedCells[i]!;
            const thisAlloc = thisCell.pointsAllocated || 0;
            const prevAlloc = songStat.songAllocatedCells[i - 1]!.pointsAllocated || 0;
            const maxIncrease = songStat.requiredPoints - 2; // for example requiring 7 points, 1->6 is the max increase (diff of 5)
            if (thisAlloc > prevAlloc) {
                // each instance of increasing allocation is penalized.
                // the larger the increase, the larger the penalty.
                const diff = thisAlloc - prevAlloc;
                const increasingFactor01 = diff / maxIncrease;
                addCost(increasingFactor01, config.increasingAllocation, CellCost(songStat.rowIndex, thisCell.columnIndex), `Increasing allocation`);
            }
        }
    }

    // penalize for the # of rehearsals per song.
    // better to spend big chunks of time on a song than fragment across many rehearsals. used to be measured by "small allocations" but this is more to the point.
    for (const songStat of stats.songStats) {
        if (songStat.idealRehearsalCount < 1) continue;
        if (songStat.songAllocatedCells.length > songStat.idealRehearsalCount) {
            // heavier songs we expect to span more columns, so scale back by the points required.
            const fragFactor01 = (songStat.songAllocatedCells.length / songStat.idealRehearsalCount) - 1;
            addCost(fragFactor01, config.fragmentedSong, SongCost(songStat.rowIndex), `Excessive rehearsals for song (${songStat.songAllocatedCells.length} > ${songStat.idealRehearsalCount})`);
        }
    }

    // penalize for exceeding max points per rehearsal
    //for (const cell of plan.payload.cells) {
    for (const cellStat of stats.allocatedCells) {
        if (cellStat.pointsAllocated && cellStat.pointsAllocated > MAX_POINTS_PER_REHEARSAL) {
            const factor01 = (cellStat.pointsAllocated - MAX_POINTS_PER_REHEARSAL) / MAX_POINTS_PER_REHEARSAL;
            addCost(factor01, config.maxPointsPerRehearsal, CellCost(cellStat.rowIndex, cellStat.columnIndex), `Exceeded max points per rehearsal`);
        }
    }

    // penalize for a lighter song (requiring less rehearsal) starting rehearsal before a heavier song.
    // the idea is that heavier (more points required) songs have more uncertainty, so they should be rehearsed first.
    // lighter songs are less risky, so they can be rehearsed later, if possible.
    stats.songStats
        .filter(s => s.firstAllocatedColumnIndex !== undefined)
        .forEach((songStat, songIndex) => {
            for (let i = 0; i < songIndex; i++) {
                const otherSongStat = stats.songStats[i]!;
                // if this song is heavier than the other,
                // and this song was rehearsed after the other,
                // penalize.
                const thisWeight = songStat.requiredPoints;
                const otherWeight = otherSongStat.requiredPoints;
                const thisSongIsHeavier = thisWeight > otherWeight;
                if (thisSongIsHeavier) {
                    const thisEarliestRehearsedIndex = songStat.firstAllocatedColumnIndex!;
                    const otherEarliestRehearsedIndex = otherSongStat.firstAllocatedColumnIndex!;
                    const thisSongRehearsedAfter = thisEarliestRehearsedIndex > otherEarliestRehearsedIndex;
                    if (thisSongRehearsedAfter) {
                        // calculate the penalty.
                        const distanceX = thisEarliestRehearsedIndex - otherEarliestRehearsedIndex - 1; // minimum 1, maximum (columns.length - 2)
                        const distanceX01 = distanceX / (plan.payload.columns.length - 1);
                        const distanceY = thisWeight - otherWeight; // minimum 1, maximum (thisWeight - 1)
                        const distanceY01 = distanceY / Math.max(1, (thisWeight - 1)); // 0-1 inclusive
                        const distanceSquared = distanceX01 * distanceX01 + distanceY01 * distanceY01;
                        const distance = Math.sqrt(distanceSquared);
                        addCost(distance, config.lighterSongRehearsedBeforeHeavierSong, {
                            beginRowIndex: songStat.rowIndex,
                            columnIndex: thisEarliestRehearsedIndex,
                        }, `Lighter song rehearsed before heavier song`);
                    }
                }
            }
        });

    // penalize for column under and over allocation.
    stats.segmentStats.forEach(colStat => {
        const balance = colStat.totalPointsAllocated - colStat.poolPointsAvailable;
        if (balance > 0) {
            const overrunFactor01 = balance / colStat.poolPointsAvailable;
            addCost(overrunFactor01, config.overAllocatedSegment, ColumnCost(colStat.segmentIndex), `Over-allocated segment`);
        } else if (balance < 0) {
            const underrunFactor01 = -balance / colStat.poolPointsAvailable;
            addCost(underrunFactor01, config.underAllocatedSegment, ColumnCost(colStat.segmentIndex), `Under-allocated segment`);
        }
    });

    // penalize for a segment containing only 1 song. the penalty is the greater the more points are allocated.
    // the idea is just to nudge otherwise-equal positions to favor segments with more diversity.
    stats.segmentStats.forEach(colStat => {
        if (colStat.segmentAllocatedCells.length === 1) {
            addCost(1, config.segmentUnderUtilized, ColumnCost(colStat.segmentIndex), `Segment under-utilized`);
        }
    });

    return ret;
};


/**
 * Get a unique key for a plan, based on the cells that have points allocated.
 * can probably be optimized.
 */
export function GetSetlistPlanKey(plan: SetlistPlan): string {
    // // pretty output but slower:
    // // accounting for 0 vs. undefined.
    // const rowStrings = plan.payload.rows.filter(r => r.type === "song").map(row => {
    //     const rowCellStrings = plan.payload.columns.map(c => {
    //         const cell = plan.payload.cells.find(cell => cell.rowId === row.rowId && cell.columnId === c.columnId);
    //         if (cell?.pointsAllocated === undefined) return "-";
    //         return cell.pointsAllocated.toString();
    //     });
    //     return rowCellStrings.join(',');
    // });
    // return rowStrings.join('|');


    // less pretty output but faster:
    const sortedCells = toSorted(plan.payload.cells.filter(x => !!x.pointsAllocated), (a, b) => {
        if (a.rowId === b.rowId) {
            return a.columnId.localeCompare(b.columnId);
        }
        return a.rowId.localeCompare(b.rowId);
    });

    return sortedCells.map(cell => `${cell.rowId}/${cell.columnId}/${cell.pointsAllocated}`).join(',');
}
