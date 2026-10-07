import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject all legacy inputs before reading audit records or historical references.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("auditLog"),
);

// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:src/core/db3/queries/getAdminLogItemInfo.ts:1-76
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: 7d2966540233ca661bb0756c4977218db5a37eecf936f1f91f5507921582903f
// MIGRATION_REFERENCE_BEGIN
// // for the admin log, some values need to be looked up dynamically (not cached). like how to see which event corresponds to an eventSegmentUserResponse.
// // this query does that conversion.
//
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db from "db";
// import { Permission } from "shared/permissions";
//
// type TInput = {
//     tableName: string;
//     pk: number;
// };
//
// export default resolver.pipe(
//     resolver.authorize(Permission.sysadmin),
//     async (input: TInput, ctx: AuthenticatedCtx) => {
//         try {
//             // Intentional read-policy bypass: audit history must resolve rows
//             // that are now hidden or soft-deleted. This endpoint is restricted
//             // to the protected sysadmin capability.
//             if (typeof (input.tableName) !== "string") throw new Error(`argument error`);
//             if (typeof (input.pk) !== "number") throw new Error(`argument error`);
//
//             switch (input.tableName.toLowerCase()) {
//                 case 'eventsegmentuserresponse':
//                     {
//                         const esur = await db.eventSegmentUserResponse.findFirst({ where: { id: input.pk, } });
//                         if (!esur) break;
//                         const es = await db.eventSegment.findFirst({ where: { id: esur.eventSegmentId } });
//                         if (!es) break;
//                         return {
//                             eventId: es.eventId
//                         };
//                     }
//                 case 'eventuserresponse':
//                     {
//                         const eur = await db.eventUserResponse.findFirst({ where: { id: input.pk } });
//                         if (!eur) break;
//                         return {
//                             eventId: eur.eventId,
//                         }
//                     }
//                 case 'file':
//                     {
//                         const file = await db.file.findFirst({
//                             where: { id: input.pk },
//                             select: {
//                                 publicId: true,
//                                 fileLeafName: true,
//                                 taggedEvents: { select: { eventId: true } },
//                                 taggedInstruments: {
//                                     select: { instrument: { select: { publicId: true } } },
//                                 },
//                                 taggedSongs: { select: { songId: true } },
//                                 taggedUsers: { select: { user: { select: { publicId: true } } } },
//                             }
//                         });
//                         if (!file) break;
//                         return {
//                             eventIds: file.taggedEvents.map(e => e.eventId),
//                             instrumentIds: file.taggedInstruments.map(e => e.instrument.publicId),
//                             songIds: file.taggedSongs.map(e => e.songId),
//                             userIds: file.taggedUsers.map(e => e.user.publicId),
//                             file: { publicId: file.publicId, fileLeafName: file.fileLeafName },
//                         };
//                     }
//             }
//             return {
//             };
//
//         } catch (e) {
//             console.error(e);
//             throw (e);
//         }
//     }
// );
// MIGRATION_REFERENCE_END
