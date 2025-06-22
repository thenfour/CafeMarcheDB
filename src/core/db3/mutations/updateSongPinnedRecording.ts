import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";

const ZArgs = z.object({
    songId: z.number(),
    fileId: z.number().nullable(),
});

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.SongUncheckedUpdateInput = {
            pinnedRecordingId: args.fileId,
        };

        const currentUser = await mutationCore.getCurrentUserCore(ctx);
        const clientIntention: db3.xTableClientUsageContext = {
            intention: "user",
            mode: "primary",
            currentUser,
        };
        await mutationCore.updateImpl(db3.xSong, args.songId, fields, ctx, clientIntention);

        return args;
    }
);

