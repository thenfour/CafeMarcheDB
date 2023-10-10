// deleteEventComment
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TdeleteEventCommentArgs } from "../shared/apiTypes";
import { CMDBAuthorizeOrThrow } from "types";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TdeleteEventCommentArgs, ctx: AuthenticatedMiddlewareCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("deleteEventComment", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };
        await mutationCore.deleteImpl(db3.xEventComment, args.id, ctx, clientIntention);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);

