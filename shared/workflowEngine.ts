// todo: 
// - due date
// - support triggers on state change. to set default due date & assignees
// - correct logging
// - permissions
// - detect circular references in graph

// display
// - workflow tab / view / control
// - assigned to you alerts
//   - badge on profile badge
//   - homepage message
// - general indicators / overviews
//   - event view some alert

// permissions
// - view_workflow_instances
// - edit_workflow_instances
// - manage_workflow_defs
// - admin_workflow_defs

// DB hookup

import { isNumber } from "@mui/x-data-grid/internals";
import {
    XYPosition
} from '@xyflow/react';
import { assert } from "blitz";

import '@xyflow/react/dist/style.css';
import { getNextSequenceId, hashString } from "shared/utils";
import { gSwatchColors } from "./color";









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
    // this is subtle, but basically, the provider will determine whether an assignee has satisfied the completion of the node.
    // so this determines:
    // 1. how it's to be displayed to the assignee
    // 2. how completeness is calculated. if there are required assignees, then all of them must be satisfied for the node to be complete.
    //    if there are no required, then any optionals will complete
    // however because UI is cluttered as it is, everyone is currently optional.
    //isRequired: boolean;
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
    FieldUpdated = "FieldUpdated",// field updated
    AssigneesChanged = "AssigneesChanged",// assignee changed
    DueDateChanged = "DueDateChanged",// duedate changed
    StatusChanged = "StatusChanged",
};

export interface WorkflowLogItem {
    nodeDefId: number;
    userId: number | undefined;
    type: WorkflowLogItemType;
    fieldName: string | undefined;
    oldValue: unknown;
    newValue: unknown;
    at: Date;
};

export interface WorkflowNodeInstance {
    id: number;
    nodeDefId: number;
    activeStateFirstTriggeredAt: Date | undefined;
    lastProgressState: WorkflowNodeProgressState;
    silenceAlerts: boolean; // "pause" behavior
    assignees: WorkflowNodeAssignee[];
    dueDate?: Date;

    // for logging field value changes, this is necessary.
    // and it's necessary to keep field name as well because if you change the workflow def to a different field name. sure you could just clear it out, but it can be common to change the field name and change it back like "nah i didn't mean to" and it would be dumb to clear out statuses invoking a bunch of log messages that are just noise.
    lastFieldName: unknown;
    lastFieldValueAsString: string | unknown;
};

export type WorkflowTidiedNodeInstance = WorkflowNodeInstance & {
    isTidy: true;
};

export interface WorkflowInstance {
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
    nodeDefId: number;

    isEvaluated: boolean;
    relevanceSatisfied: boolean; // does relevance criteria pass?
    activationSatisfied: boolean; // 
    completenessSatisfied: boolean;
    progressState: WorkflowNodeProgressState;
    progress01: number | undefined; // progress taking into account dependent nodes. or if this is a field node, then will be 0 or 1, unlessy ou have multiple assignees.
    isSilent: boolean; // propagation of silenceAlerts

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
    //schemaHash: string;
    evaluatedNodes: WorkflowEvaluatedNode[];
};

// export function GetWorkflowDefSchemaHash(flowDef: WorkflowDef) {
//     return hashString(JSON.stringify(flowDef, (key, val) => {
//         // don't put these very "live" react flow state objects in the hash.
//         switch (key) {
//             case 'position':
//             case 'selected':
//             case 'width':
//             case 'height':
//                 return 0;
//         }
//         return val;
//     })).toString();
// }


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
                assignees: JSON.parse(JSON.stringify(nodeDef.defaultAssignees)),
                isTidy: true,
                lastFieldName: undefined,
                lastFieldValueAsString: undefined,
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

interface WorkflowInstanceMutator_Args {
    sourceWorkflowInstance: WorkflowInstance;
};

type WorkflowInstanceMutatorFn<TextraArgs> = (args: WorkflowInstanceMutator_Args & TextraArgs) => WorkflowInstance | undefined;

export interface WorkflowInstanceMutator {
    DoesFieldValueSatisfyCompletionCriteria: (args: { flowDef: WorkflowDef, nodeDef: WorkflowNodeDef, tidiedNodeInstance: WorkflowTidiedNodeInstance, assignee: undefined | WorkflowNodeAssignee }) => boolean;
    GetModelFieldNames: (args: { flowDef: WorkflowDef, nodeDef: WorkflowNodeDef, node: WorkflowTidiedNodeInstance }) => string[];

    // equality-comparable and db-serializable
    GetFieldValueAsString: (args: { flowDef: WorkflowDef, nodeDef: WorkflowNodeDef, node: WorkflowTidiedNodeInstance }) => string;
    ResetModelAndInstance: () => void;

    SetAssigneesForNode: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, assignees: WorkflowNodeAssignee[], }>;
    SetNodeStatusData: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, previousProgressState: WorkflowNodeProgressState, lastProgressState: WorkflowNodeProgressState, dueDate: Date | undefined, activeStateFirstTriggeredAt: Date | undefined }>;
    AddLogItem: WorkflowInstanceMutatorFn<{ msg: Omit<WorkflowLogItem, 'userId'> }>; // userId should be added by handler
    SetLastFieldValue: WorkflowInstanceMutatorFn<{ evaluatedNode: WorkflowEvaluatedNode, fieldName: string | undefined, fieldValueAsString: string | undefined }>;

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

    // evaluate dependencies
    const evaluatedChildren: WorkflowEvaluatedDependentNode[] = nodeDef.nodeDependencies.map(childDependency => {
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
        return ret;
    });

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
        isSilent: evaluatedChildren.every(v => v.evaluation.isSilent), // parents only silenced when all children are (if there are any children with alerts, parents still see alerts)

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
                //const requiredAssignees = evaluation.completenessByAssigneeId.filter(c => c.assignee.isRequired);
                const optionalAssignees = evaluation.completenessByAssigneeId;//.filter(c => !c.assignee.isRequired);
                //const satisfiedRequired = requiredAssignees.filter(c => c.completenessSatisfied).length;
                const satisfiedOptional = optionalAssignees.filter(c => c.completenessSatisfied).length;

                // if all are optional, then ANY satisfied will complete the node.
                //if (requiredAssignees.length === 0) {
                assert(optionalAssignees.length > 0, "0 optional + 0 required assignees wut");
                evaluation.completenessSatisfied = satisfiedOptional > 0;
                evaluation.progress01 = satisfiedOptional / optionalAssignees.length;
                // }
                // else {
                //     // there are some required
                //     const requiredSatisfied = satisfiedRequired === requiredAssignees.length;
                //     if (requiredSatisfied) { // don't let optional assignees block completeness when the required ones are satisfied.
                //         evaluation.progress01 = 1;
                //         evaluation.completenessSatisfied = true;
                //     } else {
                //         // required ones are not done. in order for optional assignees to result in forward progress, include the total assignees in the calculation.
                //         evaluation.progress01 = (satisfiedRequired + satisfiedOptional) / node.assignees.length;
                //         evaluation.completenessSatisfied = false;
                //     }
                // }
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

    console.log(`Evaluating the workflow... reason: ${reason}`);

    const evaluatedNodes: WorkflowEvaluatedNode[] = [];

    const tidiedInstance = TidyWorkflowInstance(workflowInstance, flowDef);

    const mutations: WorkflowInstanceMutatorFnChainSpec[] = [];

    for (let i = 0; i < tidiedInstance.nodeInstances.length; ++i) {
        EvaluateTree([], flowDef, tidiedInstance.nodeInstances[i]!, tidiedInstance, api, evaluatedNodes, mutations);
    }

    // for field values, register value changes.
    for (let i = 0; i < tidiedInstance.nodeInstances.length; ++i) {
        const node = evaluatedNodes.find(en => en.nodeDefId === tidiedInstance.nodeInstances[i]!.nodeDefId)!;
        const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
        if (nodeDef.completionCriteriaType !== WorkflowCompletionCriteriaType.fieldValue) {
            continue;
        }

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

    // trigger state change hooks
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
                if (isNumber(nodeDef.defaultDueDateDurationMsAfterStarted)) {
                    newValues.dueDate = new Date(new Date().getTime() + nodeDef.defaultDueDateDurationMsAfterStarted);
                }
            }

            mutations.push(
                { fn: sourceWorkflowInstance => api.SetNodeStatusData({ sourceWorkflowInstance, evaluatedNode: node, previousProgressState: oldState, ...newValues }), wantsReevaluation: false },
                {
                    // it's tempting to want to include things like whether this was a user-induced change or derivative. but that can be known by looking at the node defs so don't put it directly in the log.
                    fn: sourceWorkflowInstance => api.AddLogItem({
                        sourceWorkflowInstance, msg: {
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

    if (mutations.length) {
        console.log(`post evaluation adding ${mutations.length} instance mutations`);
        chainWorkflowInstanceMutations({ ...workflowInstance }, mutations, api.onWorkflowInstanceMutationChainComplete);
    }
    const ret: EvaluatedWorkflow = {
        evaluatedNodes,
        flowInstance: tidiedInstance,
        //schemaHash: GetWorkflowDefSchemaHash(flowDef),
    };
    return ret;
};



export const WorkflowMakeConnectionId = (srcNodeDefId: number, targetNodeDefId: number) => {
    return `${srcNodeDefId}:${targetNodeDefId}`;
}

export const WorkflowInitializeInstance = (workflowDef: WorkflowDef): WorkflowInstance => {
    return {
        nodeInstances: [],
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
        width: undefined,
        height: undefined,
    }],
    name: "New workflow",
    nodeDefs: [],
});
