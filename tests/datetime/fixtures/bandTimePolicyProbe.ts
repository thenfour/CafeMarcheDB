import { getLegacyAllDayCalendarDates } from "src/server/migrateEventUtcSpans";
import { CalendarDate } from "shared/dateTimePolicy";
import {
  bandDateTimeToInstant,
  getAllDayInterval,
} from "shared/dateTimePolicy"

const calendarDates = getLegacyAllDayCalendarDates(new Date("2026-07-10T00:00Z"), 86_400_000)
const interval = getAllDayInterval(calendarDates, "Europe/Brussels")
process.stdout.write(JSON.stringify({
  authored: bandDateTimeToInstant({ date: "2026-07-10", time: "09:45" }, "Europe/Brussels").toISOString(),
  repeatedHour: bandDateTimeToInstant({ date: "2026-10-25", time: "02:30" }, "Europe/Brussels").toISOString(),
  bandStart: interval.start.toISOString(),
  bandEnd: interval.end.toISOString(),
  calendarDates,
  encodedDate: new CalendarDate(calendarDates.startDate, "UTC").toStartInstant().toISOString(),
}))
