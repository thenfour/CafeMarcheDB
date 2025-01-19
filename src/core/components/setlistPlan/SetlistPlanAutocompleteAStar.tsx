import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { AStarSearchProgressState, CalculateSetlistPlanCost, CalculateSetlistPlanStatsForCostCalc, GetSetlistPlanKey, MinPriorityQueue, SetlistPlanCostPenalties, SetlistPlanSearchProgressState, SetlistPlanSearchState } from "./SetlistPlanUtilities";

export interface AStarSearchConfig {
    depthsWithoutCulling: number;
    cullPercent01: number | undefined;
    cullClampMin: number | undefined; // if % gives us less than this many, still allow this many.
    cullClampMax: number | undefined; // if % gives us more than this many, still cap at this many.
};

// let's try A* again, this time though we will imagine the "steps" as filling out cell by cell.
// originall this was too large of a search space, now let's try ONLY filling in the <=1 ideal value per cell.
// this still results in a too-large search space.
export const SetlistPlanGetNeighborsForAStar = (aStarConfig: AStarSearchConfig, currentDepth: number, state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties): SetlistPlanSearchState[] => {
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
        };
        newState.plan.payload.cells.push({
            rowId: val.rowId,
            columnId: val.columnId,
            pointsAllocated: val.pointsToAllocate,
            autoFilled: true,
        });

        newState.stats = CalculateSetlistPlanStatsForCostCalc(newState.plan);
        newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig);

        neighbors.push({ ...newState, totalCost: newState.cost.totalCost, stateId: GetSetlistPlanKey(newState.plan) });
    }

    return neighbors;
}



function IsGoal(state: SetlistPlanSearchState): boolean {
    //return state.stats.totalPlanSegmentBalance >= 0;
    //return state.stats.totalPlanSongBalance >= 0;
    return state.stats.totalPlanSongBalance >= 0 || state.stats.totalPlanSegmentBalance >= 0;
}



/**
 * A generic A* function that doesn't know anything about your domain.
 *
 * @param initialState - The initial search state.
 * @param options - Object containing callbacks and utility functions for A*.
 *     getNeighbors:  Given a state, return an array (or promise of array) of neighbor states.
 *     isGoal:        Check if the given state is a goal.
 *     getGCost:      Get the accumulated cost g(n) of a state.
 *     getHCost:      Get the heuristic cost h(n) of a state.
 *     getStateId:    Return a unique identifier for the state (for caching).
 * @param cancellationTrigger - Use this if you need to abort the search early.
 * @param reportProgress - A callback that receives intermediate progress updates.
 */
export async function AStarSearch<S>(
    initialState: S,
    options: {
        getNeighbors: (state: S, depth: number) => S[] | Promise<S[]>;
        isGoal: (state: S) => boolean;
        getGCost: (state: S) => number;
        getHCost: (state: S) => number;
        getStateId: (state: S) => string;
    },
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (progress: AStarSearchProgressState<S>) => void
): Promise<AStarSearchProgressState<S>> {
    // Example stopwatch or timer utility
    const startTime = performance.now();
    const reportEveryNSteps = 10;

    // For priority queue, you could use an external library or your own Min-Heap.
    // We'll assume MinPriorityQueue<T> has push(item, priority) and pop() => {element, priority}
    const openSet = new MinPriorityQueue<{ state: S; f: number }>();
    const closedSet = new Set<string>();        // track visited/expanded states
    const gScore = new Map<string, number>();  // track lowest g cost found for a state

    // Initial costs
    const initialG = options.getGCost(initialState);
    const initialH = options.getHCost(initialState);
    const initialF = initialG + initialH;
    const initialId = options.getStateId(initialState);

    // Initialize data structures
    gScore.set(initialId, initialG);
    openSet.push({ state: initialState, f: initialF }, initialF);

    let bestState = initialState;  // track the best state encountered
    let steps = 0;
    let iteration = 1;

    // A small helper to compute elapsed time
    const getElapsedMillis = () => performance.now() - startTime;

    while (!openSet.isEmpty()) {
        steps++;

        // Pop the node with the smallest f
        const current = openSet.pop();
        if (!current) break;

        // Report progress
        if (steps % reportEveryNSteps === 0) {
            reportProgress({
                elapsedMillis: getElapsedMillis(),
                bestState,
                currentState: current.element.state,
                depth: steps,
                iteration,
            });
            await new Promise(resolve => setTimeout(resolve, 0));
        }
        // Allow async cancellation
        if (cancellationTrigger.current) {
            return {
                elapsedMillis: getElapsedMillis(),
                bestState,
                currentState: current.element.state,
                depth: steps,
                iteration,
            };
        }

        const currentState = current.element.state;
        const currentF = current.priority; // f = g + h
        const currentId = options.getStateId(currentState);

        // If we've already expanded this state, skip.
        if (closedSet.has(currentId)) {
            continue;
        }
        closedSet.add(currentId);

        // Check for goal
        if (options.isGoal(currentState)) {
            // Found the goal, return immediately (or reconstruct path if needed).
            bestState = currentState;
            const final = {
                elapsedMillis: getElapsedMillis(),
                bestState,
                currentState: current.element.state,
                depth: steps,
                iteration,
            };
            reportProgress(final);
            return final;
        }

        // Expand neighbors
        const neighbors = await Promise.resolve(options.getNeighbors(currentState, steps));
        for (const neighbor of neighbors) {
            iteration++;
            const neighborG = options.getGCost(neighbor);
            const neighborH = options.getHCost(neighbor);
            const neighborF = neighborG + neighborH;
            const neighborId = options.getStateId(neighbor);

            // If neighbor hasn't been visited or we found a cheaper path, update and push
            const knownG = gScore.get(neighborId);
            if (knownG === undefined || neighborG < knownG) {
                gScore.set(neighborId, neighborG);
                openSet.push({ state: neighbor, f: neighborF }, neighborF);
            }
        }

        // (Optional) You can track a "best" so far if you want the best f-scores or g-scores:
        if (currentF < options.getGCost(bestState) + options.getHCost(bestState)) {
            bestState = currentState;
        }
    }

    // If the loop finishes without finding a goal, we return whatever "best" we have.
    const progress = {
        elapsedMillis: getElapsedMillis(),
        bestState,
        currentState: bestState,
        depth: steps,
        iteration,
    };
    reportProgress(progress);
    return progress;
}



// // unfortunately it doesn't work ; this attempts to ONLY follow improving paths but either i messed up or it simply fails to find the best paths.
// async function AStarSearch<S>(
//     initialState: S,
//     options: {
//         getNeighbors: (state: S, depth: number) => S[] | Promise<S[]>;
//         isGoal: (state: S) => boolean;
//         getGCost: (state: S) => number;
//         getHCost: (state: S) => number;
//         getStateId: (state: S) => string;
//     },
//     cancellationTrigger: React.MutableRefObject<boolean>,
//     reportProgress: (progress: AStarSearchProgressState<S>) => void
// ): Promise<AStarSearchProgressState<S>> {
//     // Example stopwatch or timer utility
//     //console.log(`astar start`);
//     const startTime = performance.now();

//     // For priority queue, you could use an external library or your own Min-Heap.
//     // We'll assume MinPriorityQueue<T> has push(item, priority) and pop() => {element, priority}
//     const openSet = new MinPriorityQueue<{ state: S }>();
//     const closedSet = new Set<string>();        // track visited/expanded states
//     const gScore = new Map<string, number>();  // track lowest g cost found for a state

//     // Initial costs
//     const initialG = options.getGCost(initialState);
//     const initialH = options.getHCost(initialState);
//     //const initialF = initialG + initialH;
//     const initialId = options.getStateId(initialState);

//     // Initialize data structures
//     gScore.set(initialId, initialG);
//     openSet.push({ state: initialState }, initialG);

//     let bestState = initialState;  // track the best state encountered
//     let bestG = initialG;
//     let steps = 0;
//     let iteration = 1;
//     const reportEveryNSteps = 1;

//     // A small helper to compute elapsed time
//     const getElapsedMillis = () => performance.now() - startTime;

//     while (!openSet.isEmpty()) {
//         steps++;

//         // Pop the node with the smallest f
//         const current = openSet.pop();
//         if (!current) break;

//         const currentState = current.element.state;
//         //const currentF = current.priority; // f = g + h
//         const currentId = options.getStateId(currentState);

//         // If we've already expanded this state, skip.
//         if (closedSet.has(currentId)) {
//             continue;
//         }
//         closedSet.add(currentId);

//         if (current.priority > bestG) continue;

//         bestState = currentState;
//         bestG = current.priority;

//         // Report progress
//         if (steps % reportEveryNSteps === 0) {
//             reportProgress({
//                 elapsedMillis: getElapsedMillis(),
//                 bestState,
//                 currentState,
//                 depth: steps,
//                 iteration,
//             });
//             await new Promise(resolve => setTimeout(resolve, 0));
//         }
//         // Allow async cancellation
//         if (cancellationTrigger.current) {
//             return {
//                 elapsedMillis: getElapsedMillis(),
//                 bestState,
//                 currentState,
//                 depth: steps,
//                 iteration,
//             };
//         }

//         // Check for goal
//         if (options.isGoal(currentState)) {
//             // Found the goal, return immediately (or reconstruct path if needed).
//             bestState = currentState;
//             const final = {
//                 elapsedMillis: getElapsedMillis(),
//                 bestState,
//                 currentState,
//                 depth: steps,
//                 iteration,
//             };
//             reportProgress(final);
//             return final;
//         }

//         // (Optional) You can track a "best" so far if you want the best f-scores or g-scores:
//         // if (currentG < bestG) {
//         //     bestState = currentState;
//         //     bestG = currentG;
//         // }

//         // Expand neighbors
//         const neighbors = await Promise.resolve(options.getNeighbors(currentState, steps));
//         for (const neighbor of neighbors) {
//             iteration++;
//             const neighborG = options.getGCost(neighbor);
//             const neighborH = options.getHCost(neighbor);
//             //const neighborF = neighborG + neighborH;
//             const neighborId = options.getStateId(neighbor);

//             // If neighbor hasn't been visited or we found a cheaper path, update and push
//             const knownG = gScore.get(neighborId);
//             if (knownG) continue;
//             // only push if we have a better g score than best
//             if (neighborG <= bestG) {
//                 gScore.set(neighborId, neighborG);
//                 openSet.push({ state: neighbor }, neighborG);
//             }
//         }
//     }

//     // If the loop finishes without finding a goal, we return whatever "best" we have.
//     const progress = {
//         elapsedMillis: getElapsedMillis(),
//         bestState,
//         currentState: bestState,
//         depth: steps,
//         iteration,
//     };
//     reportProgress(progress);
//     return progress;
// }







export async function SetlistPlanAutoFillAStar(
    aStarConfig: AStarSearchConfig,
    initialState: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    const stats = CalculateSetlistPlanStatsForCostCalc(initialState);
    const cost = CalculateSetlistPlanCost({ plan: initialState, stats }, costCalcConfig);
    const state: SetlistPlanSearchState = { plan: initialState, stats, cost, totalCost: cost.totalCost, stateId: GetSetlistPlanKey(initialState), };

    const result = AStarSearch<SetlistPlanSearchState>(state, {
        getNeighbors: (state, depth) => SetlistPlanGetNeighborsForAStar(aStarConfig, depth, state, costCalcConfig),
        isGoal: IsGoal,
        getGCost: (state) => state.cost.totalCost,
        getHCost: (state) => Math.abs(state.stats.totalPlanSongBalance),
        getStateId: (s) => GetSetlistPlanKey(s.plan),
    }, cancellationTrigger, reportProgress);

    return result;
}





