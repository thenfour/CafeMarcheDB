
import { resolver } from "@blitzjs/rpc";
import { AuthenticatedCtx } from "blitz";
import db, { Prisma } from "db";
import { Permission } from "shared/permissions";
import { IsNullOrWhitespace, SplitQuickFilter, assertIsNumberArray, mysql_real_escape_string } from "shared/utils";
import { getCurrentUserCore } from "../server/db3mutationCore";
import { GetEventFilterInfoChipInfo, GetEventFilterInfoRet, MakeGetEventFilterInfoRet, TimingFilter, gEventFilterTimingIDConstants, gEventRelevantFilterExpression } from "../shared/apiTypes";

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

            const startTimestamp = Date.now();

            assertIsNumberArray(args.filterSpec.statusIds);
            assertIsNumberArray(args.filterSpec.tagIds);
            assertIsNumberArray(args.filterSpec.typeIds);

            const eventFilterExpressions: string[] = [];
            if (!IsNullOrWhitespace(args.filterSpec.quickFilter)) {
                // tokens are AND'd together.
                const tokens = SplitQuickFilter(args.filterSpec.quickFilter);
                const tokensExpr = tokens.map(t => {
                    const qf = mysql_real_escape_string(t);
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
                "relevant": gEventRelevantFilterExpression,//`((startsAt >= DATE_SUB(curdate(), INTERVAL 6 day)) OR (startsAt IS NULL))`,
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

            const AND: string[] = [
                `Event.isDeleted = FALSE`,
            ];
            if (!u.isSysAdmin) {
                AND.push(`Event.visiblePermissionId IN (${u.role?.permissions.map(p => p.permissionId)})`);
                // TODO: handle private visibility (Event.visiblePermissionId is null && creator = self)
            }
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

            const statusesStartTimestamp = Date.now();
            const statusesResult: ({ event_count: bigint } & Prisma.EventStatusGetPayload<{}>)[] = await db.$queryRaw(Prisma.raw(statusesQuery));
            const statusesQueryMS = Date.now() - statusesStartTimestamp;

            const statuses: GetEventFilterInfoChipInfo[] = statusesResult.map(r => ({
                color: r.color,
                iconName: r.iconName,
                id: r.id,
                label: r.label,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

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

            const typesStartTimestamp = Date.now();
            const typesResult: ({ event_count: bigint } & Prisma.EventTypeGetPayload<{}>)[] = await db.$queryRaw(Prisma.raw(typesQuery));
            const typesQueryMS = Date.now() - typesStartTimestamp;

            const types: GetEventFilterInfoChipInfo[] = typesResult.map(r => ({
                color: r.color,
                iconName: r.iconName,
                id: r.id,
                label: r.text,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

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

            const tagsStartTimestamp = Date.now();
            const tagsResult: ({ event_count: bigint } & Prisma.EventTagGetPayload<{}>)[] = await db.$queryRaw(Prisma.raw(tagsQuery));
            const tagsQueryMS = Date.now() - tagsStartTimestamp;

            const tags: GetEventFilterInfoChipInfo[] = tagsResult.map(r => ({
                color: r.color,
                iconName: null,
                id: r.id,
                label: r.text,
                tooltip: r.description,
                rowCount: new Number(r.event_count).valueOf(),
            }));

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
        ${args.filterSpec.pageSize * args.filterSpec.page},${args.filterSpec.pageSize}

        `;

            const paginatedStartTimestamp = Date.now();
            const eventIds: { EventId: number }[] = await db.$queryRaw(Prisma.raw(paginatedEventQuery));
            const paginatedQueryMS = Date.now() - paginatedStartTimestamp;

            // TOTAL filtered row count
            const totalRowCountQuery = `
        ${filteredEventsCTE}
    select
		count(*) as rowCount
    from
        FilteredEvents

        `;

            const rowCountResult: { rowCount: bigint }[] = await db.$queryRaw(Prisma.raw(totalRowCountQuery));

            const totalExecutionTimeMS = Date.now() - startTimestamp;

            return {
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
                typesQueryMS,
                statusesQueryMS,
                tagsQueryMS,
                paginatedQueryMS,
            };
        } catch (e) {
            console.error(e);
            throw (e);
        }
    }
);



