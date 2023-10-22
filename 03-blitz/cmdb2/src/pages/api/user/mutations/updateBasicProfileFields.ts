// updateBasicProfileFields
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../../../../core/db3/db3";
import * as mutationCore from "../../../../core/db3/server/db3mutationCore";
import { TupdateBasicProfileFieldsArgs } from "../types";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.change_own_userInfo),
    async (args: TupdateBasicProfileFieldsArgs, ctx: AuthenticatedMiddlewareCtx) => {

        if (args.userId != ctx.session.userId) {
            throw new Error("this is only for setting your own info.");
        }

        const fields: Prisma.UserUncheckedUpdateInput = {
            name: args.name,
            compactName: args.compactName,
            email: args.email,
            phone: args.phone,
            isActive: args.isActive,
        };

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        await mutationCore.updateImpl(db3.xUser, args.userId, fields, ctx, clientIntention);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

