
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { DateSortPredicateAsc, DateSortPredicateDesc } from "shared/time";
import { IsNullOrWhitespace } from "shared/utils";
import * as db3 from "../db3";
import { DB3QueryCore2 } from "../server/db3QueryCore";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { EventRelevantFilterExpression, GetEventFilterInfoChipInfo, GetEventFilterInfoRet, MakeGetEventFilterInfoRet, TimingFilter } from "../shared/apiTypes";
import { SplitQuickFilter } from "shared/quickFilter";
import { assertIsNumberArray } from "shared/arrayUtils";
import { MysqlEscape } from "shared/mysqlUtils";

interface TArgs {
    filterSpec: {
        quickFilter: string,
        typeIds: number[];
        tagIds: number[];
        statusIds: number[];

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

            assertIsNumberArray(args.filterSpec.statusIds);
            assertIsNumberArray(args.filterSpec.tagIds);
            assertIsNumberArray(args.filterSpec.typeIds);

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

            if (args.filterSpec.typeIds.length > 0) {
                eventFilterExpressions.push(`(Event.typeId IN (${args.filterSpec.typeIds}))`);
            }

            if (args.filterSpec.statusIds.length > 0) {
                eventFilterExpressions.push(`(Event.statusId IN (${args.filterSpec.statusIds}))`);
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

            if (args.filterSpec.tagIds.length > 0) {
                eventFilterExpressions.push(`(EventTagAssignment.eventTagId IN (${args.filterSpec.tagIds}))`);
                // make sure items have matched ALL tags, not just any.
                havingClause = `
                HAVING
    				COUNT(DISTINCT EventTagAssignment.eventTagId) = ${args.filterSpec.tagIds.length}
                `;
            }

            const eventFilterExpression = eventFilterExpressions.length > 0 ? `(${eventFilterExpressions.join(" and ")})` : "";

            const AND: string[] = [];

            AND.push(db3.GetBasicVisFilterExpressionForEvent(u, "Event"));

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
            EventStatus.*,
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
            EventType.*,
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
        ET.*,
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

            const statusesResult: ({ event_count: bigint } & Prisma.EventStatusGetPayload<{}>)[] = pq[0] as any;
            const typesResult: ({ event_count: bigint } & Prisma.EventTypeGetPayload<{}>)[] = pq[1] as any;
            const tagsResult: ({ event_count: bigint } & Prisma.EventTagGetPayload<{}>)[] = pq[2] as any;
            const eventIds: { EventId: number }[] = pq[3] as any;
            const rowCountResult: { rowCount: bigint }[] = pq[4] as any;

            // FULL EVENT DETAILS USING DB3.
            let fullEvents: db3.EventSearch_Event[] = [];
            if (eventIds.length) {
                const tableParams: db3.EventTableParams = {
                    eventIds: eventIds.map(e => e.EventId), // prevent fetching the entire table!
                    userIdForResponses: u.id, // fetch user responses for this user id.
                };

                const queryResult = await DB3QueryCore2({
                    clientIntention: { intention: "user", currentUser: u, mode: "primary" },
                    cmdbQueryContext: "getEventFilterInfo",
                    tableID: db3.xEventSearch.tableID,
                    tableName: db3.xEventSearch.tableName,
                    filter: {
                        items: [],
                        tableParams,
                    },
                    orderBy: undefined,
                }, u);

                fullEvents = queryResult.items as any;

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

            const expectedAttendanceUserTagIds = new Set<number>();
            fullEvents.forEach(e => {
                if (!e.expectedAttendanceUserTagId) return;
                expectedAttendanceUserTagIds.add(e.expectedAttendanceUserTagId);
            });

            let userTags: db3.EventResponses_ExpectedUserTag[] = [];

            if (expectedAttendanceUserTagIds.size) {
                const tableParams: db3.UserTagTableParams = {
                    ids: [...expectedAttendanceUserTagIds],
                };

                const queryResult = await DB3QueryCore2({
                    clientIntention: { intention: "user", currentUser: u, mode: "primary" },
                    cmdbQueryContext: "getEventFilterInfo-userTags",
                    tableID: db3.xUserTagForEventSearch.tableID,
                    tableName: db3.xUserTagForEventSearch.tableName,
                    filter: {
                        items: [],
                        tableParams,
                    },
                    orderBy: undefined,
                }, u);

                userTags = queryResult.items as db3.EventResponses_ExpectedUserTag[];
            }

            const statuses: GetEventFilterInfoChipInfo[] = statusesResult.map(r => ({
                color: r.color,
                iconName: r.iconName,
                id: r.id,
                label: r.label,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

            const types: GetEventFilterInfoChipInfo[] = typesResult.map(r => ({
                color: r.color,
                iconName: r.iconName,
                id: r.id,
                label: r.text,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

            const tags: GetEventFilterInfoChipInfo[] = tagsResult.map(r => ({
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



