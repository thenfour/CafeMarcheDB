import React from "react";
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { WorkflowCompletionCriteriaType, WorkflowDef, WorkflowDefMutator, WorkflowEditorPOC, WorkflowFieldValueOperator, WorkflowNodeDef, WorkflowNodeDisplayStyle } from "src/core/components/WorkflowComponents";



///////////// an example workflow def /////////////////////////////////////////////////////////////////
const minimalWorkflow = {
    "id": 100,
    "name": "Minimal workflow",
    "groups": [
        {
            "id": 1000,
            "name": "all group",
            "color": "pink",
            "sortOrder": 1
        },
        {
            "id": 1001,
            "name": "results",
            "color": "red",
            "sortOrder": 2
        }
    ],
    "nodeDefs": [
        {
            "id": 500,
            "name": "question #1",
            "groupId": 1000,
            "sortOrder": 1,
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
                "x": 240,
                "y": 60
            },
            "selected": false
        },
        {
            "id": 501,
            "name": "question #2",
            "groupId": 1000,
            "sortOrder": 2,
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
                "x": 360,
                "y": 75
            },
            "selected": false
        },
        {
            "id": 502,
            "name": "question #3",
            "groupId": 1000,
            "sortOrder": 3,
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
                "x": 480,
                "y": 90
            },
            "selected": false
        },
        {
            "id": 503,
            "name": "AND When all are answered",
            "groupId": 1001,
            "sortOrder": 4,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "someNodesComplete",
            "relevanceCriteriaType": "always",
            "position": {
                "x": 450,
                "y": 270
            },
            "selected": true,
            "nodeDependencies": [
                {
                    "nodeDefId": 500,
                    "determinesActivation": true,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 501,
                    "determinesActivation": true,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 502,
                    "determinesActivation": true,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                }
            ]
        },
        {
            "id": 504,
            "name": "OR When any are answered",
            "groupId": 1001,
            "sortOrder": 5,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "allNodesComplete",
            "relevanceCriteriaType": "always",
            "position": {
                "x": 165,
                "y": 240
            },
            "selected": false,
            "nodeDependencies": [
                {
                    "nodeDefId": 500,
                    "determinesActivation": true,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 501,
                    "determinesActivation": true,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                },
                {
                    "nodeDefId": 502,
                    "determinesActivation": true,
                    "determinesCompleteness": true,
                    "determinesRelevance": false,
                    "selected": false
                }
            ]
        }
    ]
}
    ;




const MainContent = () => {
    const [workflowDef, setWorkflowDef] = React.useState<WorkflowDef>(minimalWorkflow as any);
    const defMutator: WorkflowDefMutator = {
        addNode: (args) => {
            const newFlow = { ...workflowDef };
            newFlow.nodeDefs.push(args.nodeDef);
            setWorkflowDef(newFlow);
        },
        setNodePosition: (args) => {
            const newFlow = { ...workflowDef };
            const n = newFlow.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`setting position on an unknown node huh?`);
            n.position = { ...args.position };
            setWorkflowDef(newFlow);
        },
        setNodeSelected: (args) => {
            const newFlow = { ...workflowDef };
            const n = newFlow.nodeDefs.find(n => n.id === args.nodeDef.id);
            if (!n) throw new Error(`setting selected on an unknown node huh?`);
            n.selected = args.selected;
            setWorkflowDef(newFlow);
        },
        connectNodes: (args) => {
            const newFlow = { ...workflowDef };
            const src = newFlow.nodeDefs.find(n => n.id === args.sourceNodeDef.id);
            if (!src) throw new Error(`connecting -> unknown source node huh?`);
            const dest = newFlow.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!dest) throw new Error(`connecting -> unknown dest node huh?`);
            if (dest.nodeDependencies.find(d => d.nodeDefId === src.id)) throw new Error(`connecting -> src node is already connected.`);
            dest.nodeDependencies.push({
                selected: false,
                nodeDefId: src.id,
                determinesRelevance: false,
                determinesActivation: false,
                determinesCompleteness: true,
            });
            setWorkflowDef(newFlow);
        },
        setEdgeSelected: (args) => {
            const newFlow = { ...workflowDef };
            const targetNode = newFlow.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!targetNode) throw new Error(`selecting an edge; unknown target`);
            const edge = targetNode.nodeDependencies.find(d => d.nodeDefId === args.sourceNodeDef.id);
            if (!edge) throw new Error(`selecting an edge; unknown source`);
            edge.selected = args.selected;
            setWorkflowDef(newFlow);
        },
        deleteNode: (args) => {
            const newFlow = { ...workflowDef };
            // delete any dependencies or references to this node.
            newFlow.nodeDefs.forEach(n => {
                n.nodeDependencies = n.nodeDependencies.filter(d => d.nodeDefId !== args.nodeDef.id);
            });
            newFlow.nodeDefs = newFlow.nodeDefs.filter(n => n.id !== args.nodeDef.id);
            setWorkflowDef(newFlow);
        },
        deleteConnection: (args) => {
            const newFlow = { ...workflowDef };
            const targetNode = newFlow.nodeDefs.find(n => n.id === args.targetNodeDef.id);
            if (!targetNode) throw new Error(`selecting an edge; unknown target`);
            targetNode.nodeDependencies = targetNode.nodeDependencies.filter(d => d.nodeDefId !== args.sourceNodeDef.id);
            setWorkflowDef(newFlow);
        },
    };
    return <div>
        <WorkflowEditorPOC workflowDef={workflowDef} defMutator={defMutator} />
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
