// updateEventComment
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateEventCommentArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateEventCommentArgs, ctx: AuthenticatedMiddlewareCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("updateEventComment", Permission.comm)

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventCommentUncheckedUpdateInput = {
            updatedAt: new Date(),
            text: args.text,
            visiblePermissionId: args.visiblePermissionId,
        };

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };
        await mutationCore.updateImpl(db3.xEventComment, args.id, fields, ctx, clientIntention);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

