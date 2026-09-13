import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
// deleteWorkflowDefMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { mapWorkflowDef, TWorkflowMutationResult, WorkflowDefToMutationArgs } from "shared/workflowEngine";
import * as db3 from "../db3";
import { queryTable } from "../server/db3QueryCore";
import { TGeneralDeleteArgs, TGeneralDeleteArgsSchema } from "../shared/apiTypes";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.edit_workflow_defs),
    resolver.zod(TGeneralDeleteArgsSchema),
    async (args: TGeneralDeleteArgs, ctx: AuthenticatedCtx) => {



        const changeContext = CreateChangeContext(`deleteWorkflowDef`);

        // old values.
        const oldValuesInfo = await queryTable({
            cmdbQueryContext: "deleteWorkflowDef",
            tableID: db3.xWorkflowDef_Verbose.tableID,
            tableName: db3.xWorkflowDef_Verbose.tableName,
            filter: {
                items: [],
                pks: [args.id],
            },
            orderBy: undefined,
        }, await getRequestAuthorization(ctx.session));

        // convert to engine workflow def
        const engineDef = mapWorkflowDef(oldValuesInfo.items[0] as any);
        const serializableDef = WorkflowDefToMutationArgs(engineDef);

        await db.workflowDef.delete({ where: { id: args.id } });

        const result: TWorkflowMutationResult = {
            changes: [],
            serializableFlowDef: serializableDef,
        };

        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            ctx,
            pkid: args.id,
            table: 'workflowDef',
            oldValues: result,
        });

        return result;
    }
);

