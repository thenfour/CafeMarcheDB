import { Temporal } from "@js-temporal/polyfill"; // todo: we're mixing native date, temporal, and dayjs...
import { CalendarDate } from "shared/dateTimePolicy";
import type { EventActivityTiming } from "../shared/entities/event/eventActivity";
import type { EventTableParams } from "../shared/schema/event";

/** Past excludes today; Future includes today, using the band's calendar day. */
export function eventActivityDateFilter(timing: EventActivityTiming, today: CalendarDate): Pick<EventTableParams, "startsBefore" | "startsOnOrAfter"> {
    if (timing === "All") {
        return {};
    }
    if (timing === "Future") {
        return { startsOnOrAfter: today.toStartInstant() };
    }
    if (timing === "All past") {
        return { startsBefore: today.toStartInstant() };
    }
    const years = timing === "Past year" ? 1 : 5; // "Past 5 years"
    const firstDate = Temporal.PlainDate.from(today.date).subtract({ years }).toString();
    return { startsBefore: today.toStartInstant(), startsOnOrAfter: new CalendarDate(firstDate, today.timeZone).toStartInstant() };
}
