// evaluation
// - support triggers on state change. to set default due date & assignees

// display
// - workflow tab / view / control
// - def editor
// - assigned to you alert
// - workflow overview (probably on events search a new display type)

// permissions
// - view_workflow_instances
// - edit_workflow_instances
// - manage_workflow_defs
// - admin_workflow_defs

// DB hookup

import React from "react";
import { CMSmallButton, DebugCollapsibleAdminText, DebugCollapsibleText, KeyValueDisplay } from "./CMCoreComponents2";
import { GetStyleVariablesForColor } from "./Color";
import { isNumber } from "@mui/x-data-grid/internals";
import { assert } from "blitz";
import {
    ReactFlow,
    MiniMap,
    Controls,
    Background,
    useNodesState,
    useEdgesState,
    addEdge,
    Edge,
    Node,
    useOnSelectionChange,
    NodeChange,
    MarkerType,
    Handle,
    Position,
    EdgeChange,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { nanoid } from "nanoid";
import { getNextSequenceId, hashString } from "shared/utils";


/*

some design things:

- Nodes should be very simple. No multiple assignees, no multiple criteria, if you need multiple or complex chains of things, put it in the workflow graph.
- Default due date gets applied only the 1st time a node enters activated state
- "silence alerts" explanation. it's meant to be a "pause" feature. during design of pause,
   the idea is someone who's in charge of the workflow can pause something which silences alerts for that node.
   - progress is not affected, only display alertness.
   - what about nodes that depend on it? i guess pausedness gets propagated. actually "pause" is not pause but rather a "silence alerts" button. so anything that depends on this node will have alerts silenced too.

*/

///////////// DEFS /////////////////////////////////////////////////////////////////
interface WorkflowNodeDependency {
    nodeDefId: number;
    selected: boolean; // for react flow simplification
    determinesRelevance: boolean;
    determinesActivation: boolean;
    determinesCompleteness: boolean;
};

// completion criteria is on the current node, basically that determines progress from started to completed.
// mostly that means activities that occur on THIS node, but in the case of purely logic nodes it could be about
// other nodes as well (as in ActivationCriteria).
enum WorkflowCompletionCriteriaType {
    fieldValue = "fieldValue", // a field is to be checked

    // from WorkflowActivationCriteriaType
    never = "never", // more of a debugging tool than anything
    always = "always", // always activated
    someNodesComplete = "someNodesComplete", // logical OR of nodeIds
    allNodesComplete = "allNodesComplete", // logical AND of nodeIds
};

enum WorkflowFieldValueOperator {
    NotNull = "Null",
    Null = "Null",
    EqualsOperand2 = "EqualsOperand2",
    NotEqualsOperand2 = "NotEqualsOperand2",
    Truthy = "Truthy",
    Falsy = "Falsy",
};

// when displaying the workflow, nodes are grouped together
interface WorkflowNodeGroup {
    id: number;
    name: string;
    color: string;
    sortOrder: number;
};

enum WorkflowNodeDisplayStyle {
    Hidden = "Hidden",
    Normal = "Normal",
};

interface WorkflowNodeAssignee {
    isRequired: boolean;
    userId: number;
}

interface WorkflowNodeDef {
    id: number;
    name: string;
    groupId: number; // WorkflowNodeGroup.id

    // UI display & basic behaviors
    sortOrder: number;
    displayStyle: WorkflowNodeDisplayStyle;

    // relevance + activation dependencies must ALL be complete to be considered satisfied.
    // if there are no relevance dependencies, or no activation dependencies, then considered "always" satisfied.
    nodeDependencies: WorkflowNodeDependency[];

    thisNodeProgressWeight: number;
    relevanceCriteriaType: WorkflowCompletionCriteriaType;
    activationCriteriaType: WorkflowCompletionCriteriaType;
    completionCriteriaType: WorkflowCompletionCriteriaType;
    fieldName?: string;
    fieldValueOperator?: WorkflowFieldValueOperator;
    fieldValueOperand2?: unknown; // for things like less than, equals, whatever.

    // defaults
    defaultAssignees: WorkflowNodeAssignee[]; // user ids that this node is assigned to by default
    defaultDueDateDurationMsAfterStarted?: number | undefined; // if not set, no due date is specified

    position: { x: number, y: number }, // for React Flow
    selected: boolean;
};

interface WorkflowDef {
    id: number;
    name: string;
    groups: WorkflowNodeGroup[];
    nodeDefs: WorkflowNodeDef[];
};


///////////// INSTANCE /////////////////////////////////////////////////////////////////
enum WorkflowLogItemType {
    FieldUpdated,// field updated
    AssigneesChanged,// assignee changed
    DueDateChanged,// duedate changed
};

interface WorkflowLogItem {
    workflowInstanceId: number;
    nodeDefId: number;
    userId: number;
    type: WorkflowLogItemType;
    fieldName: string;
    oldValue: unknown;
    newValue: unknown;
    at: Date;
};

interface WorkflowNodeInstance {
    id: number;
    nodeDef: WorkflowNodeDef;
    activeStateFirstTriggeredAt: Date | undefined;
    lastProgressState: WorkflowNodeProgressState;
    silenceAlerts: boolean; // "pause" behavior
    assignees: WorkflowNodeAssignee[];
    dueDate?: Date;
};

type WorkflowTidiedNodeInstance = WorkflowNodeInstance & {
    isTidy: true;
};

interface WorkflowInstance {
    flowDef: WorkflowDef;
    nodeInstances: WorkflowNodeInstance[];
    log: WorkflowLogItem[];
};

// workflows get preprocessed for GUI work
type WorkflowTidiedInstance = Omit<WorkflowInstance, "nodeInstances"> & {
    isTidy: true;
    nodeInstances: WorkflowTidiedNodeInstance[];
};

///////////// EVALUATION /////////////////////////////////////////////////////////////////
enum WorkflowNodeProgressState {
    InvalidState = "InvalidState", // initial before evaluation etc. never to reach the user.
    Irrelevant = "Irrelevant", // effectively visibility = relevance. Irrelevant nodes are not shown.
    Relevant = "Relevant", // unable to enter started/activated state because of dependencies.
    Activated = "Activated", // blocked from completed state because of 
    Completed = "Completed",
};

interface WorkflowNodeEvaluation {
    isEvaluated: boolean;
    relevanceSatisfied: boolean; // does relevance criteria pass?
    activationSatisfied: boolean; // 
    completenessSatisfied: boolean;
    progressState: WorkflowNodeProgressState;
    progress01: number | undefined; // progress taking into account dependent nodes. or if this is a field node, then will be 0 or 1, unlessy ou have multiple assignees.
    isSilent: boolean; // propagation of silenceAlerts

    isComplete: boolean; // same as progressstate === completed
    isInProgress: boolean; // same as progressstate === activated

    completenessNodesCompletedIncludingThis: number;
    completenessNodesTotalIncludingThis: number;

    completionWeightCompletedIncludingThis: number | undefined;
    completionWeightTotalIncludingThis: number;

    dependentNodes: WorkflowEvaluatedDependentNode[];
    relevanceBlockedByNodes: WorkflowEvaluatedDependentNode[];
    relevanceDependentNodes: WorkflowEvaluatedDependentNode[];
    activationBlockedByNodes: WorkflowEvaluatedDependentNode[];
    activationDependentNodes: WorkflowEvaluatedDependentNode[];
    completenessBlockedByNodes: WorkflowEvaluatedDependentNode[];
    completenessDependentNodes: WorkflowEvaluatedDependentNode[];

    completenessByAssigneeId: { assignee: WorkflowNodeAssignee, completenessSatisfied: boolean }[];
};

type WorkflowEvaluatedNode = WorkflowTidiedNodeInstance & {
    evaluation: WorkflowNodeEvaluation;
};

type WorkflowEvaluatedDependentNode = WorkflowEvaluatedNode & {
    dependency: WorkflowNodeDependency;
};

interface EvaluatedWorkflow {
    flowInstance: WorkflowTidiedInstance;
    schemaHash: string; // to know when to update ui.
    evaluatedNodes: WorkflowEvaluatedNode[];
};

interface WorkflowEvalProvider {
    DoesFieldValueSatisfyCompletionCriteria: (node: WorkflowTidiedNodeInstance, assignee: undefined | WorkflowNodeAssignee) => boolean;
    RenderFieldEditorForNode: (node: WorkflowEvaluatedNode) => React.ReactNode;
    RegisterStateChange: (node: WorkflowEvaluatedNode, oldState: WorkflowNodeProgressState) => void; // register a change in the db as last known progress state. node.progressState will be updated already.
};

///////////// API /////////////////////////////////////////////////////////////////
const TidyWorkflowInstance = (flowInstance: WorkflowInstance): WorkflowTidiedInstance => {
    const { flowDef, nodeInstances } = flowInstance;

    // Create a map of existing node instances for quick lookup
    const nodeInstanceMap = new Map<number, WorkflowNodeInstance>();
    nodeInstances.forEach(node => nodeInstanceMap.set(node.nodeDef.id, node));

    // Iterate through all node definitions and ensure each has a corresponding node instance
    const tidiedNodes: WorkflowTidiedNodeInstance[] = flowDef.nodeDefs.map(nodeDef => {
        if (nodeInstanceMap.has(nodeDef.id)) {
            // If the node instance already exists, use it
            const untidy = nodeInstanceMap.get(nodeDef.id)!;
            const tidy: WorkflowTidiedNodeInstance = {
                ...untidy,
                isTidy: true,
            };
            return tidy;
        } else {
            // If the node instance is missing, create a new one with default values
            const ret: WorkflowTidiedNodeInstance = {
                id: -getNextSequenceId(),
                silenceAlerts: false,
                activeStateFirstTriggeredAt: undefined,
                nodeDef,
                lastProgressState: WorkflowNodeProgressState.InvalidState,
                assignees: nodeDef.defaultAssignees,
                isTidy: true,
            };
            return ret;
        }
    });

    return {
        flowDef,
        nodeInstances: tidiedNodes,
        log: flowInstance.log,
        isTidy: true,
    };
};

const initializeWorkflowInstance = (workflowDef: WorkflowDef): WorkflowInstance => {
    const nodeInstances: WorkflowNodeInstance[] = workflowDef.nodeDefs.map(nodeDef => ({
        id: -1,
        silenceAlerts: false,
        nodeDef,
        assignees: nodeDef.defaultAssignees,
        activeStateFirstTriggeredAt: undefined,
        lastProgressState: WorkflowNodeProgressState.InvalidState,
    }));

    return {
        flowDef: workflowDef,
        nodeInstances,
        log: [],
    };
};

const detectCircularReferences = (nodes: WorkflowNodeDef[], visited: Set<number>, nodeId: number): boolean => {
    if (visited.has(nodeId)) {
        return true;
    }

    visited.add(nodeId);

    const node = nodes.find(n => n.id === nodeId);
    if (node) {
        const nextNodeIds = node.nodeDependencies.map(d => d.nodeDefId) || [];
        for (const nextNodeId of nextNodeIds) {
            if (detectCircularReferences(nodes, visited, nextNodeId)) {
                return true;
            }
        }
    }

    visited.delete(nodeId);
    return false;
};

// check circular references
// check for nodes which don't exist?
// ... other invalid state like depending on something but it's not specified?
// ... fields must be registered
const validateWorkflowDefinition = (workflowDef: WorkflowDef) => {
    for (const node of workflowDef.nodeDefs) {
        if (detectCircularReferences(workflowDef.nodeDefs, new Set(), node.id)) {
            throw new Error(`Circular reference detected in node ${node.id}`);
        }
    }
};

const EvaluateTree = (parentPathNodeDefIds: number[], node: WorkflowTidiedNodeInstance, flow: WorkflowTidiedInstance, api: WorkflowEvalProvider, evaluatedNodes: WorkflowEvaluatedNode[]): WorkflowEvaluatedNode => {
    const existingEvaluation = evaluatedNodes.find(n => n.nodeDef.id === node.nodeDef.id);
    if (existingEvaluation) {
        return existingEvaluation;
    }

    if (parentPathNodeDefIds.includes(node.nodeDef.id)) {
        throw new Error(`Circular dependency exists in the tree.`);
    }

    // evaluate dependencies
    const evaluatedChildren: WorkflowEvaluatedDependentNode[] = node.nodeDef.nodeDependencies.map(childDependency => {
        const evaluatedChild = EvaluateTree(
            [...parentPathNodeDefIds, node.nodeDef.id],
            flow.nodeInstances.find(n => n.nodeDef.id === childDependency.nodeDefId)!,
            flow,
            api,
            evaluatedNodes
        );
        const ret: WorkflowEvaluatedDependentNode = {
            ...evaluatedChild,
            dependency: childDependency,
        }
        return ret;
    });

    const completionDependsOnChildren = [WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(node.nodeDef.completionCriteriaType);

    const emptyEvaluation: WorkflowNodeEvaluation = {
        isEvaluated: true,
        activationSatisfied: false,
        completenessSatisfied: false,
        relevanceSatisfied: false,
        isComplete: false,
        isInProgress: false,
        progress01: undefined,
        progressState: WorkflowNodeProgressState.InvalidState,
        dependentNodes: evaluatedChildren,
        completenessByAssigneeId: [],
        isSilent: evaluatedChildren.every(v => v.evaluation.isSilent), // parents only silenced when all children are (if there are any children with alerts, parents still see alerts)
        completenessNodesCompletedIncludingThis: 0,// accumulated
        completenessNodesTotalIncludingThis: 1,// accumulated
        completionWeightCompletedIncludingThis: 0,// accumulated.
        completionWeightTotalIncludingThis: node.nodeDef.thisNodeProgressWeight,// accumulated
        completenessDependentNodes: completionDependsOnChildren ? evaluatedChildren.filter(ch => ch.dependency.determinesCompleteness) : [],
        completenessBlockedByNodes: completionDependsOnChildren ? evaluatedChildren.filter(ch => ch.dependency.determinesCompleteness && !ch.evaluation.isComplete) : [],
        activationDependentNodes: evaluatedChildren.filter(ch => ch.dependency.determinesActivation),
        activationBlockedByNodes: evaluatedChildren.filter(ch => ch.dependency.determinesActivation && !ch.evaluation.isComplete),
        relevanceDependentNodes: evaluatedChildren.filter(ch => ch.dependency.determinesRelevance),
        relevanceBlockedByNodes: evaluatedChildren.filter(ch => ch.dependency.determinesRelevance && !ch.evaluation.isComplete),
    };

    // (mul1 * mul2) + add
    const addMulPropagatingUnknown = (mul1: number | undefined, mul2: number | undefined, add: number | undefined) => {
        if (mul1 === undefined) return undefined;
        if (mul2 === undefined) return undefined;
        if (add === undefined) return undefined;
        return (mul1 * mul2) + add;
    };

    const evaluation: WorkflowNodeEvaluation = evaluatedChildren.reduce((acc: WorkflowNodeEvaluation, n) => {
        const ret: WorkflowNodeEvaluation = {
            ...acc,
            completenessNodesCompletedIncludingThis: acc.completenessNodesCompletedIncludingThis + n.evaluation.completenessNodesCompletedIncludingThis,
            completenessNodesTotalIncludingThis: acc.completenessNodesTotalIncludingThis + n.evaluation.completenessNodesTotalIncludingThis,
            completionWeightCompletedIncludingThis: addMulPropagatingUnknown(1, acc.completionWeightCompletedIncludingThis, n.evaluation.completionWeightCompletedIncludingThis),
            completionWeightTotalIncludingThis: acc.completionWeightTotalIncludingThis + n.evaluation.completionWeightTotalIncludingThis,
        };
        return ret;
    }, emptyEvaluation);

    switch (node.nodeDef.relevanceCriteriaType) {
        case WorkflowCompletionCriteriaType.never:
            evaluation.relevanceSatisfied = false;
            break;
        case WorkflowCompletionCriteriaType.always:
            evaluation.relevanceSatisfied = true;
            break;
        case WorkflowCompletionCriteriaType.fieldValue:
            throw new Error(`Relevance does not support WorkflowCompletionCriteriaType.fieldValue`);
        case WorkflowCompletionCriteriaType.allNodesComplete:
            evaluation.relevanceSatisfied = evaluation.relevanceBlockedByNodes.length === 0;
            break;
        case WorkflowCompletionCriteriaType.someNodesComplete:
            evaluation.relevanceSatisfied = evaluation.relevanceDependentNodes.length === 0 || (evaluation.relevanceBlockedByNodes.length !== evaluation.relevanceDependentNodes.length);
            break;
    }

    switch (node.nodeDef.activationCriteriaType) {
        case WorkflowCompletionCriteriaType.never:
            evaluation.activationSatisfied = false;
            break;
        case WorkflowCompletionCriteriaType.always:
            evaluation.activationSatisfied = true;
            break;
        case WorkflowCompletionCriteriaType.fieldValue:
            throw new Error(`Activation does not support WorkflowCompletionCriteriaType.fieldValue`);
        case WorkflowCompletionCriteriaType.allNodesComplete:
            evaluation.activationSatisfied = evaluation.activationBlockedByNodes.length === 0;
            break;
        case WorkflowCompletionCriteriaType.someNodesComplete:
            evaluation.activationSatisfied = evaluation.activationDependentNodes.length === 0 || (evaluation.activationBlockedByNodes.length !== evaluation.activationDependentNodes.length);
            break;
    }

    var thisNodeProgress01: undefined | number = undefined;
    switch (node.nodeDef.completionCriteriaType) {
        case WorkflowCompletionCriteriaType.never:
            evaluation.completenessSatisfied = false;
            thisNodeProgress01 = 0;
            break;
        case WorkflowCompletionCriteriaType.always:
            evaluation.completenessSatisfied = true;
            thisNodeProgress01 = 1;
            break;
        case WorkflowCompletionCriteriaType.fieldValue:
            if (node.assignees.length === 0) {
                // no assignees = just evaluate once with no assignees considered.
                evaluation.completenessSatisfied = api.DoesFieldValueSatisfyCompletionCriteria(node, undefined);
                thisNodeProgress01 = evaluation.completenessSatisfied ? 1 : 0;
            } else {
                evaluation.completenessByAssigneeId = node.assignees.map(assignee => ({
                    assignee,
                    completenessSatisfied: api.DoesFieldValueSatisfyCompletionCriteria(node, assignee),
                }));

                // Calculate thisNodeProgress01.
                const requiredAssignees = evaluation.completenessByAssigneeId.filter(c => c.assignee.isRequired);
                const optionalAssignees = evaluation.completenessByAssigneeId.filter(c => !c.assignee.isRequired);
                const satisfiedRequired = requiredAssignees.filter(c => c.completenessSatisfied).length;
                const satisfiedOptional = optionalAssignees.filter(c => c.completenessSatisfied).length;

                // if all are optional, then ANY satisfied will complete the node.
                if (requiredAssignees.length === 0) {
                    assert(optionalAssignees.length > 0, "0 optional + 0 required assignees wut");
                    evaluation.completenessSatisfied = satisfiedOptional > 0;
                    thisNodeProgress01 = satisfiedOptional / optionalAssignees.length;
                }
                else {
                    // there are some required
                    const requiredSatisfied = satisfiedRequired === requiredAssignees.length;
                    if (requiredSatisfied) { // don't let optional assignees block completeness when the required ones are satisfied.
                        thisNodeProgress01 = 1;
                        evaluation.completenessSatisfied = true;
                    } else {
                        // required ones are not done. in order for optional assignees to result in forward progress, include the total assignees in the calculation.
                        thisNodeProgress01 = (satisfiedRequired + satisfiedOptional) / node.assignees.length;
                        evaluation.completenessSatisfied = false;
                    }
                }
            }
            break;
        case WorkflowCompletionCriteriaType.allNodesComplete:
            evaluation.completenessSatisfied = evaluation.completenessBlockedByNodes.length === 0;
            thisNodeProgress01 = evaluation.completenessSatisfied ? 1 : 0;
            break;
        case WorkflowCompletionCriteriaType.someNodesComplete:
            evaluation.completenessSatisfied = evaluation.completenessDependentNodes.length === 0 || (evaluation.completenessBlockedByNodes.length !== evaluation.completenessDependentNodes.length);
            thisNodeProgress01 = evaluation.completenessSatisfied ? 1 : 0;
            break;
    }

    // if a field is not relevant it cannot enter activated state. but it can be completed.
    const progressStateTable = {
        "---": WorkflowNodeProgressState.Irrelevant,
        "--c": WorkflowNodeProgressState.Completed,
        "-a-": WorkflowNodeProgressState.Irrelevant,
        "-ac": WorkflowNodeProgressState.Completed,
        "r--": WorkflowNodeProgressState.Relevant,
        "r-c": WorkflowNodeProgressState.Completed,
        "ra-": WorkflowNodeProgressState.Activated,
        "rac": WorkflowNodeProgressState.Completed,
    };
    evaluation.progressState = progressStateTable[`${evaluation.relevanceSatisfied ? "r" : "-"}${evaluation.activationSatisfied ? "a" : "-"}${evaluation.completenessSatisfied ? "c" : "-"}`];

    switch (evaluation.progressState) {
        case WorkflowNodeProgressState.InvalidState:
            throw new Error(`Invalid progress state`);
        case WorkflowNodeProgressState.Irrelevant:
        case WorkflowNodeProgressState.Relevant:
            evaluation.progress01 = 0;
            break;
        case WorkflowNodeProgressState.Activated:
            if (evaluation.completionWeightTotalIncludingThis === 0 || evaluation.completionWeightTotalIncludingThis === undefined) {
                // if there's no weight in the progress evaluation, then basically it's just not relevant. like a node that's only an annotation or something.
                evaluation.progress01 = undefined;
            } else {
                evaluation.progress01 = addMulPropagatingUnknown(evaluation.completionWeightCompletedIncludingThis, 1 / evaluation.completionWeightTotalIncludingThis, 0);
            }
            break;
        case WorkflowNodeProgressState.Completed:
            evaluation.progress01 = 1;
            evaluation.completionWeightCompletedIncludingThis = addMulPropagatingUnknown(node.nodeDef.thisNodeProgressWeight, thisNodeProgress01, evaluation.completionWeightCompletedIncludingThis);
            evaluation.completenessNodesCompletedIncludingThis++;
            break;
    }

    evaluation.isComplete = evaluation.progressState === WorkflowNodeProgressState.Completed;
    evaluation.isInProgress = evaluation.progressState === WorkflowNodeProgressState.Activated;

    const en: WorkflowEvaluatedNode = {
        ...node,
        evaluation,
    }
    evaluatedNodes.push(en);
    return en;
};

const EvaluateWorkflow = (flow: WorkflowTidiedInstance, api: WorkflowEvalProvider): EvaluatedWorkflow => {
    const evaluatedNodes: WorkflowEvaluatedNode[] = [];

    for (let i = 0; i < flow.nodeInstances.length; ++i) {
        EvaluateTree([], flow.nodeInstances[i]!, flow, api, evaluatedNodes);
    }

    // trigger state change hooks
    for (let i = 0; i < flow.nodeInstances.length; ++i) {
        const node = evaluatedNodes.find(en => en.nodeDef.id === flow.nodeInstances[i]!.nodeDef.id)!;
        if ((node.evaluation.progressState === WorkflowNodeProgressState.InvalidState) || (node.evaluation.progressState !== node.lastProgressState)) {
            const oldState = node.lastProgressState;
            node.lastProgressState = node.evaluation.progressState;

            if ((node.activeStateFirstTriggeredAt === undefined) && node.evaluation.isInProgress && isNumber(node.nodeDef.defaultDueDateDurationMsAfterStarted)) {
                node.dueDate = new Date(new Date().getTime() + node.nodeDef.defaultDueDateDurationMsAfterStarted);
            }

            api.RegisterStateChange(node, oldState);
        }
    }

    const ret: EvaluatedWorkflow = {
        evaluatedNodes,
        flowInstance: flow,
        schemaHash: hashString(JSON.stringify(flow.flowDef)).toString(),
    };
    return ret;
};


///////////// an example workflow def /////////////////////////////////////////////////////////////////
const minimalWorkflow: WorkflowDef = {
    id: 100,
    name: "Minimal workflow",
    groups: [
        {
            id: 1000,
            name: "all group",
            color: "pink",
            sortOrder: 1
        },
        {
            id: 1001,
            name: "results",
            color: "red",
            sortOrder: 2
        },
    ],
    nodeDefs: [
        {
            id: 500,
            name: "question #1",
            groupId: 1000,
            sortOrder: 1,
            displayStyle: WorkflowNodeDisplayStyle.Normal,
            completionCriteriaType: WorkflowCompletionCriteriaType.fieldValue,
            activationCriteriaType: WorkflowCompletionCriteriaType.always,
            relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
            fieldName: "question1", fieldValueOperator: WorkflowFieldValueOperator.Truthy,
            defaultAssignees: [],
            thisNodeProgressWeight: 1,
            nodeDependencies: [],
            position: { x: 0, y: 0 },
            selected: false,
        },
        {
            id: 501,
            name: "question #2",
            groupId: 1000,
            sortOrder: 2,
            displayStyle: WorkflowNodeDisplayStyle.Normal,
            //assigneeAggregationBehavior: WorkflowNodeDefAssigneeAggregationBehavior.NotRequired,
            defaultAssignees: [],
            thisNodeProgressWeight: 1,
            nodeDependencies: [],
            completionCriteriaType: WorkflowCompletionCriteriaType.fieldValue,
            activationCriteriaType: WorkflowCompletionCriteriaType.always,
            relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
            fieldName: "question2",
            fieldValueOperator: WorkflowFieldValueOperator.Truthy,
            position: { x: 50, y: 10 },
            selected: false,
        },
        {
            id: 502,
            name: "question #3",
            groupId: 1000,
            sortOrder: 3,
            displayStyle: WorkflowNodeDisplayStyle.Normal,
            //assigneeAggregationBehavior: WorkflowNodeDefAssigneeAggregationBehavior.NotRequired,
            defaultAssignees: [],
            thisNodeProgressWeight: 1,
            nodeDependencies: [],
            completionCriteriaType: WorkflowCompletionCriteriaType.fieldValue,
            activationCriteriaType: WorkflowCompletionCriteriaType.always,
            relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
            fieldName: "question3",
            fieldValueOperator: WorkflowFieldValueOperator.Truthy,
            position: { x: 100, y: 20 },
            selected: false,
        },
        {
            id: 503,
            name: "AND When all are answered",
            groupId: 1001,
            sortOrder: 4,
            displayStyle: WorkflowNodeDisplayStyle.Normal,
            defaultAssignees: [],
            thisNodeProgressWeight: 1,

            completionCriteriaType: WorkflowCompletionCriteriaType.allNodesComplete,
            activationCriteriaType: WorkflowCompletionCriteriaType.someNodesComplete,
            relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
            position: { x: 0, y: 150 },
            selected: false,
            nodeDependencies: [
                {
                    nodeDefId: 500,
                    determinesActivation: true,
                    determinesCompleteness: true,
                    determinesRelevance: false,
                    selected: false,
                },
                {
                    nodeDefId: 501,
                    determinesActivation: true,
                    determinesCompleteness: true,
                    determinesRelevance: false,
                    selected: false,
                },
                {
                    nodeDefId: 502,
                    determinesActivation: true,
                    determinesCompleteness: true,
                    determinesRelevance: false,
                    selected: false,
                },
            ],
        },
        {
            id: 504,
            name: "OR When any are answered",
            groupId: 1001,
            sortOrder: 5,
            displayStyle: WorkflowNodeDisplayStyle.Normal,
            defaultAssignees: [],
            thisNodeProgressWeight: 1,

            completionCriteriaType: WorkflowCompletionCriteriaType.allNodesComplete,
            activationCriteriaType: WorkflowCompletionCriteriaType.allNodesComplete,
            relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
            position: { x: 150, y: 150 },
            selected: false,
            nodeDependencies: [
                {
                    nodeDefId: 500,
                    determinesActivation: true,
                    determinesCompleteness: true,
                    determinesRelevance: false,
                    selected: false,
                },
                {
                    nodeDefId: 501,
                    determinesActivation: true,
                    determinesCompleteness: true,
                    determinesRelevance: false,
                    selected: false,
                },
                {
                    nodeDefId: 502,
                    determinesActivation: true,
                    determinesCompleteness: true,
                    determinesRelevance: false,
                    selected: false,
                },
            ],
        },
    ]
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    evaluatedNode: WorkflowEvaluatedNode;
    api: WorkflowEvalProvider;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    evaluatedNode: WorkflowEvaluatedNode;
    api: WorkflowEvalProvider;
};

export const WorkflowNodeDueDateControl = ({ evaluatedNode, api }: WorkflowNodeProps) => {
    if (!evaluatedNode.dueDate) {
        return <div className="dueDate">No due date</div>;
    }
    return <div className="">there's a due date.</div>
};

export const WorkflowNodeComponent = ({ evaluatedNode, api }: WorkflowNodeProps) => {
    const obj = {
        progress: `${evaluatedNode.evaluation.progressState} (${evaluatedNode.evaluation.completenessNodesCompletedIncludingThis} / ${evaluatedNode.evaluation.completenessNodesTotalIncludingThis}) ${evaluatedNode.evaluation.progress01 === undefined ? "NA (p01=undefined)" : Math.round(evaluatedNode.evaluation.progress01 * 100)} %`,
    };

    let activeControls: React.ReactNode = null;
    switch (evaluatedNode.nodeDef.completionCriteriaType) {
        case WorkflowCompletionCriteriaType.never:
            activeControls = <div>(never complete)</div>;
            break;
        case WorkflowCompletionCriteriaType.always:
            activeControls = <div>(always complete)</div>;
            break;
        case WorkflowCompletionCriteriaType.allNodesComplete:
            activeControls = <div>(dependent nodes not complete)</div>;
            break;
        case WorkflowCompletionCriteriaType.someNodesComplete:
            activeControls = <div>(no dependent nodes complete)</div>;
            break;
        case WorkflowCompletionCriteriaType.fieldValue:
            activeControls = api.RenderFieldEditorForNode(evaluatedNode);
    }

    return (
        <div className={`workflowNodeContainer ${evaluatedNode.evaluation.progressState}`}>
            <div className={`name`}>{evaluatedNode.nodeDef.name} - #{evaluatedNode.nodeDef.id} - {evaluatedNode.evaluation.progressState} ({evaluatedNode.evaluation.dependentNodes.length} dependencies)</div>
            {
                evaluatedNode.evaluation.dependentNodes.length > 0 && (
                    evaluatedNode.evaluation.dependentNodes.map(n => <div key={n.nodeDef.id}>#{n.nodeDef.id}: {n.evaluation.progressState} / complete:{n.evaluation.isComplete ? "complete" : "not completed"}</div>)
                )
            }
            <DebugCollapsibleText obj={evaluatedNode.evaluation} />
            <KeyValueDisplay data={obj} />

            <WorkflowNodeDueDateControl evaluatedNode={evaluatedNode} api={api} />

            {activeControls}

        </div>
    );
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowGroupProps {
    groupDef: WorkflowNodeGroup;
    nodeInstances: WorkflowEvaluatedNode[];
    api: WorkflowEvalProvider;
};

export const WorkflowGroupComponent = (props: WorkflowGroupProps) => {
    const vars = GetStyleVariablesForColor({ color: props.groupDef.color, enabled: true, fillOption: "filled", selected: false, variation: "strong" });
    return (
        <div className="workflowNodeGroupContainer" style={vars.style}>
            <div>{props.groupDef.name}</div>
            {props.nodeInstances.sort(x => x.nodeDef.sortOrder).map(x => <WorkflowNodeComponent key={x.nodeDef.id} evaluatedNode={x} api={props.api} />)}
        </div>
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowContainerProps {
    flow: EvaluatedWorkflow;
    api: WorkflowEvalProvider;
};

export const WorkflowContainer = (props: WorkflowContainerProps) => {
    const { flow } = props;

    return (
        <div className="workflowContainer">
            {flow.flowInstance.flowDef.groups.map(groupDef => {
                const nodeInstances = flow.evaluatedNodes.filter(node => node.nodeDef.groupId === groupDef.id);
                return (
                    <WorkflowGroupComponent
                        key={groupDef.id}
                        groupDef={groupDef}
                        nodeInstances={nodeInstances}
                        api={props.api}
                    />
                );
            })}
        </div>
    );
};



interface FlowNodeData extends Record<string, unknown> {
    evaluatedNode: WorkflowEvaluatedNode,
    evaluatedWorkflow: EvaluatedWorkflow,
};
type CMFlowNode = Node<FlowNodeData>;

interface FlowNodeProps {
    id: string;
    isConnectable: boolean;
    data: FlowNodeData;

};

const FlowNodeNormal = (props: FlowNodeProps) => {
    const nodeDef = props.data.evaluatedNode.nodeDef;
    return <>
        <Handle
            type="target"
            position={Position.Top}
            style={{ background: '#555' }}
            onConnect={(params) => console.log('handle onConnect', params)}
        />
        <div>
            {nodeDef.name}
        </div>
        <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={props.isConnectable}
        />
    </>;
};


interface WorkflowNodeChangeArgs {
    nodeDefId: number;
    position?: { x: number, y: number };
    selected?: boolean;
};

interface WorkflowEdgeChangeArgs {
};

interface CMReactFlowState {
    nodes: CMFlowNode[];
    edges: Edge[];
};

interface WorkflowEditorProps {
    evaluatedWorkflow: EvaluatedWorkflow;
    reactFlowState: CMReactFlowState;
    onNodeChange: (args: WorkflowNodeChangeArgs) => void;
    onEdgeChange: (args: WorkflowEdgeChangeArgs) => void;
    onReactFlowStateChange: (state: CMReactFlowState) => void;
}

const calcReactFlowObjects = (evaluatedWorkflow: EvaluatedWorkflow, reactFlowState: CMReactFlowState): CMReactFlowState => {
    const nodes: CMFlowNode[] = evaluatedWorkflow.evaluatedNodes.map((node: WorkflowEvaluatedNode) => ({
        position: { x: 0, y: 0 },
        ...reactFlowState.nodes.find(n => n.id === node.nodeDef.id.toString()) || {},

        id: node.nodeDef.id.toString(),
        hidden: false,
        type: "cmNormal",
        data: {
            evaluatedNode: node,
            evaluatedWorkflow,
        },
        //selected: node.nodeDef.selected,
    }));

    const edges: Edge[] = evaluatedWorkflow.flowInstance.flowDef.nodeDefs.flatMap((nodeDef: WorkflowNodeDef) =>
        nodeDef.nodeDependencies.map(dep => {
            const ret: Edge = {
                ...reactFlowState.edges.find(n => n.id === `${dep.nodeDefId}:${nodeDef.id}`) || {},

                id: `${dep.nodeDefId}:${nodeDef.id}`,
                source: dep.nodeDefId.toString(),
                target: nodeDef.id.toString(),
                hidden: false,
                className: "CMEdge",
                //selected: dep.selected,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                    //color: '#FF0072',
                },
            };
            return ret;
        })
    );

    return {
        nodes,
        edges,
    }
};

const WorkflowEditor: React.FC<WorkflowEditorProps> = ({ evaluatedWorkflow, onNodeChange, ...props }) => {

    // yes it's actually way more reliable to use this for some reason. without it (if i try to build nodes on each render for example), somehow at some point all nodes will just disappear. something's wonky so don't bother.
    const s = calcReactFlowObjects(evaluatedWorkflow, props.reactFlowState);
    const [nodes, setNodes, onNodesChange] = useNodesState<CMFlowNode>(s.nodes);
    const [edges, setEdges, onEdgesChange] = useEdgesState(s.edges);

    React.useEffect(() => {
        console.log([nodes, edges]);
        setNodes(s.nodes);
        setEdges(s.edges);
    }, [evaluatedWorkflow.schemaHash]);

    const handleNodesChange = (changes: NodeChange<CMFlowNode>[]) => {
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                const nodeDefId = parseInt(change.id);
                //console.log(JSON.stringify(change.position));
                if (!isNaN(change.position.x) && !isNaN(change.position.y))// why is this even a thing? but it is.
                {
                    onNodeChange({
                        nodeDefId,
                        position: change.position,
                    });
                }
            }
            if (change.type === "select" && change.selected !== undefined) {
                const nodeDefId = parseInt(change.id);
                onNodeChange({
                    nodeDefId,
                    selected: change.selected!,
                });
            }
        });
        onNodesChange(changes);
        props.onReactFlowStateChange({ nodes, edges });
    };

    const handleEdgesChange = (changes: EdgeChange[]) => {
        changes.forEach(change => {
            console.log(change);
            switch (change.type) {
                case "add":
                    console.log(`todo: edge add`);
                    break;
                case "remove":
                    console.log(`todo: edge remove`);
                    break;
                //case "replace":
                case "select":
                    break;
            }
        });
        onEdgesChange(changes);
        props.onReactFlowStateChange({ nodes, edges });
    };

    return (
        <div style={{ width: '100%', height: '700px', border: '2px solid black' }}>
            <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                //onNodesChange={onNodesChange}
                //onEdgesChange={onEdgesChange}
                snapToGrid={true}
                nodeTypes={{
                    cmNormal: FlowNodeNormal,
                }}
            >
                <Controls />
                <Background />
            </ReactFlow>
        </div>
    );
};

interface WorkflowNodeEditorProps {
    workflowDef: WorkflowDef;
    nodeDef: WorkflowNodeDef;
};

const WorkflowNodeEditor = (props: WorkflowNodeEditorProps) => {
    return <div className="CMWorkflowNodeEditorContainer">
        <div>ID:{props.nodeDef.id}</div>
        <div>Name:{props.nodeDef.name}</div>
    </div>;
};

export const WorkflowContainerPOC: React.FC = () => {
    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => initializeWorkflowInstance(minimalWorkflow));
    const [reevalToken, setReevalToken] = React.useState<number>(0);
    const [model, setModel] = React.useState({
        question1: false,
        question2: false,
    });
    const [selectedNodeDefId, setSelectedNodeDefId] = React.useState<number | undefined>(undefined);
    const [selectedEdgeId, setSelectedEdgeId] = React.useState<string | undefined>(undefined);
    const [flowState, setFlowState] = React.useState<CMReactFlowState>({ nodes: [], edges: [] });
    const provider: WorkflowEvalProvider = {
        DoesFieldValueSatisfyCompletionCriteria: (node): boolean => {
            const val = model[node.nodeDef.fieldName!]!;
            switch (node.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Null:
                    return val == null;
                case WorkflowFieldValueOperator.NotNull:
                    return val != null;
                case WorkflowFieldValueOperator.Falsy:
                    return !val;
                case WorkflowFieldValueOperator.Truthy:
                    return !!val;
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return val === node.nodeDef.fieldValueOperand2;
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return val !== node.nodeDef.fieldValueOperand2;
            }
            return false;
        },
        RenderFieldEditorForNode: (node: WorkflowEvaluatedNode) => {
            const fieldVal: boolean = model[node.nodeDef.fieldName!]!;
            return <CMSmallButton onClick={() => {
                setModel(prevModel => ({
                    ...prevModel,
                    [node.nodeDef.fieldName!]: !fieldVal
                }));
                setWorkflowInstance({ ...workflowInstance });
            }}>{fieldVal ? "unapprove" : "approve"}</CMSmallButton>
        },
        RegisterStateChange: (node: WorkflowEvaluatedNode, oldState) => {
            // TODO
        }
    };

    //const evaluatedWorkflow = React.useMemo(() => {
    const tidiedInstance = TidyWorkflowInstance(workflowInstance);
    const evaluatedWorkflow = EvaluateWorkflow(tidiedInstance, provider);
    //return EvaluateWorkflow(tidiedInstance, provider);
    //}, [workflowInstance, provider, reevalToken]);

    const handleNodeChange = (args: WorkflowNodeChangeArgs) => {
        setWorkflowInstance(prevInstance => {
            const n = { ...prevInstance };
            const defs: WorkflowNodeDef[] = [
                n.flowDef.nodeDefs.find(nd => nd.id === args.nodeDefId)!,
            ];
            const inst = n.nodeInstances.find(ni => ni.nodeDef.id === args.nodeDefId);
            if (inst) {
                defs.push(inst.nodeDef);
            }

            if (args.position !== undefined) {
                //defs.forEach(x => x.position = args.position!);
            }
            if (args.selected !== undefined) {
                if (args.selected) {
                    setSelectedNodeDefId(args.nodeDefId);
                }
                //defs.forEach(x => x.selected = args.selected!);
            }
            return n;
        });
    };

    return (
        <div>
            <WorkflowContainer flow={evaluatedWorkflow} api={provider} />
            <CMSmallButton onClick={() => {
                setReevalToken(reevalToken + 1);
            }}>Re-evaluate</CMSmallButton>
            <CMSmallButton onClick={() => {
                const n: WorkflowNodeDef = {
                    id: 1000 + getNextSequenceId(),
                    name: nanoid(),
                    groupId: 1000,
                    sortOrder: 100 + getNextSequenceId(),
                    displayStyle: WorkflowNodeDisplayStyle.Normal,
                    completionCriteriaType: WorkflowCompletionCriteriaType.always,
                    activationCriteriaType: WorkflowCompletionCriteriaType.always,
                    relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
                    defaultAssignees: [],
                    thisNodeProgressWeight: 1,
                    nodeDependencies: [],
                    position: { x: 0, y: 0 },
                    selected: false,
                };
                minimalWorkflow.nodeDefs.push(n);
                console.log(`added a new node. node, then workflow:`);
                console.log(n);
                console.log(minimalWorkflow);
                setReevalToken(reevalToken + 1);
            }}>add a node</CMSmallButton>
            <div>Schema hash: {evaluatedWorkflow.schemaHash}</div>
            <div>selected instance id: {evaluatedWorkflow.flowInstance.nodeInstances.find(ni => ni.nodeDef.id === selectedNodeDefId)?.id || "<null>"}</div>
            <WorkflowEditor
                evaluatedWorkflow={evaluatedWorkflow}
                onNodeChange={handleNodeChange}
                onEdgeChange={() => { }}
                onReactFlowStateChange={(state) => setFlowState(state)}
                reactFlowState={flowState}
            />
            {!!selectedNodeDefId &&
                <WorkflowNodeEditor
                    workflowDef={minimalWorkflow}
                    nodeDef={minimalWorkflow.nodeDefs.find(n => n.id === selectedNodeDefId)!}
                />
            }
        </div>
    );
};
