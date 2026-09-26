import { resolver, type CMAuthenticatedCtx } from "@/src/auth/server/cmResolver";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import db from "db";
import { resolvePublicId } from "../server/db3PublicIds";

const ZArgs = z.object({
    songId: db3.xSong.identitySchema,
    fileId: db3.xFile.identitySchema.nullable(),
});

export default resolver.pipe(
    resolver.cmauthorize(Permission.login),
    resolver.zod(ZArgs),
    async (args, ctx: CMAuthenticatedCtx) => {

        if (!db3.xSong.authorizeTableForEdit(ctx.auth)) {
            throw new mutationCore.DB3MutationAuthorizationError(db3.xSong.tableName, ["pinnedRecordingId"]);
        }
        const fileId = args.fileId === null
            ? null
            : await resolvePublicId(db3.xFile, args.fileId, ctx.auth, db);
        // Keep the database foreign key numeric after resolving the public input.
        const fields: Prisma.SongUncheckedUpdateInput = { pinnedRecordingId: fileId };
        const songId = await resolvePublicId(
            db3.xSong, args.songId,
            ctx.auth, db,
        );
        await mutationCore.updateImpl(db3.xSong, songId, fields, ctx);

        return args;
    }
);

