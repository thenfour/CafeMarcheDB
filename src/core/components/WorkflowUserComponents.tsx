import CancelIcon from '@mui/icons-material/Cancel';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import PlayCircleOutlineIcon from '@mui/icons-material/PlayCircleOutline';
import RemoveCircleOutlineIcon from '@mui/icons-material/RemoveCircleOutline';
import { Button, DialogActions, DialogContent, DialogTitle, ListItemIcon, Menu, MenuItem, TextField, Tooltip } from "@mui/material";
import React, { useContext } from "react";
import { DateTimeRange, DateToYYYYMMDDHHMMSS } from "shared/time";
import { CoerceToString, IsNullOrWhitespace, Setting, sortBy } from "shared/utils";
import * as DB3Client from "../db3/DB3Client";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { DB3MultiSelect } from "../db3/components/db3Select";
import * as db3 from "../db3/db3";
import { AdminInspectObject } from "./CMCoreComponents";
import { AnimatedCircularProgress, CMSmallButton, EventDateField, Pre } from "./CMCoreComponents2";
import { CMSelectDisplayStyle } from "./CMSelect";
import { CMTextField } from "./CMTextField";
import { GetStyleVariablesForColor } from "./Color";
import { SettingMarkdown } from "./SettingMarkdown";

import { MoreHoriz } from '@mui/icons-material';
import { chainWorkflowInstanceMutations, EvaluatedWorkflow, WorkflowCompletionCriteriaType, WorkflowDef, WorkflowEvaluatedDependentNode, WorkflowEvaluatedNode, WorkflowFieldValueOperator, WorkflowInstance, WorkflowInstanceMutator, WorkflowInstanceMutatorFnChainSpec, WorkflowNodeAssignee, WorkflowNodeDef, WorkflowNodeDisplayStyle, WorkflowNodeGroupDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { Markdown3Editor } from './MarkdownControl3';
import { WorkflowNodeProgressState } from '../db3/shared/apiTypes';
import { Markdown } from './RichTextEditor';
import { ReactiveInputDialog } from './ReactiveInputDialog';

type CMXYPosition = {
    x: number;
    y: number;
};




////////////////////////////////////////////////////////////////
// for viewing a live workflow instance, this operates on a real Date value.
// for the editor, it would be operating on a duration from the theoretical activation moment.
interface WorkflowDueDateValueProps {
    dueDate: Date | undefined;
};

export const WorkflowDueDateValue = (props: WorkflowDueDateValueProps) => {
    if (props.dueDate === undefined) return null;

    const range = new DateTimeRange({
        durationMillis: 0,
        isAllDay: true,
        startsAtDateTime: props.dueDate || null,
    });

    const isOverdue = (props.dueDate <= new Date());

    return <div className={`dueDateContainer ${isOverdue ? "overdue" : ""}`} style={{ display: "flex" }}>
        {isOverdue && <>⚠️</>}
        <div>Due date</div>
        <EventDateField
            dateRange={range}
            className={`WorkflowNodeDueDateValue ${isOverdue ? "overdue" : ""}`}
        />
    </div>;
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////

interface WorkflowAssigneesSelectionProps {
    value: WorkflowNodeAssignee[];
    evaluatedNode: WorkflowEvaluatedNode;
    showPictogram: boolean;
    readonly: boolean;
    onChange?: ((val: WorkflowNodeAssignee[]) => void) | undefined;
};

export const WorkflowAssigneesSelection = (props: WorkflowAssigneesSelectionProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (!ctx.instanceMutator.CanCurrentUserViewDefs()) return <div>Unauthorized to view workflow definitions</div>;
    const readonly = props.readonly || !ctx.instanceMutator.CanCurrentUserEditDefs();

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
        readonly={readonly}
        dialogTitle={`Select assignees for "${nodeDef.name}"`}
        dialogDescription={<SettingMarkdown setting={Setting.Workflow_SelectAssigneesDialogDescription} />}
        onChange={props.onChange ? ((items) => props.onChange!(items.map(u => ({
            isRequired: false,
            userId: u.id,
        })))) : () => { }}
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
    onCancel: () => void;
};

export const WorkflowAssigneesMenuItem = (props: WorkflowAssigneesMenuItemProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (!ctx.instanceMutator.CanCurrentUserViewInstances()) return <div>Unauthorized to view workflow instance</div>;
    const readonly = !ctx.instanceMutator.CanCurrentUserEditInstances();

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
        readonly={readonly}
        chipSize="small"
        dialogTitle={`Select assignees for "${nodeDef.name}"`}
        dialogDescription={<SettingMarkdown setting={Setting.Workflow_SelectAssigneesDialogDescription} />}
        onChange={items => props.onChange(items.map(u => ({
            isRequired: false,
            userId: u.id,
        })))}
        editButtonChildren={"Assign..."}
        customRender={(onClick) => <MenuItem
            disabled={readonly}
            onClick={readonly ? undefined : ((e) => {
                props.onJustAfterClicked && props.onJustAfterClicked();
                onClick();
            })}>
            <ListItemIcon>{gIconMap.Person()}</ListItemIcon>
            Assign to...
        </MenuItem>}
    />
};


/////////////////////////////////////////////////////////////////////////////////////////////

interface WorkflowDueDateMenuItemProps {
    value: Date | undefined;
    evaluatedNode: WorkflowEvaluatedNode;
    onJustAfterClicked?: () => void;
    onChange: (val: Date | undefined) => void;
    onCancel: () => void;
};

export const WorkflowDueDateMenuItem = (props: WorkflowDueDateMenuItemProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (!ctx.instanceMutator.CanCurrentUserViewInstances()) return <div>Unauthorized to view workflow instance</div>;
    const readonly = !ctx.instanceMutator.CanCurrentUserEditInstances();

    const [open, setOpen] = React.useState<boolean>(false);
    const [chosenValue, setChosenValue] = React.useState<Date | undefined>(() => props.value);

    const handleSaveClick = () => {
        props.onJustAfterClicked && props.onJustAfterClicked();
        props.onChange(chosenValue);
        setOpen(false);
    };

    return <>
        {open && <ReactiveInputDialog
            onCancel={() => setOpen(false)}
        >
            <DialogTitle>
                Set due date
            </DialogTitle>
            <DialogContent dividers>

                <DB3Client.CMDatePicker
                    value={chosenValue || null}
                    allowNull={true}
                    onChange={(v) => setChosenValue(v || undefined)}
                />

                <WorkflowDueDateValue dueDate={chosenValue} />

            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)} startIcon={gIconMap.Cancel()}>Cancel</Button>
                <Button onClick={handleSaveClick} startIcon={gIconMap.Save()}>OK</Button>
            </DialogActions>


        </ReactiveInputDialog >}
        <MenuItem
            disabled={readonly}
            onClick={readonly ? undefined : (() => {
                props.onJustAfterClicked && props.onJustAfterClicked();
                setChosenValue(props.value);
                setOpen(true);
            })}
        >
            <ListItemIcon>{gIconMap.HourglassBottom()}</ListItemIcon>
            Set due date...
        </MenuItem>
    </>;
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
    descriptionMarkdown?: string | undefined;
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
        fieldName: string;
        fieldValueOperator: WorkflowFieldValueOperator;
        fieldValueOperand2: unknown; // for things like less than, equals, whatever.
    }>;
    setNodeRelevanceCriteriaType: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeActivationCriteriaType: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeCompletionCriteriaType: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeDefaultAssignees: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, defaultAssignees: WorkflowNodeAssignee[] }>;
    setNodeDefaultDueDateDaysAfterStarted: WorkflowDefMutatorFn<{ nodeDef: WorkflowNodeDef, defaultDueDateDurationDaysAfterStarted?: number | undefined }>;

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

    setWorkflowDefName: WorkflowDefMutatorFn<{ name: string }>;
    setWorkflowDefDescription: WorkflowDefMutatorFn<{ description: string }>;
    setWorkflowDefColor: WorkflowDefMutatorFn<{ color: string | null }>;
    setWorkflowDefIsDefaultForEvents: WorkflowDefMutatorFn<{ isDefaultForEvents: boolean }>;
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
            if (args.descriptionMarkdown !== undefined) {
                n.descriptionMarkdown = args.descriptionMarkdown;
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
        setNodeDefaultDueDateDaysAfterStarted: (args) => {
            const n = args.sourceDef.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`unknown node`);
            n.defaultDueDateDurationDaysAfterStarted = args.defaultDueDateDurationDaysAfterStarted;
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

        setWorkflowDefName: (args) => {
            args.sourceDef.name = args.name;
            return args.sourceDef;
        },
        setWorkflowDefDescription: (args) => {
            args.sourceDef.description = args.description;
            return args.sourceDef;
        },
        setWorkflowDefColor: (args) => {
            args.sourceDef.color = args.color;
            return args.sourceDef;
        },
        setWorkflowDefIsDefaultForEvents: (args) => {
            args.sourceDef.isDefaultForEvents = args.isDefaultForEvents;
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
        readonly: boolean,
        evaluatedNode: WorkflowEvaluatedNode,
        nodeDef: WorkflowNodeDef,
        //setWorkflowInstance: (newInstance: WorkflowInstance) => void,
    }) => React.ReactNode;

    RenderEditorForFieldOperand2: (args: {
        flowDef: WorkflowDef,
        nodeDef: WorkflowNodeDef, // use this for value
        readonly: boolean,
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

    const ctx: EvaluatedWorkflowContextType = React.useMemo(() => {
        // const tidiedInstance = TidyWorkflowInstance(props.flowInstance, props.flowDef);
        // const newEvalFlow = EvaluateWorkflow(props.flowDef, tidiedInstance, props.instanceMutator, props.setWorkflowInstance);
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
    evaluatedNode: WorkflowEvaluatedNode;
    //value: WorkflowNodeEvaluation;
    //isOverdue: boolean;
}

export const WorkflowNodeProgressIndicator = (props: WorkflowNodeProgressIndicatorProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const iconSize = `18px`;
    const progressSize = 22;

    let isOverdue: boolean = false;
    if (props.evaluatedNode.evaluation.isInProgress) {
        if (!!props.evaluatedNode.dueDate) {
            isOverdue = props.evaluatedNode.dueDate < new Date();
        }
    }

    const progressStateIcons = {
        [WorkflowNodeProgressState.Irrelevant]: <RemoveCircleOutlineIcon style={{ width: iconSize, color: '#bbb' }} />, // not part of the flow
        [WorkflowNodeProgressState.Relevant]: <HourglassEmptyIcon style={{ width: iconSize, color: '#777' }} />, // part of the flow but not active / started yet
        //[WorkflowNodeProgressState.Activated]: <PlayCircleOutlineIcon style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
        //[WorkflowNodeProgressState.Activated]: <PlayArrow style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
        //[WorkflowNodeProgressState.Activated]: <DonutLarge style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
        //[WorkflowNodeProgressState.Activated]: <Autorenew style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
        [WorkflowNodeProgressState.Activated]: <MoreHoriz style={{ width: iconSize, color: 'blue' }} />, // actionable / in progress
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
    const nodeDef = ctx.getNodeDef(props.evaluatedNode.evaluation.nodeDefId);
    if (!nodeDef) return null;
    switch (props.evaluatedNode.evaluation.progressState) {
        case WorkflowNodeProgressState.Irrelevant:
            tooltip = <div>
                <div>Irrelevant ({nodeDef.relevanceCriteriaType})</div>
                {dependentNodesDesc(props.evaluatedNode.evaluation.relevanceBlockedByNodes)}
            </div>;
            break;
        case WorkflowNodeProgressState.Relevant:
            tooltip = <div>
                <div>Blocked ({nodeDef.activationCriteriaType})</div>
                {dependentNodesDesc(props.evaluatedNode.evaluation.activationBlockedByNodes)}
            </div>;
            break;
        case WorkflowNodeProgressState.Activated:
            tooltip = <div>
                <div>In progress ({nodeDef.completionCriteriaType}) {props.evaluatedNode.evaluation.progress01 === undefined ? "" : `${(props.evaluatedNode.evaluation.progress01 * 100).toFixed(2)}%`}</div>
                {!!props.evaluatedNode.dueDate && <WorkflowDueDateValue dueDate={props.evaluatedNode.dueDate} />}
                {dependentNodesDesc(props.evaluatedNode.evaluation.completenessBlockedByNodes)}
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
                <div style={{ display: 'inline-flex', alignItems: 'center', borderRadius: "50%", backgroundColor: isOverdue ? "#fc0" : "#0001" }}>
                    <div style={{ position: 'relative', display: 'inline-flex' }}>
                        <AnimatedCircularProgress size={progressSize} value={(props.evaluatedNode.evaluation.progress01 || 0) * 100} duration={200} />
                        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {isOverdue ? gIconMap.ErrorOutline() : progressStateIcons[props.evaluatedNode.evaluation.progressState]}
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

    const menuItems: React.ReactNode[] = [];

    if (!props.evaluatedNode.evaluation.isComplete) {
        menuItems.push(<WorkflowAssigneesMenuItem
            key={++k}
            value={props.evaluatedNode.assignees}
            evaluatedNode={props.evaluatedNode}
            onJustAfterClicked={() => setAnchorEl(null)}
            onCancel={() => setAnchorEl(null)}
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
        />);

        menuItems.push(<WorkflowDueDateMenuItem
            key={++k}
            value={props.evaluatedNode.dueDate}
            evaluatedNode={props.evaluatedNode}
            onJustAfterClicked={() => setAnchorEl(null)}
            onCancel={() => setAnchorEl(null)}
            //onChange={(val) => ctx.chainInstanceMutations()}
            onChange={val => {
                ctx.chainInstanceMutations([
                    {
                        fn: sourceWorkflowInstance => ctx.instanceMutator.SetDueDateForNode({
                            sourceWorkflowInstance,
                            evaluatedNode: props.evaluatedNode,
                            dueDate: val,
                        }), wantsReevaluation: true
                    },
                ], `User NodeComponent, assignees change`);
            }}
        />);
    }

    if (!menuItems.length) return null;

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
    onClickToSelect?: (() => void) | undefined;
};

export const WorkflowNodeComponent = ({ evaluatedNode, ...props }: WorkflowNodeProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (!ctx.instanceMutator.CanCurrentUserViewInstances()) return <div>Unauthorized to view workflow instance</div>;
    const editAuthorized = ctx.instanceMutator.CanCurrentUserEditInstances();
    const readonly = !editAuthorized;

    const nodeDef = ctx.getNodeDef(evaluatedNode.nodeDefId);

    let activeControls: React.ReactNode = null;
    switch (nodeDef.completionCriteriaType) {
        case WorkflowCompletionCriteriaType.fieldValue:
            activeControls = ctx.renderer.RenderFieldValueForNode({
                evaluatedNode,
                nodeDef,
                flowDef: ctx.flowDef,
                readonly,
            });
    }

    if (evaluatedNode.evaluation.progressState === WorkflowNodeProgressState.Irrelevant) return null;
    if (nodeDef.displayStyle === WorkflowNodeDisplayStyle.Hidden) return null;

    // ----------------------------------------------
    // | indicator  title             edit   dotmenu|
    // |            description-------------        |
    // |            assignees --------------        |
    // |            duedate ----------------        |
    // ----------------------------------------------

    return (
        <div className={`workflowNodeContainer ${evaluatedNode.evaluation.progressState}`}>
            <div className='borderLeft'></div>
            <div className='notBorderLeft'>
                <div className='header'>
                    <div className="indicator">
                        <WorkflowNodeProgressIndicator evaluatedNode={evaluatedNode} />
                    </div>
                    <div
                        className="nameLabel"
                        onClick={props.onClickToSelect ? (() => {
                            props.onClickToSelect!();
                        }) : undefined}
                    >
                        {nodeDef.name}
                    </div>
                    <div className='activeControls'>{activeControls}</div>
                    <div className='dotMenu'><WorkflowNodeDotMenu evaluatedNode={evaluatedNode} /></div>
                </div>
                <div className="body">
                    {/* i was tempted to remove due dates if you're not authorized to edit instances. but most of the time it will be
                a model field change due, not the instance itself. so better just leave it.
                 */}
                    {IsNullOrWhitespace(nodeDef.descriptionMarkdown) ? null :
                        <div className="descriptionRow">
                            <Markdown markdown={nodeDef.descriptionMarkdown} compact={true} />
                        </div>}
                    {evaluatedNode.evaluation.isInProgress && editAuthorized &&
                        <div className="dueDateRow">
                            <WorkflowDueDateValue dueDate={evaluatedNode.dueDate} />
                        </div>}
                    <div className="assigneesRow">
                        {!evaluatedNode.evaluation.isComplete && <WorkflowAssigneesSelection
                            value={evaluatedNode.assignees}
                            showPictogram={true}
                            readonly={true} // always readonly; editing is via the dot menu
                            evaluatedNode={evaluatedNode}
                        />}
                    </div>
                </div>
            </div>
        </div>
    );
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowGroupProps {
    groupDefId: number | null;
    //drawNodeSelectionHandles: boolean;
    onClickToSelectNode?: ((args: { nodeDefId: number }) => void) | undefined;
    onClickToSelectGroup?: ((args: { groupDefId: number }) => void) | undefined;
};

export const WorkflowGroupComponent = (props: WorkflowGroupProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const groupDef = ctx.flowDef.groupDefs.find(g => g.id === props.groupDefId) || {
        color: "gray",
        name: "",
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
        if (!nodeDef) return false;
        return nodeDef.groupDefId == props.groupDefId; // fuzzy so null & undefined are both matching each other
    });

    // don't display empty groups (or maybe this needs to be configurable?)
    if (filteredNodes.length < 1) return null;

    const sortedNodes = sortBy(filteredNodes, n => getNodeDef(n.nodeDefId).position.y);
    return (
        <div className={`workflowNodeGroupContainer`} style={vars.style}
        >
            {IsNullOrWhitespace(groupDef.name) ? null : <div className="header">
                <div className={`groupName name ${props.onClickToSelectGroup ? "selectable" : "notSelectable"}`}
                    onClick={props.onClickToSelectGroup ? (() => props.onClickToSelectGroup!({ groupDefId: props.groupDefId! })) : undefined}
                >
                    {groupDef.name}
                </div>
            </div>}
            <div className="content">
                {sortedNodes.map(x => <WorkflowNodeComponent
                    key={x.nodeDefId}
                    evaluatedNode={x}
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
    //drawNodeSelectionHandles: boolean;
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
        <>
            <div>
                <AdminInspectObject src={ctx.flowDef} label="FlowDef" />
                <AdminInspectObject src={ctx.flowInstance} label="FlowInstance" />
                <AdminInspectObject src={ctx.evaluatedFlow} label="EvaluatedFlow" />
            </div>
            <div className="workflowContainer">
                {
                    (ungroupedNodes.length > 0) && <WorkflowGroupComponent
                        groupDefId={null}
                        onClickToSelectNode={props.onClickToSelectNode}
                    />
                }
                {sortedGroups.map(groupDef => {
                    return (
                        <WorkflowGroupComponent
                            key={groupDef.id}
                            groupDefId={groupDef.id}
                            onClickToSelectGroup={props.onClickToSelectGroup}
                            onClickToSelectNode={props.onClickToSelectNode}
                        />
                    );
                })}
            </div>
        </>
    );
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
export const WorkflowLogView = () => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (!ctx.instanceMutator.CanCurrentUserViewInstances()) return <div>Unauthorized to view workflow instance</div>;

    // filter out unhelpful messages
    const filteredLog = ctx.evaluatedFlow.flowInstance.log.filter(l => {
        //if (l.type === WorkflowLogItemType.StatusChanged && l.oldValue === WorkflowNodeProgressState.InvalidState) return false;
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
                    let how = ``;
                    if (m.nodeDefId == null) {
                    } else {
                        const nodeDef = ctx.getNodeDef(m.nodeDefId);
                        if (nodeDef) {
                            if (nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue) {
                                how = `Field '${nodeDef.fieldName || "<undefined>"}' / '${m.fieldName}' from '${m.oldValue}' by user ${m.userId}`;
                            } else if ([WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(nodeDef.completionCriteriaType)) {
                                how = `due to dependencies`;
                            }
                        }
                    }
                    return `[${i}] ${DateToYYYYMMDDHHMMSS(m.at)} ${m.type} from ${m.oldValue} -> ${m.newValue} on node ${m.nodeDefId} ${how}${m.comment !== undefined ? ` [${m.comment}]` : ""}`;
                }).join('\n')} />
            </div>
        </div>
    );
};





/////////////////////////////////////////////////////////////////////////////////////////////

export interface FieldComponentProps<Tunderlying> {
    binding: WFFieldBinding<Tunderlying>,
    readonly?: boolean;
};

export interface WFFieldBinding<Tunderlying> {
    flowDef: WorkflowDef;
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string; // a user-friendly version of the field name.
    value: Tunderlying,
    valueAsString: string; // equality-comparable and db-serializable
    setValue: (val: Tunderlying) => void,
    setOperand2: (val: Tunderlying | Tunderlying[]) => void, // the binding is not only for pure "binding", but defines all interactions with a field including definitions.
    doesFieldValueSatisfyCompletionCriteria: () => boolean;
    FieldValueComponent: React.ComponentType<FieldComponentProps<Tunderlying>>;
    FieldOperand2Component: React.ComponentType<FieldComponentProps<Tunderlying>>;
};

/////////////////////////////////////////////////////////////////////////////////////////////
export const BoolField = (props: FieldComponentProps<boolean | null>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (props.readonly) {
        return props.binding.value ? "Complete" : "Not complete yet";
    }
    return <CMSmallButton onClick={() => {
        props.binding.setValue(!props.binding.value);
    }}>{props.binding.value ? "Mark as not completed" : "Mark completed"}</CMSmallButton>
}

export const BoolOperand = (props: FieldComponentProps<boolean | null>) => {
    return <div>--.-</div>;
};

export const MakeBoolBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string,
    value: boolean | null,
    setValue?: (val: boolean | null) => void,
    setOperand2?: (val: (boolean | null) | (boolean | null)[]) => void,
}
): WFFieldBinding<boolean | null> => {
    return {
        flowDef: args.flowDef,
        fieldNameForDisplay: args.fieldNameForDisplay,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        value: args.value,
        valueAsString: JSON.stringify(args.value),
        setValue: args.setValue || (() => { }),
        setOperand2: args.setOperand2 || (() => { }),
        doesFieldValueSatisfyCompletionCriteria: () => {
            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.IsNull:
                    return args.value == null;
                case WorkflowFieldValueOperator.IsNotNull:
                    return args.value != null;
                case WorkflowFieldValueOperator.Falsy:
                    return !args.value;
                case WorkflowFieldValueOperator.Truthy:
                    return !!args.value;
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return args.value === args.nodeDef.fieldValueOperand2;
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return args.value !== args.nodeDef.fieldValueOperand2;
                case WorkflowFieldValueOperator.EqualsAnyOf:
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return (args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return true;
                    return !(args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.StringPopulated:
                case WorkflowFieldValueOperator.HasOnlyAllowedValues:
                case WorkflowFieldValueOperator.ContainsAllValues:
                    return false;
                default:
                    // be tolerant to out of range
                    console.warn(`unknown boolean field operator ${args.nodeDef.fieldValueOperator}`);
                    return false;
            }
        },
        FieldValueComponent: BoolField,
        FieldOperand2Component: BoolOperand,
    };
};


/////////////////////////////////////////////////////////////////////////////////////////////
export const WFSingleLineTextField = (props: FieldComponentProps<string>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const [open, setOpen] = React.useState<boolean>(false);
    const [value, setValue] = React.useState<string>(props.binding.value);

    React.useEffect(() => {
        setValue(props.binding.value);
    }, [props.binding.value]);

    return <>
        <Button onClick={() => setOpen(true)}>Edit</Button>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <DialogTitle>
                {props.binding.fieldNameForDisplay}
            </DialogTitle>
            <DialogContent dividers>
                <TextField
                    autoFocus
                    size='small'
                    margin='none'
                    value={value}
                    disabled={props.readonly}
                    onChange={(e) => {
                        //props.binding.setValue(e.target.value);
                        setValue(e.target.value);
                    }} />            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                    props.binding.setValue(value);
                    setOpen(false);
                }}>OK</Button>
            </DialogActions>
        </ReactiveInputDialog>}
    </>;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const WFRichTextField = (props: FieldComponentProps<string>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const [open, setOpen] = React.useState<boolean>(false);
    const [value, setValue] = React.useState<string>(props.binding.value);

    React.useEffect(() => {
        setValue(props.binding.value);
    }, [props.binding.value]);

    return <>
        <Button onClick={() => setOpen(true)}>Edit</Button>
        {open && <ReactiveInputDialog onCancel={() => setOpen(false)}>
            <DialogTitle>
                {props.binding.fieldNameForDisplay}
            </DialogTitle>
            <DialogContent dividers>
                <Markdown3Editor
                    autoFocus
                    value={value}
                    readonly={props.readonly}
                    onChange={(v) => {
                        setValue(v);
                    }} />
            </DialogContent>
            <DialogActions>
                <Button onClick={() => setOpen(false)}>Cancel</Button>
                <Button onClick={() => {
                    props.binding.setValue(value);
                    setOpen(false);
                }}>OK</Button>
            </DialogActions>
        </ReactiveInputDialog>}
    </>;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const TextOperand = (props: FieldComponentProps<string>) => {
    const val = CoerceToString(props.binding.nodeDef.fieldValueOperand2);
    return <CMTextField
        autoFocus={false}
        value={val}
        readOnly={props.readonly}
        style={{ width: "auto" }}
        label="Operand 2"
        onChange={(e, v) => props.binding.setOperand2(v)}
    />;
}

export const MakeSingleLineTextBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string,
    value: string,
    setValue?: (val: string) => void,
    setOperand2?: (val: (string) | (string)[]) => void,
}
): WFFieldBinding<string> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        fieldNameForDisplay: args.fieldNameForDisplay,
        value: args.value,
        valueAsString: JSON.stringify(args.value),
        setValue: args.setValue || (() => { }),
        setOperand2: args.setOperand2 || (() => { }),
        doesFieldValueSatisfyCompletionCriteria: () => {
            const isNull = () => IsNullOrWhitespace(args.value);
            const eq = () => args.value.trim().toLowerCase() === ((args.nodeDef.fieldValueOperand2 as string) || "").trim().toLowerCase();
            if (!args.nodeDef.fieldValueOperator) {
                return false;
            }

            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Falsy:
                case WorkflowFieldValueOperator.IsNull:
                    return isNull();
                case WorkflowFieldValueOperator.Truthy:
                case WorkflowFieldValueOperator.StringPopulated:
                case WorkflowFieldValueOperator.IsNotNull:
                    return !isNull();
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return eq();
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return !eq();
                case WorkflowFieldValueOperator.EqualsAnyOf:
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return (args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return true;
                    return !(args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.HasOnlyAllowedValues:
                case WorkflowFieldValueOperator.ContainsAllValues:
                    return false;
                default:
                    console.warn(`unknown text field operator ${args.nodeDef.fieldValueOperator}`);
                    return false;
            }
        },
        FieldValueComponent: WFSingleLineTextField,
        FieldOperand2Component: TextOperand,
    };
};

/////////////////////////////////////////////////////////////////////////////////////////////


export const MakeRichTextBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    fieldNameForDisplay: string,
    value: string,
    setValue?: (val: string) => void,
    setOperand2?: (val: (string) | (string)[]) => void,
}
): WFFieldBinding<string> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        fieldNameForDisplay: args.fieldNameForDisplay,
        value: args.value,
        valueAsString: JSON.stringify(args.value),
        setValue: args.setValue || (() => { }),
        setOperand2: args.setOperand2 || (() => { }),
        doesFieldValueSatisfyCompletionCriteria: () => {
            const isNull = () => IsNullOrWhitespace(args.value);
            const eq = () => args.value.trim().toLowerCase() === ((args.nodeDef.fieldValueOperand2 as string) || "").trim().toLowerCase();
            if (!args.nodeDef.fieldValueOperator) {
                return false;
            }

            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Falsy:
                case WorkflowFieldValueOperator.IsNull:
                    return isNull();
                case WorkflowFieldValueOperator.Truthy:
                case WorkflowFieldValueOperator.StringPopulated:
                case WorkflowFieldValueOperator.IsNotNull:
                    return !isNull();
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return eq();
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return !eq();
                case WorkflowFieldValueOperator.EqualsAnyOf:
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return (args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    if (!Array.isArray(args.nodeDef.fieldValueOperand2)) return true;
                    return !(args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.HasOnlyAllowedValues:
                case WorkflowFieldValueOperator.ContainsAllValues:
                    return false;
                default:
                    console.warn(`unknown text field operator ${args.nodeDef.fieldValueOperator}`);
                    return false;
            }
        },
        FieldValueComponent: WFRichTextField,
        FieldOperand2Component: TextOperand,
    };
};



/////////////////////////////////////////////////////////////////////////////////////////////
// binds to a field that always satisfies completion criteria.
// does not support setting values (readonly binding)
export const MakeAlwaysBinding = <T,>(args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    fieldNameForDisplay: string,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    value: T;
}
): WFFieldBinding<T> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        fieldNameForDisplay: args.fieldNameForDisplay,
        value: args.value,
        valueAsString: JSON.stringify(args.value),
        setValue: () => { },
        setOperand2: () => { },
        doesFieldValueSatisfyCompletionCriteria: () => {
            return false;
        },
        FieldValueComponent: () => <div>(always value)</div>,
        FieldOperand2Component: () => <div>(always operand2)</div>,
    };
};

