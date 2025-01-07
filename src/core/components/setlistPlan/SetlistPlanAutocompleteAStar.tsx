import { generateFibonacci } from "shared/utils";
import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";

const MAX_POINTS_PER_REHEARSAL = 8;

const FIBONACCI_SEQUENCE = generateFibonacci(1000);

// return a set of mutations on the plan, which attempt all possible ways to make 1 additional allocation of points.
// avoid duplicate allocations (rowId + columnId pairs)
//
// if we could identify scenarios that CANNOT lead to better paths, then we could optimize this.
// but theoretically all paths could lead to optimal solutions. there are unlikely scenarios where we could skip some paths.
// - allocating very small point values to songs that have a LOT of points available or 
export const SetlistPlanGetNeighbors = (plan: SetlistPlan, depth: number, allowNonOptimalAllocations: boolean): SetlistPlan[] => {
    const neighbors: SetlistPlan[] = [];
    const planJSON = JSON.stringify(plan);
    const allocatableSongCount = plan.payload.rows.filter(row => (row.pointsRequired || 0) > 0).length;

    plan.payload.rows.forEach((row, rowIndex) => {
        const stillAllocated = plan.payload.cells.filter((cell) => cell.rowId === row.rowId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
        const stillNeeded = (row.pointsRequired || 0) - stillAllocated;
        if (stillNeeded <= 0) return;

        plan.payload.columns.forEach((col, colIndex) => {
            // if the cell is already allocated, skip it. don't attempt to change allocations; that is handled by other iterations.
            if (plan.payload.cells.some(cell => cell.rowId === row.rowId && cell.columnId === col.columnId && !!cell.pointsAllocated)) {
                return;
            }

            const pointsAllocatedToColumn = plan.payload.cells
                .filter(cell => cell.columnId === col.columnId)
                .reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
            const pointsPermittedInColumn = col.pointsAvailable || 0;
            const pointsAvailableInColumn = Math.max(1, pointsPermittedInColumn - pointsAllocatedToColumn); // necessary to allocate a non-fibonacci number of points to fill a rehearsal.
            const maxAllocatablePoints = Math.min(stillNeeded);

            // an ideal allocation the largest that either fits the column (up to max points per rehearsal), or completes the song.
            const idealAllocation = Math.min(pointsAvailableInColumn, maxAllocatablePoints, MAX_POINTS_PER_REHEARSAL);

            // when depth is less than half of the # of songs-to-allocate, then only allocate the ideal amount. it means the board is empty enough that we don't need to tweak small allocations.
            const onlyUseIdeal = depth < allocatableSongCount;

            // add a neighbor for each fibonacci number of points to allocate up to stillNeeded.
            const pointsToTry = onlyUseIdeal ?
                new Set<number>([idealAllocation])
                : new Set<number>([...FIBONACCI_SEQUENCE.filter(fib => fib < maxAllocatablePoints), maxAllocatablePoints, pointsAvailableInColumn]);

            pointsToTry.forEach(pointsToAllocate => {
                const newPlan = JSON.parse(planJSON);

                const cell = newPlan.payload.cells.find(cell => cell.rowId === row.rowId && cell.columnId === col.columnId)
                if (cell) {
                    return; // do not clobber.
                }

                newPlan.payload.cells.push({ rowId: row.rowId, columnId: col.columnId, pointsAllocated: pointsToAllocate });

                neighbors.push(newPlan);
            });

        });
    });

    return neighbors;
};




// type SetlistSongStat = ReturnType<typeof GetSetlistPlanStats>["songStats"][0];
// type SetlistColumnStat = ReturnType<typeof GetSetlistPlanStats>["columnStats"][0];


// function GetPossiblePointsToAllocateForCell(songStat: SetlistSongStat, colStat: SetlistColumnStat, rowId: string, columnId: string, onlyUseIdeal: boolean): number[] {
//     //const colStat = stats.columnStats.find(col => col.columnId === columnId)!;
//     //const songStat = stats.songStats.find(song => song.rowId === rowId)!;
//     const songStillNeeds = songStat.pointsRequired - songStat.totalPointsAllocated;
//     if (songStillNeeds <= 0 || colStat.pointsAvailable <= 0) {
//         return []; // no points can be attempted.
//     }

//     const idealAllocation = Math.min(MAX_POINTS_PER_REHEARSAL, songStillNeeds, colStat.pointsAvailable);

//     // add a neighbor for each fibonacci number of points to allocate up to stillNeeded.
//     const pointsToTry = onlyUseIdeal ?
//         new Set<number>([idealAllocation])
//         : new Set<number>([...FIBONACCI_SEQUENCE.filter(fib => fib < songStillNeeds), songStillNeeds, colStat.pointsAvailable]);
//     return [...pointsToTry];
// }

// export const SetlistPlanGetNeighbors = (plan: SetlistPlan, depth: number, allowNonOptimalAllocations: boolean): SetlistPlan[] => {
//     const planJSON = JSON.stringify(plan); // the initial plan every neighbor is based on.
//     const planStats = GetSetlistPlanStats(plan);

//     // each neighbor will be the starting plan with a single cell allocation ADDED for each row.

//     // let's go row-by-row. for each row, generate a list of mutations just for that row.
//     const rowMutationMap = new Map<string, SetlistPlanCell[][]>(); // map of rowId -> list of all possible cell allocations for that row (these will include the existing allocations from incoming plan, plus 1 additional)

//     // for each row, generate a list of mutations.
//     for (const row of plan.payload.rows) {
//         const cellsForThisRow: SetlistPlanCell[] = plan.payload.cells.filter(cell => cell.rowId === row.rowId);
//         const songStat = planStats.songStats.find(song => song.rowId === row.rowId)!;
//         if (songStat.pointsStillNeeded <= 0) {
//             continue;
//         }

//         const onlyUseIdeal = true;//depth < plan.payload.rows.length;

//         // generate a list of mutations for this row. that is, all possible combinations of point value assignments for all unallocated columns.
//         // the possible combinations of point value assignments for a single cell is returned by GetPossiblePointsToAllocateForCell.
//         const mutations: SetlistPlanCell[][] = [];
//         const columnsWhichHaveNoAllocationForThisRow = plan.payload.columns.filter(col => !cellsForThisRow.some(cell => cell.columnId === col.columnId));
//         //for (const cell of cellsForThisRow) {
//         for (const col of columnsWhichHaveNoAllocationForThisRow) {
//             const colstat = planStats.columnStats.find(c => c.columnId === col.columnId)!;
//             const pointsToAllocate = GetPossiblePointsToAllocateForCell(songStat, colstat, row.rowId, col.columnId, onlyUseIdeal);
//             if (pointsToAllocate.length === 0) {
//                 continue;
//             }

//             pointsToAllocate.forEach(points => {
//                 mutations.push([
//                     ...cellsForThisRow.filter(c => c.columnId !== col.columnId),
//                     {
//                         rowId: row.rowId,
//                         columnId: col.columnId,
//                         pointsAllocated: points,
//                     }
//                 ]);
//             });

//             // add this row's mutations to the map.
//             rowMutationMap.set(row.rowId, mutations);
//         }
//     };

//     // let's generate all neighbors.
//     // each row has been mapped to a list of mutations for that row.
//     // using ONLY ideal values, in a 12 row by 13 column grid, each row has 13 possible mutations. that's 13^12 = 179,216,039,403 possible neighbors, which is a lot.
//     const neighbors: SetlistPlan[] = [];

//     // ... this is not practical.

//     return neighbors;
// };





















export interface AStarSearchProgressState<T> {
    iteration: number;
    depth: number;
    durationSeconds: number;
    bestPlan: T;
    bestCost: number;
};


// // if pointsRemaining is 0, the algorithm is effectively dijkstra's.
// function PointsRemaining(plan: SetlistPlan): number {
//     //return 0;
//     const allocated = plan.payload.cells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
//     const required = plan.payload.rows.reduce((acc, row) => acc + (row.pointsRequired || 0), 0);
//     return (required - allocated);
// }

// /**
//  * Get a unique key for a plan, based on the cells that have points allocated.
//  */
// function getPlanKey(plan: SetlistPlan): string {
//     // for deterministic behavior make sure cells are sorted by row then column ids.
//     const sortedCells = toSorted(plan.payload.cells.filter(x => !!x.pointsAllocated), (a, b) => {
//         if (a.rowId === b.rowId) {
//             return a.columnId.localeCompare(b.columnId);
//         }
//         return a.rowId.localeCompare(b.rowId);
//     });

//     return sortedCells.map(cell => `${cell.rowId}/${cell.columnId}/${cell.pointsAllocated}`).join(',');
// }



// // /**
// //  * A* node representation.
// //  * - plan: the current plan
// //  * - g: the actual cost so far (from the start plan to this plan)
// //  * - h: the heuristic cost (estimated cost to reach a "fully completed" plan)
// //  * - f: sum of g + h
// //  */
// // interface AStarNode {
// //     plan: SetlistPlan;
// //     g: number;
// //     h: number;
// //     f: number;
// // }

// // /**
// //  * Priority Queue / Min-Heap interface:
// //  * You can use a library like "mnemonist" or "fastpriorityqueue".
// //  * For simplicity, a basic array-based approach is shown (not fully optimized).
// //  */
// // class MinPriorityQueue<T> {
// //     private data: { item: T; priority: number }[] = [];

// //     push(item: T, priority: number) {
// //         this.data.push({ item, priority });
// //     }

// //     pop(): T | undefined {
// //         if (this.isEmpty()) return undefined;
// //         // Find the item with the smallest priority
// //         let bestIndex = 0;
// //         let bestPriority = this.data[0]!.priority;
// //         for (let i = 1; i < this.data.length; i++) {
// //             if (this.data[i]!.priority < bestPriority) {
// //                 bestIndex = i;
// //                 bestPriority = this.data[i]!.priority;
// //             }
// //         }
// //         const [element] = this.data.splice(bestIndex, 1);
// //         return element!.item;
// //     }

// //     isEmpty(): boolean {
// //         return this.data.length === 0;
// //     }
// // }

// // /**
// //  * An A* function that **allows re-expansion** of a plan if we find a cheaper route.
// //  */
// // export async function AutoCompleteSetlistPlanAStar(
// //     initialPlan: SetlistPlan,
// //     costCalcConfig: SetlistPlanCostPenalties,
// //     cancellationTrigger: React.MutableRefObject<boolean>,
// //     reportProgress: (state: SetlistPlanAutocompleteProgressState) => void
// // ): Promise<SetlistPlanAutocompleteProgressState> {

// //     // Compute cost so far (g) and heuristic (h) for the initial state
// //     const initialG = CalculateSetlistPlanCost(initialPlan, costCalcConfig).totalCost;
// //     const initialH = PointsRemaining(initialPlan);

// //     const initialNode: AStarNode = {
// //         plan: initialPlan,
// //         g: initialG,
// //         h: initialH,
// //         f: initialG + initialH,
// //     };

// //     // Priority queue (min-heap) sorted by f = g + h
// //     const openSet = new MinPriorityQueue<AStarNode>();
// //     openSet.push(initialNode, initialNode.f);

// //     let bestNode: AStarNode = initialNode;

// //     let iteration = 0;
// //     const maxIterations = 5000;

// //     while (!openSet.isEmpty() && iteration < maxIterations) {
// //         iteration++;

// //         reportProgress({
// //             iteration,
// //             bestPlan: bestNode.plan,
// //             bestCost: bestNode.g,
// //         });
// //         await new Promise(resolve => setTimeout(resolve, 0));

// //         if (cancellationTrigger.current) {
// //             return {
// //                 iteration,
// //                 bestPlan: bestNode.plan,
// //                 bestCost: bestNode.g,
// //             };
// //         }

// //         // Pop the node with the smallest f = g + h (done by the pri queue)
// //         const currentNode = openSet.pop();
// //         if (!currentNode) break;

// //         console.log(`popped: g: ${currentNode.g}, h: ${currentNode.h}, f: ${currentNode.f}; key=${getPlanKey(currentNode.plan)}`);

// //         // Goal check: If no points remaining, this is a valid completion.
// //         if (PointsRemaining(currentNode.plan) === 0) {
// //             bestNode = currentNode;
// //             break;
// //         }

// //         const neighborPlans = SetlistPlanGetNeighbors(currentNode.plan);
// //         console.log(`generated ${neighborPlans.length} neighbors`);

// //         for (const neighborPlan of neighborPlans) {
// //             // Compute cost so far for neighbor
// //             const neighborG = CalculateSetlistPlanCost(neighborPlan, costCalcConfig).totalCost;
// //             const neighborH = PointsRemaining(neighborPlan);
// //             const neighborF = neighborG + neighborH;
// //             const neighborKey = getPlanKey(neighborPlan);

// //             console.log(`pushing g: ${neighborG}, h: ${neighborH}, f: ${neighborF}; key=${neighborKey}`);

// //             openSet.push({ plan: neighborPlan, g: neighborG, h: neighborH, f: neighborF }, neighborF);
// //         }
// //     }

// //     // Final progress report
// //     reportProgress({
// //         iteration,
// //         bestPlan: bestNode.plan,
// //         bestCost: bestNode.g,
// //     });
// //     await new Promise((resolve) => setTimeout(resolve, 0));

// //     return {
// //         iteration,
// //         bestPlan: bestNode.plan,
// //         bestCost: bestNode.g,
// //     };
// // }


// // State is effectively a grid which we are trying to fill in in some optimal way, depending on the cost function.
// // The starting position is an empty grid, and the goal is defined by isGoal() (some required amount of values have been filled).

// interface SearchConfig<T> {
//     // returns all possible mutations of `state` which are 1 "step" away.
//     getNeighbors: (state: T) => T[];

//     // returns the total cost of the position at `state` (high cost = unoptimal, low cost = optimal)
//     calculateRealCost: (state: T) => number;

//     // returns the estimated cost to reach the goal from `state`. In other words, how much is left to fill in.
//     estimateCostToComplete: (state: T) => number;

//     // returns true if `node` is the goal (completeness)
//     isGoal: (node: T) => boolean;

//     // returns a string that uniquely identifies the node
//     getNodeHashKey: (node: T) => string;
// }

// // function aStarSearch<T>(start: T, config: SearchConfig<T>): T | null {
// //     const { getNeighbors, calculateRealCost, estimateCostToComplete, isGoal, getNodeHashKey } = config;

// //     // Open set: nodes to be evaluated
// //     const openSet = new Set<string>();
// //     openSet.add(getNodeHashKey(start));

// //     // Maps to store cost and parent tracking
// //     const gScore = new Map<string, number>(); // Cost from start to the current node
// //     const fScore = new Map<string, number>(); // Estimated total cost (g + h)
// //     const cameFrom = new Map<string, T>(); // Used to reconstruct the path later

// //     // Initialize start node
// //     gScore.set(getNodeHashKey(start), 0);
// //     fScore.set(getNodeHashKey(start), estimateCostToComplete(start));

// //     while (openSet.size > 0) {
// //         // Find the node in the open set with the lowest fScore
// //         const current = Array.from(openSet).reduce((bestNode, nodeKey) => {
// //             return fScore.get(nodeKey)! < fScore.get(bestNode)! ? nodeKey : bestNode;
// //         });

// //         // Retrieve the actual state corresponding to `current`
// //         const currentState = cameFrom.has(current) ? cameFrom.get(current)! : start;

// //         // Goal check
// //         if (isGoal(currentState)) {
// //             return currentState; // Found the goal
// //         }

// //         // Remove current from open set
// //         openSet.delete(current);

// //         // Expand neighbors
// //         for (const neighbor of getNeighbors(currentState)) {
// //             const neighborKey = getNodeHashKey(neighbor);

// //             // Calculate tentative gScore
// //             const tentativeGScore = gScore.get(current)! + calculateRealCost(neighbor);

// //             if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
// //                 // Update path
// //                 cameFrom.set(neighborKey, currentState);
// //                 gScore.set(neighborKey, tentativeGScore);

// //                 const estimatedCost = tentativeGScore + estimateCostToComplete(neighbor);
// //                 fScore.set(neighborKey, estimatedCost);

// //                 // Add neighbor to the open set if it's not already there
// //                 if (!openSet.has(neighborKey)) {
// //                     openSet.add(neighborKey);
// //                 }
// //             }
// //         }
// //     }

// //     // Return null if no solution found
// //     return null;
// // }



// // async function aStarSearch<T>(
// //     start: T,
// //     config: SearchConfig<T>,
// //     cancellationTrigger: React.MutableRefObject<boolean>,
// //     reportProgress: (state: AStarSearchProgressState<T>) => void
// // ): Promise<T | null> {
// //     const {
// //         getNeighbors,
// //         calculateRealCost,
// //         estimateCostToComplete,
// //         isGoal,
// //         getNodeHashKey,
// //     } = config;

// //     // A map to retrieve the full node from a key.
// //     const nodeMap = new Map<string, T>();
// //     const startKey = getNodeHashKey(start);
// //     nodeMap.set(startKey, start);

// //     // Open set (store keys)
// //     const openSet = new Set<string>([startKey]);

// //     // Cost maps
// //     const gScore = new Map<string, number>();
// //     gScore.set(startKey, calculateRealCost(start));

// //     const fScore = new Map<string, number>();
// //     fScore.set(startKey, estimateCostToComplete(start));

// //     // cameFrom: childKey -> parentKey
// //     const cameFrom = new Map<string, string>();

// //     while (openSet.size > 0) {
// //         // 1) Pick the nodeKey in openSet with the smallest fScore
// //         const currentKey = Array.from(openSet).reduce((best, nodeKey) => {
// //             return (fScore.get(nodeKey) ?? Infinity) < (fScore.get(best) ?? Infinity)
// //                 ? nodeKey
// //                 : best;
// //         }, startKey);

// //         const currentNode = nodeMap.get(currentKey)!;

// //         reportProgress({
// //             iteration: openSet.size,
// //             bestPlan: currentNode,
// //             bestCost: gScore.get(currentKey)!,
// //         });
// //         await new Promise(resolve => setTimeout(resolve, 0));

// //         if (cancellationTrigger.current) {
// //             return currentNode;
// //         }

// //         // 2) Check if we reached the goal
// //         if (isGoal(currentNode)) {
// //             // Reconstruct path or just return the final node
// //             return currentNode;
// //         }

// //         // 3) Remove from openSet
// //         openSet.delete(currentKey);

// //         // 4) Expand neighbors
// //         for (const neighbor of getNeighbors(currentNode)) {
// //             const neighborKey = getNodeHashKey(neighbor);

// //             // Add neighbor to nodeMap if new
// //             if (!nodeMap.has(neighborKey)) {
// //                 nodeMap.set(neighborKey, neighbor);
// //             }

// //             const tentativeG = (gScore.get(currentKey) ?? Infinity)
// //                 + calculateRealCost(neighbor);

// //             if (tentativeG < (gScore.get(neighborKey) ?? Infinity)) {
// //                 // Record best path to neighbor
// //                 cameFrom.set(neighborKey, currentKey);
// //                 gScore.set(neighborKey, tentativeG);

// //                 const estimatedCost = tentativeG + estimateCostToComplete(neighbor);
// //                 fScore.set(neighborKey, estimatedCost);

// //                 openSet.add(neighborKey);
// //             }
// //         }
// //     }

// //     return null;
// // }

// async function aStarSearch<T>(
//     start: T,
//     config: SearchConfig<T>,
//     cancellationTrigger: React.MutableRefObject<boolean>,
//     reportProgress: (state: AStarSearchProgressState<T>) => void
// ): Promise<T | null> {
//     const { getNeighbors, calculateRealCost, estimateCostToComplete, isGoal, getNodeHashKey } = config;

//     const openSet = new Map<string, T>(); // Open set of states to explore
//     const gScore = new Map<string, number>(); // Real cost from start to each state
//     const fScore = new Map<string, number>(); // Estimated total cost (g + h)
//     const cameFrom = new Map<string, T>(); // Tracks the best path to each state

//     const startKey = getNodeHashKey(start);
//     openSet.set(startKey, start);
//     gScore.set(startKey, calculateRealCost(start));
//     fScore.set(startKey, calculateRealCost(start) + estimateCostToComplete(start));

//     while (openSet.size > 0) {
//         // Find the state in openSet with the lowest fScore
//         const currentKey = Array.from(openSet.keys()).reduce((bestKey, key) => {
//             return fScore.get(key)! < fScore.get(bestKey)! ? key : bestKey;
//         });
//         const currentState = openSet.get(currentKey)!;

//         reportProgress({
//             iteration: openSet.size,
//             bestPlan: currentState,
//             bestCost: gScore.get(currentKey)!,
//         });
//         await new Promise(resolve => setTimeout(resolve, 0));

//         if (cancellationTrigger.current) {
//             return currentState;
//         }

//         // Check if the current state is the goal
//         if (isGoal(currentState)) {
//             return currentState; // Found the optimal goal state
//         }

//         // Remove current from open set
//         openSet.delete(currentKey);

//         // Expand neighbors
//         for (const neighbor of getNeighbors(currentState)) {
//             const neighborKey = getNodeHashKey(neighbor);
//             const tentativeGScore = calculateRealCost(neighbor);

//             if (tentativeGScore < (gScore.get(neighborKey) ?? Infinity)) {
//                 // Update path and scores for the neighbor
//                 cameFrom.set(neighborKey, currentState);
//                 gScore.set(neighborKey, tentativeGScore);
//                 fScore.set(neighborKey, tentativeGScore + estimateCostToComplete(neighbor));

//                 // Add to open set if not already present
//                 if (!openSet.has(neighborKey)) {
//                     openSet.set(neighborKey, neighbor);
//                 }
//             }
//         }
//     }

//     return null; // No solution found
// }




// export async function AutoCompleteSetlistPlanAStar(
//     initialPlan: SetlistPlan,
//     costCalcConfig: SetlistPlanCostPenalties,
//     cancellationTrigger: React.MutableRefObject<boolean>,
//     reportProgress: (state: SetlistPlanAutocompleteProgressState) => void
// ): Promise<SetlistPlanAutocompleteProgressState> {

//     const config: SearchConfig<SetlistPlan> = {
//         getNeighbors: plan => SetlistPlanGetNeighbors(plan, 1, true),
//         calculateRealCost: plan => CalculateSetlistPlanCost(plan, costCalcConfig).totalCost,
//         estimateCostToComplete: plan => PointsRemaining(plan),
//         isGoal: plan => PointsRemaining(plan) === 0,
//         getNodeHashKey: plan => getPlanKey(plan),
//     };
//     console.log(`doing search`);

//     const bestPlan = await aStarSearch(initialPlan, config, cancellationTrigger, reportProgress);

//     console.log(`bestPlan: `);
//     console.log(bestPlan);

//     return {
//         iteration: 0,
//         bestPlan: bestPlan || initialPlan,
//         bestCost: CalculateSetlistPlanCost(bestPlan!, costCalcConfig).totalCost,
//     };

// }