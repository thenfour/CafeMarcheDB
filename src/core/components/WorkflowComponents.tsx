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
import { CMSmallButton, DebugCollapsibleAdminText, DebugCollapsibleText, KeyValueDisplay, NameValuePair } from "./CMCoreComponents2";
import { ColorPick, GetStyleVariablesForColor } from "./Color";
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
import { getNextSequenceId, hashString, sortBy } from "shared/utils";
import { InspectObject } from "./CMCoreComponents";
import { gAppColors, gGeneralPaletteList, gLightSwatchColors } from "shared/color";
import { CMTextField, CMTextInputBase } from "./CMTextField";
import { EnumChipSelector } from "./ChipSelector";










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
    groupDefId: number | undefined; // WorkflowNodeGroup.id

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


export const initializeWorkflowInstance = (workflowDef: WorkflowDef): WorkflowInstance => {
    return {
        nodeInstances: [],
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



const makeConnectionId = (srcNodeDefId: number, targetNodeDefId: number) => {
    return `${srcNodeDefId}:${targetNodeDefId}`;
}

const makeNormalNodeId = (nodeDefId: number) => {
    return `n:${nodeDefId}`;
}

const makeGroupNodeId = (groupDefId: number) => {
    return `g:${groupDefId}`;
}

const parseNodeId = (id: string): { type: "group" | "node", defId: number } => {
    const parts = id.split(':');
    const typeChar = parts[0]!;
    const type = typeChar === 'g' ? "group" : "node";
    const defId = parseInt(parts[1]!, 10);
    return { type, defId };
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    evaluatedNode: WorkflowEvaluatedNode;
    api: WorkflowEvalProvider;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    flowDef: WorkflowDef;
    evaluatedNode: WorkflowEvaluatedNode;
    api: WorkflowEvalProvider;
};

export const WorkflowNodeComponent = ({ flowDef, evaluatedNode, api }: WorkflowNodeProps) => {
    const obj = {
        progress: `${evaluatedNode.evaluation.progressState} (${evaluatedNode.evaluation.completenessNodesCompletedIncludingThis} / ${evaluatedNode.evaluation.completenessNodesTotalIncludingThis}) ${evaluatedNode.evaluation.progress01 === undefined ? "NA (p01=undefined)" : Math.round(evaluatedNode.evaluation.progress01 * 100)} %`,
    };

    const nodeDef = flowDef.nodeDefs.find(nd => nd.id === evaluatedNode.nodeDefId)!;

    let activeControls: React.ReactNode = null;
    switch (nodeDef.completionCriteriaType) {
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
            <div className={`name`}>{nodeDef.name} - #{evaluatedNode.nodeDefId} - {evaluatedNode.evaluation.progressState} ({evaluatedNode.evaluation.dependentNodes.length} dependencies)</div>
            {
                evaluatedNode.evaluation.dependentNodes.length > 0 && (
                    evaluatedNode.evaluation.dependentNodes.map(n => <div key={n.nodeDefId}>#{n.nodeDefId}: {n.evaluation.progressState} / complete:{n.evaluation.isComplete ? "complete" : "not completed"}</div>)
                )
            }
            <DebugCollapsibleText obj={evaluatedNode.evaluation} />
            <KeyValueDisplay data={obj} />

            {/* <WorkflowNodeDueDateControl evaluatedNode={evaluatedNode} api={api} /> */}

            {activeControls}

        </div>
    );
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowGroupProps {
    groupDefId: number | undefined;
    flowDef: WorkflowDef;
    nodeInstances: WorkflowEvaluatedNode[];
    api: WorkflowEvalProvider;
};

export const WorkflowGroupComponent = (props: WorkflowGroupProps) => {
    const groupDef = props.flowDef.groupDefs.find(g => g.id === props.groupDefId) || {
        color: "gray",
        name: "ungrouped",
        id: -1334,
        selected: false,
        position: { x: 0, y: 0 },
        height: 100,
        width: 150,
    };
    const vars = GetStyleVariablesForColor({ color: groupDef.color, enabled: true, fillOption: "filled", selected: false, variation: "strong" });
    const getNodeDef = (nodeDefId: number) => props.flowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    const filteredNodes = props.nodeInstances.filter(ni => {
        const nodeDef = props.flowDef.nodeDefs.find(n => n.id === ni.nodeDefId)!;
        return nodeDef.groupDefId === props.groupDefId;
    });
    const sortedNodes = sortBy(filteredNodes, n => getNodeDef(n.nodeDefId).position.y);
    return (
        <div className="workflowNodeGroupContainer" style={vars.style}>
            <div>{groupDef.name}</div>
            {sortedNodes.map(x => <WorkflowNodeComponent flowDef={props.flowDef} key={x.nodeDefId} evaluatedNode={x} api={props.api} />)}
        </div>
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowContainerProps {
    flowDef: WorkflowDef;
    flow: EvaluatedWorkflow;
    api: WorkflowEvalProvider;
};

export const WorkflowContainer = (props: WorkflowContainerProps) => {
    const { flow } = props;

    const sortedGroups = sortBy(props.flowDef.groupDefs, g => g.position.y);
    const ungroupedNodes = flow.evaluatedNodes.filter(node => {
        const nodeDef = props.flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
        if (!nodeDef) return false;
        return nodeDef.groupDefId === undefined;
    });

    return (
        <div className="workflowContainer">
            {
                ungroupedNodes.length && <WorkflowGroupComponent
                    flowDef={props.flowDef}
                    groupDefId={undefined}
                    nodeInstances={ungroupedNodes}
                    api={props.api}
                />
            }
            {sortedGroups.map(groupDef => {
                const nodeInstances = flow.evaluatedNodes.filter(node => {
                    const nodeDef = props.flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
                    return nodeDef?.groupDefId === groupDef.id;
                });
                return (
                    <WorkflowGroupComponent
                        key={groupDef.id}
                        flowDef={props.flowDef}
                        groupDefId={groupDef.id}
                        nodeInstances={nodeInstances}
                        api={props.api}
                    />
                );
            })}
        </div>
    );
};



interface FlowNodeData extends Record<string, unknown> {
    evaluatedNode?: WorkflowEvaluatedNode | undefined,
    groupDef?: WorkflowNodeGroupDef | undefined,
    flowDef: WorkflowDef,
    evaluatedWorkflow: EvaluatedWorkflow,
};
type CMFlowNode = Node<FlowNodeData>;

interface FlowNodeNormalProps {
    id: string;
    isConnectable: boolean;
    data: FlowNodeData;
};

const FlowNodeNormal = (props: FlowNodeNormalProps) => {
    const nodeDef = props.data.flowDef.nodeDefs.find(nd => nd.id === props.data.evaluatedNode!.nodeDefId)!;
    return <>
        <Handle
            type="target"
            position={Position.Top}
            //style={{ background: '#555' }}
            onConnect={(params) => console.log('handle onConnect', params)}
        />
        <div>
            {nodeDef?.name || ""}
        </div>
        <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={props.isConnectable}
        />
    </>;
};

const FlowNodeGroup = (props: FlowNodeNormalProps) => {
    //const groupDef = props.data.flowDef.nodeDefs.find(nd => nd.id === props.data.evaluatedNode.nodeDefId)!;
    const vars = GetStyleVariablesForColor({ color: props.data.groupDef!.color, enabled: true, fillOption: "filled", selected: false, variation: "strong" });
    return <>
        <NodeResizer minWidth={100} minHeight={30} />
        <div className={`CMFlowGroup ${vars.cssClass}`} style={vars.style}>{props.data.groupDef!.name || ""}</div>
    </>;
};

interface WorkflowDefMutator_Args {
    sourceDef: WorkflowDef;
};

type WorkflowDefMutator_AddNodeArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
};

type WorkflowDefMutator_DeleteNodeArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
};

type WorkflowDefMutator_SetNodeSelectedArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
    selected: boolean;
};

type WorkflowDefMutator_SetNodePositionArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
    position: XYPosition;
};

type WorkflowDefMutator_SetNodeSizeArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
    width: number;
    height: number;
};

type WorkflowDefMutator_SetNodeBasicInfoArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
    name?: string | undefined;
    displayStyle?: WorkflowNodeDisplayStyle | undefined;
    thisNodeProgressWeight?: number | undefined;
};

type WorkflowDefMutator_SetNodeGroupArgs = WorkflowDefMutator_Args & {
    nodeDef: WorkflowNodeDef;
    groupDefId: number;
};


type WorkflowDefMutator_AddGroupArgs = WorkflowDefMutator_Args & {
    groupDef: WorkflowNodeGroupDef;
};

type WorkflowDefMutator_DeleteGroupArgs = WorkflowDefMutator_Args & {
    groupDef: WorkflowNodeGroupDef;
};

type WorkflowDefMutator_SetGroupSelectedArgs = WorkflowDefMutator_Args & {
    groupDef: WorkflowNodeGroupDef;
    selected: boolean;
};

type WorkflowDefMutator_SetGroupPositionArgs = WorkflowDefMutator_Args & {
    groupDef: WorkflowNodeGroupDef;
    position: XYPosition;
};

type WorkflowDefMutator_SetGroupSizeArgs = WorkflowDefMutator_Args & {
    groupDef: WorkflowNodeGroupDef;
    width: number;
    height: number;
};

type WorkflowDefMutator_SetGroupParams = WorkflowDefMutator_Args & {
    groupDef: WorkflowNodeGroupDef;
    name?: string | undefined;
    color?: string | undefined;
};

type WorkflowDefMutator_ConnectNodesArgs = WorkflowDefMutator_Args & {
    sourceNodeDef: WorkflowNodeDef;
    targetNodeDef: WorkflowNodeDef;
};

type WorkflowDefMutator_SetEdgeSelectedArgs = WorkflowDefMutator_Args & {
    sourceNodeDef: WorkflowNodeDef;
    targetNodeDef: WorkflowNodeDef;
    selected: boolean;
};

type WorkflowDefMutator_MutatorFn<T> = (args: WorkflowDefMutator_Args & T) => WorkflowDef | undefined;

export interface WorkflowDefMutator {
    // after mutations, this gets called to set state.
    setWorkflowDef: (args: { flowDef: WorkflowDef }) => void;

    // take the incoming source workflow def and output a mutated version. if no mutation, return undefined. that's important to avoid endless state loop
    addNode: (args: WorkflowDefMutator_AddNodeArgs) => WorkflowDef | undefined;
    deleteNode: (args: WorkflowDefMutator_DeleteNodeArgs) => WorkflowDef | undefined;
    setNodeSelected: (args: WorkflowDefMutator_SetNodeSelectedArgs) => WorkflowDef | undefined;
    setNodePosition: (args: WorkflowDefMutator_SetNodePositionArgs) => WorkflowDef | undefined;
    setNodeSize: (args: WorkflowDefMutator_SetNodeSizeArgs) => WorkflowDef | undefined;

    setNodeBasicInfo: (args: WorkflowDefMutator_SetNodeBasicInfoArgs) => WorkflowDef | undefined;
    setNodeGroup: (args: WorkflowDefMutator_SetNodeGroupArgs) => WorkflowDef | undefined;
    setNodeFieldInfo: WorkflowDefMutator_MutatorFn<{
        nodeDef: WorkflowNodeDef,
        fieldName: string | undefined;
        fieldValueOperator: WorkflowFieldValueOperator | undefined;
        fieldValueOperand2: unknown; // for things like less than, equals, whatever.
    }>;
    setNodeRelevanceCriteriaType: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeActivationCriteriaType: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeCompletionCriteriaType: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeDefaultAssignees: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, defaultAssignees: WorkflowNodeAssignee[] }>;
    setNodeDefaultDueDateMsAfterStarted: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, defaultDueDateDurationMsAfterStarted?: number | undefined }>;

    setEdgeInfo: WorkflowDefMutator_MutatorFn<{
        nodeDef: WorkflowNodeDef,
        dependencyDef: WorkflowNodeDependency,
        determinesRelevance?: boolean | undefined;
        determinesActivation?: boolean | undefined;
        determinesCompleteness?: boolean | undefined;
    }>;

    connectNodes: (args: WorkflowDefMutator_ConnectNodesArgs) => WorkflowDef | undefined;
    deleteConnection: (args: WorkflowDefMutator_ConnectNodesArgs) => WorkflowDef | undefined;
    setEdgeSelected: (args: WorkflowDefMutator_SetEdgeSelectedArgs) => WorkflowDef | undefined;

    addGroup: (args: WorkflowDefMutator_AddGroupArgs) => WorkflowDef | undefined;
    deleteGroup: (args: WorkflowDefMutator_DeleteGroupArgs) => WorkflowDef | undefined;
    setGroupSelected: (args: WorkflowDefMutator_SetGroupSelectedArgs) => WorkflowDef | undefined;
    setGroupPosition: (args: WorkflowDefMutator_SetGroupPositionArgs) => WorkflowDef | undefined;
    setGroupSize: (args: WorkflowDefMutator_SetGroupSizeArgs) => WorkflowDef | undefined;
    setGroupParams: (args: WorkflowDefMutator_SetGroupParams) => WorkflowDef | undefined;
};

interface CMReactFlowState {
    nodes: CMFlowNode[];
    edges: Edge[];
};

const calcReactFlowObjects = (evaluatedWorkflow: EvaluatedWorkflow, flowDef: WorkflowDef/*, reactFlowState: CMReactFlowState*/): CMReactFlowState => {

    const groups: CMFlowNode[] = flowDef.groupDefs.map(group => {
        const ret: CMFlowNode = {
            position: group.position,
            selected: group.selected,
            width: group.width,
            height: group.height,
            zIndex: 100,

            // and new data
            id: makeGroupNodeId(group.id),
            hidden: false,
            type: "cmGroup",
            data: {
                evaluatedNode: undefined,
                groupDef: group,
                evaluatedWorkflow,
                flowDef,
            },
        };
        return ret;
    });

    const normalNodes: CMFlowNode[] = evaluatedWorkflow.evaluatedNodes.map((node: WorkflowEvaluatedNode) => {
        const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
        const ret: CMFlowNode = {
            position: nodeDef?.position || { x: 0, y: 0 },
            selected: nodeDef?.selected || false,
            zIndex: 150,

            extent: (nodeDef?.groupDefId) === undefined ? undefined : "parent",
            parentId: (nodeDef?.groupDefId) === undefined ? undefined : makeGroupNodeId(nodeDef.groupDefId),

            // and new data
            id: makeNormalNodeId(node.nodeDefId),
            hidden: false,
            type: "cmNormal",
            data: {
                evaluatedNode: node,
                evaluatedWorkflow,
                flowDef,
            },
        };
        return ret;
    });

    const nodes = [...groups, ...normalNodes];

    const edges: Edge[] = flowDef.nodeDefs.flatMap((nodeDef: WorkflowNodeDef) =>
        nodeDef.nodeDependencies.map(dep => {
            const ret: Edge = {
                selected: dep.selected,
                id: makeConnectionId(dep.nodeDefId, nodeDef.id),
                source: makeNormalNodeId(dep.nodeDefId),
                target: makeNormalNodeId(nodeDef.id),
                zIndex: 125,
                hidden: false,
                className: "CMEdge",
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
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

const gNodeTypes = {
    cmNormal: FlowNodeNormal,
    cmGroup: FlowNodeGroup,
};

interface WorkflowReactFlowEditorProps {
    flowDef: WorkflowDef;
    evaluatedWorkflow: EvaluatedWorkflow;
    schemaHash: string;
    defMutator: WorkflowDefMutator;
}

const WorkflowReactFlowEditor: React.FC<WorkflowReactFlowEditorProps> = ({ evaluatedWorkflow, ...props }) => {

    const reactFlow = useReactFlow();

    const s = calcReactFlowObjects(evaluatedWorkflow, props.flowDef);//, props.reactFlowState);

    const getGroupDef__ = (id: number) => {
        return props.flowDef.groupDefs.find(g => g.id === id)!;
    }

    const getNodeDef__ = (id: number) => {
        return props.flowDef.nodeDefs.find(g => g.id === id)!;
    }

    interface ParsedGroupDef {
        type: "group";
        groupDef: WorkflowNodeGroupDef;
    };
    interface ParsedNodeDef {
        type: "node";
        nodeDef: WorkflowNodeDef;
    };

    const getDef = (id: string): (ParsedNodeDef | ParsedGroupDef) & { defId: number } => {
        const p = parseNodeId(id);
        if (p.type === "group") {
            return {
                type: p.type,
                defId: p.defId,
                groupDef: getGroupDef__(p.defId),
            }
        }
        return {
            type: p.type,
            defId: p.defId,
            nodeDef: getNodeDef__(p.defId),
        }
    };

    const parseConnectionId = (id: string) => {
        const parts = id.split(':');
        const srcNodeDefId = parseInt(parts[0]!, 10);
        const targetNodeDefId = parseInt(parts[1]!, 10);
        return { srcNodeDef: getNodeDef__(srcNodeDefId), targetNodeDef: getNodeDef__(targetNodeDefId) };
    };

    const handleNodesChange = (changes: NodeChange<CMFlowNode>[]) => {
        //console.log(changes);
        let mutatingDef: WorkflowDef = { ...props.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                const parsedDef = getDef(change.id);
                if (!isNaN(change.position.x) && !isNaN(change.position.y))// why is this even a thing? but it is.
                {
                    if (parsedDef.type === "group") {
                        applyMutation(props.defMutator.setGroupPosition({
                            sourceDef: mutatingDef,
                            groupDef: parsedDef.groupDef,
                            position: change.position
                        }));
                    } else {
                        applyMutation(props.defMutator.setNodePosition({
                            sourceDef: mutatingDef,
                            nodeDef: parsedDef.nodeDef,
                            position: change.position
                        }));
                    }
                }
            }

            if (change.type === 'dimensions' && change.dimensions) {
                //console.log(`dimensions: ${JSON.stringify(change)}`);
                const parsedDef = getDef(change.id);
                if (!isNaN(change.dimensions.height) && !isNaN(change.dimensions.width)) // this may not be necessary
                {
                    if (parsedDef.type === "group") {
                        applyMutation(props.defMutator.setGroupSize({
                            sourceDef: mutatingDef,
                            groupDef: parsedDef.groupDef,
                            height: change.dimensions.height,
                            width: change.dimensions.width,
                        }));
                    } else {
                        applyMutation(props.defMutator.setNodeSize({
                            sourceDef: mutatingDef,
                            nodeDef: parsedDef.nodeDef,
                            height: change.dimensions.height,
                            width: change.dimensions.width,
                        }));
                    }
                }
            }
            if (change.type === "select" && change.selected !== undefined) {
                const parsedDef = getDef(change.id);
                if (parsedDef.type === "group") {
                    applyMutation(props.defMutator.setGroupSelected({
                        sourceDef: mutatingDef,
                        groupDef: parsedDef.groupDef,
                        selected: change.selected,
                    }));
                } else {
                    applyMutation(props.defMutator.setNodeSelected({
                        sourceDef: mutatingDef,
                        nodeDef: parsedDef.nodeDef,
                        selected: change.selected,
                    }));
                }
            }
            if (change.type === "remove") {
                const parsedDef = getDef(change.id);
                if (parsedDef.type === "group") {
                    applyMutation(props.defMutator.deleteGroup({
                        sourceDef: mutatingDef,
                        groupDef: parsedDef.groupDef,
                    }));
                } else {
                    applyMutation(props.defMutator.deleteNode({
                        sourceDef: mutatingDef,
                        nodeDef: parsedDef.nodeDef,
                    }));
                }
            }
        });
        if (changesOccurred) {
            props.defMutator.setWorkflowDef({ flowDef: mutatingDef });
        }
    };

    const handleEdgesChange = (changes: EdgeChange[]) => {
        let mutatingDef: WorkflowDef = { ...props.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        changes.forEach(change => {
            switch (change.type) {
                case "add":
                    console.log(`todo: edge add`);
                    break;
                case "remove":
                    {
                        const parsed = parseConnectionId(change.id);
                        applyMutation(props.defMutator.deleteConnection({
                            sourceDef: mutatingDef,
                            sourceNodeDef: parsed.srcNodeDef,
                            targetNodeDef: parsed.targetNodeDef,
                        }));
                        break;
                    }
                //case "replace":
                case "select":
                    {
                        const parsed = parseConnectionId(change.id);
                        applyMutation(props.defMutator.setEdgeSelected({
                            sourceDef: mutatingDef,
                            selected: change.selected,
                            sourceNodeDef: parsed.srcNodeDef,
                            targetNodeDef: parsed.targetNodeDef,
                        }));
                        break;
                    }
            }
        });
        if (changesOccurred) {
            props.defMutator.setWorkflowDef({ flowDef: mutatingDef });
        }
    };

    const handleConnect = (connection: Connection) => {
        let mutatingDef: WorkflowDef = { ...props.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        const parsedSource = getDef(connection.source);
        const parsedTarget = getDef(connection.target);
        if (parsedSource.type === "node" && parsedTarget.type === "node") {
            applyMutation(props.defMutator.connectNodes({
                sourceDef: mutatingDef,
                sourceNodeDef: parsedSource.nodeDef,
                targetNodeDef: parsedTarget.nodeDef,
            }));
        }
        if (changesOccurred) {
            props.defMutator.setWorkflowDef({ flowDef: mutatingDef });
        }
    };

    return (
        <div style={{ width: '100%', height: '900px', border: '2px solid black' }}>
            <ReactFlow
                nodes={s.nodes}
                edges={s.edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                snapToGrid={true}
                onConnect={handleConnect}
                nodeTypes={gNodeTypes}
                onlyRenderVisibleElements={true} // not sure but this may contribute to nodes disappearing randomly?

                onBeforeDelete={async (args: { nodes: CMFlowNode[], edges: Edge[] }) => {
                    console.log(args);
                    // basically, anything that's not EXPLICITLY selected do not delete.
                    // this is to make sure deleting a group does not delete all nodes inside it.
                    const ret: {
                        nodes: CMFlowNode[],
                        edges: Edge[],
                    } = {
                        nodes: [],
                        edges: [],
                    }

                    args.edges.forEach(e => {
                        if (e.selected) ret.edges.push(e);
                    });
                    args.nodes.forEach(e => {
                        if (e.selected) ret.nodes.push(e);
                    });
                    return ret;
                }}
            >
                <div style={{ position: "absolute", zIndex: 4 }}>
                    <InspectObject label="reactflow state" src={{
                        ...s,
                        flowDef: props.flowDef
                    }} />
                    <div>
                        <button onClick={() => {
                            const n: WorkflowNodeDef = {
                                id: props.flowDef.nodeDefs.reduce((acc, n) => Math.max(acc, n.id), 0) + 1, // find a new ID
                                name: nanoid(),
                                groupDefId: undefined,
                                displayStyle: WorkflowNodeDisplayStyle.Normal,
                                completionCriteriaType: WorkflowCompletionCriteriaType.always,
                                activationCriteriaType: WorkflowCompletionCriteriaType.always,
                                relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
                                defaultAssignees: [],
                                thisNodeProgressWeight: 1,
                                nodeDependencies: [],
                                position: { x: -reactFlow.getViewport().x + 100, y: -reactFlow.getViewport().y + 100 },
                                selected: true,
                                width: undefined,
                                height: undefined,
                            };
                            const r = props.defMutator.addNode({
                                sourceDef: { ...props.flowDef },
                                nodeDef: n,
                            });
                            if (r) {
                                props.defMutator.setWorkflowDef({ flowDef: r });
                            }
                        }}>new node</button>
                    </div>
                    <div>
                        <button onClick={() => {
                            const n: WorkflowNodeGroupDef = {
                                id: props.flowDef.groupDefs.reduce((acc, n) => Math.max(acc, n.id), 0) + 1, // find a new ID
                                name: nanoid(),
                                color: gLightSwatchColors.light_blue,
                                height: 200,
                                width: 200,
                                position: { x: -reactFlow.getViewport().x + 100, y: -reactFlow.getViewport().y + 100 },
                                selected: true,
                            };
                            const r = props.defMutator.addGroup({
                                sourceDef: { ...props.flowDef },
                                groupDef: n,
                            });
                            if (r) {
                                props.defMutator.setWorkflowDef({ flowDef: r });
                            }
                        }}>new group</button>
                    </div>
                </div>
                {/* <Controls /> */}
                <Background />
            </ReactFlow>
        </div>
    );
};

interface WorkflowNodeEditorProps {
    evaluatedWorkflow: EvaluatedWorkflow;
    workflowDef: WorkflowDef;
    nodeDef: WorkflowNodeDef;
    highlightDependencyNodeDef?: WorkflowNodeDef | undefined;
    defMutator: WorkflowDefMutator;
};

const WorkflowNodeEditor = (props: WorkflowNodeEditorProps) => {
    const relevanceDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesRelevance);
    const activationDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesActivation);
    const completionDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesCompleteness);
    const getNodeDef = (nodeDefId: number) => props.workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    const getEvaluatedNode = (nodeDefId: number) => props.evaluatedWorkflow.evaluatedNodes.find(en => en.nodeDefId === nodeDefId)!;
    const evaluated = getEvaluatedNode(props.nodeDef.id);
    const requiredAssignees = props.nodeDef.defaultAssignees.filter(a => a.isRequired);
    const optionalAssignees = props.nodeDef.defaultAssignees.filter(a => !a.isRequired);
    return <div className="CMWorkflowNodeEditorContainer">
        <h2>Node/step/question/task</h2>
        <NameValuePair
            name={"id"}
            value={props.nodeDef.id}
        />

        <CMTextInputBase
            autoFocus={false}
            value={props.nodeDef.name}
            onChange={(e, v) => {
                const newFlow = props.defMutator.setNodeBasicInfo({
                    sourceDef: { ...props.workflowDef },
                    nodeDef: props.nodeDef,
                    name: v,
                });
                if (newFlow) {
                    props.defMutator.setWorkflowDef({ flowDef: newFlow });
                }
            }}
        />

        <NameValuePair
            name={"Display style"}
            value={<>
                {props.nodeDef.displayStyle}
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeBasicInfo({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            displayStyle: val || WorkflowNodeDisplayStyle.Normal,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowNodeDisplayStyle}
                    value={props.nodeDef.displayStyle}
                />
            </>}
        />

        <NameValuePair
            name={"Default assignees"}
            value={<>
                <h4>Required</h4>
                <ul>
                    {requiredAssignees.length === 0 ? "<none>" : requiredAssignees.map(a => <span key={a.userId}>{a.userId} </span>)}
                </ul>
                <h4>Optional</h4>
                <ul>
                    {optionalAssignees.length === 0 ? "<none>" : optionalAssignees.map(a => <span key={a.userId}>{a.userId} </span>)}
                </ul>
            </>}
        />

        <NameValuePair
            name={"Default due date set"}
            value={props.nodeDef.defaultDueDateDurationMsAfterStarted || "(none)"}
        />

        <NameValuePair
            name={"Weight"}
            value={props.nodeDef.thisNodeProgressWeight}
        />

        <NameValuePair
            name={"Relevance"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeRelevanceCriteriaType({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.relevanceCriteriaType}
                />

                <ul>
                    {relevanceDependencies.map(d => {
                        const en = getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {getNodeDef(d.nodeDefId).name} ({en.evaluation.progressState}) {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
                <div>--&gt; {evaluated.evaluation.relevanceSatisfied ? "satisfied" : "incomplete"}</div>
            </>
            }
        />

        <NameValuePair
            name={"Activation"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeActivationCriteriaType({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.activationCriteriaType}
                />

                <ul>
                    {activationDependencies.map(d => {
                        const en = getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {getNodeDef(d.nodeDefId).name} ({en.evaluation.progressState}) {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
                <div>--&gt; {evaluated.evaluation.activationSatisfied ? "satisfied" : "incomplete"}</div>
            </>}
        />

        <NameValuePair
            name={"Completion"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeCompletionCriteriaType({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.completionCriteriaType}
                />

                {props.nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue &&
                    <div>
                        <b>Field</b>
                        <div>{props.nodeDef.fieldName}</div>
                        <div>Operator: {props.nodeDef.fieldValueOperator}</div>
                        {/* {props.nodeDef.fieldValueOperand2} */}
                    </div>
                }
                <ul>
                    {completionDependencies.map(d => {
                        const en = getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {getNodeDef(d.nodeDefId).name} ({en.evaluation.progressState}) {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
                <div>--&gt; {evaluated.evaluation.completenessSatisfied ? "satisfied" : "incomplete"}</div>
            </>}
        />

    </div>;
};


interface WorkflowGroupEditorProps {
    evaluatedWorkflow: EvaluatedWorkflow;
    workflowDef: WorkflowDef;
    groupDef: WorkflowNodeGroupDef;
    defMutator: WorkflowDefMutator;
};

const WorkflowGroupEditor = (props: WorkflowGroupEditorProps) => {
    return <div className="CMWorkflowNodeEditorContainer">
        <h2>Group</h2>
        <NameValuePair
            name={"id"}
            value={props.groupDef.id}
        />
        <NameValuePair
            name={"Label"}
            value={<CMTextField
                autoFocus={false}
                value={props.groupDef.name}
                onChange={(e, v) => {
                    const newFlow = props.defMutator.setGroupParams({
                        sourceDef: { ...props.workflowDef },
                        groupDef: props.groupDef,
                        name: v,
                    });
                    if (newFlow) {
                        props.defMutator.setWorkflowDef({ flowDef: newFlow });
                    }
                }}
            />}
        />
        <NameValuePair
            name={"Color"}
            value={<ColorPick
                allowNull={true}
                palettes={gGeneralPaletteList}
                value={props.groupDef.color || null}
                onChange={v => {
                    const newFlow = props.defMutator.setGroupParams({
                        sourceDef: { ...props.workflowDef },
                        groupDef: props.groupDef,
                        color: v?.id,
                    });
                    if (newFlow) {
                        props.defMutator.setWorkflowDef({ flowDef: newFlow });
                    }
                }}
            />}
        />

    </div>;
};





export interface WorkflowEditorPOCProps {
    workflowDef: WorkflowDef;
    defMutator: WorkflowDefMutator;
};

export const WorkflowEditorPOC: React.FC<WorkflowEditorPOCProps> = (props) => {
    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
        //console.log(`creating NEW blank instance`);
        return initializeWorkflowInstance(props.workflowDef);
    });

    const [model, setModel] = React.useState({
        question1: false,
        question2: false,
        changeSerial: 0,
    });

    const selectedNodeDef = props.workflowDef.nodeDefs.find(nd => !!nd.selected);
    const selectedGroupDef = props.workflowDef.groupDefs.find(nd => !!nd.selected);
    const selectedEdgeTargetNodeDef = props.workflowDef.nodeDefs.find(nd => nd.nodeDependencies.some(d => d.selected));
    const selectedEdge = selectedEdgeTargetNodeDef ? (() => {
        const dep = selectedEdgeTargetNodeDef.nodeDependencies.find(d => d.selected)!;
        return {
            targetNodeDef: selectedEdgeTargetNodeDef,
            sourceNodeDef: props.workflowDef.nodeDefs.find(nd => nd.id === dep.nodeDefId)!,
            dependencySpec: dep,
        };
    })() : undefined;

    const provider: WorkflowEvalProvider = {
        DoesFieldValueSatisfyCompletionCriteria: (node): boolean => {
            const nodeDef = props.workflowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
            const val = model[nodeDef.fieldName!]!;
            switch (nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Null:
                    return val == null;
                case WorkflowFieldValueOperator.NotNull:
                    return val != null;
                case WorkflowFieldValueOperator.Falsy:
                    return !val;
                case WorkflowFieldValueOperator.Truthy:
                    return !!val;
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return val === nodeDef.fieldValueOperand2;
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return val !== nodeDef.fieldValueOperand2;
            }
            return false;
        },
        RenderFieldEditorForNode: (node: WorkflowEvaluatedNode) => {
            const nodeDef = props.workflowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
            const fieldVal: boolean = model[nodeDef.fieldName!]!;
            return <CMSmallButton onClick={() => {
                const newModel = {
                    ...model,
                    [nodeDef.fieldName!]: !fieldVal
                };
                setModel(newModel);
                setWorkflowInstance({ ...workflowInstance });

            }}>{fieldVal ? "unapprove" : "approve"}</CMSmallButton>
        },
        RegisterStateChange: (node: WorkflowEvaluatedNode, oldState) => {
            // TODO
        }
    };

    const schemaHash = GetWorkflowDefSchemaHash(props.workflowDef);

    // why not eval every time?
    const tidiedInstance = TidyWorkflowInstance(workflowInstance, props.workflowDef);
    const newEvalFlow = EvaluateWorkflow(props.workflowDef, tidiedInstance, provider);
    const evaluatedWorkflow = newEvalFlow;

    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            {evaluatedWorkflow && <>
                {/* <div>Schema hash: {schemaHash}</div>
                <div>selected node {selectedNodeDef?.id ?? "<null>"}: {evaluatedWorkflow.flowInstance.nodeInstances.find(ni => ni.nodeDefId === selectedNodeDef?.id)?.id || "<null>"}</div>
                <div>selected group {selectedGroupDef?.id ?? "<null>"}</div>
                <div>selected edge {selectedEdge ? `${selectedEdge.sourceNodeDef.id} -> ${selectedEdge.targetNodeDef.id}` : "<null>"}</div> */}
                <div style={{ display: "flex", flexDirection: "row" }}>
                    <div style={{ width: "33%" }}>
                        <ReactFlowProvider>
                            <WorkflowReactFlowEditor
                                evaluatedWorkflow={evaluatedWorkflow}
                                schemaHash={schemaHash}
                                flowDef={props.workflowDef}
                                defMutator={props.defMutator}
                            />
                        </ReactFlowProvider>
                    </div>
                    <div style={{ width: "33%" }}>
                        {selectedNodeDef &&
                            <WorkflowNodeEditor
                                workflowDef={props.workflowDef}
                                evaluatedWorkflow={evaluatedWorkflow}
                                nodeDef={selectedNodeDef}
                                defMutator={props.defMutator}
                            />
                        }
                        {selectedGroupDef &&
                            <WorkflowGroupEditor
                                workflowDef={props.workflowDef}
                                evaluatedWorkflow={evaluatedWorkflow}
                                groupDef={selectedGroupDef}
                                defMutator={props.defMutator}
                            />
                        }
                        {selectedEdge &&
                            <WorkflowNodeEditor
                                workflowDef={props.workflowDef}
                                evaluatedWorkflow={evaluatedWorkflow}
                                nodeDef={selectedEdge.targetNodeDef}
                                highlightDependencyNodeDef={selectedEdge.sourceNodeDef}
                                defMutator={props.defMutator}
                            />
                        }
                    </div>
                    <div style={{ width: "33%" }}>
                        <WorkflowContainer flowDef={props.workflowDef} flow={evaluatedWorkflow} api={provider} />
                    </div>
                </div>
            </>}
        </div>
    );
};
