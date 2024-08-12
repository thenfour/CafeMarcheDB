import { Tooltip } from "@mui/material";
import { EvaluatedWorkflow, WorkflowCompletionCriteriaType, WorkflowDef, WorkflowEvalProvider, WorkflowEvaluatedNode } from "shared/workflowEngine";
import { GetStyleVariablesForColor } from "./Color";
import { sortBy } from "shared/utils";



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    evaluatedNode: WorkflowEvaluatedNode;
    api: WorkflowEvalProvider;
};


////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowNodeProps {
    flowDef: WorkflowDef;
    evaluatedNode: WorkflowEvaluatedNode;
    api: WorkflowEvalProvider;
    //selected?: boolean | undefined;
    drawSelectionHandles: boolean;
    onClickToSelect?: (() => void) | undefined;
};

export const WorkflowNodeComponent = ({ flowDef, evaluatedNode, api, ...props }: WorkflowNodeProps) => {
    // const obj = {
    //     progress: `${evaluatedNode.evaluation.progressState} (${evaluatedNode.evaluation.completenessNodesCompletedIncludingThis} / ${evaluatedNode.evaluation.completenessNodesTotalIncludingThis}) ${evaluatedNode.evaluation.progress01 === undefined ? "NA (p01=undefined)" : Math.round(evaluatedNode.evaluation.progress01 * 100)} %`,
    // };

    const nodeDef = flowDef.nodeDefs.find(nd => nd.id === evaluatedNode.nodeDefId)!;

    let activeControls: React.ReactNode = null;
    switch (nodeDef.completionCriteriaType) {
        // case WorkflowCompletionCriteriaType.never:
        //     activeControls = <div>(never complete)</div>;
        //     break;
        // case WorkflowCompletionCriteriaType.always:
        //     activeControls = <div>(always complete)</div>;
        //     break;
        // case WorkflowCompletionCriteriaType.allNodesComplete:
        //     activeControls = <div>(dependent nodes not complete)</div>;
        //     break;
        // case WorkflowCompletionCriteriaType.someNodesComplete:
        //     activeControls = <div>(no dependent nodes complete)</div>;
        //     break;
        case WorkflowCompletionCriteriaType.fieldValue:
            activeControls = api.RenderFieldEditorForNode(evaluatedNode);
    }

    return (
        <div className={`workflowNodeContainer ${evaluatedNode.evaluation.progressState} ${(props.drawSelectionHandles && nodeDef.selected) ? "selected" : "not-selected"}`}>

            <div className={`nodeName name ${props.onClickToSelect ? "selectable" : "notSelectable"}`}
                onClick={props.onClickToSelect ? (() => {
                    props.onClickToSelect!();
                }) : undefined}
            >
                {props.drawSelectionHandles && <Tooltip title="Select this node" disableInteractive>
                    <span className={`selectionHandle`}
                    ></span>
                </Tooltip>}
                {nodeDef.name} - #{evaluatedNode.nodeDefId} - {evaluatedNode.evaluation.progressState} ({evaluatedNode.evaluation.dependentNodes.length} dependencies)
            </div>
            {/* {
                evaluatedNode.evaluation.dependentNodes.length > 0 && (
                    evaluatedNode.evaluation.dependentNodes.map(n => <div key={n.nodeDefId}>#{n.nodeDefId}: {n.evaluation.progressState} / complete:{n.evaluation.isComplete ? "complete" : "not completed"}</div>)
                )
            } */}
            {/* <DebugCollapsibleText obj={evaluatedNode.evaluation} /> */}
            {/* <KeyValueDisplay data={obj} /> */}

            {/* <WorkflowNodeDueDateControl evaluatedNode={evaluatedNode} api={api} /> */}

            {activeControls}

        </div>
    );
};



////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowGroupProps {
    groupDefId: number | null;
    flowDef: WorkflowDef;
    nodeInstances: WorkflowEvaluatedNode[];
    api: WorkflowEvalProvider;
    drawNodeSelectionHandles: boolean;
    onClickToSelectNode?: ((args: { nodeDefId: number }) => void) | undefined;
    onClickToSelectGroup?: ((args: { groupDefId: number }) => void) | undefined;
};

export const WorkflowGroupComponent = (props: WorkflowGroupProps) => {
    const groupDef = props.flowDef.groupDefs.find(g => g.id === props.groupDefId) || {
        color: "gray",
        name: "ungrouped",
        id: -1334,
        selected: false,
        position: { x: 0, y: 0 },
        height: 100,
        width: 150,
    };
    const vars = GetStyleVariablesForColor({ color: groupDef.color, enabled: true, fillOption: "filled", selected: false, variation: "strong" });
    const getNodeDef = (nodeDefId: number) => props.flowDef.nodeDefs.find(nd => nd.id === nodeDefId)!;
    const filteredNodes = props.nodeInstances.filter(ni => {
        const nodeDef = props.flowDef.nodeDefs.find(n => n.id === ni.nodeDefId)!;
        return nodeDef.groupDefId === props.groupDefId;
    });
    const sortedNodes = sortBy(filteredNodes, n => getNodeDef(n.nodeDefId).position.y);
    return (
        <div className={`workflowNodeGroupContainer ${(props.drawNodeSelectionHandles && groupDef.selected) ? "selected" : "notSelected"}`} style={vars.style}
        >
            <div className="header">
                <div className={`groupName name ${props.onClickToSelectGroup ? "selectable" : "notSelectable"}`}
                    onClick={props.onClickToSelectGroup ? (() => props.onClickToSelectGroup!({ groupDefId: props.groupDefId! })) : undefined}
                >
                    {
                        // don't allow selecting the null group
                        props.drawNodeSelectionHandles && props.groupDefId &&
                        <Tooltip title="Select this group" disableInteractive>
                            <span className={`selectionHandle ${groupDef.selected ? "selected" : "not-selected"}`}>
                            </span></Tooltip>}
                    {groupDef.name}
                </div>
            </div>
            <div className="content">
                {sortedNodes.map(x => <WorkflowNodeComponent
                    flowDef={props.flowDef}
                    key={x.nodeDefId}
                    evaluatedNode={x}
                    api={props.api}
                    drawSelectionHandles={props.drawNodeSelectionHandles}
                    onClickToSelect={props.onClickToSelectNode ? () => {
                        props.onClickToSelectNode!({
                            nodeDefId: x.nodeDefId,
                        });
                    } : undefined}
                />
                )}
            </div>
        </div>
    );
};

////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
interface WorkflowContainerProps {
    flowDef: WorkflowDef;
    flow: EvaluatedWorkflow;
    api: WorkflowEvalProvider;
    drawNodeSelectionHandles: boolean;
    onClickToSelectNode?: ((args: { nodeDefId: number }) => void) | undefined;
    onClickToSelectGroup?: ((args: { groupDefId: number }) => void) | undefined;
};

export const WorkflowContainer = (props: WorkflowContainerProps) => {
    const { flow } = props;

    const sortedGroups = sortBy(props.flowDef.groupDefs, g => g.position.y);
    const ungroupedNodes = flow.evaluatedNodes.filter(node => {
        const nodeDef = props.flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
        if (!nodeDef) return false;
        return nodeDef.groupDefId === undefined;
    });

    return (
        <div className="workflowContainer">
            {
                (ungroupedNodes.length > 0) && <WorkflowGroupComponent
                    flowDef={props.flowDef}
                    groupDefId={null}
                    nodeInstances={ungroupedNodes}
                    api={props.api}
                    drawNodeSelectionHandles={props.drawNodeSelectionHandles}
                    onClickToSelectNode={props.onClickToSelectNode}
                />
            }
            {sortedGroups.map(groupDef => {
                const nodeInstances = flow.evaluatedNodes.filter(node => {
                    const nodeDef = props.flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
                    return nodeDef?.groupDefId === groupDef.id;
                });
                return (
                    <WorkflowGroupComponent
                        key={groupDef.id}
                        flowDef={props.flowDef}
                        groupDefId={groupDef.id}
                        nodeInstances={nodeInstances}
                        api={props.api}
                        drawNodeSelectionHandles={props.drawNodeSelectionHandles}
                        onClickToSelectGroup={props.onClickToSelectGroup}
                        onClickToSelectNode={props.onClickToSelectNode}
                    />
                );
            })}
        </div>
    );
};





