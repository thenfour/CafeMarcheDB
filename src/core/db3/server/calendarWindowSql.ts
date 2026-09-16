import { CalendarWindow, CalendarWindowSchema, getAllDayInterval } from "shared/dateTimePolicy";

// P is the event alias in the search query. All user values are validated and
// converted to canonical date literals before entering this SQL fragment.

// bandTimeZone required for allday event interpretation
export function calendarWindowSql(input: CalendarWindow, bandTimeZone: string): string {
  const window = CalendarWindowSchema.parse(input);

  const sqlInstantLiteral = (value: string) => `'${new Date(value).toISOString().replace("T", " ").replace("Z", "")}'`;

  const start = sqlInstantLiteral(window.startInstant);
  const end = sqlInstantLiteral(window.endInstantExclusive);
  // Convert the calendar window and all-day interval to SQL instant literals.
  // events store the correct UTC representation of a band-local date range; we need to
  // use those offsets to catch all-day events correctly.
  // e.g., for a brussels-based band, (+2 offset from UTC),
  // an event that's all-day will be stored in the database as starting at 22:00 UTC (which is 00:00 local time in Brussels)
  // in order to search for that event, we need to adjust the search window to the band's local time.
  const bandWindow = getAllDayInterval(window, bandTimeZone);
  const allDayStart = sqlInstantLiteral(bandWindow.start.toISOString());
  const allDayEnd = sqlInstantLiteral(bandWindow.end.toISOString());
  return `EXISTS (
        SELECT 1 FROM EventSegment CS
        LEFT JOIN EventStatus CST ON CST.id = CS.statusId
        WHERE CS.eventId = P.id
          AND (CST.significance IS NULL OR CST.significance <> 'Cancelled')
          AND (
            (CS.isAllDay = true
              AND CS.startsAt < ${allDayEnd}
              AND TIMESTAMPADD(MICROSECOND, CS.durationMillis * 1000, CS.startsAt) > ${allDayStart})
            OR
            (CS.isAllDay = false
              AND CS.startsAt < ${end}
              AND (TIMESTAMPADD(MICROSECOND, CS.durationMillis * 1000, CS.startsAt) > ${start}
                   OR (CS.durationMillis = 0 AND CS.startsAt >= ${start})))
          )
    )`;
}
