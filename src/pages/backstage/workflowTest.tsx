import React from "react";
import { BlitzPage } from "@blitzjs/next";
import DashboardLayout from "src/core/layouts/DashboardLayout";
import { DB3EditGrid } from "src/core/db3/components/db3DataGrid";
import * as db3 from "src/core/db3/db3";
import * as DB3Client from "src/core/db3/DB3Client";
import { SettingMarkdown } from "src/core/components/SettingMarkdown";
import { Permission } from "shared/permissions";
import { WorkflowDef } from "shared/workflowEngine";
import { WorkflowDefMutator } from "src/core/components/WorkflowEditorDetail";
import { WorkflowEditorPOC } from "src/core/components/WorkflowEditorGraph";



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
            "width": 108,
            "height": 48
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
            "width": 108,
            "height": 48
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
            "width": 108,
            "height": 48
        },
        {
            "id": 503,
            "name": "AND When all are answered",
            "groupDefId": 1001,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "someNodesComplete",
            "relevanceCriteriaType": "always",
            "position": {
                "x": 315,
                "y": 75
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
            ],
            "width": 230,
            "height": 48
        },
        {
            "id": 504,
            "name": "OR When any are answered",
            "groupDefId": 1001,
            "displayStyle": "Normal",
            "defaultAssignees": [],
            "thisNodeProgressWeight": 1,
            "completionCriteriaType": "allNodesComplete",
            "activationCriteriaType": "allNodesComplete",
            "relevanceCriteriaType": "always",
            "position": {
                "x": 30,
                "y": 75
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
            ],
            "width": 229,
            "height": 48
        }
    ]
}
    ;




const MainContent = () => {
    const [workflowDef, setWorkflowDef] = React.useState<WorkflowDef>(minimalWorkflow as any);
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
    const defMutator: WorkflowDefMutator = {
        setWorkflowDef: (args) => {
            setWorkflowDef(args.flowDef);
        },
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
