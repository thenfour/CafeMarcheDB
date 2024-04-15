// insertEventSongListMutation
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TinsertOrUpdateEventSongListArgs, TinsertOrUpdateEventSongListSong } from "../shared/apiTypes";
import { CMDBAuthorizeOrThrow } from "types";
import { ChangeAction, ChangeContext, CreateChangeContext, RegisterChange, TAnyModel } from "shared/utils";
import { ComputeChangePlan } from "shared/associationUtils";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TinsertOrUpdateEventSongListArgs, ctx: AuthenticatedCtx) => {

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        // TODO
        //CMDBAuthorizeOrThrow("insertEventSongListMutation", Permission.comm)

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.EventSongListUncheckedCreateInput = {
            eventId: args.eventId,
            name: args.name,
            //createdByUserId: currentUser.id,
            //visiblePermissionId: args.visiblePermissionId,
            description: args.description,
            sortOrder: args.sortOrder,
        };

        // insert the song list
        const changeContext = CreateChangeContext(`insertEventSongList`);

        const newObject = await mutationCore.insertImpl<Prisma.EventSongListGetPayload<{}>>(db3.xEventSongList, fields, ctx, clientIntention);

        await mutationCore.UpdateEventSongListSongs({ changeContext, ctx, songListID: newObject.id, desiredValues: args.songs });

        return args;
    }
);

