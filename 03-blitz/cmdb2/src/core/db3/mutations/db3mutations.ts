import { resolver } from "@blitzjs/rpc"
import db, { Prisma } from "db";
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
        const table = db3.GetTableById(input.tableID);

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        input.clientIntention = input.clientIntention || { intention: "user", mode: "primary" };
        input.clientIntention.currentUser = currentUser;

        if (input.deleteId != null) {
            // return boolean
            return await mutationCore.deleteImpl(table, input.deleteId, ctx, input.clientIntention);
        }
        if (input.insertModel != null) {
            // return new object
            return await mutationCore.insertImpl(table, input.insertModel, ctx, input.clientIntention);
        }
        if (input.updateModel != null) {
            // return new object
            return await mutationCore.updateImpl(table, input.updateId!, input.updateModel, ctx, input.clientIntention);
        }
        return false;
    }
);

