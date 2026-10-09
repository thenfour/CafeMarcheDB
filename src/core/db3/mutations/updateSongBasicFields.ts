import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db from "db";
import { loadAuthorization } from "src/auth/server/serverAuthorization";
import { UpdateSongBasicFieldsSchema, updateSongBasicFields } from "../server/songEditing";

export default resolver.pipe(resolver.zod(UpdateSongBasicFieldsSchema),
    async (args, ctx: Ctx) => updateSongBasicFields(db, await loadAuthorization(ctx.session, args.bandPublicId), args),
);

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/mutations/updateSongBasicFields.ts:1-34
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: de16a39c6553218dd05382a347392601ce67d7906d3fec820d35e81fabfd9979
// MIGRATION_REFERENCE_BEGIN
// // updateSongBasicFields
// import { resolver } from "@blitzjs/rpc"
// import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
// import { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import * as db3 from "../db3";
// import * as mutationCore from "../server/db3mutationCore";
// import { TupdateSongBasicFieldsArgs } from "../shared/apiTypes";
// import db from "db";
// import { resolvePublicId } from "../server/db3PublicIds";
//
// // entry point ////////////////////////////////////////////////
// export default resolver.pipe(
//     cmauthorize(Permission.login),
//     async (args: TupdateSongBasicFieldsArgs, ctx: CMAuthCtxWithUser) => {
//
//         // verbose on purpose in order to validate args type against UncheckedUpdateInput
//         const fields: Prisma.SongUncheckedUpdateInput = {
//             description: args.description,
//         };
//
//
//         if (!db3.xSong.authorizeTableForEdit(ctx.auth)) {
//             throw new mutationCore.DB3MutationAuthorizationError(db3.xSong.tableName, Object.keys(fields));
//         }
//         const songId = await resolvePublicId(
//             db3.xSong, args.songId,
//             ctx.auth, db,
//         );
//         await mutationCore.updateImpl(db3.xSong, songId, fields, ctx.auth);
//
//         return args;
//     }
// );
// MIGRATION_REFERENCE_END
