import { Ctx } from "blitz";
import db from "db";
import { z } from "zod";
import * as mutationCore from "../server/db3mutationCore";
import { ZTRecordActionArgs } from "../shared/activityTracking";


type RecordActionArgs = z.infer<typeof ZTRecordActionArgs>;

export async function recordAction({ userId, ...args }: RecordActionArgs, ctx: Ctx) {
    //let userId: number | undefined = args.userId;
    if (!userId) {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        userId = currentUser?.id;
    }

    await db.action.create({
        data: {
            userId,
            isClient: false,
            //uri: args.uri,
            //feature: args.feature,

            ...args,

            // eventId: args.eventId,
            // fileId: args.fileId,
            // songId: args.songId,
            // wikiPageId: args.wikiPageId,
            // attendanceId: args.attendanceId,
            // eventSegmentId: args.eventSegmentId,
        },
    });
}