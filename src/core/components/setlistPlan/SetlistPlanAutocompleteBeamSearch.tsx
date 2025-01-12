import { Stopwatch } from "shared/rootroot";
import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { AStarSearchProgressState, SetlistPlanGetNeighbors } from "./SetlistPlanAutocompleteAStar";
import { CalculateSetlistPlanCost, GetSetlistPlanKey, GetSetlistPlanPointsAllocated, GetSetlistPlanPointsRequired, SetlistPlanCostPenalties } from "./SetlistPlanUtilityComponents";

export interface SetlistPlanRetentionConfig {
    minAmt: number; // always return at least this amount to retain.
    maxAmt: number | undefined; // if defined, return at most this amount to retain. this is a way to prevent factor * count from getting too large.
    factor: number | undefined; // if defined, use this factor to calculate the amount to retain.
    // if factor & maxAmt are both defined, the amount to retain is min(maxAmt, factor * count).
    // if factor & maxAmt are both undefined, the amount to retain is minAmt.
};

function getRetainAmount(count: number, depth: number, config: SetlistPlanRetentionConfig): number {
    if (depth < 2) return count; // first depth, retain all states. this allows for searching ANY 1st move.

    if (config.factor === undefined && config.maxAmt === undefined) return config.minAmt;
    if (config.factor === undefined) return Math.min(config.minAmt, config.maxAmt!);
    const factoredAmt = Math.ceil(count * config.factor);
    if (config.maxAmt === undefined) return Math.max(config.minAmt, factoredAmt);
    return Math.min(config.maxAmt, factoredAmt);
}


// State is effectively a grid which we are trying to fill in in some optimal way, depending on the cost function.
// The starting position is an empty grid, and the goal is defined by isGoal() (some required amount of values have been filled).

interface SearchConfig<T> {
    // returns all possible mutations of `state` which are 1 "step" away.
    getNeighbors: (state: T, depth: number) => T[];

    // returns the total cost of the position at `state` (high cost = unoptimal, low cost = optimal)
    calculateRealCost: (state: T) => number;

    // returns true if `node` is the goal (completeness)
    isGoal: (node: T) => boolean;

    // returns a string that uniquely identifies the node
    getNodeHashKey: (node: T) => string;

    retainConfig: SetlistPlanRetentionConfig;
}


async function bestHalfSearch<T>(
    start: T,
    config: SearchConfig<T>,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: AStarSearchProgressState<T>) => void
): Promise<AStarSearchProgressState<T>> {
    const sw = new Stopwatch();

    const { getNeighbors, calculateRealCost, isGoal } = config;
    const searchedKeys = new Set<string>();

    type Node = { state: T, cost: number, parentIndex: number | undefined, key: string };

    let currentStates: Node[] = [
        { state: start, cost: calculateRealCost(start), parentIndex: undefined, key: config.getNodeHashKey(start) },
    ]; // Start with the initial state
    let depth = 1;
    let iteration = 0;
    const reportInterval = 51;
    let bestGoalState: Node | null = null;

    while (currentStates.length > 0) {
        // Generate all neighbors of the current states with their costs.
        const allNeighbors: Node[] = [];
        for (let i = 0; i < currentStates.length; i++) {
            const state = currentStates[i]!;

            const progress: AStarSearchProgressState<T> = {
                iteration: searchedKeys.size,
                bestPlan: currentStates[0]!.state,
                bestCost: currentStates[0]!.cost,
                depth,
                durationSeconds: sw.ElapsedMillis / 1000,
            };

            iteration++;
            if (iteration % reportInterval === 0) {
                reportProgress(progress);
                await new Promise(resolve => setTimeout(resolve, 0));
            }

            if (cancellationTrigger.current) {
                return progress;
            }

            const neighbors = getNeighbors(state.state, depth);
            for (const neighbor of neighbors) {
                const key = config.getNodeHashKey(neighbor);
                const neighborCost = calculateRealCost(neighbor);
                if (!searchedKeys.has(key)) {
                    searchedKeys.add(key);
                    const node: Node = { state: neighbor, cost: neighborCost, parentIndex: i, key };
                    allNeighbors.push(node);

                    if (isGoal(neighbor)) {
                        // Update the best goal state if this one is better
                        if (!bestGoalState || neighborCost < bestGoalState.cost) {
                            bestGoalState = node;
                        }
                    }
                }
            }
        }

        if (allNeighbors.length === 0) break; // No more states to explore

        allNeighbors.sort((a, b) => a.cost - b.cost);

        const retainAmount = getRetainAmount(allNeighbors.length, depth, config.retainConfig); // Get the retain amount for the current depth
        currentStates = allNeighbors.slice(0, retainAmount); // Retain the top states based on cost        

        depth++;
    }

    const retPlan = bestGoalState?.state || currentStates[0]?.state || start;

    const ret: AStarSearchProgressState<T> = {
        iteration: searchedKeys.size,
        bestPlan: retPlan,
        bestCost: calculateRealCost(retPlan),
        depth,
        durationSeconds: sw.ElapsedMillis / 1000,
    };

    return ret;
}

export async function AutoCompleteSetlistPlanFracturedBeam(
    initialPlan: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    retainConfig: SetlistPlanRetentionConfig,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: AStarSearchProgressState<SetlistPlan>) => void
): Promise<AStarSearchProgressState<SetlistPlan>> {

    const totalPointsRequired = GetSetlistPlanPointsRequired(initialPlan);

    initialPlan.payload.emptyLeftRowIndex = 0;
    initialPlan.payload.emptyTopRowIndex = 0;

    const config: SearchConfig<SetlistPlan> = {
        getNeighbors: (plan, depth) => SetlistPlanGetNeighbors(plan, depth, depth > 1),
        calculateRealCost: plan => CalculateSetlistPlanCost(plan, costCalcConfig).totalCost,
        isGoal: plan => GetSetlistPlanPointsAllocated(plan) >= totalPointsRequired,
        getNodeHashKey: plan => GetSetlistPlanKey(plan),
        retainConfig,
    };

    const result = await bestHalfSearch(initialPlan, config, cancellationTrigger, reportProgress);

    return result;
}

