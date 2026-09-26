// updateSongBasicFields
import { resolver, type CMAuthenticatedCtx } from "@/src/auth/server/cmResolver";
import { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import * as mutationCore from "../server/db3mutationCore";
import { TupdateSongBasicFieldsArgs } from "../shared/apiTypes";
import db from "db";
import { resolvePublicId } from "../server/db3PublicIds";

// entry point ////////////////////////////////////////////////
export default resolver.pipe(
    resolver.cmauthorize(Permission.login),
    async (args: TupdateSongBasicFieldsArgs, ctx: CMAuthenticatedCtx) => {

        // verbose on purpose in order to validate args type against UncheckedUpdateInput
        const fields: Prisma.SongUncheckedUpdateInput = {
            description: args.description,
        };


        if (!db3.xSong.authorizeTableForEdit(ctx.auth)) {
            throw new mutationCore.DB3MutationAuthorizationError(db3.xSong.tableName, Object.keys(fields));
        }
        const songId = await resolvePublicId(
            db3.xSong, args.songId,
            ctx.auth, db,
        );
        await mutationCore.updateImpl(db3.xSong, songId, fields, ctx);

        return args;
    }
);

