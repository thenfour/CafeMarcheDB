import { CalendarDate, CalendarRange, getCalendarWindow } from "shared/dateTimePolicy";
import { eventPresentationTimeZone, getRangeCalendarDates } from "shared/dateTimePresentation";
import React from "react";
import { CalendarEventSpec } from "./DateTimeTypes";
import { DiscreteCriterionFilterType } from "../../db3/shared/apiTypes";
import { useSearchableList } from "../../hooks/useSearchableList";
import { eventSearchConfig } from "../../hooks/searchConfigs";
import { EventOrderByColumnOptions, EventsFilterSpec } from "../event/EventClientBaseTypes";
import { EventStatusSignificance } from "../../db3/db3";
import { useDashboardContext } from "../dashboardContext/DashboardContext";

export const useEventsForDateRange = (dateRange: CalendarRange) => {
    const [events, setEvents] = React.useState<CalendarEventSpec[]>([]);
    const [error, setError] = React.useState<Error | null>(null);
    const dashboardContext = useDashboardContext();

    const filterSpec = React.useMemo(() => {

        return {
            refreshSerial: 1,
            quickFilter: "",
            calendarWindow: getCalendarWindow(dateRange.dates, dateRange.start.timeZone),
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
    }, [dateRange.start.date, dateRange.endExclusive.date, dashboardContext.eventStatus, dashboardContext.bandTimeZone, dateRange.start.timeZone]);

    const { enrichedItems: enrichedEvents, results, loading } = useSearchableList(filterSpec, eventSearchConfig, 100);

    // Transform enrichedEvents to CalendarEventSpec format
    React.useEffect(() => {
        if (!filterSpec) {
            setEvents([]);
            return;
        }

        setError(null);

        if (enrichedEvents) {
            try {
                const transformed = enrichedEvents.flatMap(event => (event.segments || [])
                    .flatMap(segment => {
                        const range = segment.dateRange;
                        if (!range
                            || range.isTBD()
                            || segment.statusId === undefined
                            || dashboardContext.eventStatus.getById(segment.statusId)?.significance === EventStatusSignificance.Cancelled) {
                            return [];
                        }
                        const dates = getRangeCalendarDates(range, eventPresentationTimeZone(range, {
                            viewerTimeZone: dateRange.start.timeZone,
                            bandTimeZone: dashboardContext.bandTimeZone,
                            locale: dashboardContext.userLocale,
                        }))!;
                        return [{
                            id: event.id.toString(), // Preserve the picker cell's data-event-id.
                            title: event.name || 'Untitled Event',
                            color: event.type?.color || 'blue',
                            // Paint the selected band dates into this calendar's date cells.
                            dateRange: new CalendarRange(new CalendarDate(dates.start.date, dateRange.start.timeZone),
                                new CalendarDate(dates.endExclusive.date, dateRange.start.timeZone)),
                        }];
                    }));
                setEvents(transformed);
            } catch (err) {
                setError(err instanceof Error ? err : new Error('Failed to transform events'));
            }
        }
    }, [enrichedEvents, filterSpec, dashboardContext.eventStatus, dashboardContext.bandTimeZone, dateRange.start.timeZone]);

    return { events, loading, error };
};
