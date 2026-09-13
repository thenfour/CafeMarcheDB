import { BigintToNumber } from "@/shared/utils";
import type { UserWithRolesPayload } from "@/src/core/db3/shared/schema/userPayloads";
import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { getClientServerState } from "shared/serverStateBase";
import { EventStatusSignificance, gEventRelevanceClass, gVisibleEventRelevanceClasses, xEvent, xMenuLink } from "src/core/db3/db3";
import { queryTable } from "src/core/db3/server/db3QueryCore";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { getRequestAuthorization } from "../server/requestAuthorization";
import { loadBandTimeZone } from "src/server/dateTime";

async function getTopRelevantEvents(currentUser: UserWithRolesPayload | null, eventStatuses: Prisma.EventStatusGetPayload<{}>[], db: TransactionalPrismaClient): Promise<number[]> {
    if (!currentUser) {
        // no user, no events.
        return [];
    }
    const now = new Date();
    const sevenDaysFromNow = new Date(now);
    sevenDaysFromNow.setDate(now.getDate() + 7); // 7 days allows you to see next week's rehearsal just after the last one ends.

    const twentyFourHoursAgo = new Date(now);
    twentyFourHoursAgo.setDate(now.getDate() - 1);

    const formatDate = (date: Date) =>
        date.toISOString().slice(0, 19).replace("T", " ");

    const nowFormatted = formatDate(now);
    const sevenDaysFromNowFormatted = formatDate(sevenDaysFromNow);
    const twentyFourHoursAgoFormatted = formatDate(twentyFourHoursAgo);

    const cancelledStatusIds = eventStatuses.filter(s => s.significance === EventStatusSignificance.Cancelled).map(s => s.id).join(", ");

    const query = `
    WITH ClassifiedEvents AS (
      SELECT
        id,
        startsAt,
        CASE 
          WHEN relevanceClassOverride IS NOT NULL THEN relevanceClassOverride -- Use explicit override if set
          WHEN startsAt <= '${nowFormatted}' AND (endDateTime IS NULL OR endDateTime >= '${nowFormatted}') THEN ${gEventRelevanceClass.Ongoing}
          WHEN startsAt >= '${nowFormatted}' AND startsAt <= '${sevenDaysFromNowFormatted}' THEN ${gEventRelevanceClass.Upcoming}
          WHEN endDateTime IS NOT NULL AND endDateTime >= '${twentyFourHoursAgoFormatted}' AND endDateTime <= '${nowFormatted}' THEN ${gEventRelevanceClass.RecentPast}
          WHEN startsAt > '${sevenDaysFromNowFormatted}' THEN ${gEventRelevanceClass.Future} -- Future, only shown if better events aren't available
          ELSE ${gEventRelevanceClass.Hidden} -- Default/Unclassified (optional, for events that don't fit the criteria)
        END AS relevance_class
      FROM Event
      where
        (
            (relevanceClassOverride is not null)
            or (statusId is null or statusId NOT IN (${cancelledStatusIds}))
        )
        and isDeleted = false
        and (${xEvent.SqlGetVisFilterExpression(currentUser, "Event")})
    )
    SELECT id, relevance_class
    FROM ClassifiedEvents
    WHERE relevance_class IN (${gVisibleEventRelevanceClasses.join(",")}) -- Filter to relevant events
    ORDER BY
      relevance_class ASC, -- Primary sorting by relevance
      startsAt ASC
    LIMIT ${5};
    
    `;

    // debugger;
    const events = (await db.$queryRaw(Prisma.raw(query))) as { id: number, relevance_class: bigint }[];

    // only show class 4 events if there are no class 1, 2, or 3 events.
    const hasClass123 = events.some(e => e.relevance_class < 4);
    if (hasClass123) {
        // filter out class 4 events
        return events.filter(e => e.relevance_class < 4).map(e => e.id);
    } else {
        // take only the 1st class 4 event if exists.
        const class4Event = events.find(e => BigintToNumber(e.relevance_class) === 4);
        if (class4Event) {
            return [class4Event.id];
        }
    }

    const ret = events.map(e => e.id);
    return ret;
}





export default resolver.pipe(
    async (args, ctx: Ctx) => {
        try {
            const sw = new Stopwatch();

            const authorization = await getRequestAuthorization(ctx.session);
            const currentUser = authorization.user;
            const effectivePermissions = authorization.effectivePermissions;

            const menuItemsCall = queryTable({
                filter: { items: [] },
                cmdbQueryContext: "getDashboardData/menulinks",
                tableID: xMenuLink.tableID,
                tableName: xMenuLink.tableName,
                orderBy: undefined,
            }, authorization);

            // Existing events retain the meaning of a status after that status
            // is retired, so relevance calculations use every referenced row.
            // Only active statuses are exposed as the client-side option list.
            const eventStatus = await db.eventStatus.findMany();

            const relevantEventsCall = getTopRelevantEvents(currentUser, eventStatus, db as any /* Excessive stack depth comparing types 'PrismaClient<PrismaClientOptions, unknown, InternalArgs> & EnhancedPrismaClientAddedMethods' and 'TransactionalPrismaClient' */);

            const results = await Promise.all([
                db.userTag.findMany(),
                db.permission.findMany(),
                db.role.findMany(),
                db.eventType.findMany({ where: { isDeleted: false } }),
                //db.eventStatus.findMany(),
                db.eventTag.findMany(),
                db.eventAttendance.findMany({ where: { isDeleted: false } }),
                db.fileTag.findMany(),
                db.instrument.findMany({ include: { instrumentTags: true } }),
                db.instrumentTag.findMany(),
                db.instrumentFunctionalGroup.findMany(),
                db.songTag.findMany(),
                db.songCreditType.findMany(),
                menuItemsCall,
                db.eventCustomField.findMany(),
                db.wikiPageTag.findMany(),
                relevantEventsCall,
                loadBandTimeZone(),
            ]);

            const [
                userTag,
                permission,
                role,
                eventType,
                //eventStatus,
                eventTag,
                eventAttendance,
                fileTag,
                instrument,
                instrumentTag,
                instrumentFunctionalGroup,
                songTag,
                songCreditType,
                dynMenuLinks,
                eventCustomField,
                wikiPageTag,
                relevantEventIds,
                bandTimeZone,
            ] = results;

            const clientServerState = getClientServerState(effectivePermissions.includesName(Permission.sysadmin));

            const ret = {
                userTag,
                permission,
                role,
                eventType,
                eventStatus: eventStatus.filter(status => !status.isDeleted),
                eventTag,
                eventAttendance,
                fileTag,
                instrument,
                instrumentTag,
                instrumentFunctionalGroup,
                songTag,
                songCreditType,
                dynMenuLinks: dynMenuLinks.items as Prisma.MenuLinkGetPayload<{ include: { createdByUser } }>[],
                eventCustomField,
                wikiPageTag,
                serverBaseUri: clientServerState.baseUri,
                serverStartupState: clientServerState.diagnostics,
                relevantEventIds,
                bandTimeZone,
                effectivePermissionNames: effectivePermissions.names,
                effectivePermissionIds: effectivePermissions.ids,
            };
            if (process.env.NODE_ENV === "development") {
                sw.loghelper("total", ret);
            }
            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);


