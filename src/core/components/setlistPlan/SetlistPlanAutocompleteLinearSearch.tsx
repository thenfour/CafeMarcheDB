// /*

// linear search.
// it's more exhaustive than the other linear search, but still not perfect. will miss a lot of optimal paths because it doesn't have the stack to be able to backtrack.
// it means it's very important to generate neighbors that continually increase in efficiency, so backtracking is not necessary to find an optimal path.
// this is just not always possible.

// */

// import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
// import { CalculateSetlistPlanCost, SetlistPlanCostPenalties } from "./SetlistPlanUtilityComponents";
// import { generateFibonacci } from "shared/utils";

// const MAX_POINTS_PER_REHEARSAL = 8;
// export const FIBONACCI_SEQUENCE = generateFibonacci(10000);

// interface State {
//     plan: SetlistPlan;
//     cost: number;
// }

// // // return a set of mutations on the plan, which attempt all possible ways to make 1 additional allocation of points.
// // // avoid duplicate allocations (rowId + columnId pairs)
// // //
// // // this is great for a backtracking search but not this one.
// // const getNeighbors = (state: State, steps: number, visits: number): State[] => {
// //     const neighbors: State[] = [];
// //     const { plan } = state;
// //     const planJSON = JSON.stringify(plan);

// //     plan.payload.rows.forEach((row, rowIndex) => {
// //         const stillAllocated = plan.payload.cells.filter((cell) => cell.rowId === row.rowId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //         const stillNeeded = (row.pointsRequired || 0) - stillAllocated;
// //         if (stillNeeded <= 0) return;

// //         plan.payload.columns.forEach((col, colIndex) => {
// //             // if the cell is already allocated, skip it. don't attempt to change allocations; that is handled by other iterations.
// //             if (plan.payload.cells.some(cell => cell.rowId === row.rowId && cell.columnId === col.columnId && !!cell.pointsAllocated)) {
// //                 return;
// //             }

// //             // add a neighbor for each fibonacci number of points to allocate up to stillNeeded.
// //             const fibonacciNumbersToUse = new Set<number>([stillNeeded, ...FIBONACCI_SEQUENCE.filter(fib => fib <= stillNeeded)]);

// //             fibonacciNumbersToUse.forEach(pointsToAllocate => {
// //                 const newPlan = JSON.parse(planJSON);
// //                 newPlan.payload.autoCompleteSteps = steps;
// //                 newPlan.payload.autoCompleteVisits = visits;
// //                 const cell = newPlan.payload.cells.find(cell => cell.rowId === row.rowId && cell.columnId === col.columnId) || { rowId: row.rowId, columnId: col.columnId, pointsAllocated: 0 };
// //                 cell.pointsAllocated += pointsToAllocate;
// //                 if (!newPlan.payload.cells.includes(cell)) {
// //                     newPlan.payload.cells.push(cell);
// //                 }

// //                 neighbors.push({ plan: newPlan, cost: state.cost + pointsToAllocate });
// //             });

// //         });
// //     });

// //     return neighbors;
// // };



// const getNeighbors = (state: State, steps: number, visits: number): State[] => {
//     const neighbors: State[] = [];
//     const { plan } = state;

//     plan.payload.rows.forEach((row, rowIndex) => {
//         const rowCells = plan.payload.cells.filter((cell) => cell.rowId === row.rowId);
//         let stillNeeded = (row.pointsRequired || 0) - rowCells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
//         if (stillNeeded <= 0) return;

//         plan.payload.columns.forEach((col, colIndex) => {
//             if (stillNeeded <= 0) return;
//             if (plan.payload.cells.some(cell => cell.rowId === row.rowId && cell.columnId === col.columnId && cell.pointsAllocated! >= MAX_POINTS_PER_REHEARSAL)) return;

//             const colPointsAvailable = col.pointsAvailable || 0;
//             const availablePoints = colPointsAvailable - plan.payload.cells.filter(cell => cell.columnId === col.columnId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
//             if (availablePoints <= 0) return;

//             const pointsToAllocate = Math.min(stillNeeded, availablePoints, MAX_POINTS_PER_REHEARSAL);
//             const newPlan = JSON.parse(JSON.stringify(plan));
//             newPlan.payload.autoCompleteSteps = steps;
//             newPlan.payload.autoCompleteVisits = visits;
//             const cell = newPlan.payload.cells.find(cell => cell.rowId === row.rowId && cell.columnId === col.columnId) || { rowId: row.rowId, columnId: col.columnId, pointsAllocated: 0 };
//             cell.pointsAllocated += pointsToAllocate;
//             newPlan.payload.cells.push(cell);

//             neighbors.push({ plan: newPlan, cost: state.cost + pointsToAllocate });
//             stillNeeded -= pointsToAllocate;
//         });
//     });

//     return neighbors;
// };

// // const getNeighbors = (state: State, steps: number, visits: number): State[] => {
// //     const neighbors: State[] = [];
// //     const { plan } = state;
// //     //const totalRows = plan.payload.rows.length;
// //     //let processedRows = 0;

// //     // Sort rows by remaining points needed in descending order
// //     const sortedRows = [...plan.payload.rows].sort((a, b) => {
// //         const aRemaining = (a.pointsRequired || 0) - plan.payload.cells.filter(cell => cell.rowId === a.rowId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //         const bRemaining = (b.pointsRequired || 0) - plan.payload.cells.filter(cell => cell.rowId === b.rowId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //         return bRemaining - aRemaining;
// //     });

// //     // Sort columns by available points in descending order
// //     const sortedColumns = [...plan.payload.columns].sort((a, b) => {
// //         const aAvailable = (a.pointsAvailable || 0) - plan.payload.cells.filter(cell => cell.columnId === a.columnId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //         const bAvailable = (b.pointsAvailable || 0) - plan.payload.cells.filter(cell => cell.columnId === b.columnId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //         return bAvailable - aAvailable;
// //     });

// //     for (const row of sortedRows) {
// //         const rowCells = plan.payload.cells.filter((cell) => cell.rowId === row.rowId);
// //         let stillNeeded = (row.pointsRequired || 0) - rowCells.reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //         if (stillNeeded <= 0) continue;

// //         for (const col of sortedColumns) {
// //             if (stillNeeded <= 0) break;
// //             if (plan.payload.cells.some(cell => cell.rowId === row.rowId && cell.columnId === col.columnId && cell.pointsAllocated! >= MAX_POINTS_PER_REHEARSAL)) continue;

// //             const colPointsAvailable = col.pointsAvailable || 0;
// //             const availablePoints = colPointsAvailable - plan.payload.cells.filter(cell => cell.columnId === col.columnId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
// //             if (availablePoints <= 0) continue;

// //             const pointsToAllocate = Math.min(stillNeeded, availablePoints, MAX_POINTS_PER_REHEARSAL);
// //             const newPlan = JSON.parse(JSON.stringify(plan));
// //             newPlan.payload.autoCompleteSteps = steps;
// //             newPlan.payload.autoCompleteVisits = visits;
// //             const cell = newPlan.payload.cells.find(cell => cell.rowId === row.rowId && cell.columnId === col.columnId) || { rowId: row.rowId, columnId: col.columnId, pointsAllocated: 0 };
// //             cell.pointsAllocated += pointsToAllocate;
// //             if (!newPlan.payload.cells.includes(cell)) {
// //                 newPlan.payload.cells.push(cell);
// //             }

// //             neighbors.push({ plan: newPlan, cost: state.cost + pointsToAllocate });
// //             stillNeeded -= pointsToAllocate;
// //         }
// //     }

// //     return neighbors;
// // };

// export interface SetlistPlanAutocompleteProgressState {
//     iteration: number;
//     bestPlan: SetlistPlan;
//     bestCost: number;
// };

// export const AutoCompleteSetlistPlanHillClimber = async (initialPlan: SetlistPlan, costCalcConfig: SetlistPlanCostPenalties, cancellationTrigger: React.MutableRefObject<boolean>, reportProgress: (state: SetlistPlanAutocompleteProgressState) => void): Promise<SetlistPlanAutocompleteProgressState> => {
//     let currentState = { plan: initialPlan, cost: CalculateSetlistPlanCost(initialPlan, costCalcConfig).totalCost };
//     currentState.plan.payload.autoCompleteSteps = 1;
//     currentState.plan.payload.autoCompleteVisits = 1;

//     let iterations = 0;
//     let visits = 0;
//     const maxIterations = 1000; // Define a reasonable limit for iterations
//     const reportEveryNIterations = 5;

//     while (iterations < maxIterations) {

//         if (iterations % reportEveryNIterations === 0) {
//             reportProgress({
//                 iteration: iterations,
//                 bestPlan: currentState.plan,
//                 bestCost: currentState.cost,
//             });
//             await new Promise(resolve => setTimeout(resolve, 0));
//         }

//         if (cancellationTrigger.current) {
//             return {
//                 iteration: iterations,
//                 bestPlan: currentState.plan,
//                 bestCost: currentState.cost,
//             };
//         }

//         const neighbors = getNeighbors(currentState, iterations + 2, visits + 1);
//         console.log(`neighbors length: ${neighbors.length}`);
//         console.log(neighbors);
//         if (neighbors.length === 0) break;

//         // Find the neighbor with the lowest cost
//         const bestNeighbor = neighbors.reduce((best, neighbor) => {
//             const neighborCost = CalculateSetlistPlanCost(neighbor.plan, costCalcConfig).totalCost;
//             return neighborCost < best.cost ? { ...neighbor, cost: neighborCost } : best;
//         }, { ...currentState, cost: CalculateSetlistPlanCost(currentState.plan, costCalcConfig).totalCost });

//         if (bestNeighbor.cost >= currentState.cost) break; // No improvement. there could still however be other paths we didn't explore.

//         currentState = bestNeighbor;

//         visits += neighbors.length;
//         iterations++;
//     }

//     reportProgress({
//         iteration: iterations,
//         bestPlan: currentState.plan,
//         bestCost: currentState.cost,
//     });
//     await new Promise(resolve => setTimeout(resolve, 0));

//     return {
//         iteration: iterations,
//         bestPlan: currentState.plan,
//         bestCost: currentState.cost,
//     };
// };
