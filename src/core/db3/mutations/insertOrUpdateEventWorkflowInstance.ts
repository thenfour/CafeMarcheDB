// insertOrUpdateEventWorkflowInstance
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TUpdateEventWorkflowInstanceArgs } from "../shared/apiTypes";


export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TUpdateEventWorkflowInstanceArgs, ctx: AuthenticatedCtx): Promise<TUpdateEventWorkflowInstanceArgs> => {
        //debugger; // todo: this mutation.
        return args as any;
    }
);

