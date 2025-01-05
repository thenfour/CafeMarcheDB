import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { assertIsNumberArray } from "shared/utils";
import { GetBasicVisFilterExpressionForEvent, GetBasicVisFilterExpressionForSong } from "../db3";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetGlobalStatsArgs, GetGlobalStatsRet, GetGlobalStatsRetEvent, GetGlobalStatsRetPopularSongOccurrance } from "../shared/apiTypes";

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: GetGlobalStatsArgs, ctx: AuthenticatedCtx): Promise<GetGlobalStatsRet> => {
        try {
            const u = (await getCurrentUserCore(ctx))!;
            if (!u.role || u.role.permissions.length < 1) {
                return {
                    allEvents: [],
                    popularSongsOccurrances: [],
                    eventsQuery: "",
                    popularSongsQuery: "",
                };
            }


            const eventFilters: string[] = [];

            switch (args.filterSpec.timing) {
                case "All":
                    eventFilters.push("true");
                    break;
                case "All past":
                    eventFilters.push("e.startsAt < curdate()");
                    break;
                case "Future":
                    eventFilters.push("e.startsAt > curdate()");
                    break;
                case "Past 5 years":
                    eventFilters.push("e.startsAt < curdate()");
                    eventFilters.push("e.startsAt > date_sub(curdate(), interval 5 year)");
                    break;
                case "Past year":
                    eventFilters.push("e.startsAt < curdate()");
                    eventFilters.push("e.startsAt > date_sub(curdate(), interval 1 year)");
                    break;
            }

            if (args.filterSpec.eventTypeIds && args.filterSpec.eventTypeIds.length > 0) {
                assertIsNumberArray(args.filterSpec.eventTypeIds);
                eventFilters.push(`(e.typeId in (${args.filterSpec.eventTypeIds.join(",")}))`);
            }

            if (args.filterSpec.eventStatusIds && args.filterSpec.eventStatusIds.length > 0) {
                assertIsNumberArray(args.filterSpec.eventStatusIds);
                eventFilters.push(`(e.statusId in (${args.filterSpec.eventStatusIds.join(",")}))`);
            }

            let eventHavingClause = "";

            if (args.filterSpec.eventTagIds && args.filterSpec.eventTagIds.length > 0) {
                assertIsNumberArray(args.filterSpec.eventTagIds);
                eventFilters.push(`(eta.eventTagId in (${args.filterSpec.eventTagIds.join(",")}))`);
                eventHavingClause = `
                HAVING
    				COUNT(DISTINCT eta.eventTagId) = ${args.filterSpec.eventTagIds.length}
                `;
            }

            const songFilters: string[] = ["true"];
            let songHavingClause = "";

            if (args.filterSpec.songTagIds && args.filterSpec.songTagIds.length > 0) {
                assertIsNumberArray(args.filterSpec.songTagIds);
                songFilters.push(`(sta.tagId in (${args.filterSpec.songTagIds.join(",")}))`);
                songHavingClause = `
                HAVING
    				COUNT(DISTINCT sta.tagId) = ${args.filterSpec.songTagIds.length}
                `;
            }

            const popularSongsQuery = `
            -- popular songs, with list of events where they appear.
            with s as (
                select
                    s.*
                from
                    Song s
                    left join SongTagAssociation sta on sta.songId = s.id
                where
                    ${GetBasicVisFilterExpressionForSong(u, "s")}
                    AND (${songFilters.join(" AND ")})
                group by
                    s.id
                ${songHavingClause}
            ),e as (
                select
                    e.*
                from
                    Event e
                    left join EventTagAssignment eta on eta.eventId = e.id
                where
                    ${GetBasicVisFilterExpressionForEvent(u, "e")}
                    AND (e.startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
                    AND (${eventFilters.join(" AND ")})
                group by
                    e.id
                ${eventHavingClause}
            ),
            popularSongs as (
                select
                    s.*,
                    count(distinct(e.id)) eventCount
                from
                    s
                    inner join EventSongListSong esls on esls.songId = s.id
                    inner join EventSongList esl on esls.eventSongListId = esl.id
                    inner join e on e.id = esl.eventId
                group by
                    s.id
                order by
                    eventCount desc
                limit 10
            )
            select
                ps.id songId,
                ps.name songName,
                e.id eventId,
                e.name eventName,
                e.startsAt,
                e.durationMillis,
                e.isAllDay,
                e.endDateTime,
                e.statusId,
                e.typeId
            from
                popularSongs as ps
                inner join EventSongListSong esls on esls.songId = ps.id
                inner join EventSongList esl on esls.eventSongListId = esl.id
                inner join e on e.id = esl.eventId
            group by
                e.id,
                ps.id       
        `;

            const popularSongsOccurrances: GetGlobalStatsRetPopularSongOccurrance[] = await db.$queryRaw(Prisma.raw(popularSongsQuery)) as any;

            const eventsQuery = `
            -- list of events
            with e as (
                select
                    e.*
                from
                    Event e
                    left join EventTagAssignment eta on eta.eventId = e.id
                where
                    ${GetBasicVisFilterExpressionForEvent(u, "e")}
                    AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
                    AND (${eventFilters.join(" AND ")})
                group by
                    e.id
                ${eventHavingClause}
            )
            select
                e.id,
                e.name,
                e.startsAt,
                e.durationMillis,
                e.isAllDay,
                e.endDateTime,
                e.statusId,
                e.typeId
            from
                e
                
        `;

            const allEvents: GetGlobalStatsRetEvent[] = await db.$queryRaw(Prisma.raw(eventsQuery)) as any;

            return {
                popularSongsQuery,
                popularSongsOccurrances,
                allEvents,
                eventsQuery,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



