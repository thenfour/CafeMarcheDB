import { DateTimeRange } from "@/shared/time";

export interface CalendarEventSpec {
    id: string;
    dateRange: DateTimeRange;
    title: string;
    color: string;
}
