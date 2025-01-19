// this is effectively best-first search and if left to run it will find an optimal best solution.
// but it wants to search the whole space.
// optimization would be helpful, but there should be some additional constraints to reduce branching.

import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { AStarSearchProgressState, CalculateSetlistPlanCost, CalculateSetlistPlanStatsForCostCalc, GetSetlistPlanKey, MinPriorityQueue, SetlistPlanCostPenalties, SetlistPlanSearchProgressState, SetlistPlanSearchState } from "./SetlistPlanUtilities";
import { AStarSearchConfig } from "./SetlistPlanAutocompleteAStar";
import { Stopwatch } from "shared/rootroot";

type AStar2SearchConfig = AStarSearchConfig;

// let's try A* again, this time though we will imagine the "steps" as filling out cell by cell.
// originall this was too large of a search space, now let's try ONLY filling in the <=1 ideal value per cell.
// this still results in a too-large search space.
export const SetlistPlanGetNeighborsForAStar2 = (aStarConfig: AStar2SearchConfig, isAlreadyVisited: (state: SetlistPlanSearchState) => boolean, currentDepth: number, state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties): SetlistPlanSearchState[] => {
    const neighbors: SetlistPlanSearchState[] = [];
    const planJSON = JSON.stringify(state.plan);

    let valuesToTry: {
        columnId: string;
        rowId: string;
        pointsToAllocate: number;
    }[] = [];

    for (let columnIndex = 0; columnIndex < state.plan.payload.columns.length; columnIndex++) {
        let columnStat = state.stats.segmentStats[columnIndex]!;
        if (columnStat.pointsStillAvailable <= 0) {
            continue;
        }
        for (let rowIndex = 0; rowIndex < state.plan.payload.rows.length; rowIndex++) {
            let rowStat = state.stats.songStats[rowIndex]!;
            if (rowStat.pointsStillNeeded <= 0) {
                continue;
            }
            const idealVal = state.stats.getIdealValueForCell(columnIndex, rowIndex);
            if (idealVal === undefined) {
                // this means the cell is occupied already.
                continue;
            }

            valuesToTry.push({
                columnId: columnStat.segment.columnId,
                rowId: rowStat.rowId,
                pointsToAllocate: idealVal,
            });
        }
    }

    // cull neighbors. we should favor taking neighbors with higher values; in general we will fill in bigger stuff before laying in small.
    valuesToTry.sort((a, b) => b.pointsToAllocate - a.pointsToAllocate);
    if (currentDepth >= aStarConfig.depthsWithoutCulling) {
        let takeCount = aStarConfig.cullPercent01 ? Math.floor(valuesToTry.length * aStarConfig.cullPercent01) : valuesToTry.length;
        if (aStarConfig.cullClampMin) {
            takeCount = Math.max(aStarConfig.cullClampMin, takeCount);
        }
        if (aStarConfig.cullClampMax) {
            takeCount = Math.min(aStarConfig.cullClampMax, takeCount);
        }
        valuesToTry = valuesToTry.slice(0, takeCount);
    }

    // generate unculled neighbors    
    for (const val of valuesToTry) {
        const newState = {
            plan: JSON.parse(planJSON) as SetlistPlan,
            stats: state.stats,
            cost: state.cost,
            totalCost: state.totalCost, // NOTE this is not correct until we calculate it later.
            stateId: state.stateId,
        };
        newState.plan.payload.cells.push({
            rowId: val.rowId,
            columnId: val.columnId,
            pointsAllocated: val.pointsToAllocate,
            autoFilled: true,
        });
        newState.stateId = GetSetlistPlanKey(newState.plan);
        if (isAlreadyVisited(newState)) continue; // short circuit; skip costly calcs

        newState.stats = CalculateSetlistPlanStatsForCostCalc(newState.plan);
        newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig);
        newState.totalCost = newState.cost.totalCost;

        neighbors.push(newState);
    }

    return neighbors;
}



function IsGoal(state: SetlistPlanSearchState): boolean {
    //return state.stats.totalPlanSegmentBalance >= 0;
    //return state.stats.totalPlanSongBalance >= 0;
    return state.stats.totalPlanSongBalance >= 0 || state.stats.totalPlanSegmentBalance >= 0;
}

type UnknownSearch2StateBase = {
    totalCost: number;
    stateId: string;
};

export async function UnknownSearch2<S extends UnknownSearch2StateBase>(
    initialState: S,
    options: {
        getNeighbors: (state: S, depth: number, isAlreadyVisited: (state: S) => boolean) => S[];
        isGoal: (state: S) => boolean;
    },
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (progress: AStarSearchProgressState<S>) => void
): Promise<AStarSearchProgressState<S>> {
    const sw = new Stopwatch();
    const reportEveryNSteps = 10;

    const openQueue = new MinPriorityQueue<S>();
    const closedSet = new Set<string>();        // track visited/expanded states

    let bestState: S = initialState;

    openQueue.push(initialState, initialState.totalCost);

    let depth = 0;
    let iteration = 1;
    console.log(`a star 2`);

    while (!openQueue.isEmpty()) {
        depth++;

        const currentState = openQueue.pop()?.element;
        if (!currentState) break;

        //console.log(`iteration:${iteration} current.cost: ${currentState.totalCost}, best.cost: ${bestState.totalCost}`);

        if (currentState.totalCost < bestState.totalCost) {
            //console.log(`new best cost at iteration ${iteration}: ${currentState.totalCost}`);
            bestState = currentState;
        }

        if (depth % reportEveryNSteps === 0) {
            reportProgress({
                elapsedMillis: sw.ElapsedMillis,
                bestState,
                currentState,
                depth,
                iteration,
            });
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        if (cancellationTrigger.current) {
            break;
        }

        // if (options.isGoal(currentState)) {
        //     bestState = currentState;
        //     break;
        // }

        closedSet.add(currentState.stateId);

        const neighbors = options.getNeighbors(
            currentState,
            depth,
            (s) => closedSet.has(s.stateId));

        // neighbors returned are assumed to be never visited before.
        // push all neighbors with favorable cost (assumption that each step will reduce cost when taking the optimal path)
        // discarded neighbors  pushed to closedSet.
        for (const neighbor of neighbors) {
            iteration++;
            if (neighbor.totalCost <= currentState.totalCost) {
                openQueue.push(neighbor, neighbor.totalCost);
            } else {
                closedSet.add(neighbor.stateId);
            }
        }
    }

    const progress = {
        elapsedMillis: sw.ElapsedMillis,
        bestState,
        currentState: bestState,
        depth,
        iteration,
    };
    reportProgress(progress);
    return progress;
}



export async function SetlistPlanAutoFillAStar2(
    aStarConfig: AStarSearchConfig,
    initialState: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    const stats = CalculateSetlistPlanStatsForCostCalc(initialState);
    const cost = CalculateSetlistPlanCost({ plan: initialState, stats }, costCalcConfig);
    const state: SetlistPlanSearchState = { plan: initialState, stats, cost, totalCost: cost.totalCost, stateId: GetSetlistPlanKey(initialState), };

    const result = UnknownSearch2<SetlistPlanSearchState>(state, {
        getNeighbors: (state, depth, isAlreadyVisited) => SetlistPlanGetNeighborsForAStar2(aStarConfig, isAlreadyVisited, depth, state, costCalcConfig),
        isGoal: IsGoal,
    }, cancellationTrigger, reportProgress);

    return result;
}





