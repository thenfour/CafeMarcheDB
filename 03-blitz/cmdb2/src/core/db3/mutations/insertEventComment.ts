// insertEventComment
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertEventCommentArgs } from "../shared/apiTypes";
import { CMDBAuthorizeOrThrow } from "types";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertEventCommentArgs, ctx: AuthenticatedMiddlewareCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("insertEventComment", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventCommentUncheckedCreateInput = {
            createdAt: new Date(), // this is automatic though right?
            updatedAt: new Date(), // is this automatic though?

            eventId: args.eventId,
            text: args.text,
            userId: currentUser.id,
            visiblePermissionId: args.visiblePermissionId,
        };

        await mutationCore.insertImpl(db3.xEventComment, fields, ctx, clientIntention);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

