import { Divider, ListItemIcon, Menu, MenuItem, Tooltip } from "@mui/material";
import React, { useContext } from "react";
import { lerp, Setting, sortBy } from "shared/utils";
import { chainWorkflowInstanceMutations, EvaluatedWorkflow, EvaluateWorkflow, MakeNewWorkflowDef, TidyWorkflowInstance, WorkflowCompletionCriteriaType, WorkflowDef, WorkflowEvaluatedDependentNode, WorkflowEvaluatedNode, WorkflowFieldValueOperator, WorkflowInstance, WorkflowInstanceMutator, WorkflowInstanceMutatorFnChainSpec, WorkflowLogItemType, WorkflowNodeAssignee, WorkflowNodeDef, WorkflowNodeDisplayStyle, WorkflowNodeEvaluation, WorkflowNodeGroupDef, WorkflowNodeProgressState, WorkflowTidiedInstance } from "shared/workflowEngine";
import { GetStyleVariablesForColor } from "./Color";

import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { AdminInspectObject, InspectObject } from "./CMCoreComponents";
import { AnimatedCircularProgress, CMSmallButton, Pre } from "./CMCoreComponents2";
import * as DB3Client from "../db3/DB3Client";
import * as db3 from "../db3/db3";
import { DB3MultiSelect } from "../db3/components/db3Select";
import { CMSelectDisplayStyle } from "./CMSelect";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { SettingMarkdown } from "./SettingMarkdown";
import { DateToYYYYMMDDHHMMSS } from "shared/time";

type CMXYPosition = {
    x: number;
    y: number;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface WorkflowAssigneesSelectionProps {
    value: WorkflowNodeAssignee[];
    evaluatedNode: WorkflowEvaluatedNode;
    showPictogram: boolean;
    readonly: boolean;
    onChange: (val: WorkflowNodeAssignee[]) => void;
};

export const WorkflowAssigneesSelection = (props: WorkflowAssigneesSelectionProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const nodeDef = ctx.getNodeDef(props.evaluatedNode.nodeDefId);

    const queryStatus = DB3Client.useDb3Query<db3.UserMinimumPayload>(db3.xUser);
    const getUserById = (id: number) => {
        const ret = queryStatus.items.find(u => u.id === id);
        if (!ret) throw new Error(`user not found ${id}`);
        return ret;
    };
    const getAssignee = (u: db3.UserMinimumPayload): WorkflowNodeAssignee => {
        const ret = props.value.find(a => a.userId === u.id);
        if (!ret) {
            return {
                //isRequired: false,
                userId: u.id,
            };
        }
        return ret;
    };

    return <DB3MultiSelect<db3.UserMinimumPayload>
        schema={db3.xUser}
        displayStyle={CMSelectDisplayStyle.SelectedWithDialog}
        value={props.value.map(x => getUserById(x.userId))}
        chipShape="rounded"
        chipSize="small"
        readonly={props.readonly}
        dialogTitle={`Select assignees for "${nodeDef.name}"`}
        dialogDescription={<SettingMarkdown setting={Setting.Workflow_SelectAssigneesDialogDescription} />}
        onChange={items => props.onChange(items.map(u => ({
            isRequired: false,
            userId: u.id,
        })))}
        editButtonChildren={"Assign..."}
        renderOption={u => {
            const assignee = getAssignee(u);
            const evaluated = props.evaluatedNode.evaluation.completenessByAssigneeId.find(ea => ea.assignee.userId === u.id);
            // [WorkflowNodeProgressState.Relevant]: <HourglassEmptyIcon style={{ width: iconSize, color: '#777' }} />, // part of the flow but not active / started yet
            // [WorkflowNodeProgressState.Activated]: <PlayCircleOutlineIcon style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
            // [WorkflowNodeProgressState.Completed]: <CheckCircleIcon style={{ width: iconSize, color: 'green' }} />, // all criteria satisfied / complete
            const iconSize = 13;

            const indicator = evaluated ? evaluated.completenessSatisfied ? <CheckCircleIcon style={{ width: iconSize, color: 'green' }} /> : <PlayCircleOutlineIcon style={{ width: iconSize, color: 'blue' }} /> : undefined;
            return <Tooltip disableInteractive={true} title={`Assigned to ${u.name} - ${evaluated?.completenessSatisfied ? "Complete" : "Incomplete"}`}>
                <div style={{ display: "flex" }} className="assigneeCaption">
                    {props.showPictogram && gCharMap.BustInSilhouette()} {u.name} {indicator}
                </div>
            </Tooltip>;
        }}
    />
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface WorkflowAssigneesMenuItemProps {
    value: WorkflowNodeAssignee[];
    evaluatedNode: WorkflowEvaluatedNode;
    onJustAfterClicked?: () => void;
    onChange: (val: WorkflowNodeAssignee[]) => void;
};

export const WorkflowAssigneesMenuItem = (props: WorkflowAssigneesMenuItemProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const nodeDef = ctx.getNodeDef(props.evaluatedNode.nodeDefId);

    const queryStatus = DB3Client.useDb3Query<db3.UserMinimumPayload>(db3.xUser);
    const getUserById = (id: number) => {
        const ret = queryStatus.items.find(u => u.id === id);
        if (!ret) throw new Error(`user not found ${id}`);
        return ret;
    };

    return <DB3MultiSelect<db3.UserMinimumPayload>
        schema={db3.xUser}
        displayStyle={CMSelectDisplayStyle.CustomButtonWithDialog}
        value={props.value.map(x => getUserById(x.userId))}
        chipShape="rounded"
        chipSize="small"
        dialogTitle={`Select assignees for "${nodeDef.name}"`}
        dialogDescription={<SettingMarkdown setting={Setting.Workflow_SelectAssigneesDialogDescription} />}
        onChange={items => props.onChange(items.map(u => ({
            isRequired: false,
            userId: u.id,
        })))}
        editButtonChildren={"Assign..."}
        customRender={(onClick) => <MenuItem onClick={(e) => {
            props.onJustAfterClicked && props.onJustAfterClicked();
            onClick();
        }}>
            <ListItemIcon>{gIconMap.Person()}</ListItemIcon>
            Assign to...
        </MenuItem>}
    />
};




/////////////////////////////////////////////////////////////////////////////////////////////
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
    position: CMXYPosition;
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
    groupDefId: number | null;
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
    position: CMXYPosition;
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


// // when a mutation occurs, what needs to happen?
// // - nothing (no changes or no side-effects)
// // - re-evaluation should happen
// export enum WorkflowMutatorResult {
//     NoEffect = "NoEffect", // no changes / no side-effects; act as if noop
//     Modified = "Modified", // the def was changed / updated
//     //NeedsEvaluation = "NeedsEvaluation", // the def was changed, and a re-evaluation is necessary to propagate the changes to 
// };

export type WorkflowDefMutatorFn<T = {}> = (args: WorkflowDefMutator_Args & T) => WorkflowDef | undefined; // for the mutator class declaration

export interface WorkflowDefMutator {
    deselectAll: WorkflowDefMutatorFn<{}>;

    // take the incoming source workflow def and output a mutated version. if no mutation, return undefined. that's important to avoid endless state loop
    addNode: (args: WorkflowDefMutator_AddNodeArgs) => WorkflowDef | undefined;
    deleteNode: (args: WorkflowDefMutator_DeleteNodeArgs) => WorkflowDef | undefined;
    setNodeSelected: (args: WorkflowDefMutator_SetNodeSelectedArgs) => WorkflowDef | undefined;
    setNodePosition: (args: WorkflowDefMutator_SetNodePositionArgs) => WorkflowDef | undefined;
    setNodeSize: (args: WorkflowDefMutator_SetNodeSizeArgs) => WorkflowDef | undefined;

    setNodeBasicInfo: (args: WorkflowDefMutator_SetNodeBasicInfoArgs) => WorkflowDef | undefined;
    setNodeGroup: (args: WorkflowDefMutator_SetNodeGroupArgs) => WorkflowDef | undefined;
    setNodeFieldInfo: WorkflowDefMutatorFn<{
        nodeDef: WorkflowNodeDef,
        fieldName: string | undefined;
        fieldValueOperator: WorkflowFieldValueOperator | undefined;
        fieldValueOperand2: unknown; // for things like less than, equals, whatever.
    }>;
    setNodeRelevanceCriteriaType: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeActivationCriteriaType: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeCompletionCriteriaType: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeDefaultAssignees: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, defaultAssignees: WorkflowNodeAssignee[] }>;
    setNodeDefaultDueDateMsAfterStarted: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, defaultDueDateDurationMsAfterStarted?: number | undefined }>;

    setEdgeInfo: WorkflowDefMutatorFn<{
        sourceNodeDef: WorkflowNodeDef,
        targetNodeDef: WorkflowNodeDef,
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

/////////////////////////////////////////////////////////////////////////////////////////////
export const MakeWorkflowDefMutator = (): WorkflowDefMutator => {

    const deselectAllGeneric = (items: { selected: boolean }[]): boolean => {
        let changed: boolean = false;
        items.forEach(d => {
            if (d.selected) {
                changed = true;
                d.selected = false;
            }
        });
        return changed;
    };

    const deselectAll = (flowDef: WorkflowDef): boolean => {
        let changed: boolean = false;
        flowDef.nodeDefs.forEach(nd => {
            if (nd.selected) {
                changed = true;
                nd.selected = false;
            }
            changed = deselectAllGeneric(nd.nodeDependencies) || changed;
        });
        changed = deselectAllGeneric(flowDef.groupDefs) || changed;
        return changed;
    };

    return {
        deselectAll: (args) => {
            const changed = deselectAll(args.sourceDef);
            if (changed) return args.sourceDef;
            return undefined;
        },
        addNode: (args) => {
            // first deselect everything; it's better ux.
            deselectAll(args.sourceDef);
            args.sourceDef.nodeDefs.push(args.nodeDef);
            return args.sourceDef;
        },
        setNodePosition: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`setting position on an unknown node huh?`);
            if (n.position.x === args.position.x && n.position.y === args.position.y) return undefined;
            n.position = { ...args.position };
            return args.sourceDef;
        },
        setNodeSize: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`setting size on an unknown node huh?`);
            if (n.width === args.width && n.height === args.height) return;
            n.width = args.width;
            n.height = args.height;
            return args.sourceDef;
        },
        setNodeSelected: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`setting selected on an unknown node huh?`);
            if (n.selected === args.selected) return;
            n.selected = args.selected;
            return args.sourceDef;
        },
        connectNodes: (args) => {
            const src = args.sourceDef.nodeDefs.find(n => n.id === args.sourceNodeDef.id);
            if (!src) throw new Error(`connecting -> unknown source node huh?`);
            const dest = args.sourceDef.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!dest) throw new Error(`connecting -> unknown dest node huh?`);
            if (dest.nodeDependencies.find(d => d.nodeDefId === src.id)) return; // already connected
            dest.nodeDependencies.push({
                selected: false,
                nodeDefId: src.id,
                determinesRelevance: false,
                determinesActivation: false,
                determinesCompleteness: true,
            });
            return args.sourceDef;
        },
        setEdgeSelected: (args) => {
            const targetNode = args.sourceDef.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!targetNode) throw new Error(`selecting an edge; unknown target`);
            const edge = targetNode.nodeDependencies.find(d => d.nodeDefId === args.sourceNodeDef.id);
            if (!edge) throw new Error(`selecting an edge; unknown source`);
            if (edge.selected === args.selected) return;
            edge.selected = args.selected;
            return args.sourceDef;
        },
        deleteNode: (args) => {
            // delete any dependencies or references to this node.
            args.sourceDef.nodeDefs.forEach(n => {
                n.nodeDependencies = n.nodeDependencies.filter(d => d.nodeDefId !== args.nodeDef.id);
            });
            args.sourceDef.nodeDefs = args.sourceDef.nodeDefs.filter(n => n.id !== args.nodeDef.id);
            return args.sourceDef;
        },
        deleteConnection: (args) => {
            const targetNode = args.sourceDef.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!targetNode) throw new Error(`selecting an edge; unknown target`);
            targetNode.nodeDependencies = targetNode.nodeDependencies.filter(d => d.nodeDefId !== args.sourceNodeDef.id);
            return args.sourceDef;
        },
        addGroup: (args) => {
            // first deselect everything; it's better ux.
            deselectAll(args.sourceDef);
            args.sourceDef.groupDefs.push(args.groupDef);
            return args.sourceDef;
        },
        deleteGroup: (args) => {
            // delete any dependencies or references to this.
            args.sourceDef.nodeDefs.forEach(n => {
                if (n.groupDefId === args.groupDef.id) n.groupDefId = null;
            });
            args.sourceDef.groupDefs = args.sourceDef.groupDefs.filter(n => n.id !== args.groupDef.id);
            return args.sourceDef;
        },
        setGroupSelected: (args) => {
            const n = args.sourceDef.groupDefs.find(n => n.id === args.groupDef.id);
            if (!n) throw new Error(`setting selected on an unknown group huh?`);
            if (n.selected === args.selected) return;
            n.selected = args.selected;
            return args.sourceDef;
        },
        setGroupPosition: (args) => {
            const n = args.sourceDef.groupDefs.find(n => n.id === args.groupDef.id);
            if (!n) throw new Error(`setting position on an unknown group huh?`);
            if (n.position.x === args.position.x && n.position.y === args.position.y) return;
            n.position = { ...args.position };
            return args.sourceDef;
        },
        setGroupSize: (args) => {
            const n = args.sourceDef.groupDefs.find(n => n.id === args.groupDef.id);
            if (!n) throw new Error(`setting size on an unknown group huh?`);
            if (n.width === args.width && n.height === args.height) return;
            n.width = args.width;
            n.height = args.height;
            return args.sourceDef;
        },
        setGroupParams: (args) => {
            const n = args.sourceDef.groupDefs.find(n => n.id === args.groupDef.id);
            if (!n) throw new Error(`setting params on an unknown group huh?`);
            // react flow doesn't update this so there's no risk of infinite loop by always returning an object
            if (args.color !== undefined) {
                n.color = args.color;
            }
            if (args.name !== undefined) {
                n.name = args.name;
            }
            return args.sourceDef;
        },
        setNodeBasicInfo: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            if (args.displayStyle !== undefined) {
                n.displayStyle = args.displayStyle;
            }
            if (args.name !== undefined) {
                n.name = args.name;
            }
            if (args.thisNodeProgressWeight !== undefined) {
                n.thisNodeProgressWeight = args.thisNodeProgressWeight;
            }
            return args.sourceDef;
        },
        setNodeGroup: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.groupDefId = args.groupDefId;
            return args.sourceDef;
        },
        setNodeFieldInfo: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.fieldName = args.fieldName;
            n.fieldValueOperator = args.fieldValueOperator;
            n.fieldValueOperand2 = args.fieldValueOperand2;
            return args.sourceDef;
        },
        setNodeRelevanceCriteriaType: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.relevanceCriteriaType = args.criteriaType;
            return args.sourceDef;
        },
        setNodeActivationCriteriaType: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.activationCriteriaType = args.criteriaType;
            return args.sourceDef;
        },
        setNodeCompletionCriteriaType: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.completionCriteriaType = args.criteriaType;
            return args.sourceDef;
        },
        setNodeDefaultAssignees: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.defaultAssignees = [...args.defaultAssignees];
            return args.sourceDef;
        },
        setNodeDefaultDueDateMsAfterStarted: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.defaultDueDateDurationMsAfterStarted = args.defaultDueDateDurationMsAfterStarted;
            return args.sourceDef;
        },
        setEdgeInfo: (args) => {
            const targetNodeDef = args.sourceDef.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!targetNodeDef) throw new Error(`unknown targetNodeDef`);
            const nd = targetNodeDef.nodeDependencies.find(d => d.nodeDefId === args.sourceNodeDef.id);
            if (!nd) throw new Error(`unknown node dependency`);
            if (args.determinesRelevance !== undefined) {
                nd.determinesRelevance = args.determinesRelevance;
            }
            if (args.determinesActivation !== undefined) {
                nd.determinesActivation = args.determinesActivation;
            }
            if (args.determinesCompleteness !== undefined) {
                nd.determinesCompleteness = args.determinesCompleteness;
            }
            return args.sourceDef;
        },
    };
};

/////////////////////////////////////////////////////////////////////////////////////////////
export type WorkflowDefMutatorProc = (workflowDef: WorkflowDef) => WorkflowDef | undefined; // for chaining
export type WorkflowDefMutatorFnChainSpec = { fn: WorkflowDefMutatorProc, wantsReevaluation: boolean };

function chainMutations(
    initialWorkflowDef: WorkflowDef, // we will make a copy of this
    mutators: WorkflowDefMutatorFnChainSpec[],
    onChangesOccurred: (newDef: WorkflowDef, reEvaluationNeeded: boolean) => void,
) {
    let currentWorkflowDef: WorkflowDef | undefined = { ...initialWorkflowDef };
    let changesOccurred: boolean = false;
    let reEvaluationNeeded: boolean = false;

    for (const mutator of mutators) {
        if (currentWorkflowDef) {
            const mutatedWorkflowDef = mutator.fn(currentWorkflowDef);
            if (mutatedWorkflowDef) {
                changesOccurred = true;
                reEvaluationNeeded = reEvaluationNeeded || mutator.wantsReevaluation;
                currentWorkflowDef = mutatedWorkflowDef;
            }
        }
    }
    if (changesOccurred) onChangesOccurred(currentWorkflowDef, reEvaluationNeeded);
}




/////////////////////////////////////////////////////////////////////////////////////////////
export interface WorkflowRenderer {
    RenderFieldValueForNode: (args: {
        flowDef: WorkflowDef,
        editable: boolean,
        evaluatedNode: WorkflowEvaluatedNode,
        nodeDef: WorkflowNodeDef,
        //setWorkflowInstance: (newInstance: WorkflowInstance) => void,
    }) => React.ReactNode;

    RenderEditorForFieldOperand2: (args: {
        flowDef: WorkflowDef,
        nodeDef: WorkflowNodeDef, // use this for value
        evaluatedNode: WorkflowEvaluatedNode,
        setValue: (value: unknown) => void,
    }) => React.ReactNode;

};


/////////////////////////////////////////////////////////////////////////////////////////////
type EvaluatedWorkflowContextType = {
    flowDef: WorkflowDef, // basically the raw def from the db
    flowInstance: WorkflowInstance; // basically raw instance from db
    flowDefMutator: WorkflowDefMutator;
    instanceMutator: WorkflowInstanceMutator;
    renderer: WorkflowRenderer;
    //setWorkflowDef: (newFlowDef: WorkflowDef) => void,
    //setWorkflowInstance: (newInstance: WorkflowInstance) => void,

    evaluatedFlow: EvaluatedWorkflow; // tidied and evaluated

    // assumes the node exists!
    getNodeDef: (nodeDefId: number) => WorkflowNodeDef;
    getEvaluatedNode: (nodeDefId: number) => WorkflowEvaluatedNode;
    getGroupDef: (groupDefId: number) => WorkflowNodeGroupDef;

    chainDefMutations: (mutators: WorkflowDefMutatorFnChainSpec[], reason: string) => void,
    chainInstanceMutations: (mutators: WorkflowInstanceMutatorFnChainSpec[], reason: string) => void,
};

//type WorkflowInstanceMutatorFnChainSpec = { fn: WorkflowDefMutatorFn, wantsReevaluation: boolean };

type EvaluatedWorkflowProviderProps = {
    flowDef: WorkflowDef, // basically the raw def from the db
    flowInstance: WorkflowInstance; // basically raw instance from db
    evaluatedFlow: EvaluatedWorkflow;
    instanceMutator: WorkflowInstanceMutator;
    renderer: WorkflowRenderer;
    onWorkflowDefMutationChainComplete: (newFlowDef: WorkflowDef, reEvalRequested: boolean, reason: string) => void,
    //reEvaluate: () => void;
};

export const EvaluatedWorkflowContext = React.createContext<EvaluatedWorkflowContextType | undefined>(undefined);

export const EvaluatedWorkflowProvider = ({ children, ...props }: React.PropsWithChildren<EvaluatedWorkflowProviderProps>) => {

    // TODO: OR USE SCHEMA HASH?
    const ctx: EvaluatedWorkflowContextType = React.useMemo(() => {
        // const tidiedInstance = TidyWorkflowInstance(props.flowInstance, props.flowDef);
        // const newEvalFlow = EvaluateWorkflow(props.flowDef, tidiedInstance, props.instanceMutator, props.setWorkflowInstance);
        console.log(`Making new context`);
        return {
            ...props,
            flowDefMutator: MakeWorkflowDefMutator(),
            evaluatedFlow: props.evaluatedFlow,
            getNodeDef: (nodeDefId: number) => props.flowDef.nodeDefs.find(nd => nd.id === nodeDefId)!,
            getGroupDef: (groupDefId: number) => props.flowDef.groupDefs.find(g => g.id === groupDefId)!,
            getEvaluatedNode: (nodeDefId: number) => props.evaluatedFlow.evaluatedNodes.find(en => en.nodeDefId === nodeDefId)!,
            chainDefMutations: (mutators: WorkflowDefMutatorFnChainSpec[], reason: string) => {
                chainMutations(props.flowDef, mutators,
                    (newDef: WorkflowDef, reEvaluationNeeded) => {
                        props.onWorkflowDefMutationChainComplete(newDef, reEvaluationNeeded, reason);
                    },
                );
            },
            chainInstanceMutations: (mutators: WorkflowInstanceMutatorFnChainSpec[]) => {
                chainWorkflowInstanceMutations(props.flowInstance, mutators, (newInstance: WorkflowInstance, reEvaluationNeeded) => {
                    props.instanceMutator.onWorkflowInstanceMutationChainComplete(newInstance, reEvaluationNeeded);
                });
            }
        };
    }, [props.flowDef, props.flowInstance, props.evaluatedFlow, props.instanceMutator, props.renderer, props.onWorkflowDefMutationChainComplete]);

    return (
        <EvaluatedWorkflowContext.Provider value={ctx}>
            {children}
        </EvaluatedWorkflowContext.Provider>
    );
};





interface WorkflowNodeProgressIndicatorProps {
    value: WorkflowNodeEvaluation;
}

export const WorkflowNodeProgressIndicator = (props: WorkflowNodeProgressIndicatorProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const iconSize = `14px`;
    const progressSize = 18;

    const progressStateIcons = {
        [WorkflowNodeProgressState.Irrelevant]: <RemoveCircleOutlineIcon style={{ width: iconSize, color: '#bbb' }} />, // not part of the flow
        [WorkflowNodeProgressState.Relevant]: <HourglassEmptyIcon style={{ width: iconSize, color: '#777' }} />, // part of the flow but not active / started yet
        [WorkflowNodeProgressState.Activated]: <PlayCircleOutlineIcon style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
        [WorkflowNodeProgressState.Completed]: <CheckCircleIcon style={{ width: iconSize, color: 'green' }} />, // all criteria satisfied / complete
        [WorkflowNodeProgressState.InvalidState]: <CancelIcon style={{ width: iconSize, color: 'red' }} />, // error condition
    };

    const dependentNodesDesc = (dependencies: WorkflowEvaluatedDependentNode[]): React.ReactNode => {
        return dependencies.length > 0 &&
            <div>
                <div>Waiting on:</div>
                <ul>
                    {dependencies.map(dn => {
                        const dndef = ctx.getNodeDef(dn.nodeDefId);
                        return <li key={dn.nodeDefId}>{dndef.name}</li>
                    })}
                </ul>
            </div>;
    };

    // completeness state.
    let tooltip: React.ReactNode = null;
    const nodeDef = ctx.getNodeDef(props.value.nodeDefId);
    switch (props.value.progressState) {
        case WorkflowNodeProgressState.Irrelevant:
            tooltip = <div>
                <div>Irrelevant ({nodeDef.relevanceCriteriaType})</div>
                {dependentNodesDesc(props.value.relevanceBlockedByNodes)}
            </div>;
            break;
        case WorkflowNodeProgressState.Relevant:
            tooltip = <div>
                <div>Blocked ({nodeDef.activationCriteriaType})</div>
                {dependentNodesDesc(props.value.activationBlockedByNodes)}
            </div>;
            break;
        case WorkflowNodeProgressState.Activated:
            tooltip = <div>
                <div>In progress ({nodeDef.completionCriteriaType}) {props.value.progress01 === undefined ? "" : `${(props.value.progress01 * 100).toFixed(2)}%`}</div>
                {dependentNodesDesc(props.value.completenessBlockedByNodes)}
            </div>;
            break;
        case WorkflowNodeProgressState.Completed:
            tooltip = <div>
                <div>Complete</div>
            </div>;
            break;
    }

    return (
        <Tooltip title={tooltip} disableInteractive={true}>
            <div style={{ display: 'inline-flex', alignItems: 'center', marginRight: "5px", marginLeft: "2px" }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: "50%", backgroundColor: "#0002" }}>
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <AnimatedCircularProgress size={progressSize} value={(props.value.progress01 || 0) * 100} duration={200} />
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {progressStateIcons[props.value.progressState]}
                        </div>
                    </div>
                </div>
            </div>
        </Tooltip>
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeDotMenuProps {
    evaluatedNode: WorkflowEvaluatedNode;
};

const WorkflowNodeDotMenu = (props: WorkflowNodeDotMenuProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    let k = 0;

    const menuItems: React.ReactNode[] = [
        // <Divider key={++k} />,
        <WorkflowAssigneesMenuItem
            value={props.evaluatedNode.assignees}
            evaluatedNode={props.evaluatedNode}
            onJustAfterClicked={() => setAnchorEl(null)}
            //onChange={(val) => ctx.chainInstanceMutations()}
            onChange={val => {
                ctx.chainInstanceMutations([
                    {
                        fn: sourceWorkflowInstance => ctx.instanceMutator.SetAssigneesForNode({
                            sourceWorkflowInstance,
                            evaluatedNode: props.evaluatedNode,
                            assignees: val,
                        }), wantsReevaluation: true
                    },
                ], `User NodeComponent, assignees change`);
            }}
        />,
        <MenuItem
            key={++k}
            onClick={async () => {
                setAnchorEl(null);
            }}
        >
            <ListItemIcon>{gIconMap.HourglassBottom()}</ListItemIcon>
            Set due date...
        </MenuItem>,
    ];

    return <>
        <CMSmallButton className='DotMenu' style={{ fontSize: "14px" }} onClick={(e) => setAnchorEl(anchorEl ? null : e.currentTarget)}>
            {gCharMap.VerticalEllipses()}
        </CMSmallButton>
        <Menu
            id="menu-songlist"
            anchorEl={anchorEl}
            keepMounted={true}
            open={Boolean(anchorEl)}
            onClose={() => setAnchorEl(null)}
        >
            {menuItems}
        </Menu >
    </>;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    evaluatedNode: WorkflowEvaluatedNode;
    drawSelectionHandles: boolean;
    onClickToSelect?: (() => void) | undefined;
};

export const WorkflowNodeComponent = ({ evaluatedNode, ...props }: WorkflowNodeProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const nodeDef = ctx.getNodeDef(evaluatedNode.nodeDefId);

    let activeControls: React.ReactNode = null;
    switch (nodeDef.completionCriteriaType) {
        case WorkflowCompletionCriteriaType.fieldValue:
            activeControls = ctx.renderer.RenderFieldValueForNode({
                evaluatedNode,
                nodeDef,
                flowDef: ctx.flowDef,
                //setWorkflowInstance: ctx.setWorkflowInstance,
                editable: true,
            });
    }

    return (
        <div className={`workflowNodeContainer ${evaluatedNode.evaluation.progressState} ${(props.drawSelectionHandles && nodeDef.selected) ? "selected" : "not-selected"}`} style={{ display: "flex" }}>
            <div className="indicator">
                <WorkflowNodeProgressIndicator value={evaluatedNode.evaluation} />
            </div>
            <div className="body" style={{ flexGrow: 1 }}>
                <div style={{ display: "flex" }}>
                    <div
                        style={{ flexGrow: 1 }}
                        className="nameLabel"
                        onClick={props.onClickToSelect ? (() => {
                            props.onClickToSelect!();
                        }) : undefined}
                    >
                        {nodeDef.name}
                    </div>
                    <WorkflowNodeDotMenu evaluatedNode={evaluatedNode} />
                </div>
                <div className="assigneesRow">
                    {!evaluatedNode.evaluation.isComplete && <WorkflowAssigneesSelection
                        value={evaluatedNode.assignees}
                        showPictogram={true}
                        readonly={true}
                        onChange={val => {
                            ctx.chainInstanceMutations([
                                {
                                    fn: sourceWorkflowInstance => ctx.instanceMutator.SetAssigneesForNode({
                                        sourceWorkflowInstance,
                                        evaluatedNode,
                                        assignees: val,
                                    }), wantsReevaluation: true
                                },
                            ], `User NodeComponent, assignees change`);
                        }}
                        evaluatedNode={evaluatedNode}
                    />}
                </div>
                <div className="activeControlsContainer">
                    {activeControls}
                </div>
            </div>
        </div>
    );
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowGroupProps {
    groupDefId: number | null;
    drawNodeSelectionHandles: boolean;
    onClickToSelectNode?: ((args: { nodeDefId: number }) => void) | undefined;
    onClickToSelectGroup?: ((args: { groupDefId: number }) => void) | undefined;
};

export const WorkflowGroupComponent = (props: WorkflowGroupProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const groupDef = ctx.flowDef.groupDefs.find(g => g.id === props.groupDefId) || {
        color: "gray",
        name: "ungrouped",
        id: -1334,
        selected: false,
        position: { x: 0, y: 0 },
        height: 100,
        width: 150,
    };
    const vars = GetStyleVariablesForColor({ color: groupDef.color, enabled: true, fillOption: "filled", selected: false, variation: !!props.groupDefId ? "strong" : "weak" });
    const getNodeDef = (nodeDefId: number) => ctx.flowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    const filteredNodes = ctx.evaluatedFlow.evaluatedNodes.filter(ni => {
        const nodeDef = ctx.flowDef.nodeDefs.find(n => n.id === ni.nodeDefId)!;
        return nodeDef.groupDefId == props.groupDefId; // fuzzy so null & undefined are both matching each other
    });

    // don't display empty groups (or maybe this needs to be configurable?)
    if (filteredNodes.length < 1) return null;

    const sortedNodes = sortBy(filteredNodes, n => getNodeDef(n.nodeDefId).position.y);
    return (
        <div className={`workflowNodeGroupContainer ${(props.drawNodeSelectionHandles && groupDef.selected) ? "selected" : "notSelected"}`} style={vars.style}
        >
            <div className="header">
                <div className={`groupName name ${props.onClickToSelectGroup ? "selectable" : "notSelectable"}`}
                    onClick={props.onClickToSelectGroup ? (() => props.onClickToSelectGroup!({ groupDefId: props.groupDefId! })) : undefined}
                >
                    {
                        // don't allow selecting the null group
                        props.drawNodeSelectionHandles && props.groupDefId &&
                        <Tooltip title="Select this group" disableInteractive>
                            <span className={`selectionHandle ${groupDef.selected ? "selected" : "not-selected"}`}>
                            </span></Tooltip>}
                    {groupDef.name}
                </div>
            </div>
            <div className="content">
                {sortedNodes.map(x => <WorkflowNodeComponent
                    key={x.nodeDefId}
                    evaluatedNode={x}
                    drawSelectionHandles={props.drawNodeSelectionHandles}
                    onClickToSelect={props.onClickToSelectNode ? () => {
                        props.onClickToSelectNode!({
                            nodeDefId: x.nodeDefId,
                        });
                    } : undefined}
                />
                )}
            </div>
        </div>
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowContainerProps {
    drawNodeSelectionHandles: boolean;
    onClickToSelectNode?: ((args: { nodeDefId: number }) => void) | undefined;
    onClickToSelectGroup?: ((args: { groupDefId: number }) => void) | undefined;
};

export const WorkflowContainer = (props: WorkflowContainerProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const sortedGroups = sortBy(ctx.flowDef.groupDefs, g => g.position.y);
    const ungroupedNodes = ctx.evaluatedFlow.evaluatedNodes.filter(node => {
        const nodeDef = ctx.flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
        if (!nodeDef) return false;
        return !nodeDef.groupDefId;
    });

    return (
        <div className="workflowContainer">
            {
                (ungroupedNodes.length > 0) && <WorkflowGroupComponent
                    groupDefId={null}
                    drawNodeSelectionHandles={props.drawNodeSelectionHandles}
                    onClickToSelectNode={props.onClickToSelectNode}
                />
            }
            {sortedGroups.map(groupDef => {
                return (
                    <WorkflowGroupComponent
                        key={groupDef.id}
                        groupDefId={groupDef.id}
                        drawNodeSelectionHandles={props.drawNodeSelectionHandles}
                        onClickToSelectGroup={props.onClickToSelectGroup}
                        onClickToSelectNode={props.onClickToSelectNode}
                    />
                );
            })}
        </div>
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const WorkflowLogView = () => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    // filter out unhelpful messages
    const filteredLog = ctx.evaluatedFlow.flowInstance.log.filter(l => {
        if (l.type === WorkflowLogItemType.StatusChanged && l.oldValue === WorkflowNodeProgressState.InvalidState) return false;
        return true;
    });
    const sortedLog = sortBy(filteredLog, l => l.at);
    return (
        <div className="workflowLogContainer">
            <div className="header">Activity Log...</div>
            <div className="content">
                <Pre text={sortedLog.map((m, i) => {
                    // for nodes which are user-facing (fields), show the user
                    // for nodes which are downstream of user-facing, show the chain to user
                    const nodeDef = ctx.getNodeDef(m.nodeDefId);
                    let how = ``;
                    if (nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue) {
                        how = `Field '${nodeDef.fieldName || "<undefined>"}' / '${m.fieldName}' from '${m.oldValue}' by user ${m.userId}`;
                    } else if ([WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(nodeDef.completionCriteriaType)) {
                        how = `due to dependencies`;
                    }
                    return `[${i}] ${DateToYYYYMMDDHHMMSS(m.at)} ${m.type} from ${m.oldValue} -> ${m.newValue} on node ${m.nodeDefId} ${how}`;
                }).join('\n')} />
            </div>
        </div>
    );
};




