import { getRequestAuthorization } from "@/src/auth/server/requestAuthorization";

import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { DateSortPredicateAsc, DateSortPredicateDesc } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "../db3";
import { queryTable, queryView } from "../server/db3QueryCore";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { EventRelevantFilterExpression, GetEventFilterInfoChipInfo, GetEventFilterInfoRet, MakeGetEventFilterInfoRet, TimingFilter } from "../shared/apiTypes";
import { SplitQuickFilter } from "shared/quickFilter";
import { MysqlEscape } from "shared/mysqlUtils";
import type { EventStatusPublicId, EventTagPublicId, EventTypePublicId, UserTagPublicId } from "shared/publicId";
import { resolvePublicIds } from "../server/db3PublicIds";

interface TArgs {
    filterSpec: {
        quickFilter: string,
        typeIds: EventTypePublicId[];
        tagIds: EventTagPublicId[];
        statusIds: EventStatusPublicId[];

        // none, past, future, all
        timingFilter: TimingFilter;

        orderBy: "StartAsc" | "StartDesc";
        pageSize: number;
        page: number;
        refreshSerial: number;
    }
};

export default resolver.pipe(
    resolver.authorize(Permission.view_events_nonpublic),
    async (args: TArgs, ctx: AuthenticatedCtx): Promise<GetEventFilterInfoRet> => {
        try {
            const u = (await getCurrentUserCore(ctx))!;
            if (!u.role || u.role.permissions.length < 1) {
                return MakeGetEventFilterInfoRet();
            }

            const pageSize = Math.min(args.filterSpec.pageSize, 100); // sanity.

            const startTimestamp = Date.now();
            const authorization = await getRequestAuthorization(ctx.session);
            const publicData = db3.createDB3Authorization(
                authorization.user,
                authorization.effectivePermissions,
            );
            const [statusIds, tagIds, typeIds] = await Promise.all([
                resolvePublicIds(db3.xEventStatus, args.filterSpec.statusIds, publicData, db),
                resolvePublicIds(db3.xEventTag, args.filterSpec.tagIds, publicData, db),
                resolvePublicIds(db3.xEventType, args.filterSpec.typeIds, publicData, db),
            ]);

            const eventFilterExpressions: string[] = [];
            if (!IsNullOrWhitespace(args.filterSpec.quickFilter)) {
                // tokens are AND'd together.
                const tokens = SplitQuickFilter(args.filterSpec.quickFilter);
                const tokensExpr = tokens.map(t => {
                    const qf = MysqlEscape(t);
                    const or = [
                        `(Event.name LIKE '%${qf}%')`,
                        `(Event.locationDescription LIKE '%${qf}%')`,
                    ];
                    return `(${or.join(" OR ")})`;
                });

                eventFilterExpressions.push(`(${tokensExpr.join(" AND ")})`);
            }

            if (typeIds.length > 0) {
                eventFilterExpressions.push(`(Event.typeId IN (${typeIds}))`);
            }

            if (statusIds.length > 0) {
                eventFilterExpressions.push(`(Event.statusId IN (${statusIds}))`);
            }

            const timingFilterExpressions: Record<TimingFilter, string | null> = {
                "past": `(endDateTime <= curdate())`,
                "since 60 days": `((startsAt >= DATE_SUB(curdate(), INTERVAL 60 day)) OR (startsAt IS NULL))`,
                "relevant": EventRelevantFilterExpression({ startsAtExpr: `startsAt` }),//`((startsAt >= DATE_SUB(curdate(), INTERVAL 6 day)) OR (startsAt IS NULL))`,
                "future": `((startsAt >= curdate()) or (startsAt is null))`,
                "all": null,
            };

            if (timingFilterExpressions[args.filterSpec.timingFilter]) {
                eventFilterExpressions.push(timingFilterExpressions[args.filterSpec.timingFilter] || "<never>");
            }

            let havingClause = "";

            if (tagIds.length > 0) {
                eventFilterExpressions.push(`(EventTagAssignment.eventTagId IN (${tagIds}))`);
                // make sure items have matched ALL tags, not just any.
                havingClause = `
                HAVING
					COUNT(DISTINCT EventTagAssignment.eventTagId) = ${tagIds.length}
                `;
            }

            const eventFilterExpression = eventFilterExpressions.length > 0 ? `(${eventFilterExpressions.join(" and ")})` : "";

            const AND: string[] = [];

            //AND.push(db3.GetBasicVisFilterExpressionForEvent(u, "Event"));
            AND.push(db3.xEvent.SqlGetVisFilterExpression(u, "Event"));

            if (!IsNullOrWhitespace(eventFilterExpression)) {
                AND.push(eventFilterExpression);
            }

            // even though we're accessing the EventTagAssignment table here, it will filter out relevant tags we want later so
            // don't be tempted to access it. the output of this query is really just the Event table.
            const filteredEventsCTE = `
        WITH FilteredEvents AS (
            SELECT 
                Event.id AS EventId,
                Event.statusId,
                Event.typeId,
                Event.startsAt,
                Event.name
            FROM 
                Event
            left JOIN 
                EventTagAssignment ON Event.id = EventTagAssignment.eventId
            WHERE
                ${AND.join("\n AND ")}
            group by
				Event.id
            ${havingClause}
        )
        `;

            // STATUSES
            const statusesQuery = `
        ${filteredEventsCTE}
        SELECT 
            EventStatus.publicId AS id,
            EventStatus.label,
            EventStatus.color,
            EventStatus.iconName,
            EventStatus.description,
            count(distinct(FilteredEvents.EventId)) AS event_count
        FROM 
            EventStatus
        JOIN 
            FilteredEvents ON EventStatus.id = FilteredEvents.statusId
        where
            EventStatus.isDeleted = FALSE
        GROUP BY 
            EventStatus.id
        order by
            --count(distinct(FilteredEvents.EventId)) desc, -- seems natural to do this but it causes things to constantly reorder
            EventStatus.sortOrder asc
        `;

            // TYPES
            const typesQuery = `
        ${filteredEventsCTE}
        SELECT 
            EventType.publicId AS id,
            EventType.text,
            EventType.color,
            EventType.iconName,
            EventType.description,
            count(distinct(FilteredEvents.EventId)) AS event_count
        FROM 
            EventType
        JOIN 
            FilteredEvents ON EventType.id = FilteredEvents.typeId
        where
            EventType.isDeleted = FALSE
        GROUP BY 
            EventType.id
        order by
            -- count(distinct(FilteredEvents.EventId)) desc, -- seems natural to do this but it causes things to constantly reorder
            EventType.sortOrder asc
            `;

            // TAGS
            const tagsQuery = `
        ${filteredEventsCTE}
    select
        ET.publicId AS id,
        ET.text,
        ET.color,
        ET.description,
        count(distinct(FE.EventId)) as event_count
    from
        FilteredEvents as FE
    join 
        EventTagAssignment as ETA on FE.EventId = ETA.eventId
    join 
        EventTag as ET on ET.id = ETA.eventTagId
    group by
        ET.id
    order by
        -- count(distinct(FE.EventId)) desc, -- seems natural to do this but it causes things to constantly reorder
        ET.sortOrder asc

        `;

            // PAGINATED EVENT LIST
            const sortOrder = args.filterSpec.orderBy === "StartAsc" ? "ASC" : "DESC";
            const paginatedEventQuery = `
        ${filteredEventsCTE}
    select
        FE.EventId
    from
        FilteredEvents as FE
    order by
        isnull(FE.startsAt) ${sortOrder},
        FE.startsAt ${sortOrder},
        FE.name ${sortOrder}
    limit
        ${pageSize * args.filterSpec.page}, ${pageSize}

        `;

            // TOTAL filtered row count
            const totalRowCountQuery = `
        ${filteredEventsCTE}
    select
		count(*) as rowCount
    from
        FilteredEvents

        `;

            // actually parallelizing these calls doesn't seem to improve anything. wish there was a way to leverage the CTE across multiple queries.
            const pq = await Promise.all([
                db.$queryRaw(Prisma.raw(statusesQuery)),
                db.$queryRaw(Prisma.raw(typesQuery)),
                db.$queryRaw(Prisma.raw(tagsQuery)),
                db.$queryRaw(Prisma.raw(paginatedEventQuery)),
                db.$queryRaw(Prisma.raw(totalRowCountQuery)),
            ]);

            // Raw SQL results are validated structurally by the explicit selected columns above.
            const statusesResult = pq[0] as Array<{
                id: EventStatusPublicId;
                label: string;
                color: string | null;
                iconName: string | null;
                description: string;
                event_count: bigint;
            }>;
            // Raw SQL results are validated structurally by the explicit selected columns above.
            const typesResult = pq[1] as Array<{
                id: EventTypePublicId;
                text: string;
                color: string | null;
                iconName: string | null;
                description: string;
                event_count: bigint;
            }>;
            // Raw SQL results are validated structurally by the explicit selected columns above.
            const tagsResult = pq[2] as Array<{
                id: EventTagPublicId;
                text: string;
                color: string | null;
                description: string;
                event_count: bigint;
            }>;
            const eventIds: { EventId: number }[] = pq[3] as any;
            const rowCountResult: { rowCount: bigint }[] = pq[4] as any;

            // FULL EVENT DETAILS USING DB3.
            let fullEvents: db3.EventSearchDto[] = [];
            if (eventIds.length) {
                const tableParams: db3.EventTableParams = {
                    eventIds: eventIds.map(e => e.EventId), // prevent fetching the entire table!
                };

                const queryResult = await queryTable({
                    cmdbQueryContext: "getEventFilterInfo",
                    table: {
                        tableID: db3.xEvent.tableID,
                        tableName: db3.xEvent.tableName,
                        viewID: db3.eventSearchView.viewID,
                    },
                    filter: {
                        tableParams,
                    },
                    orderBy: undefined,
                }, authorization);

                // queryTable's legacy return type is intentionally untyped; the
                // named view validates every item against this DTO contract.
                fullEvents = queryResult.items as db3.EventSearchDto[];

                switch (args.filterSpec.orderBy) {
                    default:
                    case "StartAsc":
                        fullEvents.sort((a, b) => DateSortPredicateAsc(a.startsAt, b.startsAt));
                        break;
                    case "StartDesc":
                        fullEvents.sort((a, b) => DateSortPredicateDesc(a.startsAt, b.startsAt));
                        break;
                }
            }

            const expectedAttendanceUserTagIds = new Set<UserTagPublicId>();
            fullEvents.forEach(e => {
                if (!e.expectedAttendanceUserTagId) return;
                expectedAttendanceUserTagIds.add(e.expectedAttendanceUserTagId);
            });

            let userTags: db3.ClientOf<typeof db3.userTagEventSearchView>[] = [];

            if (expectedAttendanceUserTagIds.size) {
                const tableParams: db3.UserTagTableParams = {
                    ids: [...expectedAttendanceUserTagIds],
                };

                const queryResult = await queryView({
                    cmdbQueryContext: "getEventFilterInfo-userTags",
                    view: db3.userTagEventSearchView,
                    filter: {
                        tableParams,
                    },
                    orderBy: undefined,
                }, authorization, new db3.DB3ReferenceStore());

                userTags = queryResult.items;
            }

            const statuses: GetEventFilterInfoChipInfo<EventStatusPublicId>[] = statusesResult.map(r => ({
                color: r.color,
                iconName: r.iconName,
                id: r.id,
                label: r.label,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

            const types: GetEventFilterInfoChipInfo<EventTypePublicId>[] = typesResult.map(r => ({
                color: r.color,
                iconName: r.iconName,
                id: r.id,
                label: r.text,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

            const tags: GetEventFilterInfoChipInfo<EventTagPublicId>[] = tagsResult.map(r => ({
                color: r.color,
                iconName: null,
                id: r.id,
                label: r.text,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

            const totalExecutionTimeMS = Date.now() - startTimestamp;

            const ret: GetEventFilterInfoRet = {
                rowCount: new Number(rowCountResult[0]!.rowCount).valueOf(),
                eventIds: eventIds.map(e => e.EventId),

                types,
                statuses,
                tags,

                typesQuery,
                statusesQuery,
                tagsQuery,
                paginatedEventQuery,

                totalExecutionTimeMS,

                fullEvents,
                userTags,
            };

            //console.log(`getEventFilterInfo executed in ${totalExecutionTimeMS} ms; payloadsize=${JSON.stringify(ret).length}`);

            return ret;
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



