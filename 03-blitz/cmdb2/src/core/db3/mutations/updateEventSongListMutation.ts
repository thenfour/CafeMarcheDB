// updateEventSongListMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedMiddlewareCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertOrUpdateEventSongListArgs } from "../shared/apiTypes";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertOrUpdateEventSongListArgs, ctx: AuthenticatedMiddlewareCtx) => {

        if (!args.id) {
            throw new Error(`can't update a song list without a pk`);
        }

        // TODO
        //CMDBAuthorizeOrThrow("updateEventComment", Permission.comm)
        const currentUser = await mutationCore.getCurrentUserCore(ctx);

        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventSongListUncheckedUpdateInput = {
            //eventId: args.eventId, do not move a setlist from 1 to another
            name: args.name,
            createdByUserId: currentUser.id,
            visiblePermissionId: args.visiblePermissionId,
            description: args.description,
            sortOrder: args.sortOrder,
        };

        await mutationCore.updateImpl(db3.xEventSongList, args.id, fields, ctx, clientIntention);

        return args;// blitz is weird and wants the return type to be the same as the input type.
    }
);
