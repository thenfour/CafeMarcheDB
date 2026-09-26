// updateSongBasicFields
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateSongBasicFieldsArgs } from "../shared/apiTypes";
import db from "db";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { resolvePublicId } from "../server/db3PublicIds";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (args: TupdateSongBasicFieldsArgs, ctx: AuthenticatedCtx) => {

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.SongUncheckedUpdateInput = {
            description: args.description,
        };


        const authorization = await getRequestAuthorization(ctx.session);
        const publicData = db3.createDB3Authorization(authorization.user, authorization.effectivePermissions);
        if (!db3.xSong.authorizeTableForEdit(publicData)) {
            throw new mutationCore.DB3MutationAuthorizationError(db3.xSong.tableName, Object.keys(fields));
        }
        const songId = await resolvePublicId(
            db3.xSong, args.songId,
            publicData, db,
        );
        await mutationCore.updateImpl(db3.xSong, songId, fields, ctx);

        return args;
    }
);

