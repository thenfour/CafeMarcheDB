import { AuthorizationError } from "blitz";
import type { TAnyModel } from "shared/rootroot";
import { loadAuthorizationForUser } from "@/src/auth/server/requestAuthorization";
import type { xTable } from "../shared/db3core";
import type { UserWithRolesPayload } from "../shared/schema/userPayloads";

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
    currentUser: UserWithRolesPayload | null;
    where?: TAnyModel | null;
    includeDeleted?: boolean;
}

// returns a prisma where clause that enforces the table's read policy
export async function GetAuthorizedTableReadWhere({
    table,
    currentUser,
    where,
    includeDeleted = false,
}: GetAuthorizedTableReadWhereArgs): Promise<TAnyModel> {

    const authorization = await loadAuthorizationForUser(currentUser);
    const publicData = authorization;

    if (!table.authorizeTableForView(publicData) || !table.authorizeIncludeDeleted(publicData, includeDeleted)) throw new AuthorizationError();

    const policyWhere = table.CalculateWhereClause({
        publicData,
        includeDeleted,
        filterModel: emptyFilter,
    });

    return ComposePrismaWhere(policyWhere, where) || {};
}
