import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("songWorkflows"),
);

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/mutations/updateSongPinnedRecording.ts:1-36
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: 206763d4df89719ae259b66746c7b5aff232be7d9b27814ed69ace1242a52ef1
// MIGRATION_REFERENCE_BEGIN
// import { cmauthorize, type CMAuthCtxWithUser } from "@/src/auth/server/cmResolver";
// import { resolver } from "@blitzjs/rpc";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import * as db3 from "../db3";
// import * as mutationCore from "../server/db3mutationCore";
// import { resolvePublicId } from "../server/db3PublicIds";
//
// const ZArgs = z.object({
//     songId: db3.xSong.identitySchema,
//     fileId: db3.xFile.identitySchema.nullable(),
// });
//
// export default resolver.pipe(
//     cmauthorize(Permission.login),
//     resolver.zod(ZArgs),
//     async (args, ctx: CMAuthCtxWithUser) => {
//
//         if (!db3.xSong.authorizeTableForEdit(ctx.auth)) {
//             throw new mutationCore.DB3MutationAuthorizationError(db3.xSong.tableName, ["pinnedRecordingId"]);
//         }
//         const fileId = args.fileId === null
//             ? null
//             : await resolvePublicId(db3.xFile, args.fileId, ctx.auth, db);
//         // Keep the database foreign key numeric after resolving the public input.
//         const fields: Prisma.SongUncheckedUpdateInput = { pinnedRecordingId: fileId };
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
