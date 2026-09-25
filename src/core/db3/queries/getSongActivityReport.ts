
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import * as db3 from "../db3";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetSongActivityReportArgs, GetSongActivityReportRet, GetSongActivityReportRetEvent } from "../shared/apiTypes";
import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";
import { resolvePublicIds } from "../server/db3PublicIds";
import { assertIsNumberArray } from "@/shared/arrayUtils";

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
            const authorization = await getRequestAuthorization(ctx.session);
            const publicData = db3.createDB3Authorization(
                authorization.user,
                authorization.effectivePermissions,
            );
            const [eventTypeIds, eventStatusIds, eventTagIds] = await Promise.all([
                resolvePublicIds(db3.xEventType, args.filterSpec.eventTypeIds, publicData, db),
                resolvePublicIds(db3.xEventStatus, args.filterSpec.eventStatusIds, publicData, db),
                resolvePublicIds(db3.xEventTag, args.filterSpec.eventTagIds, publicData, db),
            ]);

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

            if (eventTypeIds.length > 0) {
                assertIsNumberArray(eventTypeIds);
                filters.push(`(e.typeId in (${eventTypeIds.join(",")}))`);
            }

            if (eventStatusIds.length > 0) {
                assertIsNumberArray(eventStatusIds);
                filters.push(`(e.statusId in (${eventStatusIds.join(",")}))`);
            }

            let havingClause = "";

            if (eventTagIds.length > 0) {
                assertIsNumberArray(eventTagIds);
                filters.push(`(eta.eventTagId in (${eventTagIds.join(",")}))`);
                havingClause = `
                HAVING
					COUNT(DISTINCT eta.eventTagId) = ${eventTagIds.length}
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
                    ${db3.xEvent.SqlGetVisFilterExpression(u, "e")}
                    AND (startsAt is not null) -- TBD events are almost by definition irrelevant to stats like this. don't bother with a param
                    AND (${filters.join(" AND ")})
                group by
                    e.id
                ${havingClause}
            )
            select
                e.publicId,
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
                AND ${db3.xSong.SqlGetVisFilterExpression(u, "s")}
            group by
                e.id                
        `;

            // This raw query selects the branded identity's string representation.
            const rawEvents = await db.$queryRaw(Prisma.raw(query)) as Array<Omit<GetSongActivityReportRetEvent, "publicId"> & { publicId: string }>;
            const events: GetSongActivityReportRetEvent[] = rawEvents.map(event => ({
                ...event,
                publicId: db3.xEvent.parseIdentity(event.publicId),
            }));

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



