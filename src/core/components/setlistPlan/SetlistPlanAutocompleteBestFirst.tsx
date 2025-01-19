import { Stopwatch } from "shared/rootroot";
import * as db3 from "src/core/db3/db3";
import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { CalculateSetlistPlanCost, CalculateSetlistPlanStatsForCostCalc, SetlistPlanCostPenalties, SetlistPlanSearchProgressState, SetlistPlanSearchState } from "./SetlistPlanUtilities";

export interface SetlistPlanBestFirstSearchConfig {
    maxIterations: number;
    depthsWithoutCulling: number;
    cullPercent01: number | undefined;
    cullClampMin: number | undefined; // if % gives us less than this many, still allow this many.
    cullClampMax: number | undefined; // if % gives us more than this many, still cap at this many.
};

// let's try A* again, this time though we will imagine the "steps" as filling out cell by cell.
// originall this was too large of a search space, now let's try ONLY filling in the <=1 ideal value per cell.
const GetNeighborsIdealValueOnly = (state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties, allSongs: db3.SongPayload[]): SetlistPlanSearchState[] => {
    const neighbors: SetlistPlanSearchState[] = [];
    const planJSON = JSON.stringify(state.plan);

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
            const idealVal = state.stats.getIdealValueForCell(columnIndex, rowIndex) || 0; // mark it 0 if no ideal value, to indicate we have populated it. 0 IS the ideal value.

            const newState = {
                plan: JSON.parse(planJSON) as SetlistPlan,
                stats: state.stats,
                cost: state.cost,
            };
            newState.plan.payload.cells.push({
                rowId: rowStat.rowId,
                columnId: columnStat.segment.columnId,
                pointsAllocated: idealVal,
                autoFilled: true,
            });

            newState.stats = CalculateSetlistPlanStatsForCostCalc(newState.plan);
            newState.cost = CalculateSetlistPlanCost(newState, costCalcConfig);

            neighbors.push(newState);
        }
    }
    return neighbors;
}

function IsGoal(state: SetlistPlanSearchState): boolean {
    return state.stats.totalPlanSegmentBalance >= 0;
}



export async function AutoCompleteSetlistPlanBestFirst(
    initialState: SetlistPlanSearchState,
    costCalcConfig: SetlistPlanCostPenalties,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    const sw = new Stopwatch();
    return {
        currentState: initialState,
        depth: 0,
        elapsedMillis: 0,
        iteration: 0,
    };
}






export async function SetlistPlanAutoFillBestFirst(
    initialState: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    const stats = CalculateSetlistPlanStatsForCostCalc(initialState);
    const cost = CalculateSetlistPlanCost({ plan: initialState, stats }, costCalcConfig);
    const state: SetlistPlanSearchState = { plan: initialState, stats, cost };
    return await AutoCompleteSetlistPlanBestFirst(state, costCalcConfig, cancellationTrigger, reportProgress);

}





