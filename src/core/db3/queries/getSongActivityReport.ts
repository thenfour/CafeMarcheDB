import { resolver } from "@blitzjs/rpc";
import { Permission } from "shared/permissions";
import { requireRestoredApplicationFeature } from "src/core/shared/applicationRecovery";

// Reject every legacy input before reading authorization, domain rows or references.
export default resolver.pipe(
    resolver.authorize(Permission.login),
    async (_args: unknown): Promise<never> => requireRestoredApplicationFeature("eventSongStatistics"),
);

// MIGRATION_RESTORE: event-song-statistics
// Source: 8fdb9fd6ba7c2bb21718fd050181aad06c6eda97:src/core/db3/queries/getSongActivityReport.ts:1-122
// Reason: Event statistics and song history use legacy SQL readers without selected-band snapshots and depend on removed role/catalog fields.
// Restore: Restore event statistics, popular-song occurrences and song performance history with timing/type/status/tag filters, visualization, bucket selection, expansion and event links using fresh band-scoped authorization, public identities and localized catalog labels.
// Verification: Test two bands, platform policy, permission/member revocation, hidden/deleted songs/events, date boundaries, consistent aggregates and public references; exercise statistics and song history controls in the built browser.
// SHA256: d0efc70cb1b6397ca15b8ec847e169d12b6da7bdff7c48fa287a5401a1118625
// MIGRATION_REFERENCE_BEGIN
//
// import { assertIsNumberArray } from "@/shared/arrayUtils";
// import { cmauthorize, type CMAuthCtx } from "@/src/auth/server/cmResolver";
// import { resolver } from "@blitzjs/rpc";
// import db, { Prisma } from "db";
// import { Permission } from "shared/permissions";
// import * as db3 from "../db3";
// import { resolvePublicId, resolvePublicIds } from "../server/db3PublicIds";
// import { GetSongActivityReportArgs, GetSongActivityReportRet, GetSongActivityReportRetEvent } from "../shared/apiTypes";
//
// export default resolver.pipe(
//     cmauthorize(Permission.view_songs),
//     async (args: GetSongActivityReportArgs, ctx: CMAuthCtx): Promise<GetSongActivityReportRet> => {
//         try {
//             const u = ctx.auth.user;
//             if (!u?.role || u.role.permissions.length < 1) {
//                 return {
//                     events: [],
//                 };
//             }
//
//             const authorization = ctx.auth;
//             const songId = await resolvePublicId(db3.xSong, args.songId, authorization, db);
//             const [eventTypeIds, eventStatusIds, eventTagIds] = await Promise.all([
//                 resolvePublicIds(db3.xEventType, args.filterSpec.eventTypeIds, authorization, db),
//                 resolvePublicIds(db3.xEventStatus, args.filterSpec.eventStatusIds, authorization, db),
//                 resolvePublicIds(db3.xBandEventTag, args.filterSpec.eventTagIds, authorization, db),
//             ]);
//
//             const filters: string[] = [];
//
//             switch (args.filterSpec.timing) {
//                 case "All":
//                     filters.push("true");
//                     break;
//                 case "All past":
//                     filters.push("e.startsAt < curdate()");
//                     break;
//                 case "Future":
//                     filters.push("e.startsAt > curdate()");
//                     break;
//                 case "Past 5 years":
//                     filters.push("e.startsAt < curdate()");
//                     filters.push("e.startsAt > date_sub(curdate(), interval 5 year)");
//                     break;
//                 case "Past year":
//                     filters.push("e.startsAt < curdate()");
//                     filters.push("e.startsAt > date_sub(curdate(), interval 1 year)");
//                     break;
//             }
//
//             if (eventTypeIds.length > 0) {
//                 assertIsNumberArray(eventTypeIds);
//                 filters.push(`(e.typeId in (${eventTypeIds.join(",")}))`);
//             }
//
//             if (eventStatusIds.length > 0) {
//                 assertIsNumberArray(eventStatusIds);
//                 filters.push(`(e.statusId in (${eventStatusIds.join(",")}))`);
//             }
//
//             let havingClause = "";
//
//             if (eventTagIds.length > 0) {
//                 assertIsNumberArray(eventTagIds);
//                 filters.push(`(eta.bandEventTagId in (${eventTagIds.join(",")}))`);
//                 havingClause = `
//                 HAVING
// 					COUNT(DISTINCT eta.bandEventTagId) = ${eventTagIds.length}
//                 `;
//             }
//
//             const query = `
//             with e as (
//                 select
//                     e.*
//                 from
//                     Event e
//                     left join EventTagAssignment eta on eta.eventId = e.id
//                 where
//                     ${db3.xEvent.SqlGetVisFilterExpression({ auth: ctx.auth, tableAlias: "e" })}
//                     AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
//                     AND (${filters.join(" AND ")})
//                 group by
//                     e.id
//                 ${havingClause}
//             )
//             select
//                 e.publicId,
//                 e.name,
//                 e.startsAt,
//                 e.durationMillis,
//                 e.isAllDay,
//                 e.endDateTime
//             from
//                 Song s
//                 inner join EventSongListSong esls on esls.songId = s.id
//                 inner join EventSongList esl on esls.eventSongListId = esl.id
//                 inner join e on e.id = esl.eventId
//             where
//                 s.id = ${songId}
//                 AND ${db3.xSong.SqlGetVisFilterExpression({ auth: ctx.auth, tableAlias: "s" })}
//             group by
//                 e.id
//         `;
//
//             // This raw query selects the branded identity's string representation.
//             const rawEvents = await db.$queryRaw(Prisma.raw(query)) as Array<Omit<GetSongActivityReportRetEvent, "publicId"> & { publicId: string }>;
//             const events: GetSongActivityReportRetEvent[] = rawEvents.map(event => ({
//                 ...event,
//                 publicId: db3.xEvent.parseIdentity(event.publicId),
//             }));
//
//             return {
//                 events,
//             };
//         } catch (e) {
//             console.error(e);
//             throw (e);
//         }
//     }
// );
// MIGRATION_REFERENCE_END
