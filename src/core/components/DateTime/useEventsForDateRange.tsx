import type { CalendarRange } from "shared/dateTimePolicy";
import type { CalendarEventSpec } from "./DateTimeTypes";

/** Keep date selection usable while event overlays depend on deferred search. */
export function useEventsForDateRange(_dateRange: CalendarRange): {
    events: CalendarEventSpec[]; loading: false; error: null; availability: "deferred";
} {
    return { events: [], loading: false, error: null, availability: "deferred" };
}

// MIGRATION_RESTORE: event-workflows
// Source: f96ac10c66a450a4b16b3a7a857abf96d125d434:src/core/components/DateTime/useEventsForDateRange.tsx:1-83
// Reason: Date-picker event highlights call the deferred raw search owner.
// Restore: Restore selected-band calendar-window search and event highlights while retaining date selection.
// Verification: Reactivate calendar-window consumer specifications and verify localized highlights, cancelled segments, point events and built-browser date selection.
// SHA256: 57af0fe9e9c4dcd6374b2b24d3912cd60702f21408d6766eead8daa4b5518c26
// MIGRATION_REFERENCE_BEGIN
// import { CalendarDate, CalendarRange, getCalendarWindow } from "shared/dateTimePolicy";
// import { eventPresentationTimeZone, getRangeCalendarDates } from "shared/dateTimePresentation";
// import React from "react";
// import { CalendarEventSpec } from "./DateTimeTypes";
// import { DiscreteCriterionFilterType } from "../../db3/shared/apiTypes";
// import { useSearchableList } from "../../hooks/useSearchableList";
// import { eventSearchConfig } from "../../hooks/searchConfigs";
// import { EventOrderByColumnOptions, EventsFilterSpec } from "../event/EventClientBaseTypes";
// import { EventStatusSignificance } from "../../db3/db3";
// import { useDashboardContext } from "../dashboardContext/DashboardContext";
//
// export const useEventsForDateRange = (dateRange: CalendarRange) => {
//     const [events, setEvents] = React.useState<CalendarEventSpec[]>([]);
//     const [error, setError] = React.useState<Error | null>(null);
//     const dashboardContext = useDashboardContext();
//
//     const filterSpec = React.useMemo(() => {
//
//         return {
//             refreshSerial: 1,
//             quickFilter: "",
//             calendarWindow: getCalendarWindow(dateRange.dates, dateRange.start.timeZone),
//             orderByColumn: EventOrderByColumnOptions.startsAt,
//             orderByDirection: 'asc' as const,
//             tagFilter: { db3Column: "tags", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//             statusFilter: {
//                 db3Column: "status", behavior: DiscreteCriterionFilterType.doesntHaveAnyOf, options:
//                     dashboardContext.eventStatus.items
//                         .filter(status => status.significance === EventStatusSignificance.Cancelled)
//                         .map(status => status.publicId)
//             },
//             typeFilter: { db3Column: "type", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//             dateFilter: { db3Column: "startsAt", behavior: DiscreteCriterionFilterType.alwaysMatch, options: [] },
//         } satisfies EventsFilterSpec;
//     }, [dateRange.start.date, dateRange.endExclusive.date, dashboardContext.eventStatus, dashboardContext.bandTimeZone, dateRange.start.timeZone]);
//
//     const { enrichedItems: enrichedEvents, results, loading } = useSearchableList(filterSpec, eventSearchConfig, 100);
//
//     // Transform enrichedEvents to CalendarEventSpec format
//     React.useEffect(() => {
//         if (!filterSpec) {
//             setEvents([]);
//             return;
//         }
//
//         setError(null);
//
//         if (enrichedEvents) {
//             try {
//                 const transformed = enrichedEvents.flatMap(event => (event.segments || [])
//                     .flatMap(segment => {
//                         const range = segment.dateRange;
//                         if (!range
//                             || range.isTBD()
//                             || segment.statusId === undefined
//                             || dashboardContext.eventStatus.getById(segment.statusId)?.significance === EventStatusSignificance.Cancelled) {
//                             return [];
//                         }
//                         const dates = getRangeCalendarDates(range, eventPresentationTimeZone(range, {
//                             viewerTimeZone: dateRange.start.timeZone,
//                             bandTimeZone: dashboardContext.bandTimeZone,
//                             locale: dashboardContext.formattingLocale,
//                         }))!;
//                         return [{
//                             id: event.publicId, // Preserve the picker cell's data-event-id.
//                             title: event.name || 'Untitled Event',
//                             color: typeof event.type?.color === "string"
//                                 ? event.type.color
//                                 : event.type?.color?.id || "blue",
//                             // Paint the selected band dates into this calendar's date cells.
//                             dateRange: new CalendarRange(new CalendarDate(dates.start.date, dateRange.start.timeZone),
//                                 new CalendarDate(dates.endExclusive.date, dateRange.start.timeZone)),
//                         }];
//                     }));
//                 setEvents(transformed);
//             } catch (err) {
//                 setError(err instanceof Error ? err : new Error('Failed to transform events'));
//             }
//         }
//     }, [enrichedEvents, filterSpec, dashboardContext.eventStatus, dashboardContext.bandTimeZone, dateRange.start.timeZone]);
//
//     return { events, loading, error };
// };
// MIGRATION_REFERENCE_END
