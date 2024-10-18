// deleteWorkflowDefMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TGeneralDeleteArgs, TGeneralDeleteArgsSchema, TinsertOrUpdateEventSongListArgs } from "../shared/apiTypes";
import db, { Prisma, PrismaClient } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils";
import { DB3QueryCore2 } from "../server/db3QueryCore";
import { mapWorkflowDef, WorkflowDefToMutationArgs } from "shared/workflowEngine";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(TGeneralDeleteArgsSchema),
    async (args: TGeneralDeleteArgs, ctx: AuthenticatedCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("deleteEventComment", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        const changeContext = CreateChangeContext(`deleteWorkflowDef`);

        // old values.
        const oldValuesInfo = await DB3QueryCore2({
            clientIntention,
            cmdbQueryContext: "deleteWorkflowDef",
            tableID: db3.xWorkflowDef_Verbose.tableID,
            tableName: db3.xWorkflowDef_Verbose.tableName,
            filter: {
                items: [],
                pks: [args.id],
            },
            orderBy: undefined,
        }, currentUser);

        // convert to engine workflow def
        const engineDef = mapWorkflowDef(oldValuesInfo.items[0] as any);
        const serializableDef = WorkflowDefToMutationArgs(engineDef);

        await db.workflowDef.delete({ where: { id: args.id } });

        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            ctx,
            pkid: args.id,
            table: 'workflowDef',
            oldValues: serializableDef,
        });

        return args;
    }
);

