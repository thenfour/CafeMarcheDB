import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import { z } from "zod";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import db from "db";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { resolvePublicId } from "../server/db3PublicIds";

const ZArgs = z.object({
    songId: db3.xSong.identitySchema,
    fileId: db3.xFile.identitySchema.nullable(),
});

export default resolver.pipe(
    resolver.authorize(Permission.login),
    resolver.zod(ZArgs),
    async (args, ctx: AuthenticatedCtx) => {

        const authorization = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(authorization.user, authorization.effectivePermissions);
        if (!db3.xSong.authorizeTableForEdit(publicData)) {
            throw new mutationCore.DB3MutationAuthorizationError(db3.xSong.tableName, ["pinnedRecordingId"]);
        }
        const fileId = args.fileId === null
            ? null
            : await resolvePublicId(db3.xFile, args.fileId, publicData, db);
        // Keep the database foreign key numeric after resolving the public input.
        const fields: Prisma.SongUncheckedUpdateInput = { pinnedRecordingId: fileId };
        const songId = await resolvePublicId(
            db3.xSong, args.songId,
            publicData, db,
        );
        await mutationCore.updateImpl(db3.xSong, songId, fields, ctx);

        return args;
    }
);

