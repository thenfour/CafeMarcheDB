import { AuthorizationError } from "blitz";
import type { TAnyModel } from "shared/rootroot";
import { CreatePublicData } from "types";
import type { xTable } from "../shared/db3core";
import type { UserWithRolesPayload } from "../shared/schema/userPayloads";
import { deriveDB3ClientIntention } from "./db3RequestValidation";

const emptyFilter = {
    items: [],
    tableParams: {},
};

export function ComposePrismaWhere(
    ...clauses: Array<TAnyModel | null | undefined | false>
): TAnyModel | undefined {
    const presentClauses = clauses.filter((clause): clause is TAnyModel => !!clause);
    if (presentClauses.length === 0) return undefined;
    if (presentClauses.length === 1) return presentClauses[0];
    return { AND: presentClauses };
}

interface GetAuthorizedTableReadWhereArgs {
    table: xTable;
    currentUser: UserWithRolesPayload | null;
    where?: TAnyModel | null;
}

/**
 * Composes a trusted server-side business predicate with the same table,
 * soft-delete, private-owner, and visibility-permission scope used by DB3.
 * Direct Prisma reads of DB3-managed content should enter through this helper.
 */
export async function GetAuthorizedTableReadWhere({
    table,
    currentUser,
    where,
}: GetAuthorizedTableReadWhereArgs): Promise<TAnyModel> {
    const clientIntention = deriveDB3ClientIntention("query", currentUser);
    const publicData = CreatePublicData({ user: currentUser });

    if (table.requiresActualSysadmin && !publicData.isSysAdmin) throw new AuthorizationError();
    if (!table.authorizeTableForView(publicData)) throw new AuthorizationError();

    const policyWhere = await table.CalculateWhereClause({
        clientIntention,
        publicData,
        filterModel: emptyFilter,
    });

    return ComposePrismaWhere(policyWhere, where) || {};
}
