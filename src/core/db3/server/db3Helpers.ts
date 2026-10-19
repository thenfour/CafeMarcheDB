import { CMServerAuthorization } from "@/src/auth/server/serverAuthorization";
import { Prisma, PrismaClient } from "db";
import { PermissionSignificance, type TransactionalPrismaClient } from "../shared/apiTypes";

// PermissionSignificance.Visibility_Members
export const GetDefaultVisibilityPermission = async (dbt: TransactionalPrismaClient) => {
    return await GetPermissionBySignificance(dbt, PermissionSignificance.Visibility_Members);
};

// PermissionSignificance.Visibility_Members
export const GetPermissionBySignificance = async (dbt: TransactionalPrismaClient, significance: string) => {
    const p = await (dbt as PrismaClient).permission.findFirst({
        where: { significance }
    });
    return p;
};

export const GetSoftDeleteWhereExpression = (isDeletedColumnName?: string | undefined | null) => {
    return { [isDeletedColumnName || "isDeleted"]: false };
};

interface GetVisibilityWhereExpressionArgs {
    visiblePermissionIdColumnName?: string | undefined | null;
    ownerUserIdColumnName?: string | undefined | null;
    auth: CMServerAuthorization;
    allowConfiguredVisibility: boolean;
}

// Builds Prisma visibility WHERE clause.
// null visibility value is private and is visible only to its owner
// all other rows require the corresponding permission ID.
// owner searches the actor (auth)
export const GetVisibilityWhereExpression = ({
    visiblePermissionIdColumnName,
    auth,
    ownerUserIdColumnName,
    allowConfiguredVisibility,
}: GetVisibilityWhereExpressionArgs) => {
    const visibilityColumn = visiblePermissionIdColumnName || "visiblePermissionId";
    const permissionWhere = {
        [visibilityColumn]: allowConfiguredVisibility ? { not: null } : { in: [...auth.effectivePermissions.ids] },
    };

    if (auth.userId == null || !ownerUserIdColumnName) return permissionWhere;

    return {
        OR: [
            permissionWhere,
            {
                AND: [
                    { [visibilityColumn]: null },
                    { [ownerUserIdColumnName]: auth.userId },
                ],
            },
        ],
    };
};

interface GetUserVisibilityWhereExpression2Args {
    auth: CMServerAuthorization;
    createdByUserIDColumnName?: string | undefined | null;
    allowConfiguredVisibility: boolean;
};

export const GetUserVisibilityWhereExpression = ({ auth, createdByUserIDColumnName, allowConfiguredVisibility }: GetUserVisibilityWhereExpression2Args) => {
    const ret = GetVisibilityWhereExpression({
        auth,
        ownerUserIdColumnName: createdByUserIDColumnName,
        allowConfiguredVisibility,
    });
    const STATIC_TYPE_CHECK: Prisma.EventWhereInput = ret;
    return ret;
};
