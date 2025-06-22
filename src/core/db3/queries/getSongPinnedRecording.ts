import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";

const ZArgs = z.object({
    songId: z.number(),
});

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {
        try {
            const qr = await db.song.findUnique({
                where: { id: args.songId },
                include: {
                    pinnedRecording: true,
                }
            });
            if (!qr) return null;
            if (!qr.pinnedRecording) return null;
            return {
                pinnedRecording: qr.pinnedRecording,
            };

        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



