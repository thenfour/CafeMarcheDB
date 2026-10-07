import { SplitQuickFilter } from "shared/quickFilter";
import type { PresentationInput } from "src/locale/shared/presentationInput";
import type { PaginatedQueryRequestInput } from "../../db3core";
import { bandUserProfileView } from "./bandUserProfile";
import { xBandRole } from "./bandRoleViews";
import { xBandUserTag } from "./bandUserTagViews";
import { xBandInstrument } from "../instrument/bandInstrumentContracts";
import { isOneOf } from "@/shared/arrayUtils";

export interface BandMemberDirectoryFilter {
    readonly search: string;
    readonly tagId: string;
    readonly instrumentId: string;
    readonly roleId: string;
    readonly order: "nameAsc" | "nameDesc" | "joinedAsc" | "joinedDesc";
    readonly page: number;
}

const PAGE_SIZE = 20;

/** Public catalog identities are resolved by DB3 before applying membership predicates. */
export function bandMemberDirectoryQuery(
    filter: BandMemberDirectoryFilter,
    context: PresentationInput,
    canManageMembers: boolean,
): PaginatedQueryRequestInput {
    const joined = canManageMembers && isOneOf(filter.order, "joinedAsc", "joinedDesc");
    return {
        ...context,
        table: { tableID: bandUserProfileView.tableID, tableName: bandUserProfileView.tableName, viewID: bandUserProfileView.viewID },
        filter: {
            quickFilterValues: SplitQuickFilter(filter.search),
            tableParams: {
                ...(filter.tagId ? { tagId: xBandUserTag.parseIdentity(filter.tagId) } : {}),
                ...(filter.instrumentId ? { instrumentId: xBandInstrument.parseIdentity(filter.instrumentId) } : {}),
                ...(filter.roleId ? { roleId: filter.roleId === "unassigned" ? null : xBandRole.parseIdentity(filter.roleId) } : {}),
            },
        },
        orderBy: {
            [joined ? "createdAt" : "user"]: isOneOf(filter.order, "nameDesc", "joinedDesc") ? "desc" : "asc"
        },
        skip: filter.page * PAGE_SIZE, take: PAGE_SIZE, cmdbQueryContext: "member directory",
    };
}
