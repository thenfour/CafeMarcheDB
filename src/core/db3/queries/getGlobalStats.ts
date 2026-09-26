import { resolver, type CMCtx } from "@/src/auth/server/cmResolver";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { GetGlobalStatsArgs, GetGlobalStatsRet, GetGlobalStatsRetEvent, GetGlobalStatsRetPopularSongOccurrance } from "../shared/apiTypes";
import { resolvePublicIds } from "../server/db3PublicIds";

export default resolver.pipe(
    resolver.cmauthorize(Permission.view_events_reports),
    async (args: GetGlobalStatsArgs, ctx: CMCtx): Promise<GetGlobalStatsRet> => {
        try {
            const u = ctx.auth.user;
            if (!u?.role || u.role.permissions.length < 1) {
                return {
                    allEvents: [],
                    popularSongsOccurrances: [],
                    //eventsQuery: "",
                    //popularSongsQuery: "",
                };
            }

            const authorization = ctx.auth;
            const publicData = authorization;
            const [eventTypeIds, eventStatusIds, eventTagIds, songTagIds] = await Promise.all([
                resolvePublicIds(db3.xEventType, args.filterSpec.eventTypeIds, publicData, db),
                resolvePublicIds(db3.xEventStatus, args.filterSpec.eventStatusIds, publicData, db),
                resolvePublicIds(db3.xEventTag, args.filterSpec.eventTagIds, publicData, db),
                resolvePublicIds(db3.xSongTag, args.filterSpec.songTagIds, publicData, db),
            ]);

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

            if (eventTypeIds.length > 0) {
                eventFilters.push(`(e.typeId in (${eventTypeIds.join(",")}))`);
            }

            if (eventStatusIds.length > 0) {
                eventFilters.push(`(e.statusId in (${eventStatusIds.join(",")}))`);
            }

            let eventHavingClause = "";

            if (eventTagIds.length > 0) {
                eventFilters.push(`(eta.eventTagId in (${eventTagIds.join(",")}))`);
                eventHavingClause = `
                HAVING
					COUNT(DISTINCT eta.eventTagId) = ${eventTagIds.length}
                `;
            }

            const songFilters: string[] = ["true"];
            let songHavingClause = "";
            if (songTagIds.length > 0) {
                songFilters.push(`(sta.tagId in (${songTagIds.join(",")}))`);
                songHavingClause = `
                HAVING
					COUNT(DISTINCT sta.tagId) = ${songTagIds.length}
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
                    ${db3.xSong.SqlGetVisFilterExpression(u, "s")}
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
                    ${db3.xEvent.SqlGetVisFilterExpression(u, "e")}
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
                ps.publicId songId,
                ps.name songName,
                e.publicId eventId,
                e.name eventName,
                e.startsAt,
                e.durationMillis,
                e.isAllDay,
                e.endDateTime,
                eventStatus.publicId statusId,
                eventType.publicId typeId
            from
                popularSongs as ps
                inner join EventSongListSong esls on esls.songId = ps.id
                inner join EventSongList esl on esls.eventSongListId = esl.id
                inner join e on e.id = esl.eventId
                left join EventStatus eventStatus on eventStatus.id = e.statusId
                left join EventType eventType on eventType.id = e.typeId
            group by
                e.id,
                ps.id       
        `;

            // Raw SQL exposes public-ID strings; parse each branded value at the boundary.
            const rawPopularSongs = await db.$queryRaw(Prisma.raw(popularSongsQuery)) as Array<
                Omit<GetGlobalStatsRetPopularSongOccurrance, "songId" | "eventId" | "statusId" | "typeId"> & {
                    songId: string;
                    eventId: string;
                    statusId: string | null;
                    typeId: string | null;
                }
            >;
            const popularSongsOccurrances: GetGlobalStatsRetPopularSongOccurrance[] = rawPopularSongs.map(item => ({
                ...item,
                songId: db3.xSong.parseIdentity(item.songId),
                eventId: db3.xEvent.parseIdentity(item.eventId),
                statusId: item.statusId ? db3.xEventStatus.parseIdentity(item.statusId) : null,
                typeId: item.typeId ? db3.xEventType.parseIdentity(item.typeId) : null,
            }));

            const eventsQuery = `
            -- list of events
            with e as (
                select
                    e.*
                from
                    Event e
                    left join EventTagAssignment eta on eta.eventId = e.id
                where
                    ${db3.xEvent.SqlGetVisFilterExpression(u, "e")}
                    AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
                    AND (${eventFilters.join(" AND ")})
                group by
                    e.id
                ${eventHavingClause}
            )
            select
                e.publicId,
                e.name,
                e.startsAt,
                e.durationMillis,
                e.isAllDay,
                e.endDateTime,
                eventStatus.publicId statusId,
                eventType.publicId typeId
            from
                e
                left join EventStatus eventStatus on eventStatus.id = e.statusId
                left join EventType eventType on eventType.id = e.typeId
                
        `;

            // Raw SQL exposes public-ID strings; parse each branded value at the boundary.
            const rawEvents = await db.$queryRaw(Prisma.raw(eventsQuery)) as Array<
                Omit<GetGlobalStatsRetEvent, "publicId" | "statusId" | "typeId"> & {
                    publicId: string;
                    statusId: string | null;
                    typeId: string | null;
                }
            >;
            const allEvents: GetGlobalStatsRetEvent[] = rawEvents.map(event => ({
                ...event,
                publicId: db3.xEvent.parseIdentity(event.publicId),
                statusId: event.statusId ? db3.xEventStatus.parseIdentity(event.statusId) : null,
                typeId: event.typeId ? db3.xEventType.parseIdentity(event.typeId) : null,
            }));
            const isSysadmin = authorization.effectivePermissions.includesName(Permission.sysadmin);

            return {
                popularSongsOccurrances,
                allEvents,
                //popularSongsQuery: isSysadmin ? popularSongsQuery : "",
                //eventsQuery: isSysadmin ? eventsQuery : "",
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



