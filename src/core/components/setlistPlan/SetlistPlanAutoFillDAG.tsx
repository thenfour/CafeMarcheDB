// this has been mostle chatgpt generated; i think it "works" but still searching too huge.
// maybe we can cull neighbors here like we have tried for Astar or other.

import { SetlistPlan } from "src/core/db3/shared/setlistPlanTypes";
import { AStarSearchProgressState, CalculateSetlistPlanCost, CalculateSetlistPlanStatsForCostCalc, GetSetlistPlanKey, SetlistPlanCostPenalties, SetlistPlanSearchProgressState, SetlistPlanSearchState } from "./SetlistPlanUtilities";

export const SetlistPlanGetNeighborsForDAGMinCost = (state: SetlistPlanSearchState, costCalcConfig: SetlistPlanCostPenalties): SetlistPlanSearchState[] => {
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

        neighbors.push(newState);
    }

    return neighbors;
}




/**
 * Domain-agnostic interface for a child's edge (like adjacency).
 * You can return these from `getChildren(node)`.
 */
export interface DAGChildEdge<S> {
    child: S;     // child node
    cost: number; // edge cost from the current node to this child
}

// /** 
//  * Progress structure for the DAG-based search.
//  * You can add more fields as needed.
//  */
// export interface DAGSearchProgress<S> {
//     iteration: number;           // how many nodes popped / processed so far
//     currentNode: S | null;       // which node we just popped or are finalizing
//     bestCostForStart: number;    // if known, the minimal cost from the start node so far
//     elapsedMillis: number;
// }

type DAGSearchProgress<S> = AStarSearchProgressState<S>;

/** 
 * The final result of DAGMinCostSearch.
 */
export interface DAGSearchResult<S> {
    /** 
     * Minimal cost from the start node to a goal node.
     * If no path to a goal is found, this will be Infinity.
     */
    cost: number;

    /**
     * If path reconstruction is enabled and a path to a goal was found,
     * this array will contain the sequence of nodes from `startNode` to the goal.
     * Otherwise it may be an empty array.
     */
    path: S[];
}

/**
 * Perform a memoized DFS on a DAG from `startNode` to compute the minimal cost
 * to reach a goal (if one exists).
 *
 * You provide:
 *  - isGoal(node):        Tells if a node is a goal (cost = 0).
 *  - getChildren(node):   Return an array (or promise) of {child, cost} edges.
 *  - getNodeId(node):     Return a unique string ID for each node.
 *  - enablePathReconstruction:  If true, we track which child yields the best cost for path building.
 *
 * The search can be canceled via `cancellationTrigger.current = true`.
 * We also call `reportProgress` frequently so you can track the search evolution.
 *
 * NOTE: This is a typical "DAG dynamic programming" approach, but done
 * iteratively so you don't need a full topological ordering or risk deep recursion.
 */
export async function DAGMinCostSearch<S>(
    startNode: S,
    options: {
        isGoal: (node: S) => boolean;
        getChildren: (node: S) => Promise<DAGChildEdge<S>[]> | DAGChildEdge<S>[];
        getNodeId: (node: S) => string;
        enablePathReconstruction?: boolean;
    },
    cancellationTrigger: { current: boolean },
    reportProgress: (info: DAGSearchProgress<S>) => void
): Promise<DAGSearchResult<S>> {

    const { isGoal, getChildren, getNodeId, enablePathReconstruction } = options;

    // We'll track the minimal cost from each node to a goal.
    const memo = new Map<string, number>();       // nodeId -> cost
    const bestChild = new Map<string, string>();  // nodeId -> childId that gave best cost (for path reconstruction)

    // We'll track which nodes are fully computed.
    const done = new Set<string>();  // once a node's cost is finalized, it goes here
    // We'll track which nodes have been discovered but not finalized (to detect cycles if they exist).
    const inStack = new Set<string>();

    // Iteration counter for progress
    let iteration = 0;
    const startTime = performance.now();

    /**
     * We use a stack-based DFS with two phases:
     *   1) DISCOVER: we push the node, then push all children,
     *   2) POST/FINALIZE: after children are processed, we compute the node's minimal cost.
     */
    enum Phase {
        DISCOVER,
        POST
    }

    interface StackFrame {
        node: S;
        phase: Phase;
    }

    // Start with the startNode
    const startId = getNodeId(startNode);
    const stack: StackFrame[] = [{ node: startNode, phase: Phase.DISCOVER }];

    // Initialize unknown cost to Infinity
    memo.set(startId, Infinity);

    // The search continues until the stack is empty or canceled.
    while (stack.length > 0) {

        // Pop a frame
        const frame = stack.pop()!;
        const node = frame.node;
        const nodeId = getNodeId(node);

        iteration++;

        // Check cancellation
        if (cancellationTrigger.current) {
            break;
        }
        // Report progress (you might do it less frequently in a real system).
        reportProgress({
            iteration,
            currentState: node,
            depth: 0,
            elapsedMillis: performance.now() - startTime,
            // We know the cost for the start node if "done" includes startId:
            //bestCostForStart: done.has(startId) ? (memo.get(startId) ?? Infinity) : Infinity,
            //elapsedMillis: performance.now() - startTime
        });
        await new Promise(resolve => setTimeout(resolve, 0));

        if (frame.phase === Phase.DISCOVER) {
            // If we've already computed this node, skip
            if (done.has(nodeId)) {
                continue;
            }

            // Detect cycle (shouldn't happen in a true DAG)
            if (inStack.has(nodeId)) {
                // If your DAG can never have cycles, you might just throw an error here.
                // For safety, we skip. This means there's a cycle => not truly a DAG.
                continue;
            }

            inStack.add(nodeId);

            // We'll finalize this node's cost later
            stack.push({ node, phase: Phase.POST });

            // If node is a goal, cost = 0
            // (We do this check here, so we don't expand its children.)
            if (isGoal(node)) {
                memo.set(nodeId, 0);
                // We'll finalize cost in the POST phase next, but there won't be any children expansions.
                continue;
            }

            // Expand children if not a goal
            const edges = await Promise.resolve(getChildren(node));
            // If we haven't computed the child's cost, push it onto the stack
            for (const { child } of edges) {
                const childId = getNodeId(child);
                if (!done.has(childId)) {
                    stack.push({ node: child, phase: Phase.DISCOVER });
                }
            }
        }
        else if (frame.phase === Phase.POST) {
            // Now we finalize cost for `node`, given the children are presumably processed.

            // Mark node no longer "inStack"
            inStack.delete(nodeId);

            // If we already had a cost = 0 from isGoal, that remains.
            let bestCost = memo.get(nodeId) ?? Infinity;

            // If it's not a goal, compute cost = min( childCost + edgeCost ).
            if (bestCost !== 0) {
                const edges = await Promise.resolve(getChildren(node));
                for (const { child, cost: edgeCost } of edges) {
                    const childId = getNodeId(child);
                    const childCost = memo.get(childId);
                    if (childCost !== undefined && childCost < Infinity) {
                        const possibleCost = childCost + edgeCost;
                        if (possibleCost < bestCost) {
                            bestCost = possibleCost;
                            if (enablePathReconstruction) {
                                bestChild.set(nodeId, childId);
                            }
                        }
                    }
                }
                memo.set(nodeId, bestCost);
            }

            // Mark done
            done.add(nodeId);
        }
    } // end while stack not empty

    // The minimal cost from startNode to a goal is in memo.get(startId)
    const finalCost = memo.get(startId) ?? Infinity;
    const result: DAGSearchResult<S> = {
        cost: finalCost,
        path: []
    };

    // If path reconstruction is enabled and we actually found a finite cost, reconstruct path:
    if (enablePathReconstruction && finalCost < Infinity) {
        // We follow `bestChild` from startId down until we reach a goal (cost=0).
        const path: S[] = [];
        let currentId = startId;
        let currentNode = startNode;
        while (true) {
            path.push(currentNode);

            // If this node is a goal, we have completed the path
            if (isGoal(currentNode)) {
                break;
            }

            const nextId = bestChild.get(currentId);
            if (!nextId) {
                // No path onward: that means we somehow didn't link to a goal. 
                // Possibly it had no children or there's a cost mismatch.
                break;
            }
            currentId = nextId;

            // In a real app, you might want a nodeId->node map. 
            // If your `getNodeId` is reversible, or your nodes are strings themselves, you're good.
            // For a truly domain-agnostic approach, you'd store a map when you discovered children.
            // For simplicity here, let's assume your node is also the ID or you have a direct lookup:
            // currentNode = someLookupById(currentId);
            // Because we didn't store that in this example, we can't do a perfect reconstruction 
            // unless your domain is trivially id-based. 
            //
            // As a minimal demonstration, I'll assume the node *is* the ID (like a string or unique token).
            currentNode = currentId as unknown as S;
        }
        result.path = path;
    }

    return result;
}






function IsGoal(state: SetlistPlanSearchState): boolean {
    //return state.stats.totalPlanSegmentBalance >= 0;
    //return state.stats.totalPlanSongBalance >= 0;
    return state.stats.totalPlanSongBalance >= 0 || state.stats.totalPlanSegmentBalance >= 0;
}

export async function SetlistPlanAutoFillDAG(
    initialState: SetlistPlan,
    costCalcConfig: SetlistPlanCostPenalties,
    cancellationTrigger: React.MutableRefObject<boolean>,
    reportProgress: (state: SetlistPlanSearchProgressState) => void
): Promise<SetlistPlanSearchProgressState> {

    const stats = CalculateSetlistPlanStatsForCostCalc(initialState);
    const cost = CalculateSetlistPlanCost({ plan: initialState, stats }, costCalcConfig);
    const state: SetlistPlanSearchState = { plan: initialState, stats, cost };

    let progress: SetlistPlanSearchProgressState;
    const reportProgressHook = (info: DAGSearchProgress<SetlistPlanSearchState>) => {
        progress = info;
        reportProgress(info);
    };
    const ret = await DAGMinCostSearch(
        state,
        {
            getChildren: (state: SetlistPlanSearchState) => SetlistPlanGetNeighborsForDAGMinCost(state, costCalcConfig).map((child) => ({ child, cost: child.cost.totalCost })),
            isGoal: IsGoal,
            getNodeId: (state: SetlistPlanSearchState) => GetSetlistPlanKey(state.plan),
            enablePathReconstruction: false,
        },
        cancellationTrigger,
        reportProgressHook);

    return progress!;
    //return ret.;
}





