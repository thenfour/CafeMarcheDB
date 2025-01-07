// linear algorithmic auto-distribution method.
// it's actually pretty good but cannot handle multiple heuristics in the way that the search based method can.

// distributes remaining song points across rehearsal segments (columns), based on the following principles:
// - critical songs (or those with the most to rehearse) are generally allocated first
// - we do not allocate more than MAX_POINTS_PER_REHEARSAL per song per column
// - attempts to allocate in chunks approximating Fibonacci (e.g., 8,5,3,2,1) so earlier rehearsals get more time
// - tries to place consecutive rehearsals close together
//
// there may be multiple strategies to consider.
// 1. allocate heavy songs first, period.
// 2. allocate heavy songs first but try to leave points to fill in lighter songs (if we have 5 points available, don't fill it with a 5-point song. use 3 for 1 song, and 2 for another.). Maybe a way to express this is a minimum # of songs per rehearsal.
// 3. allocate light songs first, period.
// const AutoCompleteSetlistPlan = (plan: SetlistPlan): SetlistPlan => {
//     // Copy the plan so we don’t mutate the original
//     const newPlan = { ...plan, payload: { ...plan.payload, cells: [...plan.payload.cells] } };

//     const maxPointsPerRehearsal = plan.payload.autoCompleteMaxPointsPerRehearsal || DEFAULT_MAX_POINTS_PER_REHEARSAL;

//     // For convenience, build a map of (rowId -> totalCurrentlyAllocated)
//     const rowAllocatedMap: Record<string, number> = {};
//     newPlan.payload.rows.forEach((row) => {
//         if (row.type === "song") {
//             rowAllocatedMap[row.rowId] =
//                 newPlan.payload.cells
//                     .filter((c) => c.rowId === row.rowId && c.pointsAllocated)
//                     .reduce((acc, c) => acc + (c.pointsAllocated || 0), 0);
//         }
//     });

//     // Sort rows by how many points still needed, descending
//     const songRows = [...newPlan.payload.rows]
//         .filter((r) => r.type === "song")
//         .sort((a, b) => {
//             const neededA = (a.pointsRequired || 0) - rowAllocatedMap[a.rowId]!;
//             const neededB = (b.pointsRequired || 0) - rowAllocatedMap[b.rowId]!;
//             return neededB - neededA;
//         });

//     // Convert columns to a map (colId -> capacity)
//     const columnCapacity: Record<string, number> = {};
//     newPlan.payload.columns.forEach((col) => {
//         columnCapacity[col.columnId] = col.pointsAvailable || 0;
//         // Subtract already allocated
//         newPlan.payload.cells
//             .filter((cc) => cc.columnId === col.columnId && cc.pointsAllocated)
//             .forEach((cc) => {
//                 columnCapacity[col.columnId]! -= cc.pointsAllocated || 0;
//             });
//     });

//     // Helper to get or create a cell
//     const getCell = (rowId: string, columnId: string) => {
//         let cell = newPlan.payload.cells.find((c) => c.rowId === rowId && c.columnId === columnId);
//         if (!cell) {
//             cell = { rowId, columnId, pointsAllocated: 0 };
//             newPlan.payload.cells.push(cell);
//         }
//         return cell;
//     };

//     // For each song, break down the needed points into fib-like chunks and try to allocate
//     for (const row of songRows) {
//         const rowId = row.rowId;
//         let stillNeeded = (row.pointsRequired || 0) - rowAllocatedMap[rowId]!;
//         if (stillNeeded <= 0) continue;

//         // Distribute across columns from left to right
//         for (const col of newPlan.payload.columns) {
//             if (stillNeeded <= 0) break;
//             if (columnCapacity[col.columnId]! <= 0) continue;

//             // TODO: refine strategy.
//             // calculate the available points. if other songs still have points to allocate, and there is no other songs allocated to this column, try not to monopolize the whole column.
//             // in other words, if a column has 5 points available, and this song has 5 points to allocate, it's better to either skip this column or allocate 3 points to this song leaving 2 for another.

//             // Try largest fib chunk that is <= stillNeeded and <= column capacity, up to MAX_POINTS_PER_REHEARSAL
//             for (const fib of FIBONACCI_SEQUENCE_REVERSED) {
//                 if (fib <= stillNeeded && fib <= columnCapacity[col.columnId]! && fib <= maxPointsPerRehearsal) {
//                     const cell = getCell(rowId, col.columnId);
//                     cell.pointsAllocated! += fib;
//                     stillNeeded -= fib;
//                     columnCapacity[col.columnId]! -= fib;
//                     break;
//                 }
//             }
//         }
//     }

//     console.log(newPlan);

//     return newPlan;
// };

