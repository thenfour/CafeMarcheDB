import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject all legacy inputs before reading audit records or historical references.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("auditLog"),
);

// MIGRATION_RESTORE: audit-log
// Source: 6ee055895a049d6f105d775b4e2e563542f34d32:src/core/db3/queries/getDistinctChangeFilterValues.ts:1-82
// Reason: Legacy audit readers and JSON rendering lack scoped ownership and target-schema references.
// Restore: Restore protected audit browsing, filters, historical JSON/detail links and clipboard/Markdown inspection with explicit platform/band authorization, fresh snapshots, localized references and redaction; retain immutable audit recording.
// Verification: Reactivate preserved audit specifications; test sysadmin/member/anonymous access, two bands, deleted references, revoked grants, redaction, filters, JSON inspection and built-browser navigation.
// SHA256: 70e8ffaa17ac39b7fde97cb0a35dd4ed91eaf7d07a675d1565aa8311f81462ea
// MIGRATION_REFERENCE_BEGIN
// import { resolver } from "@blitzjs/rpc";
// import { AuthenticatedCtx } from "blitz";
// import db from "db";
// import { Permission } from "shared/permissions";
//
// export default resolver.pipe(
//     resolver.authorize(Permission.sysadmin),
//     async (input: {}, ctx: AuthenticatedCtx) => {
//         try {
//
//
//             const tableNames: { tableName: string }[] = await db.$queryRaw`
//     SELECT DISTINCT \`table\` as tableName
//     FROM \`Change\`;
// `;
//
//             // circumvent soft deletion etc.
//             const users = await db.user.findMany({
//                 select: {
//                     publicId: true,
//                     name: true,
//                     email: true,
//                 }
//             });
//
//             const songs = await db.song.findMany({
//                 select: {
//                     id: true,
//                     publicId: true,
//                     name: true,
//                 }
//             });
//
//             const events = await db.event.findMany({
//                 select: {
//                     id: true,
//                     publicId: true,
//                     name: true,
//                     startsAt: true,
//                 }
//             });
//
//             const eventSegments = await db.eventSegment.findMany({
//                 select: {
//                     id: true,
//                     eventId: true,
//                     name: true,
//                 }
//             });
//
//             const eventSonglists = await db.eventSongList.findMany({
//                 select: {
//                     id: true,
//                     eventId: true,
//                     name: true,
//                 }
//             });
//
//             // Historical Change JSON stores natural keys, including retired options.
//             const attendances = await db.eventAttendance.findMany({
//                 select: {
//                     id: true,
//                     publicId: true
//                 }
//             });
//
//             return {
//                 attendances,
//                 tableNames,
//                 users,
//                 songs,
//                 events,
//                 eventSegments,
//                 eventSonglists,
//             };
//
//         } catch (e) {
//             console.error(e);
//             throw (e);
//         }
//     }
// );
// MIGRATION_REFERENCE_END
