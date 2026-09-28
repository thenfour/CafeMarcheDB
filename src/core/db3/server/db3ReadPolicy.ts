import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import { AuthorizationError } from "blitz";
import type { TAnyModel } from "shared/rootroot";
import type { xTable } from "../shared/db3core";

const emptyFilter = {
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
    auth: CMServerAuthorization;
    where?: TAnyModel | null;
    includeDeleted?: boolean;
}

// returns a prisma where clause that enforces the table's read policy
export async function GetAuthorizedTableReadWhere({
    table,
    auth,
    where,
    includeDeleted = false,
}: GetAuthorizedTableReadWhereArgs): Promise<TAnyModel> {

    if (!table.authorizeTableForView(auth) || !table.authorizeIncludeDeleted(auth, includeDeleted)) {
        throw new AuthorizationError();
    }

    const policyWhere = table.CalculateWhereClause({
        auth,
        includeDeleted,
        filterModel: emptyFilter,
    });

    return ComposePrismaWhere(policyWhere, where) || {};
}
