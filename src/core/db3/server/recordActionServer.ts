import { Ctx } from "blitz";
import * as mutationCore from "../server/db3mutationCore";
import db from "db";
import { ActivityFeature } from "../shared/activityTracking";
import { z } from "zod";


export const ZTRecordActionArgs = z.object({
    uri: z.string(),
    feature: z.nativeEnum(ActivityFeature),

    eventId: z.number().optional(),
    fileId: z.number().optional(),
    songId: z.number().optional(),
    wikiPageId: z.number().optional(),
});

type RecordActionArgs = z.infer<typeof ZTRecordActionArgs>;

export async function recordAction(args: RecordActionArgs, ctx: Ctx) {
    const currentUser = await mutationCore.getCurrentUserCore(ctx);

    await db.action.create({
        data: {
            userId: currentUser?.id,
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