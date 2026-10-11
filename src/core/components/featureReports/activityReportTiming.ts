import { Temporal } from "@js-temporal/polyfill";
import { CalendarDate } from "shared/dateTimePolicy";

const kDurationMap = Object.freeze({
    year: { years: 1 },
    sixMonths: { months: 6 },
    threeMonths: { months: 3 },
    month: { months: 1 },
    twoWeeks: { days: 14 },
});

export type ActivityReportPeriod = keyof typeof kDurationMap;
export function activityReportDateRange(now: Date, timeZone: string, period: ActivityReportPeriod) {
    const today = CalendarDate.fromInstant({ value: now, timeZone });
    const date = Temporal.PlainDate.from(today.date);
    return {
        startDate: new CalendarDate(date.subtract(kDurationMap[period]).toString(), timeZone).toStartInstant(),
        endDateExclusive: today.addDays(1).toStartInstant(),
    };
}
