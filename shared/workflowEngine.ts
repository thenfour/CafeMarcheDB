// todo: 
// x permissions
//   x field mutations are built into the db model
// - hook this up to the rest of the app finally.
// - display style

// display
// - minimal indicator-only view
// - assigned to you alerts
//   - badge on profile badge
//   - homepage message
// - general indicators / overviews
//   - event view some alert

// DB hookup

import { isNumber } from "@mui/x-data-grid/internals";
import {
    XYPosition
} from '@xyflow/react';
import { assert } from "blitz";
import { Prisma } from "db";

import '@xyflow/react/dist/style.css';
import { ChangeAction, getNextSequenceId, getUniqueNegativeID } from "shared/utils";
import { TinsertOrUpdateWorkflowDefArgs, TUpdateEventWorkflowInstanceArgs, WorkflowLogItemType, WorkflowNodeProgressState, WorkflowObjectType } from "src/core/db3/shared/apiTypes";
import { gSwatchColors } from "./color";
import { gMillisecondsPerDay } from "./time";







// export enum WorkflowObjectType {
//     workflow = "workflow",
//     node = "node",
//     dependency = "dependency",
//     assignee = "assignee",
//     group = "group",
// };

export type TWorkflowChange = {
    action: ChangeAction;
    objectType: WorkflowObjectType,
    pkid: number,
    oldValues?: any,
    newValues?: any,
};

export type TWorkflowMutationResult = {
    changes: TWorkflowChange[];
    serializableFlowDef: TinsertOrUpdateWorkflowDefArgs | undefined; // same as input, but with ids populated
};


export type TWorkflowInstanceMutationResult = {
    changes: TWorkflowChange[];
    serializableInstance: TUpdateEventWorkflowInstanceArgs | undefined; // same as input, but with ids populated
};




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
    IsNotNull = "IsNotNull",
    IsNull = "IsNull",
    StringPopulated = "StringPopulated",
    EqualsOperand2 = "EqualsOperand2",
    NotEqualsOperand2 = "NotEqualsOperand2",
    Truthy = "Truthy",
    Falsy = "Falsy",
    EqualsAnyOf = "EqualsAnyOf", // support multiple operands
    IsNotAnyOf = "IsNotAnyOf",
};

// when displaying the workflow, nodes are grouped together
export interface WorkflowNodeGroupDef {
    id: number;
    name: string;
    color: string | null;
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
    // this is subtle, but basically, the provider will determine whether an assignee has satisfied the completion of the node.
    // so this determines:
    // 1. how it's to be displayed to the assignee
    // 2. how completeness is calculated. if there are required assignees, then all of them must be satisfied for the node to be complete.
    //    if there are no required, then any optionals will complete
    // however because UI is cluttered as it is, everyone is currently optional.
    //isRequired: boolean;
    userId: number;
}

export enum WorkflowManualCompletionStyle {
    DontAllowManualCompletion = "DontAllowManualCompletion",
    AllowManualCompletionWithRequiredComment = "AllowManualCompletionWithRequiredComment",
    AllowManualCompletionWithOptionalComment = "AllowManualCompletionWithOptionalComment",
    AllowManualCompletionWithoutComment = "AllowManualCompletionWithoutComment",
}

export interface WorkflowNodeDef {
    id: number;

    name: string;
    descriptionMarkdown: string;
    groupDefId: number | null; // WorkflowNodeGroup.id

    // UI display & basic behaviors
    displayStyle: WorkflowNodeDisplayStyle;
    manualCompletionStyle: WorkflowManualCompletionStyle;

    // relevance + activation dependencies must ALL be complete to be considered satisfied.
    // if there are no relevance dependencies, or no activation dependencies, then considered "always" satisfied.
    nodeDependencies: WorkflowNodeDependency[];

    thisNodeProgressWeight: number;
    relevanceCriteriaType: WorkflowCompletionCriteriaType;
    activationCriteriaType: WorkflowCompletionCriteriaType;
    completionCriteriaType: WorkflowCompletionCriteriaType;
    fieldName: string;
    fieldValueOperator: WorkflowFieldValueOperator;
    fieldValueOperand2?: unknown; // for things like less than, equals, whatever.

    // defaults
    defaultAssignees: WorkflowNodeAssignee[]; // user ids that this node is assigned to by default
    defaultDueDateDurationDaysAfterStarted?: number | undefined; // if not set, no due date is specified

    position: XYPosition, // for React Flow
    selected: boolean;
    width: number | undefined;
    height: number | undefined;
};

export interface WorkflowDef {
    id: number;
    name: string;

    sortOrder: number;
    description: string | null;
    color: string | null;
    isDefaultForEvents: boolean;

    groupDefs: WorkflowNodeGroupDef[];
    nodeDefs: WorkflowNodeDef[];
};


///////////// INSTANCE /////////////////////////////////////////////////////////////////

export interface WorkflowNodeInstanceAssignee {
    id: number;
    userId: number;
}

// export enum WorkflowLogItemType {
//     Comment = "Comment", // dev comments or other custom stuff you can pollute the log with.
//     InstanceStarted = "InstanceStarted",
//     FieldUpdated = "FieldUpdated",// field updated
//     AssigneesChanged = "AssigneesChanged",// assignee changed
//     DueDateChanged = "DueDateChanged",// duedate changed
//     StatusChanged = "StatusChanged",
// };

export interface WorkflowLogItem {
    id: number;
    at: Date;
    type: WorkflowLogItemType;
    nodeDefId?: number | undefined;
    userId?: number | undefined;
    fieldName?: string | undefined;
    oldValue?: unknown;
    newValue?: unknown;
    comment?: string | undefined;
};

export interface WorkflowNodeInstance {
    id: number;
    nodeDefId: number;
    assignees: WorkflowNodeInstanceAssignee[];
    dueDate?: Date | undefined;

    manuallyCompleted: boolean;
    manualCompletionComment: string | undefined;

    // for logging field value changes, this is necessary.
    // and it's necessary to keep field name as well because if you change the workflow def to a different field name. sure you could just clear it out, but it can be common to change the field name and change it back like "nah i didn't mean to" and it would be dumb to clear out statuses invoking a bunch of log messages that are just noise.
    lastFieldName: string | undefined;
    lastFieldValueAsString: string | undefined;
    lastAssignees: WorkflowNodeInstanceAssignee[];
    activeStateFirstTriggeredAt: Date | undefined;
    lastProgressState: WorkflowNodeProgressState;
};

export type WorkflowTidiedNodeInstance = WorkflowNodeInstance & {
    isTidy: true;
};

export interface WorkflowInstance {
    id: number;
    revision: number; // important to reduce re-evaluations due to react renders
    nodeInstances: WorkflowNodeInstance[];
    lastEvaluatedWorkflowDefId: number | undefined;
    log: WorkflowLogItem[];
};

// workflows get preprocessed for GUI work
export type WorkflowTidiedInstance = Omit<WorkflowInstance, "nodeInstances"> & {
    isTidy: true;
    nodeInstances: WorkflowTidiedNodeInstance[];
};

///////////// EVALUATION /////////////////////////////////////////////////////////////////

export interface WorkflowNodeEvaluation {
    nodeDefId: number;

    error_circularDependency: boolean; // was a circular dependency detected while evaluating?

    isEvaluated: boolean;
    relevanceSatisfied: boolean; // does relevance criteria pass?
    activationSatisfied: boolean; // 
    completenessSatisfied: boolean;
    progressState: WorkflowNodeProgressState;
    progress01: number | undefined; // progress taking into account dependent nodes. or if this is a field node, then will be 0 or 1, unlessy ou have multiple assignees.

    isComplete: boolean; // same as progressstate === completed
    isInProgress: boolean; // same as progressstate === activated

    childCompletionWeightCompleted: number | undefined;
    childCompletionWeightTotal: number;

    thisCompletionWeightCompleted: number | undefined;
    thisCompletionWeightTotal: number;

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
    evaluatedNodes: WorkflowEvaluatedNode[];
};

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
                activeStateFirstTriggeredAt: undefined,
                nodeDefId: nodeDef.id,
                lastProgressState: WorkflowNodeProgressState.InvalidState,
                assignees: JSON.parse(JSON.stringify(nodeDef.defaultAssignees)),
                manuallyCompleted: false,
                manualCompletionComment: undefined,
                isTidy: true,
                lastFieldName: undefined,
                lastFieldValueAsString: undefined,
                lastAssignees: [],
            };
            return ret;
        }
    });

    return {
        //flowDef,
        id: flowInstance.id,
        revision: flowInstance.revision,
        nodeInstances: tidiedNodes,
        lastEvaluatedWorkflowDefId: flowInstance.lastEvaluatedWorkflowDefId,
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

interface WorkflowInstanceMutator_Args {
    sourceWorkflowInstance: WorkflowInstance;
};

type WorkflowInstanceMutatorFn<TextraArgs> = (args: WorkflowInstanceMutator_Args & TextraArgs) => WorkflowInstance | undefined;

export interface WorkflowInstanceMutator {
    CanCurrentUserViewInstances: () => boolean,
    CanCurrentUserEditInstances: () => boolean,
    CanCurrentUserViewDefs: () => boolean,
    CanCurrentUserEditDefs: () => boolean,

    DoesFieldValueSatisfyCompletionCriteria: (args: { flowDef: WorkflowDef, nodeDef: WorkflowNodeDef, tidiedNodeInstance: WorkflowTidiedNodeInstance, assignee: undefined | WorkflowNodeAssignee }) => boolean;
    GetModelFieldNames: (args: { flowDef: WorkflowDef }) => string[];

    // equality-comparable and db-serializable
    GetFieldValueAsString: (args: { flowDef: WorkflowDef, nodeDef: WorkflowNodeDef, node: WorkflowTidiedNodeInstance }) => string;
    ResetModelAndInstance: () => void;

    SetAssigneesForNode: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, assignees: WorkflowNodeAssignee[], }>;
    SetDueDateForNode: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, dueDate: Date | undefined, }>;
    SetNodeStatusData: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, previousProgressState: WorkflowNodeProgressState, lastProgressState: WorkflowNodeProgressState, activeStateFirstTriggeredAt: Date | undefined }>;
    AddLogItem: WorkflowInstanceMutatorFn<{ msg: Omit<WorkflowLogItem, 'userId'> }>; // userId should be added by handler
    SetLastFieldValue: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, fieldName: string | undefined, fieldValueAsString: string | undefined }>;
    SetLastAssignees: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, value: WorkflowNodeAssignee[] }>;
    SetLastEvaluatedWorkflowDefId: WorkflowInstanceMutatorFn<{ workflowDefId: number | undefined }>;

    // commit the instance after chaining mutations.
    onWorkflowInstanceMutationChainComplete: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => void
};



/////////////////////////////////////////////////////////////////////////////////////////////
type WorkflowInstanceMutatorProc = (workflowInstance: WorkflowInstance) => WorkflowInstance | undefined; // for chaining
export type WorkflowInstanceMutatorFnChainSpec = { fn: WorkflowInstanceMutatorProc, wantsReevaluation: boolean };

export function chainWorkflowInstanceMutations(
    initialWorkflowInstance: WorkflowInstance, // we will make a copy of this
    mutators: WorkflowInstanceMutatorFnChainSpec[],
    onChangesOccurred: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => void,
) {
    let current: WorkflowInstance | undefined = { ...initialWorkflowInstance };
    let changesOccurred: boolean = false;
    let reEvaluationNeeded: boolean = false;

    for (const mutator of mutators) {
        if (current) {
            const mutatedInstance = mutator.fn(current);
            if (mutatedInstance) {
                changesOccurred = true;
                current = mutatedInstance;
                reEvaluationNeeded = reEvaluationNeeded || mutator.wantsReevaluation;
            }
        }
    }
    if (changesOccurred) onChangesOccurred(current, reEvaluationNeeded);
}









const EvaluateTree = (
    parentPathNodeDefIds: number[],
    flowDef: WorkflowDef,
    node: WorkflowTidiedNodeInstance,
    flowInstance: WorkflowTidiedInstance,
    api: WorkflowInstanceMutator,
    evaluatedNodes: WorkflowEvaluatedNode[],
    instanceMutations: WorkflowInstanceMutatorFnChainSpec[]
): WorkflowEvaluatedNode => {
    const existingEvaluation = evaluatedNodes.find(n => n.nodeDefId === node.nodeDefId);
    if (existingEvaluation) {
        return existingEvaluation;
    }

    if (parentPathNodeDefIds.includes(node.nodeDefId)) {
        throw new Error(`Circular dependency exists in the tree.`);
    }

    const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;

    // evaluate dependencies -- because we're also detecting circular dependencies, try not to have uncaught exceptions
    const evaluatedChildren: WorkflowEvaluatedDependentNode[] = [];
    let circularDependencyDetected = false;
    for (const childDependency of nodeDef.nodeDependencies) {
        //nodeDef.nodeDependencies.map(childDependency => {
        try {
            const evaluatedChild = EvaluateTree(
                [...parentPathNodeDefIds, node.nodeDefId],
                flowDef,
                flowInstance.nodeInstances.find(n => n.nodeDefId === childDependency.nodeDefId)!,
                flowInstance,
                api,
                evaluatedNodes,
                instanceMutations
            );
            const ret: WorkflowEvaluatedDependentNode = {
                ...evaluatedChild,
                dependency: childDependency,
            }
            //return ret;
            evaluatedChildren.push(ret);
        } catch (e) {
            console.log(e);
            circularDependencyDetected = true; // assumes circular dependency error.
        }
    }//);

    const completionDependsOnChildren = [WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(nodeDef.completionCriteriaType);

    const evaluation: WorkflowNodeEvaluation = {
        nodeDefId: nodeDef.id,
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
        error_circularDependency: circularDependencyDetected,

        // two cases:
        // 1. this step requires a field to complete. this weight is used.
        // 2. completeness depends on child fields. this weight is ignored. when depending on nodes, this weight is the sum of children.
        // undefined weight is possible when 
        childCompletionWeightCompleted: undefined, // to calculate later
        childCompletionWeightTotal: nodeDef.thisNodeProgressWeight, // assume not dependent // completionDependsOnChildren ? comple : nodeDef.thisNodeProgressWeight,

        thisCompletionWeightCompleted: undefined,
        thisCompletionWeightTotal: nodeDef.thisNodeProgressWeight,

        completenessDependentNodes: completionDependsOnChildren ? evaluatedChildren.filter(ch => ch.dependency.determinesCompleteness) : [],
        completenessBlockedByNodes: completionDependsOnChildren ? evaluatedChildren.filter(ch => ch.dependency.determinesCompleteness && !ch.evaluation.isComplete) : [],
        activationDependentNodes: evaluatedChildren.filter(ch => ch.dependency.determinesActivation),
        activationBlockedByNodes: evaluatedChildren.filter(ch => ch.dependency.determinesActivation && !ch.evaluation.isComplete),
        relevanceDependentNodes: evaluatedChildren.filter(ch => ch.dependency.determinesRelevance),
        relevanceBlockedByNodes: evaluatedChildren.filter(ch => ch.dependency.determinesRelevance && !ch.evaluation.isComplete),
    };

    if (completionDependsOnChildren) {
        evaluation.childCompletionWeightTotal = evaluation.completenessDependentNodes.reduce((acc, e) => acc + e.evaluation.thisCompletionWeightTotal, 0);
        evaluation.childCompletionWeightCompleted = evaluation.completenessDependentNodes.reduce((acc, e) => e.evaluation.thisCompletionWeightCompleted === undefined ? undefined : (acc + e.evaluation.thisCompletionWeightCompleted), 0);
    }

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

    // calculate progress 01
    switch (nodeDef.completionCriteriaType) {
        case WorkflowCompletionCriteriaType.never:
            evaluation.completenessSatisfied = false;
            evaluation.progress01 = 0;
            break;
        case WorkflowCompletionCriteriaType.always:
            evaluation.completenessSatisfied = true;
            evaluation.progress01 = 1;
            break;
        case WorkflowCompletionCriteriaType.fieldValue:
            if (node.assignees.length === 0) {
                // no assignees = just evaluate once with no assignees considered.
                evaluation.completenessSatisfied = api.DoesFieldValueSatisfyCompletionCriteria({
                    flowDef,
                    tidiedNodeInstance: node,
                    nodeDef,
                    assignee: undefined,
                });
                evaluation.progress01 = evaluation.completenessSatisfied ? 1 : 0;
            } else {
                evaluation.completenessByAssigneeId = node.assignees.map(assignee => ({
                    assignee,
                    completenessSatisfied: api.DoesFieldValueSatisfyCompletionCriteria({
                        flowDef,
                        tidiedNodeInstance: node,
                        nodeDef,
                        assignee,
                    }),
                }));

                // Calculate thisNodeProgress01.
                const optionalAssignees = evaluation.completenessByAssigneeId;//.filter(c => !c.assignee.isRequired);
                const satisfiedOptional = optionalAssignees.filter(c => c.completenessSatisfied).length;

                // if all are optional, then ANY satisfied will complete the node.
                assert(optionalAssignees.length > 0, "0 optional + 0 required assignees wut");
                evaluation.completenessSatisfied = satisfiedOptional > 0;
                evaluation.progress01 = satisfiedOptional / optionalAssignees.length;
            }
            break;
        case WorkflowCompletionCriteriaType.allNodesComplete:
            evaluation.completenessSatisfied = evaluation.completenessBlockedByNodes.length === 0;
            if (evaluation.childCompletionWeightCompleted === undefined || evaluation.childCompletionWeightTotal === 0) {
                evaluation.progress01 = undefined;
            } else {
                evaluation.progress01 = evaluation.childCompletionWeightCompleted / evaluation.childCompletionWeightTotal;
            }
            break;
        case WorkflowCompletionCriteriaType.someNodesComplete:
            evaluation.completenessSatisfied = evaluation.completenessDependentNodes.length === 0 || (evaluation.completenessBlockedByNodes.length !== evaluation.completenessDependentNodes.length);
            if (evaluation.completenessSatisfied) {
                evaluation.progress01 = 1;
            } else {
                if (evaluation.childCompletionWeightCompleted === undefined || evaluation.childCompletionWeightTotal === 0) {
                    evaluation.progress01 = undefined;
                } else {
                    evaluation.progress01 = evaluation.childCompletionWeightCompleted / evaluation.childCompletionWeightTotal;
                }
            }
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

    if (evaluation.progress01 !== undefined) {
        evaluation.thisCompletionWeightCompleted = nodeDef.thisNodeProgressWeight * evaluation.progress01;
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


// if workflow data changes based on evaluation (state updates, default assignees, ...), then we also need a way to set the new instance. it will trigger a re-eval eventually.
// so careful not to eval in a way that causes endless loop.
//
// actually i'm skeptical to update too much state in an evaluation function ... feels out of character.
export const EvaluateWorkflow = (flowDef: WorkflowDef, workflowInstance: WorkflowInstance, api: WorkflowInstanceMutator, reason: string): EvaluatedWorkflow => {
    console.log(`{ BEGIN evaluate workflow`);
    const evaluatedNodes: WorkflowEvaluatedNode[] = [];

    const tidiedInstance = TidyWorkflowInstance(workflowInstance, flowDef);

    const mutations: WorkflowInstanceMutatorFnChainSpec[] = [];

    for (let i = 0; i < tidiedInstance.nodeInstances.length; ++i) {
        EvaluateTree([], flowDef, tidiedInstance.nodeInstances[i]!, tidiedInstance, api, evaluatedNodes, mutations);
    }

    if (workflowInstance.lastEvaluatedWorkflowDefId !== flowDef.id) {
        mutations.push({
            fn: sourceWorkflowInstance => api.AddLogItem({
                sourceWorkflowInstance,
                msg: {
                    id: getUniqueNegativeID(),
                    at: new Date(),
                    nodeDefId: undefined,
                    fieldName: undefined,
                    type: WorkflowLogItemType.InstanceStarted,
                    oldValue: undefined,
                    newValue: undefined,
                }
            }), wantsReevaluation: false
        }, {
            fn: sourceWorkflowInstance => api.SetLastEvaluatedWorkflowDefId({
                sourceWorkflowInstance,
                workflowDefId: flowDef.id,
            }), wantsReevaluation: false,
        });
    }

    // trigger state change hooks and set due date if needed.
    for (let i = 0; i < tidiedInstance.nodeInstances.length; ++i) {
        const node = evaluatedNodes.find(en => en.nodeDefId === tidiedInstance.nodeInstances[i]!.nodeDefId)!;
        const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
        if (node.evaluation.progressState !== node.lastProgressState) {
            const oldState = node.lastProgressState;
            let newValues = {
                lastProgressState: node.evaluation.progressState,
                dueDate: node.dueDate,
                activeStateFirstTriggeredAt: node.activeStateFirstTriggeredAt,
            };

            if ((node.activeStateFirstTriggeredAt === undefined) && node.evaluation.isInProgress) {
                newValues.activeStateFirstTriggeredAt = new Date();
                if (isNumber(nodeDef.defaultDueDateDurationDaysAfterStarted)) {
                    newValues.dueDate = new Date(new Date().getTime() + nodeDef.defaultDueDateDurationDaysAfterStarted * gMillisecondsPerDay);
                }
            }

            if (newValues.dueDate) {
                mutations.push({
                    fn: sourceWorkflowInstance => api.AddLogItem({
                        sourceWorkflowInstance,
                        msg: {
                            id: getUniqueNegativeID(),
                            at: new Date(),
                            nodeDefId: nodeDef.id,
                            fieldName: undefined,
                            type: WorkflowLogItemType.DueDateChanged,
                            newValue: newValues.dueDate,
                        }
                    }), wantsReevaluation: false
                },
                    {
                        fn: sourceWorkflowInstance => api.SetDueDateForNode({
                            sourceWorkflowInstance,
                            evaluatedNode: node,
                            dueDate: newValues.dueDate,
                            // wantsReevaluation: true is necessary to makes sure dependencies are picked up in these kind of properties.
                            // to illustrate the problem, click "reset model & instance" with nodes which have due dates; they'll not appear to have due dates unless you re-evaluate.
                        }), wantsReevaluation: true,
                    },
                );
            }

            if (oldState === WorkflowNodeProgressState.InvalidState) {
                mutations.push(
                    { fn: sourceWorkflowInstance => api.SetNodeStatusData({ sourceWorkflowInstance, evaluatedNode: node, previousProgressState: oldState, ...newValues }), wantsReevaluation: false },
                );
            } else {
                mutations.push(
                    { fn: sourceWorkflowInstance => api.SetNodeStatusData({ sourceWorkflowInstance, evaluatedNode: node, previousProgressState: oldState, ...newValues }), wantsReevaluation: false },
                    {
                        // it's tempting to want to include things like whether this was a user-induced change or derivative. but that can be known by looking at the node defs so don't put it directly in the log.
                        fn: sourceWorkflowInstance => api.AddLogItem({
                            sourceWorkflowInstance, msg: {
                                id: getUniqueNegativeID(),
                                type: WorkflowLogItemType.StatusChanged,
                                at: new Date(),
                                nodeDefId: node.nodeDefId,
                                fieldName: undefined,
                                newValue: node.evaluation.progressState,
                                oldValue: oldState,
                            }
                        }), wantsReevaluation: false
                    },
                );
            }

        }
    }

    // for field values, register value changes.
    for (let i = 0; i < tidiedInstance.nodeInstances.length; ++i) {
        const node = evaluatedNodes.find(en => en.nodeDefId === tidiedInstance.nodeInstances[i]!.nodeDefId)!;
        const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;

        // detect assignees changed
        const sanitizedLastKnownAssignees = JSON.stringify(node.lastAssignees.map(v => v.userId).toSorted());
        const sanitizedCurrentAssignees = JSON.stringify(node.assignees.map(a => a.userId).toSorted());
        if (sanitizedCurrentAssignees !== sanitizedLastKnownAssignees) {
            mutations.push({
                fn: sourceWorkflowInstance => api.AddLogItem({
                    sourceWorkflowInstance,
                    msg: {
                        id: getUniqueNegativeID(),
                        at: new Date(),
                        nodeDefId: nodeDef.id,
                        fieldName: undefined,
                        type: WorkflowLogItemType.AssigneesChanged,
                        oldValue: sanitizedLastKnownAssignees,
                        newValue: sanitizedCurrentAssignees,
                    }
                }), wantsReevaluation: false
            }, {
                fn: sourceWorkflowInstance => api.SetLastAssignees({
                    sourceWorkflowInstance,
                    evaluatedNode: node,
                    value: node.assignees,
                }), wantsReevaluation: false,
            });
        }

        if (nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue) {
            // detect field value changes
            const currentValueAsString = api.GetFieldValueAsString({
                flowDef,
                node,
                nodeDef,
            });
            if (node.lastFieldName !== nodeDef.fieldName || currentValueAsString !== node.lastFieldValueAsString) {
                // field value has changed.
                mutations.push({
                    fn: sourceWorkflowInstance => api.AddLogItem({
                        sourceWorkflowInstance,
                        msg: {
                            id: getUniqueNegativeID(),
                            at: new Date(),
                            fieldName: nodeDef.fieldName,
                            nodeDefId: nodeDef.id,
                            type: WorkflowLogItemType.FieldUpdated,
                            oldValue: node.lastFieldValueAsString,
                            newValue: currentValueAsString,
                        }
                    }), wantsReevaluation: false
                }, {
                    fn: sourceWorkflowInstance => api.SetLastFieldValue({
                        sourceWorkflowInstance,
                        evaluatedNode: node,
                        fieldName: nodeDef.fieldName,
                        fieldValueAsString: currentValueAsString,
                    }), wantsReevaluation: false,
                });
            }
        }
    }

    if (mutations.length) {
        chainWorkflowInstanceMutations({ ...workflowInstance }, mutations, api.onWorkflowInstanceMutationChainComplete);
    }
    const ret: EvaluatedWorkflow = {
        evaluatedNodes,
        flowInstance: tidiedInstance,
    };

    console.log(`} END evaluate workflow`);

    return ret;
};



export const WorkflowMakeConnectionId = (srcNodeDefId: number, targetNodeDefId: number) => {
    return `${srcNodeDefId}:${targetNodeDefId}`;
}

export const WorkflowInitializeInstance = (workflowDef: WorkflowDef): WorkflowInstance => {
    return {
        id: getUniqueNegativeID(),
        revision: 1,
        nodeInstances: [],
        lastEvaluatedWorkflowDefId: undefined,
        log: [],
    };
};


export const MakeNewWorkflowDef = (): WorkflowDef => ({
    id: -1,
    groupDefs: [{
        id: -2,
        color: gSwatchColors.blue,
        name: "New group",
        position: { x: 50, y: 50 },
        selected: false,
        width: 250,
        height: 150,
    }],
    name: "New workflow",
    color: null,
    description: null,
    isDefaultForEvents: false,
    sortOrder: 0,
    nodeDefs: [],
});




export function WorkflowDefToMutationArgs(def: WorkflowDef): TinsertOrUpdateWorkflowDefArgs {
    const { id, description, isDefaultForEvents, color, name, sortOrder } = def;
    return {
        id,
        description: description || "",
        isDefaultForEvents,
        color,
        name,
        sortOrder,
        groups: def.groupDefs.map(groupDef => {
            const { id, color, name, position, selected } = groupDef;
            return {
                id, color, name, selected,
                description: "",
                positionX: position.x,
                positionY: position.y,
                width: groupDef.width || 0,
                height: groupDef.height || 0,
            };
        }),
        nodes: def.nodeDefs.map(nodeDef => {
            const { id, name, height, width, position,
                activationCriteriaType,
                completionCriteriaType,
                displayStyle,
                fieldValueOperand2,
                manualCompletionStyle,
                relevanceCriteriaType,
                selected,
                thisNodeProgressWeight,
                defaultDueDateDurationDaysAfterStarted,
                fieldName,
                fieldValueOperator,
                descriptionMarkdown,
            } = nodeDef;
            return {
                id,
                name,
                description: descriptionMarkdown,
                width,
                height,
                positionX: position.x,
                positionY: position.y,
                activationCriteriaType,
                completionCriteriaType,
                displayStyle,
                fieldValueOperand2: JSON.stringify(fieldValueOperand2),
                manualCompletionStyle,
                relevanceCriteriaType,
                selected,
                thisNodeProgressWeight,
                defaultDueDateDurationDaysAfterStarted,
                fieldName,
                fieldValueOperator,
                groupId: nodeDef.groupDefId,

                dependencies: nodeDef.nodeDependencies.map(dep => {
                    const { selected,
                        determinesRelevance,
                        determinesActivation,
                        determinesCompleteness,
                        nodeDefId } = dep;

                    return {
                        selected,
                        determinesRelevance,
                        determinesActivation,
                        determinesCompleteness,
                        nodeDefId,
                        id: getUniqueNegativeID(),
                    };
                }),
                defaultAssignees: nodeDef.defaultAssignees.map(da => {
                    return {
                        userId: da.userId,
                        id: getUniqueNegativeID(),
                    };
                }),
            };
        }),
    };
}




// Converts WorkflowDefGroup (Prisma) to WorkflowNodeGroupDef (runtime)
function mapGroup(group: Prisma.WorkflowDefGroupGetPayload<{}>): WorkflowNodeGroupDef {
    return {
        id: group.id,
        name: group.name,
        color: group.color,
        selected: group.selected,
        position: { x: group.positionX || 0, y: group.positionY || 0 },
        width: group.width || undefined,
        height: group.height || undefined,
    };
}

// Converts WorkflowDefNodeDependency (Prisma) to WorkflowNodeDependency (runtime)
function mapNodeDependency(dep: Prisma.WorkflowDefNodeDependencyGetPayload<{}>): WorkflowNodeDependency {
    return {
        nodeDefId: dep.sourceNodeDefId,
        selected: dep.selected,
        determinesRelevance: dep.determinesRelevance,
        determinesActivation: dep.determinesActivation,
        determinesCompleteness: dep.determinesCompleteness,
    };
}

// Converts WorkflowDefNodeDefaultAssignee (Prisma) to WorkflowNodeAssignee (runtime)
function mapDefaultAssignee(assignee: Prisma.WorkflowDefNodeDefaultAssigneeGetPayload<{}>): WorkflowNodeAssignee {
    return {
        userId: assignee.userId,
    };
}

// Converts WorkflowDefNode (Prisma) to WorkflowNodeDef (runtime)
function mapNode(node: Prisma.WorkflowDefNodeGetPayload<{ include: { defaultAssignees: true, dependenciesAsTarget: true, } }>): WorkflowNodeDef {
    return {
        id: node.id,
        name: node.name,
        descriptionMarkdown: node.description,
        groupDefId: node.groupId || null,
        displayStyle: node.displayStyle as WorkflowNodeDisplayStyle,
        manualCompletionStyle: node.manualCompletionStyle as WorkflowManualCompletionStyle,
        nodeDependencies: node.dependenciesAsTarget.map(mapNodeDependency),
        thisNodeProgressWeight: node.thisNodeProgressWeight,
        relevanceCriteriaType: node.relevanceCriteriaType as WorkflowCompletionCriteriaType,
        activationCriteriaType: node.activationCriteriaType as WorkflowCompletionCriteriaType,
        completionCriteriaType: node.completionCriteriaType as WorkflowCompletionCriteriaType,
        fieldName: node.fieldName || "",
        fieldValueOperator: node.fieldValueOperator ? node.fieldValueOperator as WorkflowFieldValueOperator : WorkflowFieldValueOperator.IsNotNull,
        fieldValueOperand2: node.fieldValueOperand2 ? JSON.parse(node.fieldValueOperand2) : undefined,
        defaultAssignees: node.defaultAssignees.map(mapDefaultAssignee),
        defaultDueDateDurationDaysAfterStarted: node.defaultDueDateDurationDaysAfterStarted || undefined,
        position: { x: node.positionX || 0, y: node.positionY || 0 },
        selected: node.selected,
        width: node.width || undefined,
        height: node.height || undefined,
    };
}

// Converts WorkflowDef (Prisma) to WorkflowDef (runtime)
type mapWorkflowDef_WorkflowDef = Prisma.WorkflowDefGetPayload<{
    include: {
        groups: true,
        nodeDefs: {
            include: {
                defaultAssignees: true,
                dependenciesAsTarget: true,
            }
        }
    }
}>;

// converts a db query payload to a real workflowdef
export function mapWorkflowDef(workflowDef: mapWorkflowDef_WorkflowDef): WorkflowDef {
    return {
        id: workflowDef.id,
        name: workflowDef.name,
        sortOrder: workflowDef.sortOrder,
        description: workflowDef.description || null,
        color: workflowDef.color || null,
        isDefaultForEvents: workflowDef.isDefaultForEvents,
        groupDefs: workflowDef.groups.map(mapGroup),
        nodeDefs: workflowDef.nodeDefs.map(mapNode),
    };
}


export function MutationArgsToWorkflowDef(args: TinsertOrUpdateWorkflowDefArgs): WorkflowDef {
    const { id, description, isDefaultForEvents, color, name, sortOrder } = args;

    // Reconstruct group definitions
    const groupDefs: WorkflowNodeGroupDef[] = args.groups.map(group => {
        const {
            id,
            color,
            name,
            selected,
            description,
            positionX,
            positionY,
            width,
            height,
        } = group;

        return {
            id,
            color,
            name,
            selected,
            description: description || "",
            position: {
                x: positionX,
                y: positionY,
            },
            width: width || 0,
            height: height || 0,
        };
    });

    // Reconstruct node definitions
    const nodeDefs: WorkflowNodeDef[] = args.nodes.map(node => {
        const {
            id,
            name,
            description,
            width,
            height,
            positionX,
            positionY,
            activationCriteriaType,
            completionCriteriaType,
            displayStyle,
            fieldName,
            fieldValueOperator,
            fieldValueOperand2,
            manualCompletionStyle,
            relevanceCriteriaType,
            selected,
            thisNodeProgressWeight,
            defaultDueDateDurationDaysAfterStarted,
            groupId,
            dependencies,
            defaultAssignees,
        } = node;

        return {
            id,
            name,
            descriptionMarkdown: description || "",
            width,
            height,
            position: {
                x: positionX || 0,
                y: positionY || 0,
            },
            activationCriteriaType: activationCriteriaType as WorkflowCompletionCriteriaType,
            completionCriteriaType: completionCriteriaType as WorkflowCompletionCriteriaType,
            displayStyle: displayStyle as WorkflowNodeDisplayStyle,
            fieldValueOperand2: fieldValueOperand2 ? JSON.parse(fieldValueOperand2) : null,
            manualCompletionStyle: manualCompletionStyle as WorkflowManualCompletionStyle,
            relevanceCriteriaType: relevanceCriteriaType as WorkflowCompletionCriteriaType,
            selected,
            thisNodeProgressWeight,
            defaultDueDateDurationDaysAfterStarted,
            fieldName: fieldName || "",
            fieldValueOperator: fieldValueOperator ? (fieldValueOperator as WorkflowFieldValueOperator) : WorkflowFieldValueOperator.IsNotNull,
            groupDefId: groupId,

            // Reconstruct node dependencies
            nodeDependencies: dependencies.map(dep => {
                const {
                    selected,
                    determinesRelevance,
                    determinesActivation,
                    determinesCompleteness,
                    nodeDefId,
                } = dep;

                return {
                    selected,
                    determinesRelevance,
                    determinesActivation,
                    determinesCompleteness,
                    nodeDefId,
                };
            }),

            // Reconstruct default assignees
            defaultAssignees: defaultAssignees.map(da => {
                const { userId } = da;
                return { userId };
            }),
        };
    });

    // Construct and return the WorkflowDef object
    return {
        id,
        description: description || "",
        isDefaultForEvents,
        color,
        name,
        sortOrder,
        groupDefs,
        nodeDefs,
    };
}

// there are other types of workflowdef formats:
// - Prisma.WorkflowDefGetPayload<...> // QUERY
// - TinsertOrUpdateWorkflowDefArgs // SERIALIZABLE
// - WorkflowDef // WORKFLOWDEF

// QUERY -> SERIALIZABLE         mapWorkflowDef -> WorkflowDefToMutationArgs
// QUERY -> WORKFLOWDEF          mapWorkflowDef
// SERIALIZABLE -> QUERY         # not needed
// SERIALIZABLE -> WORKFLOWDEF   MutationArgsToWorkflowDef
// WORKFLOWDEF -> QUERY          # not needed
// WORKFLOWDEF -> SERIALIZABLE   WorkflowDefToMutationArgs




///////////// WF INSTANCE /////////////////////////////////////////////////////////////////
// workflow INSTANCE formats
// - QUERY prisma
// - SERIALIZABLE TUpdateEventWorkflowInstanceArgs
// - WORKFLOW WorkflowInstance


// QUERY -> SERIALIZABLE      WorkflowInstanceQueryResultToMutationArgs -> MutationArgsToWorkflowInstance
// QUERY -> WORKFLOW          WorkflowInstanceQueryResultToMutationArgs
// SERIALIZABLE -> QUERY      #
// SERIALIZABLE -> WORKFLOW   MutationArgsToWorkflowInstance
// WORKFLOW -> QUERY          #
// WORKFLOW -> SERIALIZABLE   WorkflowInstanceToMutationArgs

// export interface TUpdateEventWorkflowInstanceArgsAssignee {
//     id: number; // for insertion, this is not used / specified.
//     userId: number;
// };

// export interface TUpdateEventWorkflowNodeInstance {
//     id: number;
//     nodeDefId: number;
//     assignees: TUpdateEventWorkflowInstanceArgsAssignee[];
//     dueDate?: Date | undefined;
//     manuallyCompleted: boolean;
//     manualCompletionComment: string | undefined;
//     lastFieldName: unknown;
//     lastFieldValueAsString: string | unknown;
//     lastAssignees: TUpdateEventWorkflowInstanceArgsAssignee[];
//     activeStateFirstTriggeredAt: Date | undefined;
//     lastProgressState: WorkflowNodeProgressState;
// };

// export interface TUpdateEventWorkflowInstance {
//     id: number;
//     nodeInstances: TUpdateEventWorkflowNodeInstance[];
//     lastEvaluatedWorkflowDefId: number | undefined;
// };

// export interface TUpdateEventWorkflowInstanceArgs {
//     instance: TUpdateEventWorkflowInstance;
//     eventId: number;
// };


export function MutationArgsToWorkflowInstance(x: TUpdateEventWorkflowInstanceArgs): WorkflowInstance {
    const i = x.instance;
    return {
        id: i.id,
        log: [],
        revision: i.revision,
        lastEvaluatedWorkflowDefId: i.lastEvaluatedWorkflowDefId,
        nodeInstances: i.nodeInstances.map(node => ({
            id: node.id,
            nodeDefId: node.nodeDefId,
            assignees: [...node.assignees],
            dueDate: node.dueDate,
            manuallyCompleted: node.manuallyCompleted,
            manualCompletionComment: node.manualCompletionComment,
            lastFieldName: node.lastFieldName,
            lastFieldValueAsString: node.lastFieldValueAsString,
            lastAssignees: [...node.lastAssignees],
            activeStateFirstTriggeredAt: node.activeStateFirstTriggeredAt,
            lastProgressState: node.lastProgressState,
        })),
    };
};

export function WorkflowInstanceToMutationArgs(x: WorkflowInstance, eventId: number): TUpdateEventWorkflowInstanceArgs {
    return {
        eventId,
        instance: {
            id: x.id,
            //log: [],
            revision: x.revision,
            lastEvaluatedWorkflowDefId: x.lastEvaluatedWorkflowDefId,
            nodeInstances: x.nodeInstances.map(node => ({
                id: node.id,
                nodeDefId: node.nodeDefId,
                assignees: [...node.assignees],
                dueDate: node.dueDate,
                manuallyCompleted: node.manuallyCompleted,
                manualCompletionComment: node.manualCompletionComment,
                lastFieldName: node.lastFieldName,
                lastFieldValueAsString: node.lastFieldValueAsString,
                lastAssignees: [...node.lastAssignees],
                activeStateFirstTriggeredAt: node.activeStateFirstTriggeredAt,
                lastProgressState: node.lastProgressState,
            })),
        }
    };
};

