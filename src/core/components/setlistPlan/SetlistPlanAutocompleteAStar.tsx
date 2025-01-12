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






// similar, but never returns a previous state.
// unfortunately because it's 2D, there are paths that will never be explored.
export const SetlistPlanGetNeighborsLinear = (plan: SetlistPlan, depth: number, allowNonOptimalAllocations: boolean): SetlistPlan[] => {
    const neighbors: SetlistPlan[] = [];
    const emptyTopRowIndex = (plan.payload.emptyTopRowIndex || 0) - 1;
    const emptyLeftRowIndex = (plan.payload.emptyLeftRowIndex || 0) - 1;
    const planJSON = JSON.stringify(plan);
    const allocatableSongCount = plan.payload.rows.filter(row => (row.pointsRequired || 0) > 0).length;

    plan.payload.rows.forEach((row, rowIndex) => {
        if (rowIndex < emptyTopRowIndex) return;

        const stillAllocated = plan.payload.cells.filter((cell) => cell.rowId === row.rowId).reduce((acc, cell) => acc + (cell.pointsAllocated || 0), 0);
        const stillNeeded = (row.pointsRequired || 0) - stillAllocated;
        if (stillNeeded <= 0) return;

        plan.payload.columns.forEach((col, colIndex) => {
            if (colIndex < emptyLeftRowIndex) return;
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
            //const onlyUseIdeal = depth < allocatableSongCount;
            const onlyUseIdeal = false;

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
                newPlan.payload.emptyTopRowIndex = rowIndex;
                newPlan.payload.emptyLeftRowIndex = colIndex;

                neighbors.push(newPlan);
            });

        });
    });

    return neighbors;
};




export interface AStarSearchProgressState<T> {
    iteration: number;
    depth: number;
    durationSeconds: number;
    bestPlan: T;
    bestCost: number;
};

