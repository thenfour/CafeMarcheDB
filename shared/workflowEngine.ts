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

//import React from "react";
//import { CMSmallButton, DebugCollapsibleAdminText, DebugCollapsibleText, KeyValueDisplay, NameValuePair } from "./CMCoreComponents2";
//import { ColorPick, GetStyleVariablesForColor } from "./Color";
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
    Connection,
    XYPosition,
    useReactFlow,
    ReactFlowProvider,
    NodeResizer,
} from '@xyflow/react';

import '@xyflow/react/dist/style.css';
import { nanoid } from "nanoid";
import { getHashedColor, getNextSequenceId, hashString, sortBy } from "shared/utils";
//import { InspectObject } from "./CMCoreComponents";
import { gAppColors, gGeneralPaletteList, gLightSwatchColors } from "shared/color";
//import { CMTextField, CMTextInputBase } from "./CMTextField";
//import { ChipSelector, EnumChipSelector } from "./ChipSelector";
import { Button, Checkbox, FormControlLabel, Tooltip } from "@mui/material";










///////////// DEFS /////////////////////////////////////////////////////////////////
export interface WorkflowNodeDependency {
    nodeDefId: number;
    selected: boolean; // for react flow simplification
    determinesRelevance: boolean;
    determinesActivation: boolean;
    determinesCompleteness: boolean;
};

// completion criteria is on the current node, basically that determines progress from started to completed.
// mostly that means activities that occur on THIS node, but in the case of purely logic nodes it could be about
// other nodes as well (as in ActivationCriteria).
export enum WorkflowCompletionCriteriaType {
    fieldValue = "fieldValue", // a field is to be checked

    // from WorkflowActivationCriteriaType
    never = "never", // more of a debugging tool than anything
    always = "always", // always activated
    someNodesComplete = "someNodesComplete", // logical OR of nodeIds
    allNodesComplete = "allNodesComplete", // logical AND of nodeIds
};

export enum WorkflowFieldValueOperator {
    NotNull = "Null",
    Null = "Null",
    EqualsOperand2 = "EqualsOperand2",
    NotEqualsOperand2 = "NotEqualsOperand2",
    Truthy = "Truthy",
    Falsy = "Falsy",
};

// when displaying the workflow, nodes are grouped together
export interface WorkflowNodeGroupDef {
    id: number;
    name: string;
    color: string;
    selected: boolean;
    position: XYPosition;
    width: number | undefined;
    height: number | undefined;
};

export enum WorkflowNodeDisplayStyle {
    Hidden = "Hidden",
    Normal = "Normal",
};

export interface WorkflowNodeAssignee {
    isRequired: boolean;
    userId: number;
}

export interface WorkflowNodeDef {
    id: number;

    name: string;
    groupDefId: number | null; // WorkflowNodeGroup.id

    // UI display & basic behaviors
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

    position: XYPosition, // for React Flow
    selected: boolean;
    width: number | undefined;
    height: number | undefined;
};

export interface WorkflowDef {
    id: number;
    name: string;
    groupDefs: WorkflowNodeGroupDef[];
    nodeDefs: WorkflowNodeDef[];
};


///////////// INSTANCE /////////////////////////////////////////////////////////////////
export enum WorkflowLogItemType {
    FieldUpdated,// field updated
    AssigneesChanged,// assignee changed
    DueDateChanged,// duedate changed
};

export interface WorkflowLogItem {
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
    nodeDefId: number;
    //nodeDef: WorkflowNodeDef;
    activeStateFirstTriggeredAt: Date | undefined;
    lastProgressState: WorkflowNodeProgressState;
    silenceAlerts: boolean; // "pause" behavior
    assignees: WorkflowNodeAssignee[];
    dueDate?: Date;
};

export type WorkflowTidiedNodeInstance = WorkflowNodeInstance & {
    isTidy: true;
};

export interface WorkflowInstance {
    //flowDef: WorkflowDef;
    nodeInstances: WorkflowNodeInstance[];
    log: WorkflowLogItem[];
};

// workflows get preprocessed for GUI work
export type WorkflowTidiedInstance = Omit<WorkflowInstance, "nodeInstances"> & {
    isTidy: true;
    nodeInstances: WorkflowTidiedNodeInstance[];
};

///////////// EVALUATION /////////////////////////////////////////////////////////////////
export enum WorkflowNodeProgressState {
    InvalidState = "InvalidState", // initial before evaluation etc. never to reach the user.
    Irrelevant = "Irrelevant", // effectively visibility = relevance. Irrelevant nodes are not shown.
    Relevant = "Relevant", // unable to enter started/activated state because of dependencies.
    Activated = "Activated", // blocked from completed state because of 
    Completed = "Completed",
};

export interface WorkflowNodeEvaluation {
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

export type WorkflowEvaluatedNode = WorkflowTidiedNodeInstance & {
    evaluation: WorkflowNodeEvaluation;
};

export type WorkflowEvaluatedDependentNode = WorkflowEvaluatedNode & {
    dependency: WorkflowNodeDependency;
};

export interface EvaluatedWorkflow {
    flowInstance: WorkflowTidiedInstance;
    schemaHash: string;
    evaluatedNodes: WorkflowEvaluatedNode[];
};

export function GetWorkflowDefSchemaHash(flowDef: WorkflowDef) {
    return hashString(JSON.stringify(flowDef, (key, val) => {
        // don't put these very "live" react flow state objects in the hash.
        switch (key) {
            case 'position':
            case 'selected':
            case 'width':
            case 'height':
                return 0;
        }
        return val;
    })).toString();
}


///////////// API /////////////////////////////////////////////////////////////////
// ensures all nodes are represented in the flow.
// ensures all instance nodes are valid
// validation of the flow
// - no duplicate dependencies
// - ???
export const TidyWorkflowInstance = (flowInstance: WorkflowInstance, def: WorkflowDef): WorkflowTidiedInstance => {

    const nodeInstanceMap = new Map<number, WorkflowNodeInstance>(); // map nodeDefId to node instance
    flowInstance.nodeInstances.forEach(node => nodeInstanceMap.set(node.nodeDefId, node));

    // Iterate through all node definitions and ensure each has a corresponding node instance.
    // this also has the effect that instance nodes which arent in the def will be elided.
    const tidiedNodes: WorkflowTidiedNodeInstance[] = def.nodeDefs.map(nodeDef => {
        if (nodeInstanceMap.has(nodeDef.id)) {
            // If the node instance already exists, use it
            const untidy = nodeInstanceMap.get(nodeDef.id)!;
            const tidy: WorkflowTidiedNodeInstance = {
                ...untidy,
                isTidy: true,
            };
            return tidy;
        } else {
            // create a default instance node
            const ret: WorkflowTidiedNodeInstance = {
                id: -getNextSequenceId(),
                silenceAlerts: false,
                activeStateFirstTriggeredAt: undefined,
                nodeDefId: nodeDef.id,
                lastProgressState: WorkflowNodeProgressState.InvalidState,
                assignees: nodeDef.defaultAssignees,
                isTidy: true,
            };
            return ret;
        }
    });

    return {
        //flowDef,
        nodeInstances: tidiedNodes,
        log: flowInstance.log,
        isTidy: true,
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

export interface WorkflowEvalProvider {
    DoesFieldValueSatisfyCompletionCriteria: (node: WorkflowTidiedNodeInstance, assignee: undefined | WorkflowNodeAssignee) => boolean;
    RenderFieldEditorForNode: (node: WorkflowEvaluatedNode) => React.ReactNode;
    RegisterStateChange: (node: WorkflowEvaluatedNode, oldState: WorkflowNodeProgressState) => void; // register a change in the db as last known progress state. node.progressState will be updated already.
};

const EvaluateTree = (parentPathNodeDefIds: number[], flowDef: WorkflowDef, node: WorkflowTidiedNodeInstance, flowInstance: WorkflowTidiedInstance, api: WorkflowEvalProvider, evaluatedNodes: WorkflowEvaluatedNode[]): WorkflowEvaluatedNode => {
    const existingEvaluation = evaluatedNodes.find(n => n.nodeDefId === node.nodeDefId);
    if (existingEvaluation) {
        return existingEvaluation;
    }

    if (parentPathNodeDefIds.includes(node.nodeDefId)) {
        throw new Error(`Circular dependency exists in the tree.`);
    }

    const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;

    // evaluate dependencies
    const evaluatedChildren: WorkflowEvaluatedDependentNode[] = nodeDef.nodeDependencies.map(childDependency => {
        const evaluatedChild = EvaluateTree(
            [...parentPathNodeDefIds, node.nodeDefId],
            flowDef,
            flowInstance.nodeInstances.find(n => n.nodeDefId === childDependency.nodeDefId)!,
            flowInstance,
            api,
            evaluatedNodes
        );
        const ret: WorkflowEvaluatedDependentNode = {
            ...evaluatedChild,
            dependency: childDependency,
        }
        return ret;
    });

    const completionDependsOnChildren = [WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(nodeDef.completionCriteriaType);

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
        completionWeightTotalIncludingThis: nodeDef.thisNodeProgressWeight,// accumulated
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

    switch (nodeDef.relevanceCriteriaType) {
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

    switch (nodeDef.activationCriteriaType) {
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
    switch (nodeDef.completionCriteriaType) {
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
            evaluation.completionWeightCompletedIncludingThis = addMulPropagatingUnknown(nodeDef.thisNodeProgressWeight, thisNodeProgress01, evaluation.completionWeightCompletedIncludingThis);
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

export const EvaluateWorkflow = (flowDef: WorkflowDef, flowInstance: WorkflowTidiedInstance, api: WorkflowEvalProvider): EvaluatedWorkflow => {
    const evaluatedNodes: WorkflowEvaluatedNode[] = [];

    for (let i = 0; i < flowInstance.nodeInstances.length; ++i) {
        EvaluateTree([], flowDef, flowInstance.nodeInstances[i]!, flowInstance, api, evaluatedNodes);
    }

    // trigger state change hooks
    for (let i = 0; i < flowInstance.nodeInstances.length; ++i) {
        const node = evaluatedNodes.find(en => en.nodeDefId === flowInstance.nodeInstances[i]!.nodeDefId)!;
        const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
        if ((node.evaluation.progressState === WorkflowNodeProgressState.InvalidState) || (node.evaluation.progressState !== node.lastProgressState)) {
            const oldState = node.lastProgressState;
            node.lastProgressState = node.evaluation.progressState;

            if ((node.activeStateFirstTriggeredAt === undefined) && node.evaluation.isInProgress && isNumber(nodeDef.defaultDueDateDurationMsAfterStarted)) {
                node.dueDate = new Date(new Date().getTime() + nodeDef.defaultDueDateDurationMsAfterStarted);
            }

            api.RegisterStateChange(node, oldState);
        }
    }

    const ret: EvaluatedWorkflow = {
        evaluatedNodes,
        flowInstance,
        schemaHash: GetWorkflowDefSchemaHash(flowDef),
    };
    return ret;
};

