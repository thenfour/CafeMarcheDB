// insertEventSongListMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import {
    EventSongListMutationCommandSchema,
    type EventSongListMutationCommand,
} from "../shared/entities/eventSongList/eventSongListCommands";
import { CreateChangeContext } from "shared/activityLog";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(EventSongListMutationCommandSchema),
    async (args: EventSongListMutationCommand, ctx: AuthenticatedCtx) => {



        // TODO
        //CMDBAuthorizeOrThrow("insertEventSongListMutation", Permission.comm)

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventSongListUncheckedCreateInput = {
            eventId: args.eventId,
            name: args.name,
            isActuallyPlayed: args.isActuallyPlayed,
            isOrdered: args.isOrdered,
            //createdByUserId: currentUser.id,
            //visiblePermissionId: args.visiblePermissionId,
            description: args.description,
            sortOrder: args.sortOrder,
        };

        // insert the song list
        const changeContext = CreateChangeContext(`insertEventSongList`);

        const newObject = await mutationCore.insertImpl<Prisma.EventSongListGetPayload<{}>>(db3.xEventSongList, fields, ctx);

        await mutationCore.UpdateEventSongListSongs({ changeContext, ctx, songListID: newObject.id, desiredSongs: args.songs, desiredDividers: args.dividers });

        return args;
    }
);

