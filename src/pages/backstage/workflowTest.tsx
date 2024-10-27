import { BlitzPage } from "@blitzjs/next";
import { Permission } from "shared/permissions";
import DashboardLayout from "src/core/layouts/DashboardLayout";


// const emptyWorkflow: WorkflowDef = {
//     groupDefs: [],
//     id: -1,
//     name: "a workflow",
//     nodeDefs: [],
//     color: null,
//     description: null,
//     isDefaultForEvents: false,
//     sortOrder: 0,
// };

// const singleNode = {
//     "groupDefs": [],
//     "id": -1,
//     "name": "a workflow",
//     "nodeDefs": [
//         {
//             "id": 1,
//             "name": "-wAX2Y9mO052JCC6OGgIb",
//             "groupDefId": null,
//             "displayStyle": "Normal",
//             "completionCriteriaType": "fieldValue",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [],
//             "position": {
//                 "x": 100,
//                 "y": 100
//             },
//             "selected": true,
//             "width": 229,
//             "height": 48,
//             "fieldName": "bool:0",
//             "fieldValueOperator": "Truthy",
//             "defaultDueDateDurationDaysAfterStarted": 2
//         }
//     ]
// };


// ///////////// an example workflow def /////////////////////////////////////////////////////////////////
// const biggerWorkflow = {
//     "id": 100,
//     "name": "Minimal workflow",
//     "groupDefs": [
//         {
//             "id": 1000,
//             "name": "all group",
//             "color": "light_pink",
//             "position": {
//                 "x": 75,
//                 "y": 90
//             },
//             "width": 584,
//             "height": 194,
//             "selected": false
//         },
//         {
//             "id": 1001,
//             "name": "results",
//             "color": "light_gold",
//             "position": {
//                 "x": 75,
//                 "y": 375
//             },
//             "width": 614,
//             "height": 179,
//             "selected": false
//         },
//         {
//             "id": 1002,
//             "name": "G7Z7oi59cSR3PB_ZjvePA",
//             "color": "light_teal",
//             "height": 275,
//             "width": 620,
//             "position": {
//                 "x": 45,
//                 "y": 585
//             },
//             "selected": false
//         }
//     ],
//     "nodeDefs": [
//         {
//             "id": 500,
//             "name": "bool question #1",
//             "groupDefId": 1000,
//             "displayStyle": "Normal",
//             "completionCriteriaType": "fieldValue",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "fieldName": "bool:0",
//             "fieldValueOperator": "Truthy",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [],
//             "position": {
//                 "x": 30,
//                 "y": 30
//             },
//             "selected": false,
//             "width": 139,
//             "height": 42
//         },
//         {
//             "id": 501,
//             "name": "question #2",
//             "groupDefId": 1000,
//             "displayStyle": "Normal",
//             "defaultAssignees": [
//                 {
//                     "isRequired": false,
//                     "userId": 47
//                 },
//                 {
//                     "isRequired": false,
//                     "userId": 18
//                 },
//                 {
//                     "isRequired": false,
//                     "userId": 5
//                 },
//                 {
//                     "isRequired": false,
//                     "userId": 85
//                 },
//                 {
//                     "isRequired": false,
//                     "userId": 64
//                 },
//                 {
//                     "isRequired": false,
//                     "userId": 63
//                 }
//             ],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [],
//             "completionCriteriaType": "fieldValue",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "fieldName": "bool:1",
//             "fieldValueOperator": "Truthy",
//             "position": {
//                 "x": 165,
//                 "y": 75
//             },
//             "selected": false,
//             "width": 245,
//             "height": 48
//         },
//         {
//             "id": 502,
//             "name": "question #3",
//             "groupDefId": 1000,
//             "displayStyle": "Normal",
//             "defaultAssignees": [
//                 {
//                     "isRequired": false,
//                     "userId": 69
//                 }
//             ],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [],
//             "completionCriteriaType": "fieldValue",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "fieldName": "bool:2",
//             "fieldValueOperator": "Truthy",
//             "position": {
//                 "x": 405,
//                 "y": 135
//             },
//             "selected": false,
//             "width": 157,
//             "height": 48,
//             "defaultDueDateDurationDaysAfterStarted": 3
//         },
//         {
//             "id": 503,
//             "name": "When all are answered",
//             "groupDefId": 1001,
//             "displayStyle": "Normal",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "completionCriteriaType": "allNodesComplete",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "position": {
//                 "x": 195,
//                 "y": 75
//             },
//             "selected": true,
//             "nodeDependencies": [
//                 {
//                     "nodeDefId": 500,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true,
//                     "determinesRelevance": false,
//                     "selected": false
//                 },
//                 {
//                     "nodeDefId": 501,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true,
//                     "determinesRelevance": false,
//                     "selected": false
//                 },
//                 {
//                     "nodeDefId": 502,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true,
//                     "determinesRelevance": false,
//                     "selected": false
//                 }
//             ],
//             "width": 197,
//             "height": 48,
//             "defaultDueDateDurationDaysAfterStarted": 0
//         },
//         {
//             "id": 504,
//             "name": "Any answered?",
//             "groupDefId": 1001,
//             "displayStyle": "Normal",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "completionCriteriaType": "someNodesComplete",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "position": {
//                 "x": 30,
//                 "y": 75
//             },
//             "selected": false,
//             "nodeDependencies": [
//                 {
//                     "nodeDefId": 500,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true,
//                     "determinesRelevance": false,
//                     "selected": false
//                 },
//                 {
//                     "nodeDefId": 501,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true,
//                     "determinesRelevance": false,
//                     "selected": false
//                 },
//                 {
//                     "nodeDefId": 502,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true,
//                     "determinesRelevance": false,
//                     "selected": false
//                 }
//             ],
//             "width": 156,
//             "height": 48,
//             "defaultDueDateDurationDaysAfterStarted": 4
//         },
//         {
//             "id": 505,
//             "name": "should mirror \"ALL\"",
//             "groupDefId": 1002,
//             "displayStyle": "Normal",
//             "completionCriteriaType": "allNodesComplete",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [
//                 {
//                     "selected": false,
//                     "nodeDefId": 503,
//                     "determinesRelevance": false,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true
//                 }
//             ],
//             "position": {
//                 "x": 60,
//                 "y": 90
//             },
//             "selected": false,
//             "width": 155,
//             "height": 42
//         },
//         {
//             "id": 506,
//             "name": "ANY but can be partially",
//             "groupDefId": 1002,
//             "displayStyle": "Normal",
//             "completionCriteriaType": "someNodesComplete",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [
//                 {
//                     "selected": false,
//                     "nodeDefId": 503,
//                     "determinesRelevance": false,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true
//                 },
//                 {
//                     "selected": false,
//                     "nodeDefId": 507,
//                     "determinesRelevance": false,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true
//                 }
//             ],
//             "position": {
//                 "x": 210,
//                 "y": 165
//             },
//             "selected": false,
//             "width": 181,
//             "height": 42
//         },
//         {
//             "id": 507,
//             "name": "when 2 are answered",
//             "groupDefId": 1002,
//             "displayStyle": "Normal",
//             "completionCriteriaType": "allNodesComplete",
//             "activationCriteriaType": "always",
//             "relevanceCriteriaType": "always",
//             "defaultAssignees": [],
//             "thisNodeProgressWeight": 1,
//             "nodeDependencies": [
//                 {
//                     "selected": false,
//                     "nodeDefId": 501,
//                     "determinesRelevance": false,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true
//                 },
//                 {
//                     "selected": false,
//                     "nodeDefId": 502,
//                     "determinesRelevance": false,
//                     "determinesActivation": false,
//                     "determinesCompleteness": true
//                 }
//             ],
//             "position": {
//                 "x": 345,
//                 "y": 60
//             },
//             "selected": false,
//             "width": 167,
//             "height": 42
//         }
//     ]
// }
//     ;



// const minimalWorkflow: WorkflowDef = singleNode as any;


// /////////////////////////////////////////////////////////////////////////////////////////////


// type ModelType = {
//     boolQuestions: (boolean | null)[],
//     textQuestions: (string | null)[],
//     intQuestions: (number | null)[],
//     floatQuestions: (number | null)[],
//     colorQuestions: (string | null)[],
// };

// const MakeEmptyModel = (): ModelType => ({
//     boolQuestions: [null, null, null],
//     textQuestions: [null, null, null],
//     intQuestions: [null, null, null],
//     floatQuestions: [null, null, null],
//     colorQuestions: [null, null, null],
// });

// function getModelBinding(args: {
//     model: ModelType,
//     flowDef: WorkflowDef,
//     nodeDef: WorkflowNodeDef,
//     tidiedNodeInstance: WorkflowTidiedNodeInstance,
//     setModel?: (newModel: ModelType) => void,
//     setOperand2?: (newOperand: unknown) => void,
// }): WFFieldBinding<unknown> {
//     const [name, indexStr] = (args.nodeDef.fieldName || ":").split(":");
//     const index = parseInt(indexStr!);
//     switch (name) {
//         case "bool":
//             return MakeBoolBinding({
//                 tidiedNodeInstance: args.tidiedNodeInstance,
//                 flowDef: args.flowDef,
//                 nodeDef: args.nodeDef,
//                 setValue: (val) => {
//                     const newModel = { ...args.model };
//                     newModel.boolQuestions[index] = val;
//                     args.setModel && args.setModel(newModel);
//                 },
//                 setOperand2: args.setOperand2,
//                 value: valueOr(args.model.boolQuestions[index], null, null),
//             });
//         case "text":
//             return MakeTextBinding({
//                 tidiedNodeInstance: args.tidiedNodeInstance,
//                 flowDef: args.flowDef,
//                 nodeDef: args.nodeDef,
//                 setValue: (val) => {
//                     const newModel = { ...args.model };
//                     newModel.textQuestions[index] = val;
//                     args.setModel && args.setModel(newModel);
//                 },
//                 setOperand2: args.setOperand2,
//                 value: args.model.textQuestions[index] || "",
//             });
//         default:
//             // be flexible to this when field names are changing or you select "field value" but haven't selected a field yet so it will be undefined, etc.
//             return MakeAlwaysBinding({
//                 tidiedNodeInstance: args.tidiedNodeInstance,
//                 flowDef: args.flowDef,
//                 nodeDef: args.nodeDef,
//                 value: false,
//             });
//         //throw new Error(`unknown field name ${args.nodeDef.fieldName}`);
//     }
// };

// /////////////////////////////////////////////////////////////////////////////////////////////
// const MainContent = () => {
//     const dashboardCtx = useDashboardContext();
//     // The workflow definition is what you expect. Describes the mechanics and layout of the workflow, which can then be instantiated and used.
//     const [workflowDef, setWorkflowDef] = React.useState<WorkflowDef>(minimalWorkflow);

//     // The workflow instance is an instantiation of a workflow definition. It basically holds live state which is persisted, like assignees, comments, which is per instance rather than per definition.
//     const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
//         return WorkflowInitializeInstance(workflowDef);
//     });

//     // The model is the external data source that the workflow engine can use to determine completeness of tasks.
//     const [model, setModel] = React.useState<ModelType>(MakeEmptyModel);

//     const setOperand2 = (nodeDefId: number, newOperand: unknown) => {
//         const nd = workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
//         nd.fieldValueOperand2 = newOperand;
//         setWorkflowDef({ ...workflowDef });
//         setWorkflowInstance({ ...workflowInstance }); // trigger re-eval
//     };

//     const [evaluationTrigger, setEvaluationTrigger] = React.useState<number>(0);
//     const [evaluationReason, setEvaluationReason] = React.useState<string>("");

//     const [canViewInstances, setCanViewInstances] = React.useState<boolean>(true);
//     const [canEditInstances, setCanEditInstances] = React.useState<boolean>(true);
//     const [canViewDefs, setCanViewDefs] = React.useState<boolean>(true);
//     const [canEditDefs, setCanEditDefs] = React.useState<boolean>(true);

//     const instanceMutator: WorkflowInstanceMutator = {
//         CanCurrentUserViewInstances: () => {
//             return canViewInstances;
//             //return dashboardCtx.isAuthorized(Permission.view_workflow_instances);
//         },
//         CanCurrentUserEditInstances: () => {
//             return canEditInstances;
//             //return dashboardCtx.isAuthorized(Permission.edit_workflow_instances);
//         },
//         CanCurrentUserViewDefs: () => {
//             return canViewDefs;
//             //return dashboardCtx.isAuthorized(Permission.view_workflow_defs);
//         },
//         CanCurrentUserEditDefs: () => {
//             return canEditDefs;
//             //return dashboardCtx.isAuthorized(Permission.edit_workflow_defs);
//         },

//         DoesFieldValueSatisfyCompletionCriteria: ({ flowDef, nodeDef, tidiedNodeInstance, assignee }): boolean => {
//             const binding = getModelBinding({
//                 model,
//                 flowDef,
//                 nodeDef,
//                 tidiedNodeInstance,
//                 setModel: (newModel) => {
//                     setModel(newModel);
//                     setWorkflowInstance({ ...workflowInstance }); // trigger re-eval
//                 },
//                 setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
//             });
//             return binding.doesFieldValueSatisfyCompletionCriteria();
//         },
//         GetModelFieldNames: (args) => {
//             return [
//                 `bool:0`,
//                 `bool:1`,
//                 `bool:2`,
//                 `text:0`,
//                 `text:1`,
//                 `text:2`,
//             ];
//         },
//         // result should be equality-comparable and database-serializable
//         GetFieldValueAsString: ({ flowDef, nodeDef, node }) => {
//             const binding = getModelBinding({
//                 model,
//                 flowDef,
//                 nodeDef,
//                 tidiedNodeInstance: node,
//             });
//             return binding.valueAsString;
//         },
//         ResetModelAndInstance: () => {
//             setModel(MakeEmptyModel());
//             setWorkflowInstance(WorkflowInitializeInstance(workflowDef));
//             setEvaluationReason("ResetModelAndInstance");
//             setEvaluationTrigger(evaluationTrigger + 1);
//         },
//         SetAssigneesForNode: (args) => {
//             let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
//             if (!ni) {
//                 // evaluated nodes are instances, so this works and adds unused fields
//                 ni = { ...args.evaluatedNode };
//                 args.sourceWorkflowInstance.nodeInstances.push(ni);
//             }

//             ni.assignees = JSON.parse(JSON.stringify(args.assignees));
//             return args.sourceWorkflowInstance;
//         },
//         SetLastEvaluatedWorkflowDefId: args => {
//             if (args.sourceWorkflowInstance.lastEvaluatedWorkflowDefId === args.workflowDefId) return undefined;
//             args.sourceWorkflowInstance.lastEvaluatedWorkflowDefId = args.workflowDefId;
//             return args.sourceWorkflowInstance;
//         },
//         SetDueDateForNode: (args) => {
//             let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
//             if (!ni) {
//                 // evaluated nodes are instances, so this works and adds unused fields
//                 ni = { ...args.evaluatedNode };
//                 args.sourceWorkflowInstance.nodeInstances.push(ni);
//             }

//             if (ni.dueDate === args.dueDate) return undefined;
//             ni.dueDate = args.dueDate;
//             return args.sourceWorkflowInstance;
//         },
//         AddLogItem: (args) => {
//             args.sourceWorkflowInstance.log.push({ ...args.msg, userId: dashboardCtx.currentUser?.id || undefined });
//             return args.sourceWorkflowInstance;
//         },
//         SetNodeStatusData: (args) => {
//             let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
//             if (!ni) {
//                 // evaluated nodes are instances, so this works and adds unused fields
//                 ni = { ...args.evaluatedNode };
//                 args.sourceWorkflowInstance.nodeInstances.push(ni);
//             }
//             ni.activeStateFirstTriggeredAt = args.activeStateFirstTriggeredAt;
//             //ni.dueDate = args.dueDate;
//             ni.lastProgressState = args.lastProgressState;
//             return args.sourceWorkflowInstance;
//         },
//         SetLastFieldValue: (args) => {
//             let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
//             if (!ni) {
//                 // evaluated nodes are instances, so this works and adds unused fields
//                 ni = { ...args.evaluatedNode };
//                 args.sourceWorkflowInstance.nodeInstances.push(ni);
//             }
//             ni.lastFieldName = args.fieldName;
//             ni.lastFieldValueAsString = args.fieldValueAsString;
//             return args.sourceWorkflowInstance;
//         },
//         SetLastAssignees: (args) => {
//             let ni = args.sourceWorkflowInstance.nodeInstances.find(ni => ni.nodeDefId === args.evaluatedNode.nodeDefId);
//             if (!ni) {
//                 // evaluated nodes are instances, so this works and adds unused fields
//                 ni = { ...args.evaluatedNode };
//                 args.sourceWorkflowInstance.nodeInstances.push(ni);
//             }
//             ni.lastAssignees = args.value;
//             return args.sourceWorkflowInstance;
//         },
//         onWorkflowInstanceMutationChainComplete: (newInstance: WorkflowInstance, reEvaluationNeeded: boolean) => {
//             setWorkflowInstance(newInstance);
//             if (reEvaluationNeeded) {
//                 setEvaluationReason("instance mutator requested");
//                 setEvaluationTrigger(evaluationTrigger + 1);
//             }
//         },
//     };

//     // re-evaluate when requested
//     React.useEffect(() => {
//         // workflowInstance.log.push({
//         //     type: WorkflowLogItemType.Comment,
//         //     at: new Date(),
//         //     comment: "Evaluating due to React.useEffect[evaluationTrigger]",
//         // });

//         const x = EvaluateWorkflow(workflowDef, workflowInstance, instanceMutator, `onWorkflowDefMutationChainComplete with reason: [${evaluationReason}]`);
//         setEvaluatedInstance(x);
//     }, [evaluationTrigger]);

//     const renderer: WorkflowRenderer = {
//         RenderFieldValueForNode: ({ flowDef, nodeDef, evaluatedNode, readonly }) => {
//             const binding = getModelBinding({
//                 model,
//                 flowDef,
//                 nodeDef,
//                 tidiedNodeInstance: evaluatedNode,
//                 setModel: (value) => {
//                     setModel(value);
//                     setWorkflowInstance({ ...workflowInstance }); // trigger reeval when the model changes. important lel

//                     setEvaluationReason("model changed");
//                     setEvaluationTrigger(evaluationTrigger + 1);
//                 },
//                 setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
//             });
//             return <binding.FieldOperand2Component binding={binding} readonly={readonly} />;
//         },
//         RenderEditorForFieldOperand2: ({ flowDef, nodeDef, evaluatedNode, setValue, readonly }) => {
//             const binding = getModelBinding({
//                 model,
//                 flowDef,
//                 nodeDef,
//                 tidiedNodeInstance: evaluatedNode,
//                 setModel: (value) => {
//                     throw new Error(`should not be called from here.`);
//                 },
//                 setOperand2: (newOperand) => setOperand2(nodeDef.id, newOperand),
//             });
//             return <binding.FieldOperand2Component binding={binding} readonly={readonly} />;
//         }
//     };

//     const [evaluatedInstance, setEvaluatedInstance] = React.useState<EvaluatedWorkflow>(() => {
//         // workflowInstance.log.push({
//         //     type: WorkflowLogItemType.Comment,
//         //     at: new Date(),
//         //     comment: "initial setup in React.useState<EvaluatedWorkflow>",
//         // });
//         return EvaluateWorkflow(workflowDef, workflowInstance, instanceMutator, "initial setup in React.useState<EvaluatedWorkflow>");
//     });

//     return <div>
//         <InspectObject src={workflowDef} label="FlowDef" />
//         +
//         <InspectObject src={model} label="Model" />
//         +
//         <InspectObject src={workflowInstance} label="Instance" />
//         =
//         <InspectObject src={evaluatedInstance} label="Evaluated" />
//         <input id="canViewInstances" type="checkbox" onChange={(e) => setCanViewInstances(e.target.checked)} checked={canViewInstances} />
//         <label htmlFor="canViewInstances">Can view instances</label>
//         <input id="canEditInstances" type="checkbox" onChange={(e) => setCanEditInstances(e.target.checked)} checked={canEditInstances} />
//         <label htmlFor="canEditInstances">Can edit instances</label>
//         <input id="canViewDefs" type="checkbox" onChange={(e) => setCanViewDefs(e.target.checked)} checked={canViewDefs} />
//         <label htmlFor="canViewDefs">Can view defs</label>
//         <input id="canEditDefs" type="checkbox" onChange={(e) => setCanEditDefs(e.target.checked)} checked={canEditDefs} />
//         <label htmlFor="canEditDefs">Can edit defs</label>
//         <EvaluatedWorkflowProvider
//             flowDef={workflowDef}
//             flowInstance={workflowInstance}
//             evaluatedFlow={evaluatedInstance}
//             instanceMutator={instanceMutator}
//             renderer={renderer}
//             onWorkflowDefMutationChainComplete={(newFlowDef: WorkflowDef, reEvalRequested: boolean, reason: string) => {
//                 setWorkflowDef(newFlowDef);
//                 if (reEvalRequested) {
//                     // can't evaluate right now because state is immutable and eval depends on things that have just changed.
//                     setEvaluationReason(reason);
//                     setEvaluationTrigger(evaluationTrigger + 1);
//                 }
//             }}
//         >
//             <WorkflowEditorPOC />
//         </EvaluatedWorkflowProvider>
//     </div>;
// };

const MainContent = () => <div>obsolete</div>;

const WorkflowTestPage: BlitzPage = () => {
    return (
        <DashboardLayout title="Workflow test" basePermission={Permission.sysadmin}>
            <MainContent />
        </DashboardLayout>
    );
};

export default WorkflowTestPage;
