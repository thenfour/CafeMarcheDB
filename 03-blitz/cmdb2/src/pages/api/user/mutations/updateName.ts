// updateName
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../../../../core/db3/db3";
import * as mutationCore from "../../../../core/db3/server/db3mutationCore";
import { TupdateNameArgs } from "../types";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize("updateName", Permission.change_own_userInfo),
    async (args: TupdateNameArgs, ctx: AuthenticatedMiddlewareCtx) => {

        if (args.userId != ctx.session.userId) {
            throw new Error("this is only for setting your own name.");
        }

        const fields: Prisma.UserUncheckedUpdateInput = {
            name: args.name,
        };

        mutationCore.updateImpl(db3.xUser, args.userId, fields, ctx);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

