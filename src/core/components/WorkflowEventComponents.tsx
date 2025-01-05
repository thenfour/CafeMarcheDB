// workflow client code specific to CMDB events

import { Button, Checkbox, CircularProgress } from "@mui/material";
import { ReactFlowProvider } from "@xyflow/react";
import * as React from 'react';
import { gGeneralPaletteList } from "shared/color";
import { Permission } from "shared/permissions";
import { arraysContainSameValues, callAsync, CoalesceBool, getUniqueNegativeID, IsNullOrWhitespace } from "shared/utils";
import * as DB3Client from "src/core/db3/DB3Client";
import * as db3 from "src/core/db3/db3";
import { gCharMap, gIconMap } from "../db3/components/IconMap";
import { AdminContainer, AdminInspectObject, InspectObject } from "./CMCoreComponents";
import { NameValuePair } from "./CMCoreComponents2";
import { CMTextField } from "./CMTextField";
import { DashboardContextData, useDashboardContext } from "./DashboardContext";
import { Markdown3Editor } from "./MarkdownControl3";

import { useMutation, useQuery } from "@blitzjs/rpc";
import { EvaluatedWorkflow, EvaluateWorkflow, mapWorkflowDef, MutationArgsToWorkflowInstance, WorkflowDef, WorkflowInitializeInstance, WorkflowInstance, WorkflowInstanceMutator, WorkflowModelFieldSpec, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import insertOrUpdateEventWorkflowInstance from "../db3/mutations/insertOrUpdateEventWorkflowInstance";
import saveEventWorkflowModel from "../db3/mutations/saveEventWorkflowModel";
import getWorkflowDefAndInstanceForEvent from "../db3/queries/getWorkflowDefAndInstanceForEvent";
import { MockEvent, MockEventModel } from "../db3/server/eventWorkflow";
import { ColorPick } from "./ColorPick";
import { useSnackbar } from "./SnackbarContext";
import UnsavedChangesHandler from "./UnsavedChangesHandler";
import { EventCustomFieldOptionsBindingOperand2Component, EventCustomFieldOptionsBindingValueComponent, MakeCustomFieldOptionsBinding } from "./WorkflowCustomFieldOptionsBinding";
import { EventStatusBindingOperand2Component, EventStatusBindingValueComponent, EventTypeBindingOperand2Component, EventTypeBindingValueComponent, MakeDB3ForeignSingleBinding, UserTagIdBindingOperand2Component, UserTagIdBindingValueComponent } from "./WorkflowDB3ForeignSingleBinding";
import { EventTagsBindingOperand2Component, EventTagsBindingValueComponent, MakeDB3TagsBinding } from "./WorkflowDB3TagsBinding";
import { WorkflowEditorPOC, WorkflowReactFlowEditor } from "./WorkflowEditorGraph";
import { EvaluatedWorkflowContext, EvaluatedWorkflowProvider, MakeAlwaysBinding, MakeBoolBinding, MakeRichTextBinding, MakeSingleLineTextBinding, WFFieldBinding, WorkflowContainer, WorkflowRenderer } from "./WorkflowUserComponents";

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
        ret[db3.GetCustomFieldMemberName(f)] = null; // todo: default values for custom fields?
    }
    return ret;
};

export function getMockEventBinding(args: {
    dashboardContext: DashboardContextData,
    model: MockEvent,
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    setModelValue?: (member: string, value: unknown) => void,
    setOperand2?: (newOperand: unknown) => void,
}): WFFieldBinding<unknown> {

    // do custom fields first
    const cf = args.dashboardContext.eventCustomField.find(x => x.id === db3.GetCustomFieldIdFromMember(args.nodeDef.fieldName));
    if (cf) {
        const cfMemberName = db3.GetCustomFieldMemberName(cf);
        switch (cf.dataType as db3.EventCustomFieldDataType) {
            case db3.EventCustomFieldDataType.Checkbox:
                return MakeBoolBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    fieldNameForDisplay: cf.name,
                    value: args.model[cfMemberName],
                    setValue: (val) => {
                        args.setModelValue && args.setModelValue(cfMemberName, CoalesceBool(val, false));
                    },
                    setOperand2: args.setOperand2,
                });
            case db3.EventCustomFieldDataType.RichText:
                return MakeRichTextBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    fieldNameForDisplay: cf.name,
                    value: args.model[cfMemberName] || "",
                    setOperand2: args.setOperand2,
                    setValue: (val) => {
                        args.setModelValue && args.setModelValue(cfMemberName, val);
                    },
                });
            case db3.EventCustomFieldDataType.SimpleText:
                return MakeSingleLineTextBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    fieldNameForDisplay: cf.name,
                    value: args.model[cfMemberName] || "",
                    setValue: (val) => {
                        args.setModelValue && args.setModelValue(cfMemberName, val);
                    },
                    setOperand2: args.setOperand2,
                });
            case db3.EventCustomFieldDataType.Options:
                return MakeCustomFieldOptionsBinding({
                    tidiedNodeInstance: args.tidiedNodeInstance,
                    flowDef: args.flowDef,
                    nodeDef: args.nodeDef,
                    fieldNameForDisplay: cf.name,
                    setOperand2: args.setOperand2,
                    value: args.model[cfMemberName],
                    setValue: (val) => {
                        //console.log(`setting ${cfMemberName} = ${val}`);
                        args.setModelValue && args.setModelValue(cfMemberName, val || null);
                    },
                    FieldValueComponent: (props) => <EventCustomFieldOptionsBindingValueComponent {...props} options={db3.ParseEventCustomFieldOptionsJson(cf.optionsJson)} />,
                    FieldOperand2Component: (props) => <EventCustomFieldOptionsBindingOperand2Component {...props} options={db3.ParseEventCustomFieldOptionsJson(cf.optionsJson)} />,
                });
            // console.log(`todo: handle case db3.EventCustomFieldDataType.Options`);
            // return MakeAlwaysBinding({
            //     tidiedNodeInstance: args.tidiedNodeInstance,
            //     fieldNameForDisplay: cf.name,
            //     flowDef: args.flowDef,
            //     nodeDef: args.nodeDef,
            //     value: false,
            // });
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
                setOperand2: args.setOperand2,
                value: args.model[field] || "",
                setValue: (val) => {
                    args.setModelValue && args.setModelValue(field, val);
                },
            });
        case "locationDescription":
        case "name":
            return MakeSingleLineTextBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                setOperand2: args.setOperand2,
                value: args.model[field] || "",
                setValue: (val) => {
                    args.setModelValue && args.setModelValue(field, val);
                },
            });
        case "frontpageVisible": // defaults to false
            return MakeBoolBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    args.setModelValue && args.setModelValue(field, CoalesceBool(val, false));
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
                    args.setModelValue && args.setModelValue(field, val || null);
                },
                FieldValueComponent: (props) => <EventTypeBindingValueComponent {...props} />,
                FieldOperand2Component: (props) => <EventTypeBindingOperand2Component {...props} />,
            });
        case "expectedAttendanceUserTagId":
            return MakeDB3ForeignSingleBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    args.setModelValue && args.setModelValue(field, val || null);
                },
                FieldValueComponent: (props) => <UserTagIdBindingValueComponent {...props} />,
                FieldOperand2Component: (props) => <UserTagIdBindingOperand2Component {...props} />,
            });
        case "statusId":
            return MakeDB3ForeignSingleBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    args.setModelValue && args.setModelValue(field, val || null);
                },
                FieldValueComponent: (props) => <EventStatusBindingValueComponent {...props} />,
                FieldOperand2Component: (props) => <EventStatusBindingOperand2Component {...props} />,
            });
        case "tagIds":
            return MakeDB3TagsBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                fieldNameForDisplay: field,
                setOperand2: args.setOperand2,
                value: args.model[field],
                setValue: (val) => {
                    args.setModelValue && args.setModelValue(field, val || null);
                },
                FieldValueComponent: (props) => <EventTagsBindingValueComponent {...props} />,
                FieldOperand2Component: (props) => <EventTagsBindingOperand2Component {...props} />,
            });
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
    resetModel: () => void;
    //setModel: (m: MockEventModel) => void;
    setModelValue: (member: string, value: unknown) => void,
    instance: WorkflowInstance;
    setInstance: (x: WorkflowInstance) => void;
    evaluationTrigger: number;
    setEvaluationTrigger: (x: number) => void;
    //setEvaluationReason: (x: string) => void;
};

function MakeInstanceMutatorAndRenderer({
    dashboardContext,
    workflowDef,
    model,
    //setModel,
    resetModel,
    setModelValue,
    instance,
    setInstance,
    evaluationTrigger,
    setEvaluationTrigger,
    //    setEvaluationReason,
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
                setModelValue: (member, value) => {
                    //setModel(newModel);
                    setModelValue(member, value);
                    setInstance({ ...instance }); // trigger re-eval
                },
                //setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.doesFieldValueSatisfyCompletionCriteria();
        },
        GetModelFields: (args) => {
            const model = MakeEmptyModel(dashboardContext);
            const ret: WorkflowModelFieldSpec[] = Object.keys(model).map(f => {
                const customFieldId = db3.GetCustomFieldIdFromMember(f);
                const cf = dashboardContext.eventCustomField.getById(customFieldId);
                return {
                    displayName: cf ? cf.name : f,
                    memberName: f,
                }
            });
            return ret;
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
            //setModel(MakeEmptyModel(dashboardContext));
            resetModel();

            setInstance(WorkflowInitializeInstance(workflowDef));
            //setEvaluationReason("ResetModelAndInstance");
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
            //console.log(`instance mutator: setting assignees`);
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
            //console.log(`instance mutator: setting last assignees`);

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
            //console.log(`instance mutator: setting last evaluated workflow def id ot ${args.workflowDefId}`);
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
            //console.log(`instance mutator: setting due date`);
            ni.dueDate = args.dueDate;
            return args.sourceWorkflowInstance;
        },
        // AddLogItem: (args) => {
        //     return undefined; // TODO: support activity logging for instances. right now it's too complex to track state
        //     // args.sourceWorkflowInstance.log.push({ ...args.msg, userId: dashboardContext.currentUser?.id || undefined });
        //     // return args.sourceWorkflowInstance;
        // },
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
            //console.log(`instance mutator: node=${ni.nodeDefId} SetNodeStatusData ${ni.lastProgressState} => ${args.lastProgressState}`);

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
            //console.log(`instance mutator: SetLastFieldValue node=${ni.nodeDefId} ${ni.lastFieldName} => ${args.fieldName} && ${ni.lastFieldValueAsString} => ${args.fieldValueAsString}`);

            ni.lastFieldName = args.fieldName;
            ni.lastFieldValueAsString = args.fieldValueAsString;
            return args.sourceWorkflowInstance;
        },
        onWorkflowInstanceMutationChainComplete: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => {
            //console.log("instance mutator: onWorkflowInstanceMutationChainComplete");
            setInstance(newInstance);
            if (reEvaluationNeeded) {
                //setEvaluationReason("instance mutator requested");
                setEvaluationTrigger(evaluationTrigger + 1);
            }
        },
    };

    const renderer: WorkflowRenderer = {
        RenderFieldValueForNode: ({ flowDef, nodeDef, evaluatedNode, readonly }) => {
            const binding = getMockEventBinding({
                dashboardContext,
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModelValue: (member, value) => {
                    setModelValue(member, value);
                    setInstance({ ...instance }); // trigger reeval when the model changes. important lel
                    setEvaluationTrigger(evaluationTrigger + 1);
                },
                setOperand2: (n) => {
                    throw new Error(`set operand2 not expected here`);
                },
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
                setModelValue: (member, value) => {
                    throw new Error(`should not be called from here.`);
                },
                setOperand2: setValue,
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

    const setModelValue = (member: string, value: unknown) => {
        // here we don't use a real model.
        const newModel = { ...model, [member]: value };
        setModel(newModel);
    };

    const [instanceMutator, renderer] = MakeInstanceMutatorAndRenderer({
        model,
        dashboardContext,
        evaluationTrigger,
        instance: workflowInstance,
        setInstance: setWorkflowInstance,
        //setEvaluationReason,
        setEvaluationTrigger,
        //setModelValue,        
        resetModel: () => setModel(MakeEmptyModel(dashboardContext)),
        workflowDef,
        setModelValue,
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
        GetModelFields: (args) => [],
        GetFieldValueAsString: ({ flowDef, nodeDef, node }) => "",
        ResetModelAndInstance: () => { },
        SetAssigneesForNode: (args) => undefined,
        SetLastEvaluatedWorkflowDefId: args => undefined,
        SetDueDateForNode: (args) => undefined,
        //AddLogItem: (args) => undefined,
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
        const cfMemberName = db3.GetCustomFieldMemberName(cf);
        if (IsNullOrWhitespace(cfv.jsonValue)) {
            ret[cfMemberName] = null;
            continue;
        }
        try {
            const deserializedValue = JSON.parse(cfv.jsonValue);
            ret[cfMemberName] = deserializedValue;
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
    dataUpdatedAt: number;
};

function useWorkflowDefAndInstanceForEvent(eventId: number, refreshTrigger: number) {
    const [qr, qrx] = useQuery(getWorkflowDefAndInstanceForEvent, { eventId, refreshTrigger });

    React.useEffect(() => void qrx.refetch(), [refreshTrigger]);
    const ret: WorkflowObjects = {
        workflowDef: qr.workflowDef ? mapWorkflowDef(qr.workflowDef) : undefined,
        workflowInstance: qr.workflowInstance ? MutationArgsToWorkflowInstance(db3.WorkflowInstanceQueryResultToMutationArgs(qr.workflowInstance, eventId)) : undefined,
        refetch: qrx.refetch,
        dataUpdatedAt: qrx.dataUpdatedAt,
    };

    if (ret.workflowDef && !ret.workflowInstance) {
        ret.workflowInstance = WorkflowInitializeInstance(ret.workflowDef!);
    }

    // React.useEffect(() => {
    //     console.log(`WorkflowDef and INSTANCE loaded from db with refresh trigger ${refreshTrigger}`)
    // }, [qrx.dataUpdatedAt]);

    return ret;
}


/////////////////////////////////////////////////////////////////////////////////////////////
type EvaluatedWorkflowObjects =
    WorkflowObjects &
    {
        evaluatedWorkflow: EvaluatedWorkflow | undefined,
        instanceMutator: WorkflowInstanceMutator | undefined;
        renderer: WorkflowRenderer | undefined;
        model: MockEventModel;
    };

function useEvaluatedWorkflow(event: db3.EventClientPayload_Verbose, refreshTrigger: number, upstreamRefresh: () => void) {
    const dashboardContext = useDashboardContext();
    //const [myInstanceId, _] = React.useState(() => nanoid(3));
    const ownReloadTrigger = React.useRef<number>(0);
    const [evaluationTrigger, setEvaluationTrigger] = React.useState<number>(0);
    const [saveEventWorkflowModelMutation] = useMutation(saveEventWorkflowModel);

    // When we invoke the instance upsert mutation, because of React's unpredictable rendering behavior,
    // combined with async mutation calling, it can be invoked in a non-sequential way. In other words,
    // 1. call instance mutation, revision 1
    // 2. other calls or evaluations
    // 3. instance returns, new one is fetched
    // 4. ....
    // 5. finally we should be allowed to re-execute and proceed.
    // 
    // when *submitting* the mutation, we should halt evaluations and processing because we are waiting for a revision greater than the current.
    // when the mutation completes, it will let us know the new latest revision. set the waiting for revision number to this one and we know we're up-to-date.
    const waitingForDbRevisionGteRef = React.useRef<number>(0);

    //const [evaluationReason, setEvaluationReason] = React.useState<string>("");
    const snackbar = useSnackbar();
    const [insertOrUpdateEventWorkflowInstanceMutation] = useMutation(insertOrUpdateEventWorkflowInstance);

    // load the workflowdef and workflow instance for the event
    const workflowObjects = useWorkflowDefAndInstanceForEvent(event.id, refreshTrigger + ownReloadTrigger.current);

    const isWaitingForDbUpdate = () => {
        if (!workflowObjects.workflowInstance) return true;
        //console.log(`${myInstanceId}  isWaitingForDbUpdate : working revision = ${workflowObjects.workflowInstance.revision}, waiting to receive revision = ${waitingForDbRevisionGteRef.current}`);
        return workflowObjects.workflowInstance.revision < waitingForDbRevisionGteRef.current;
    };

    React.useEffect(() => {
        waitingForDbRevisionGteRef.current = Math.max(workflowObjects.workflowInstance?.revision || 0, waitingForDbRevisionGteRef.current);
        //console.log(`${myInstanceId} db fetch seems to be complete; working revision now = ${waitingForDbRevisionGteRef.current} (useEffect instance db fetched)`);
    }, [workflowObjects.workflowInstance?.revision || 0]);

    const model = GetModelForEvent(dashboardContext, event);
    //console.log(`getting model for event; typeid=${model.typeId}`);

    const handleNeedToSubmitInstanceForMutation = (newInstance: WorkflowInstance) => {
        if (!workflowObjects.workflowInstance) throw new Error();
        if (isWaitingForDbUpdate()) {
            //console.log(`${myInstanceId} skipping workflow instance mutation; we are waiting for db.`);
        } else {
            waitingForDbRevisionGteRef.current = workflowObjects.workflowInstance.revision + 1;
            //console.log(`${myInstanceId} waiting on theoretical revision ${waitingForDbRevisionGteRef.current} (beginning mutation)`);
            callAsync(async () => {
                try {
                    const ret = await insertOrUpdateEventWorkflowInstanceMutation({
                        eventId: event.id,
                        instance: newInstance,
                    });

                    // now we should USE the instance. the simplest way is to reload
                    waitingForDbRevisionGteRef.current = ret.serializableInstance!.instance.revision;
                    //console.log(`${myInstanceId} mutation returned success; setting to the REAL new revision = ${waitingForDbRevisionGteRef.current}`);
                    ownReloadTrigger.current++;
                    snackbar.showSuccess("instance updated");
                } catch (e) {
                    console.log(e);
                    // this error is actually common; server is doing elision
                    //snackbar.showError("error updating instance; see console.");
                    if (workflowObjects.workflowInstance) {
                        waitingForDbRevisionGteRef.current = workflowObjects.workflowInstance.revision;
                        //console.log(`waitingForDbRevisionGteRef.current = ${waitingForDbRevisionGteRef.current} (mutation error)`);
                    }
                }
            });
        }

    };

    const setModelValue = (member: string, value: unknown) => {
        void snackbar.invokeAsync(async () => {
            await saveEventWorkflowModelMutation({
                eventId: event.id,
                values: {
                    [member]: value,
                }
            });
            upstreamRefresh();
            //ownReloadTrigger.current++;
        });
    };

    const [instanceMutator, renderer] = (!workflowObjects.workflowDef || !workflowObjects.workflowInstance) ?
        [undefined, undefined]
        : MakeInstanceMutatorAndRenderer({
            dashboardContext,
            workflowDef: workflowObjects.workflowDef,
            evaluationTrigger,
            setEvaluationTrigger,
            //setEvaluationReason,
            resetModel: () => { throw new Error() },
            model,
            //setModel,
            setModelValue,
            instance: workflowObjects.workflowInstance,
            setInstance: (newInstance) => {
                handleNeedToSubmitInstanceForMutation(newInstance);
            },
        });

    const evaluate = (): EvaluatedWorkflow | undefined => {
        if (!workflowObjects.workflowDef || !workflowObjects.workflowInstance || !instanceMutator) {
            return undefined;
        }

        //console.log(`${myInstanceId} Evaluating flow now.... see result:`);
        const x = EvaluateWorkflow(workflowObjects.workflowDef, workflowObjects.workflowInstance, instanceMutator, `...`);
        //console.log(x);

        if (x.instanceWasModifiedDuringEval) {
            handleNeedToSubmitInstanceForMutation(x.flowInstance);
        }

        return x;
    };

    const [evaluatedInstance, setEvaluatedInstance] = React.useState<EvaluatedWorkflow | undefined>(() => {
        if (!workflowObjects.workflowDef || !workflowObjects.workflowInstance) return undefined;
        return evaluate();
    });

    // re-evaluate when requested
    React.useEffect(() => {
        if (isWaitingForDbUpdate()) {
            //console.log(`${myInstanceId} useeffect not going to re-eval because you're still waiting for stuff.`);
            return;
        }
        const evalResult = evaluate();
        setEvaluatedInstance(evalResult);
    }, [evaluationTrigger, workflowObjects.workflowInstance!.revision, workflowObjects.workflowDef?.id, workflowObjects.dataUpdatedAt]);

    const ret: EvaluatedWorkflowObjects = {
        ...workflowObjects,
        evaluatedWorkflow: evaluatedInstance,
        instanceMutator,
        renderer,
        model,
    };

    return ret;
}


/////////////////////////////////////////////////////////////////////////////////////////////
export const EventWorkflowTabInner = (props: EventWorkflowTabContentProps) => {
    //const [myInstanceId, _] = React.useState(() => nanoid(3));

    const evaluatedObjects = useEvaluatedWorkflow(props.event, props.refreshTrigger, props.refetch);

    // if any of this stuff is null the workflow would not be relevant.
    if (!evaluatedObjects.workflowDef) return null;
    if (!evaluatedObjects.workflowInstance) return null;
    if (!evaluatedObjects.evaluatedWorkflow) return null;
    if (!evaluatedObjects.instanceMutator) return null;
    if (!evaluatedObjects.renderer) return null;

    return <EvaluatedWorkflowProvider
        flowDef={evaluatedObjects.workflowDef}
        flowInstance={evaluatedObjects.workflowInstance}
        evaluatedFlow={evaluatedObjects.evaluatedWorkflow}
        instanceMutator={evaluatedObjects.instanceMutator}
        renderer={evaluatedObjects.renderer}
        onWorkflowDefMutationChainComplete={(newFlowDef: WorkflowDef, reEvalRequested: boolean, reason: string) => {
            throw new Error(`def mutations not possible here`);
        }}
    >
        <AdminInspectObject src={evaluatedObjects.model} label="Model" />
        <EventWorkflowTabWithWFContext />
    </EvaluatedWorkflowProvider>
};

export const EventWorkflowTabContent = (props: EventWorkflowTabContentProps) => {
    return <React.Suspense fallback={<div style={{ display: "flex" }}>
        <CircularProgress />
    </div>}>
        <EventWorkflowTabInner {...props} />
    </React.Suspense>;
};

