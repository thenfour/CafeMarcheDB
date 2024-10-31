// workflow client code specific to CMDB events

import { Button, Checkbox } from "@mui/material";
import { ReactFlowProvider } from "@xyflow/react";
import * as React from 'react';
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { arraysContainSameValues, CoalesceBool, getUniqueNegativeID, IsNullOrWhitespace, sleep } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { Prisma } from "db";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { AdminContainer, AdminInspectObject, InspectObject } from "./CMCoreComponents";
import { NameValuePair } from "./CMCoreComponents2";
import { CMTextField } from "./CMTextField";
import { ColorPick } from "./Color";
import { DashboardContextData, useDashboardContext } from "./DashboardContext";
import { Markdown3Editor } from "./MarkdownControl3";

import { EvaluatedWorkflow, EvaluateWorkflow, mapWorkflowDef, MutationArgsToWorkflowInstance, WorkflowDef, WorkflowInitializeInstance, WorkflowInstance, WorkflowInstanceMutator, WorkflowInstanceToMutationArgs, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import UnsavedChangesHandler from "./UnsavedChangesHandler";
import { WorkflowEditorPOC, WorkflowReactFlowEditor } from "./WorkflowEditorGraph";
import { EvaluatedWorkflowContext, EvaluatedWorkflowProvider, MakeAlwaysBinding, MakeBoolBinding, MakeRichTextBinding, MakeSingleLineTextBinding, WFFieldBinding, WorkflowContainer, WorkflowLogView, WorkflowRenderer } from "./WorkflowUserComponents";
import { useMutation, useQuery } from "@blitzjs/rpc";
import insertOrUpdateEventWorkflowInstance from "../db3/mutations/insertOrUpdateEventWorkflowInstance";
import { useSnackbar } from "./SnackbarContext";
import getWorkflowDefAndInstanceForEvent from "../db3/queries/getWorkflowDefAndInstanceForEvent";
import { DB3ForeignSingleBindingValueComponent, EventTypeBindingOperand2Component, MakeDB3ForeignSingleBinding } from "./WorkflowDB3ForeignSingleBinding";

interface MockEvent {
    name: string;
    description: string | null;
    locationDescription: string | null;
    typeId: number | null;
    statusId: number | null;
    expectedAttendanceUserTagId: number | null;
    frontpageVisible: boolean;
    tagIds: number[];
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
        tagIds: [],
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
                    fieldNameForDisplay: cf.name,
                    value: args.model[cf.name],
                    setValue: (val) => {
                        const newModel = { ...args.model };
                        newModel[cf.name] = CoalesceBool(val, false); // TODO: default value? or allow null or ..sometihng?
                        args.setModel && args.setModel(newModel);
                    },
                });
            case db3.EventCustomFieldDataType.RichText:
                return MakeRichTextBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    fieldNameForDisplay: cf.name,
                    value: args.model[cf.name] || "",
                    setOperand2: args.setOperand2,
                    setValue: (val) => {
                        const newModel = { ...args.model };
                        newModel[cf.name] = val;
                        args.setModel && args.setModel(newModel);
                    },
                });
            case db3.EventCustomFieldDataType.SimpleText:
                return MakeSingleLineTextBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    fieldNameForDisplay: cf.name,
                    value: args.model[cf.name] || "",
                    setValue: (val) => {
                        const newModel = { ...args.model };
                        newModel[cf.name] = val;
                        args.setModel && args.setModel(newModel);
                    },
                });
            case db3.EventCustomFieldDataType.Options:
                console.log(`todo: handle case db3.EventCustomFieldDataType.Options`);
                return MakeAlwaysBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    fieldNameForDisplay: cf.name,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    value: false,
                });
        }
    }

    const field = args.nodeDef.fieldName as keyof MockEvent;
    switch (field) {
        case "description":
            return MakeRichTextBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                value: args.model[field] || "",
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel[field] = val;
                    args.setModel && args.setModel(newModel);
                },
            });
        case "locationDescription":
        case "name":
            return MakeSingleLineTextBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                //setOperand2: args.setOperand2,
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
                fieldNameForDisplay: field,
                //setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel[field] = CoalesceBool(val, false);
                    args.setModel && args.setModel(newModel);
                },
            });
        case "typeId":
            return MakeDB3ForeignSingleBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel[field] = val || null;
                    args.setModel && args.setModel(newModel);
                },
                FieldValueComponent: (props) => <DB3ForeignSingleBindingValueComponent {...props} />,
                FieldOperand2Component: (props) => <EventTypeBindingOperand2Component {...props} />,
            });
        case "expectedAttendanceUserTagId":
        case "statusId":
        case "tagIds":
        // return MakeDB3TagsBinding({
        //     tidiedNodeInstance: args.tidiedNodeInstance,
        //     flowDef: args.flowDef,
        //     nodeDef: args.nodeDef,
        //     fieldNameForDisplay: field,
        //     //setOperand2: args.setOperand2,
        //     value: args.model[field],
        //     setValue: (val) => {
        //         const newModel = { ...args.model };
        //         newModel[field] = CoalesceBool(val, false);
        //         args.setModel && args.setModel(newModel);
        //     },

        // });
        case null: // new fields or changing schemas or whatever need to be tolerant.
        case undefined:
            return MakeAlwaysBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                fieldNameForDisplay: field,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                value: false,
            });
        default:
            console.log(`Unknown field name ${field}`);
            return MakeAlwaysBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                fieldNameForDisplay: field,
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


interface MakeInstanceMutatorArgs {
    dashboardContext: DashboardContextData;
    workflowDef: WorkflowDef;
    model: MockEventModel;
    setModel: (m: MockEventModel) => void;
    instance: WorkflowInstance;
    setInstance: (x: WorkflowInstance) => void;
    evaluationTrigger: number;
    setEvaluationTrigger: (x: number) => void;
    setEvaluationReason: (x: string) => void;
};

function MakeInstanceMutatorAndRenderer({
    dashboardContext,
    workflowDef,
    model,
    setModel,
    instance,
    setInstance,
    evaluationTrigger,
    setEvaluationTrigger,
    setEvaluationReason,
}: MakeInstanceMutatorArgs): [WorkflowInstanceMutator, WorkflowRenderer] {

    // const setOperand2 = (nodeDefId: number, newOperand: unknown) => {
    //     const nd = workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    //     nd.fieldValueOperand2 = newOperand;
    //     setWorkflowDef({ ...workflowDef });
    //     setInstance({ ...instance }); // trigger re-eval
    // };

    const instanceMutator: WorkflowInstanceMutator = {
        CanCurrentUserViewInstances: () => dashboardContext.isAuthorized(Permission.view_workflow_instances),
        CanCurrentUserEditInstances: () => dashboardContext.isAuthorized(Permission.edit_workflow_instances),
        CanCurrentUserViewDefs: () => dashboardContext.isAuthorized(Permission.view_workflow_defs),
        CanCurrentUserEditDefs: () => dashboardContext.isAuthorized(Permission.edit_workflow_defs),

        DoesFieldValueSatisfyCompletionCriteria: ({ flowDef, nodeDef, tidiedNodeInstance, assignee }): boolean => {
            const binding = getMockEventBinding({
                dashboardContext: dashboardContext,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance,
                setModel: (newModel) => {
                    setModel(newModel);
                    setInstance({ ...instance }); // trigger re-eval
                },
                //setOperand2: (n) => { throw new Error("unsupported setOperand2") },
                //setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.doesFieldValueSatisfyCompletionCriteria();
        },
        GetModelFieldNames: (args) => {
            return Object.keys(MakeEmptyModel(dashboardContext));
        },
        // result should be equality-comparable and database-serializable
        GetFieldValueAsString: ({ flowDef, nodeDef, node }) => {
            const binding = getMockEventBinding({
                dashboardContext: dashboardContext,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: node,
            });
            return binding.valueAsString;
        },
        ResetModelAndInstance: () => {
            setModel(MakeEmptyModel(dashboardContext));
            setInstance(WorkflowInitializeInstance(workflowDef));
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

            if (arraysContainSameValues(ni.assignees.map(a => a.userId), args.assignees.map(a => a.userId))) return undefined;

            ni.assignees = JSON.parse(JSON.stringify(args.assignees));
            console.log(`instance mutator: setting assignees`);
            return args.sourceWorkflowInstance;
        },
        SetLastAssignees: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }

            if (arraysContainSameValues(ni.lastAssignees.map(a => a.userId), args.value.map(a => a.userId))) return undefined;
            console.log(`instance mutator: setting last assignees`);

            ni.lastAssignees = args.value.map(x => (
                {
                    id: getUniqueNegativeID(),
                    userId: x.userId,
                }
            ));

            return args.sourceWorkflowInstance;
        },
        SetLastEvaluatedWorkflowDefId: args => {
            if (args.sourceWorkflowInstance.lastEvaluatedWorkflowDefId === args.workflowDefId) return undefined;
            args.sourceWorkflowInstance.lastEvaluatedWorkflowDefId = args.workflowDefId;
            console.log(`instance mutator: setting last evaluated workflow def id`);
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
            console.log(`instance mutator: setting due date`);
            ni.dueDate = args.dueDate;
            return args.sourceWorkflowInstance;
        },
        AddLogItem: (args) => {
            return undefined; // TODO: support activity logging for instances. right now it's too complex to track state
            // args.sourceWorkflowInstance.log.push({ ...args.msg, userId: dashboardContext.currentUser?.id || undefined });
            // return args.sourceWorkflowInstance;
        },
        SetNodeStatusData: (args) => {
            let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
            if (!ni) {
                // evaluated nodes are instances, so this works and adds unused fields
                ni = { ...args.evaluatedNode };
                args.sourceWorkflowInstance.nodeInstances.push(ni);
            }

            const diffs = [
                ni.activeStateFirstTriggeredAt === args.activeStateFirstTriggeredAt,
                ni.lastProgressState === args.lastProgressState,
            ];
            if (!diffs.includes(false)) return undefined;
            console.log(`instance mutator: node=${ni.nodeDefId} SetNodeStatusData ${ni.lastProgressState} => ${args.lastProgressState}`);

            ni.activeStateFirstTriggeredAt = args.activeStateFirstTriggeredAt;
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

            const diffs = [
                ni.lastFieldName === args.fieldName,
                ni.lastFieldValueAsString === args.fieldValueAsString,
            ];
            if (!diffs.includes(false)) return undefined;
            console.log(`instance mutator: SetLastFieldValue node=${ni.nodeDefId} ${ni.lastFieldName} => ${args.fieldName} && ${ni.lastFieldValueAsString} => ${args.fieldValueAsString}`);

            ni.lastFieldName = args.fieldName;
            ni.lastFieldValueAsString = args.fieldValueAsString;
            return args.sourceWorkflowInstance;
        },
        onWorkflowInstanceMutationChainComplete: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => {
            console.log("instance mutator: onWorkflowInstanceMutationChainComplete");
            setInstance(newInstance);
            if (reEvaluationNeeded) {
                setEvaluationReason("instance mutator requested");
                setEvaluationTrigger(evaluationTrigger + 1);
            }
        },
    };

    // // re-evaluate when requested
    // React.useEffect(() => {
    //     // workflowInstance.log.push({
    //     //     type: WorkflowLogItemType.Comment,
    //     //     at: new Date(),
    //     //     comment: "Evaluating due to React.useEffect[evaluationTrigger]",
    //     // });

    //     const x = EvaluateWorkflow(workflowDef, workflowInstance, instanceMutator, `onWorkflowDefMutationChainComplete with reason: [${evaluationReason}]`);
    //     setEvaluatedInstance(x);
    // }, [evaluationTrigger]);

    const renderer: WorkflowRenderer = {
        RenderFieldValueForNode: ({ flowDef, nodeDef, evaluatedNode, readonly }) => {
            const binding = getMockEventBinding({
                dashboardContext,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModel: (value) => {
                    setModel(value);
                    setInstance({ ...instance }); // trigger reeval when the model changes. important lel

                    setEvaluationReason("model changed");
                    setEvaluationTrigger(evaluationTrigger + 1);
                },
                //setOperand2: (n) => { throw new Error("unsupported setOperand2") },
                //setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return <binding.FieldValueComponent binding={binding} readonly={readonly} />;
        },
        RenderEditorForFieldOperand2: ({ flowDef, nodeDef, evaluatedNode, setValue, readonly }) => {
            const binding = getMockEventBinding({
                dashboardContext,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModel: (value) => {
                    throw new Error(`should not be called from here.`);
                },
                //setOperand2: (n) => { throw new Error("unsupported setOperand2") },
                //setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return <binding.FieldOperand2Component binding={binding} readonly={readonly} />;
        }
    };

    return [instanceMutator, renderer];
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
    const dashboardContext = useDashboardContext();
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

    //useBeforeUnload(true, 'You have unsaved changes. Are you sure you want to leave?');
    //useBeforeUnload(true);

    // The model is the external data source that the workflow engine can use to determine completeness of tasks.
    const [model, setModel] = React.useState<MockEventModel>(() => MakeEmptyModel(dashboardContext));

    // const setOperand2 = (nodeDefId: number, newOperand: unknown) => {
    //     const nd = workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    //     nd.fieldValueOperand2 = newOperand;
    //     setWorkflowDef({ ...workflowDef });
    //     setWorkflowInstance({ ...workflowInstance }); // trigger re-eval
    // };

    const [instanceMutator, renderer] = MakeInstanceMutatorAndRenderer({
        model,
        dashboardContext,
        evaluationTrigger,
        instance: workflowInstance,
        setInstance: setWorkflowInstance,
        setEvaluationReason,
        setEvaluationTrigger,
        setModel,
        workflowDef,
    });

    // re-evaluate when requested
    React.useEffect(() => {
        const x = EvaluateWorkflow(workflowDef, workflowInstance, instanceMutator, `onWorkflowDefMutationChainComplete with reason: [${evaluationReason}]`);
        setEvaluatedInstance(x);
    }, [evaluationTrigger]);

    const [evaluatedInstance, setEvaluatedInstance] = React.useState<EvaluatedWorkflow>(() => {
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
        <UnsavedChangesHandler isDirty={defHasChanges} />
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
        SetLastEvaluatedWorkflowDefId: args => undefined,
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


interface EventWorkflowTabContentProps {
    event: db3.EventClientPayload_Verbose,
    refreshTrigger: number;
    tableClient: DB3Client.xTableRenderClient,
    readonly: boolean,
    refetch: () => void,
};

function GetModelForEvent(dashboardContext: DashboardContextData, event: db3.EventClientPayload_Verbose): MockEventModel {
    const {
        description,
        expectedAttendanceUserTagId,
        frontpageVisible,
        locationDescription,
        name,
        statusId,
        typeId,
    } = event;

    const ret: MockEventModel = {
        description,
        expectedAttendanceUserTagId,
        frontpageVisible,
        locationDescription,
        name,
        statusId,
        tagIds: event.tags.map(t => t.eventTagId),
        typeId,
    };

    // apply custom fields
    for (const cfv of event.customFieldValues) {
        const cf = dashboardContext.eventCustomField.getById(cfv.customFieldId);
        if (!cf) throw new Error(`CFV ref no good for id: ${cfv.customFieldId}`);
        if (IsNullOrWhitespace(cfv.jsonValue)) {
            ret[cf.name] = null;
            continue;
        }
        try {
            const deserializedValue = JSON.parse(cfv.jsonValue);
            ret[cf.name] = deserializedValue;
        } catch (e) {
            console.log(e);
            console.log(`json value:`);
            console.log(cfv.jsonValue);
            throw e;
        }
    }

    return ret;
}

export const EventWorkflowTabWithWFContext = () => {
    return <div>
        <WorkflowContainer />
        {/* <WorkflowLogView /> */}
    </div>;
};

/////////////////////////////////////////////////////////////////////////////////////////////
type WorkflowObjects = {
    workflowDef: WorkflowDef | undefined,
    workflowInstance: WorkflowInstance | undefined,
    refetch: () => void,
};

function useWorkflowDefAndInstanceForEvent(eventId: number, refreshTrigger: number) {
    const [qr, qrx] = useQuery(getWorkflowDefAndInstanceForEvent, { eventId, refreshTrigger });

    React.useEffect(() => void qrx.refetch(), [refreshTrigger]);
    const ret: WorkflowObjects = {
        workflowDef: qr.workflowDef ? mapWorkflowDef(qr.workflowDef) : undefined,
        workflowInstance: qr.workflowInstance ? MutationArgsToWorkflowInstance(db3.WorkflowInstanceQueryResultToMutationArgs(qr.workflowInstance, eventId)) : undefined,
        refetch: qrx.refetch,
    };

    if (ret.workflowDef && !ret.workflowInstance) {
        ret.workflowInstance = WorkflowInitializeInstance(ret.workflowDef!);
    }

    // // ensure an instance object exists
    // const initialInstance = React.useMemo(() => {
    //     if (!ret.workflowDef) return undefined;
    //     WorkflowInitializeInstance(ret.workflowDef!);
    // }, [ret.workflowDef?.id]);
    //ret.workflowInstance = ret.workflowInstance || initialInstance;

    return ret;
}

/////////////////////////////////////////////////////////////////////////////////////////////
type EvaluatedWorkflowObjects = {
    evaluatedWorkflow: EvaluatedWorkflow | undefined,
    instanceMutator: WorkflowInstanceMutator | undefined;
    renderer: WorkflowRenderer | undefined;
};

function useEvaluatedWorkflow(workflowObjects: WorkflowObjects, model: MockEventModel) {
    const dashboardContext = useDashboardContext();
    const [evaluationTrigger, setEvaluationTrigger] = React.useState<number>(0);
    const [evaluationReason, setEvaluationReason] = React.useState<string>("");

    const [instanceMutator, renderer] = (!workflowObjects.workflowDef || !workflowObjects.workflowInstance) ?
        [undefined, undefined]
        : MakeInstanceMutatorAndRenderer({
            dashboardContext,
            workflowDef: workflowObjects.workflowDef,
            evaluationTrigger,
            setEvaluationTrigger,
            setEvaluationReason,
            model,
            setModel: () => console.log(`todo: model saving`),
            instance: workflowObjects.workflowInstance,
            setInstance: () => console.log(`todo: instance mutation`),
        });

    const evaluate = (): EvaluatedWorkflow | undefined => {
        if (!workflowObjects.workflowDef || !workflowObjects.workflowInstance || !instanceMutator) {
            return undefined;
        }
        const x = EvaluateWorkflow(workflowObjects.workflowDef, workflowObjects.workflowInstance, instanceMutator, `...`);
        return x;
    };

    const [evaluatedInstance, setEvaluatedInstance] = React.useState<EvaluatedWorkflow | undefined>(() => {
        if (!workflowObjects.workflowDef || !workflowObjects.workflowInstance) return undefined;
        return evaluate();
    });

    // re-evaluate when requested
    React.useEffect(() => {
        setEvaluatedInstance(evaluate());
    }, [evaluationTrigger, workflowObjects.workflowDef?.id]);

    const ret: EvaluatedWorkflowObjects = {
        evaluatedWorkflow: evaluatedInstance,
        instanceMutator,
        renderer,
    };

    return ret;
}

/////////////////////////////////////////////////////////////////////////////////////////////
export const EventWorkflowTabInner = (props: EventWorkflowTabContentProps) => {
    const dashboardContext = useDashboardContext();
    //const snackbar = useSnackbar();
    //const [insertOrUpdateEventWorkflowInstanceMutation] = useMutation(insertOrUpdateEventWorkflowInstance);

    //console.log(`here`);
    const workflowObjects = useWorkflowDefAndInstanceForEvent(props.event.id, props.refreshTrigger);
    const model = GetModelForEvent(dashboardContext, props.event);
    const evaluatedObjects = useEvaluatedWorkflow(workflowObjects, model);

    // in order to actually save instances to db, it's not so easy.
    // the problem is that each node eval will trigger mutations so you get this huge cascade of mutations right at the start, and it's not clear when the end of those mutations is.
    // ! well i guess it needs to be after evaluate(), rather than onInstanceMutationChainComplete
    // -> then for mutations that happen outside of evaluate(), we need to handle those differently and save immediately?...
    //   -> or eval after those types of changes and do the same logic?
    // and i found it somehow difficult to only keep the database's instance version because the mutator wants to save everything, and the client gets out of sync.
    // maybe that's necessary though, so the idea is that after mutations are applied, we have to wait for the db to return the correct intsance.
    // in the meantime though we still work with the old data, and react renders will constantly trigger re-evaluations.
    //
    // i did not find a good solution for this. evaluate() MUST apply mutations due to things like default due dates and logging.
    // so a revision system was considered and may be the way to go, and also would prevent clobbering synchronous changes from others.
    // so afetr evaluate(), we increment revision and compare it with the last known db revision. if you're working with old data, ignore.
    // upon serializing, we can also compare the "from revision" and "to revision" and detect when someone else clobbered your changes.

    if (!workflowObjects.workflowDef) return null;
    if (!workflowObjects.workflowInstance) return null;
    if (!evaluatedObjects.evaluatedWorkflow) return null;
    if (!evaluatedObjects.instanceMutator) return null;
    if (!evaluatedObjects.renderer) return null;

    return <EvaluatedWorkflowProvider
        flowDef={workflowObjects.workflowDef}
        flowInstance={workflowObjects.workflowInstance}
        evaluatedFlow={evaluatedObjects.evaluatedWorkflow}
        instanceMutator={evaluatedObjects.instanceMutator}
        renderer={evaluatedObjects.renderer}
        onWorkflowDefMutationChainComplete={(newFlowDef: WorkflowDef, reEvalRequested: boolean, reason: string) => {
            throw new Error(`def mutations not possible here`);
        }}
    >
        <AdminInspectObject src={model} label="Model" />
        <EventWorkflowTabWithWFContext />
    </EvaluatedWorkflowProvider>
};



export const EventWorkflowTabContent = (props: EventWorkflowTabContentProps) => {
    return <React.Suspense>
        <EventWorkflowTabInner {...props} />
    </React.Suspense>;
};

