
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { GetBasicVisFilterExpressionForEvent, GetBasicVisFilterExpressionForSong } from "../db3";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetSongActivityReportArgs, GetSongActivityReportRet, GetSongActivityReportRetEvent } from "../shared/apiTypes";
import { assertIsNumberArray } from "shared/arrayUtils";

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

            const filters: string[] = [];

            switch (args.filterSpec.timing) {
                case "All":
                    filters.push("true");
                    break;
                case "All past":
                    filters.push("e.startsAt < curdate()");
                    break;
                case "Future":
                    filters.push("e.startsAt > curdate()");
                    break;
                case "Past 5 years":
                    filters.push("e.startsAt < curdate()");
                    filters.push("e.startsAt > date_sub(curdate(), interval 5 year)");
                    break;
                case "Past year":
                    filters.push("e.startsAt < curdate()");
                    filters.push("e.startsAt > date_sub(curdate(), interval 1 year)");
                    break;
            }

            if (args.filterSpec.eventTypeIds && args.filterSpec.eventTypeIds.length > 0) {
                assertIsNumberArray(args.filterSpec.eventTypeIds);
                filters.push(`(e.typeId in (${args.filterSpec.eventTypeIds.join(",")}))`);
            }

            if (args.filterSpec.eventStatusIds && args.filterSpec.eventStatusIds.length > 0) {
                assertIsNumberArray(args.filterSpec.eventStatusIds);
                filters.push(`(e.statusId in (${args.filterSpec.eventStatusIds.join(",")}))`);
            }

            let havingClause = "";

            if (args.filterSpec.eventTagIds && args.filterSpec.eventTagIds.length > 0) {
                assertIsNumberArray(args.filterSpec.eventTagIds);
                filters.push(`(eta.eventTagId in (${args.filterSpec.eventTagIds.join(",")}))`);
                havingClause = `
                HAVING
    				COUNT(DISTINCT eta.eventTagId) = ${args.filterSpec.eventTagIds.length}
                `;
            }

            const query = `
            with e as (
                select
                    e.*
                from
                    Event e
                    left join EventTagAssignment eta on eta.eventId = e.id
                where
                    ${GetBasicVisFilterExpressionForEvent(u, "e")}
                    AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
                    AND (${filters.join(" AND ")})
                group by
                    e.id
                ${havingClause}
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



