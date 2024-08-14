// the non-react-flow editing components of workflow. WorkflowVisualEditor depends on this.

import { XYPosition } from "@xyflow/react";
import { getHashedColor, sortBy } from "shared/utils";
import { EvaluatedWorkflow, WorkflowCompletionCriteriaType, WorkflowDef, WorkflowEvaluatedNode, WorkflowFieldValueOperator, WorkflowMakeConnectionId, WorkflowNodeAssignee, WorkflowNodeDef, WorkflowNodeDependency, WorkflowNodeDisplayStyle, WorkflowNodeEvaluation, WorkflowNodeGroupDef, WorkflowNodeProgressState } from "shared/workflowEngine";
import { CMTextField, CMTextInputBase } from "./CMTextField";
import { NameValuePair } from "./CMCoreComponents2";
import { ChipSelector, EnumChipSelector } from "./ChipSelector";
import { ColorPick } from "./Color";
import { gGeneralPaletteList } from "shared/color";
import { CMChip, CMChipContainer } from "./CMCoreComponents";
import { WorkflowNodeProgressIndicator } from "./WorkflowUserComponents";

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
    position: XYPosition;
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
    position: XYPosition;
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

type WorkflowDefMutator_MutatorFn<T> = (args: WorkflowDefMutator_Args & T) => WorkflowDef | undefined;

export interface WorkflowDefMutator {
    // after mutations, this gets called to set state.
    setWorkflowDef: (args: { flowDef: WorkflowDef }) => void;

    deselectAll: WorkflowDefMutator_MutatorFn<{}>;

    // take the incoming source workflow def and output a mutated version. if no mutation, return undefined. that's important to avoid endless state loop
    addNode: (args: WorkflowDefMutator_AddNodeArgs) => WorkflowDef | undefined;
    deleteNode: (args: WorkflowDefMutator_DeleteNodeArgs) => WorkflowDef | undefined;
    setNodeSelected: (args: WorkflowDefMutator_SetNodeSelectedArgs) => WorkflowDef | undefined;
    setNodePosition: (args: WorkflowDefMutator_SetNodePositionArgs) => WorkflowDef | undefined;
    setNodeSize: (args: WorkflowDefMutator_SetNodeSizeArgs) => WorkflowDef | undefined;

    setNodeBasicInfo: (args: WorkflowDefMutator_SetNodeBasicInfoArgs) => WorkflowDef | undefined;
    setNodeGroup: (args: WorkflowDefMutator_SetNodeGroupArgs) => WorkflowDef | undefined;
    setNodeFieldInfo: WorkflowDefMutator_MutatorFn<{
        nodeDef: WorkflowNodeDef,
        fieldName: string | undefined;
        fieldValueOperator: WorkflowFieldValueOperator | undefined;
        fieldValueOperand2: unknown; // for things like less than, equals, whatever.
    }>;
    setNodeRelevanceCriteriaType: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeActivationCriteriaType: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeCompletionCriteriaType: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, criteriaType: WorkflowCompletionCriteriaType }>;
    setNodeDefaultAssignees: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, defaultAssignees: WorkflowNodeAssignee[] }>;
    setNodeDefaultDueDateMsAfterStarted: WorkflowDefMutator_MutatorFn<{ nodeDef: WorkflowNodeDef, defaultDueDateDurationMsAfterStarted?: number | undefined }>;

    setEdgeInfo: WorkflowDefMutator_MutatorFn<{
        sourceNodeDef: WorkflowNodeDef,
        targetNodeDef: WorkflowNodeDef,
        //dependencyDef: WorkflowNodeDependency,
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


export function WorkflowChainMutations(
    initialWorkflowDef: WorkflowDef,
    mutators: ((workflowDef: WorkflowDef) => WorkflowDef | undefined)[]
): { changesOccurred: boolean, flowDef: WorkflowDef } {
    let currentWorkflowDef: WorkflowDef | undefined = initialWorkflowDef;
    let changesOccurred: boolean = false;

    for (const mutator of mutators) {
        if (currentWorkflowDef) {
            const mutatedWorkflowDef = mutator(currentWorkflowDef);
            if (mutatedWorkflowDef) {
                changesOccurred = true;
                currentWorkflowDef = mutatedWorkflowDef;
            }
        }
    }
    return {
        changesOccurred,
        flowDef: currentWorkflowDef,
    };
}
/////////////////////////////////////////////////////////////////////////////////////////////













interface NodeDependencyEditorProps {
    evaluatedWorkflow: EvaluatedWorkflow;
    workflowDef: WorkflowDef;
    targetNodeDef: WorkflowNodeDef;
    value: WorkflowNodeDependency;
    defMutator: WorkflowDefMutator;
};
const NodeDependencyEditor = (props: NodeDependencyEditorProps) => {
    const connId = WorkflowMakeConnectionId(props.value.nodeDefId, props.targetNodeDef.id);
    const style = { "--hashed-color": getHashedColor(connId) };
    const sourceNodeDef = props.workflowDef.nodeDefs.find(n => n.id === props.value.nodeDefId)!;
    return <div style={style as any} className="NodeDependencyEditor">
        <div className="dependencyHeader">
            <div className="WorkflowNodeDependencyHandle"></div>
            <div className="dependencyName">{sourceNodeDef.name}</div>
        </div>
        <CMChipContainer>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesRelevance, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={() => {
                    const r = WorkflowChainMutations({ ...props.workflowDef }, [
                        (sourceDef) => props.defMutator.setEdgeInfo({
                            sourceDef,
                            targetNodeDef: props.targetNodeDef,
                            sourceNodeDef: sourceNodeDef,
                            determinesRelevance: !props.value.determinesRelevance,
                        }),
                    ]);
                    if (r.changesOccurred) {
                        props.defMutator.setWorkflowDef({ flowDef: r.flowDef });
                    }
                }}
            >Makes relevant</CMChip>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesActivation, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={() => {
                    const r = WorkflowChainMutations({ ...props.workflowDef }, [
                        (sourceDef) => props.defMutator.setEdgeInfo({
                            sourceDef,
                            targetNodeDef: props.targetNodeDef,
                            sourceNodeDef: sourceNodeDef,
                            determinesActivation: !props.value.determinesActivation,
                        }),
                    ]);
                    if (r.changesOccurred) {
                        props.defMutator.setWorkflowDef({ flowDef: r.flowDef });
                    }
                }}
            >Makes active</CMChip>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesCompleteness, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={() => {
                    const r = WorkflowChainMutations({ ...props.workflowDef }, [
                        (sourceDef) => props.defMutator.setEdgeInfo({
                            sourceDef,
                            targetNodeDef: props.targetNodeDef,
                            sourceNodeDef: sourceNodeDef,
                            determinesCompleteness: !props.value.determinesCompleteness,
                        }),
                    ]);
                    if (r.changesOccurred) {
                        props.defMutator.setWorkflowDef({ flowDef: r.flowDef });
                    }
                }}
            >Makes progress</CMChip>
        </CMChipContainer>
    </div>;
};



interface WorkflowNodeEditorProps {
    evaluatedWorkflow: EvaluatedWorkflow;
    workflowDef: WorkflowDef;
    nodeDef: WorkflowNodeDef;
    highlightDependencyNodeDef?: WorkflowNodeDef | undefined;
    defMutator: WorkflowDefMutator;
};

export const WorkflowNodeEditor = (props: WorkflowNodeEditorProps) => {
    const relevanceDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesRelevance);
    const activationDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesActivation);
    const completionDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesCompleteness);
    const usesNodeDependencies = (t: WorkflowCompletionCriteriaType) => [WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(t);
    const relevanceUsesNodeDependencies = usesNodeDependencies(props.nodeDef.relevanceCriteriaType);
    const activationUsesNodeDependencies = usesNodeDependencies(props.nodeDef.activationCriteriaType);
    const completionUsesNodeDependencies = usesNodeDependencies(props.nodeDef.completionCriteriaType);
    const getNodeDef = (nodeDefId: number) => props.workflowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    const getEvaluatedNode = (nodeDefId: number) => props.evaluatedWorkflow.evaluatedNodes.find(en => en.nodeDefId === nodeDefId)!;
    const evaluated = getEvaluatedNode(props.nodeDef.id);
    const requiredAssignees = props.nodeDef.defaultAssignees.filter(a => a.isRequired);
    const optionalAssignees = props.nodeDef.defaultAssignees.filter(a => !a.isRequired);

    const groupOptions = [{ value: null, label: "<none>" }, ...sortBy(props.workflowDef.groupDefs, g => g.position.y).map(g => ({ value: g.id, label: g.name, color: g.color }))];

    return <div className="CMWorkflowNodeEditorContainer">

        <NameValuePair
            name={`Step / node #${props.nodeDef.id}`}
            value={
                <CMTextField
                    className="nodeNameInput"
                    autoFocus={false}
                    value={props.nodeDef.name}
                    onChange={(e, v) => {
                        const newFlow = props.defMutator.setNodeBasicInfo({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            name: v,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                />
            }
        />

        <NameValuePair
            name={"Group"}
            value={<>
                <ChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeGroup({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            groupDefId: val || null,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    options={groupOptions}
                    value={props.nodeDef.groupDefId}
                />
            </>}
        />

        <NameValuePair
            name="Dependencies"
            value={<>
                {
                    props.nodeDef.nodeDependencies.map(nd => <NodeDependencyEditor
                        key={nd.nodeDefId}
                        value={nd}
                        defMutator={props.defMutator}
                        evaluatedWorkflow={props.evaluatedWorkflow}
                        targetNodeDef={props.nodeDef}
                        workflowDef={props.workflowDef}
                    />)
                }
            </>}
        />

        <NameValuePair
            name={"Relevance"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeRelevanceCriteriaType({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.relevanceCriteriaType}
                    filterOption={option => {
                        return option.value !== WorkflowCompletionCriteriaType.fieldValue; // field value not supported for relevance / activation.
                    }}
                />

                {(() => {
                    switch (props.nodeDef.relevanceCriteriaType) {
                        case WorkflowCompletionCriteriaType.never:
                            return <div className="criteriaDescription alert">This node will never be relevant. Maybe an error?</div>;
                        case WorkflowCompletionCriteriaType.always:
                            return <div className="criteriaDescription">This node will always be a part of the flow.</div>;
                        case WorkflowCompletionCriteriaType.fieldValue:
                            return <div className="criteriaDescription error">Field value relevance makes no sense and is not supported.</div>;
                        case WorkflowCompletionCriteriaType.someNodesComplete:
                            {
                                if (relevanceDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect relevance for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will become a part of the flow when any of the following dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (relevanceDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect relevance for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will become a part of the flow when all of the following dependencies are completed.</div>;
                            }
                    }
                })()}

                {!relevanceUsesNodeDependencies && (relevanceDependencies.length > 0) && <div className="alert">There are nodes configured to affect relevance, but relevance style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}

                <ul>
                    {relevanceDependencies.map(d => {
                        const en = getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {getNodeDef(d.nodeDefId).name} <WorkflowNodeProgressIndicator value={en.evaluation} /> {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
                <div>--&gt; {evaluated.evaluation.relevanceSatisfied ? "satisfied" : "incomplete"}</div>
            </>
            }
        />

        <NameValuePair
            name={"Activation"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeActivationCriteriaType({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.activationCriteriaType}
                    filterOption={option => {
                        return option.value !== WorkflowCompletionCriteriaType.fieldValue; // field value not supported for relevance / activation.
                    }}
                />

                {(() => {
                    switch (props.nodeDef.activationCriteriaType) {
                        case WorkflowCompletionCriteriaType.never:
                            return <div className="criteriaDescription alert">This node will never be active. Maybe an error?</div>;
                        case WorkflowCompletionCriteriaType.always:
                            return <div className="criteriaDescription">This node will always be actionable.</div>;
                        case WorkflowCompletionCriteriaType.fieldValue:
                            return <div className="criteriaDescription error">Field value activation makes no sense and is not supported.</div>;
                        case WorkflowCompletionCriteriaType.someNodesComplete:
                            {
                                if (activationDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect activation for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will become actionable when any of the following dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (activationDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect activation for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will become actionable when all of the following dependencies are completed.</div>;
                            }
                    }
                })()}

                {!activationUsesNodeDependencies && (activationDependencies.length > 0) && <div className="alert">There are nodes configured to affect activation, but activation style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}

                <ul>
                    {activationDependencies.map(d => {
                        const en = getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {getNodeDef(d.nodeDefId).name} <WorkflowNodeProgressIndicator value={en.evaluation} /> {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
                <div>--&gt; {evaluated.evaluation.activationSatisfied ? "satisfied" : "incomplete"}</div>
            </>}
        />

        <NameValuePair
            name={"Completion"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeCompletionCriteriaType({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.completionCriteriaType}
                />

                {props.nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue &&
                    <div>
                        <b>Field</b>
                        <div>{props.nodeDef.fieldName}</div>
                        <div>Operator: {props.nodeDef.fieldValueOperator}</div>
                        {/* {props.nodeDef.fieldValueOperand2} */}
                    </div>
                }

                {(() => {
                    switch (props.nodeDef.completionCriteriaType) {
                        case WorkflowCompletionCriteriaType.never:
                            return <div className="criteriaDescription alert">This node will never be complete. Maybe an error?</div>;
                        case WorkflowCompletionCriteriaType.always:
                            return <div className="criteriaDescription">This node will always be completed.</div>;
                        case WorkflowCompletionCriteriaType.fieldValue:
                            return <div className="criteriaDescription">This node is complete when the field value meets criteria. Make sure you complete field configuration.</div>;
                        case WorkflowCompletionCriteriaType.someNodesComplete:
                            {
                                if (activationDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect completion for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will complete when any of the following dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (activationDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect completion for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will complete when all of the following dependencies are completed.</div>;
                            }
                    }
                })()}

                {!completionUsesNodeDependencies && (completionDependencies.length > 0) && <div className="alert">There are nodes configured to affect completion, but completion style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}
                {(props.nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue) && (!props.nodeDef.fieldName) && <div className="alert">! completion depends on a field value, but none is specified.</div>}

                <ul>
                    {completionDependencies.map(d => {
                        const en = getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {getNodeDef(d.nodeDefId).name} <WorkflowNodeProgressIndicator value={en.evaluation} /> {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
                <div>--&gt; {evaluated.evaluation.completenessSatisfied ? "satisfied" : "incomplete"}</div>
            </>}
        />

        <NameValuePair
            name={"Default assignees"}
            value={<>
                <h4>Required</h4>
                <ul>
                    {requiredAssignees.length === 0 ? "<none>" : requiredAssignees.map(a => <span key={a.userId}>{a.userId} </span>)}
                </ul>
                <h4>Optional</h4>
                <ul>
                    {optionalAssignees.length === 0 ? "<none>" : optionalAssignees.map(a => <span key={a.userId}>{a.userId} </span>)}
                </ul>
            </>}
        />

        <NameValuePair
            name={"Default due date set"}
            value={props.nodeDef.defaultDueDateDurationMsAfterStarted || "(none)"}
        />

        <NameValuePair
            name={"Display style"}
            value={<>
                <EnumChipSelector
                    editable={true}
                    onChange={(val) => {
                        const newFlow = props.defMutator.setNodeBasicInfo({
                            sourceDef: { ...props.workflowDef },
                            nodeDef: props.nodeDef,
                            displayStyle: val || WorkflowNodeDisplayStyle.Normal,
                        });
                        if (newFlow) {
                            props.defMutator.setWorkflowDef({ flowDef: newFlow });
                        }
                    }}
                    enumObj={WorkflowNodeDisplayStyle}
                    value={props.nodeDef.displayStyle}
                />
            </>}
        />

        <NameValuePair
            name={"Weight"}
            value={props.nodeDef.thisNodeProgressWeight}
        />

    </div>;
};


interface WorkflowGroupEditorProps {
    evaluatedWorkflow: EvaluatedWorkflow;
    workflowDef: WorkflowDef;
    groupDef: WorkflowNodeGroupDef;
    defMutator: WorkflowDefMutator;
};

export const WorkflowGroupEditor = (props: WorkflowGroupEditorProps) => {
    return <div className="CMWorkflowNodeEditorContainer">
        <h2>Group</h2>
        <NameValuePair
            name={"id"}
            value={props.groupDef.id}
        />
        <NameValuePair
            name={"Label"}
            value={<CMTextField
                autoFocus={false}
                value={props.groupDef.name}
                onChange={(e, v) => {
                    const newFlow = props.defMutator.setGroupParams({
                        sourceDef: { ...props.workflowDef },
                        groupDef: props.groupDef,
                        name: v,
                    });
                    if (newFlow) {
                        props.defMutator.setWorkflowDef({ flowDef: newFlow });
                    }
                }}
            />}
        />
        <NameValuePair
            name={"Color"}
            value={<ColorPick
                allowNull={true}
                palettes={gGeneralPaletteList}
                value={props.groupDef.color || null}
                onChange={v => {
                    const newFlow = props.defMutator.setGroupParams({
                        sourceDef: { ...props.workflowDef },
                        groupDef: props.groupDef,
                        color: v?.id,
                    });
                    if (newFlow) {
                        props.defMutator.setWorkflowDef({ flowDef: newFlow });
                    }
                }}
            />}
        />

    </div>;
};



