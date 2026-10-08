import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("songWorkflows"),
);

// MIGRATION_RESTORE: song-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/db3/queries/getSongPinnedRecording.ts:1-73
// Reason: Song and credit screens still depend on undeclared ownership and obsolete dedicated endpoints.
// Restore: Restore song search/detail/editing, credits and pinned recording with fresh selected-band authorization, visible files and public localized references; retain the recovered narrow song lookup and setlist persistence.
// Verification: Verify two bands, visibility, deleted records, revoked grants, credits, pinned recording and complete built-browser song workflows.
// SHA256: 2adc48fd49e23e2da9fc40bf345f4f05bff9d312286fbceb5b587db6fae09139
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db from "db";
// import { Permission } from "shared/permissions";
// import { z } from "zod";
// import { TSongPinnedRecording } from "../shared/apiTypes";
// import { loadAuthorization } from "src/auth/server/serverAuthorization";
// import { GetAuthorizedTableReadWhere } from "../server/db3ReadPolicy";
// import { xFile } from "../shared/schema/file";
// import { xSong } from "../shared/schema/song";
// import type { SongPublicId } from "shared/publicId";
//
// const ZArgs = z.object({
//     songIds: z.array(xSong.identitySchema),
// });
//
// export default resolver.pipe(
//     resolver.authorize(Permission.view_songs),
//     resolver.zod(ZArgs),
//     async (args, ctx: AuthenticatedCtx): Promise<Partial<Record<SongPublicId, TSongPinnedRecording>>> => {
//         try {
//             const currentUser = (await loadAuthorization(ctx.session)).user;
//             if (!currentUser) throw new Error("Current user was not found.");
//             const fileWhere = await GetAuthorizedTableReadWhere({
//                 table: xFile,
//                 auth: await loadAuthorization(ctx.session),
//             });
//             const qr = await db.song.findMany({
//                 where: await GetAuthorizedTableReadWhere({
//                     table: xSong,
//                     auth: await loadAuthorization(ctx.session),
//                     where: {
//                         publicId: { in: args.songIds },
//                         pinnedRecordingId: { not: null },
//                         pinnedRecording: fileWhere,
//                     },
//                 }),
//                 select: {
//                     publicId: true,
//                     pinnedRecording: {
//                         select: {
//                             publicId: true,
//                             fileLeafName: true,
//                             externalURI: true,
//                             mimeType: true,
//                             sizeBytes: true,
//                             fileCreatedAt: true,
//                             storedLeafName: true,
//                             uploadedAt: true,
//                         },
//                     },
//                 },
//             });
//
//             // Create a map of songId -> pinnedRecording for easy lookup
//             const result: Partial<Record<SongPublicId, TSongPinnedRecording>> = {};
//             qr.forEach(song => {
//                 if (song.pinnedRecording) {
//                     result[xSong.parseIdentity(song.publicId)] = {
//                         ...song.pinnedRecording,
//                         publicId: xFile.parseIdentity(song.pinnedRecording.publicId),
//                     };
//                 }
//             });
//
//             return result;
//
//         } catch (e) {
//             console.error(e);
//             throw (e);
//         }
//     }
// );
// MIGRATION_REFERENCE_END
