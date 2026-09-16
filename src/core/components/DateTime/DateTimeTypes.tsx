import { CalendarRange } from "@/shared/dateTimePolicy";

export interface CalendarEventSpec {
    id: string;
    dateRange: CalendarRange;
    title: string;
    color: string;
}
