// getWorkflowDefAndInstanceForEvent

import { resolver } from "@blitzjs/rpc";
import { assert, AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "../db3";
import { DB3QueryCore2 } from "../server/db3QueryCore";
import { getCurrentUserCore } from "../server/db3mutationCore";


// Zod schema for GetSearchResultsInput
const ZInput = z.object({
    eventId: z.number(),
    refreshTrigger: z.number(),
});

type TResult = {
    workflowDef: db3.WorkflowDef_Verbose | undefined,
    workflowInstance: db3.WorkflowInstance_Verbose | undefined,
};

export default resolver.pipe(
    resolver.zod(ZInput),
    resolver.authorize(Permission.view_workflow_instances),
    async (args, ctx: AuthenticatedCtx): Promise<TResult> => {
        try {
            const currentUser = (await getCurrentUserCore(ctx))!;
            const clientIntention: db3.xTableClientUsageContext = { intention: !!currentUser ? 'user' : "public", mode: 'primary', currentUser };

            const event = await db.event.findFirst({ where: { id: args.eventId } });
            if (!event) throw new Error(`event not found`);

            const ret: TResult = {
                workflowDef: undefined,
                workflowInstance: undefined,
            };

            if (event.workflowDefId) {
                const qr = await DB3QueryCore2({
                    clientIntention,
                    orderBy: undefined,
                    tableID: db3.xWorkflowDef_Verbose.tableID,
                    tableName: db3.xWorkflowDef_Verbose.tableName,
                    filter: { items: [], pks: [event.workflowDefId] },
                    cmdbQueryContext: "getWorkflowDefAndInstanceForEvent/workflowDef",
                }, currentUser);
                assert(qr.items.length < 2, "broken query?");
                if (qr.items.length === 1) {
                    ret.workflowDef = qr.items[0] as db3.WorkflowDef_Verbose;
                }
            }

            if (event.workflowInstanceId) {
                const qr = await DB3QueryCore2({
                    clientIntention,
                    orderBy: undefined,
                    tableID: db3.xWorkflowInstance_Verbose.tableID,
                    tableName: db3.xWorkflowInstance_Verbose.tableName,
                    filter: { items: [], pks: [event.workflowInstanceId] },
                    cmdbQueryContext: "getWorkflowDefAndInstanceForEvent/workflowInstance",
                }, currentUser);
                assert(qr.items.length < 2, "broken query?");
                if (qr.items.length === 1) {
                    ret.workflowInstance = qr.items[0] as db3.WorkflowInstance_Verbose;
                }
            }

            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



