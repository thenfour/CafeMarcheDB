// deleteEventSongList
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TGeneralDeleteArgs, TGeneralDeleteArgsSchema, TinsertOrUpdateEventSongListArgs } from "../shared/apiTypes";
import db, { Prisma, PrismaClient } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/utils";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(TGeneralDeleteArgsSchema),
    async (args: TGeneralDeleteArgs, ctx: AuthenticatedCtx) => {

        // TODO
        //CMDBAuthorizeOrThrow("deleteEventComment", Permission.comm)

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };

        const changeContext = CreateChangeContext(`deleteEventSongList`);

        // old values.
        const oldSongList = await db.eventSongList.findFirst({ where: { id: args.id } });
        if (!oldSongList) return args;

        const oldSongs = await db.eventSongListSong.findMany({ where: { eventSongListId: args.id } });
        const oldDividers = await db.eventSongListDivider.findMany({ where: { eventSongListId: args.id } });

        const oldValues: TinsertOrUpdateEventSongListArgs = {
            ...oldSongList,
            songs: oldSongs.map(x => ({
                id: x.id,
                songId: x.songId,
                sortOrder: x.sortOrder,
                subtitle: x.subtitle || "",
            })),
            dividers: oldDividers.map(x => ({
                id: x.id,
                sortOrder: x.sortOrder,
                color: x.color,
                isInterruption: x.isInterruption,
                subtitle: x.subtitle || "",
            })),
        };

        // avoid spamming the change log with deletions of individual songs and dividers
        await db.eventSongListSong.deleteMany({ where: { eventSongListId: args.id } });
        await db.eventSongListDivider.deleteMany({ where: { eventSongListId: args.id } });
        await db.eventSongList.delete({ where: { id: args.id } });

        await RegisterChange({
            action: ChangeAction.delete,
            changeContext,
            ctx,
            pkid: args.id,
            table: 'eventSongList',
            oldValues,
        });

        return args;
    }
);

