// updateEventSongListMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertOrUpdateEventSongListArgs } from "../shared/apiTypes";
import { CreateChangeContext } from "shared/activityLog";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.manage_events),
    async (args: TinsertOrUpdateEventSongListArgs, ctx: AuthenticatedCtx) => {

        if (!args.id) {
            throw new Error(`can't update a song list without a pk`);
        }

        // TODO
        //CMDBAuthorizeOrThrow("updateEventComment", Permission.comm)
        const currentUser = (await mutationCore.getCurrentUserCore(ctx))!;

        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventSongListUncheckedUpdateInput = {
            name: args.name,
            description: args.description,
            sortOrder: args.sortOrder,
            isActuallyPlayed: args.isActuallyPlayed,
            isOrdered: args.isOrdered,
        };

        const changeContext = CreateChangeContext(`updateEventSongList`);

        const newObject = (await mutationCore.updateImpl(db3.xEventSongList, args.id, fields, ctx, clientIntention)).newModel;

        await mutationCore.UpdateEventSongListSongs({ changeContext, ctx, songListID: newObject.id, desiredSongs: args.songs, desiredDividers: args.dividers });

        return args;
    }
);

