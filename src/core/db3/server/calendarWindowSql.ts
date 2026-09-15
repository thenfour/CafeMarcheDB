import { CalendarWindow, CalendarWindowSchema } from "shared/dateTimePolicy";

// P is the event alias in the search query. All user values are validated and
// converted to canonical date literals before entering this SQL fragment.
export function calendarWindowSql(input: CalendarWindow): string {
    const window = CalendarWindowSchema.parse(input);
    const instantLiteral = (value: string) => `'${new Date(value).toISOString().replace("T", " ").replace("Z", "")}'`;
    const start = instantLiteral(window.startInstant);
    const end = instantLiteral(window.endInstantExclusive);
    // Integer day rounding matches stored-range hydration even one millisecond
    // below a half-day threshold; MySQL decimal division can round that early.
    return `EXISTS (
        SELECT 1 FROM EventSegment CS
        LEFT JOIN EventStatus CST ON CST.id = CS.statusId
        WHERE CS.eventId = P.id
          AND (CST.significance IS NULL OR CST.significance <> 'Cancelled')
          AND (
            (CS.isAllDay = true
              AND DATE(CS.startsAt) < '${window.endDateExclusive}'
              AND DATE_ADD(DATE(CS.startsAt), INTERVAL GREATEST(1, (CS.durationMillis + 43200000) DIV 86400000) DAY) > '${window.startDate}')
            OR
            (CS.isAllDay = false
              AND CS.startsAt < ${end}
              AND (TIMESTAMPADD(MICROSECOND, CS.durationMillis * 1000, CS.startsAt) > ${start}
                   OR (CS.durationMillis = 0 AND CS.startsAt >= ${start})))
          )
    )`;
}
