import React from "react";
import { CalendarDate, CalendarRange, getCalendarWindow } from "shared/dateTimePolicy";
import { eventPresentationTimeZone, getRangeCalendarDates } from "shared/dateTimePresentation";
import { EventStatusSignificance } from "src/core/db3/db3";
import { DiscreteCriterionFilterType } from "src/core/db3/shared/apiTypes";
import { eventSearchConfig } from "src/core/hooks/searchConfigs";
import { useSearchableList } from "src/core/hooks/useSearchableList";
import { useDashboardContext } from "../dashboardContext/DashboardContext";
import { EventOrderByColumnOptions, type EventsFilterSpec } from "../event/EventClientBaseTypes";
import type { CalendarEventSpec } from "./DateTimeTypes";

export function useEventsForDateRange(dateRange: CalendarRange) {
    const dashboard = useDashboardContext();
    const cancelledStatuses = dashboard.eventStatus.items.filter(status => status.significance === EventStatusSignificance.Cancelled)
        .map(status => status.publicId);
    const filter: EventsFilterSpec = {
        refreshSerial: 1,
        quickFilter: "",
        calendarWindow: getCalendarWindow(dateRange.dates, dateRange.start.timeZone),
        orderByColumn: EventOrderByColumnOptions.startsAt,
        orderByDirection: "asc",
        tagFilter: { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        typeFilter: { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        dateFilter: { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
        statusFilter: {
            db3Column: "status", behavior: cancelledStatuses.length > 0
                ? DiscreteCriterionFilterType.doesntHaveAnyOf : DiscreteCriterionFilterType.alwaysMatch,
            options: cancelledStatuses,
        },
    };
    // Keep the reference picker's bounded month search through the ordinary Event owner.
    const { enrichedItems, loading } = useSearchableList(filter, eventSearchConfig, 100);
    const highlights = React.useMemo<{ events: CalendarEventSpec[]; error: Error | null }>(() => {
        try {
            const events: CalendarEventSpec[] = enrichedItems.flatMap(event => (event.segments ?? []).flatMap(segment => {
                const range = segment.dateRange;
                if (!range || range.isTBD()
                    || dashboard.eventStatus.getById(segment.statusId)?.significance === EventStatusSignificance.Cancelled) {
                    return [];
                }
                const dates = getRangeCalendarDates(range, eventPresentationTimeZone(range, {
                    viewerTimeZone: dateRange.start.timeZone,
                    bandTimeZone: dashboard.bandTimeZone,
                    locale: dashboard.formattingLocale,
                }))!;
                return [{
                    id: event.publicId,
                    title: event.name || "Untitled Event",
                    color: event.type?.color?.id ?? "blue",
                    // All-day dates stay in the band; timed dates use the picker timezone.
                    dateRange: new CalendarRange(new CalendarDate(dates.start.date, dateRange.start.timeZone),
                        new CalendarDate(dates.endExclusive.date, dateRange.start.timeZone)),
                }];
            }));
            return { events, error: null };
        } catch (error) {
            return { events: [], error: error instanceof Error ? error : new Error("Failed to transform events") };
        }
    }, [enrichedItems, dashboard.eventStatus, dashboard.bandTimeZone, dashboard.formattingLocale, dateRange.start.timeZone]);
    return { ...highlights, loading };
}
