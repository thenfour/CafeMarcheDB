// insertOrUpdateWorkflowDefMutation
import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { ComputeChangePlan } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ObjectDiff, passthroughWithoutTransaction } from "shared/utils";
import { mapWorkflowDef, TWorkflowChange, TWorkflowMutationResult, WorkflowDefToMutationArgs } from "shared/workflowEngine";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { DB3QueryCore2 } from "../server/db3QueryCore";
import { TinsertOrUpdateWorkflowDefArgs, TransactionalPrismaClient, WorkflowObjectType } from "../shared/apiTypes";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";


async function InsertOrUpdateWorkflowCoreAsync(args: TinsertOrUpdateWorkflowDefArgs, transactionalDb: TransactionalPrismaClient): Promise<TWorkflowMutationResult> {

    // NB: we will mutate args during this function to add new ids as items are inserted.

    const resultChanges: TWorkflowChange[] = [];
    const tempToRealIdMappings: { objectType: WorkflowObjectType, tempId: number, realId: number }[] = [];

    ///// WORKFLOW DEF ----------------------------------------
    if (args.id >= 0) {
        const existingWorkflow = (await transactionalDb.workflowDef.findFirst({ where: { id: args.id } }))!;
        const workflowDiff = ObjectDiff<Prisma.WorkflowDefGetPayload<{}>>(existingWorkflow, args, { ignore: [] });
        if (workflowDiff.areDifferent) {
            // Update existing workflow definition
            const newObj = await transactionalDb.workflowDef.update({
                where: { id: args.id },
                data: {
                    sortOrder: args.sortOrder,
                    name: args.name,
                    description: args.description,
                    color: args.color,
                    isDefaultForEvents: args.isDefaultForEvents,
                },
            });
            resultChanges.push({
                action: ChangeAction.update,
                pkid: newObj.id,
                objectType: WorkflowObjectType.workflow,
                oldValues: workflowDiff.differences.lhs,
                newValues: workflowDiff.differences.rhs,
            });
        }
    } else {
        // Insert new workflow definition
        const newObj = await transactionalDb.workflowDef.create({
            data: {
                sortOrder: args.sortOrder,
                name: args.name,
                description: args.description,
                color: args.color,
                isDefaultForEvents: args.isDefaultForEvents,
            },
        });
        args.id = newObj.id;
        resultChanges.push({
            action: ChangeAction.insert,
            pkid: newObj.id,
            objectType: WorkflowObjectType.workflow,
            newValues: newObj,
        });
    }

    ///// GROUPS ----------------------------------------
    // Fetch existing groups from the database
    const existingGroups = await transactionalDb.workflowDefGroup.findMany({
        where: { workflowDefId: args.id },
    });

    const desiredGroups: Prisma.WorkflowDefGroupGetPayload<{}>[] = args.groups.map(g => {
        return {
            ...g,
            workflowDefId: args.id,
        };
    });

    const groupCP = ComputeChangePlan(existingGroups, desiredGroups, (a, b) => a.id === b.id);

    const groupIdsToDelete = groupCP.delete.map(x => x.id);

    // Delete
    await transactionalDb.workflowDefGroup.deleteMany({
        where: { id: { in: groupIdsToDelete } },
    });
    resultChanges.push(...groupCP.delete.map(x => {
        return {
            action: ChangeAction.delete,
            pkid: x.id,
            objectType: WorkflowObjectType.group,
            oldValues: existingGroups.find(eg => eg.id === x.id),
        };
    }));

    // Update existing groups
    for (const groupAB of groupCP.potentiallyUpdate) {
        const { a, b } = groupAB;
        const diffResult = ObjectDiff(a, b, { ignore: ["id", "workflowDefId"] });
        if (!diffResult.areDifferent) continue;
        await transactionalDb.workflowDefGroup.update({
            where: { id: a.id },
            data: diffResult.differences.rhs,
        });
        resultChanges.push({
            action: ChangeAction.update,
            pkid: a.id,
            objectType: WorkflowObjectType.group,
            oldValues: diffResult.differences.lhs,
            newValues: diffResult.differences.rhs,
        });
    }

    // Create new groups
    for (const group of groupCP.create) {
        const { id, ...rest } = group;
        const data = { ...rest, workflowDefId: args.id };
        const newGroup = await transactionalDb.workflowDefGroup.create({ data });
        tempToRealIdMappings.push({
            objectType: WorkflowObjectType.group,
            tempId: group.id,
            realId: newGroup.id,
        });
        const resultGroup = args.groups.find(g => g.id === group.id)!;
        resultGroup.id = newGroup.id;
        resultChanges.push({
            action: ChangeAction.insert,
            pkid: newGroup.id,
            objectType: WorkflowObjectType.group,
            newValues: data,
        });

        // update references to this group id.
        for (const node of args.nodes) {
            if (node.groupId === group.id) {
                node.groupId = newGroup.id;
            }
        }
    }


    ///// NODES ----------------------------------------
    // Fetch existing nodes from the database
    const existingNodes = await transactionalDb.workflowDefNode.findMany({
        where: { workflowDefId: args.id },
    });

    const desiredNodes: Prisma.WorkflowDefNodeGetPayload<{}>[] = args.nodes.map(x => {
        const { defaultAssignees, dependencies, ...rootProps } = x;
        return {
            ...rootProps,
            fieldName: x.fieldName || null,
            fieldValueOperator: x.fieldValueOperator || null,
            fieldValueOperand2: x.fieldValueOperand2 || null,
            defaultDueDateDurationDaysAfterStarted: x.defaultDueDateDurationDaysAfterStarted || null,
            positionX: x.positionX || null,
            positionY: x.positionY || null,
            width: x.width || null,
            height: x.height || null,
            workflowDefId: args.id,
        };
    });

    const nodeCP = ComputeChangePlan(existingNodes, desiredNodes, (a, b) => a.id === b.id);

    const nodeIdsToDelete = nodeCP.delete.map(x => x.id);

    // Delete
    await transactionalDb.workflowDefNode.deleteMany({
        where: { id: { in: nodeIdsToDelete } },
    });
    resultChanges.push(...nodeCP.delete.map(x => {
        return {
            action: ChangeAction.delete,
            pkid: x.id,
            objectType: WorkflowObjectType.node,
            oldValues: existingNodes.find(eg => eg.id === x.id),
        };
    }));

    // Update
    for (const nodeAB of nodeCP.potentiallyUpdate) {
        const { a, b } = nodeAB;
        const diffResult = ObjectDiff(a, b, { ignore: ["id", "workflowDefId"] });
        if (!diffResult.areDifferent) continue;
        await transactionalDb.workflowDefNode.update({
            where: { id: a.id },
            data: diffResult.differences.rhs,
        });
        resultChanges.push({
            action: ChangeAction.update,
            pkid: a.id,
            objectType: WorkflowObjectType.node,
            oldValues: diffResult.differences.lhs,
            newValues: diffResult.differences.rhs,
        });
    }

    // Create new
    for (const node of nodeCP.create) {
        const { id, ...rest } = node;
        const data = { ...rest, workflowDefId: args.id };
        const newItem = await transactionalDb.workflowDefNode.create({ data });
        const resultNode = args.nodes.find(n => n.id === node.id)!;
        resultNode.id = newItem.id;
        resultChanges.push({
            action: ChangeAction.insert,
            pkid: newItem.id,
            objectType: WorkflowObjectType.node,
            newValues: data,
        });
        tempToRealIdMappings.push({
            objectType: WorkflowObjectType.node,
            tempId: node.id,
            realId: newItem.id,
        });

        // update references to this node id
        for (const node2 of args.nodes) {
            for (const dep of node2.dependencies) {
                if (dep.nodeDefId === node.id) {
                    dep.nodeDefId = newItem.id;
                }
            }
        }
    }


    ///// DEFAULT ASSIGNEES PER NODE ----------------------------------------
    const existingDefaultAssigneesForEntireWorkflow = await transactionalDb.workflowDefNodeDefaultAssignee.findMany({
        where: { nodeDefId: { in: args.nodes.map(n => n.id) } }
    });

    for (const node of args.nodes) {
        assert(node.id >= 0, "real IDs must be assigned at this point.");
        const existingDefaultAssignees = existingDefaultAssigneesForEntireWorkflow.filter(x => x.nodeDefId === node.id);

        const desiredObjs: Prisma.WorkflowDefNodeDefaultAssigneeGetPayload<{}>[] = node.defaultAssignees.map(x => {
            return {
                ...x,
                nodeDefId: node.id,
            };
        });

        // client does not store the IDs; they are based on nodeDefId + userId.
        const defaultAssigneesCP = ComputeChangePlan(existingDefaultAssignees, desiredObjs, (a, b) => a.userId === b.userId);

        const defaultAssigneeIdsToDelete = defaultAssigneesCP.delete.map(x => x.id);

        // Delete
        await transactionalDb.workflowDefNodeDefaultAssignee.deleteMany({
            where: { id: { in: defaultAssigneeIdsToDelete } },
        });
        resultChanges.push(...defaultAssigneesCP.delete.map(x => {
            return {
                action: ChangeAction.delete,
                pkid: x.id,
                objectType: WorkflowObjectType.assignee,
                oldValues: existingDefaultAssignees.find(eg => eg.id === x.id),
            };
        }));

        // Update
        for (const assigneeAB of defaultAssigneesCP.potentiallyUpdate) {
            const { a, b } = assigneeAB;
            const diffResult = ObjectDiff(a, b, { ignore: ["id", "nodeDefId"] });
            if (!diffResult.areDifferent) continue;
            await transactionalDb.workflowDefNodeDefaultAssignee.update({
                where: { id: a.id },
                data: diffResult.differences.rhs,
            });
            resultChanges.push({
                action: ChangeAction.update,
                pkid: a.id,
                objectType: WorkflowObjectType.assignee,
                oldValues: diffResult.differences.lhs,
                newValues: diffResult.differences.rhs,
            });
        }

        // Create new
        for (const assignee of defaultAssigneesCP.create) {
            const { id, ...rest } = assignee;
            const data = { ...rest, nodeDefId: node.id, };
            const newItem = await transactionalDb.workflowDefNodeDefaultAssignee.create({ data });
            const resultObj = node.defaultAssignees.find(n => n.id === assignee.id)!;
            resultObj.id = newItem.id;
            resultChanges.push({
                action: ChangeAction.insert,
                pkid: newItem.id,
                objectType: WorkflowObjectType.assignee,
                newValues: data,
            });
            tempToRealIdMappings.push({
                objectType: WorkflowObjectType.assignee,
                tempId: assignee.id,
                realId: newItem.id,
            });

            // update references to this?
            for (const an of args.nodes) {
                for (const d of an.dependencies) {
                    if (d.nodeDefId === assignee.id) {
                        d.nodeDefId = newItem.id;
                    }
                }
            }
        }
    }


    ///// NODE DEPENDENCIES PER NODE ----------------------------------------
    const existingNodeDependenciesForEntireWorkflow = await transactionalDb.workflowDefNodeDependency.findMany({
        where: { targetNodeDefId: { in: args.nodes.map(n => n.id) } }
    });

    for (const node of args.nodes) {
        assert(node.id >= 0, "real IDs must be assigned at this point.");
        //const correspondingArgNode = args.nodes.find(an => an.id === node.id)!;
        //assert(!!correspondingArgNode, "corresponding node not found; that's very bug.");
        const existingDependencies = existingNodeDependenciesForEntireWorkflow.filter(x => x.targetNodeDefId === node.id);

        const desiredDependencies: Prisma.WorkflowDefNodeDependencyGetPayload<{}>[] = node.dependencies.map(x => {
            const { nodeDefId, ...otherProps } = x;
            return {
                ...otherProps,
                sourceNodeDefId: x.nodeDefId,
                targetNodeDefId: node.id,
            };
        });

        const dependenciesCP = ComputeChangePlan(existingDependencies, desiredDependencies, (a, b) => a.sourceNodeDefId === b.sourceNodeDefId);

        const dependencyIdsToDelete = dependenciesCP.delete.map(x => x.id);

        // Delete
        await transactionalDb.workflowDefNodeDependency.deleteMany({
            where: { id: { in: dependencyIdsToDelete } },
        });
        resultChanges.push(...dependenciesCP.delete.map(x => {
            return {
                action: ChangeAction.delete,
                pkid: x.id,
                objectType: WorkflowObjectType.dependency,
                oldValues: existingDependencies.find(eg => eg.id === x.id),
            };
        }));

        // Update
        for (const dependencyAB of dependenciesCP.potentiallyUpdate) {
            const { a, b } = dependencyAB;
            const diffResult = ObjectDiff(a, b, { ignore: ["id"] });
            if (!diffResult.areDifferent) continue;
            await transactionalDb.workflowDefNodeDependency.update({
                where: { id: a.id },
                data: diffResult.differences.rhs,
            });
            resultChanges.push({
                action: ChangeAction.update,
                pkid: a.id,
                objectType: WorkflowObjectType.dependency,
                oldValues: diffResult.differences.lhs,
                newValues: diffResult.differences.rhs,
            });
        }

        // Create new
        for (const dependency of dependenciesCP.create) {
            const { id, ...data } = dependency;
            const newItem = await transactionalDb.workflowDefNodeDependency.create({ data });
            const resultObj = node.dependencies.find(n => n.id === dependency.id)!;
            resultObj.id = newItem.id;
            resultChanges.push({
                action: ChangeAction.insert,
                pkid: newItem.id,
                objectType: WorkflowObjectType.dependency,
                newValues: data,
            });
            tempToRealIdMappings.push({
                objectType: WorkflowObjectType.dependency,
                tempId: dependency.id,
                realId: newItem.id,
            });

            // update references to this?
        }
    }


    return {
        changes: resultChanges,
        serializableFlowDef: args,
    };
};



export default resolver.pipe(
    resolver.authorize(Permission.edit_workflow_defs),
    async (args: TinsertOrUpdateWorkflowDefArgs, ctx: AuthenticatedCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        const changeContext = CreateChangeContext(`insertOrUpdateWorkflow`);

        //return await db.$transaction(async (transactionalDb) => {
        return await passthroughWithoutTransaction(async (transactionalDb) => {
            debugger;
            // old workflow def
            //let oldSerializableDef: TinsertOrUpdateWorkflowDefArgs | undefined = undefined;
            const oldPayload: TWorkflowMutationResult = {
                changes: [],
                serializableFlowDef: undefined,
            };
            if (args.id >= 0) {
                const oldValuesInfo = await DB3QueryCore2({
                    clientIntention,
                    cmdbQueryContext: "insertOrUpdateWorkflowDef",
                    tableID: db3.xWorkflowDef_Verbose.tableID,
                    tableName: db3.xWorkflowDef_Verbose.tableName,
                    filter: {
                        items: [],
                        pks: [args.id],
                    },
                    orderBy: undefined,
                },
                    currentUser,
                    transactionalDb);

                // convert to engine workflow def
                const oldEngineDef = mapWorkflowDef(oldValuesInfo.items[0] as any);
                oldPayload.serializableFlowDef = WorkflowDefToMutationArgs(oldEngineDef);
            }

            const newPayload = await InsertOrUpdateWorkflowCoreAsync(args, transactionalDb);
            const registeredPayload = { ...newPayload };

            // #340 activity log payload bloat
            registeredPayload.serializableFlowDef = undefined;

            await RegisterChange({
                action: oldPayload.serializableFlowDef ? ChangeAction.update : ChangeAction.insert,
                changeContext,
                ctx,
                pkid: newPayload.serializableFlowDef!.id,
                table: 'workflowDef',
                oldValues: null,//oldPayload,// #340 activity log payload bloat
                newValues: registeredPayload,// #340 activity log payload bloat
                db: transactionalDb,
                options: {
                    dontCalculateChanges: true,
                }
            });

            return newPayload;
        });
    }
);

