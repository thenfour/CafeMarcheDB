import { SortDirection } from "@/shared/rootroot";
import { DiscreteCriterion } from "../../db3/shared/apiTypes";


////////////////////////////////////////////////////////////////////////////////////////////////////
export enum UserOrderByColumnOptions {
    //id = "id",
    name = "name",
    createdAt = "createdAt",
};

export type UserOrderByColumnOption = keyof typeof UserOrderByColumnOptions;

export interface UsersFilterSpec {
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: UserOrderByColumnOptions;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion;
    instrumentFilter: DiscreteCriterion;
    roleFilter: DiscreteCriterion;
};



