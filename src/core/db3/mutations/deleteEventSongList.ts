// hard deletion

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { ChangeAction, CreateChangeContext, RegisterChange } from "shared/activityLog";
import { Permission } from "shared/permissions";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import {
    TGeneralDeleteArgs,
    TGeneralDeleteArgsSchema,
} from "../shared/apiTypes";
import type { EventSongListMutationCommand } from "../shared/entities/eventSongList/eventSongListCommands";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(TGeneralDeleteArgsSchema),
    async (args: TGeneralDeleteArgs, ctx: AuthenticatedCtx) => {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const reqAuth = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(currentUser, reqAuth.effectivePermissions);
        if (!publicData.effectivePermissions.includesName(Permission.manage_events)) {
            throw new mutationCore.DB3MutationAuthorizationError(
                db3.xEventSongList.tableName,
                [db3.xEventSongList.pkMember],
            );
        }

        await db.$transaction(async transactionalDb => {
            const oldSongList = await transactionalDb.eventSongList.findFirst({
                where: { id: args.id },
            });
            if (!oldSongList) return;

            if (!db3.xEventSongList.authorizeRowForDeleteHard({
                model: oldSongList,
                publicData,
            })) {
                throw new mutationCore.DB3MutationAuthorizationError(
                    db3.xEventSongList.tableName,
                    [db3.xEventSongList.pkMember],
                );
            }

            const [oldSongs, oldDividers] = await Promise.all([
                transactionalDb.eventSongListSong.findMany({
                    where: { eventSongListId: args.id },
                }),
                transactionalDb.eventSongListDivider.findMany({
                    where: { eventSongListId: args.id },
                }),
            ]);

            const oldValues: EventSongListMutationCommand = {
                ...oldSongList,
                songs: oldSongs.map(song => ({
                    id: song.id,
                    songId: song.songId,
                    sortOrder: song.sortOrder,
                    subtitle: song.subtitle || "",
                })),
                dividers: oldDividers.map(divider => ({
                    id: divider.id,
                    sortOrder: divider.sortOrder,
                    color: divider.color,
                    isInterruption: divider.isInterruption,
                    subtitleIfSong: divider.subtitleIfSong,
                    isSong: divider.isSong,
                    lengthSeconds: divider.lengthSeconds,
                    textStyle: divider.textStyle,
                    subtitle: divider.subtitle || "",
                })),
            };

            // avoid spamming the change log with deletions of individual songs and dividers
            await transactionalDb.eventSongListSong.deleteMany({
                where: { eventSongListId: args.id },
            });
            await transactionalDb.eventSongListDivider.deleteMany({
                where: { eventSongListId: args.id },
            });
            await transactionalDb.eventSongList.delete({ where: { id: args.id } });

            await mutationCore.CallMutateEventHooks({
                tableNameOrSpecialMutationKey: db3.xEventSongList.tableName,
                model: oldSongList,
                db: transactionalDb,
            });

            await RegisterChange({
                action: ChangeAction.delete,
                changeContext: CreateChangeContext("deleteEventSongList"),
                ctx,
                pkid: args.id,
                table: db3.xEventSongList.tableName,
                oldValues,
                db: transactionalDb,
            });
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

        return args;
    },
);
