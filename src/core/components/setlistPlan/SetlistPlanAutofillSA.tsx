// simulated annealing.
// i think in principle this could lead to interesting results, 
// but the cost function needs to be designed to make sure that neighbor states creep towards the goal and not feel like a random walk.
// the mutation function needs to be less random; it should at least attempt to favor ideal values.

import { Stopwatch } from "shared/rootroot";
import * as db3 from "src/core/db3/db3";
import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { CalculateSetlistPlanCost, CalculateSetlistPlanStats, CalculateSetlistPlanStatsForCostCalc, CostResult, SetlistPlanCostPenalties, SetlistPlanSearchProgressState, SetlistPlanSearchState, SetlistPlanStats } from "./SetlistPlanUtilities";

/**
 * Returns N distinct random indices from [0, rowCount - 1].
 * Assumes N <= rowCount.
 */
function getDistinctRandomIndices(rowCount: number, N: number): number[] {
    N = Math.min(N, rowCount);

    // Create an array of [0, 1, 2, ..., rowCount-1]
    const indices = Array.from({ length: rowCount }, (_, i) => i);

    // Fisher–Yates (Durstenfeld) shuffle
    for (let i = rowCount - 1; i > 0; i--) {
        const r = Math.floor(Math.random() * (i + 1));
        // Swap indices[i] and indices[r]
        [indices[i], indices[r]] = [indices[r]!, indices[i]!];
    }

    // Take the first N elements after shuffling
    return indices.slice(0, N);
}

/**
 * Pick one index from [0, array.length - 1], 
 * such that higher indices are more likely.
 * 
 * Weights are (i+1) ^ alpha.
 * 
 * @param array - the array of items to pick from.
 * @param alpha - exponent controlling bias toward later indices.
 *                alpha = 1 => linear bias,
 *                alpha > 1 => stronger bias,
 *                alpha < 1 => weaker bias.
 * @returns an index in [0, array.length - 1]
 */
function pickFavoringLateIndices<T>(array: T[], alpha: number = 1): number {
    const length = array.length;
    if (length === 0) {
        throw new Error("Cannot pick from an empty array.");
    }

    // 1) Compute the weights for each index
    const weights: number[] = [];
    for (let i = 0; i < length; i++) {
        // (i+1)^alpha so that index 0 has a nonzero weight
        weights.push(Math.pow(i + 1, alpha));
    }

    // 2) Sum of weights
    const totalWeight = weights.reduce((acc, w) => acc + w, 0);

    // 3) Pick a random threshold in [0, totalWeight)
    let threshold = Math.random() * totalWeight;

    // 4) Walk through the indices, subtracting weights
    for (let i = 0; i < length; i++) {
        threshold -= weights[i]!;
        if (threshold <= 0) {
            return i;
        }
    }

    // Fallback (due to floating-point rounding)
    return length - 1;
}


export type SimulatedAnnealingConfig = {
    initialTemp: number;
    coolingRate: number;
    maxIterations: number;
    cellsToMutatePerIteration: number;
    favorLateIndicesAlpha: number;
    probabilityOfEmpty01: number;
}

// export type SetlistPlanSearchState = {
//     plan: SetlistPlan;
//     stats: SetlistPlanStats;
//     cost: CostResult;
// };

export const SetlistPlanGetRandomMutation = (saConfig: SimulatedAnnealingConfig, state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties, allSongs: db3.SongPayload[]): SetlistPlanSearchState | null => {

    const planJSON = JSON.stringify(state.plan);
    const newState = {
        plan: JSON.parse(planJSON) as SetlistPlan,
        stats: state.stats,
        cost: state.cost,
    };

    // decide which cell to mutate. pick random cells until we find one that can be mutated.
    const rowCount = state.plan.payload.rows.length;
    const columnCount = state.plan.payload.columns.length;
    //const cellCount = rowCount * columnCount;
    let cellsLeftToMutate = saConfig.cellsToMutatePerIteration;
    const maxIterations = 500;

    //const cellIndicesToMutate = getDistinctRandomIndices(cellCount, maxCellsToMutate);

    const mutateCell = (columnIndex: number, rowIndex: number, points: number) => {
        const rowId = state.stats.songStats[rowIndex]!.rowId;
        const columnId = state.plan.payload.columns[columnIndex]!.columnId;
        //const points = possibilities[Math.floor(Math.random() * possibilities.length)];

        const makeItEmpty = Math.random() < saConfig.probabilityOfEmpty01;
        //const points = makeItEmpty ? 0 : possibilities[pickFavoringLateIndices(possibilities, saConfig.favorLateIndicesAlpha)];
        //console.log(`:SetlistPlanGetRandomMutation: mutating cell ${rowIndex},${columnIndex} to ${points}.`)
        const existingCell = newState.plan.payload.cells.find((x) => x.rowId === rowId && x.columnId === columnId);
        if (existingCell) {
            existingCell.pointsAllocated = points;
            existingCell.autoFilled = true;
        } else {
            newState.plan.payload.cells.push({
                rowId,
                columnId,
                pointsAllocated: points,
                autoFilled: true,
            });
        }
        newState.stats = CalculateSetlistPlanStatsForCostCalc(newState.plan);
        newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig, allSongs);
    };

    // const mutateCell = (columnIndex: number, rowIndex: number, possibilities: number[]) => {
    //     const rowId = state.stats.songStats[rowIndex]!.rowId;
    //     const columnId = state.plan.payload.columns[columnIndex]!.columnId;
    //     //const points = possibilities[Math.floor(Math.random() * possibilities.length)];

    //     const makeItEmpty = Math.random() < saConfig.probabilityOfEmpty01;
    //     const points = makeItEmpty ? 0 : possibilities[pickFavoringLateIndices(possibilities, saConfig.favorLateIndicesAlpha)];
    //     //console.log(`:SetlistPlanGetRandomMutation: mutating cell ${rowIndex},${columnIndex} to ${points}.`)
    //     const existingCell = newState.plan.payload.cells.find((x) => x.rowId === rowId && x.columnId === columnId);
    //     if (existingCell) {
    //         existingCell.pointsAllocated = points;
    //         existingCell.autoFilled = true;
    //     } else {
    //         newState.plan.payload.cells.push({
    //             rowId,
    //             columnId,
    //             pointsAllocated: points,
    //             autoFilled: true,
    //         });
    //     }
    //     newState.stats = CalculateSetlistPlanStatsForCostCalc(newState.plan, allSongs);
    //     newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig, allSongs);
    // };

    for (let i = 0; i < maxIterations; ++i) {
        const rowIndex = Math.floor(Math.random() * rowCount);
        const columnIndex = Math.floor(Math.random() * columnCount);
        const idealVal = state.stats.getIdealValueForCell(columnIndex, rowIndex);
        if (idealVal == null) continue;
        mutateCell(columnIndex, rowIndex, idealVal);
        // if (possibilities.length > 0) {
        //     mutateCell(columnIndex, rowIndex, possibilities);
        //     cellsLeftToMutate--;
        // }
        if (cellsLeftToMutate === 0) break;
    }
    return newState;
};


export async function AutoCompleteSetlistPlanSA(
    saConfig: SimulatedAnnealingConfig,
    initialState: SetlistPlanSearchState,
    costCalcConfig: SetlistPlanCostPenalties,
    allSongs: db3.SongPayload[],
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    console.log(`AutoCompleteSetlistPlanSA...`);

    const sw = new Stopwatch();

    const reportEveryNIterations = 15;

    let currentProgress: SetlistPlanSearchProgressState =
    {
        iteration: 0,
        depth: 0,
        elapsedMillis: 0,
        bestState: initialState,
    }

    let T = saConfig.initialTemp;
    let bestProgress = currentProgress;

    for (let i = 0; i < saConfig.maxIterations; ++i) {
        currentProgress.depth = T;
        currentProgress.elapsedMillis = sw.ElapsedMillis;
        currentProgress.iteration = i;

        if (cancellationTrigger.current) {
            return bestProgress;
        }

        if (i % reportEveryNIterations === 0) {
            reportProgress(currentProgress);
            await new Promise(resolve => setTimeout(resolve, 0));
        }

        const newSol = SetlistPlanGetRandomMutation(saConfig, currentProgress.bestState, costCalcConfig, allSongs);
        if (newSol === null) {
            console.log(`breaking because no mutation found.`);
            break;
        }
        const delta = newSol.cost.totalCost - currentProgress.bestState.cost.totalCost;
        if (delta < 0) {
            currentProgress.bestState = newSol;
            if (newSol.cost.totalCost < bestProgress.bestState.cost.totalCost) {
                bestProgress.bestState = newSol;
            }
        } else {
            if (Math.random() < Math.exp(-delta / T)) {
                currentProgress.bestState = newSol;
            }
        }
        T *= saConfig.coolingRate;
    }

    return bestProgress;
}






export async function SetlistPlanAutoFillSA(
    saConfig: SimulatedAnnealingConfig,
    initialState: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    allSongs: db3.SongPayload[],
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    const stats = CalculateSetlistPlanStatsForCostCalc(initialState);
    const cost = CalculateSetlistPlanCost({ plan: initialState, stats }, costCalcConfig, allSongs);
    const state: SetlistPlanSearchState = { plan: initialState, stats, cost };

    return await AutoCompleteSetlistPlanSA(saConfig, state, costCalcConfig, allSongs, cancellationTrigger, reportProgress);

}





