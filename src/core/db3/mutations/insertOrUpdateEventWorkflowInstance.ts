// insertOrUpdateEventWorkflowInstance
import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db, { Prisma, PrismaClient } from "db";
import { Permission } from "shared/permissions";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils";
import { MutationArgsToWorkflowInstance, TWorkflowChange, TWorkflowInstanceMutationResult } from "shared/workflowEngine";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { DB3QueryCore2 } from "../server/db3QueryCore";
import { TransactionalPrismaClient, TUpdateEventWorkflowInstanceArgs, WorkflowObjectType } from "../shared/apiTypes";


async function InsertOrUpdateWorkflowInstanceCoreAsync(db: TransactionalPrismaClient, args: TUpdateEventWorkflowInstanceArgs): Promise<TWorkflowInstanceMutationResult> {
    const resultChanges: TWorkflowChange[] = [];

    // we don't actually want to care about the incoming workflow instance ID. event IDs have 1 wf instance.
    assert(args.eventId, "requires exactly 1 event id.");
    const eventRaw = await db.event.findFirst({ where: { id: args.eventId } });
    assert(!!eventRaw, "event not found wut");
    args.instance.id = eventRaw!.workflowInstanceId || -1;

    ///// INSTANCE ITSELF ----------------------------------------
    const desiredInstanceAsPrisma = db3.MutationArgsToPrismaWorkflowInstance(args);

    const existingInstance = await db.workflowInstance.findFirst({ where: { id: args.instance.id } });
    const existingInstanceAsArray = existingInstance ? [existingInstance] : [];

    const instanceSyncRresult = await mutationCore.SyncNonSelfReferencingEntities<Prisma.WorkflowInstanceGetPayload<{}>>(
        WorkflowObjectType.workflowInstance,
        existingInstanceAsArray,
        [desiredInstanceAsPrisma],
        [
            "lastEvaluatedWorkflowDefId",
            "revision",
        ],
        {
            deleteMany: async (ids) => await db.workflowInstance.deleteMany({ where: { id: { in: ids } } }),
            update: async (id, data) => await db.workflowInstance.update({ where: { id }, data }),
            create: async (data) => await db.workflowInstance.create({ data }),
        },
        [],
    );

    resultChanges.push(...instanceSyncRresult.changes);

    instanceSyncRresult.tempToRealIdMappings.forEach(m => { // should be 0 or 1 element here.
        if (m.objectType !== WorkflowObjectType.workflowInstance) throw new Error(`wrong object type huh?`);
        if (args.instance.id > 0) throw new Error(`how did this happen`);
        args.instance.id = m.realId;
        desiredInstanceAsPrisma.id = m.realId;
        for (const node of desiredInstanceAsPrisma.nodes) {
            node.instanceId = m.realId;
        }
    });

    if (instanceSyncRresult.tempToRealIdMappings.length === 1 && args.eventId > 0) {
        // now that the instance has been created, also set the event instance id correctly.
        await db.event.update({
            where: { id: args.eventId },
            data: {
                workflowInstanceId: instanceSyncRresult.tempToRealIdMappings[0]!.realId
            }
        });
    }

    ///// SYNC NODES ----------------------------------------
    const existingNodes = await db.workflowInstanceNode.findMany({ where: { instanceId: args.instance.id } });
    // desired nodes: we already have this but remove items that shouldn't be inserted
    const desiredNodes: typeof existingNodes = desiredInstanceAsPrisma.nodes.map(node => {
        const { assignees, lastAssignees, ...outp } = node;
        return outp;
    });

    const nodesSyncResult = await mutationCore.SyncNonSelfReferencingEntities<Prisma.WorkflowInstanceNodeGetPayload<{}>>(
        WorkflowObjectType.workflowNodeInstance,
        existingNodes,
        desiredNodes,
        [
            //"id",
            "instanceId",
            "nodeDefId",
            "dueDate",
            "activeStateFirstTriggeredAt",
            "manuallyCompleted",
            "manualCompletionComment",
            "lastFieldName",
            "lastFieldValueAsString",
            "lastProgressState",
        ],
        {
            deleteMany: async (ids) => await db.workflowInstanceNode.deleteMany({ where: { id: { in: ids } } }),
            update: async (id, data) => await db.workflowInstanceNode.update({ where: { id }, data }),
            create: async (data) => await db.workflowInstanceNode.create({ data }),
        },
    );

    resultChanges.push(...nodesSyncResult.changes);

    // update references
    for (const mapping of nodesSyncResult.tempToRealIdMappings) {
        if (mapping.objectType !== WorkflowObjectType.workflowNodeInstance) throw new Error(`wrong object type huh?`);
        args.instance.nodeInstances.filter(n => n.id === mapping.tempId).forEach(n => n.id = mapping.realId);
        //desiredInstanceAsPrisma.nodes.filter(n => n.id === mapping.tempId).forEach(n => n.id = mapping.realId);
        for (const node of desiredInstanceAsPrisma.nodes) {
            if (node.id === mapping.tempId) node.id = mapping.realId;
            for (const ass of node.assignees) {
                if (ass.instanceNodeId === mapping.tempId) ass.instanceNodeId = mapping.realId;
            }
            for (const ass of node.lastAssignees) {
                if (ass.instanceNodeId === mapping.tempId) ass.instanceNodeId = mapping.realId;
            }
        }
    }

    ///// for each node, SYNC ASSIGNEES ----------------------------------------
    for (const node of desiredInstanceAsPrisma.nodes) {
        const existingAssignees = await db.workflowInstanceNodeAssignee.findMany({ where: { instanceNodeId: node.id } });
        const desiredAssignees = node.assignees;
        const assSyncResult = await mutationCore.SyncNonSelfReferencingEntities<Prisma.WorkflowInstanceNodeAssigneeGetPayload<{}>>(
            WorkflowObjectType.workflowNodeInstanceAssignee,
            existingAssignees,
            desiredAssignees,
            ["instanceNodeId", "userId"],
            {
                deleteMany: async (ids) => await db.workflowInstanceNodeAssignee.deleteMany({ where: { id: { in: ids } } }),
                update: async (id, data) => await db.workflowInstanceNodeAssignee.update({ where: { id }, data }),
                create: async (data) => await db.workflowInstanceNodeAssignee.create({ data }),
            },
        );

        resultChanges.push(...assSyncResult.changes);
    }

    ///// for each node, SYNC LAST ASSIGNEES ----------------------------------------
    for (const node of desiredInstanceAsPrisma.nodes) {
        const existingAssignees = await db.workflowInstanceNodeLastAssignee.findMany({ where: { instanceNodeId: node.id } });
        const desiredAssignees = node.lastAssignees;
        const assSyncResult = await mutationCore.SyncNonSelfReferencingEntities<Prisma.WorkflowInstanceNodeLastAssigneeGetPayload<{}>>(
            WorkflowObjectType.workflowNodeInstanceLastAssignee,
            existingAssignees,
            desiredAssignees,
            ["instanceNodeId", "userId"],
            {
                deleteMany: async (ids) => await db.workflowInstanceNodeLastAssignee.deleteMany({ where: { id: { in: ids } } }),
                update: async (id, data) => await db.workflowInstanceNodeLastAssignee.update({ where: { id }, data }),
                create: async (data) => await db.workflowInstanceNodeLastAssignee.create({ data }),
            },
        );

        resultChanges.push(...assSyncResult.changes);
    }

    return {
        changes: resultChanges,
        serializableInstance: args,
    };
};

export default resolver.pipe(
    resolver.authorize(Permission.edit_workflow_instances),
    async (args: TUpdateEventWorkflowInstanceArgs, ctx: AuthenticatedCtx): Promise<TWorkflowInstanceMutationResult> => {
        //debugger; // todo: this mutation.
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        const changeContext = CreateChangeContext(`insertOrUpdateEventWorkflowInstance`);

        return await db.$transaction(async (transactionalDb) => {
            // old instance
            const oldPayload: TWorkflowInstanceMutationResult = {
                changes: [],
                serializableInstance: undefined,
            };

            if (args.instance.id >= 0) {
                const oldValuesInfo = await DB3QueryCore2({
                    clientIntention,
                    cmdbQueryContext: "insertOrUpdateEventWorkflowInstance",
                    tableID: db3.xWorkflowInstance_Verbose.tableID,
                    tableName: db3.xWorkflowInstance_Verbose.tableName,
                    filter: {
                        items: [],
                        pks: [args.instance.id],
                    },
                    orderBy: undefined,
                },
                    currentUser,
                    transactionalDb);

                // convert to engine workflow def
                const oldEngineInstance = db3.WorkflowInstanceQueryResultToMutationArgs(oldValuesInfo.items[0] as db3.WorkflowInstance_Verbose, args.eventId);
                oldPayload.serializableInstance = {
                    eventId: args.eventId,
                    instance: MutationArgsToWorkflowInstance(oldEngineInstance),
                };
            }

            const newPayload = await InsertOrUpdateWorkflowInstanceCoreAsync(transactionalDb, args);

            await RegisterChange({
                action: oldPayload.serializableInstance ? ChangeAction.update : ChangeAction.insert,
                changeContext,
                ctx,
                pkid: newPayload.serializableInstance!.instance.id,
                table: 'workflowInstance',
                oldValues: oldPayload,
                newValues: newPayload,
                db: transactionalDb,
            });

            return newPayload;
        });
    }
);

