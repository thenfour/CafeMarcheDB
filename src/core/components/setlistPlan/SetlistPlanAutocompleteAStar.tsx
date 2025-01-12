// bleh still not ideal; it doesn't find the optimal solution often.
// so there are several issues with a*
// - it doesn't actually find the correct solution sometimes. so something is just wrong in the algo.
// - the neighbors function works i think but it doesn't lead to optimal search space.
// 
// probably multi-phase search is needed due to search space complexity / size,
// as well as fixing the algo.

// but yea this feels more like a knapsack problem than a pathfinding search; 

//import { generateFibonacci } from "shared/utils";
import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { CalculateSetlistPlanCost, CalculateSetlistPlanStats, CostResult, GetSetlistPlanKey, SetlistPlanCostPenalties, SetlistPlanStats } from "./SetlistPlanUtilities";
import * as db3 from "src/core/db3/db3";
import { Stopwatch } from "shared/rootroot";

//const MAX_POINTS_PER_REHEARSAL = 8;

//const FIBONACCI_SEQUENCE = generateFibonacci(1000);

export type SetlistPlanSearchState = {
    plan: SetlistPlan;
    stats: SetlistPlanStats;
    cost: CostResult;
};

// // for each unallocated cells from firstAvailableAutoFillCellIndex, try all possible points. does not consider semantics of rehearsals or songs, just fills in any available blank.
// // never change existing allocations.
// export const SetlistPlanGetNeighborsLinear = (state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties, allSongs: db3.SongPayload[]): SetlistPlanSearchState[] => {

//     const neighbors: SetlistPlanSearchState[] = [];
//     const planJSON = JSON.stringify(state.plan);
//     const endLinearIndex = state.plan.payload.rows.length * state.plan.payload.columns.length;
//     const columnCount = state.plan.payload.columns.length;

//     for (let i = state.stats.firstAvailableAutoFillCellIndex; i < endLinearIndex; i++) {
//         const columnIndex = i % columnCount;
//         const rowIndex = Math.floor(i / columnCount);
//         const rowId = state.stats.songStats[rowIndex]!.rowId;
//         const columnId = state.plan.payload.columns[columnIndex]!.columnId;
//         const possibilities = state.stats.getPossibleValuesForCell(columnIndex, rowIndex);
//         //console.log(`[${columnIndex},${rowIndex}] ${possibilities}`);
//         for (const points of possibilities) {
//             const newState = {
//                 plan: JSON.parse(planJSON) as SetlistPlan,
//                 stats: state.stats,
//                 cost: state.cost,
//             };
//             newState.plan.payload.cells.push({
//                 rowId,
//                 columnId,
//                 pointsAllocated: points,
//                 autoFilled: true,
//             });

//             newState.stats = CalculateSetlistPlanStats(newState.plan, allSongs);
//             newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig, allSongs);

//             neighbors.push(newState);
//         }
//     }

//     return neighbors;
// };

// another approach is to conceptualize the plan choronologically, where each step fills in the next song to rehearse.
// the assumption is that all rehearsal points will be used up, so each step decides which song gets played at that point.
// skipping slots is also a possibility; the idea is to return all possible "next songs" in the current rehearsal.
// including advancing to the next rehearsal.
// for each unallocated cells from firstAvailableAutoFillCellIndex, try all possible points. does not consider semantics of rehearsals or songs, just fills in any available blank.
// never change existing allocations.
export const SetlistPlanGetNeighborsLinear = (state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties, allSongs: db3.SongPayload[]): SetlistPlanSearchState[] => {
    const neighbors: SetlistPlanSearchState[] = [];
    const planJSON = JSON.stringify(state.plan);
    const rowCount = state.plan.payload.rows.length;
    const lastAutoFillCoord = state.stats.linearIndexOfLastAutoFillCell !== undefined ? state.stats.cellIndexToColumnRow(state.stats.linearIndexOfLastAutoFillCell) : undefined;
    let columnIndex = lastAutoFillCoord ? lastAutoFillCoord.columnIndex : 0;
    let rowIndex = lastAutoFillCoord ? lastAutoFillCoord.rowIndex + 1 : 0;
    if (rowIndex >= rowCount) {
        columnIndex++;
        rowIndex = 0;
    }
    const columnCount = state.plan.payload.columns.length;
    // advance to a column with available slots
    while (true) {
        if (columnIndex >= columnCount) {
            return [];
        }
        const colStat = state.stats.segmentStats[columnIndex]!;
        if (colStat.pointsStillAvailable > 0) {
            break;
        }
        // when we advance to a new column, reset row index to 0.
        rowIndex = 0;
        columnIndex++;
    }
    //console.log(`lastAutoFillCoord:${lastAutoFillCoord?.columnIndex},${lastAutoFillCoord?.rowIndex}  => columnIndex: ${columnIndex}, rowIndex: ${rowIndex}, rowCount: ${rowCount}`);
    for (; rowIndex < rowCount; rowIndex++) {
        //const columnIndex = i % columnCount;
        //const rowIndex = Math.floor(i / columnCount);
        const rowId = state.stats.songStats[rowIndex]!.rowId;
        const columnId = state.plan.payload.columns[columnIndex]!.columnId;
        const possibilities = state.stats.getPossibleValuesForCell(columnIndex, rowIndex);
        //console.log(`  -> [${columnIndex}, ${rowIndex}] ${possibilities}`);
        //console.log(`[${columnIndex},${rowIndex}] ${possibilities}`);
        for (const points of possibilities) {
            const newState = {
                plan: JSON.parse(planJSON) as SetlistPlan,
                stats: state.stats,
                cost: state.cost,
            };
            newState.plan.payload.cells.push({
                rowId,
                columnId,
                pointsAllocated: points,
                autoFilled: true,
            });

            newState.stats = CalculateSetlistPlanStats(newState.plan, allSongs);
            newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig, allSongs);

            neighbors.push(newState);
        }

        // offer the option to move to the next rehearsal.
    }

    return neighbors;
};





export interface AStarSearchProgressState<T> {
    iteration: number;
    depth: number;
    elapsedMillis: number;
    bestState: T;
    //bestCost: number;
};




interface AStarNode {
    state: SetlistPlanSearchState;
    g: number; // actual cost so far
    h: number; // estimated cost to the goal
    f: number; // g + h
}

/**
 * Priority Queue / Min-Heap interface:
 * You can use a library like "mnemonist" or "fastpriorityqueue".
 * For simplicity, a basic array-based approach is shown (not fully optimized).
 */
class MinPriorityQueue<T> {
    private data: { item: T; priority: number }[] = [];

    push(item: T, priority: number) {
        this.data.push({ item, priority });
    }

    pop(): T | undefined {
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
        return element!.item;
    }

    isEmpty(): boolean {
        return this.data.length === 0;
    }
}

function IsGoal(state: SetlistPlanSearchState): boolean {
    return state.stats.totalPlanSegmentBalance >= 0;
    //return state.stats.totalPlanSongBalance >= 0;
    //return state.stats.totalPlanSongBalance >= 0 || state.stats.totalPlanSegmentBalance >= 0;
}


/*
    when we calculate cost, that's considered "distance from ideal". ideal is 0 cost. as if there's a path to the goal which is totally free if only we knew where to step.
    to make this work for A*, the estimated cost to the goal (h) must be admissible. that is, it must never overestimate the cost to reach the goal.
    it means the actual cost for a state can NEVER be "0" or negative, because the estimated cost would necessarily need to be 0 or negative which makes no sense.
    let's think of the actual cost as the rehearsal points used to reach the goal.
    the estimated cost is the remaining rehearsal points to reach the goal.
    the penalties incurred influence the heuristic.

    initially i was having a difficult time understanding how to think of mapping cost to A*. but we can also think of the "journey" as the literal time sequence of rehearsing songs.
    assuming the rehearsal time is fixed, and we must use it up...
*/
export async function AutoCompleteSetlistPlanAStar(
    initialState: SetlistPlanSearchState,
    costCalcConfig: SetlistPlanCostPenalties,
    allSongs: db3.SongPayload[],
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: AStarSearchProgressState<SetlistPlanSearchState>) => void
): Promise<AStarSearchProgressState<SetlistPlanSearchState>> {

    const sw = new Stopwatch();

    // Compute cost so far (g) and heuristic (h) for the initial state
    const initialG = initialState.cost.totalCost;//   CalculateSetlistPlanCost(initialPlan, costCalcConfig).totalCost;
    const initialH = initialState.stats.totalPlanSongBalance;
    const initialNode: AStarNode = {
        state: initialState,
        g: initialG,
        h: initialH,
        f: initialG + initialH,
    };

    // Priority queue (min-heap) sorted by f = g + h
    const openSet = new MinPriorityQueue<AStarNode>();
    openSet.push(initialNode, initialNode.f);

    let bestNode: AStarNode = initialNode;
    let iteration = 1;
    let steps = 0;

    while (!openSet.isEmpty()) {
        steps++;
        const progress = {
            elapsedMillis: sw.ElapsedMillis,
            bestState: bestNode.state,
            depth: steps,
            iteration,
        };
        reportProgress(progress);
        await new Promise(resolve => setTimeout(resolve, 0));

        if (cancellationTrigger.current) {
            return progress;
        }

        // Pop the node with the smallest f = g + h (done by the pri queue)
        const currentNode = openSet.pop();
        if (!currentNode) break;

        // Goal check: If no points remaining, this is a valid completion.
        if (IsGoal(currentNode.state)) {
            bestNode = currentNode;
            break;
        }

        const neighborStates = SetlistPlanGetNeighborsLinear(currentNode.state, costCalcConfig, allSongs);
        console.log(`step ${steps} generated ${neighborStates.length} neighbors`);

        for (const neighborState of neighborStates) {
            iteration++;
            const neighborG = neighborState.cost.totalCost;
            const neighborH = neighborState.stats.totalPlanSongBalance;
            const neighborF = neighborG + neighborH;
            openSet.push({ state: neighborState, g: neighborG, h: neighborH, f: neighborF }, neighborF);
        }
    }

    const progress = {
        elapsedMillis: sw.ElapsedMillis,
        bestState: bestNode.state,
        depth: steps,
        iteration,
    };
    reportProgress(progress);

    return progress;
}






export async function SetlistPlanAutoFillAStar(
    initialState: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    allSongs: db3.SongPayload[],
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: AStarSearchProgressState<SetlistPlanSearchState>) => void
): Promise<AStarSearchProgressState<SetlistPlanSearchState>> {

    const stats = CalculateSetlistPlanStats(initialState, allSongs);
    const cost = CalculateSetlistPlanCost({ plan: initialState, stats }, costCalcConfig, allSongs);
    const state: SetlistPlanSearchState = { plan: initialState, stats, cost };

    return await AutoCompleteSetlistPlanAStar(state, costCalcConfig, allSongs, cancellationTrigger, reportProgress);

}





