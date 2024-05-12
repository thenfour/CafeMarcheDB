import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
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

            const popularSongsQuery = `
            -- popular songs, with list of events where they appear.
            with s as (
                select
                    *
                from
                    Song
                where
                    ${GetBasicVisFilterExpressionForSong(u, "Song")}
            ),e as (
                select
                    *
                from
                    Event
                where
                    ${GetBasicVisFilterExpressionForEvent(u, "Event")}
                    AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
            ),
            popularSongs as (
                select
                    s.*,
                    count(distinct(e.id)) eventCount
                from
                    s
                    inner join eventSongListSong esls on esls.songId = s.id
                    inner join eventSongList esl on esls.eventSongListId = esl.id
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
                e.endDateTime    
            from
                popularSongs as ps
                inner join eventSongListSong esls on esls.songId = ps.id
                inner join eventSongList esl on esls.eventSongListId = esl.id
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
                    *
                from
                    Event
                where
                    ${GetBasicVisFilterExpressionForEvent(u, "Event")}
                    AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
            )
            select
                e.id,
                e.name,
                e.startsAt,
                e.durationMillis,
                e.isAllDay,
                e.endDateTime    
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



