// the non-react-flow editing components of workflow. WorkflowVisualEditor depends on this.

import { useContext } from "react";
import { gGeneralPaletteList } from "shared/color";
import { getHashedColor, sortBy } from "shared/utils";
import { WorkflowCompletionCriteriaType, WorkflowMakeConnectionId, WorkflowNodeDef, WorkflowNodeDependency, WorkflowNodeDisplayStyle, WorkflowNodeGroupDef } from "shared/workflowEngine";
import { CMChip, CMChipContainer } from "./CMCoreComponents";
import { NameValuePair } from "./CMCoreComponents2";
import { CMNumericTextField, CMTextField } from "./CMTextField";
import { ChipSelector, EnumChipSelector } from "./ChipSelector";
import { ColorPick } from "./Color";
import { EvaluatedWorkflowContext, WorkflowNodeProgressIndicator } from "./WorkflowUserComponents";





interface NodeDependencyEditorProps {
    targetNodeDef: WorkflowNodeDef;
    value: WorkflowNodeDependency;
};
const NodeDependencyEditor = (props: NodeDependencyEditorProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const connId = WorkflowMakeConnectionId(props.value.nodeDefId, props.targetNodeDef.id);
    const style = { "--hashed-color": getHashedColor(connId) };
    const sourceNodeDef = ctx.getNodeDef(props.value.nodeDefId);
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
                    ctx.chainDefMutations([
                        (sourceDef) => ctx.flowDefMutator.setEdgeInfo({
                            sourceDef,
                            targetNodeDef: props.targetNodeDef,
                            sourceNodeDef: sourceNodeDef,
                            determinesRelevance: !props.value.determinesRelevance,
                        }),
                    ]);
                }}
            >Makes relevant</CMChip>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesActivation, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={() => {
                    ctx.chainDefMutations([
                        (sourceDef) => ctx.flowDefMutator.setEdgeInfo({
                            sourceDef,
                            targetNodeDef: props.targetNodeDef,
                            sourceNodeDef: sourceNodeDef,
                            determinesActivation: !props.value.determinesActivation,
                        }),
                    ]);
                }}
            >Makes active</CMChip>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesCompleteness, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={() => {
                    ctx.chainDefMutations([
                        (sourceDef) => ctx.flowDefMutator.setEdgeInfo({
                            sourceDef,
                            targetNodeDef: props.targetNodeDef,
                            sourceNodeDef: sourceNodeDef,
                            determinesCompleteness: !props.value.determinesCompleteness,
                        }),
                    ]);
                }}
            >Makes progress</CMChip>
        </CMChipContainer>
    </div>;
};



interface WorkflowNodeEditorProps {
    nodeDef: WorkflowNodeDef;
    highlightDependencyNodeDef?: WorkflowNodeDef | undefined;
};

export const WorkflowNodeEditor = (props: WorkflowNodeEditorProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const relevanceDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesRelevance);
    const activationDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesActivation);
    const completionDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesCompleteness);
    const usesNodeDependencies = (t: WorkflowCompletionCriteriaType) => [WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(t);
    const relevanceUsesNodeDependencies = usesNodeDependencies(props.nodeDef.relevanceCriteriaType);
    const activationUsesNodeDependencies = usesNodeDependencies(props.nodeDef.activationCriteriaType);
    const completionUsesNodeDependencies = usesNodeDependencies(props.nodeDef.completionCriteriaType);
    const evaluated = ctx.getEvaluatedNode(props.nodeDef.id);
    const requiredAssignees = props.nodeDef.defaultAssignees.filter(a => a.isRequired);
    const optionalAssignees = props.nodeDef.defaultAssignees.filter(a => !a.isRequired);

    const groupOptions = [{ value: null, label: "<none>" }, ...sortBy(ctx.flowDef.groupDefs, g => g.position.y).map(g => ({ value: g.id, label: g.name, color: g.color }))];

    return <div className="CMWorkflowNodeEditorContainer">

        <NameValuePair
            name={`Step / node #${props.nodeDef.id}`}
            value={
                <CMTextField
                    className="nodeNameInput"
                    autoFocus={false}
                    value={props.nodeDef.name}
                    onChange={(e, v) => {
                        ctx.chainDefMutations([
                            (def) => ctx.flowDefMutator.setNodeBasicInfo({
                                sourceDef: def,
                                nodeDef: props.nodeDef,
                                name: v,
                            })
                        ]);
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
                        ctx.chainDefMutations([
                            (def) => ctx.flowDefMutator.setNodeGroup({
                                sourceDef: def,
                                nodeDef: props.nodeDef,
                                groupDefId: val || null,
                            })
                        ]);
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
                        targetNodeDef={props.nodeDef}
                    />)
                }
            </>}
        />

        <NameValuePair
            name={`Relevance (${evaluated.evaluation.relevanceSatisfied ? "satisfied" : "incomplete"})`}
            value={<>
                <EnumChipSelector
                    editable={true}
                    size="small"
                    shape="rectangle"
                    onChange={(val) => {
                        ctx.chainDefMutations([
                            (def) => ctx.flowDefMutator.setNodeRelevanceCriteriaType({
                                sourceDef: def,
                                nodeDef: props.nodeDef,
                                criteriaType: val || WorkflowCompletionCriteriaType.always,
                            })
                        ]);
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
                        const en = ctx.getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {ctx.getNodeDef(d.nodeDefId).name} <WorkflowNodeProgressIndicator value={en.evaluation} /> {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
            </>
            }
        />

        <NameValuePair
            name={`Activation (${evaluated.evaluation.activationSatisfied ? "satisfied" : "incomplete"})`}
            value={<>
                <EnumChipSelector
                    editable={true}
                    size="small"
                    shape="rectangle"
                    onChange={(val) => {
                        const newFlow = ctx.flowDefMutator.setNodeActivationCriteriaType({
                            sourceDef: { ...ctx.flowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            ctx.setWorkflowDef(newFlow);
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
                        const en = ctx.getEvaluatedNode(d.nodeDefId);
                        return <li key={d.nodeDefId}>{d.nodeDefId}: {ctx.getNodeDef(d.nodeDefId).name} <WorkflowNodeProgressIndicator value={en.evaluation} /> {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}</li>;
                    })}
                </ul>
            </>}
        />

        <NameValuePair
            name={`Completion (${evaluated.evaluation.completenessSatisfied ? "satisfied" : "incomplete"})`}
            value={<>
                <EnumChipSelector
                    editable={true}
                    size="small"
                    shape="rectangle"
                    onChange={(val) => {
                        const newFlow = ctx.flowDefMutator.setNodeCompletionCriteriaType({
                            sourceDef: { ...ctx.flowDef },
                            nodeDef: props.nodeDef,
                            criteriaType: val || WorkflowCompletionCriteriaType.always,
                        });
                        if (newFlow) {
                            ctx.setWorkflowDef(newFlow);
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
                                if (completionDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect completion for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will complete when any of the following dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (completionDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect completion for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will complete when all of the following dependencies are completed.</div>;
                            }
                    }
                })()}

                {!completionUsesNodeDependencies && (completionDependencies.length > 0) && <div className="alert">There are nodes configured to affect completion, but completion style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}
                {(props.nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue) && (!props.nodeDef.fieldName) && <div className="alert">! completion depends on a field value, but none is specified.</div>}

                {completionUsesNodeDependencies &&
                    <ul>
                        {completionDependencies.map(d => {
                            const en = ctx.getEvaluatedNode(d.nodeDefId);
                            return <li key={d.nodeDefId}>
                                {d.nodeDefId}: {ctx.getNodeDef(d.nodeDefId).name}
                                <WorkflowNodeProgressIndicator value={en.evaluation} />
                                {d.nodeDefId === props.highlightDependencyNodeDef?.id && <div>!highlighted!</div>}
                                [{en.evaluation.completionWeightCompleted} / {en.evaluation.completionWeightTotal}]
                            </li>;
                        })}
                    </ul>
                }

                {completionUsesNodeDependencies &&
                    <div>[{evaluated.evaluation.completionWeightCompleted} / {evaluated.evaluation.completionWeightTotal}] --&gt; {evaluated.evaluation.completenessSatisfied ? "satisfied" : "incomplete"}</div>
                }

                {!completionUsesNodeDependencies && <CMNumericTextField label={`Progress weight (${props.nodeDef.thisNodeProgressWeight})`} autoFocus={false} value={props.nodeDef.thisNodeProgressWeight} onChange={(e, val) => {
                    const newFlow = ctx.flowDefMutator.setNodeBasicInfo({
                        sourceDef: { ...ctx.flowDef },
                        nodeDef: props.nodeDef,
                        thisNodeProgressWeight: val,
                    });
                    if (newFlow) {
                        ctx.setWorkflowDef(newFlow);
                    }
                }} />}
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
                        ctx.chainDefMutations([
                            (def) => ctx.flowDefMutator.setNodeBasicInfo({
                                sourceDef: def,
                                nodeDef: props.nodeDef,
                                displayStyle: val || WorkflowNodeDisplayStyle.Normal,
                            })
                        ]);
                    }}
                    enumObj={WorkflowNodeDisplayStyle}
                    value={props.nodeDef.displayStyle}
                />
            </>}
        />

    </div>;
};


interface WorkflowGroupEditorProps {
    groupDef: WorkflowNodeGroupDef;
};

export const WorkflowGroupEditor = (props: WorkflowGroupEditorProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

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
                    ctx.chainDefMutations([
                        (def) => ctx.flowDefMutator.setGroupParams({
                            sourceDef: def,
                            groupDef: props.groupDef,
                            name: v,
                        })
                    ]);
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
                    ctx.chainDefMutations([
                        (def) => ctx.flowDefMutator.setGroupParams({
                            sourceDef: def,
                            groupDef: props.groupDef,
                            color: v?.id,
                        })
                    ]);
                }}
            />}
        />

    </div>;
};



