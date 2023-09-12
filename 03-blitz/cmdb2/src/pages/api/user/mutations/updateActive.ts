// updateActive
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../../../../core/db3/db3";
import * as mutationCore from "../../../../core/db3/server/db3mutationCore";
import { TupdateActiveArgs } from "../types";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize("updateActive", Permission.change_own_userInfo),
    async (args: TupdateActiveArgs, ctx: AuthenticatedMiddlewareCtx) => {

        if (args.userId != ctx.session.userId) {
            throw new Error("this is only for setting your own info.");
        }

        const fields: Prisma.UserUncheckedUpdateInput = {
            isActive: args.isActive,
        };

        mutationCore.updateImpl(db3.xUser, args.userId, fields, ctx);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

