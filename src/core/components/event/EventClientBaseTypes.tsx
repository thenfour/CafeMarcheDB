import { SortDirection } from "@/shared/rootroot";
import { DiscreteCriterion } from "../../db3/shared/apiTypes";

// //////////////////////////////////////////////////////////////////////////////////////////////////
export enum EventOrderByColumnOptions {
    id = "id",
    startsAt = "startsAt",
    name = "name",
};

export type EventOrderByColumnOption = keyof typeof EventOrderByColumnOptions;// "startsAt" | "name";

export interface EventsFilterSpec {
    //pageSize: number;
    //page: number;
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: EventOrderByColumnOption;
    orderByDirection: SortDirection;

    typeFilter: DiscreteCriterion;
    tagFilter: DiscreteCriterion;
    statusFilter: DiscreteCriterion;
    dateFilter: DiscreteCriterion;
};
