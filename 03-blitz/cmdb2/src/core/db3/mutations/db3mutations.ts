import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
import { ComputeChangePlan } from "shared/associationUtils";
import { Permission } from "shared/permissions";
import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange, TAnyModel } from "shared/utils"
import * as db3 from "../db3";
import { CMDBAuthorizeOrThrow } from "types";
import { AuthenticatedMiddlewareCtx } from "blitz";
import * as mutationCore from "../server/db3mutationCore"

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize("db3mutations", Permission.login),
    async (input: db3.MutatorInput, ctx: AuthenticatedMiddlewareCtx) => {
        const table = db3.gAllTables[input.tableName]!;

        const currentUser = await mutationCore.getCurrentUserCore(ctx);

        if (input.deleteId != null) {
            // return boolean
            return await mutationCore.deleteImpl(table, input.deleteId, ctx, currentUser);
        }
        if (input.insertModel != null) {
            // return new object
            return await mutationCore.insertImpl(table, input.insertModel, ctx, currentUser);
        }
        if (input.updateModel != null) {
            // return new object
            return await mutationCore.updateImpl(table, input.updateId!, input.updateModel, ctx, currentUser);
        }
        return false;
    }
);

