import React, { useContext } from "react";
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { WorkflowDef, WorkflowEvaluatedNode, WorkflowFieldValueOperator, WorkflowInitializeInstance, WorkflowInstance, WorkflowInstanceMutator, WorkflowNodeDef, WorkflowTidiedNodeInstance } from "shared/workflowEngine";
import { WorkflowEditorPOC } from "src/core/components/WorkflowEditorGraph";
import { EvaluatedWorkflowContext, EvaluatedWorkflowProvider, WorkflowRenderer } from "src/core/components/WorkflowUserComponents";
import { CMSmallButton } from "src/core/components/CMCoreComponents2";
import { assert } from "blitz";
import { CoalesceBool, CoerceToString, IsNullOrWhitespace, valueOr } from "shared/utils";
import { InspectObject } from "src/core/components/CMCoreComponents";
import { CMTextField } from "src/core/components/CMTextField";



///////////// an example workflow def /////////////////////////////////////////////////////////////////
const minimalWorkflow = {
    "id": 100,
    "name": "Minimal workflow",
    "groupDefs": [
        {
            "id": 1000,
            "name": "all group",
            "color": "pink",
            "position": {
                "x": 75,
                "y": 90
            },
            "width": 584,
            "height": 194,
            "selected": false
        },
        {
            "id": 1001,
            "name": "results",
            "color": "red",
            "position": {
                "x": 75,
                "y": 375
            },
            "width": 614,
            "height": 179,
            "selected": false
        },
        {
            "id": 1002,
            "name": "G7Z7oi59cSR3PB_ZjvePA",
            "color": "light_blue",
            "height": 275,
            "width": 620,
            "position": {
                "x": 45,
                "y": 585
            },
            "selected": false
        }
    ],
    "nodeDefs": [
        {
            "id": 500,
            "name": "bool question #1",
            "groupDefId": 1000,
            "displayStyle": "Normal",
            "completionCriteriaType": "fieldValue",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "fieldName": "bool:0",
            "fieldValueOperator": "Truthy",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "nodeDependencies": [],
            "position": {
                "x": 90,
                "y": 60
            },
            "selected": false,
            "width": 113,
            "height": 42
        },
        {
            "id": 501,
            "name": "question #2",
            "groupDefId": 1000,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "nodeDependencies": [],
            "completionCriteriaType": "fieldValue",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "fieldName": "bool:1",
            "fieldValueOperator": "Truthy",
            "position": {
                "x": 225,
                "y": 60
            },
            "selected": false,
            "width": 113,
            "height": 42
        },
        {
            "id": 502,
            "name": "question #3",
            "groupDefId": 1000,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "nodeDependencies": [],
            "completionCriteriaType": "fieldValue",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "fieldName": "bool:2",
            "fieldValueOperator": "Truthy",
            "position": {
                "x": 360,
                "y": 60
            },
            "selected": false,
            "width": 113,
            "height": 42
        },
        {
            "id": 503,
            "name": "When all are answered",
            "groupDefId": 1001,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "position": {
                "x": 195,
                "y": 75
            },
            "selected": false,
            "nodeDependencies": [
                {
                    "nodeDefId": 500,
                    "determinesActivation": false,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 501,
                    "determinesActivation": false,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 502,
                    "determinesActivation": false,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                }
            ],
            "width": 175,
            "height": 42
        },
        {
            "id": 504,
            "name": "Any answered?",
            "groupDefId": 1001,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "completionCriteriaType": "someNodesComplete",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "position": {
                "x": 30,
                "y": 75
            },
            "selected": false,
            "nodeDependencies": [
                {
                    "nodeDefId": 500,
                    "determinesActivation": false,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 501,
                    "determinesActivation": false,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 502,
                    "determinesActivation": false,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                }
            ],
            "width": 134,
            "height": 42
        },
        {
            "id": 505,
            "name": "should mirror \"ALL\"",
            "groupDefId": 1002,
            "displayStyle": "Normal",
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "nodeDependencies": [
                {
                    "selected": false,
                    "nodeDefId": 503,
                    "determinesRelevance": false,
                    "determinesActivation": false,
                    "determinesCompleteness": true
                }
            ],
            "position": {
                "x": 60,
                "y": 90
            },
            "selected": false,
            "width": 155,
            "height": 42
        },
        {
            "id": 506,
            "name": "ANY but can be partially",
            "groupDefId": 1002,
            "displayStyle": "Normal",
            "completionCriteriaType": "someNodesComplete",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "nodeDependencies": [
                {
                    "selected": false,
                    "nodeDefId": 503,
                    "determinesRelevance": false,
                    "determinesActivation": false,
                    "determinesCompleteness": true
                },
                {
                    "selected": false,
                    "nodeDefId": 507,
                    "determinesRelevance": false,
                    "determinesActivation": false,
                    "determinesCompleteness": true
                }
            ],
            "position": {
                "x": 210,
                "y": 165
            },
            "selected": false,
            "width": 181,
            "height": 42
        },
        {
            "id": 507,
            "name": "when 2 are answered",
            "groupDefId": 1002,
            "displayStyle": "Normal",
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "nodeDependencies": [
                {
                    "selected": false,
                    "nodeDefId": 501,
                    "determinesRelevance": false,
                    "determinesActivation": false,
                    "determinesCompleteness": true
                },
                {
                    "selected": false,
                    "nodeDefId": 502,
                    "determinesRelevance": false,
                    "determinesActivation": false,
                    "determinesCompleteness": true
                }
            ],
            "position": {
                "x": 345,
                "y": 60
            },
            "selected": false,
            "width": 167,
            "height": 42
        }
    ]
}
    ;

/////////////////////////////////////////////////////////////////////////////////////////////

interface WFFieldBinding<Tunderlying> {
    flowDef: WorkflowDef;
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    value: Tunderlying,
    setValue: (val: Tunderlying) => void,
    setOperand2: (val: Tunderlying | Tunderlying[]) => void,
    doesFieldValueSatisfyCompletionCriteria: () => boolean;
    FieldValueComponent: (props: WFFieldBinding<Tunderlying>) => React.ReactNode;
    FieldOperand2Component: (props: WFFieldBinding<Tunderlying>) => React.ReactNode;
};

/////////////////////////////////////////////////////////////////////////////////////////////
const BoolField = (props: WFFieldBinding<boolean | null>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    return <CMSmallButton onClick={() => {
        console.log(`clicked small button`);
        props.setValue(!props.value);
    }}>{props.value ? "unapprove" : "approve"}</CMSmallButton>
}

const BoolOperand = (props: WFFieldBinding<boolean | null>) => {
    return <div>null, true, false. todo: support multiple if "any of"</div>;
}

const MakeBoolBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    value: boolean | null,
    setValue: (val: boolean | null) => void,
    setOperand2: (val: (boolean | null) | (boolean | null)[]) => void,
}
): WFFieldBinding<boolean | null> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        value: args.value,
        setValue: args.setValue,
        setOperand2: args.setOperand2,
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
                    if (Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return (args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    if (Array.isArray(args.nodeDef.fieldValueOperand2)) return true;
                    return !(args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                default:
                    throw new Error(`not implemented: boolean field binding, operator ${args.nodeDef.fieldValueOperator}`);
            }
        },
        FieldValueComponent: BoolField,
        FieldOperand2Component: BoolOperand,
    };
};


/////////////////////////////////////////////////////////////////////////////////////////////
const TextField = (props: WFFieldBinding<string>) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    return <CMTextField
        autoFocus={false}
        value={props.value || ""}
        style={{ width: "auto" }}
        onChange={(e, v) => {
            props.setValue(v);
        }}
    />
}

const TextOperand = (props: WFFieldBinding<string>) => {
    const val = CoerceToString(props.nodeDef.fieldValueOperand2);
    return <CMTextField
        autoFocus={false}
        value={val}
        style={{ width: "auto" }}
        label="Operand 2"
        onChange={(e, v) => props.setOperand2(v)}
    />;
}

const MakeTextBinding = (args: {
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    value: string,
    setValue: (val: string) => void,
    setOperand2: (val: (string) | (string)[]) => void,
}
): WFFieldBinding<string> => {
    return {
        flowDef: args.flowDef,
        nodeDef: args.nodeDef,
        tidiedNodeInstance: args.tidiedNodeInstance,
        value: args.value,
        setValue: args.setValue,
        setOperand2: args.setOperand2,
        doesFieldValueSatisfyCompletionCriteria: () => {
            const isNull = () => IsNullOrWhitespace(args.value);
            const eq = () => args.value.trim().toLowerCase() === ((args.nodeDef.fieldValueOperand2 as string) || "").trim().toLowerCase();

            switch (args.nodeDef.fieldValueOperator) {
                case WorkflowFieldValueOperator.Falsy:
                case WorkflowFieldValueOperator.IsNull:
                    return isNull();
                case WorkflowFieldValueOperator.Truthy:
                case WorkflowFieldValueOperator.IsNotNull:
                    return !isNull();
                case WorkflowFieldValueOperator.EqualsOperand2:
                    return eq();
                case WorkflowFieldValueOperator.NotEqualsOperand2:
                    return !eq();
                case WorkflowFieldValueOperator.EqualsAnyOf:
                    if (Array.isArray(args.nodeDef.fieldValueOperand2)) return false;
                    return (args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                case WorkflowFieldValueOperator.IsNotAnyOf:
                    if (Array.isArray(args.nodeDef.fieldValueOperand2)) return true;
                    return !(args.nodeDef.fieldValueOperand2 as any[]).includes(args.value);
                default:
                    throw new Error(`not implemented: boolean field binding, operator ${args.nodeDef.fieldValueOperator}`);
            }
        },
        FieldValueComponent: TextField,
        FieldOperand2Component: TextOperand,
    };
};


/////////////////////////////////////////////////////////////////////////////////////////////


type ModelType = {
    boolQuestions: (boolean | null)[],
    textQuestions: (string | null)[],
    intQuestions: (number | null)[],
    floatQuestions: (number | null)[],
    colorQuestions: (string | null)[],
};

function getModelBinding(args: {
    model: ModelType,
    flowDef: WorkflowDef,
    nodeDef: WorkflowNodeDef,
    tidiedNodeInstance: WorkflowTidiedNodeInstance,
    setModel: (newModel: ModelType) => void,
    setOperand2: (newOperand: unknown) => void,
}): WFFieldBinding<unknown> {
    const [name, indexStr] = (args.nodeDef.fieldName || ":").split(":");
    const index = parseInt(indexStr!);
    switch (name) {
        case "bool":
            return MakeBoolBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel.boolQuestions[index] = val;
                    args.setModel(newModel);
                },
                setOperand2: args.setOperand2,
                value: valueOr(args.model.boolQuestions[index], null, null),
            });
        case "text":
            return MakeTextBinding({
                tidiedNodeInstance: args.tidiedNodeInstance,
                flowDef: args.flowDef,
                nodeDef: args.nodeDef,
                setValue: (val) => {
                    const newModel = { ...args.model };
                    newModel.textQuestions[index] = val;
                    args.setModel(newModel);
                },
                setOperand2: args.setOperand2,
                value: args.model.textQuestions[index] || "",
            });
        default:
            throw new Error(`unknown field name ${args.nodeDef.fieldName}`);
    }
};

const MakeEmptyModel = (): ModelType => ({
    boolQuestions: [null, null, null],
    textQuestions: [null, null, null],
    intQuestions: [null, null, null],
    floatQuestions: [null, null, null],
    colorQuestions: [null, null, null],
});

/////////////////////////////////////////////////////////////////////////////////////////////
const MainContent = () => {
    const [workflowDef, setWorkflowDef] = React.useState<WorkflowDef>(minimalWorkflow as any);
    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
        //console.log(`creating NEW blank instance`);
        return WorkflowInitializeInstance(workflowDef);
    });

    const [model, setModel] = React.useState<ModelType>(MakeEmptyModel);

    const setOperand2 = (nodeDefId: number, newOperand: unknown) => {
        const nd = workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
        nd.fieldValueOperand2 = newOperand;
        setWorkflowDef({ ...workflowDef });
        setWorkflowInstance({ ...workflowInstance }); // trigger re-eval
    };

    const instanceMutator: WorkflowInstanceMutator = {
        DoesFieldValueSatisfyCompletionCriteria: ({ flowDef, nodeDef, tidiedNodeInstance, assignee }): boolean => {
            const binding = getModelBinding({
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
        RegisterStateChange: (args) => {
            console.log(`todo: RegisterStateChange`);
        },
        GetModelFieldNames: (args) => {
            return [
                `bool:0`,
                `bool:1`,
                `bool:2`,
                `text:0`,
                `text:1`,
                `text:2`,
            ];
        },
        ResetModelAndInstance: () => {
            setModel(MakeEmptyModel());
            setWorkflowInstance(WorkflowInitializeInstance(workflowDef));
        },
    };

    const renderer: WorkflowRenderer = {
        RenderFieldValueForNode: ({ flowDef, nodeDef, editable, evaluatedNode, setWorkflowInstance }) => {
            const binding = getModelBinding({
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModel: (value) => {
                    setModel(value);
                    setWorkflowInstance({ ...workflowInstance }); // trigger reeval when the model changes. important lel
                },
                setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.FieldValueComponent(binding);
        },
        RenderEditorForFieldOperand2: ({ flowDef, nodeDef, evaluatedNode, setValue }) => {
            const binding = getModelBinding({
                model,
                flowDef,
                nodeDef,
                tidiedNodeInstance: evaluatedNode,
                setModel: (value) => {
                    throw new Error(`should not be called from here.`);
                },
                setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
            });
            return binding.FieldOperand2Component(binding);
        }
    };

    return <div>
        <InspectObject src={model} label="Model" />
        <InspectObject src={workflowInstance} label="Instance" />
        <EvaluatedWorkflowProvider
            flowDef={workflowDef}
            flowInstance={workflowInstance}
            instanceMutator={instanceMutator}
            renderer={renderer}
            setWorkflowDef={setWorkflowDef}
            setWorkflowInstance={(v) => {
                console.log(`setting workflow instance`);
                setWorkflowInstance(v);
            }}
        >
            <WorkflowEditorPOC />
        </EvaluatedWorkflowProvider>
    </div>;
};

const WorkflowTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Workflow test" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    );
};

export default WorkflowTestPage;
