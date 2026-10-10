import type { SortDirection } from "shared/rootroot";
import type { DiscreteCriterion } from "../../db3/shared/apiTypes";

export const UserOrderByColumnOptions = { name: "name", createdAt: "createdAt" } as const;
export const UserOrderByColumnNames = { name: "Name", createdAt: "Join Date" };
export type UserOrderByColumnOption = keyof typeof UserOrderByColumnOptions;

export interface UsersFilterSpec {
    readonly includeDeleted?: boolean;
    readonly quickFilter: string;
    readonly refreshSerial: number;
    readonly orderByColumn: UserOrderByColumnOption;
    readonly orderByDirection: SortDirection;
    readonly tagFilter: DiscreteCriterion;
    readonly instrumentFilter: DiscreteCriterion;
    readonly roleFilter: DiscreteCriterion;
}
