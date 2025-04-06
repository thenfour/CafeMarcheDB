import { Ctx } from "blitz";
import db from "db";
import { z } from "zod";
import * as mutationCore from "../server/db3mutationCore";
import { ActivityFeature } from "../shared/activityTracking";


export const ZTRecordActionArgs = z.object({
    uri: z.string(),
    userId: z.number().optional(), // optional for client-side actions
    feature: z.nativeEnum(ActivityFeature),

    eventId: z.number().optional(),
    fileId: z.number().optional(),
    songId: z.number().optional(),
    wikiPageId: z.number().optional(),
});

type RecordActionArgs = z.infer<typeof ZTRecordActionArgs>;

export async function recordAction(args: RecordActionArgs, ctx: Ctx) {
    let userId: number | undefined = args.userId;
    if (!userId) {
        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        userId = currentUser?.id;
    }

    await db.action.create({
        data: {
            userId,
            isClient: false,
            uri: args.uri,
            feature: args.feature,

            eventId: args.eventId,
            fileId: args.fileId,
            songId: args.songId,
            wikiPageId: args.wikiPageId,
        },
    });
}