import { Button, FormControlLabel } from "@mui/material";
import { Background, Connection, Edge, EdgeChange, Handle, MarkerType, Node, NodeChange, NodeResizer, Position, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { nanoid } from "nanoid";
import React from "react";
import { gLightSwatchColors } from "shared/color";
import { getHashedColor } from "shared/utils";
import { EvaluatedWorkflow, EvaluateWorkflow, TidyWorkflowInstance, WorkflowCompletionCriteriaType, WorkflowDef, WorkflowEvaluatedNode, WorkflowInitializeInstance, WorkflowMakeConnectionId, WorkflowNodeDef, WorkflowNodeDisplayStyle, WorkflowNodeGroupDef } from "shared/workflowEngine";
import { SnackbarContext } from "src/core/components/SnackbarContext";
import { GetStyleVariablesForColor } from "./Color";
import { WorkflowGroupEditor, WorkflowNodeEditor } from "./WorkflowEditorDetail";
import { EvaluatedWorkflowContext, WorkflowContainer, WorkflowLogView, WorkflowNodeProgressIndicator } from "./WorkflowUserComponents";
import { InspectObject } from "./CMCoreComponents";


const makeNormalNodeId = (nodeDefId: number) => {
    return `n:${nodeDefId}`;
}

const makeGroupNodeId = (groupDefId: number) => {
    return `g:${groupDefId}`;
}

const parseNodeId = (id: string): { type: "group" | "node", defId: number } => {
    const parts = id.split(':');
    const typeChar = parts[0]!;
    const type = typeChar === 'g' ? "group" : "node";
    const defId = parseInt(parts[1]!, 10);
    return { type, defId };
};





interface FlowNodeData extends Record<string, unknown> {
    evaluatedNode?: WorkflowEvaluatedNode | undefined,
    groupDef?: WorkflowNodeGroupDef | undefined,
    flowDef: WorkflowDef,
    evaluatedWorkflow: EvaluatedWorkflow,
};
type CMFlowNode = Node<FlowNodeData>;

interface FlowNodeNormalProps {
    id: string;
    isConnectable: boolean;
    data: FlowNodeData;
};

const FlowNodeNormal = (props: FlowNodeNormalProps) => {
    const nodeDef = props.data.flowDef.nodeDefs.find(nd => nd.id === props.data.evaluatedNode!.nodeDefId)!;
    return <>
        <Handle
            type="target"
            position={Position.Top}
            //style={{ background: '#555' }}
            onConnect={(params) => console.log('handle onConnect', params)}
        />
        <div className="normalNodeContent">
            {props.data.evaluatedNode?.evaluation && <WorkflowNodeProgressIndicator value={props.data.evaluatedNode.evaluation} />}
            <div className="name">{nodeDef?.name || ""}</div>
        </div>
        <Handle
            type="source"
            position={Position.Bottom}
            isConnectable={props.isConnectable}
        />
    </>;
};

const FlowNodeGroup = (props: FlowNodeNormalProps) => {
    //const groupDef = props.data.flowDef.nodeDefs.find(nd => nd.id === props.data.evaluatedNode.nodeDefId)!;
    const vars = GetStyleVariablesForColor({ color: props.data.groupDef!.color, enabled: true, fillOption: "filled", selected: false, variation: "strong" });
    return <>
        <NodeResizer minWidth={100} minHeight={30} />
        <div className={`CMFlowGroupBackground ${vars.cssClass}`} style={vars.style}></div>
        <div className={`CMFlowGroup ${vars.cssClass}`} style={vars.style}>
            <div className="CMFlowGroupLabel">{props.data.groupDef!.name || ""}</div>
        </div>
    </>;
};


interface CMReactFlowState {
    nodes: CMFlowNode[];
    edges: Edge[];
};

const calcReactFlowObjects = (evaluatedWorkflow: EvaluatedWorkflow, flowDef: WorkflowDef): CMReactFlowState => {

    const groups: CMFlowNode[] = flowDef.groupDefs.map(group => {
        const ret: CMFlowNode = {
            position: group.position,
            selected: group.selected,
            width: group.width,
            height: group.height,
            zIndex: 100,

            // and new data
            id: makeGroupNodeId(group.id),
            hidden: false,
            type: "cmGroup",
            data: {
                evaluatedNode: undefined,
                groupDef: group,
                evaluatedWorkflow,
                flowDef,
            },
        };
        return ret;
    });

    const normalNodes: CMFlowNode[] = evaluatedWorkflow.evaluatedNodes.map((node: WorkflowEvaluatedNode) => {
        const nodeDef = flowDef.nodeDefs.find(nd => nd.id === node.nodeDefId);
        const ret: CMFlowNode = {
            position: nodeDef?.position || { x: 0, y: 0 },
            selected: nodeDef?.selected || false,
            zIndex: 150,

            extent: (nodeDef?.groupDefId) === undefined ? undefined : "parent",
            parentId: !(nodeDef?.groupDefId) ? undefined : makeGroupNodeId(nodeDef.groupDefId),

            // and new data
            id: makeNormalNodeId(node.nodeDefId),
            hidden: false,
            type: "cmNormal",
            data: {
                evaluatedNode: node,
                evaluatedWorkflow,
                flowDef,
            },
        };
        return ret;
    });

    const nodes = [...groups, ...normalNodes];

    const edges: Edge[] = flowDef.nodeDefs.flatMap((nodeDef: WorkflowNodeDef) =>
        nodeDef.nodeDependencies.map(dep => {
            const id = WorkflowMakeConnectionId(dep.nodeDefId, nodeDef.id);
            const sourceNodeDef = flowDef.nodeDefs.find(n => n.id === dep.nodeDefId)!;
            const ret: Edge = {
                selected: dep.selected,
                id,
                source: makeNormalNodeId(dep.nodeDefId),
                target: makeNormalNodeId(nodeDef.id),
                zIndex: 125,
                animated: nodeDef.selected || dep.selected || sourceNodeDef.selected,
                hidden: false,
                className: `CMEdge ${nodeDef.selected ? "CMTargetSelected" : ""} ${sourceNodeDef.selected ? "CMSourceSelected" : ""}`,
                style: { "--hashed-color": getHashedColor(id, { alpha: (nodeDef.selected || dep.selected || sourceNodeDef.selected) ? "100%" : "33%" }) } as any,
                markerEnd: {
                    type: MarkerType.ArrowClosed,
                    width: 20,
                    height: 20,
                },
            };
            return ret;
        })
    );

    return {
        nodes,
        edges,
    }
};

const gNodeTypes = {
    cmNormal: FlowNodeNormal,
    cmGroup: FlowNodeGroup,
};

interface WorkflowReactFlowEditorProps {
}

const WorkflowReactFlowEditor: React.FC<WorkflowReactFlowEditorProps> = ({ ...props }) => {
    const ctx = React.useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const { showMessage: showSnackbar } = React.useContext(SnackbarContext);

    const reactFlow = useReactFlow();

    const s = calcReactFlowObjects(ctx.evaluatedFlow, ctx.flowDef);//, props.reactFlowState);

    const getGroupDef__ = (id: number) => {
        return ctx.flowDef.groupDefs.find(g => g.id === id)!;
    }

    const getNodeDef__ = (id: number) => {
        return ctx.flowDef.nodeDefs.find(g => g.id === id)!;
    }

    interface ParsedGroupDef {
        type: "group";
        groupDef: WorkflowNodeGroupDef;
    };
    interface ParsedNodeDef {
        type: "node";
        nodeDef: WorkflowNodeDef;
    };

    const getDef = (id: string): (ParsedNodeDef | ParsedGroupDef) & { defId: number } => {
        const p = parseNodeId(id);
        if (p.type === "group") {
            return {
                type: p.type,
                defId: p.defId,
                groupDef: getGroupDef__(p.defId),
            }
        }
        return {
            type: p.type,
            defId: p.defId,
            nodeDef: getNodeDef__(p.defId),
        }
    };

    const parseConnectionId = (id: string) => {
        const parts = id.split(':');
        const srcNodeDefId = parseInt(parts[0]!, 10);
        const targetNodeDefId = parseInt(parts[1]!, 10);
        return { srcNodeDef: getNodeDef__(srcNodeDefId), targetNodeDef: getNodeDef__(targetNodeDefId) };
    };

    const handleNodesChange = (changes: NodeChange<CMFlowNode>[]) => {
        let mutatingDef: WorkflowDef = { ...ctx.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        changes.forEach(change => {
            if (change.type === 'position' && change.position) {
                const parsedDef = getDef(change.id);
                if (!isNaN(change.position.x) && !isNaN(change.position.y))// why is this even a thing? but it is.
                {
                    if (parsedDef.type === "group") {
                        applyMutation(ctx.flowDefMutator.setGroupPosition({
                            sourceDef: mutatingDef,
                            groupDef: parsedDef.groupDef,
                            position: change.position
                        }));
                    } else {
                        applyMutation(ctx.flowDefMutator.setNodePosition({
                            sourceDef: mutatingDef,
                            nodeDef: parsedDef.nodeDef,
                            position: change.position
                        }));
                    }
                }
            }

            if (change.type === 'dimensions' && change.dimensions) {
                const parsedDef = getDef(change.id);
                if (!isNaN(change.dimensions.height) && !isNaN(change.dimensions.width)) // this may not be necessary
                {
                    if (parsedDef.type === "group") {
                        applyMutation(ctx.flowDefMutator.setGroupSize({
                            sourceDef: mutatingDef,
                            groupDef: parsedDef.groupDef,
                            height: change.dimensions.height,
                            width: change.dimensions.width,
                        }));
                    } else {
                        applyMutation(ctx.flowDefMutator.setNodeSize({
                            sourceDef: mutatingDef,
                            nodeDef: parsedDef.nodeDef,
                            height: change.dimensions.height,
                            width: change.dimensions.width,
                        }));
                    }
                }
            }
            if (change.type === "select" && change.selected !== undefined) {
                const parsedDef = getDef(change.id);
                if (parsedDef.type === "group") {
                    applyMutation(ctx.flowDefMutator.setGroupSelected({
                        sourceDef: mutatingDef,
                        groupDef: parsedDef.groupDef,
                        selected: change.selected,
                    }));
                } else {
                    applyMutation(ctx.flowDefMutator.setNodeSelected({
                        sourceDef: mutatingDef,
                        nodeDef: parsedDef.nodeDef,
                        selected: change.selected,
                    }));
                }
            }
            if (change.type === "remove") {
                const parsedDef = getDef(change.id);
                if (parsedDef.type === "group") {
                    applyMutation(ctx.flowDefMutator.deleteGroup({
                        sourceDef: mutatingDef,
                        groupDef: parsedDef.groupDef,
                    }));
                } else {
                    applyMutation(ctx.flowDefMutator.deleteNode({
                        sourceDef: mutatingDef,
                        nodeDef: parsedDef.nodeDef,
                    }));
                }
            }
        });
        if (changesOccurred) {
            ctx.setWorkflowDef(mutatingDef);
        }
    };

    const handleEdgesChange = (changes: EdgeChange[]) => {
        let mutatingDef: WorkflowDef = { ...ctx.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        changes.forEach(change => {
            switch (change.type) {
                case "add":
                    console.log(`todo: edge add`);
                    break;
                case "remove":
                    {
                        const parsed = parseConnectionId(change.id);
                        applyMutation(ctx.flowDefMutator.deleteConnection({
                            sourceDef: mutatingDef,
                            sourceNodeDef: parsed.srcNodeDef,
                            targetNodeDef: parsed.targetNodeDef,
                        }));
                        break;
                    }
                //case "replace":
                case "select":
                    {
                        const parsed = parseConnectionId(change.id);
                        applyMutation(ctx.flowDefMutator.setEdgeSelected({
                            sourceDef: mutatingDef,
                            selected: change.selected,
                            sourceNodeDef: parsed.srcNodeDef,
                            targetNodeDef: parsed.targetNodeDef,
                        }));
                        break;
                    }
            }
        });
        if (changesOccurred) {
            ctx.setWorkflowDef(mutatingDef);
        }
    };

    const handleConnect = (connection: Connection) => {
        let mutatingDef: WorkflowDef = { ...ctx.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        const parsedSource = getDef(connection.source);
        const parsedTarget = getDef(connection.target);
        if (parsedSource.type === "node" && parsedTarget.type === "node") {
            applyMutation(ctx.flowDefMutator.connectNodes({
                sourceDef: mutatingDef,
                sourceNodeDef: parsedSource.nodeDef,
                targetNodeDef: parsedTarget.nodeDef,
            }));
        }
        if (changesOccurred) {
            ctx.setWorkflowDef(mutatingDef);
        }
    };

    const clipboardCopy = async (text: string) => {
        await navigator.clipboard.writeText(text);
        showSnackbar({ severity: "success", children: `Copied ${text.length} characters to clipboard` });
    };

    return (
        <div style={{ width: '100%', height: '900px', border: '2px solid black' }}>
            <ReactFlow
                nodes={s.nodes}
                edges={s.edges}
                onNodesChange={handleNodesChange}
                onEdgesChange={handleEdgesChange}
                snapToGrid={true}
                onConnect={handleConnect}
                nodeTypes={gNodeTypes}
                onlyRenderVisibleElements={true} // not sure but this may contribute to nodes disappearing randomly?

                onBeforeDelete={async (args: { nodes: CMFlowNode[], edges: Edge[] }) => {
                    console.log(args);
                    // basically, anything that's not EXPLICITLY selected do not delete.
                    // this is to make sure deleting a group does not delete all nodes inside it.
                    const ret: {
                        nodes: CMFlowNode[],
                        edges: Edge[],
                    } = {
                        nodes: [],
                        edges: [],
                    }

                    args.edges.forEach(e => {
                        if (e.selected) ret.edges.push(e);
                    });
                    args.nodes.forEach(e => {
                        if (e.selected) ret.nodes.push(e);
                    });
                    return ret;
                }}
            >
                <div style={{ position: "absolute", zIndex: 4 }}>
                    <div>
                        <button onClick={() => {
                            console.log(ctx.flowDef);
                            clipboardCopy(JSON.stringify(ctx.flowDef, null, 2))
                        }}>
                            Copy flow definition
                        </button>
                        <button onClick={() => {
                            const n: WorkflowNodeDef = {
                                id: ctx.flowDef.nodeDefs.reduce((acc, n) => Math.max(acc, n.id), 0) + 1, // find a new ID
                                name: nanoid(),
                                groupDefId: null,
                                displayStyle: WorkflowNodeDisplayStyle.Normal,
                                completionCriteriaType: WorkflowCompletionCriteriaType.always,
                                activationCriteriaType: WorkflowCompletionCriteriaType.always,
                                relevanceCriteriaType: WorkflowCompletionCriteriaType.always,
                                defaultAssignees: [],
                                thisNodeProgressWeight: 1,
                                nodeDependencies: [],
                                position: { x: -reactFlow.getViewport().x + 100, y: -reactFlow.getViewport().y + 100 },
                                selected: true,
                                width: undefined,
                                height: undefined,
                            };
                            const r = ctx.flowDefMutator.addNode({
                                sourceDef: { ...ctx.flowDef },
                                nodeDef: n,
                            });
                            if (r) {
                                ctx.setWorkflowDef(r);
                            }
                        }}>New node</button>
                        <button onClick={() => {
                            const n: WorkflowNodeGroupDef = {
                                id: ctx.flowDef.groupDefs.reduce((acc, n) => Math.max(acc, n.id), 0) + 1, // find a new ID
                                name: nanoid(),
                                color: gLightSwatchColors.light_blue,
                                height: 200,
                                width: 200,
                                position: { x: -reactFlow.getViewport().x + 100, y: -reactFlow.getViewport().y + 100 },
                                selected: true,
                            };
                            const r = ctx.flowDefMutator.addGroup({
                                sourceDef: { ...ctx.flowDef },
                                groupDef: n,
                            });
                            if (r) {
                                ctx.setWorkflowDef(r);
                            }
                        }}>new group</button>
                    </div>
                </div>
                {/* <Controls /> */}
                <Background />
            </ReactFlow>
        </div>
    );
};





/////////////////////////////////////////////////////////////////////////////////////////////


export interface WorkflowEditorPOCProps {
};

export const WorkflowEditorPOC: React.FC<WorkflowEditorPOCProps> = (props) => {
    const ctx = React.useContext(EvaluatedWorkflowContext);
    if (!ctx) throw new Error(`Workflow context is required`);

    const [showSelectionHandles, setShowSelectionHandles] = React.useState<boolean>(false);

    const selectedNodeDef = ctx.flowDef.nodeDefs.find(nd => !!nd.selected);
    const selectedGroupDef = ctx.flowDef.groupDefs.find(nd => !!nd.selected);
    const selectedEdgeTargetNodeDef = ctx.flowDef.nodeDefs.find(nd => nd.nodeDependencies.some(d => d.selected));
    const selectedEdge = selectedEdgeTargetNodeDef ? (() => {
        const dep = selectedEdgeTargetNodeDef.nodeDependencies.find(d => d.selected)!;
        return {
            targetNodeDef: selectedEdgeTargetNodeDef,
            sourceNodeDef: ctx.flowDef.nodeDefs.find(nd => nd.id === dep.nodeDefId)!,
            dependencySpec: dep,
        };
    })() : undefined;

    //const schemaHash = GetWorkflowDefSchemaHash(ctx.flowDef);

    // why not eval every time?
    const tidiedInstance = TidyWorkflowInstance(ctx.flowInstance, ctx.flowDef);
    const newEvalFlow = EvaluateWorkflow(ctx.flowDef, tidiedInstance, ctx.instanceMutator);
    const evaluatedWorkflow = newEvalFlow;

    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            {evaluatedWorkflow && <>
                <div style={{ display: "flex", flexDirection: "row" }}>
                    <div style={{ width: "33%" }}>
                        <ReactFlowProvider>
                            <WorkflowReactFlowEditor />
                        </ReactFlowProvider>
                    </div>
                    <div style={{ width: "33%" }}>
                        {selectedNodeDef &&
                            <WorkflowNodeEditor
                                nodeDef={selectedNodeDef}
                            />
                        }
                        {selectedGroupDef &&
                            <WorkflowGroupEditor
                                groupDef={selectedGroupDef}
                            />
                        }
                        {selectedEdge &&
                            <WorkflowNodeEditor
                                nodeDef={selectedEdge.targetNodeDef}
                                highlightDependencyNodeDef={selectedEdge.sourceNodeDef}
                            />
                        }
                    </div>
                    <div style={{ width: "33%" }}>
                        <Button
                            onClick={() => {
                                ctx.instanceMutator.ResetModelAndInstance();
                            }}
                        >Reset instance & model</Button>
                        <FormControlLabel label={"Show selection handles"} control={<input type="checkbox" checked={showSelectionHandles} onChange={e => setShowSelectionHandles(e.target.checked)} />} />
                        <WorkflowContainer
                            drawNodeSelectionHandles={showSelectionHandles}
                            onClickToSelectNode={(args) => {
                                const nd = ctx.getNodeDef(args.nodeDefId);
                                ctx.chainDefMutations([
                                    (sourceDef) => ctx.flowDefMutator.deselectAll({ sourceDef }),
                                    (sourceDef) => ctx.flowDefMutator.setNodeSelected({ sourceDef, selected: true, nodeDef: nd }),
                                ]);
                            }}
                            onClickToSelectGroup={(args) => {
                                const nd = ctx.getGroupDef(args.groupDefId);
                                ctx.chainDefMutations([
                                    (sourceDef) => ctx.flowDefMutator.deselectAll({ sourceDef }),
                                    (sourceDef) => ctx.flowDefMutator.setGroupSelected({ sourceDef, selected: true, groupDef: nd }),
                                ]);
                            }}
                        />
                        <WorkflowLogView
                        />
                    </div>
                </div>
            </>}
        </div>
    );
};
