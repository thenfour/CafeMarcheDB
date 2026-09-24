import { SortDirection } from "@/shared/rootroot";
import { DiscreteCriterion } from "../../db3/shared/apiTypes";
import type { UserTagPublicId } from "shared/publicId";


////////////////////////////////////////////////////////////////////////////////////////////////////
export enum UserOrderByColumnOptions {
    name = "name",
    createdAt = "createdAt",
};
export enum UserOrderByColumnNames {
    name = "Name",
    createdAt = "Join Date",
};

export type UserOrderByColumnOption = keyof typeof UserOrderByColumnOptions;

export interface UsersFilterSpec {
    includeDeleted?: boolean;
    quickFilter: string;
    refreshSerial: number; // this is necessary because you can do things to change the results from this page. think of adding an event then refetching.

    orderByColumn: UserOrderByColumnOptions;
    orderByDirection: SortDirection;

    tagFilter: DiscreteCriterion<UserTagPublicId>;
    instrumentFilter: DiscreteCriterion;
    roleFilter: DiscreteCriterion;
};



