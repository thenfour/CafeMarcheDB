import React from "react";
import { Button, FormControlLabel } from "@mui/material";
import { WorkflowContainer, WorkflowNodeProgressIndicator } from "./WorkflowUserComponents";
import { Background, Connection, Edge, EdgeChange, Handle, MarkerType, Node, NodeChange, NodeResizer, Position, ReactFlow, ReactFlowProvider, useReactFlow } from "@xyflow/react";
import { EvaluatedWorkflow, EvaluateWorkflow, GetWorkflowDefSchemaHash, TidyWorkflowInstance, WorkflowCompletionCriteriaType, WorkflowDef, WorkflowInstanceMutator, WorkflowEvaluatedNode, WorkflowFieldValueOperator, WorkflowInitializeInstance, WorkflowInstance, WorkflowMakeConnectionId, WorkflowNodeDef, WorkflowNodeDisplayStyle, WorkflowNodeGroupDef } from "shared/workflowEngine";
import { GetStyleVariablesForColor } from "./Color";
import { getHashedColor } from "shared/utils";
import { WorkflowChainMutations, WorkflowDefMutator, WorkflowGroupEditor, WorkflowNodeEditor } from "./WorkflowEditorDetail";
import { InspectObject } from "./CMCoreComponents";
import { nanoid } from "nanoid";
import { gLightSwatchColors } from "shared/color";
import { CMSmallButton } from "./CMCoreComponents2";


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
    flowDef: WorkflowDef;
    evaluatedWorkflow: EvaluatedWorkflow;
    schemaHash: string;
    defMutator: WorkflowDefMutator;
}

const WorkflowReactFlowEditor: React.FC<WorkflowReactFlowEditorProps> = ({ evaluatedWorkflow, ...props }) => {

    const reactFlow = useReactFlow();

    const s = calcReactFlowObjects(evaluatedWorkflow, props.flowDef);//, props.reactFlowState);

    const getGroupDef__ = (id: number) => {
        return props.flowDef.groupDefs.find(g => g.id === id)!;
    }

    const getNodeDef__ = (id: number) => {
        return props.flowDef.nodeDefs.find(g => g.id === id)!;
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
        //console.log(changes);
        let mutatingDef: WorkflowDef = { ...props.flowDef };
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
                        applyMutation(props.defMutator.setGroupPosition({
                            sourceDef: mutatingDef,
                            groupDef: parsedDef.groupDef,
                            position: change.position
                        }));
                    } else {
                        applyMutation(props.defMutator.setNodePosition({
                            sourceDef: mutatingDef,
                            nodeDef: parsedDef.nodeDef,
                            position: change.position
                        }));
                    }
                }
            }

            if (change.type === 'dimensions' && change.dimensions) {
                //console.log(`dimensions: ${JSON.stringify(change)}`);
                const parsedDef = getDef(change.id);
                if (!isNaN(change.dimensions.height) && !isNaN(change.dimensions.width)) // this may not be necessary
                {
                    if (parsedDef.type === "group") {
                        applyMutation(props.defMutator.setGroupSize({
                            sourceDef: mutatingDef,
                            groupDef: parsedDef.groupDef,
                            height: change.dimensions.height,
                            width: change.dimensions.width,
                        }));
                    } else {
                        applyMutation(props.defMutator.setNodeSize({
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
                    applyMutation(props.defMutator.setGroupSelected({
                        sourceDef: mutatingDef,
                        groupDef: parsedDef.groupDef,
                        selected: change.selected,
                    }));
                } else {
                    applyMutation(props.defMutator.setNodeSelected({
                        sourceDef: mutatingDef,
                        nodeDef: parsedDef.nodeDef,
                        selected: change.selected,
                    }));
                }
            }
            if (change.type === "remove") {
                const parsedDef = getDef(change.id);
                if (parsedDef.type === "group") {
                    applyMutation(props.defMutator.deleteGroup({
                        sourceDef: mutatingDef,
                        groupDef: parsedDef.groupDef,
                    }));
                } else {
                    applyMutation(props.defMutator.deleteNode({
                        sourceDef: mutatingDef,
                        nodeDef: parsedDef.nodeDef,
                    }));
                }
            }
        });
        if (changesOccurred) {
            props.defMutator.setWorkflowDef({ flowDef: mutatingDef });
        }
    };

    const handleEdgesChange = (changes: EdgeChange[]) => {
        let mutatingDef: WorkflowDef = { ...props.flowDef };
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
                        applyMutation(props.defMutator.deleteConnection({
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
                        applyMutation(props.defMutator.setEdgeSelected({
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
            props.defMutator.setWorkflowDef({ flowDef: mutatingDef });
        }
    };

    const handleConnect = (connection: Connection) => {
        let mutatingDef: WorkflowDef = { ...props.flowDef };
        let changesOccurred: boolean = false;
        const applyMutation = (r: WorkflowDef | undefined) => {
            if (!r) return;
            mutatingDef = r;
            changesOccurred = true;
        };
        const parsedSource = getDef(connection.source);
        const parsedTarget = getDef(connection.target);
        if (parsedSource.type === "node" && parsedTarget.type === "node") {
            applyMutation(props.defMutator.connectNodes({
                sourceDef: mutatingDef,
                sourceNodeDef: parsedSource.nodeDef,
                targetNodeDef: parsedTarget.nodeDef,
            }));
        }
        if (changesOccurred) {
            props.defMutator.setWorkflowDef({ flowDef: mutatingDef });
        }
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
                    <InspectObject label="reactflow state" src={{
                        ...s,
                        flowDef: props.flowDef
                    }} />
                    <div>
                        <button onClick={() => {
                            const n: WorkflowNodeDef = {
                                id: props.flowDef.nodeDefs.reduce((acc, n) => Math.max(acc, n.id), 0) + 1, // find a new ID
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
                            const r = props.defMutator.addNode({
                                sourceDef: { ...props.flowDef },
                                nodeDef: n,
                            });
                            if (r) {
                                props.defMutator.setWorkflowDef({ flowDef: r });
                            }
                        }}>New node</button>
                    </div>
                    <div>
                        <button onClick={() => {
                            const n: WorkflowNodeGroupDef = {
                                id: props.flowDef.groupDefs.reduce((acc, n) => Math.max(acc, n.id), 0) + 1, // find a new ID
                                name: nanoid(),
                                color: gLightSwatchColors.light_blue,
                                height: 200,
                                width: 200,
                                position: { x: -reactFlow.getViewport().x + 100, y: -reactFlow.getViewport().y + 100 },
                                selected: true,
                            };
                            const r = props.defMutator.addGroup({
                                sourceDef: { ...props.flowDef },
                                groupDef: n,
                            });
                            if (r) {
                                props.defMutator.setWorkflowDef({ flowDef: r });
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
    workflowDef: WorkflowDef;
    defMutator: WorkflowDefMutator;
};

export const WorkflowEditorPOC: React.FC<WorkflowEditorPOCProps> = (props) => {
    const [showSelectionHandles, setShowSelectionHandles] = React.useState<boolean>(true);
    const [workflowInstance, setWorkflowInstance] = React.useState<WorkflowInstance>(() => {
        //console.log(`creating NEW blank instance`);
        return WorkflowInitializeInstance(props.workflowDef);
    });

    const [model, setModel] = React.useState({
        question1: false,
        question2: false,
        changeSerial: 0,
    });

    const selectedNodeDef = props.workflowDef.nodeDefs.find(nd => !!nd.selected);
    const selectedGroupDef = props.workflowDef.groupDefs.find(nd => !!nd.selected);
    const selectedEdgeTargetNodeDef = props.workflowDef.nodeDefs.find(nd => nd.nodeDependencies.some(d => d.selected));
    const selectedEdge = selectedEdgeTargetNodeDef ? (() => {
        const dep = selectedEdgeTargetNodeDef.nodeDependencies.find(d => d.selected)!;
        return {
            targetNodeDef: selectedEdgeTargetNodeDef,
            sourceNodeDef: props.workflowDef.nodeDefs.find(nd => nd.id === dep.nodeDefId)!,
            dependencySpec: dep,
        };
    })() : undefined;

    const provider: WorkflowInstanceMutator = {
        DoesFieldValueSatisfyCompletionCriteria: (node): boolean => {
            const nodeDef = props.workflowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
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
        RenderFieldEditorForNode: (node: WorkflowEvaluatedNode) => {
            const nodeDef = props.workflowDef.nodeDefs.find(nd => nd.id === node.nodeDefId)!;
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
        RegisterStateChange: (node: WorkflowEvaluatedNode, oldState) => {
            // TODO
        }
    };

    const schemaHash = GetWorkflowDefSchemaHash(props.workflowDef);

    // why not eval every time?
    const tidiedInstance = TidyWorkflowInstance(workflowInstance, props.workflowDef);
    const newEvalFlow = EvaluateWorkflow(props.workflowDef, tidiedInstance, provider);
    const evaluatedWorkflow = newEvalFlow;

    return (
        <div style={{ width: "100%", display: "flex", flexDirection: "column" }}>
            {evaluatedWorkflow && <>
                {/* <div>Schema hash: {schemaHash}</div>
                <div>selected node {selectedNodeDef?.id ?? "<null>"}: {evaluatedWorkflow.flowInstance.nodeInstances.find(ni => ni.nodeDefId === selectedNodeDef?.id)?.id || "<null>"}</div>
                <div>selected group {selectedGroupDef?.id ?? "<null>"}</div>
                <div>selected edge {selectedEdge ? `${selectedEdge.sourceNodeDef.id} -> ${selectedEdge.targetNodeDef.id}` : "<null>"}</div> */}
                <div style={{ display: "flex", flexDirection: "row" }}>
                    <div style={{ width: "33%" }}>
                        <ReactFlowProvider>
                            <WorkflowReactFlowEditor
                                evaluatedWorkflow={evaluatedWorkflow}
                                schemaHash={schemaHash}
                                flowDef={props.workflowDef}
                                defMutator={props.defMutator}
                            />
                        </ReactFlowProvider>
                    </div>
                    <div style={{ width: "33%" }}>
                        {selectedNodeDef &&
                            <WorkflowNodeEditor
                                workflowDef={props.workflowDef}
                                evaluatedWorkflow={evaluatedWorkflow}
                                nodeDef={selectedNodeDef}
                                defMutator={props.defMutator}
                            />
                        }
                        {selectedGroupDef &&
                            <WorkflowGroupEditor
                                workflowDef={props.workflowDef}
                                evaluatedWorkflow={evaluatedWorkflow}
                                groupDef={selectedGroupDef}
                                defMutator={props.defMutator}
                            />
                        }
                        {selectedEdge &&
                            <WorkflowNodeEditor
                                workflowDef={props.workflowDef}
                                evaluatedWorkflow={evaluatedWorkflow}
                                nodeDef={selectedEdge.targetNodeDef}
                                highlightDependencyNodeDef={selectedEdge.sourceNodeDef}
                                defMutator={props.defMutator}
                            />
                        }
                    </div>
                    <div style={{ width: "33%" }}>
                        <Button
                            onClick={() => {
                                setWorkflowInstance(WorkflowInitializeInstance(props.workflowDef));
                                // todo: reset model but we need an instanceMutator
                            }}
                        >Reset instance & model</Button>
                        <FormControlLabel label={"Show selection handles"} control={<input type="checkbox" checked={showSelectionHandles} onChange={e => setShowSelectionHandles(e.target.checked)} />} />
                        <WorkflowContainer
                            flowDef={props.workflowDef}
                            flow={evaluatedWorkflow}
                            api={provider}
                            drawNodeSelectionHandles={showSelectionHandles}
                            onClickToSelectNode={(args) => {
                                const nd = props.workflowDef.nodeDefs.find(nd => nd.id === args.nodeDefId)!;
                                const r = WorkflowChainMutations({ ...props.workflowDef }, [
                                    (sourceDef) => props.defMutator.deselectAll({ sourceDef }),
                                    (sourceDef) => props.defMutator.setNodeSelected({ sourceDef, selected: true, nodeDef: nd }),
                                ]);
                                if (r.changesOccurred) {
                                    props.defMutator.setWorkflowDef({ flowDef: r.flowDef });
                                }
                            }}
                            onClickToSelectGroup={(args) => {
                                const nd = props.workflowDef.groupDefs.find(nd => nd.id === args.groupDefId)!;
                                const r = WorkflowChainMutations({ ...props.workflowDef }, [
                                    (sourceDef) => props.defMutator.deselectAll({ sourceDef }),
                                    (sourceDef) => props.defMutator.setGroupSelected({ sourceDef, selected: true, groupDef: nd }),
                                ]);
                                if (r.changesOccurred) {
                                    props.defMutator.setWorkflowDef({ flowDef: r.flowDef });
                                }
                            }}
                        />
                    </div>
                </div>
            </>}
        </div>
    );
};
