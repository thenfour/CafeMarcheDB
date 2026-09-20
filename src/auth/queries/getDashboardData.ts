import { BigintToNumberNullable } from "@/shared/utils";
import { EventRelevanceClassValue, GetRelevantEvents, gEventRelevanceClass, kMaxRelevantEventsToQuery } from "@/src/core/db3/shared/eventRelevance";
import type { UserWithRolesPayload } from "@/src/core/db3/shared/schema/userPayloads";
import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { getClientServerState } from "shared/serverStateBase";
import {
    createDB3Authorization,
    EventStatusSignificance,
    instrumentDashboardView,
    instrumentFunctionalGroupDashboardView,
    xEvent,
    xInstrument,
    xInstrumentFunctionalGroup,
    xMenuLink,
} from "src/core/db3/db3";
import { queryTable } from "src/core/db3/server/db3QueryCore";
import { projectDB3ModelPublicIds } from "src/core/db3/server/db3PublicIds";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import { getRequestAuthorization } from "../server/requestAuthorization";
import { loadUserSettings } from "../server/userSettings";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";


// returns a list of eventIds to show in the dashboard for the current user.
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

    // iso date is like "2024-06-05T14:48:00.000Z"
    // this returns "2024-06-05 14:48:00" (trim milliseconds and the "T" character)
    const formatDate = (date: Date) =>
        date.toISOString().slice(0, 19).replace("T", " ");

    const nowFormatted = formatDate(now);
    const sevenDaysFromNowFormatted = formatDate(sevenDaysFromNow);
    const twentyFourHoursAgoFormatted = formatDate(twentyFourHoursAgo);

    const ctx = {
        now,
        sevenDaysFromNow,
        twentyFourHoursAgo,
    };

    const cancelledStatusIds = eventStatuses
        .filter(s => s.significance === EventStatusSignificance.Cancelled)
        .map(s => s.id)
        .join(", ");

    // this query only needs to return events that are possibly eligible,
    // to be later filtered / classified - not the full relevance calculation.
    const query = `
    SELECT
        e.id,
        e.startsAt,
        e.durationMillis,
        e.isAllDay,
        e.endDateTime,
        e.relevanceClassOverride
    FROM
        Event e
    WHERE
        -- critical visibility
        (${xEvent.SqlGetVisFilterExpression(currentUser, "e")})
        and (
            -- relevance class has overrides except for hidden.
            (e.relevanceClassOverride IS NOT NULL and e.relevanceClassOverride != '${gEventRelevanceClass.Hidden}')
            or (
                -- uncancelled events
                (e.statusId is null or e.statusId NOT IN (${cancelledStatusIds}))

                -- TBD events don't normally get shown (unless you explicitly pin)
                and e.startsAt is not null

                -- and within the relevance time window
                and (
                    e.endDateTime >= '${twentyFourHoursAgoFormatted}'
                )
            )
        )
    ORDER BY
        e.relevanceClassOverride is null asc, -- prioritize explicit relevance (0 = not null = first)
        abs(timestampdiff(minute, e.startsAt, '${nowFormatted}')) asc -- sort by proximity to now (closest first)
    LIMIT ${kMaxRelevantEventsToQuery};
    `;

    // debugger;
    const dbResults = (await db.$queryRaw(Prisma.raw(query))) as {
        id: number,
        startsAt: Date | null,
        durationMillis: bigint | null,
        isAllDay: boolean | null,
        endDateTime: Date | null,
        relevanceClassOverride: number | null,
    }[];

    const saneResults = dbResults.map(r => {
        return {
            id: r.id,
            startsAt: r.startsAt,
            durationMillis: BigintToNumberNullable(r.durationMillis),
            isAllDay: r.isAllDay,
            endDateTime: r.endDateTime,
            relevanceClassOverride: r.relevanceClassOverride as null | EventRelevanceClassValue,
        };
    });

    const results = GetRelevantEvents(saneResults, ctx);

    const ret = results.map(e => e.id);
    return ret;
}





export default resolver.pipe(
    async (args, ctx: Ctx) => {
        try {
            const sw = new Stopwatch();

            const authorization = await getRequestAuthorization(ctx.session);
            const currentUser = authorization.user;
            const effectivePermissions = authorization.effectivePermissions;
            const publicData = createDB3Authorization(currentUser, effectivePermissions);

            const menuItemsCall = queryTable({
                filter: { items: [] },
                cmdbQueryContext: "getDashboardData/menulinks",
                table: xMenuLink,
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
                db.instrument.findMany({ include: { instrumentTags: true, functionalGroup: true } }),
                db.instrumentTag.findMany(),
                db.instrumentFunctionalGroup.findMany(),
                db.songTag.findMany(),
                db.songCreditType.findMany(),
                menuItemsCall,
                db.wikiPageTag.findMany(),
                relevantEventsCall,
                loadBandTimeZone(db),
                loadUserSettings(currentUser?.id ?? null),
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
                wikiPageTag,
                relevantEventIds,
                bandTimeZone,
                userSettings,
            ] = results;

            const clientServerState = getClientServerState(effectivePermissions.includesName(Permission.sysadmin));
            const clientInstrumentFunctionalGroups = instrumentFunctionalGroup
                .map(group => (
                    instrumentFunctionalGroupDashboardView.parseDto(
                        projectDB3ModelPublicIds(xInstrumentFunctionalGroup, group, publicData),
                    )
                ));
            const clientInstruments = instrument.map(item => (
                instrumentDashboardView.parseDto(
                    projectDB3ModelPublicIds(xInstrument, item, publicData),
                )
            ));

            const ret = {
                userTag,
                permission,
                role,
                eventType,
                eventStatus: eventStatus.filter(status => !status.isDeleted),
                eventTag,
                eventAttendance,
                fileTag,
                instrument: clientInstruments,
                instrumentTag,
                instrumentFunctionalGroup: clientInstrumentFunctionalGroups,
                songTag,
                songCreditType,
                dynMenuLinks: dynMenuLinks.items as Prisma.MenuLinkGetPayload<{ include: { createdByUser } }>[],
                wikiPageTag,
                serverBaseUri: clientServerState.baseUri,
                serverStartupState: clientServerState.diagnostics,
                relevantEventIds,
                bandTimeZone,
                userSettings,
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


