// workflow client code specific to CMDB events

import { Button, Checkbox } from "@mui/material";
import { ReactFlowProvider } from "@xyflow/react";
import * as React from 'react';
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { CoalesceBool } from "shared/utils";
import * as db3 from "src/core/db3/db3";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { AdminContainer, InspectObject } from "./CMCoreComponents";
import { NameValuePair } from "./CMCoreComponents2";
import { CMTextField } from "./CMTextField";
import { ColorPick } from "./Color";
import { DashboardContextData, useDashboardContext } from "./DashboardContext";
import { Markdown3Editor } from "./MarkdownControl3";

import { EvaluatedWorkflow, EvaluateWorkflow, WorkflowDef, WorkflowInitializeInstance, WorkflowInstance, WorkflowInstanceMutator, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { WorkflowEditorPOC, WorkflowReactFlowEditor } from "./WorkflowEditorGraph";
import { EvaluatedWorkflowContext, EvaluatedWorkflowProvider, MakeAlwaysBinding, MakeBoolBinding, MakeTextBinding, WFFieldBinding, WorkflowRenderer } from "./WorkflowUserComponents";


// name: new DB3Client.GenericStringColumnClient({ columnName: "name", cellWidth: 150, fieldCaption: "Event name", className: "titleText" }),
// dateRange: new DB3Client.EventDateRangeColumn({ startsAtColumnName: "startsAt", headerName: "Date range", durationMillisColumnName: "durationMillis", isAllDayColumnName: "isAllDay" }),
// description: new DB3Client.MarkdownStringColumnClient({ columnName: "description", cellWidth: 150 }),
// locationDescription: new DB3Client.GenericStringColumnClient({ columnName: "locationDescription", cellWidth: 150, fieldCaption: "Location" }),
// type: new DB3Client.ForeignSingleFieldClient<db3.EventTypePayload>({ columnName: "type", cellWidth: 150, selectStyle: "inline", fieldCaption: "Event Type" }),
// status: new DB3Client.ForeignSingleFieldClient<db3.EventStatusPayload>({ columnName: "status", cellWidth: 150, fieldCaption: "Status" }),
// expectedAttendanceUserTag: new DB3Client.ForeignSingleFieldClient<db3.UserTagPayload>({ columnName: "expectedAttendanceUserTag", cellWidth: 150, fieldCaption: "Who's invited?" }),
// tags: new DB3Client.TagsFieldClient<db3.EventTagAssignmentPayload>({ columnName: "tags", cellWidth: 150, allowDeleteFromCell: false, fieldCaption: "Tags" }),

// frontpageVisible: new DB3Client.BoolColumnClient({ columnName: "frontpageVisible" }),
// frontpageDate: new DB3Client.GenericStringColumnClient({ columnName: "frontpageDate", cellWidth: 150 }),
// frontpageTime: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTime", cellWidth: 150 }),
// frontpageDetails: new DB3Client.MarkdownStringColumnClient({ columnName: "frontpageDetails", cellWidth: 150 }),

// frontpageTitle: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTitle", cellWidth: 150 }),
// frontpageLocation: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocation", cellWidth: 150 }),
// frontpageLocationURI: new DB3Client.GenericStringColumnClient({ columnName: "frontpageLocationURI", cellWidth: 150 }),
// frontpageTags: new DB3Client.GenericStringColumnClient({ columnName: "frontpageTags", cellWidth: 150 }),

// ... custom event fields

// hmm. for the workflow,
// we'll need bindings for tags and foreignsingles
// and date?
// 


interface MockEvent {
    name: string;
    description: string | null;
    locationDescription: string | null;
    typeId: number;
    statusId: number;
    expectedAttendanceUserTagId: number;
    frontpageVisible: boolean;
};

// include custom fields
type MockEventModel = MockEvent & Record<string, any>;

const MakeEmptyModel = (dashboardContext: DashboardContextData): MockEventModel => {
    const ret: MockEventModel = {
        name: `(empty model)`,
        description: null,
        frontpageVisible: false,
        locationDescription: null,
        expectedAttendanceUserTagId: dashboardContext.userTag.items[0]!.id,
        typeId: dashboardContext.eventType.items[0]!.id,
        statusId: dashboardContext.eventStatus.items[0]!.id,
    };
    for (const f of dashboardContext.eventCustomField.items) {
        ret[f.name] = null; // todo: default values for custom fields?
    }
    return ret;
};

export function getMockEventBinding(args: {
    dashboardContext: DashboardContextData,
    model: MockEvent,
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    setModel?: (newModel: MockEvent) => void,
    setOperand2?: (newOperand: unknown) => void,
}): WFFieldBinding<unknown> {

    // do custom fields first
    const cf = args.dashboardContext.eventCustomField.find(x => x.name === args.nodeDef.fieldName);
    if (cf) {
        switch (cf.dataType as db3.EventCustomFieldDataType) {
            case db3.EventCustomFieldDataType.Checkbox:
                return MakeBoolBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    setOperand2: args.setOperand2,
                    value: args.model[cf.name],
                    setValue: (val) => {
                        const newModel = { ...args.model };
                        newModel[cf.name] = CoalesceBool(val, false); // TODO: default value? or allow null or ..sometihng?
                        args.setModel && args.setModel(newModel);
                    },
                });
            case db3.EventCustomFieldDataType.RichText:
            case db3.EventCustomFieldDataType.SimpleText:
                return MakeTextBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    setOperand2: args.setOperand2,
                    value: args.model[cf.name] || "",
                    setValue: (val) => {
                        const newModel = { ...args.model };
                        newModel[cf.name] = val;
                        args.setModel && args.setModel(newModel);
                    },
                });
            case db3.EventCustomFieldDataType.Options:
                console.log(`todo: handle case db3.EventCustomFieldDataType.Options`);
                // TODO
                break;
        }
    }

    const field = args.nodeDef.fieldName as keyof MockEvent;
    switch (field) {
        case "description":
        case "locationDescription":
        case "name":
            return MakeTextBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                setOperand2: args.setOperand2,
                value: args.model[field] || "",
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel[field] = val;
                    args.setModel && args.setModel(newModel);
                },
            });
        case "frontpageVisible": // defaults to false
            return MakeBoolBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel[field] = CoalesceBool(val, false);
                    args.setModel && args.setModel(newModel);
                },
            });
        case null: // new fields or changing schemas or whatever need to be tolerant.
        case undefined:
            return MakeAlwaysBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                value: false,
            });
        default:
            console.log(`Unknown field name ${field}`);
            return MakeAlwaysBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                value: false,
            });
        // default:
        //     assertUnreachable(field, `unknown field '${field}'`);
    }
    //         return MakeAlwaysBinding({
    //             tidiedNodeInstance: args.tidiedNodeInstance,
    //             flowDef: args.flowDef,
    //             nodeDef: args.nodeDef,
    //             value: false,
    //         });
};






/////////////////////////////////////////////////////////////////////////////////////////////
const WorkflowDefRootDataEditor = () => {
    const ctx = React.useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`WorkflowDefRootDataEditor: Workflow context is required`);
    const [open, setOpen] = React.useState<boolean>(false);

    const readonly = !ctx.instanceMutator.CanCurrentUserEditDefs();

    return <div className="WorkflowDefRootDataEditorGroup">
        <div className="header interactable" onClick={() => setOpen(!open)}>{open ? gCharMap.DownArrow() : gCharMap.UpArrow()} Workflow definition: {ctx.flowDef.name}</div>
        {open && <div className="content">
            <NameValuePair
                name="Name"
                isReadOnly={readonly}
                value={<CMTextField
                    autoFocus={false}
                    value={ctx.flowDef.name}
                    onChange={(e, val) => {
                        ctx.chainDefMutations([
                            { fn: (sourceDef) => ctx.flowDefMutator.setWorkflowDefName({ sourceDef, name: val }), wantsReevaluation: false },
                        ], "changing def name");
                    }}
                />}
            />
            <NameValuePair
                name="Description"
                value={
                    <Markdown3Editor
                        value={ctx.flowDef.description || ""}
                        minHeight={200}
                        onChange={(val) => {
                            ctx.chainDefMutations([
                                { fn: (sourceDef) => ctx.flowDefMutator.setWorkflowDefDescription({ sourceDef, description: val }), wantsReevaluation: false },
                            ], "changing def description");
                        }}
                    />
                }
            />
            <NameValuePair
                name="Is default for events?"
                value={
                    <Checkbox
                        checked={ctx.flowDef.isDefaultForEvents}
                        readOnly={readonly}
                        onChange={(e) => {
                            ctx.chainDefMutations([
                                { fn: (sourceDef) => ctx.flowDefMutator.setWorkflowDefIsDefaultForEvents({ sourceDef, isDefaultForEvents: e.target.checked }), wantsReevaluation: false },
                            ], "changing def isDefaultForEvents");
                        }}
                    />
                }
            />
            <NameValuePair
                name="Color"
                value={
                    <ColorPick
                        allowNull={true}
                        readonly={readonly}
                        palettes={gGeneralPaletteList}
                        value={ctx.flowDef.color}
                        onChange={(val) => {
                            ctx.chainDefMutations([
                                { fn: (sourceDef) => ctx.flowDefMutator.setWorkflowDefColor({ sourceDef, color: (val?.id || null) }), wantsReevaluation: false },
                            ], "changing def Color");
                        }}
                    />
                }
            />
        </div>}
    </div>;
};



/////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowEditorForEventProps {
    initialValue: WorkflowDef;
    readonly: boolean;
    onSave: (val: WorkflowDef) => Promise<void>;
    onDelete: (val: WorkflowDef) => Promise<void>;
    onCancel: (val: WorkflowDef) => void;
};
export const WorkflowEditorForEvent = (props: WorkflowEditorForEventProps) => {
    const dashboardCtx = useDashboardContext();
    // The workflow definition is what you expect. Describes the mechanics and layout of the workflow, which can then be instantiated and used.
    const [workflowDef, setWorkflowDef] = React.useState<WorkflowDef>(props.initialValue);
    const [isSaving, setIsSaving] = React.useState<boolean>(false);

    // The workflow instance is an instantiation of a workflow definition. It basically holds live state which is persisted, like assignees, comments, which is per instance rather than per definition.
    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
        return WorkflowInitializeInstance(workflowDef);
    });

    const [defHasChanges, setDefHasChanges] = React.useState<boolean>(false);

    const [evaluationTrigger, setEvaluationTrigger] = React.useState<number>(0);
    const [evaluationReason, setEvaluationReason] = React.useState<string>("");

    React.useEffect(() => {
        setWorkflowDef(props.initialValue);
        setDefHasChanges(false);
        setEvaluationReason("Initial value changed");
        setEvaluationTrigger(evaluationTrigger + 1);
    },
        [props.initialValue]
    );

    // The model is the external data source that the workflow engine can use to determine completeness of tasks.
    const [model, setModel] = React.useState<MockEventModel>(() => MakeEmptyModel(dashboardCtx));

    const setOperand2 = (nodeDefId: number, newOperand: unknown) => {
        const nd = workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
        nd.fieldValueOperand2 = newOperand;
        setWorkflowDef({ ...workflowDef });
        setWorkflowInstance({ ...workflowInstance }); // trigger re-eval
    };

    const instanceMutator: WorkflowInstanceMutator = {
        CanCurrentUserViewInstances: () => dashboardCtx.isAuthorized(Permission.view_workflow_instances),
        CanCurrentUserEditInstances: () => dashboardCtx.isAuthorized(Permission.edit_workflow_instances),
        CanCurrentUserViewDefs: () => dashboardCtx.isAuthorized(Permission.view_workflow_defs),
        CanCurrentUserEditDefs: () => dashboardCtx.isAuthorized(Permission.edit_workflow_defs),

        DoesFieldValueSatisfyCompletionCriteria: ({ flowDef, nodeDef, tidiedNodeInstance, assignee }): boolean => {
            const binding = getMockEventBinding({
                dashboardContext: dashboardCtx,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance,
                setModel: (newModel) => {
                    setModel(newModel);
                    setWorkflowInstance({ ...workflowInstance }); // trigger re-eval
                },
                setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.doesFieldValueSatisfyCompletionCriteria();
        },
        GetModelFieldNames: (args) => {
            return Object.keys(MakeEmptyModel(dashboardCtx));
        },
        // result should be equality-comparable and database-serializable
        GetFieldValueAsString: ({ flowDef, nodeDef, node }) => {
            const binding = getMockEventBinding({
                dashboardContext: dashboardCtx,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: node,
            });
            return binding.valueAsString;
        },
        ResetModelAndInstance: () => {
            setModel(MakeEmptyModel(dashboardCtx));
            setWorkflowInstance(WorkflowInitializeInstance(workflowDef));
            setEvaluationReason("ResetModelAndInstance");
            setEvaluationTrigger(evaluationTrigger + 1);
        },
        SetAssigneesForNode: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }

            ni.assignees = JSON.parse(JSON.stringify(args.assignees));
            return args.sourceWorkflowInstance;
        },
        SetHasBeenEvaluated: args => {
            if (args.sourceWorkflowInstance.hasBeenEvaluated) return undefined;
            args.sourceWorkflowInstance.hasBeenEvaluated = true;
            return args.sourceWorkflowInstance;
        },
        SetDueDateForNode: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }

            if (ni.dueDate === args.dueDate) return undefined;
            ni.dueDate = args.dueDate;
            return args.sourceWorkflowInstance;
        },
        AddLogItem: (args) => {
            args.sourceWorkflowInstance.log.push({ ...args.msg, userId: dashboardCtx.currentUser?.id || undefined });
            return args.sourceWorkflowInstance;
        },
        SetNodeStatusData: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }
            ni.activeStateFirstTriggeredAt = args.activeStateFirstTriggeredAt;
            //ni.dueDate = args.dueDate;
            ni.lastProgressState = args.lastProgressState;
            return args.sourceWorkflowInstance;
        },
        SetLastFieldValue: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }
            ni.lastFieldName = args.fieldName;
            ni.lastFieldValueAsString = args.fieldValueAsString;
            return args.sourceWorkflowInstance;
        },
        SetLastAssignees: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }
            ni.lastAssignees = args.value;
            return args.sourceWorkflowInstance;
        },
        onWorkflowInstanceMutationChainComplete: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => {
            setWorkflowInstance(newInstance);
            if (reEvaluationNeeded) {
                setEvaluationReason("instance mutator requested");
                setEvaluationTrigger(evaluationTrigger + 1);
            }
        },
    };

    // re-evaluate when requested
    React.useEffect(() => {
        // workflowInstance.log.push({
        //     type: WorkflowLogItemType.Comment,
        //     at: new Date(),
        //     comment: "Evaluating due to React.useEffect[evaluationTrigger]",
        // });

        const x = EvaluateWorkflow(workflowDef, workflowInstance, instanceMutator, `onWorkflowDefMutationChainComplete with reason: [${evaluationReason}]`);
        setEvaluatedInstance(x);
    }, [evaluationTrigger]);

    const renderer: WorkflowRenderer = {
        RenderFieldValueForNode: ({ flowDef, nodeDef, evaluatedNode, readonly }) => {
            const binding = getMockEventBinding({
                dashboardContext: dashboardCtx,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModel: (value) => {
                    setModel(value);
                    setWorkflowInstance({ ...workflowInstance }); // trigger reeval when the model changes. important lel

                    setEvaluationReason("model changed");
                    setEvaluationTrigger(evaluationTrigger + 1);
                },
                setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.FieldValueComponent({ binding, readonly });
        },
        RenderEditorForFieldOperand2: ({ flowDef, nodeDef, evaluatedNode, setValue, readonly }) => {
            const binding = getMockEventBinding({
                dashboardContext: dashboardCtx,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModel: (value) => {
                    throw new Error(`should not be called from here.`);
                },
                setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.FieldOperand2Component({ binding, readonly });
        }
    };

    const [evaluatedInstance, setEvaluatedInstance] = React.useState<EvaluatedWorkflow>(() => {
        // workflowInstance.log.push({
        //     type: WorkflowLogItemType.Comment,
        //     at: new Date(),
        //     comment: "initial setup in React.useState<EvaluatedWorkflow>",
        // });
        return EvaluateWorkflow(workflowDef, workflowInstance, instanceMutator, "initial setup in React.useState<EvaluatedWorkflow>");
    });

    const isExisting = workflowDef.id > 0;

    return <div className="WorkflowEditorForEvent">
        <AdminContainer>
            <InspectObject src={workflowDef} label="FlowDef" />
            +
            <InspectObject src={model} label="Model" />
            +
            <InspectObject src={workflowInstance} label="Instance" />
            =
            <InspectObject src={evaluatedInstance} label="Evaluated" />
            {/* <input id="canViewInstances" type="checkbox" onChange={(e) => setCanViewInstances(e.target.checked)} checked={canViewInstances} />
            <label htmlFor="canViewInstances">Can view instances</label>
            <input id="canEditInstances" type="checkbox" onChange={(e) => setCanEditInstances(e.target.checked)} checked={canEditInstances} />
            <label htmlFor="canEditInstances">Can edit instances</label>
            <input id="canViewDefs" type="checkbox" onChange={(e) => setCanViewDefs(e.target.checked)} checked={canViewDefs} />
            <label htmlFor="canViewDefs">Can view defs</label>
            <input id="canEditDefs" type="checkbox" onChange={(e) => setCanEditDefs(e.target.checked)} checked={canEditDefs} />
            <label htmlFor="canEditDefs">Can edit defs</label> */}
        </AdminContainer>
        <div>
            <Button
                onClick={async () => {
                    setIsSaving(true);
                    await props.onSave(workflowDef);
                    setIsSaving(false);
                }}
                disabled={!defHasChanges || isSaving || props.readonly}
            >
                {gIconMap.Save()} Save
            </Button>
            <Button
                onClick={async () => {
                    await props.onDelete(workflowDef)
                }}
                disabled={!isExisting || isSaving || props.readonly}
            >
                {gIconMap.Delete()} Delete
            </Button>
            <Button
                onClick={() => {
                    props.onCancel(workflowDef)
                }}
                disabled={isSaving || props.readonly}
            >
                {gIconMap.Cancel()} Cancel
            </Button>
        </div>
        <EvaluatedWorkflowProvider
            flowDef={workflowDef}
            flowInstance={workflowInstance}
            evaluatedFlow={evaluatedInstance}
            instanceMutator={instanceMutator}
            renderer={renderer}
            onWorkflowDefMutationChainComplete={(newFlowDef: WorkflowDef, reEvalRequested: boolean, reason: string) => {
                setWorkflowDef(newFlowDef);
                setDefHasChanges(true);
                if (reEvalRequested) {
                    // can't evaluate right now because state is immutable and eval depends on things that have just changed.
                    setEvaluationReason(reason);
                    setEvaluationTrigger(evaluationTrigger + 1);
                }
            }}
        >
            <WorkflowDefRootDataEditor />
            <WorkflowEditorPOC />
        </EvaluatedWorkflowProvider>
    </div>;
};




export const WorkflowViewer = (props: { value: WorkflowDef }) => {
    const dashboardCtx = useDashboardContext();

    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
        return WorkflowInitializeInstance(props.value);
    });

    const instanceMutator: WorkflowInstanceMutator = {
        CanCurrentUserViewInstances: () => dashboardCtx.isAuthorized(Permission.view_workflow_instances),
        CanCurrentUserEditInstances: () => dashboardCtx.isAuthorized(Permission.edit_workflow_instances),
        CanCurrentUserViewDefs: () => dashboardCtx.isAuthorized(Permission.view_workflow_defs),
        CanCurrentUserEditDefs: () => dashboardCtx.isAuthorized(Permission.edit_workflow_defs),

        DoesFieldValueSatisfyCompletionCriteria: ({ flowDef, nodeDef, tidiedNodeInstance, assignee }): boolean => false,
        GetModelFieldNames: (args) => [],
        GetFieldValueAsString: ({ flowDef, nodeDef, node }) => "",
        ResetModelAndInstance: () => { },
        SetAssigneesForNode: (args) => undefined,
        SetHasBeenEvaluated: args => undefined,
        SetDueDateForNode: (args) => undefined,
        AddLogItem: (args) => undefined,
        SetNodeStatusData: (args) => undefined,
        SetLastFieldValue: (args) => undefined,
        SetLastAssignees: (args) => undefined,
        onWorkflowInstanceMutationChainComplete: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => { },
    };

    const [evaluatedInstance, setEvaluatedInstance] = React.useState<EvaluatedWorkflow>(() => {
        return EvaluateWorkflow(props.value, workflowInstance, instanceMutator, "initial setup in React.useState<EvaluatedWorkflow>");
    });

    const renderer: WorkflowRenderer = {
        RenderFieldValueForNode: ({ flowDef, nodeDef, evaluatedNode, readonly }) => null,
        RenderEditorForFieldOperand2: ({ flowDef, nodeDef, evaluatedNode, setValue, readonly }) => null,
    };

    return <EvaluatedWorkflowProvider
        flowDef={props.value}
        flowInstance={workflowInstance}
        evaluatedFlow={evaluatedInstance}
        instanceMutator={instanceMutator}
        renderer={renderer}
        onWorkflowDefMutationChainComplete={(newFlowDef: WorkflowDef, reEvalRequested: boolean, reason: string) => {
        }}
    >
        <ReactFlowProvider>
            <WorkflowReactFlowEditor readonly={true} />
        </ReactFlowProvider>

    </EvaluatedWorkflowProvider>

};