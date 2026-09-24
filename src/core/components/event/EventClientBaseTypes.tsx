import { CalendarWindow } from "shared/dateTimePolicy";
import { SortDirection } from "@/shared/rootroot";
import { DiscreteCriterion } from "../../db3/shared/apiTypes";
import type { EventStatusPublicId, EventTagPublicId, EventTypePublicId } from "shared/publicId";

// //////////////////////////////////////////////////////////////////////////////////////////////////
export enum EventOrderByColumnOptions {
    startsAt = "startsAt",
    name = "name",
};
export enum EventOrderByColumnNames {
    startsAt = "Date",
    name = "Name",
};

export type EventOrderByColumnOption = keyof typeof EventOrderByColumnOptions;// "startsAt" | "name";

export interface EventsFilterSpec {
    calendarWindow?: CalendarWindow;
    //pageSize: number;
    //page: number;
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: EventOrderByColumnOption;
    orderByDirection: SortDirection;

    typeFilter: DiscreteCriterion<EventTypePublicId>;
    tagFilter: DiscreteCriterion<EventTagPublicId>;
    statusFilter: DiscreteCriterion<EventStatusPublicId>;
    dateFilter: DiscreteCriterion<number>;
};
