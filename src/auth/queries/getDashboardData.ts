import { BigintToNumberNullable } from "@/shared/utils";
import { EventRelevanceClassValue, GetRelevantEvents, gEventRelevanceClass, kMaxRelevantEventsToQuery } from "@/src/core/db3/shared/eventRelevance";
import type { UserWithRolesPayload } from "@/src/core/db3/shared/schema/userPayloads";
import { loadBandTimeZone } from "@/src/server/bandTimeZone";
import { resolver } from "@blitzjs/rpc";
import type { Ctx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { Stopwatch } from "shared/rootroot";
import { getClientServerState } from "shared/serverStateBase";
import {
    type AnyDB3View,
    createDb3RequestAuthorization,
    type DashboardDataDto,
    type DtoOf,
    eventAttendanceDashboardView,
    eventStatusDashboardView,
    EventStatusSignificance,
    eventTagDashboardView,
    eventTypeDashboardView,
    fileTagDashboardView,
    instrumentDashboardView,
    instrumentFunctionalGroupDashboardView,
    instrumentTagDashboardView,
    menuLinkListView,
    permissionDashboardView,
    roleDashboardView,
    songCreditTypeDashboardView,
    songTagDashboardView,
    userTagDashboardView,
    wikiPageTagDashboardView,
    xEvent,
} from "src/core/db3/db3";
import {
    DB3QueryAuthorizationError,
    queryView,
} from "src/core/db3/server/db3QueryCore";
import type { TransactionalPrismaClient } from "src/core/db3/shared/apiTypes";
import {
    type RequestAuthorization
} from "../server/requestAuthorization";
import { loadUserSettings } from "../server/userSettings";

// does not choke when auth doesn't allow it; returns empty.
async function queryOptionalDashboardView<TView extends AnyDB3View>(
    view: TView,
    authorization: RequestAuthorization,
): Promise<DtoOf<TView>[]> {
    try {
        const result = await queryView({
            view,
            filter: { items: [] },
            cmdbQueryContext: `getDashboardData/${view.viewID}`,
            orderBy: undefined,
        }, authorization);
        return result.items;
    } catch (error) {
        if (error instanceof DB3QueryAuthorizationError) return [];
        throw error;
    }
}


// returns a list of eventIds to show in the dashboard for the current user.
async function getTopRelevantEvents(
    currentUser: UserWithRolesPayload | null,
    eventStatuses: readonly { id: number; significance: string | null }[],
    db: TransactionalPrismaClient,
): Promise<number[]> {
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
    // TransactionalPrismaClient deliberately erases raw-query generics; keep
    // the declared result shape next to the SELECT that establishes it.
    const dbResults: {
        id: number,
        startsAt: Date | null,
        durationMillis: bigint | null,
        isAllDay: boolean | null,
        endDateTime: Date | null,
        relevanceClassOverride: number | null,
    }[] = await db.$queryRaw(Prisma.raw(query));

    const saneResults = dbResults.map(r => {
        return {
            id: r.id,
            startsAt: r.startsAt,
            durationMillis: BigintToNumberNullable(r.durationMillis),
            isAllDay: r.isAllDay,
            endDateTime: r.endDateTime,
            // The database column is constrained to the numeric values declared
            // by gEventRelevanceClass; Prisma exposes the underlying number.
            relevanceClassOverride: r.relevanceClassOverride as null | EventRelevanceClassValue,
        };
    });

    const results = GetRelevantEvents(saneResults, ctx);

    const ret = results.map(e => e.id);
    return ret;
}





export default resolver.pipe(
    async (args, ctx: Ctx): Promise<DashboardDataDto> => {
        try {
            const sw = new Stopwatch();

            const authorization = await createDb3RequestAuthorization(ctx);
            const currentUser = authorization.user;
            const effectivePermissions = authorization.effectivePermissions;

            // Existing events retain the meaning of a status after that status
            // is retired, so relevance calculations use every referenced row.
            // Only active statuses are exposed as the client-side option list.
            const allEventStatusesCall = db.eventStatus.findMany({
                select: { id: true, significance: true },
            });
            const relevantEventsCall = allEventStatusesCall.then(eventStatuses => (
                getTopRelevantEvents(
                    currentUser,
                    eventStatuses,
                    db,
                )
            ));

            const bandTimeZoneCall = loadBandTimeZone(db);
            const userSettingsCall = loadUserSettings(currentUser?.id ?? null);

            const [
                permission,
                eventType,
                eventStatus,
                eventTag,
                eventAttendance,
                fileTag,
                instrumentFunctionalGroup,
                instrumentTag,
                songTag,
                songCreditType,
                userTag,
                role,
                wikiPageTag,
                instrument,
                dynMenuLinks,
            ] = await Promise.all([
                queryOptionalDashboardView(permissionDashboardView, authorization),
                queryOptionalDashboardView(eventTypeDashboardView, authorization),
                queryOptionalDashboardView(eventStatusDashboardView, authorization),
                queryOptionalDashboardView(eventTagDashboardView, authorization),
                queryOptionalDashboardView(eventAttendanceDashboardView, authorization),
                queryOptionalDashboardView(fileTagDashboardView, authorization),
                queryOptionalDashboardView(instrumentFunctionalGroupDashboardView, authorization),
                queryOptionalDashboardView(instrumentTagDashboardView, authorization),
                queryOptionalDashboardView(songTagDashboardView, authorization),
                queryOptionalDashboardView(songCreditTypeDashboardView, authorization),
                queryOptionalDashboardView(userTagDashboardView, authorization),
                queryOptionalDashboardView(roleDashboardView, authorization),
                queryOptionalDashboardView(wikiPageTagDashboardView, authorization),
                queryOptionalDashboardView(instrumentDashboardView, authorization),
                queryOptionalDashboardView(menuLinkListView, authorization),
            ]);

            const relevantEventIds = await relevantEventsCall;
            const bandTimeZone = await bandTimeZoneCall;
            const userSettings = await userSettingsCall;

            const clientServerState = getClientServerState(effectivePermissions.includesName(Permission.sysadmin));
            const ret = {
                userTag,
                permission,
                role,
                eventType,
                eventStatus,
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

