import React from "react";
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { WorkflowDef, WorkflowEvaluatedNode, WorkflowFieldValueOperator, WorkflowInitializeInstance, WorkflowInstance, WorkflowInstanceMutator } from "shared/workflowEngine";
import { WorkflowEditorPOC } from "src/core/components/WorkflowEditorGraph";
import { EvaluatedWorkflowProvider, WorkflowRenderer } from "src/core/components/WorkflowUserComponents";
import { CMSmallButton } from "src/core/components/CMCoreComponents2";



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
            "name": "question #1",
            "groupDefId": 1000,
            "displayStyle": "Normal",
            "completionCriteriaType": "fieldValue",
            "activationCriteriaType": "always",
            "relevanceCriteriaType": "always",
            "fieldName": "question1",
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
            "fieldName": "question2",
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
            "fieldName": "question3",
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




const MainContent = () => {
    const [workflowDef, setWorkflowDef] = React.useState<WorkflowDef>(minimalWorkflow as any);
    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
        //console.log(`creating NEW blank instance`);
        return WorkflowInitializeInstance(workflowDef);
    });

    const [model, setModel] = React.useState({
        question1: false,
        question2: false,
        changeSerial: 0,
    });

    const instanceMutator: WorkflowInstanceMutator = {
        DoesFieldValueSatisfyCompletionCriteria: (args): boolean => {
            const nodeDef = args.flowDef.nodeDefs.find(nd => nd.id === args.node.nodeDefId)!;
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
        RegisterStateChange: (args) => {
            // TODO
        },
        GetModelFieldNames: (args) => Object.keys(model),
    };

    const renderer: WorkflowRenderer = {
        RenderFieldEditorForNode: (args) => {
            const nodeDef = args.flowDef.nodeDefs.find(nd => nd.id === args.node.nodeDefId)!;
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
    };

    return <div>
        <EvaluatedWorkflowProvider
            flowDef={workflowDef}
            flowInstance={workflowInstance}
            instanceMutator={instanceMutator}
            renderer={renderer}
            setWorkflowDef={setWorkflowDef}
            setWorkflowInstance={setWorkflowInstance}
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
