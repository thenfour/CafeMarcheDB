// the non-react-flow editing components of workflow. WorkflowVisualEditor depends on this.

import { Button, FormControl, InputLabel, MenuItem, Select } from "@mui/material";
import React, { useContext } from "react";
import { gGeneralPaletteList } from "shared/color";
import { getHashedColor, sortBy } from "shared/utils";
import { CMChip, CMChipContainer } from "./CMChip";
import { CMSmallButton, NameValuePair } from "./CMCoreComponents2";
import { CMNumericTextField, CMTextField } from "./CMTextField";
import { ChipSelector, EnumChipSelector } from "./ChipSelector";
import { ColorPick } from "./Color";

import { WorkflowCompletionCriteriaType, WorkflowDef, WorkflowFieldValueOperator, WorkflowMakeConnectionId, WorkflowNodeDef, WorkflowNodeDependency, WorkflowNodeDisplayStyle, WorkflowNodeGroupDef } from "shared/workflowEngine";
import { EvaluatedWorkflowContext, WorkflowAssigneesSelection, WorkflowNodeProgressIndicator } from "./WorkflowUserComponents";
import { Markdown3Editor } from "./MarkdownControl3";
import { gIconMap } from "../db3/components/IconMap";
import { useConfirm } from "./ConfirmationDialog";


interface DueDateDefControlProps {
    valueDays: number | undefined;
    onChange: (val: number | undefined) => void;
};

const DueDateDefControl = (props: DueDateDefControlProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const readonly = !ctx.instanceMutator.CanCurrentUserEditDefs();
    //const [customDays, setCustomDays] = React.useState<number>(1);

    type TOption = {
        label: string;
        value: number | undefined;
    };

    let noneValue = -2;
    let noneOption = { label: "<no due date>", value: noneValue, custom: false };

    const options: TOption[] = [
        noneOption,
        { label: "Immediate", value: 0 },
        { label: "1 day", value: 1 },
        { label: "2 days", value: 2 },
        { label: "3 days", value: 3 },
        { label: "4 days", value: 4 },
        { label: "5 days", value: 5 },
        { label: "7 days", value: 7 },
        { label: "10 days", value: 10 },
        { label: "14 days", value: 14 },
        { label: "21 days", value: 21 },
        { label: "30 days", value: 30 },
    ];

    let selectedOption: TOption = noneOption;
    if (props.valueDays !== undefined) {
        let found = options.find(x => x.value === props.valueDays);
        if (found) {
            selectedOption = found;
        }
    }

    return <div className="DueDateDefControl">
        <ChipSelector<number | undefined>
            options={options}
            editable={!readonly}
            value={selectedOption.value}
            size="small"
            onChange={(val) => {
                if (val == null || (val === noneValue)) {
                    props.onChange(undefined);
                    return;
                }
                props.onChange(val);
            }}
        />
    </div>;
};


interface NodeDependencyEditorProps {
    targetNodeDef: WorkflowNodeDef;
    //evaluatedSourceNode: WorkflowEvaluatedNode;
    value: WorkflowNodeDependency;
};
const NodeDependencyEditor = (props: NodeDependencyEditorProps) => {
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    if (!ctx.instanceMutator.CanCurrentUserViewDefs()) return <div>Unauthorized to view workflow definitions</div>;
    const readonly = !ctx.instanceMutator.CanCurrentUserEditDefs();

    const connId = WorkflowMakeConnectionId(props.value.nodeDefId, props.targetNodeDef.id);
    const style = { "--hashed-color": getHashedColor(connId) };
    const sourceNodeDef = ctx.getNodeDef(props.value.nodeDefId);
    const evaluatedSourceNode = ctx.getEvaluatedNode(props.value.nodeDefId);
    return <div style={style as any} className="NodeDependencyEditor">
        <div className="dependencyHeader">
            <div className="WorkflowNodeDependencyHandle"></div>
            <div className="dependencyName">{sourceNodeDef.name}</div>
        </div>
        <CMChipContainer>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesRelevance, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={readonly ? undefined : () => {
                    ctx.chainDefMutations([
                        {
                            fn: (sourceDef: WorkflowDef) => ctx.flowDefMutator.setEdgeInfo({
                                sourceDef,
                                targetNodeDef: props.targetNodeDef,
                                sourceNodeDef: sourceNodeDef,
                                determinesRelevance: !props.value.determinesRelevance,
                            }),
                            wantsReevaluation: true,
                        }
                    ], "clicking chip - makes relevance");
                }}
            >
                {props.value.determinesRelevance ? <WorkflowNodeProgressIndicator evaluatedNode={evaluatedSourceNode} /> : null}Makes relevant
            </CMChip>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesActivation, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={readonly ? undefined : () => {
                    ctx.chainDefMutations([
                        {
                            fn: (sourceDef) => ctx.flowDefMutator.setEdgeInfo({
                                sourceDef,
                                targetNodeDef: props.targetNodeDef,
                                sourceNodeDef: sourceNodeDef,
                                determinesActivation: !props.value.determinesActivation,
                            }),
                            wantsReevaluation: true,
                        }
                    ], "clicking chip - makes active");
                }}
            >{props.value.determinesActivation ? <WorkflowNodeProgressIndicator evaluatedNode={evaluatedSourceNode} /> : null}Makes active</CMChip>
            <CMChip
                size="small"
                variation={{ selected: props.value.determinesCompleteness, enabled: true, fillOption: "filled", variation: "strong" }}
                onClick={readonly ? undefined : () => {
                    ctx.chainDefMutations([
                        {
                            fn: (sourceDef) => ctx.flowDefMutator.setEdgeInfo({
                                sourceDef,
                                targetNodeDef: props.targetNodeDef,
                                sourceNodeDef: sourceNodeDef,
                                determinesCompleteness: !props.value.determinesCompleteness,
                            }),
                            wantsReevaluation: true,
                        },
                    ], "clicking chip - makes progress");
                }}
            >{props.value.determinesCompleteness ? <WorkflowNodeProgressIndicator evaluatedNode={evaluatedSourceNode} /> : null}Makes progress</CMChip>
        </CMChipContainer>
    </div >;
};



interface WorkflowNodeEditorProps {
    nodeDef: WorkflowNodeDef;
    highlightDependencyNodeDef?: WorkflowNodeDef | undefined;
};

export const WorkflowNodeEditor = (props: WorkflowNodeEditorProps) => {

    const confirm = useConfirm();
    const ctx = useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);
    const readonly = !ctx.instanceMutator.CanCurrentUserEditDefs();

    const relevanceDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesRelevance);
    const activationDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesActivation);
    const completionDependencies = props.nodeDef.nodeDependencies.filter(d => d.determinesCompleteness);
    const usesNodeDependencies = (t: WorkflowCompletionCriteriaType) => [WorkflowCompletionCriteriaType.allNodesComplete, WorkflowCompletionCriteriaType.someNodesComplete].includes(t);
    const relevanceUsesNodeDependencies = usesNodeDependencies(props.nodeDef.relevanceCriteriaType);
    const activationUsesNodeDependencies = usesNodeDependencies(props.nodeDef.activationCriteriaType);
    const completionUsesNodeDependencies = usesNodeDependencies(props.nodeDef.completionCriteriaType);
    const evaluated = ctx.getEvaluatedNode(props.nodeDef.id);

    if (!evaluated) {
        return null;
    }

    const groupOptions = [{ value: null, label: "<none>" }, ...sortBy(ctx.flowDef.groupDefs, g => g.position.y).map(g => ({ value: g.id, label: g.name, color: g.color }))];

    if (!ctx.instanceMutator.CanCurrentUserViewDefs()) return <div>Unauthorized to view workflow definitions</div>;

    const fieldNames = ctx.instanceMutator.GetModelFieldNames({ flowDef: ctx.flowDef, nodeDef: props.nodeDef, node: ctx.getEvaluatedNode(props.nodeDef.id) });

    return <div className="CMWorkflowNodeEditorContainer">

        <NameValuePair
            name={<>
                Step / node #{props.nodeDef.id}
                <CMSmallButton onClick={async () => {
                    if (await confirm({ title: "Delete this node?" })) {
                        ctx.chainDefMutations([
                            {
                                fn: (def) => ctx.flowDefMutator.deleteNode({
                                    sourceDef: def,
                                    nodeDef: props.nodeDef,
                                }),
                                wantsReevaluation: false,
                            }
                        ], "clicked delete button on node detail editor");
                    }
                }}
                >{gIconMap.Delete()}</CMSmallButton>
            </>}
            value={
                <CMTextField
                    className="nodeNameInput"
                    autoFocus={false}
                    readOnly={readonly}
                    value={props.nodeDef.name}
                    onChange={(e, v) => {
                        ctx.chainDefMutations([
                            {
                                fn: (def) => ctx.flowDefMutator.setNodeBasicInfo({
                                    sourceDef: def,
                                    nodeDef: props.nodeDef,
                                    name: v,
                                }),
                                wantsReevaluation: false,
                            }
                        ], "changing node name");
                    }}
                />
            }
        />

        <NameValuePair
            name={`Description`}
            value={
                <Markdown3Editor
                    autoFocus={false}
                    beginInPreview={true}
                    minHeight={100}
                    //readOnly={readonly} // todo?
                    value={props.nodeDef.descriptionMarkdown}
                    onChange={(v) => {
                        ctx.chainDefMutations([
                            {
                                fn: (def) => ctx.flowDefMutator.setNodeBasicInfo({
                                    sourceDef: def,
                                    nodeDef: props.nodeDef,
                                    descriptionMarkdown: v,
                                }),
                                wantsReevaluation: false,
                            }
                        ], "changing node description");
                    }}
                />
            }
        />

        <NameValuePair
            name={"Group"}
            value={<>
                <ChipSelector
                    editable={!readonly}
                    onChange={(val) => {
                        ctx.chainDefMutations([
                            {
                                fn: (def) => ctx.flowDefMutator.setNodeGroup({
                                    sourceDef: def,
                                    nodeDef: props.nodeDef,
                                    groupDefId: val || null,
                                }),
                                wantsReevaluation: false,
                            }
                        ], "set node group");
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
                    editable={!readonly}
                    size="small"
                    shape="rectangle"
                    onChange={(val) => {
                        ctx.chainDefMutations([
                            {
                                fn: (def) => ctx.flowDefMutator.setNodeRelevanceCriteriaType({
                                    sourceDef: def,
                                    nodeDef: props.nodeDef,
                                    criteriaType: val || WorkflowCompletionCriteriaType.always,
                                }),
                                wantsReevaluation: true,
                            }
                        ], "click chip - relevance style select");
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
                                return <div className="criteriaDescription">This node will become a part of the flow when any of the dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (relevanceDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect relevance for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will become a part of the flow when all of the dependencies are completed.</div>;
                            }
                    }
                })()}

                {!relevanceUsesNodeDependencies && (relevanceDependencies.length > 0) && <div className="alert">There are nodes configured to affect relevance, but relevance style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}
            </>
            }
        />

        <NameValuePair
            name={`Activation (${evaluated.evaluation.activationSatisfied ? "satisfied" : "incomplete"})`}
            value={<>
                <EnumChipSelector
                    editable={!readonly}
                    size="small"
                    shape="rectangle"
                    onChange={(val) => {
                        ctx.chainDefMutations([
                            {
                                fn: sourceDef => ctx.flowDefMutator.setNodeActivationCriteriaType({
                                    sourceDef,
                                    nodeDef: props.nodeDef,
                                    criteriaType: val || WorkflowCompletionCriteriaType.always,
                                }),
                                wantsReevaluation: true,
                            }
                        ], "click chip - aCTIVAtion style select");
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
                                return <div className="criteriaDescription">This node will become actionable when any of the dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (activationDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect activation for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will become actionable when all of the dependencies are completed.</div>;
                            }
                    }
                })()}

                {!activationUsesNodeDependencies && (activationDependencies.length > 0) && <div className="alert">There are nodes configured to affect activation, but activation style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}
            </>}
        />

        <NameValuePair
            name={`Completion (${evaluated.evaluation.completenessSatisfied ? "satisfied" : "incomplete"})`}
            value={<>
                <EnumChipSelector
                    editable={!readonly}
                    size="small"
                    shape="rectangle"
                    onChange={(val) => {
                        ctx.chainDefMutations([
                            {
                                fn: sourceDef => ctx.flowDefMutator.setNodeCompletionCriteriaType({
                                    sourceDef,
                                    nodeDef: props.nodeDef,
                                    criteriaType: val || WorkflowCompletionCriteriaType.always,
                                }),
                                wantsReevaluation: true,
                            }
                        ], "click chip - completion style select");
                    }}
                    enumObj={WorkflowCompletionCriteriaType}
                    value={props.nodeDef.completionCriteriaType}
                />

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
                                return <div className="criteriaDescription">This node will complete when any of the dependencies are completed.</div>;
                            }
                        case WorkflowCompletionCriteriaType.allNodesComplete:
                            {
                                if (completionDependencies.length === 0) {
                                    return <div className="criteriaDescription alert">You need to configure dependencies that affect completion for this to work.</div>;
                                }
                                return <div className="criteriaDescription">This node will complete when all of the dependencies are completed.</div>;
                            }
                    }
                })()}

                {!completionUsesNodeDependencies && (completionDependencies.length > 0) && <div className="alert">There are nodes configured to affect completion, but completion style {props.nodeDef.completionCriteriaType} will just ignore them.</div>}
                {(props.nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue) && (!props.nodeDef.fieldName) && <div className="alert">! completion depends on a field value, but none is specified.</div>}

                {props.nodeDef.completionCriteriaType === WorkflowCompletionCriteriaType.fieldValue &&
                    <div>
                        <div style={{ display: "flex", alignItems: "center" }}>
                            <FormControl variant="standard">
                                <InputLabel>Field</InputLabel>
                                <Select variant="filled" readOnly={readonly} size="small" value={props.nodeDef.fieldName || fieldNames[0] || "--never-never-never-field--" /* passing in potentially undefined means MUI will think you want a controlled value rather than uncontrolled. */}
                                    onChange={readonly ? undefined : (e) => {
                                        ctx.chainDefMutations([
                                            {
                                                fn: def => ctx.flowDefMutator.setNodeFieldInfo({
                                                    sourceDef: def,
                                                    nodeDef: props.nodeDef,
                                                    fieldName: e.target.value,
                                                    fieldValueOperator: props.nodeDef.fieldValueOperator,
                                                    fieldValueOperand2: props.nodeDef.fieldValueOperand2,
                                                }),
                                                wantsReevaluation: true,
                                            }
                                        ], `setting which field`);
                                    }}>
                                    {fieldNames.map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                                </Select>
                            </FormControl>
                            <FormControl variant="standard">
                                <InputLabel>Operator</InputLabel>
                                <Select variant="filled" size="small" readOnly={readonly} value={props.nodeDef.fieldValueOperator || WorkflowFieldValueOperator.IsNotNull /* passing in potentially undefined means MUI will think you want a controlled value rather than uncontrolled. */}
                                    onChange={readonly ? undefined : (e) => {
                                        ctx.chainDefMutations([
                                            {
                                                fn: def => ctx.flowDefMutator.setNodeFieldInfo({
                                                    sourceDef: def,
                                                    nodeDef: props.nodeDef,
                                                    fieldName: props.nodeDef.fieldName,
                                                    fieldValueOperator: e.target.value as WorkflowFieldValueOperator,
                                                    fieldValueOperand2: props.nodeDef.fieldValueOperand2,
                                                }),
                                                wantsReevaluation: true,
                                            }
                                        ], `setting field operator`);
                                    }}>
                                    {Object.values(WorkflowFieldValueOperator).map(f => <MenuItem key={f} value={f}>{f}</MenuItem>)}
                                </Select>
                            </FormControl>
                            {ctx.renderer.RenderEditorForFieldOperand2({
                                flowDef: ctx.flowDef,
                                readonly,
                                nodeDef: props.nodeDef,
                                evaluatedNode: evaluated,
                                setValue: (value) => {
                                    ctx.chainDefMutations([
                                        {
                                            fn: def => ctx.flowDefMutator.setNodeFieldInfo({
                                                sourceDef: def,
                                                nodeDef: props.nodeDef,
                                                fieldName: props.nodeDef.fieldName,
                                                fieldValueOperator: props.nodeDef.fieldValueOperator,
                                                fieldValueOperand2: value,
                                            }),
                                            wantsReevaluation: true,
                                        }
                                    ], `setting operand2`);
                                }
                            })}
                        </div>
                    </div>
                }

                <CMNumericTextField
                    label={`Progress weight (${props.nodeDef.thisNodeProgressWeight})`}
                    autoFocus={false}
                    value={props.nodeDef.thisNodeProgressWeight}
                    readOnly={readonly}
                    onChange={(e, val) => {
                        ctx.chainDefMutations([
                            {
                                fn: sourceDef => ctx.flowDefMutator.setNodeBasicInfo({
                                    sourceDef,
                                    nodeDef: props.nodeDef,
                                    thisNodeProgressWeight: val,
                                }),
                                wantsReevaluation: true,
                            }
                        ], `setting node progress weight`);
                    }} />

                {completionUsesNodeDependencies &&
                    <pre>Weight: [{evaluated.evaluation.thisCompletionWeightCompleted?.toFixed(2)} / {evaluated.evaluation.thisCompletionWeightTotal.toFixed(2)}] = {evaluated.evaluation.progress01 === undefined ? "<undefined>" : (evaluated.evaluation.progress01 * 100).toFixed(0.000)}% --&gt; {evaluated.evaluation.completenessSatisfied ? "satisfied" : "incomplete"}</pre>
                }
            </>}
        />

        <NameValuePair
            name={"Default assignees"}
            value={<>
                <WorkflowAssigneesSelection
                    value={props.nodeDef.defaultAssignees}
                    showPictogram={true}
                    evaluatedNode={evaluated}
                    readonly={false}
                    onChange={value => ctx.chainDefMutations([
                        {
                            fn: sourceDef => ctx.flowDefMutator.setNodeDefaultAssignees({
                                sourceDef,
                                nodeDef: props.nodeDef,
                                defaultAssignees: value,
                            }),
                            wantsReevaluation: true,
                        }
                    ], `setting default assignees`)}
                />
            </>}
        />

        <NameValuePair
            name={`Default due date`}
            value={
                <>
                    {props.nodeDef.defaultDueDateDurationDaysAfterStarted === undefined ? "<no due date>" : `${props.nodeDef.defaultDueDateDurationDaysAfterStarted} days`}
                    <DueDateDefControl
                        valueDays={props.nodeDef.defaultDueDateDurationDaysAfterStarted}
                        onChange={value => ctx.chainDefMutations([
                            {
                                fn: sourceDef => ctx.flowDefMutator.setNodeDefaultDueDateDaysAfterStarted({
                                    sourceDef,
                                    nodeDef: props.nodeDef,
                                    defaultDueDateDurationDaysAfterStarted: value,
                                }),
                                wantsReevaluation: true,
                            }
                        ], `setting default assignees`)}
                    />
                </>
            }
        />

        <NameValuePair
            name={"Display style"}
            value={<>
                <EnumChipSelector
                    editable={!readonly}
                    onChange={(val) => {
                        ctx.chainDefMutations([
                            {
                                fn: (def) => ctx.flowDefMutator.setNodeBasicInfo({
                                    sourceDef: def,
                                    nodeDef: props.nodeDef,
                                    displayStyle: val || WorkflowNodeDisplayStyle.Normal,
                                }),
                                wantsReevaluation: false,
                            }
                        ], `setting node display style`);
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
    if (!ctx.instanceMutator.CanCurrentUserViewDefs()) return <div>Unauthorized to view workflow definitions</div>;

    const readonly = !ctx.instanceMutator.CanCurrentUserEditDefs();

    return <div className="CMWorkflowNodeEditorContainer WorkflowGroupEditor">
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
                readOnly={readonly}
                onChange={(e, v) => {
                    ctx.chainDefMutations([
                        {
                            fn: (def) => ctx.flowDefMutator.setGroupParams({
                                sourceDef: def,
                                groupDef: props.groupDef,
                                name: v,
                            }),
                            wantsReevaluation: false,
                        }
                    ], `setting GROUP name`);
                }}
            />}
        />
        <NameValuePair
            name={"Color"}
            value={<ColorPick
                allowNull={true}
                palettes={gGeneralPaletteList}
                value={props.groupDef.color || null}
                readonly={readonly}
                onChange={v => {
                    ctx.chainDefMutations([
                        {
                            fn: (def) => ctx.flowDefMutator.setGroupParams({
                                sourceDef: def,
                                groupDef: props.groupDef,
                                color: v?.id,
                            }),
                            wantsReevaluation: false,
                        }
                    ], `setting GROUP color`);
                }}
            />}
        />

    </div>;
};



