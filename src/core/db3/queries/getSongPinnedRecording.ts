import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import { TSongPinnedRecording } from "../shared/apiTypes";

const ZArgs = z.object({
    songIds: z.array(z.number()),
});

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx): Promise<Record<number, TSongPinnedRecording>> => {
        try {
            const qr = await db.song.findMany({
                where: {
                    id: { in: args.songIds },
                    pinnedRecordingId: { not: null }
                },
                include: {
                    pinnedRecording: true,
                }
            });

            // Create a map of songId -> pinnedRecording for easy lookup
            const result: Record<number, TSongPinnedRecording> = {};
            qr.forEach(song => {
                if (song.pinnedRecording) {
                    result[song.id] = song.pinnedRecording;
                }
            });

            return result;

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



