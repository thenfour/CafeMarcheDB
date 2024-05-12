/*

-- list of events where a given song has appeared
with e as (
    select
        *
    from
        event
    where
        isDeleted = false
)
select
    e.id,
    e.name,
    e.startsAt,
    e.durationMillis,
    e.isAllDay,
    e.endDateTime    
from
    Song s
    inner join eventSongListSong esls on esls.songId = s.id
    inner join eventSongList esl on esls.eventSongListId = esl.id
    inner join e on e.id = esl.eventId
where
    s.id = 2
group by
    e.id
    
*/
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GetBasicVisFilterExpressionForEvent, GetBasicVisFilterExpressionForSong } from "../db3";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetSongActivityReportArgs, GetSongActivityReportRet, GetSongActivityReportRetEvent } from "../shared/apiTypes";

export default resolver.pipe(
    resolver.authorize(Permission.view_songs),
    async (args: GetSongActivityReportArgs, ctx: AuthenticatedCtx): Promise<GetSongActivityReportRet> => {
        try {
            const u = (await getCurrentUserCore(ctx))!;
            if (!u.role || u.role.permissions.length < 1) {
                return {
                    events: [],
                    query: "",
                };
            }

            const songId = new Number(args.songId).valueOf();

            const query = `
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
                Song s
                inner join EventSongListSong esls on esls.songId = s.id
                inner join EventSongList esl on esls.eventSongListId = esl.id
                inner join e on e.id = esl.eventId
            where
                s.id = ${songId}
                AND ${GetBasicVisFilterExpressionForSong(u, "s")}
            group by
                e.id                
        `;

            const events: GetSongActivityReportRetEvent[] = await db.$queryRaw(Prisma.raw(query)) as any;

            return {
                events,
                query,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



