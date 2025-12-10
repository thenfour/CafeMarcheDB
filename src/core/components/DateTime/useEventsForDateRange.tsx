import { DateTimeRange, DateToYYYYMMDD, gMillisecondsPerHour } from "@/shared/time";
import React from "react";
import { CalendarEventSpec } from "./DateTimeTypes";
import { DiscreteCriterionFilterType } from "../../db3/shared/apiTypes";
import { useSearchableList } from "../../hooks/useSearchableList";
import { eventSearchConfig } from "../../hooks/searchConfigs";
import { EventOrderByColumnOptions, EventsFilterSpec } from "../event/EventClientBaseTypes";
import { EventStatusSignificance } from "../../db3/db3";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export const useEventsForDateRange = (dateRange: DateTimeRange | null) => {
    const [events, setEvents] = React.useState<CalendarEventSpec[]>([]);
    const [error, setError] = React.useState<Error | null>(null);
    const dashboardContext = useDashboardContext();

    const now = React.useMemo(() => new Date(), []);

    const filterSpec = React.useMemo(() => {

        if (!dateRange) dateRange = new DateTimeRange({
            startsAtDateTime: now,
            durationMillis: gMillisecondsPerHour,
            isAllDay: false,
        });
        const startDate = dateRange.getStartDateTime(new Date());
        const endDate = dateRange.getEndDateTime(new Date());
        return {
            refreshSerial: 1,
            quickFilter: `${DateToYYYYMMDD(startDate)}-${DateToYYYYMMDD(endDate)}`,
            orderByColumn: EventOrderByColumnOptions.startsAt,
            orderByDirection: 'asc' as const,
            tagFilter: { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            statusFilter: {
                db3Column: "status", behavior: DiscreteCriterionFilterType.doesntHaveAnyOf, options:
                    dashboardContext.eventStatus.items
                        .filter(status => status.significance === EventStatusSignificance.Cancelled)
                        .map(status => status.id)
            },
            typeFilter: { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
            dateFilter: { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        } satisfies EventsFilterSpec;
    }, [dateRange]);

    const { enrichedItems: enrichedEvents, results, loading } = useSearchableList(filterSpec, eventSearchConfig, 100);

    console.log("useEventsForDateRange: filterSpec:", filterSpec, enrichedEvents);

    // Transform enrichedEvents to CalendarEventSpec format
    React.useEffect(() => {
        if (!filterSpec) {
            setEvents([]);
            return;
        }

        setError(null);

        if (enrichedEvents) {
            try {
                const transformed = enrichedEvents.map(event => ({
                    id: event.id.toString(),
                    title: event.name || 'Untitled Event',
                    color: event.type?.color || 'blue',
                    dateRange: new DateTimeRange({
                        startsAtDateTime: event.startsAt,
                        durationMillis: Number(event.durationMillis) || gMillisecondsPerHour,
                        isAllDay: event.isAllDay || false,
                    }),
                }));
                setEvents(transformed);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to transform events'));
            }
        }
    }, [enrichedEvents, filterSpec]);

    return { events, loading, error };
};
